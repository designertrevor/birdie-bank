// The shared Tab's rows waiting on this phone for signal (tab-sync.js), kept apart so the queue
// can be tested without the app. A row is keyed by its round code and id: queuing it again
// replaces the copy still waiting, and the server upserts on the same key, so a row sent twice
// (a retry after the reply was lost) is still one row there.

export const rowKey = r => `${r.code}|${r.id}`;

/** The queue with `rows` added at the end, each replacing any copy of itself still waiting. */
export function queueRows(queue, rows) {
  const keys = new Set(rows.map(rowKey));
  return [...queue.filter(r => !keys.has(rowKey(r))), ...rows];
}

/** The queue without `row` once it's sent, unless a newer copy of it was queued meanwhile. */
export function dropSent(queue, row) {
  return queue.filter(r => !(r.code === row.code && r.id === row.id && r.updatedAt === row.updatedAt));
}

/**
 * Send the waiting rows oldest first through `send`; `read` and `write` are the saved queue.
 * The first failure (no signal) stops it, so the rest keep their order for the next try. `skip(e)`
 * says the server will never take that row: it's dropped and the rest go on. True when all went.
 */
export async function flushQueue({ read, write, send, skip = () => false, onError = () => {} }) {
  for (const row of read()) {
    try {
      await send(row);
      write(dropSent(read(), row));
    } catch (e) {
      if (skip(e, row)) { write(dropSent(read(), row)); continue; }
      onError(e);
      return false;
    }
  }
  return true;
}
