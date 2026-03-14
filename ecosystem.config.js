module.exports = {
  apps: [
    {
      name: "maximus",
      script: "dist/bundle.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 2000,
      time: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
