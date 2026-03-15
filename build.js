const { build } = require("esbuild");
const fs = require("fs");

async function buildAll() {
  if (!fs.existsSync("dist")) {
    fs.mkdirSync("dist");
  }

  console.log("Building CLI...");
  await build({
    entryPoints: ["src/cli.ts"],
    bundle: true,
    platform: "node",
    target: "node18",
    outfile: "dist/cli.js",
    minify: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
    external: [
      "better-sqlite3",
      "drizzle-orm",
      "drizzle-orm/better-sqlite3",
      "keytar",
      "extract-zip",
    ],
  });

  console.log("Building server bundle...");
  await build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    platform: "node",
    target: "node18",
    outfile: "dist/bundle.js",
    minify: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
    external: [
      "better-sqlite3",
      "drizzle-orm",
      "drizzle-orm/better-sqlite3",
      "keytar",
    ],
  });

  console.log("Build complete!");
}

buildAll().catch(() => process.exit(1));
