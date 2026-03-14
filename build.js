const { build } = require("esbuild");

async function buildAll() {
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
}

buildAll().catch(() => process.exit(1));
