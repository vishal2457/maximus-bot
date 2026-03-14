# Maximus

Discord bot that routes messages to OpenCode in project workspaces.

## Setup

```bash
npm install
cp .env.example .env
```

Configure `.env` with your Discord bot token and OpenCode settings. See `.env.example` for all options.

## Configure Projects

Edit `projects.json`:

```json
[
  {
    "id": "my-project",
    "name": "My Project",
    "folder": "/path/to/project"
  }
]
```

## Run

```bash
npm run dev    # Development
npm run build && npm start  # Production
```

## Usage

Mention the bot in a project channel:

```
@maximus refactor the auth middleware
```

Reply in thread to continue the session. Prefix with `#` for notes.
