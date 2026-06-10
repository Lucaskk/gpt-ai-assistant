import axios from 'axios';

const TWSE_QUOTES_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
const TPEX_QUOTES_URL = 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes';
const QUOTE_CACHE_MS = 30 * 60 * 1000;

let quoteCache = { fetchedAt: 0, quotes: [] };

const normalizeQuery = (value) => String(value || '').replace(/\s+/g, '').trim();

const twseQuote = (row) => ({
  code: String(row.Code || '').trim(),
  name: String(row.Name || '').trim(),
  market: 'TWSE',
});

const tpexQuote = (row) => ({
  code: String(row.SecuritiesCompanyCode || '').trim(),
  name: String(row.CompanyName || '').trim(),
  market: 'TPEx',
});

const fetchQuotes = async () => {
  if (quoteCache.quotes.length > 0 && Date.now() - quoteCache.fetchedAt < QUOTE_CACHE_MS) {
    return quoteCache.quotes;
  }
  const [twse, tpex] = await Promise.all([
    axios.get(TWSE_QUOTES_URL, { timeout: 8000 }),
    axios.get(TPEX_QUOTES_URL, { timeout: 8000 }),
  ]);
  const quotes = [
    ...twse.data.map(twseQuote),
    ...tpex.data.map(tpexQuote),
  ].filter(({ code }) => code);
  quoteCache = { fetchedAt: Date.now(), quotes };
  return quotes;
};

const resolveStock = async (query) => {
  const normalized = normalizeQuery(query);
  const quotes = await fetchQuotes();
  const codeMatch = normalized.match(/^\d{4}$/);
  if (codeMatch) {
    const quote = quotes.find(({ code }) => code === codeMatch[0]);
    return quote || { code: codeMatch[0], name: '', market: '' };
  }

  const exact = quotes.filter(({ name }) => normalizeQuery(name) === normalized);
  if (exact.length === 1) return exact[0];

  const partial = quotes.filter(({ name }) => normalized && normalizeQuery(name).includes(normalized));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    const choices = partial.slice(0, 6).map(({ name, code }) => `${name}(${code})`).join('、');
    throw new Error(`股票名稱不夠精確：${choices}`);
  }
  throw new Error('找不到股票代碼或名稱，請輸入 4 位數代碼或完整名稱。');
};

export {
  fetchQuotes,
  resolveStock,
};
