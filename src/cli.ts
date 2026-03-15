import "dotenv/config";
import cac from "cac";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as https from "https";

const GITHUB_REPO = "vishal2457/maximus-bot";
const GITHUB_BRANCH = "main";

const cli = cac("mx-bot");

async function downloadAndExtractZip(
  url: string,
  destPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tempPath = path.join(os.tmpdir(), `mx-bot-web-${Date.now()}.zip`);
    const file = fs.createWriteStream(tempPath);

    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            file.close();
            https
              .get(redirectUrl, (redirectResponse) => {
                const redirectFile = fs.createWriteStream(tempPath);
                redirectResponse.pipe(redirectFile);
                redirectFile.on("finish", () => {
                  redirectFile.close();
                  extractZip(tempPath, destPath).then(resolve).catch(reject);
                });
              })
              .on("error", reject);
            return;
          }
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          extractZip(tempPath, destPath).then(resolve).catch(reject);
        });
      })
      .on("error", reject);
  });
}

async function extractZip(zipPath: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const extract = require("extract-zip");
    extract(zipPath, { dir: destPath })
      .then(() => {
        fs.unlinkSync(zipPath);
        resolve();
      })
      .catch(reject);
  });
}

async function downloadWebUI(): Promise<void> {
  const tempDir = path.join(os.tmpdir(), `mx-bot-build-${Date.now()}`);
  const webSrcDir = path.join(tempDir, "mx-bot-main", "web-src");

  console.log("Downloading web UI from GitHub...\n");

  const zipUrl = `https://github.com/${GITHUB_REPO}/archive/refs/heads/${GITHUB_BRANCH}.zip`;

  try {
    await downloadAndExtractZip(zipUrl, tempDir);

    if (fs.existsSync(webSrcDir)) {
      const destWebSrc = path.join(__dirname, "..", "..", "web-src");
      fs.cpSync(webSrcDir, destWebSrc, { recursive: true });
      console.log("Web UI source downloaded.\n");
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (err) {
    console.error("Failed to download web UI:", err);
    throw err;
  }
}

async function buildWebUI(): Promise<void> {
  const webSrcDir = path.join(__dirname, "..", "..", "web-src");
  const hasWebSrc =
    fs.existsSync(webSrcDir) && fs.readdirSync(webSrcDir).length > 0;

  if (!hasWebSrc) {
    console.log("Web UI source not found. Downloading from GitHub...\n");
    await downloadWebUI();
  }

  console.log("Building web UI...\n");

  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

  await new Promise<void>((resolve, reject) => {
    const installProcess = spawn(npmCmd, ["install"], {
      cwd: webSrcDir,
      stdio: "inherit",
      shell: true,
    });
    installProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`npm install failed with code ${code}`));
        return;
      }

      const buildProcess = spawn(npmCmd, ["run", "build"], {
        cwd: webSrcDir,
        stdio: "inherit",
        shell: true,
      });

      buildProcess.on("close", (buildCode) => {
        if (buildCode === 0) {
          resolve();
        } else {
          reject(new Error(`Web build failed with code ${buildCode}`));
        }
      });
    });
  });

  const srcWebDist = path.join(webSrcDir, "dist");
  const destWebDist = path.join(__dirname, "..", "dist", "web");

  if (fs.existsSync(destWebDist)) {
    fs.rmSync(destWebDist, { recursive: true });
  }

  if (fs.existsSync(srcWebDist)) {
    fs.cpSync(srcWebDist, destWebDist, { recursive: true });
  }

  console.log("Web UI built successfully.\n");
}

cli
  .command("run", "Start the Maximus Bot server")
  .option("-p, --port <port>", "Port to run the server on (default: 3000)", {
    default: "3000",
  })
  .option("-e, --env <path>", "Path to .env file")
  .option("--skip-build", "Skip building the project")
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    const envPath = options.env;

    console.log("╔════════════════════════════════════════╗");
    console.log("║         Maximus Bot Starting...        ║");
    console.log("╚════════════════════════════════════════╝\n");

    if (envPath) {
      const resolvedPath = path.resolve(process.cwd(), envPath);
      if (fs.existsSync(resolvedPath)) {
        console.log(`Using env file: ${resolvedPath}\n`);
      } else {
        console.error(`Error: Env file not found: ${resolvedPath}`);
        process.exit(1);
      }
    }

    const dataDir = path.join(os.homedir(), "maximus-bot-data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log(`Created data directory: ${dataDir}\n`);
    }

    const distPath = path.join(__dirname, "bundle.js");
    if (!fs.existsSync(distPath)) {
      console.log("Building the project...\n");
      const buildProcess = spawn("node", ["build.js"], {
        stdio: "inherit",
        shell: true,
      });

      await new Promise<void>((resolve, reject) => {
        buildProcess.on("close", (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Build failed with code ${code}`));
          }
        });
      });
      console.log("");
    }

    const webDistPath = path.join(__dirname, "..", "dist", "web", "index.html");
    const hasWebBuild = fs.existsSync(webDistPath);

    if (!hasWebBuild && !options.skipBuild) {
      await buildWebUI();
    }

    const serverProcess = spawn(
      process.platform === "win32" ? "node.cmd" : "node",
      [distPath],
      {
        env: {
          ...process.env,
          PORT: port.toString(),
        },
        stdio: ["pipe", "pipe", "inherit"],
        shell: true,
      },
    );

    serverProcess.stdout?.on("data", (data) => {
      const output = data.toString();
      process.stdout.write(output);

      if (output.includes("HTTP server listening")) {
        console.log("\n" + "=".repeat(50));
        console.log("✅ Maximus Bot is running!");
        console.log("=".repeat(50));
        console.log(`\n🌐 Web UI: http://localhost:${port}`);
        console.log(`📖 API:    http://localhost:${port}/api`);
        console.log(`❤️  Health: http://localhost:${port}/health`);
        console.log("\nPress Ctrl+C to stop the server.\n");
      }
    });

    serverProcess.on("close", (code) => {
      console.log(`Server process exited with code ${code}`);
      process.exit(code || 0);
    });

    process.on("SIGINT", () => {
      console.log("\n\nShutting down Maximus Bot...");
      serverProcess.kill("SIGINT");
    });

    process.on("SIGTERM", () => {
      console.log("\n\nShutting down Maximus Bot...");
      serverProcess.kill("SIGTERM");
    });
  });

cli.help();

cli.parse();
