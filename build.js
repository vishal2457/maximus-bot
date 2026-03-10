const { build } = require('esbuild');
build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/bundle.js',
  minify: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  external: [],
}).catch(() => process.exit(1));
