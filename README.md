# Discord OpenCode Bridge

Routes Discord messages from project-specific channels directly to [OpenCode](https://opencode.ai), running it in the correct project folder and sending output back to Discord.

## Architecture

```
Discord Message
    │
    ▼
DiscordBot (Chat SDK + Discord Adapter)
    │  Gateway listener receives messages
    │  Webhook endpoint handles interactions
    ▼
ProjectManager (projects.json)
    │  resolves folder path
    ▼
OpenCodeRunner (OpenCode SDK)
    │  uses OpenCode SDK session API (scoped by project directory)
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

| Variable                           | Description                                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| `DISCORD_BOT_TOKEN`                | Bot token from [Discord Developer Portal](https://discord.com/developers/applications)          |
| `DISCORD_TOKEN`                    | Backward-compatible alias for `DISCORD_BOT_TOKEN`                                               |
| `DISCORD_GUILD_ID`                 | Right-click your server → Copy Server ID                                                        |
| `DISCORD_CATEGORY_NAME`            | Name of the category to create channels under (default: `OpenCode Projects`)                    |
| `DISCORD_APPLICATION_ID`           | Discord application ID                                                                          |
| `DISCORD_PUBLIC_KEY`               | Discord public key for interaction signature verification                                       |
| `DISCORD_WEBHOOK_URL`              | Optional URL used by gateway forward mode (example: `https://your-domain/api/webhooks/discord`) |
| `DISCORD_GATEWAY_DURATION_MS`      | Gateway listener duration per cycle in ms (default: `600000`)                                   |
| `DISCORD_GATEWAY_RESTART_DELAY_MS` | Delay before restarting gateway listener in ms (default: `2000`)                                |
| `PORT`                             | Express server port (default: `3000`)                                                           |
| `WEBHOOK_SECRET`                   | Secret for protecting HTTP endpoints                                                            |
| `OPENCODE_PERMISSION_MODE`         | SDK permission mode for tools (`allow`, `ask`, `deny`; default: `allow`)                        |
| `OPENCODE_RUN_TIMEOUT_MS`          | Per-run timeout in milliseconds (default: `300000`)                                             |
| `OPENCODE_SERVER_START_TIMEOUT_MS` | OpenCode server startup timeout in milliseconds (default: `30000`)                              |
| `OPENCODE_RUN_RETRY_COUNT`         | Number of retries after a failed run (default: `1`)                                             |
| `OPENCODE_MAX_PROMPT_LENGTH`       | Maximum accepted prompt length (default: `8000`)                                                |
| `OPENCODE_MAX_OUTPUT_LENGTH`       | Output cap before truncation (default: `1800`)                                                  |
| `PROJECTS_FILE`                    | Path to projects.json (default: `./projects.json`)                                              |

### 3. Discord Application Setup

In the Developer Portal, your bot needs:

- **Intents**: `Server Members`, `Message Content`
- **Permissions**: `Manage Channels`, `Send Messages`, `Read Message History`
- **Interactions Endpoint URL**: `https://your-domain/api/webhooks/discord`

For local development, run a tunnel:

```bash
ngrok http 3000
```

Then set the Interactions endpoint to:

```text
https://<ngrok-id>.ngrok.io/api/webhooks/discord
```

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

1. Initialize Chat SDK + Discord adapter
2. Find or create the `OpenCode Projects` category
3. Create a channel for each project in `projects.json`
4. Save channel IDs back to `projects.json`
5. Start a continuous Discord Gateway listener loop

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
`POST /api/webhooks/discord` is public for Discord interaction verification/events and should not use `x-webhook-secret`.

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
npm run pm2:start
pm2 save
pm2 startup
```

This project includes [`ecosystem.config.cjs`](./ecosystem.config.cjs), configured to:

- run a single instance (important to avoid duplicate Discord event handling)
- auto-restart on crashes
- restart if memory exceeds `512M`

Or with Docker — create a `Dockerfile`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
COPY projects.json ./
CMD ["node", "dist/bundle.js"]
```
