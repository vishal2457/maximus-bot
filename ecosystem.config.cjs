module.exports = {
  apps: [
    {
      name: "discord-opencode-bridge",
      script: "dist/bundle.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 2000,
      max_memory_restart: "512M",
      time: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
