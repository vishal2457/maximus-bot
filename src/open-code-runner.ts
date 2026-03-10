import fs from "fs";
import path from "path";
import type { OpencodeClient, ServerOptions } from "@opencode-ai/sdk";
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
const RUN_RETRY_COUNT = parsePositiveInt(
  process.env.OPENCODE_RUN_RETRY_COUNT,
  1,
);

const PERMISSION_MODE = normalizePermissionMode(
  process.env.OPENCODE_PERMISSION_MODE,
);

type PermissionMode = "ask" | "allow" | "deny";

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

let sdkPromise: Promise<OpencodeSdkModule> | null = null;
let runtimePromise: Promise<OpenCodeRuntime> | null = null;
let runtime: OpenCodeRuntime | null = null;

export async function runOpenCode(
  prompt: string,
  workingDir: string,
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
      return await runWithSdk(normalizedPrompt, resolvedDir.path, start);
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
): Promise<OpenCodeResult> {
  const opencode = await getRuntime();

  const sessionResult = await opencode.client.session.create({
    query: { directory: workingDir },
  });

  if (!sessionResult.data) {
    throw new Error(
      formatRequestError("Failed to create session", sessionResult.error),
    );
  }

  const sessionId = sessionResult.data.id;

  const promptResult = await opencode.client.session.prompt({
    path: { id: sessionId },
    query: { directory: workingDir },
    signal: AbortSignal.timeout(RUN_TIMEOUT_MS),
    body: {
      parts: [{ type: "text", text: prompt }],
    },
  });

  if (!promptResult.data) {
    throw new Error(
      formatRequestError("Failed to run prompt", promptResult.error),
    );
  }

  const output = formatMessageParts(promptResult.data.parts);
  const assistantError = extractAssistantError(promptResult.data.info?.error);
  const fullOutput = output || assistantError || "(no output)";
  const trimmedOutput = trimOutput(fullOutput);
  const duration = Date.now() - start;

  return {
    success: !assistantError,
    output: trimmedOutput,
    error: assistantError || undefined,
    exitCode: assistantError ? 1 : 0,
    duration,
  };
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
    return runtime;
  }

  if (!runtimePromise) {
    runtimePromise = (async () => {
      const sdk = await loadSdk();
      const created = await sdk.createOpencode(buildServerOptions());
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

function buildServerOptions(): ServerOptions {
  return {
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

    sdkPromise = dynamicImport("@opencode-ai/sdk");
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

function normalizePermissionMode(raw: string | undefined): PermissionMode {
  if (raw === "allow" || raw === "ask" || raw === "deny") {
    return raw;
  }

  return "allow";
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
