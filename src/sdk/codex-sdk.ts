import {
  BaseCodingSdk,
  CodingSdkOptions,
  CodingSdkResult,
  CodingSdkInteractionHandler,
} from "./base-sdk";
import { logger } from "../shared/logger";

export type { CodingSdkOptions, CodingSdkResult, CodingSdkInteractionHandler };

type CodexThread = {
  getId: () => Promise<string>;
  run: (
    prompt: string,
    options?: { signal?: AbortSignal },
  ) => Promise<{
    finalResponse: string;
  }>;
};

type Codex = {
  startThread: (options: {
    workingDirectory: string;
    skipGitRepoCheck: boolean;
  }) => CodexThread;
  resumeThread: (sessionId: string) => CodexThread;
};

type CodexConstructor = new (options: {
  env: Record<string, string | undefined>;
}) => Codex;

class CodexSdk extends BaseCodingSdk {
  private codexInstance: Codex | null = null;
  private activeThreads: Map<string, CodexThread> = new Map();
  private codexModule: CodexConstructor | null = null;

  constructor(options: CodingSdkOptions = {}) {
    super(options);
  }

  private async loadCodexModule(): Promise<CodexConstructor> {
    if (!this.codexModule) {
      const dynamicImport = new Function(
        "specifier",
        "return import(specifier)",
      ) as (specifier: string) => Promise<{ Codex: CodexConstructor }>;
      const module = await dynamicImport("@openai/codex-sdk");
      this.codexModule = module.Codex;
    }
    return this.codexModule;
  }

  private async getCodexInstance(): Promise<Codex> {
    if (!this.codexInstance) {
      const CodexClass = await this.loadCodexModule();
      this.codexInstance = new CodexClass({
        env: {
          ...process.env,
        },
      });
    }
    return this.codexInstance;
  }

  private resolveWorkingDir(
    workingDir: string,
  ): { ok: true; path: string } | { ok: false; error: string } {
    if (!workingDir || !workingDir.trim()) {
      return { ok: false, error: "Working directory is empty." };
    }

    const path = require("path");
    const fs = require("fs");

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

  private formatUnknownError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private trimOutput(output: string, maxOutputLength: number): string {
    if (output.length <= maxOutputLength) {
      return output;
    }
    return `${output.slice(0, maxOutputLength)}\n...(output truncated)`;
  }

  async run(
    prompt: string,
    workingDir: string,
    sessionId?: string,
    _interactionHandler?: CodingSdkInteractionHandler,
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

    const resolvedDir = this.resolveWorkingDir(workingDir);
    if (!resolvedDir.ok) {
      return {
        success: false,
        output: "",
        error: resolvedDir.error,
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
          MAX_OUTPUT_LENGTH,
          RUN_TIMEOUT_MS,
          abortSignal,
        );
      } catch (error: unknown) {
        const canRetry = attempt < RUN_RETRY_COUNT;
        const duration = Date.now() - start;
        const errMsg = this.formatUnknownError(error);

        logger.error("Codex run attempt failed", {
          attempt: attempt + 1,
          duration,
          error: errMsg,
        });

        if (errMsg === "Codex run aborted.") {
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

        this.activeThreads.clear();
      }
    }

    return {
      success: false,
      output: "",
      error: "Codex failed unexpectedly.",
      exitCode: -1,
      duration: Date.now() - start,
    };
  }

  private async runWithSdk(
    prompt: string,
    workingDir: string,
    start: number,
    existingSessionId?: string,
    maxOutputLength: number = 1800,
    timeoutMs: number = 5 * 60 * 1000,
    abortSignal?: AbortSignal,
  ): Promise<CodingSdkResult> {
    logger.debug("runWithSdk called", { workingDir });
    const codex = await this.getCodexInstance();

    let thread: CodexThread;

    if (existingSessionId) {
      logger.debug("Resuming existing Codex thread", {
        sessionId: existingSessionId,
      });
      thread = codex.resumeThread(existingSessionId);
    } else {
      logger.debug("Creating new Codex thread", { workingDir });
      thread = codex.startThread({
        workingDirectory: workingDir,
        skipGitRepoCheck: false,
      });
    }

    const threadId = await thread.getId();
    this.activeThreads.set(threadId, thread);

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
      const turn = await thread.run(prompt, { signal: controller.signal });
      const duration = Date.now() - start;

      const output = turn.finalResponse || "(no output)";
      const trimmedOutput = this.trimOutput(output, maxOutputLength);

      logger.debug("Codex run completed", { threadId, duration });

      return {
        success: true,
        output: trimmedOutput,
        exitCode: 0,
        duration,
        sessionId: threadId,
      };
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        if (abortedExternally) {
          throw new Error("Codex run aborted.");
        }

        throw new Error(
          timedOut
            ? `Codex timed out after ${Math.round(timeoutMs / 1000)}s.`
            : "Codex execution aborted.",
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (abortSignal) {
        abortSignal.removeEventListener("abort", onExternalAbort);
      }
      controller.abort();
      this.activeThreads.delete(threadId);
    }
  }

  async abortSession(
    sessionId: string,
    _directory: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!sessionId) {
      return { success: false, error: "No session ID provided" };
    }

    try {
      const thread = this.activeThreads.get(sessionId);
      if (!thread) {
        return { success: false, error: "Session not found" };
      }

      this.activeThreads.delete(sessionId);
      logger.info("Session aborted successfully", { sessionId });
      return { success: true };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error("Error aborting session", { sessionId, error: errMsg });
      return { success: false, error: errMsg };
    }
  }

  async shutdown(): Promise<void> {
    this.activeThreads.clear();
    this.codexInstance = null;
  }
}

export { CodexSdk };
