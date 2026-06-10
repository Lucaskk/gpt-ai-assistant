import config from '../../config/index.js';
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

const stockAnalysisBaseUrl = () => {
  if (config.STOCK_ANALYSIS_BASE_URL) return config.STOCK_ANALYSIS_BASE_URL.replace(/\/$/, '');
  if (config.VERCEL_URL) return `https://${config.VERCEL_URL}`;
  return 'http://localhost:3000';
};

/**
 * @param {Context} context
 * @returns {Promise<Context>|boolean}
 */
const exec = (context) => {
  const query = parseStockRequest(context.trimmedText);
  if (!query) return false;
  const url = `${stockAnalysisBaseUrl()}/stock/${encodeURIComponent(query)}`;
  context.pushText(`股票分析連結\n${url}\n僅供研究參考，非投資建議。`);
  return Promise.resolve(context);
};

export {
  parseStockRequest,
  stockAnalysisBaseUrl,
};

export default exec;
