# SyncBlaze API

SyncBlaze is a free, local-first workspace for moving files, photos, notes, and links between your own devices, phone to laptop, laptop to phone, instantly. When two of your devices share the same Wi-Fi, files travel straight between them and never touch a server. Every room also gets live collaborative notes and a private, end-to-end encrypted chat, and the whole thing installs as an app on your phone or desktop.

Live at **[syncblazer.vercel.app](https://syncblazer.vercel.app)**. This repo is the backend: the API, real-time layer, and cloud fallback that the frontend (a separate repo, linked below) talks to.

## What this service actually does

Direct device-to-device transfers never pass through here at all, that's the whole point of local-first. This backend's job is everything around that:

- **Auth** — email/password, Google sign-in, and one-tap guest accounts that can be upgraded to a real account later without losing anything.
- **Rooms** — shared spaces for your own devices or a group of people, joined by code, QR, or an emailed invite.
- **Signaling** — the WebRTC handshake (offer/answer/ICE) two devices need to open a direct connection. It only ever sees that handshake, never the file itself.
- **Cloud fallback** — when a direct connection isn't possible, the file is relayed through here instead, so a transfer never just fails.
- **Notes** — a small custom real-time layer (built on [Yjs](https://github.com/yjs/yjs), a CRDT) so two people can edit the same note at once without conflicts, plus the plain REST API notes use outside of active editing.
- **Room chat** — stores and relays only ciphertext and wrapped encryption keys. Every device generates its own keypair and a room's chat key is wrapped individually per recipient device, so this service never has anything that could decrypt a message, even if it wanted to.
- **Notifications** — an in-app feed plus optional real Web Push (delivered even when the app is closed), on top of transactional email (welcome, login notices, room invites, note-shared notices) via Resend.

## Tech stack

[Bun](https://bun.sh) runtime, [Express](https://expressjs.com), [MongoDB](https://www.mongodb.com) via Mongoose, [Socket.IO](https://socket.io) for everything real-time, JWT auth, [Zod](https://zod.dev) for request validation, [Resend](https://resend.com) for email, and [web-push](https://github.com/web-push-libs/web-push) for browser push notifications.

## Local development

```bash
cp .env.example .env   # fill in MONGODB_URI at minimum
bun install
bun run dev
```

Runs at `http://localhost:4000`. `bun run typecheck` runs a `tsc --noEmit` pass; there's no separate build step, Bun runs the TypeScript directly.

### Environment variables

Everything except `MONGODB_URI` has a sane local default or is fully optional (the feature it powers just turns itself off when unset, never crashes). See `.env.example` for the full list with explanations; the highlights:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Your database connection string |
| `CLIENT_ORIGIN` | The frontend's URL, for CORS |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Sign auth tokens |
| `GOOGLE_CLIENT_ID` | Optional, enables "Sign in with Google" |
| `RESEND_API_KEY` | Optional, enables transactional email |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Optional, enables real push notifications |
| `ADMIN_EMAILS` | Optional, who can access `/api/admin` |

## Deploying

Built for [Render](https://render.com). Create a **Web Service**, root directory `backend`, health check path `/api/health`. If Render offers Bun as a runtime, use `bun install` / `bun run start` directly; otherwise the included `Dockerfile` needs no configuration. Set the environment variables above (`MONGODB_URI` and the two JWT secrets at minimum) in Render's dashboard, and set `CLIENT_ORIGIN` to your deployed frontend's exact URL once you have it.

> **Free-tier note:** cloud-relayed files (the fallback path only, direct transfers never touch this server) are stored on local disk and don't survive a redeploy or restart on Render's free tier, since that filesystem isn't persistent. Swap in real object storage (S3, R2, etc.) if that durability matters for your deployment.

## Related repos

- [Frontend](https://github.com/fasakinhenry/syncblazer) — the React/Vite PWA this API serves
- [Desktop app](https://github.com/fasakinhenry/syncblazer-desktop) — a native companion built with Tauri

---

> Made with 💖by [Fasakin Henry](https://github.com/fasakinhenry)
