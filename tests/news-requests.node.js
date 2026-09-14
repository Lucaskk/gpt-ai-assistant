import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isNewsCommand, queueNewsCommand } from '../services/news-requests.js';

const now = Date.parse('2026-09-14T04:00:00Z');
const owner = createHash('sha256').update('test-user').digest('hex');
const event = { type: 'message', message: { type: 'text', text: '重新產出' },
  source: { type: 'user', userId: 'test-user' }, webhookEventId: 'test-event', timestamp: now };
test('only exact text command matches', () => {
  assert.equal(isNewsCommand(event), true);
  assert.equal(isNewsCommand({ ...event, message: { type: 'text', text: '請重新產出' } }), false);
});
test('reject unauthorized and group sources before network', async () => {
  const noNetwork = () => { throw new Error('network forbidden'); };
  await queueNewsCommand(event, 'test', noNetwork, now);
  await queueNewsCommand({ ...event, source: { type: 'group', userId: 'test-user' } }, 'test', noNetwork, now, owner);
});
test('queues only safe metadata, not source user or reply token', async () => {
  let payload;
  const fetcher = async (_, options) => {
    if (!options.method) return { status: 404 };
    payload = JSON.parse(Buffer.from(JSON.parse(options.body).content, 'base64').toString());
    return { ok: true };
  };
  assert.equal(await queueNewsCommand(event, 'test', fetcher, now, owner), true);
  assert.equal(payload.date, '2026-09-14');
  assert.equal(payload.action, 'diagnose');
  assert.equal(JSON.stringify(payload).includes('test-user'), false);
});
test('duplicate and out-of-order events do not write', async () => {
  const fetcher = async (_, options) => {
    assert.equal(options.method, undefined);
    return { ok: true, json: async () => ({ sha: 'abc', content: Buffer.from(JSON.stringify({
      requested_at: new Date(now + 1000).toISOString(), event_key: 'newer',
    })).toString('base64') }) };
  };
  await queueNewsCommand(event, 'test', fetcher, now, owner);
});
test('old-day and future events are ignored', async () => {
  const noNetwork = () => { throw new Error('network forbidden'); };
  await queueNewsCommand({ ...event, timestamp: now - 86400000 }, 'test', noNetwork, now, owner);
  await queueNewsCommand({ ...event, timestamp: now + 120000 }, 'test', noNetwork, now, owner);
});
test('queue failure is not falsely acknowledged', async () => {
  await assert.rejects(queueNewsCommand(event, '', undefined, now, owner));
  await assert.rejects(queueNewsCommand(event, 'test', async () => ({ status: 403 }), now, owner));
});
