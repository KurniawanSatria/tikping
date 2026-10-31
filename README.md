# tikping

Discord bot that pings a channel the moment a tracked TikTok creator goes live, plus a web dashboard for the current status.

Every liveness check goes straight to TikTok's own web endpoint (`/api-live/user/room/`). No API key, no quota, no third-party service in between.

## Run

```bash
npm install
cp .env.example .env      # fill in DISCORD_TOKEN
npm start
```

`npm start` boots the bot, the poller and the dashboard on `http://127.0.0.1:3000` in a single process.

The bot needs the `bot` and `applications.commands` scopes, plus Send Messages in the target channel.

## Discord setup

| Command | What it does |
|---|---|
| `/channel` | Post live alerts in this channel. Stored per server. |
| `/track add <username>` | Track a creator. Verifies the username exists before saving. |
| `/track remove <username>` | Stop tracking a creator. |
| `/track list` | Show tracked creators and this server's alert channel. |
| `/status` | Current live state and last error per creator. |

Set `GUILD_ID` in `.env` to register the commands on that server instantly. Leave it empty for global registration, which can take up to an hour to show up.

## How it works

Every `POLL_SECONDS` (default 60) all creators are checked in parallel. Alerts fire only on a **state change** (offline → live, live → offline), so a poll never spams the channel.

Liveness is decided by `liveRoom.status === 2` alone. `roomId` and `title` are **not** live indicators — a room that already ended still carries both. Trusting either one pings a creator who stopped streaming days ago.

State lives in `data.json` (gitignored), so restarting the bot does not re-send a "live" alert for a stream that is still running.

The creator list is global; the alert channel is per server (`channels[guildId]`). Two servers cannot overwrite each other, and each alert goes out to every configured channel.

A failed check keeps the previous live state and surfaces the error in `/status` and on the dashboard. A network error must never look like "the creator ended the stream".

## Environment

| Variable | Default | Notes |
|---|---|---|
| `DISCORD_TOKEN` | — | Required |
| `GUILD_ID` | empty | Server id. Registers the commands immediately |
| `PING` | `@here` | Mention used in live alerts (`@everyone`, or `<@&roleid>`) |
| `POLL_SECONDS` | `60` | Delay between check rounds |
| `HOST` / `PORT` | `127.0.0.1` / `3000` | Dashboard bind address. Keep `HOST` local, the dashboard has no login |

## Test

```bash
npm test
```

32 assertions, no network: TikTok response parsing (status 2 = live, 4 = offline), the live/offline transition logic, the live alert embed and button shape, and per-server channel isolation.

## Limitations

- `/api-live/user/room/` is an internal TikTok endpoint, not an official API. Its shape can change without notice. If every creator suddenly reports an error, this is the likely cause.
- Parallel checks are fine up to a few dozen creators. Past that they need batching, TikTok throttles per IP.
- No backoff. A failing check is retried on the same fixed interval.
- Alerts can be up to 60 seconds late, since this polls instead of holding a WebSocket.
- The dashboard is read-only. Creators are added and removed through Discord, so no login is needed.

## License

MIT, see [LICENSE](LICENSE).
