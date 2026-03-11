const { build } = require("esbuild");
build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  outfile: "dist/bundle.js",
  minify: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  external: ["better-sqlite3", "drizzle-orm", "drizzle-orm/better-sqlite3"],
}).catch(() => process.exit(1));
