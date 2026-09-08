import * as Y from "yjs";
import { Note } from "@/models/Note.model.ts";
import { User } from "@/models/User.model.ts";
import { getNoteAccess } from "@/services/noteAccess.service.ts";
import { logger } from "@/utils/logger.ts";
import { getIO } from "@/sockets/socket.server.ts";
import type { AuthedSocket } from "@/sockets/socket.server.ts";

// How long to wait after the last edit before writing the Yjs state to
// Mongo — mirrors the debounce-per-note pattern already used for the plain
// markdown autosave (NotesPage.tsx), just on the collaborative side.
const PERSIST_DEBOUNCE_MS = 5000;
// A quick reconnect (page refresh, brief network blip) should reattach to
// the same live doc rather than forcing a re-hydrate from Mongo — give it
// this long after the last subscriber leaves before actually evicting.
const EVICT_GRACE_MS = 30_000;
// The UI only ever shows the first 10 watcher avatars — no point tracking
// or broadcasting an unbounded roster for a note with a very large room.
const MAX_WATCHERS = 25;

interface NoteDocEntry {
  doc: Y.Doc;
  subscriberCount: number;
  persistTimer: ReturnType<typeof setTimeout> | null;
  evictTimer: ReturnType<typeof setTimeout> | null;
}

interface WatcherInfo {
  userId: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  canEdit: boolean;
}

// One live Y.Doc per actively-open note, shared across every socket
// subscribed to it — the server is the authority a brand-new joiner
// syncs against, not just a blind relay between whoever's already there.
const docs = new Map<string, NoteDocEntry>();
// Who currently has each note open — every reader AND editor, not just
// collaborators pushing edits. Keyed by userId with a tab/socket count so
// closing one of several open tabs doesn't drop them from the list.
const watchers = new Map<string, Map<string, WatcherInfo & { sockets: number }>>();

async function loadEntry(noteId: string): Promise<NoteDocEntry> {
  const existing = docs.get(noteId);
  if (existing) return existing;

  const doc = new Y.Doc();
  const note = await Note.findById(noteId).select("yjsState");
  const stored = note?.get("yjsState") as Buffer | undefined;
  if (stored?.length) {
    try {
      Y.applyUpdate(doc, stored);
    } catch (err) {
      logger.error(`Failed to hydrate Yjs state for note ${noteId}: ${String(err)}`);
    }
  }
  // If there's no stored state at all, the doc starts empty — the first
  // client to join seeds it from the note's existing markdown `content`
  // (see useNoteCollab.ts), so pre-existing notes aren't blanked out.

  const entry: NoteDocEntry = { doc, subscriberCount: 0, persistTimer: null, evictTimer: null };
  docs.set(noteId, entry);
  return entry;
}

async function persistNow(noteId: string, entry: NoteDocEntry) {
  try {
    const state = Buffer.from(Y.encodeStateAsUpdate(entry.doc));
    await Note.updateOne({ _id: noteId }, { $set: { yjsState: state } });
  } catch (err) {
    logger.error(`Failed to persist Yjs state for note ${noteId}: ${String(err)}`);
  }
}

function schedulePersist(noteId: string, entry: NoteDocEntry) {
  if (entry.persistTimer) clearTimeout(entry.persistTimer);
  entry.persistTimer = setTimeout(() => {
    entry.persistTimer = null;
    void persistNow(noteId, entry);
  }, PERSIST_DEBOUNCE_MS);
}

function broadcastWatchers(noteId: string) {
  const roster = watchers.get(noteId);
  const list: WatcherInfo[] = roster ? [...roster.values()].map(({ sockets: _sockets, ...info }) => info) : [];
  getIO()
    ?.to(`note:${noteId}`)
    .emit("note:watchers", { noteId, watchers: list.slice(0, MAX_WATCHERS), total: list.length });
}

function addWatcher(noteId: string, info: WatcherInfo) {
  let roster = watchers.get(noteId);
  if (!roster) {
    roster = new Map();
    watchers.set(noteId, roster);
  }
  const existing = roster.get(info.userId);
  if (existing) {
    existing.sockets += 1;
    existing.canEdit = existing.canEdit || info.canEdit; // most-permissive across this user's own tabs
  } else {
    roster.set(info.userId, { ...info, sockets: 1 });
  }
  broadcastWatchers(noteId);
}

function removeWatcher(noteId: string, userId: string) {
  const roster = watchers.get(noteId);
  if (!roster) return;
  const existing = roster.get(userId);
  if (!existing) return;
  existing.sockets -= 1;
  if (existing.sockets <= 0) {
    roster.delete(userId);
    if (roster.size === 0) watchers.delete(noteId);
  }
  broadcastWatchers(noteId);
}

/**
 * Relays and persists the live layer for collaborative note editing: who's
 * currently watching a note (any reader, shown as avatars below the note),
 * and — for those with write access — the live Yjs document + cursor
 * ("awareness") data, scoped per note via a `note:<noteId>` socket room.
 * This is purely additive: the existing REST `PATCH /notes/:id` + markdown
 * `content` field (note.controller.ts) stays the durability backbone for
 * everything that isn't live co-editing — offline queueing, search,
 * export, the public share page. This layer only carries the real-time
 * experience, and only to sockets that already passed an auth check
 * (there's no anonymous socket connection — see socket.server.ts).
 */
export function registerNoteCollabHandlers(socket: AuthedSocket) {
  const { userId } = socket.data;
  // Every note this socket is actively subscribed to, and whether ITS
  // access was write-level — re-checked independently on every update so a
  // stale/forged event from a since-downgraded viewer can't sneak through.
  const joined = new Map<string, { canEdit: boolean }>();

  socket.on("note:collab:join", async ({ noteId }: { noteId?: string }) => {
    if (!noteId || joined.has(noteId)) return;

    const user = await User.findById(userId).select("name email avatarUrl authProvider");
    if (!user) return;
    const isGuest = user.get("authProvider") === "guest";

    const access = await getNoteAccess(userId, noteId, isGuest);
    if (!access) return;

    joined.set(noteId, access);
    socket.join(`note:${noteId}`);
    addWatcher(noteId, {
      userId,
      name: user.get("name") ?? "Someone",
      email: user.get("email") ?? undefined,
      avatarUrl: user.get("avatarUrl") ?? undefined,
      canEdit: access.canEdit,
    });

    if (!access.canEdit) return; // read-only watchers stop here — no Yjs doc, no push access

    const entry = await loadEntry(noteId);
    if (entry.evictTimer) {
      clearTimeout(entry.evictTimer);
      entry.evictTimer = null;
    }
    entry.subscriberCount += 1;

    socket.emit("note:collab:state", { noteId, state: Buffer.from(Y.encodeStateAsUpdate(entry.doc)) });
  });

  socket.on("note:collab:update", ({ noteId, update }: { noteId?: string; update?: Uint8Array }) => {
    if (!noteId || !update || !joined.get(noteId)?.canEdit) return;
    const entry = docs.get(noteId);
    if (!entry) return;

    try {
      Y.applyUpdate(entry.doc, update, "remote");
    } catch (err) {
      logger.error(`Failed to apply Yjs update for note ${noteId}: ${String(err)}`);
      return;
    }
    socket.to(`note:${noteId}`).emit("note:collab:update", { noteId, update });
    schedulePersist(noteId, entry);
  });

  // Cursor/selection/presence — small, frequent, and never persisted; a
  // pure relay to everyone else currently in the note.
  socket.on("note:collab:awareness", ({ noteId, update }: { noteId?: string; update?: Uint8Array }) => {
    if (!noteId || !update || !joined.get(noteId)?.canEdit) return;
    socket.to(`note:${noteId}`).emit("note:collab:awareness", { noteId, update });
  });

  const leave = (noteId: string) => {
    const access = joined.get(noteId);
    if (!access) return;
    joined.delete(noteId);
    socket.leave(`note:${noteId}`);
    removeWatcher(noteId, userId);

    if (!access.canEdit) return;
    const entry = docs.get(noteId);
    if (!entry) return;

    entry.subscriberCount = Math.max(0, entry.subscriberCount - 1);
    if (entry.subscriberCount > 0) return;

    // Nobody's left editing this note — flush immediately (nothing left to
    // reset the debounce) and schedule eviction after a grace window.
    if (entry.persistTimer) {
      clearTimeout(entry.persistTimer);
      entry.persistTimer = null;
    }
    void persistNow(noteId, entry);
    entry.evictTimer = setTimeout(() => docs.delete(noteId), EVICT_GRACE_MS);
  };

  socket.on("note:collab:leave", ({ noteId }: { noteId?: string }) => {
    if (noteId) leave(noteId);
  });
  socket.on("disconnect", () => {
    for (const noteId of [...joined.keys()]) leave(noteId);
  });
}
