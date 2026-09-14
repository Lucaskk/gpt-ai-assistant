import { createHash } from 'node:crypto';

const ownerHash = 'e6f6b73a3d19e73357dfbefea5c1e4e2b20461995f650db2fd4623321d2fdc49';
const hash = (value) => createHash('sha256').update(value).digest('hex');
export const isNewsCommand = (event) => event?.type === 'message'
  && event.message?.type === 'text' && event.message.text.trim() === '重新產出';

// Called only after LINE signature verification. Never pass this command to AI.
export async function queueNewsCommand(event, token, fetcher = fetch, now = Date.now(), authorizedHash = ownerHash) {
  if (!isNewsCommand(event)) return false;
  if (event.source?.type !== 'user' || typeof event.source.userId !== 'string'
      || hash(event.source.userId) !== authorizedHash) return true;
  if (typeof event.webhookEventId !== 'string' || !event.webhookEventId
      || !Number.isFinite(event.timestamp) || event.timestamp > now + 60000
      || now - event.timestamp > 86400000) return true;
  if (!token) throw new Error('News command queue is not configured');
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(event.timestamp);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  if (date !== today) return true;
  const endpoint = `https://api.github.com/repos/Lucaskk/daily-news/contents/wiki/daily/commands/${date}.json`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' };
  const request = { date, action: 'diagnose', event_key: hash(event.webhookEventId),
    requested_at: new Date(event.timestamp).toISOString() };
  // One latest request per day; retries and out-of-order delivery cannot requeue old work.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await fetcher(`${endpoint}?ref=main`, { headers, signal: AbortSignal.timeout(8000) });
    let sha;
    if (current.ok) {
      const entry = await current.json();
      const previous = JSON.parse(Buffer.from(entry.content, 'base64').toString());
      if (previous.event_key === request.event_key
          || Date.parse(previous.requested_at) >= event.timestamp) return true;
      sha = entry.sha;
    } else if (current.status !== 404) throw new Error(`News queue read HTTP ${current.status}`);
    const result = await fetcher(endpoint, { method: 'PUT', headers,
      signal: AbortSignal.timeout(8000), body: JSON.stringify({
        message: `Request news diagnosis ${date}`, branch: 'main', ...(sha ? { sha } : {}),
        content: Buffer.from(`${JSON.stringify(request)}\n`).toString('base64'),
      }) });
    if (result.ok) return true;
    if (![409, 422].includes(result.status)) throw new Error(`News queue write HTTP ${result.status}`);
  }
  throw new Error('News queue concurrent update; retry webhook');
}
