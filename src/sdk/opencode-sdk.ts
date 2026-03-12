import {
  BaseCodingSdk,
  CodingSdkOptions,
  CodingSdkResult,
  CodingSdkInteractionHandler,
} from "./base-sdk";
import type { OpencodeClient, ServerOptions } from "@opencode-ai/sdk/v2" with {
  "resolution-mode": "import",
};
import { OpenCodeResult } from "../types";
import { logger } from "../shared/logger";

// Re-export the types from base-sdk for compatibility
export type { CodingSdkOptions, CodingSdkResult, CodingSdkInteractionHandler };

// We'll reuse the existing logic from open-code-runner.ts by adapting it
class OpencodeSdk extends BaseCodingSdk {
  private runtimePromise: Promise<{
    client: OpencodeClient;
    server: { url: string; close(): void };
  }> | null = null;
  private runtime: {
    client: OpencodeClient;
    server: { url: string; close(): void };
  } | null = null;
  private sdkPromise: Promise<{
    createOpencode(options?: ServerOptions): Promise<{
      client: OpencodeClient;
      server: { url: string; close(): void };
    }>;
  }> | null = null;

  constructor(options: CodingSdkOptions = {}) {
    super(options);
  }

  private parsePositiveInt(raw: string | undefined, fallback: number): number {
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private parseNonNegativeInt(raw: string | undefined): number | null {
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  private normalizePermissionMode(
    raw: string | undefined,
  ): "ask" | "allow" | "deny" {
    if (raw === "allow" || raw === "ask" || raw === "deny") {
      return raw;
    }
    return "allow";
  }

  private async loadSdk(): Promise<{
    createOpencode(options?: ServerOptions): Promise<{
      client: OpencodeClient;
      server: { url: string; close(): void };
    }>;
  }> {
    if (!this.sdkPromise) {
      const dynamicImport = new Function(
        "specifier",
        "return import(specifier)",
      ) as (specifier: string) => Promise<{
        createOpencode(options?: ServerOptions): Promise<{
          client: OpencodeClient;
          server: { url: string; close(): void };
        }>;
      }>;

      this.sdkPromise = dynamicImport("@opencode-ai/sdk/v2");
    }

    return this.sdkPromise;
  }

  private async buildServerOptions(): Promise<ServerOptions> {
    const {
      permissionMode = "allow",
      maxOutputLength = 1800,
      maxPromptLength = 8000,
      timeoutMs = 5 * 60 * 1000,
      serverStartTimeoutMs = 30_000,
      retryCount = 2,
      healthCheckTimeoutMs = 5_000,
    } = this.options;

    const SERVER_PORT = this.parseNonNegativeInt(
      process.env.OPENCODE_SERVER_PORT,
    );
    const RUN_TIMEOUT_MS = this.parsePositiveInt(
      process.env.OPENCODE_RUN_TIMEOUT_MS,
      timeoutMs,
    );
    const SERVER_START_TIMEOUT_MS = this.parsePositiveInt(
      process.env.OPENCODE_SERVER_START_TIMEOUT_MS,
      serverStartTimeoutMs,
    );
    const RUN_RETRY_COUNT = this.parsePositiveInt(
      process.env.OPENCODE_RUN_RETRY_COUNT,
      retryCount,
    );
    const HEALTH_CHECK_TIMEOUT_MS = this.parsePositiveInt(
      process.env.OPENCODE_HEALTH_CHECK_TIMEOUT_MS,
      healthCheckTimeoutMs,
    );
    const PERMISSION_MODE =
      this.normalizePermissionMode(process.env.OPENCODE_PERMISSION_MODE) ??
      permissionMode;

    const port =
      SERVER_PORT !== null
        ? SERVER_PORT
        : await this.findAvailablePort(4096, "127.0.0.1");

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

  private async getRuntime(): Promise<{
    client: OpencodeClient;
    server: { url: string; close(): void };
  }> {
    if (this.runtime) {
      const healthy = await this.checkRuntimeHealth(this.runtime);
      if (healthy) {
        logger.debug("Reusing existing OpenCode SDK server");
        return this.runtime;
      }
      logger.warn("Existing OpenCode SDK server unhealthy, restarting");
      await this.resetRuntime();
    }

    if (!this.runtimePromise) {
      this.runtimePromise = (async () => {
        logger.info("Starting OpenCode SDK server");
        const sdk = await this.loadSdk();
        const created = await sdk.createOpencode(
          await this.buildServerOptions(),
        );
        this.runtime = created;
        logger.info("OpenCode SDK server started", { url: created.server.url });
        return created;
      })();
    }

    try {
      return await this.runtimePromise;
    } catch (error) {
      this.runtimePromise = null;
      throw error;
    }
  }

  private async checkRuntimeHealth(rt: {
    client: OpencodeClient;
    server: { url: string; close(): void };
  }): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.options.healthCheckTimeoutMs ?? 5_000,
      );

      const response = await fetch(`${rt.server.url}/health`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      logger.warn("OpenCode SDK health check failed", { error });
      return false;
    }
  }

  private async resetRuntime(): Promise<void> {
    if (this.runtime) {
      try {
        this.runtime.server.close();
      } catch (error) {
        logger.warn("Failed to close OpenCode SDK server cleanly", { error });
      }
    }

    this.runtime = null;
    this.runtimePromise = null;
  }

  async run(
    prompt: string,
    workingDir: string,
    sessionId?: string,
    interactionHandler?: CodingSdkInteractionHandler,
    abortSignal?: AbortSignal,
  ): Promise<CodingSdkResult> {
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

    const MAX_PROMPT_LENGTH = this.options.maxPromptLength ?? 8000;
    if (normalizedPrompt.length > MAX_PROMPT_LENGTH) {
      return {
        success: false,
        output: "",
        error: `Prompt exceeds max length of ${MAX_PROMPT_LENGTH} characters.`,
        exitCode: -1,
        duration: 0,
      };
    }

    // We'll reuse the resolved directory logic from open-code-runner.ts
    const resolvedDir = this.resolveWorkingDir(workingDir);
    if (!resolvedDir.ok) {
      // Type guard: if !ok, then we know it's the error variant
      const errorDir = resolvedDir as { ok: false; error: string };
      return {
        success: false,
        output: "",
        error: errorDir.error,
        exitCode: -1,
        duration: 0,
      };
    }

    const MAX_OUTPUT_LENGTH = this.options.maxOutputLength ?? 1800;
    const RUN_TIMEOUT_MS = this.options.timeoutMs ?? 5 * 60 * 1000;
    const RUN_RETRY_COUNT = this.options.retryCount ?? 2;

    for (let attempt = 0; attempt <= RUN_RETRY_COUNT; attempt += 1) {
      try {
        return await this.runWithSdk(
          normalizedPrompt,
          resolvedDir.path,
          start,
          sessionId,
          interactionHandler,
          MAX_OUTPUT_LENGTH,
          RUN_TIMEOUT_MS,
          abortSignal,
        );
      } catch (error: unknown) {
        const canRetry = attempt < RUN_RETRY_COUNT;
        const duration = Date.now() - start;
        const errMsg = this.formatUnknownError(error);

        logger.error("OpenCode run attempt failed", {
          attempt: attempt + 1,
          duration,
          error: errMsg,
        });

        if (errMsg === "OpenCode run aborted.") {
          return {
            success: false,
            output: "",
            error: errMsg,
            exitCode: -1,
            duration,
            sessionId,
          };
        }

        if (!canRetry) {
          return {
            success: false,
            output: "",
            error: errMsg,
            exitCode: -1,
            duration,
          };
        }

        await this.resetRuntime();
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

  private async runWithSdk(
    prompt: string,
    workingDir: string,
    start: number,
    existingSessionId?: string,
    interactionHandler?: CodingSdkInteractionHandler,
    maxOutputLength: number = 1800,
    timeoutMs: number = 5 * 60 * 1000,
    abortSignal?: AbortSignal,
  ): Promise<CodingSdkResult> {
    logger.debug("runWithSdk called", { workingDir });
    const opencode = await this.getRuntime();

    const sessionId = existingSessionId
      ? await this.resumeSession(existingSessionId)
      : await this.createSession(opencode.client, workingDir);

    const controller = new AbortController();
    let timedOut = false;
    let abortedExternally = abortSignal?.aborted ?? false;
    const onExternalAbort = () => {
      abortedExternally = true;
      controller.abort();
    };
    if (abortSignal) {
      abortSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const eventSubscription = await opencode.client.event.subscribe(
        { directory: workingDir },
        { signal: controller.signal },
      );

      logger.debug("Sending prompt to session", { sessionId, workingDir });
      const completionPromise = this.waitForSessionCompletion(
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
      )) as { data?: void; error?: unknown };

      if (promptResult.error) {
        throw new Error(
          this.formatRequestError("Failed to run prompt", promptResult.error),
        );
      }

      const message = await completionPromise;
      logger.debug("Prompt completed, formatting output", { sessionId });

      const output = this.formatMessageParts(message.parts);
      const assistantError = this.extractAssistantError(message.info.error);
      const fullOutput = output || assistantError || "(no output)";
      const trimmedOutput = this.trimOutput(fullOutput, maxOutputLength);
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
        if (abortedExternally) {
          throw new Error("OpenCode run aborted.");
        }

        throw new Error(
          timedOut
            ? `OpenCode timed out after ${Math.round(timeoutMs / 1000)}s.`
            : "OpenCode event stream aborted.",
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (abortSignal) {
        abortSignal.removeEventListener("abort", onExternalAbort);
      }
      controller.abort();
    }
  }

  private async resumeSession(existingSessionId: string): Promise<string> {
    logger.debug("Resuming existing OpenCode session", {
      sessionId: existingSessionId,
    });
    return existingSessionId;
  }

  private async createSession(
    client: OpencodeClient,
    workingDir: string,
  ): Promise<string> {
    logger.debug("Creating new OpenCode session", { workingDir });
    const sessionResult = (await client.session.create({
      directory: workingDir,
    })) as { data?: { id: string }; error?: unknown };

    if (!sessionResult.data?.id) {
      throw new Error(
        this.formatRequestError(
          "Failed to create session",
          sessionResult.error,
        ),
      );
    }

    logger.info("OpenCode session created", {
      sessionId: sessionResult.data.id,
    });
    return sessionResult.data.id;
  }

  private async waitForSessionCompletion(
    client: OpencodeClient,
    stream: AsyncGenerator<unknown, unknown, unknown>,
    sessionId: string,
    workingDir: string,
    interactionHandler: CodingSdkInteractionHandler | undefined,
    signal: AbortSignal,
  ): Promise<{
    info: {
      id: string;
      sessionID: string;
      role: string;
      error?: unknown;
      time?: { completed?: number };
    };
    parts: Array<{ type: string; [key: string]: unknown }>;
  }> {
    let latestAssistantMessageId: string | null = null;
    let sessionBecameBusy = false;

    for await (const rawEvent of stream) {
      if (signal.aborted) {
        throw new Error("OpenCode event stream aborted.");
      }

      const event = this.asOpenCodeEvent(rawEvent);
      if (!event?.type) {
        continue;
      }

      if (event.type === "session.status") {
        const statusSessionId = this.getString(event.properties, "sessionID");
        const statusType = this.getNestedString(event.properties, [
          "status",
          "type",
        ]);
        if (statusSessionId === sessionId && statusType === "busy") {
          sessionBecameBusy = true;
        }
        continue;
      }

      if (event.type === "message.updated") {
        const info = this.getObject(event.properties, "info");
        if (
          this.getString(info, "sessionID") === sessionId &&
          this.getString(info, "role") === "assistant"
        ) {
          latestAssistantMessageId =
            this.getString(info, "id") || latestAssistantMessageId;
        }
        continue;
      }

      if (event.type === "permission.asked") {
        const request = this.toPermissionRequest(event.properties);
        if (!request || request.sessionId !== sessionId) {
          continue;
        }

        const reply = await this.resolvePermissionRequest(
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
        )) as { data?: boolean; error?: unknown };

        if (response.error) {
          throw new Error(
            this.formatRequestError(
              "Failed to reply to permission request",
              response.error,
            ),
          );
        }
        continue;
      }

      if (event.type === "question.asked") {
        const request = this.toQuestionRequest(event.properties);
        if (!request || request.sessionId !== sessionId) {
          continue;
        }

        const answers = await this.resolveQuestionRequest(
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
        )) as { data?: boolean; error?: unknown };

        if (response.error) {
          throw new Error(
            this.formatRequestError(
              "Failed to reply to question request",
              response.error,
            ),
          );
        }
        continue;
      }

      if (event.type === "session.error") {
        const errorSessionId = this.getString(event.properties, "sessionID");
        if (errorSessionId === sessionId || !errorSessionId) {
          const assistantError = this.extractAssistantError(
            this.getObject(event.properties, "error"),
          );
          throw new Error(assistantError || "OpenCode session failed.");
        }
        continue;
      }

      if (event.type === "session.idle") {
        const idleSessionId = this.getString(event.properties, "sessionID");
        if (idleSessionId === sessionId && sessionBecameBusy) {
          return this.fetchFinalAssistantMessage(
            client,
            sessionId,
            workingDir,
            latestAssistantMessageId,
            signal,
          );
        }
      }
    }

    throw new Error(
      "OpenCode event stream ended before the session completed.",
    );
  }

  private async fetchFinalAssistantMessage(
    client: OpencodeClient,
    sessionId: string,
    workingDir: string,
    messageId: string | null,
    signal: AbortSignal,
  ): Promise<{
    info: {
      id: string;
      sessionID: string;
      role: string;
      error?: unknown;
      time?: { completed?: number };
    };
    parts: Array<{ type: string; [key: string]: unknown }>;
  }> {
    if (messageId) {
      const messageResult = (await client.session.message(
        {
          sessionID: sessionId,
          messageID: messageId,
          directory: workingDir,
        },
        { signal },
      )) as {
        data?: {
          info: {
            id: string;
            sessionID: string;
            role: string;
            error?: unknown;
            time?: { completed?: number };
          };
          parts: Array<{ type: string; [key: string]: unknown }>;
        };
        error?: unknown;
      };

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
    )) as {
      data?: Array<{
        info: {
          id: string;
          sessionID: string;
          role: string;
          error?: unknown;
          time?: { completed?: number };
        };
        parts: Array<{ type: string; [key: string]: unknown }>;
      }>;
      error?: unknown;
    };

    const latestAssistant = messagesResult.data
      ?.filter((message) => message.info.role === "assistant")
      .slice(-1)[0];

    if (!latestAssistant) {
      throw new Error(
        "OpenCode finished without returning an assistant message.",
      );
    }

    return latestAssistant;
  }

  private async resolvePermissionRequest(
    request: {
      id: string;
      sessionId: string;
      permission: string;
      patterns: string[];
      metadata: Record<string, unknown>;
      always: string[];
    },
    interactionHandler?: CodingSdkInteractionHandler,
  ): Promise<"once" | "always" | "reject"> {
    if (!interactionHandler?.onPermissionRequest) {
      throw new Error(
        `OpenCode requested ${request.permission} permission, but no approval handler is configured.`,
      );
    }

    return interactionHandler.onPermissionRequest(request);
  }

  private async resolveQuestionRequest(
    request: {
      id: string;
      sessionId: string;
      questions: {
        question: string;
        header: string;
        options: { label: string; description: string }[];
        multiple?: boolean;
        custom?: boolean;
      }[];
    },
    interactionHandler?: CodingSdkInteractionHandler,
  ): Promise<string[][]> {
    if (!interactionHandler?.onQuestionRequest) {
      throw new Error(
        "OpenCode requested user input, but no question handler is configured.",
      );
    }

    return interactionHandler.onQuestionRequest(request);
  }

  private formatMessageParts(
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

  private extractAssistantError(error: unknown): string | null {
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

  private formatRequestError(prefix: string, error: unknown): string {
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
          const message = this.extractMessageFromObject(
            value as Record<string, unknown>,
          );
          if (message) return `${prefix}: ${message}`;
        }
      }

      const message = this.extractMessageFromObject(obj);
      if (message) return `${prefix}: ${message}`;
    }

    return `${prefix}: ${String(error)}`;
  }

  private extractMessageFromObject(
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

  private trimOutput(output: string, maxOutputLength: number): string {
    if (output.length <= maxOutputLength) {
      return output;
    }

    return `${output.slice(0, maxOutputLength)}\n...(output truncated)`;
  }

  private formatUnknownError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private asOpenCodeEvent(
    value: unknown,
  ): { type: string; properties?: Record<string, unknown> } | null {
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

  private toPermissionRequest(
    properties: Record<string, unknown> | undefined,
  ): {
    id: string;
    sessionId: string;
    permission: string;
    patterns: string[];
    metadata: Record<string, unknown>;
    always: string[];
  } | null {
    if (!properties) {
      return null;
    }

    const id = this.getString(properties, "id");
    const sessionId = this.getString(properties, "sessionID");
    const permission = this.getString(properties, "permission");
    if (!id || !sessionId || !permission) {
      return null;
    }

    return {
      id,
      sessionId,
      permission,
      patterns: this.getStringArray(properties, "patterns"),
      metadata: this.getRecord(properties, "metadata"),
      always: this.getStringArray(properties, "always"),
    };
  }

  private toQuestionRequest(properties: Record<string, unknown> | undefined): {
    id: string;
    sessionId: string;
    questions: {
      question: string;
      header: string;
      options: { label: string; description: string }[];
      multiple?: boolean;
      custom?: boolean;
    }[];
  } | null {
    if (!properties) {
      return null;
    }

    const id = this.getString(properties, "id");
    const sessionId = this.getString(properties, "sessionID");
    const questionsValue = properties.questions;
    if (!id || !sessionId || !Array.isArray(questionsValue)) {
      return null;
    }

    const questions = questionsValue
      .map((question) => this.toQuestion(question))
      .filter(
        (
          question,
        ): question is {
          question: string;
          header: string;
          options: { label: string; description: string }[];
          multiple?: boolean;
          custom?: boolean;
        } => question !== null,
      );

    if (!questions.length) {
      return null;
    }

    return {
      id,
      sessionId,
      questions,
    };
  }

  private toQuestion(value: unknown): {
    question: string;
    header: string;
    options: { label: string; description: string }[];
    multiple?: boolean;
    custom?: boolean;
  } | null {
    if (!value || typeof value !== "object") {
      return null;
    }

    const question = value as Record<string, unknown>;
    const text = this.getString(question, "question");
    const header = this.getString(question, "header") || "Question";
    if (!text) {
      return null;
    }

    const optionsValue = Array.isArray(question.options)
      ? question.options
      : [];
    const options = optionsValue
      .map((option) => this.toQuestionOption(option))
      .filter(
        (option): option is { label: string; description: string } =>
          option !== null,
      );

    return {
      question: text,
      header,
      options,
      multiple: Boolean(question.multiple),
      custom: question.custom !== false,
    };
  }

  private toQuestionOption(
    value: unknown,
  ): { label: string; description: string } | null {
    if (!value || typeof value !== "object") {
      return null;
    }

    const option = value as Record<string, unknown>;
    const label = this.getString(option, "label");
    const description = this.getString(option, "description");
    if (!label || !description) {
      return null;
    }

    return { label, description };
  }

  private getString(
    value: Record<string, unknown> | undefined,
    key: string,
  ): string {
    if (!value) {
      return "";
    }

    const result = value[key];
    return typeof result === "string" ? result : "";
  }

  private getNestedString(
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

  private getStringArray(
    value: Record<string, unknown> | undefined,
    key: string,
  ): string[] {
    if (!value || !Array.isArray(value[key])) {
      return [];
    }

    return value[key].filter(
      (item): item is string => typeof item === "string",
    );
  }

  private getRecord(
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

  private getObject(
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

  private resolveWorkingDir(
    workingDir: string,
  ): { ok: true; path: string } | { ok: false; error: string } {
    if (!workingDir || !workingDir.trim()) {
      return { ok: false, error: "Working directory is empty." };
    }

    const importPath = require("path");
    const importFs = require("fs");
    const path = importPath;
    const fs = importFs;

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

  private async findAvailablePort(
    preferredPort: number,
    host: string,
  ): Promise<number> {
    if (await this.canListenOnPort(preferredPort, host)) {
      return preferredPort;
    }

    return new Promise<number>((resolve, reject) => {
      const importNet = require("net");
      const server = importNet.createServer();
      server.unref();
      server.on("error", reject);
      server.listen(0, host, () => {
        const address = server.address();
        const port =
          address && typeof address === "object" ? address.port : undefined;
        server.close((error: unknown) => {
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

  private async canListenOnPort(port: number, host: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const importNet = require("net");
      const server = importNet.createServer();
      server.unref();
      server.once("error", () => resolve(false));
      server.listen(port, host, () => {
        server.close(() => resolve(true));
      });
    });
  }

  async abortSession(
    sessionId: string,
    directory: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!sessionId) {
      return { success: false, error: "No session ID provided" };
    }

    try {
      const opencode = await this.getRuntime();
      const result = (await opencode.client.session.abort({
        sessionID: sessionId,
        directory,
      })) as { data?: unknown; error?: unknown };

      if (result.error) {
        const errMsg =
          result.error instanceof Error
            ? result.error.message
            : String(result.error);
        logger.error("Failed to abort session", { sessionId, error: errMsg });
        return { success: false, error: errMsg };
      }

      logger.info("Session aborted successfully", { sessionId });
      return { success: true };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error("Error aborting session", { sessionId, error: errMsg });
      return { success: false, error: errMsg };
    }
  }

  async shutdown(): Promise<void> {
    await this.resetRuntime();
  }
}

export { OpencodeSdk };
