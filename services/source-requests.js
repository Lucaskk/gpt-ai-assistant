import { createHash } from 'node:crypto';

const ownerHash = 'e6f6b73a3d19e73357dfbefea5c1e4e2b20461995f650db2fd4623321d2fdc49';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const pattern = /^(?:加入|增加|新增)網址\s*(https:\/\/\S+)\s*$/u;
export const isSourceCommand = (event) => event?.type === 'message'
  && event.message?.type === 'text' && (event.message.text.trim() === '查看網址'
    || /^(?:加入|增加|新增)網址(?:\s|https:\/\/)/u.test(event.message.text.trim()));

export async function queueSourceCommand(event, token, fetcher = fetch, now = Date.now(), authorizedHash = ownerHash) {
  if (!isSourceCommand(event)) return false;
  if (event.source?.type !== 'user' || typeof event.source.userId !== 'string'
      || hash(event.source.userId) !== authorizedHash) return true;
  if (typeof event.webhookEventId !== 'string' || !event.webhookEventId
      || !Number.isFinite(event.timestamp) || event.timestamp > now + 60000
      || now - event.timestamp > 86400000) return true;
  const list = event.message.text.trim() === '查看網址';
  const match = event.message.text.trim().match(pattern);
  if (!list && !match) return true;
  let url;
  if (!list) try {
    url = new URL(match[1]);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return true;
    url.hash = '';
  } catch { return true; }
  if (!token) throw new Error('Source command queue is not configured');
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(event.timestamp);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  if (date !== today) return true;
  const key = hash(event.webhookEventId);
  const endpoint = `https://api.github.com/repos/Lucaskk/daily-news/contents/wiki/daily/source-requests/${date}/${key}.json`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' };
  const request = { action: list ? 'list_sources' : 'add_source', date, event_key: key,
    requested_at: new Date(event.timestamp).toISOString(), ...(list ? {} : { url: url.toString() }) };
  const result = await fetcher(endpoint, { method: 'PUT', headers, signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ message: `Queue source URL ${date}`, branch: 'main',
      content: Buffer.from(`${JSON.stringify(request)}\n`).toString('base64') }) });
  if (result.ok) return true;
  if (result.status === 422) {
    const existing = await fetcher(`${endpoint}?ref=main`, { headers, signal: AbortSignal.timeout(8000) });
    if (existing.ok) {
      const entry = await existing.json();
      const previous = JSON.parse(Buffer.from(entry.content, 'base64').toString());
      if (previous.event_key === key && previous.action === request.action
          && previous.url === request.url) return true;
    }
  }
  throw new Error(`Source queue write HTTP ${result.status}`);
}
