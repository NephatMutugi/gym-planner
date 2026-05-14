// Offline queue for set logs. Stored in localStorage as JSON, drained on reconnect.

export interface PendingSet {
  sessionId: string;
  payload: {
    exerciseId: string;
    setNumber: number;
    weightKg?: number | null;
    reps?: number | null;
    holdSeconds?: number | null;
    skipped?: boolean;
    programItemId?: string | null;
  };
  queuedAt: number;
}

const KEY = "gp:pending-sets:v1";

function readQueue(): PendingSet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(q: PendingSet[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(q));
  } catch {
    // Best effort
  }
}

export function enqueueSet(item: PendingSet): void {
  const q = readQueue();
  // Dedupe by (sessionId, exerciseId, setNumber) — newest wins
  const filtered = q.filter(
    (e) =>
      !(
        e.sessionId === item.sessionId &&
        e.payload.exerciseId === item.payload.exerciseId &&
        e.payload.setNumber === item.payload.setNumber
      )
  );
  filtered.push(item);
  writeQueue(filtered);
}

export function pendingCountFor(sessionId: string): number {
  return readQueue().filter((e) => e.sessionId === sessionId).length;
}

export async function drainQueue(): Promise<{ ok: number; failed: number }> {
  if (typeof window === "undefined") return { ok: 0, failed: 0 };
  if (!window.navigator.onLine) return { ok: 0, failed: 0 };
  const q = readQueue();
  if (q.length === 0) return { ok: 0, failed: 0 };

  const remaining: PendingSet[] = [];
  let ok = 0;
  let failed = 0;
  for (const entry of q) {
    try {
      const res = await fetch(`/api/sessions/${entry.sessionId}/sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry.payload),
      });
      if (res.ok) {
        ok += 1;
      } else if (res.status === 404 || res.status === 401) {
        // Session deleted or user signed out — drop the entry rather than retry forever
        failed += 1;
      } else {
        // Server error — keep for retry
        remaining.push(entry);
      }
    } catch {
      remaining.push(entry);
    }
  }
  writeQueue(remaining);
  return { ok, failed };
}
