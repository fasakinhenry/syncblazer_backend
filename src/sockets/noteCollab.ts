import * as Y from "yjs";
import { Note } from "@/models/Note.model.ts";
import { canAccessNote } from "@/services/noteAccess.service.ts";
import { logger } from "@/utils/logger.ts";
import type { AuthedSocket } from "@/sockets/socket.server.ts";

// How long to wait after the last edit before writing the Yjs state to
// Mongo — mirrors the debounce-per-note pattern already used for the plain
// markdown autosave (NotesPage.tsx), just on the collaborative side.
const PERSIST_DEBOUNCE_MS = 5000;
// A quick reconnect (page refresh, brief network blip) should reattach to
// the same live doc rather than forcing a re-hydrate from Mongo — give it
// this long after the last subscriber leaves before actually evicting.
const EVICT_GRACE_MS = 30_000;

interface NoteDocEntry {
  doc: Y.Doc;
  subscriberCount: number;
  persistTimer: ReturnType<typeof setTimeout> | null;
  evictTimer: ReturnType<typeof setTimeout> | null;
}

// One live Y.Doc per actively-open note, shared across every socket
// subscribed to it — the server is the authority a brand-new joiner
// syncs against, not just a blind relay between whoever's already there.
const docs = new Map<string, NoteDocEntry>();

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

/**
 * Relays and persists the live Yjs layer for collaborative note editing —
 * binary document updates and ephemeral cursor/presence ("awareness")
 * data, scoped per note via a `note:<noteId>` socket room. This is purely
 * additive: the existing REST `PATCH /notes/:id` + markdown `content`
 * field (note.controller.ts) stays the durability backbone for everything
 * that isn't live co-editing — offline queueing, search, export, the
 * public share page. This layer only carries the real-time experience.
 */
export function registerNoteCollabHandlers(socket: AuthedSocket) {
  const { userId } = socket.data;
  // Every note this socket is actively subscribed to, so disconnect can
  // clean each one up without requiring the client to explicitly leave first.
  const joinedNoteIds = new Set<string>();

  socket.on("note:collab:join", async ({ noteId }: { noteId?: string }) => {
    if (!noteId || joinedNoteIds.has(noteId)) return;
    if (!(await canAccessNote(userId, noteId))) return;

    const entry = await loadEntry(noteId);
    if (entry.evictTimer) {
      clearTimeout(entry.evictTimer);
      entry.evictTimer = null;
    }
    entry.subscriberCount += 1;
    joinedNoteIds.add(noteId);
    socket.join(`note:${noteId}`);

    socket.emit("note:collab:state", { noteId, state: Buffer.from(Y.encodeStateAsUpdate(entry.doc)) });
  });

  socket.on("note:collab:update", ({ noteId, update }: { noteId?: string; update?: Uint8Array }) => {
    if (!noteId || !update || !joinedNoteIds.has(noteId)) return;
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
    if (!noteId || !update || !joinedNoteIds.has(noteId)) return;
    socket.to(`note:${noteId}`).emit("note:collab:awareness", { noteId, update });
  });

  const leave = (noteId: string) => {
    if (!joinedNoteIds.delete(noteId)) return;
    socket.leave(`note:${noteId}`);
    const entry = docs.get(noteId);
    if (!entry) return;

    entry.subscriberCount = Math.max(0, entry.subscriberCount - 1);
    if (entry.subscriberCount > 0) return;

    // Nobody's left watching this note — flush immediately (nothing left to
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
    for (const noteId of [...joinedNoteIds]) leave(noteId);
  });
}
