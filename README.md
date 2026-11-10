# ⚡ VEX TICKET

A Discord ticket bot built for a GrimVex-style server: category tickets, a modal that asks the right
questions per category, a 3-stage urgency system that's visible right in the channel name, and a
staff claim leaderboard.

## Features

- **🎫 One panel, four ticket types** — ⚔️ General Support, 📝 Staff Application, 🤝 Collab/Partnership,
  🚨 Report Player. Add more in `src/config.js`.
- **📋 Smart modals** — Every category asks a "Describe your issue" style question, plus extra
  brand-specific fields (e.g. Apply asks for IGN/age, Collab asks for brand name & platform).
- **🚦 3-level urgency system** — 🟢 Normal → 🟡 In Progress → 🔴 Urgent. Staff pick a level from a
  dropdown inside the ticket; the channel name, topic, and embed color update instantly
  (e.g. `🟢┃general-steve` → `🔴┃general-steve`). Setting a ticket to 🔴 Urgent pings your support role.
- **🙋 Claim system + 🏆 leaderboard** — First staff member to hit "Claim Ticket" is locked in as the
  owner. `/leaderboard` shows the top 10 staff by tickets claimed, medals and all.
- **🔒 Clean close flow** — `/close` or the Close button logs a summary to your log channel, then
  deletes the ticket channel.

## Setup

1. **Create the bot** at https://discord.com/developers/applications → Bot tab → copy the token
   and the **Application (client) ID**. Under OAuth2 → URL Generator, pick `bot` + `applications.commands`
   scopes and these permissions: Manage Channels, Manage Roles, Send Messages, Embed Links,
   Read Message History. Invite it to your server.
2. **Clone & install**
   ```bash
   git clone <your-fork-url>
   cd vex-tickets
   npm install
   ```
3. **Configure the bare minimum**: copy `.env.example` to `.env` and fill in only
   `DISCORD_TOKEN`, `CLIENT_ID` (the bot's own ID), and `GUILD_ID` (your server's ID).
   `TICKET_CATEGORY_ID`, `SUPPORT_ROLE_ID`, and `LOG_CHANNEL_ID` are **optional** — you can set
   them with `/setupticket` instead (see below), no redeploy needed.
4. **Register slash commands**
   ```bash
   npm run deploy
   ```
5. **Run the bot**
   ```bash
   npm start
   ```
6. **One-click setup** — in Discord, run `/setupticket` (needs Manage Server). With no options it
   auto-creates a `🎫 VEX Tickets` category, a `VEX Support` role, a `#ticket-logs` channel, and
   posts the panel in the current channel. Already have a category/role/log channel you want to
   reuse? Pass them as options: `/setupticket category:#tickets support_role:@Staff log_channel:#logs`.
   Run it again any time to change one of these — anything you don't pass stays as-is.
7. **Add more staff**: `/addstaff role:@Moderator` or `/addstaff user:@someone` — anyone with
   Manage Server, the support role, or an `/addstaff`'d role/user can claim tickets, change urgency,
   and use `/ticket-add`, `/ticket-remove`, and `/staffhelp`. Undo with `/removestaff`.
8. Point people at `/help` for how to open a ticket, and staff at `/staffhelp` for the full
   command list.

## Everything added in v1.2

- **🧩 `/setupticket`** — one command creates (or reuses) the ticket category, support role, and
  log channel, then posts the panel. All of it is editable at runtime — no more hand-editing `.env`
  and restarting the bot.
- **👥 `/addstaff` / `/removestaff`** — mark any role and/or individual user as staff. Staff status
  gates claiming, urgency changes, and `/ticket-add` / `/ticket-remove`.
- **❓ `/help`** — plain-language "how to open a ticket" for everyone.
- **🛠️ `/staffhelp`** — full command cheat-sheet, staff only.
- Ticket category / support role / log channel are now read live from settings each time (via
  `/setupticket`), with your `.env` values only used as a first-run fallback.

## Everything added in v1.1

- **📄 Transcripts** — every close generates a `.txt` transcript and posts it to `LOG_CHANNEL_ID`.
- **⏰ Auto-close on inactivity** — warns at 12h quiet, auto-closes at 24h (edit `inactivityWarnMs` /
  `inactivityCloseMs` in `config.js`).
- **🚦 Auto-escalation** — an unclaimed ticket flips to 🔴 Urgent after 30 min (`escalationUnclaimedMs`).
- **🔢 Limits** — `maxOpenTicketsPerUser` (default 2) and `categoryOpenLimit` (default 15) are enforced
  before a ticket is created.
- **⏳ Cooldown** — 5 min between closing a ticket and opening a new one (`cooldownAfterCloseMs`);
  clear it early with `/cooldown-clear @user`.
- **➕➖ `/ticket-add` / `/ticket-remove`** — bring another user into (or out of) a ticket channel.
- **⭐ Ratings** — the opener gets a DM with 1–5 star buttons after their ticket closes; feeds `/stats`.
- **📊 `/stats`** — total tickets, avg. claim/resolution time, avg. rating, tickets per category, top staff.
- **🚫 `/blacklist add|remove @user`** — stop someone from opening tickets at all.
- **🔓 Reopen / 🗑️ Delete Now** — closed tickets archive (locked, visible) for 1h before auto-deleting,
  with buttons to bring them back or wipe them immediately (`archiveRetentionMs`).

All the numbers above live in `src/config.js` under "Limits & automation" — change them freely.

## Customizing the vibe

Everything visual lives in `src/config.js`:
- `ticketCategories` — add/remove categories, change emojis, labels, and modal fields
- `urgencyLevels` — change the 3 status emojis/colors/labels
- `embedColor`, `panelTitle`, `panelDescription`, `footerText` — overall branding

## Deploying 24/7

This is a plain Node process, so it runs on any host that supports Node 18+: Railway, Render,
a VPS with `pm2`, or a GitHub Actions self-hosted runner. There's no database server to provision —
tickets and the leaderboard are stored in `data/db.json`, created automatically on first run
(make sure your host's filesystem persists between restarts, or swap `src/utils/db.js` for a real DB
if you deploy somewhere with an ephemeral filesystem).

## Project structure

```
src/
  config.js                   — all branding/category/urgency settings
  index.js                    — bot entry point
  deploy-commands.js          — registers /ticket-panel, /leaderboard, /close
  handlers/interactionCreate.js — all button/select/modal/command logic
  utils/ticketBuilder.js      — embeds, modals, buttons, channel names
  utils/db.js                 — JSON-file storage (tickets + leaderboard)
data/db.json                  — auto-created at runtime (gitignored)
```
