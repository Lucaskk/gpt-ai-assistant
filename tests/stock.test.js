import { expect, test } from '@jest/globals';
import { handleEvents } from '../app/index.js';
import { parseStockRequest } from '../app/handlers/stock.js';
import { stockAnalysisUrl } from '../services/stock-requests.js';
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
    ['2330 股票分析連結\nhttps://lucaskk.github.io/daily-news/wiki/stocks/pending.html?code=2330\n通常 15 分鐘內更新；僅供研究參考。'],
  ]);
});

test('builds the GitHub Pages waiting link', () => {
  expect(stockAnalysisUrl({ code: '2330', name: '台積電' })).toBe(
    'https://lucaskk.github.io/daily-news/wiki/stocks/pending.html?code=2330&name=%E5%8F%B0%E7%A9%8D%E9%9B%BB',
  );
  expect(stockAnalysisUrl({ code: '2344', name: '華邦電' }, '2026-06-13T01:49:00.000Z')).toBe(
    'https://lucaskk.github.io/daily-news/wiki/stocks/pending.html?code=2344&name=%E8%8F%AF%E9%82%A6%E9%9B%BB&requested_at=2026-06-13T01%3A49%3A00.000Z',
  );
});
