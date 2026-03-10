import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { OpenCodeResult } from "./types";

const OPENCODE_BIN = process.env.OPENCODE_BIN || "opencode";
const MAX_OUTPUT_LENGTH = 1800; // Discord message limit buffer

export async function runOpenCode(
  prompt: string,
  workingDir: string
): Promise<OpenCodeResult> {
  const start = Date.now();

  // Ensure the working directory exists
  if (!fs.existsSync(workingDir)) {
    return {
      success: false,
      output: "",
      error: `Working directory does not exist: ${workingDir}`,
      exitCode: -1,
      duration: 0,
    };
  }

  return new Promise((resolve) => {
    console.log(`[OpenCode] Spawning in ${workingDir}`);
    console.log(`[OpenCode] Prompt: ${prompt.slice(0, 100)}...`);

    let stdout = "";
    let stderr = "";

    const child = spawn(OPENCODE_BIN, ["run", "--prompt", prompt], {
      cwd: path.resolve(workingDir),
      env: { ...process.env },
      shell: false,
    });

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("error", (err) => {
      const duration = Date.now() - start;
      console.error(`[OpenCode] Spawn error: ${err.message}`);
      resolve({
        success: false,
        output: stdout,
        error: `Failed to spawn opencode: ${err.message}`,
        exitCode: -1,
        duration,
      });
    });

    child.on("close", (code) => {
      const duration = Date.now() - start;
      const exitCode = code ?? -1;
      const success = exitCode === 0;

      const fullOutput = stdout || stderr || "(no output)";
      // Trim output if too long for Discord
      const output =
        fullOutput.length > MAX_OUTPUT_LENGTH
          ? fullOutput.slice(0, MAX_OUTPUT_LENGTH) + "\n...(output truncated)"
          : fullOutput;

      console.log(
        `[OpenCode] Done in ${duration}ms, exit=${exitCode}, output=${output.length} chars`
      );

      resolve({
        success,
        output,
        error: success ? undefined : stderr || `Process exited with code ${exitCode}`,
        exitCode,
        duration,
      });
    });

    // Timeout safety: 5 minutes
    setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGTERM");
        const duration = Date.now() - start;
        resolve({
          success: false,
          output: stdout,
          error: "Timed out after 5 minutes",
          exitCode: -1,
          duration,
        });
      }
    }, 5 * 60 * 1000);
  });
}

export function formatResultForDiscord(result: OpenCodeResult, projectName: string): string {
  const status = result.success ? "✅" : "❌";
  const duration = (result.duration / 1000).toFixed(1);
  const header = `${status} **OpenCode** · \`${projectName}\` · ${duration}s\n`;

  if (!result.success && result.error) {
    return `${header}\`\`\`\n${result.error}\n\`\`\``;
  }

  const codeBlock = `\`\`\`\n${result.output}\n\`\`\``;
  return `${header}${codeBlock}`;
}
