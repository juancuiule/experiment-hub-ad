import { beforeEach, describe, expect, it } from 'vitest';
import { POST } from './route';
import { _clearCheckpoints, _listCheckpoints } from '@/src/data/checkpoint-store';

function postRequest(body: unknown) {
  return new Request('http://localhost/api/checkpoints', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/checkpoints', () => {
  beforeEach(() => {
    _clearCheckpoints();
  });

  it('persists a valid checkpoint payload and returns 201', async () => {
    const response = await POST(
      postRequest({ name: 'cp1', context: { data: { a: 1 } } }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.id).toEqual(expect.any(String));

    const records = _listCheckpoints();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: body.id,
      name: 'cp1',
      context: { data: { a: 1 } },
    });
  });

  it('rejects a payload missing name with 400 and persists nothing', async () => {
    const response = await POST(postRequest({ context: {} }));

    expect(response.status).toBe(400);
    expect(_listCheckpoints()).toHaveLength(0);
  });

  it('rejects malformed JSON with 400', async () => {
    const request = new Request('http://localhost/api/checkpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(_listCheckpoints()).toHaveLength(0);
  });
});
