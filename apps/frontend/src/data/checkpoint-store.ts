// INTERIM PLACEHOLDER — not durable, not for participant-facing studies.
//
// This in-memory store exists only so the /api/checkpoints route has
// somewhere to write while the real storage backend (Postgres? Supabase?
// something else?) is decided — see EXP-2 escalation. It does not survive a
// server restart and will not share state across serverless instances.
// Replace `recordCheckpoint` with a real persistence call once that decision
// lands; nothing outside this file should need to change.
export type CheckpointRecord = {
  id: string;
  name: string;
  context: unknown;
  receivedAt: string;
};

const records: CheckpointRecord[] = [];

export async function recordCheckpoint(
  name: string,
  context: unknown,
): Promise<CheckpointRecord> {
  const record: CheckpointRecord = {
    id: crypto.randomUUID(),
    name,
    context,
    receivedAt: new Date().toISOString(),
  };
  records.push(record);
  return record;
}

// Test/debug only — not exposed over HTTP.
export function _listCheckpoints(): CheckpointRecord[] {
  return records;
}

export function _clearCheckpoints(): void {
  records.length = 0;
}
