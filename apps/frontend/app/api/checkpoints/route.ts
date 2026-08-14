import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordCheckpoint } from '@/src/data/checkpoint-store';

const checkpointPayloadSchema = z.object({
  name: z.string().min(1),
  context: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = checkpointPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid checkpoint payload', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const record = await recordCheckpoint(parsed.data.name, parsed.data.context);
  return NextResponse.json({ id: record.id }, { status: 201 });
}
