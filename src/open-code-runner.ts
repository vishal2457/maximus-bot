import fs from "fs";
import net from "net";
import path from "path";
import type { OpencodeClient, ServerOptions } from "@opencode-ai/sdk/v2";
import { OpenCodeResult } from "./types";

const MAX_OUTPUT_LENGTH = parsePositiveInt(
  process.env.OPENCODE_MAX_OUTPUT_LENGTH,
  1800,
);
const MAX_PROMPT_LENGTH = parsePositiveInt(
  process.env.OPENCODE_MAX_PROMPT_LENGTH,
  8000,
);
const RUN_TIMEOUT_MS = parsePositiveInt(
  process.env.OPENCODE_RUN_TIMEOUT_MS,
  5 * 60 * 1000,
);
const SERVER_START_TIMEOUT_MS = parsePositiveInt(
  process.env.OPENCODE_SERVER_START_TIMEOUT_MS,
  30_000,
);
const SERVER_PORT = parseNonNegativeInt(process.env.OPENCODE_SERVER_PORT);
const RUN_RETRY_COUNT = parsePositiveInt(
  process.env.OPENCODE_RUN_RETRY_COUNT,
  2,
);
const HEALTH_CHECK_TIMEOUT_MS = parsePositiveInt(
  process.env.OPENCODE_HEALTH_CHECK_TIMEOUT_MS,
  5_000,
);

const PERMISSION_MODE = normalizePermissionMode(
  process.env.OPENCODE_PERMISSION_MODE,
);

type PermissionMode = "ask" | "allow" | "deny";
export type OpenCodePermissionReply = "once" | "always" | "reject";

export type OpenCodePermissionRequest = {
  id: string;
  sessionId: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
  always: string[];
};

export type OpenCodeQuestionOption = {
  label: string;
  description: string;
};

export type OpenCodeQuestion = {
  question: string;
  header: string;
  options: OpenCodeQuestionOption[];
  multiple?: boolean;
  custom?: boolean;
};

export type OpenCodeQuestionRequest = {
  id: string;
  sessionId: string;
  questions: OpenCodeQuestion[];
};

export type OpenCodeInteractionHandler = {
  onPermissionRequest?: (
    request: OpenCodePermissionRequest,
  ) => Promise<OpenCodePermissionReply>;
  onQuestionRequest?: (
    request: OpenCodeQuestionRequest,
  ) => Promise<string[][]>;
};

type OpenCodeRuntime = {
  client: OpencodeClient;
  server: {
    url: string;
    close(): void;
  };
};

type OpencodeSdkModule = {
  createOpencode(options?: ServerOptions): Promise<OpenCodeRuntime>;
};

type RequestResult<TData> = {
  data?: TData;
  error?: unknown;
};

type OpenCodeMessage = {
  info: {
    id: string;
    sessionID: string;
    role: string;
    error?: unknown;
    time?: {
      completed?: number;
    };
  };
  parts: Array<{ type: string; [key: string]: unknown }>;
};

type OpenCodeEvent = {
  type: string;
  properties?: Record<string, unknown>;
};

let sdkPromise: Promise<OpencodeSdkModule> | null = null;
let runtimePromise: Promise<OpenCodeRuntime> | null = null;
let runtime: OpenCodeRuntime | null = null;

export async function runOpenCode(
  prompt: string,
  workingDir: string,
  sessionId?: string,
  interactionHandler?: OpenCodeInteractionHandler,
): Promise<OpenCodeResult> {
  const start = Date.now();

  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) {
    return {
      success: false,
      output: "",
      error: "Prompt is empty.",
      exitCode: -1,
      duration: 0,
    };
  }

  if (normalizedPrompt.length > MAX_PROMPT_LENGTH) {
    return {
      success: false,
      output: "",
      error: `Prompt exceeds max length of ${MAX_PROMPT_LENGTH} characters.`,
      exitCode: -1,
      duration: 0,
    };
  }

  const resolvedDir = resolveWorkingDir(workingDir);
  if (!resolvedDir.ok) {
    return {
      success: false,
      output: "",
      error: resolvedDir.error,
      exitCode: -1,
      duration: 0,
    };
  }

  for (let attempt = 0; attempt <= RUN_RETRY_COUNT; attempt += 1) {
    try {
      return await runWithSdk(
        normalizedPrompt,
        resolvedDir.path,
        start,
        sessionId,
        interactionHandler,
      );
    } catch (error: unknown) {
      const canRetry = attempt < RUN_RETRY_COUNT;
      const duration = Date.now() - start;
      const errMsg = formatUnknownError(error);

      console.error(
        `[OpenCode] attempt=${attempt + 1} failed after ${duration}ms: ${errMsg}`,
      );

      if (!canRetry) {
        return {
          success: false,
          output: "",
          error: errMsg,
          exitCode: -1,
          duration,
        };
      }

      await resetRuntime();
    }
  }

  return {
    success: false,
    output: "",
    error: "OpenCode failed unexpectedly.",
    exitCode: -1,
    duration: Date.now() - start,
  };
}

async function runWithSdk(
  prompt: string,
  workingDir: string,
  start: number,
  existingSessionId?: string,
  interactionHandler?: OpenCodeInteractionHandler,
): Promise<OpenCodeResult> {
  console.log(`[OpenCode] runWithSdk called, workingDir=${workingDir}`);
  const opencode = await getRuntime();

  const sessionId = existingSessionId
    ? await resumeSession(existingSessionId)
    : await createSession(opencode.client, workingDir);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);

  try {
    const eventSubscription = await opencode.client.event.subscribe(
      { directory: workingDir },
      { signal: controller.signal },
    );

    console.log(`[OpenCode] Sending prompt to session ${sessionId}...`);
    const completionPromise = waitForSessionCompletion(
      opencode.client,
      eventSubscription.stream,
      sessionId,
      workingDir,
      interactionHandler,
      controller.signal,
    );

    const promptResult = (await opencode.client.session.promptAsync(
      {
        sessionID: sessionId,
        directory: workingDir,
        parts: [{ type: "text", text: prompt }],
      },
      { signal: controller.signal },
    )) as RequestResult<void>;

    if (promptResult.error) {
      throw new Error(
        formatRequestError("Failed to run prompt", promptResult.error),
      );
    }

    const message = await completionPromise;
    console.log("[OpenCode] Prompt completed, formatting output...");

    const output = formatMessageParts(message.parts);
    const assistantError = extractAssistantError(message.info.error);
    const fullOutput = output || assistantError || "(no output)";
    const trimmedOutput = trimOutput(fullOutput);
    const duration = Date.now() - start;

    return {
      success: !assistantError,
      output: trimmedOutput,
      error: assistantError || undefined,
      exitCode: assistantError ? 1 : 0,
      duration,
      sessionId,
    };
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      throw new Error(
        `OpenCode timed out after ${Math.round(RUN_TIMEOUT_MS / 1000)}s.`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    controller.abort();
  }
}

async function resumeSession(existingSessionId: string): Promise<string> {
  console.log(`[OpenCode] Resuming session ${existingSessionId}`);
  return existingSessionId;
}

async function createSession(
  client: OpencodeClient,
  workingDir: string,
): Promise<string> {
  console.log("[OpenCode] Creating new session...");
  const sessionResult = (await client.session.create({
    directory: workingDir,
  })) as RequestResult<{ id: string }>;

  if (!sessionResult.data?.id) {
    throw new Error(
      formatRequestError("Failed to create session", sessionResult.error),
    );
  }

  console.log(`[OpenCode] Session created: ${sessionResult.data.id}`);
  return sessionResult.data.id;
}

async function waitForSessionCompletion(
  client: OpencodeClient,
  stream: AsyncGenerator<unknown, unknown, unknown>,
  sessionId: string,
  workingDir: string,
  interactionHandler: OpenCodeInteractionHandler | undefined,
  signal: AbortSignal,
): Promise<OpenCodeMessage> {
  let latestAssistantMessageId: string | null = null;
  let sessionBecameBusy = false;

  for await (const rawEvent of stream) {
    if (signal.aborted) {
      throw new Error("OpenCode event stream aborted.");
    }

    const event = asOpenCodeEvent(rawEvent);
    if (!event?.type) {
      continue;
    }

    if (event.type === "session.status") {
      const statusSessionId = getString(event.properties, "sessionID");
      const statusType = getNestedString(event.properties, ["status", "type"]);
      if (statusSessionId === sessionId && statusType === "busy") {
        sessionBecameBusy = true;
      }
      continue;
    }

    if (event.type === "message.updated") {
      const info = getObject(event.properties, "info");
      if (
        getString(info, "sessionID") === sessionId &&
        getString(info, "role") === "assistant"
      ) {
        latestAssistantMessageId = getString(info, "id") || latestAssistantMessageId;
      }
      continue;
    }

    if (event.type === "permission.asked") {
      const request = toPermissionRequest(event.properties);
      if (!request || request.sessionId !== sessionId) {
        continue;
      }

      const reply = await resolvePermissionRequest(
        request,
        interactionHandler,
      );
      const response = (await client.permission.reply(
        {
          requestID: request.id,
          directory: workingDir,
          reply,
        },
        { signal },
      )) as RequestResult<boolean>;

      if (response.error) {
        throw new Error(
          formatRequestError("Failed to reply to permission request", response.error),
        );
      }
      continue;
    }

    if (event.type === "question.asked") {
      const request = toQuestionRequest(event.properties);
      if (!request || request.sessionId !== sessionId) {
        continue;
      }

      const answers = await resolveQuestionRequest(
        request,
        interactionHandler,
      );
      const response = (await client.question.reply(
        {
          requestID: request.id,
          directory: workingDir,
          answers,
        },
        { signal },
      )) as RequestResult<boolean>;

      if (response.error) {
        throw new Error(
          formatRequestError("Failed to reply to question request", response.error),
        );
      }
      continue;
    }

    if (event.type === "session.error") {
      const errorSessionId = getString(event.properties, "sessionID");
      if (errorSessionId === sessionId || !errorSessionId) {
        const assistantError = extractAssistantError(
          getObject(event.properties, "error"),
        );
        throw new Error(assistantError || "OpenCode session failed.");
      }
      continue;
    }

    if (event.type === "session.idle") {
      const idleSessionId = getString(event.properties, "sessionID");
      if (idleSessionId === sessionId && sessionBecameBusy) {
        return fetchFinalAssistantMessage(
          client,
          sessionId,
          workingDir,
          latestAssistantMessageId,
          signal,
        );
      }
    }
  }

  throw new Error("OpenCode event stream ended before the session completed.");
}

async function fetchFinalAssistantMessage(
  client: OpencodeClient,
  sessionId: string,
  workingDir: string,
  messageId: string | null,
  signal: AbortSignal,
): Promise<OpenCodeMessage> {
  if (messageId) {
    const messageResult = (await client.session.message(
      {
        sessionID: sessionId,
        messageID: messageId,
        directory: workingDir,
      },
      { signal },
    )) as RequestResult<OpenCodeMessage>;

    if (messageResult.data) {
      return messageResult.data;
    }
  }

  const messagesResult = (await client.session.messages(
    {
      sessionID: sessionId,
      directory: workingDir,
      limit: 20,
    },
    { signal },
  )) as RequestResult<OpenCodeMessage[]>;

  const latestAssistant = messagesResult.data
    ?.filter((message) => message.info.role === "assistant")
    .at(-1);

  if (!latestAssistant) {
    throw new Error("OpenCode finished without returning an assistant message.");
  }

  return latestAssistant;
}

async function resolvePermissionRequest(
  request: OpenCodePermissionRequest,
  interactionHandler?: OpenCodeInteractionHandler,
): Promise<OpenCodePermissionReply> {
  if (!interactionHandler?.onPermissionRequest) {
    throw new Error(
      `OpenCode requested ${request.permission} permission, but no approval handler is configured.`,
    );
  }

  return interactionHandler.onPermissionRequest(request);
}

async function resolveQuestionRequest(
  request: OpenCodeQuestionRequest,
  interactionHandler?: OpenCodeInteractionHandler,
): Promise<string[][]> {
  if (!interactionHandler?.onQuestionRequest) {
    throw new Error(
      "OpenCode requested user input, but no question handler is configured.",
    );
  }

  return interactionHandler.onQuestionRequest(request);
}

function formatMessageParts(
  parts: Array<{ type: string; [key: string]: unknown }>,
): string {
  const lines: string[] = [];

  for (const part of parts) {
    if (part.type === "text" || part.type === "reasoning") {
      const text = typeof part.text === "string" ? part.text.trim() : "";
      if (text) lines.push(text);
      continue;
    }

    if (part.type === "tool") {
      const tool = typeof part.tool === "string" ? part.tool : "tool";
      const state =
        part.state && typeof part.state === "object" && "status" in part.state
          ? String(part.state.status)
          : "unknown";

      if (
        state === "error" &&
        part.state &&
        typeof part.state === "object" &&
        "error" in part.state
      ) {
        lines.push(`[tool:${tool}] error: ${String(part.state.error)}`);
      } else if (state === "completed") {
        lines.push(`[tool:${tool}] completed`);
      }
      continue;
    }

    if (part.type === "step-finish") {
      const reason =
        typeof part.reason === "string" ? part.reason : "completed";
      lines.push(`[session] ${reason}`);
    }
  }

  return lines.join("\n").trim();
}

function extractAssistantError(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const maybeError = error as Record<string, unknown>;
  const data =
    maybeError.data && typeof maybeError.data === "object"
      ? (maybeError.data as Record<string, unknown>)
      : undefined;

  if (data && typeof data.message === "string" && data.message.trim()) {
    return data.message.trim();
  }

  if (typeof maybeError.name === "string") {
    return `OpenCode error: ${maybeError.name}`;
  }

  return "OpenCode returned an unknown assistant error.";
}

function formatRequestError(prefix: string, error: unknown): string {
  if (!error) {
    return prefix;
  }

  if (typeof error === "string") {
    return `${prefix}: ${error}`;
  }

  if (typeof error === "object") {
    const obj = error as Record<string, unknown>;

    for (const value of Object.values(obj)) {
      if (value && typeof value === "object") {
        const message = extractMessageFromObject(
          value as Record<string, unknown>,
        );
        if (message) return `${prefix}: ${message}`;
      }
    }

    const message = extractMessageFromObject(obj);
    if (message) return `${prefix}: ${message}`;
  }

  return `${prefix}: ${String(error)}`;
}

function extractMessageFromObject(
  value: Record<string, unknown>,
): string | null {
  if (typeof value.message === "string" && value.message.trim()) {
    return value.message.trim();
  }

  if (value.data && typeof value.data === "object") {
    const nested = value.data as Record<string, unknown>;
    if (typeof nested.message === "string" && nested.message.trim()) {
      return nested.message.trim();
    }
  }

  return null;
}

async function getRuntime(): Promise<OpenCodeRuntime> {
  if (runtime) {
    const healthy = await checkRuntimeHealth(runtime);
    if (healthy) {
      console.log("[OpenCode] Reusing existing SDK server");
      return runtime;
    }
    console.log("[OpenCode] Existing SDK server unhealthy, restarting...");
    await resetRuntime();
  }

  if (!runtimePromise) {
    runtimePromise = (async () => {
      console.log("[OpenCode] Starting SDK server...");
      const sdk = await loadSdk();
      const created = await sdk.createOpencode(await buildServerOptions());
      runtime = created;
      console.log(`[OpenCode] SDK server started at ${created.server.url}`);
      return created;
    })();
  }

  try {
    return await runtimePromise;
  } catch (error) {
    runtimePromise = null;
    throw error;
  }
}

async function checkRuntimeHealth(rt: OpenCodeRuntime): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      HEALTH_CHECK_TIMEOUT_MS,
    );

    const response = await fetch(`${rt.server.url}/health`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn("[OpenCode] Health check failed:", error);
    return false;
  }
}

async function resetRuntime(): Promise<void> {
  if (runtime) {
    try {
      runtime.server.close();
    } catch (error) {
      console.warn("[OpenCode] Failed to close SDK server cleanly:", error);
    }
  }

  runtime = null;
  runtimePromise = null;
}

export async function shutdownOpenCodeRunner(): Promise<void> {
  await resetRuntime();
}

async function buildServerOptions(): Promise<ServerOptions> {
  const port =
    SERVER_PORT !== null
      ? SERVER_PORT
      : await findAvailablePort(4096, "127.0.0.1");

  return {
    hostname: "127.0.0.1",
    port,
    timeout: SERVER_START_TIMEOUT_MS,
    config: {
      permission: {
        edit: PERMISSION_MODE,
        bash: PERMISSION_MODE,
        webfetch: PERMISSION_MODE,
        external_directory: "deny",
      },
    },
  };
}

function loadSdk(): Promise<OpencodeSdkModule> {
  if (!sdkPromise) {
    const dynamicImport = new Function(
      "specifier",
      "return import(specifier)",
    ) as (specifier: string) => Promise<OpencodeSdkModule>;

    sdkPromise = dynamicImport("@opencode-ai/sdk/v2");
  }

  return sdkPromise;
}

function resolveWorkingDir(
  workingDir: string,
): { ok: true; path: string } | { ok: false; error: string } {
  if (!workingDir || !workingDir.trim()) {
    return { ok: false, error: "Working directory is empty." };
  }

  const absolute = path.resolve(workingDir);

  if (!fs.existsSync(absolute)) {
    return {
      ok: false,
      error: `Working directory does not exist: ${absolute}`,
    };
  }

  const stats = fs.statSync(absolute);
  if (!stats.isDirectory()) {
    return {
      ok: false,
      error: `Working directory is not a directory: ${absolute}`,
    };
  }

  return { ok: true, path: absolute };
}

function trimOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_LENGTH) {
    return output;
  }

  return `${output.slice(0, MAX_OUTPUT_LENGTH)}\n...(output truncated)`;
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInt(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizePermissionMode(raw: string | undefined): PermissionMode {
  if (raw === "allow" || raw === "ask" || raw === "deny") {
    return raw;
  }

  return "allow";
}

function asOpenCodeEvent(value: unknown): OpenCodeEvent | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const event = value as Record<string, unknown>;
  if (typeof event.type !== "string") {
    return null;
  }

  return {
    type: event.type,
    properties:
      event.properties && typeof event.properties === "object"
        ? (event.properties as Record<string, unknown>)
        : undefined,
  };
}

function toPermissionRequest(
  properties: Record<string, unknown> | undefined,
): OpenCodePermissionRequest | null {
  if (!properties) {
    return null;
  }

  const id = getString(properties, "id");
  const sessionId = getString(properties, "sessionID");
  const permission = getString(properties, "permission");
  if (!id || !sessionId || !permission) {
    return null;
  }

  return {
    id,
    sessionId,
    permission,
    patterns: getStringArray(properties, "patterns"),
    metadata: getRecord(properties, "metadata"),
    always: getStringArray(properties, "always"),
  };
}

function toQuestionRequest(
  properties: Record<string, unknown> | undefined,
): OpenCodeQuestionRequest | null {
  if (!properties) {
    return null;
  }

  const id = getString(properties, "id");
  const sessionId = getString(properties, "sessionID");
  const questionsValue = properties.questions;
  if (!id || !sessionId || !Array.isArray(questionsValue)) {
    return null;
  }

  const questions = questionsValue
    .map((question) => toQuestion(question))
    .filter((question): question is OpenCodeQuestion => question !== null);

  if (!questions.length) {
    return null;
  }

  return {
    id,
    sessionId,
    questions,
  };
}

function toQuestion(value: unknown): OpenCodeQuestion | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const question = value as Record<string, unknown>;
  const text = getString(question, "question");
  const header = getString(question, "header") || "Question";
  if (!text) {
    return null;
  }

  const optionsValue = Array.isArray(question.options) ? question.options : [];
  const options = optionsValue
    .map((option) => toQuestionOption(option))
    .filter((option): option is OpenCodeQuestionOption => option !== null);

  return {
    question: text,
    header,
    options,
    multiple: Boolean(question.multiple),
    custom: question.custom !== false,
  };
}

function toQuestionOption(value: unknown): OpenCodeQuestionOption | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const option = value as Record<string, unknown>;
  const label = getString(option, "label");
  const description = getString(option, "description");
  if (!label || !description) {
    return null;
  }

  return { label, description };
}

function getString(
  value: Record<string, unknown> | undefined,
  key: string,
): string {
  if (!value) {
    return "";
  }

  const result = value[key];
  return typeof result === "string" ? result : "";
}

function getNestedString(
  value: Record<string, unknown> | undefined,
  path: string[],
): string {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== "object") {
      return "";
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" ? current : "";
}

function getStringArray(
  value: Record<string, unknown> | undefined,
  key: string,
): string[] {
  if (!value || !Array.isArray(value[key])) {
    return [];
  }

  return value[key].filter((item): item is string => typeof item === "string");
}

function getRecord(
  value: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> {
  if (!value) {
    return {};
  }

  const result = value[key];
  return result && typeof result === "object"
    ? (result as Record<string, unknown>)
    : {};
}

function getObject(
  value: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  const result = value[key];
  return result && typeof result === "object"
    ? (result as Record<string, unknown>)
    : undefined;
}

async function findAvailablePort(
  preferredPort: number,
  host: string,
): Promise<number> {
  if (await canListenOnPort(preferredPort, host)) {
    return preferredPort;
  }

  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      const port =
        address && typeof address === "object" ? address.port : undefined;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        if (!port) {
          reject(new Error("Failed to allocate an OpenCode server port."));
          return;
        }

        resolve(port);
      });
    });
  });
}

async function canListenOnPort(port: number, host: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

export function formatResultForDiscord(
  result: OpenCodeResult,
  projectName: string,
): string {
  const status = result.success ? "Success" : "Failure";
  const duration = (result.duration / 1000).toFixed(1);
  const header = `${status} **OpenCode** · \`${projectName}\` · ${duration}s\n`;

  if (!result.success && result.error) {
    return `${header}\`\`\`\n${result.error}\n\`\`\``;
  }

  const codeBlock = `\`\`\`\n${result.output}\n\`\`\``;
  return `${header}${codeBlock}`;
}
