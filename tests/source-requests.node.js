import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isSourceCommand, queueSourceCommand } from '../services/source-requests.js';

const now = Date.parse('2026-10-01T04:00:00Z');
const owner = createHash('sha256').update('test-user').digest('hex');
const event = { type: 'message', message: { type: 'text', text: '加入網址 https://example.com/news#top' },
  source: { type: 'user', userId: 'test-user' }, webhookEventId: 'test-event', timestamp: now };

test('recognizes the exact URL command', () => {
  assert.equal(isSourceCommand(event), true);
  assert.equal(isSourceCommand({ ...event, message: { type: 'text', text: '新聞 https://example.com' } }), false);
});
test('queues only owner URL metadata and deduplicates by event key', async () => {
  let requestedPath; let payload;
  const fetcher = async (path, options) => {
    requestedPath = path;
    payload = JSON.parse(Buffer.from(JSON.parse(options.body).content, 'base64').toString());
    return { ok: true };
  };
  assert.equal(await queueSourceCommand(event, 'token', fetcher, now, owner), true);
  assert.match(requestedPath, /source-requests\/2026-10-01\/[0-9a-f]{64}\.json$/);
  assert.equal(payload.url, 'https://example.com/news');
  assert.equal(payload.action, 'add_source');
  assert.equal(JSON.stringify(payload).includes('test-user'), false);
});
test('ignores unauthorized users and unsafe URLs before network', async () => {
  const noNetwork = () => { throw new Error('unexpected network'); };
  await queueSourceCommand(event, 'token', noNetwork, now);
  await queueSourceCommand({ ...event, message: { type: 'text', text: '加入網址 http://example.com' } },
    'token', noNetwork, now, owner);
});
