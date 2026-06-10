import axios from 'axios';

const TWSE_QUOTES_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
const TPEX_QUOTES_URL = 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes';
const GOODINFO_URL = 'https://goodinfo.tw/tw/StockFinDetail.asp';
const QUOTE_CACHE_MS = 5 * 60 * 1000;

let quoteCache = { fetchedAt: 0, quotes: [] };

const parseNumber = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value)
    .trim()
    .replaceAll(',', '')
    .replaceAll('%', '')
    .replaceAll('％', '')
    .replaceAll('+', '')
    .replace(/[^\d.-]/g, '');
  if (!normalized || normalized === '-' || normalized === '.') return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
};

const rocDateToIso = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 7) {
    return `${Number(digits.slice(0, 3)) + 1911}-${digits.slice(3, 5)}-${digits.slice(5, 7)}`;
  }
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return String(value || '');
};

const normalizeQuery = (value) => String(value || '').replace(/\s+/g, '').trim();

const decodeEntities = (value) => String(value || '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#(\d+);/g, (match, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (match, code) => String.fromCodePoint(Number.parseInt(code, 16)));

const htmlText = (value) => decodeEntities(
  String(value || '')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
).replace(/\s+/g, ' ').trim();

const extractTables = (html) => {
  const tags = [...String(html).matchAll(/<table\b[^>]*>|<\/table\s*>/gi)];
  const stack = [];
  const tables = [];
  tags.forEach((tag) => {
    if (/^<table\b/i.test(tag[0])) {
      stack.push({ start: tag.index });
      return;
    }
    const open = stack.pop();
    if (open) tables.push({ start: open.start, html: html.slice(open.start, tag.index + tag[0].length) });
  });
  return tables.sort((a, b) => a.start - b.start).map(({ html: table }) => table);
};

const twseQuote = (row) => ({
  code: String(row.Code || '').trim(),
  name: String(row.Name || '').trim(),
  market: 'TWSE',
  marketLabel: '上市',
  date: rocDateToIso(row.Date),
  close: parseNumber(row.ClosingPrice),
  change: parseNumber(row.Change),
  open: parseNumber(row.OpeningPrice),
  high: parseNumber(row.HighestPrice),
  low: parseNumber(row.LowestPrice),
  volume: parseNumber(row.TradeVolume),
  sourceUrl: TWSE_QUOTES_URL,
});

const tpexQuote = (row) => ({
  code: String(row.SecuritiesCompanyCode || '').trim(),
  name: String(row.CompanyName || '').trim(),
  market: 'TPEx',
  marketLabel: '上櫃',
  date: rocDateToIso(row.Date),
  close: parseNumber(row.Close),
  change: parseNumber(row.Change),
  open: parseNumber(row.Open),
  high: parseNumber(row.High),
  low: parseNumber(row.Low),
  volume: parseNumber(row.TradingShares),
  sourceUrl: TPEX_QUOTES_URL,
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
  const codeMatch = normalized.match(/\d{4}/);
  if (codeMatch) {
    const quote = quotes.find(({ code }) => code === codeMatch[0]);
    if (quote) return quote;
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

const goodinfoClient = () => {
  const timezoneOffset = -480;
  const days = Date.now() / 86400000 - timezoneOffset / 1440;
  return {
    days,
    key: `2.8|38057.1435627105|46946.0324515993|${timezoneOffset}|${days}|${days}`,
  };
};

const parseFinancialTable = (html) => {
  const table = extractTables(html)[6];
  if (!table) throw new Error('財報來源暫時無法解析。');
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)].map((row) => (
    [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]\s*>/gi)].map((cell) => htmlText(cell[1]))
  )).filter((row) => row.length > 0);
  const headerIndex = rows.findIndex((row) => row.filter((cell) => /^\d{4}$/.test(cell)).length >= 2);
  if (headerIndex < 0) throw new Error('財報來源缺少年度欄位。');
  const years = rows[headerIndex].filter((cell) => /^\d{4}$/.test(cell));
  const markerRow = rows[headerIndex + 1] || [];
  const paired = markerRow.length >= years.length * 2 && markerRow.some((cell) => cell.includes('%') || cell.includes('％'));
  const data = {};
  rows.slice(headerIndex + 1).forEach((row) => {
    const field = String(row[0] || '').trim();
    if (!field || field === '金額' || field === '％' || field === '%') return;
    const values = {};
    years.forEach((year, index) => {
      const valueIndex = 1 + index * (paired ? 2 : 1);
      values[year] = parseNumber(row[valueIndex]);
    });
    if (Object.values(values).some((value) => value !== null)) data[field] = values;
  });
  return { data, years };
};

const fetchFinancialReport = async (stockId, category) => {
  const { days, key } = goodinfoClient();
  const response = await axios.get(GOODINFO_URL, {
    timeout: 10000,
    params: {
      RPT_CAT: category,
      STOCK_ID: stockId,
      REINIT: days.toFixed(10),
    },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Referer: 'https://goodinfo.tw/',
      Cookie: `CLIENT_KEY=${key}`,
    },
  });
  return parseFinancialTable(response.data);
};

const pickField = (table, patterns, exclusions = []) => {
  const fields = Object.keys(table);
  return patterns.map((pattern) => fields.find((field) => field === pattern && !exclusions.some((item) => field.includes(item)))).find(Boolean)
    || patterns.map((pattern) => fields.find((field) => field.includes(pattern) && !exclusions.some((item) => field.includes(item)))).find(Boolean)
    || null;
};

const tableValue = (table, year, patterns, exclusions = []) => {
  const field = pickField(table, patterns, exclusions);
  return field ? table[field]?.[year] ?? null : null;
};

const ratio = (numerator, denominator) => (
  numerator !== null && denominator !== null && denominator !== 0
    ? (numerator / denominator) * 100
    : null
);

const computeMetrics = ({
  income, balance, cashFlow, years,
}) => Object.fromEntries(
  years.map((year) => {
    const revenue = tableValue(income, year, ['營業收入合計', '營業收入'], ['率']);
    const grossProfit = tableValue(income, year, ['營業毛利', '毛利'], ['率']);
    const sellingExpense = tableValue(income, year, ['推銷費用', '銷售費用']);
    const adminExpense = tableValue(income, year, ['管理費用']);
    const rdExpense = tableValue(income, year, ['研究發展費用', '研發費用']);
    const operatingIncome = tableValue(income, year, ['營業利益', '營業利益(損失)', '營業利益（損失）'], ['率']);
    const netIncome = tableValue(income, year, ['歸屬於母公司業主之本期淨利', '稅後淨利', '本期淨利'], ['率']);
    const eps = tableValue(income, year, ['每股稅後盈餘', '每股盈餘', 'EPS']);
    const currentAssets = tableValue(balance, year, ['流動資產合計', '流動資產總額']);
    const currentLiabilities = tableValue(balance, year, ['流動負債合計', '流動負債總額']);
    const liabilities = tableValue(balance, year, ['負債總額', '負債總計']);
    const assets = tableValue(balance, year, ['資產總額', '資產總計']);
    const equity = tableValue(balance, year, ['股東權益總額', '權益總額']);
    const cash = tableValue(balance, year, ['現金及約當現金', '現金']);
    const inventory = tableValue(balance, year, ['存貨']);
    const operatingCashFlow = tableValue(cashFlow, year, ['營業活動之淨現金流入(出)', '營業活動之淨現金流入']);
    const investingCashFlow = tableValue(cashFlow, year, ['投資活動之淨現金流入(出)', '投資活動之淨現金流入']);
    const financingCashFlow = tableValue(cashFlow, year, ['融資活動之淨現金流入(出)', '融資活動之淨現金流入']);
    const capex = tableValue(cashFlow, year, ['固定資產(增加)減少', '固定資產（增加）減少']);
    const dividends = tableValue(cashFlow, year, ['發放現金股利', '現金股利']);
    const expenses = [sellingExpense, adminExpense, rdExpense].filter((value) => value !== null);
    const operatingExpenses = expenses.length > 0 ? expenses.reduce((total, value) => total + value, 0) : null;
    return [year, {
      revenue,
      grossProfit,
      sellingExpense,
      adminExpense,
      rdExpense,
      operatingExpenses,
      operatingIncome,
      netIncome,
      eps,
      currentAssets,
      currentLiabilities,
      liabilities,
      assets,
      equity,
      cash,
      inventory,
      operatingCashFlow,
      investingCashFlow,
      financingCashFlow,
      capex,
      dividends,
      freeCashFlow: operatingCashFlow !== null && capex !== null ? operatingCashFlow + capex : null,
      grossMargin: ratio(grossProfit, revenue),
      operatingMargin: ratio(operatingIncome, revenue),
      netMargin: ratio(netIncome, revenue),
      operatingExpenseRatio: ratio(operatingExpenses, revenue),
      currentRatio: ratio(currentAssets, currentLiabilities),
      debtRatio: ratio(liabilities, assets),
      roe: ratio(netIncome, equity),
      roa: ratio(netIncome, assets),
    }];
  }),
);

const getStockAnalysis = async (query) => {
  const stock = await resolveStock(query);
  const [incomeReport, balanceReport, cashFlowReport] = await Promise.all([
    fetchFinancialReport(stock.code, 'IS_YEAR'),
    fetchFinancialReport(stock.code, 'BS_YEAR'),
    fetchFinancialReport(stock.code, 'CF_YEAR'),
  ]);
  const years = incomeReport.years.slice(0, 3);
  const financials = {
    income: incomeReport.data,
    balance: balanceReport.data,
    cashFlow: cashFlowReport.data,
    years,
  };
  return {
    stock,
    years,
    metrics: computeMetrics(financials),
    fetchedAt: new Date().toISOString(),
    sources: {
      quote: stock.sourceUrl,
      income: `${GOODINFO_URL}?RPT_CAT=IS_YEAR&STOCK_ID=${stock.code}`,
      balance: `${GOODINFO_URL}?RPT_CAT=BS_YEAR&STOCK_ID=${stock.code}`,
      cashFlow: `${GOODINFO_URL}?RPT_CAT=CF_YEAR&STOCK_ID=${stock.code}`,
      mopsListed: `https://mops.twse.com.tw/mops/web/t05st01?step=1&co_id=${stock.code}&TYPEK=sii`,
      mopsOtc: `https://mops.twse.com.tw/mops/web/t05st01?step=1&co_id=${stock.code}&TYPEK=otc`,
    },
  };
};

export {
  getStockAnalysis,
  resolveStock,
};
