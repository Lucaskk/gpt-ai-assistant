import { expect, test } from '@jest/globals';
import { handleEvents } from '../app/index.js';
import { parseStockRequest } from '../app/handlers/stock.js';
import { renderStockAnalysis } from '../app/views/stock.js';
import { createEvents } from './utils.js';

test('parses stock codes and named stock commands', () => {
  expect(parseStockRequest('2330')).toBe('2330');
  expect(parseStockRequest('股票 台積電')).toBe('台積電');
  expect(parseStockRequest('stock: 2317')).toBe('2317');
  expect(parseStockRequest('鴻海 股票分析')).toBe('鴻海');
  expect(parseStockRequest('今天天氣如何')).toBeNull();
});

test('returns one short LINE stock analysis link', async () => {
  const results = await handleEvents(createEvents(['2330']));
  const replies = results.map(({ messages }) => messages.map(({ text }) => text));
  expect(replies).toEqual([
    ['股票分析連結\nhttp://localhost:3000/stock/2330\n僅供研究參考，非投資建議。'],
  ]);
});

test('renders stock analysis dashboard', () => {
  const analysis = {
    stock: {
      code: '2330',
      name: '台積電',
      marketLabel: '上市',
      date: '2026-06-09',
      close: 2305,
      change: 10,
      volume: 38847544,
    },
    years: ['2025', '2024', '2023'],
    metrics: {
      2025: {
        revenue: 38091,
        netIncome: 17179,
        eps: 66.26,
        grossMargin: 59.9,
        operatingMargin: 50.8,
        netMargin: 45.1,
        roe: 31.5,
        operatingCashFlow: 25000,
      },
      2024: { revenue: 28943, netIncome: 11733, netMargin: 40.5 },
      2023: { revenue: 21617, netIncome: 8385, netMargin: 38.8 },
    },
    fetchedAt: '2026-06-10T12:00:00.000Z',
    sources: {
      quote: 'https://example.com/quote',
      income: 'https://example.com/income',
      balance: 'https://example.com/balance',
      cashFlow: 'https://example.com/cash-flow',
      mopsListed: 'https://example.com/mops-listed',
      mopsOtc: 'https://example.com/mops-otc',
    },
  };
  const html = renderStockAnalysis(analysis);
  expect(html).toContain('台積電 (2330)');
  expect(html).toContain('經營分析');
  expect(html).toContain('僅供研究參考');
  expect(html).toContain('revenueChart');
});
