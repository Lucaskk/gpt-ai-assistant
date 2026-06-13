import { queueStockAnalysis, stockAnalysisUrl } from '../../services/stock-requests.js';
import { resolveStock } from '../../services/stock.js';
import Context from '../context.js';

const parseStockRequest = (text) => {
  const content = String(text || '').replaceAll('　', ' ').trim();
  if (/^\d{4}$/.test(content)) return content;
  const prefix = content.match(/^(?:股票|分析股票|股票分析|stock)\s*[:：]?\s*(.+)$/i);
  if (prefix?.[1]) return prefix[1].trim();
  const suffix = content.match(/^(.+?)\s*(?:股票分析|股票)$/i);
  if (suffix?.[1]) return suffix[1].trim();
  return null;
};

const handleStockRequest = async (context, query) => {
  const stock = /^\d{4}$/.test(query)
    ? { code: query, name: '' }
    : await resolveStock(query);
  let requestedAt = '';
  try {
    requestedAt = await queueStockAnalysis(stock) || '';
  } catch (error) {
    console.error(`Unable to queue stock ${stock.code}: ${error.message}`);
  }
  const label = stock.name ? `${stock.name}(${stock.code})` : `${stock.code} 股票`;
  context.pushText(`${label}分析連結\n${stockAnalysisUrl(stock, requestedAt)}\n通常 15 分鐘內更新；僅供研究參考。`);
  return context;
};

/**
 * @param {Context} context
 * @returns {Promise<Context>|boolean}
 */
const exec = (context) => {
  const query = parseStockRequest(context.trimmedText);
  if (!query) return false;
  return handleStockRequest(context, query);
};

export {
  parseStockRequest,
  handleStockRequest,
};

export default exec;
