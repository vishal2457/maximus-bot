# Discord OpenCode Bridge

Routes Discord messages from project-specific channels directly to [OpenCode](https://opencode.ai), running it in the correct project folder and sending output back to Discord.

## Architecture

```
Discord Message
    │
    ▼
DiscordBot (discord.js)
    │  looks up channel → project
    ▼
ProjectManager (projects.json)
    │  resolves folder path
    ▼
OpenCodeRunner (child_process.spawn)
    │  runs `opencode run --prompt "..."` in project folder
    ▼
Discord Reply (formatted output)
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Your bot token from [Discord Developer Portal](https://discord.com/developers/applications) |
| `DISCORD_GUILD_ID` | Right-click your server → Copy Server ID |
| `DISCORD_CATEGORY_NAME` | Name of the category to create channels under (default: `OpenCode Projects`) |
| `PORT` | Express server port (default: `3000`) |
| `WEBHOOK_SECRET` | Secret for protecting HTTP endpoints |
| `OPENCODE_BIN` | Path to opencode binary (default: `opencode`) |
| `PROJECTS_FILE` | Path to projects.json (default: `./projects.json`) |

### 3. Discord Bot Permissions

In the Developer Portal, your bot needs:
- **Intents**: `Server Members`, `Message Content`
- **Permissions**: `Manage Channels`, `Send Messages`, `Read Message History`

### 4. Configure projects.json

```json
[
  {
    "id": "my-api",
    "name": "My API",
    "description": "Backend REST API service",
    "folder": "/workspace/my-api",
    "discordChannelName": "my-api",
    "discordChannelId": ""
  }
]
```

- `id` — unique identifier, used in HTTP API
- `folder` — absolute path to the project on disk
- `discordChannelName` — channel name to create under the category
- `discordChannelId` — auto-populated on first sync, do not set manually

### 5. Run

```bash
# Development (with hot reload)
npm run watch

# Production
npm run build && npm start
```

On startup the bot will:
1. Log in to Discord
2. Find or create the `OpenCode Projects` category
3. Create a channel for each project in `projects.json`
4. Save channel IDs back to `projects.json`

## Usage

### Discord

Send any message in a project channel to run OpenCode:

```
refactor the auth middleware to use JWT
```

Prefix with `#` to leave a note without triggering OpenCode:

```
# TODO: clean this up next sprint
```

### HTTP API

All mutating endpoints require the `x-webhook-secret` header.

```bash
# Health check
curl http://localhost:3000/health

# List projects
curl http://localhost:3000/projects

# Trigger OpenCode via HTTP (also posts to Discord)
curl -X POST http://localhost:3000/run/my-api \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your_secret" \
  -d '{"prompt": "add input validation to POST /users"}'

# Reload projects.json without restart
curl -X POST http://localhost:3000/projects/reload \
  -H "x-webhook-secret: your_secret"

# Re-sync Discord channels
curl -X POST http://localhost:3000/sync \
  -H "x-webhook-secret: your_secret"
```

## Adding a New Project

1. Add an entry to `projects.json` with an empty `discordChannelId`
2. POST `/projects/reload` then POST `/sync` — or restart the bot
3. A new Discord channel will be created automatically

## Production Deployment

Use a process manager like `pm2`:

```bash
npm run build
pm2 start dist/index.js --name discord-opencode-bridge
pm2 save
```

Or with Docker — create a `Dockerfile`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
COPY projects.json ./
CMD ["node", "dist/index.js"]
```
