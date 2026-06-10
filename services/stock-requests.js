import axios from 'axios';
import config from '../config/index.js';

const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');

const stockAnalysisUrl = (stock) => {
  const base = config.STOCK_ANALYSIS_BASE_URL
    || 'https://lucaskk.github.io/daily-news/wiki/stocks/pending.html';
  const url = new URL(base);
  url.searchParams.set('code', stock.code);
  if (stock.name) url.searchParams.set('name', stock.name);
  return url.toString();
};

const githubHeaders = () => ({
  Authorization: `Bearer ${config.STOCK_REQUEST_GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

const queueStockAnalysis = async (stock) => {
  if (!config.STOCK_REQUEST_GITHUB_TOKEN) return false;
  const path = `${config.STOCK_REQUEST_QUEUE_PATH.replace(/\/$/, '')}/${stock.code}.json`;
  const endpoint = `https://api.github.com/repos/${config.STOCK_REQUEST_REPOSITORY}/contents/${encodePath(path)}`;
  try {
    await axios.get(endpoint, {
      headers: githubHeaders(),
      params: { ref: config.STOCK_REQUEST_BRANCH },
      timeout: 8000,
    });
    return true;
  } catch (error) {
    if (error.response?.status !== 404) throw error;
  }

  const request = {
    code: stock.code,
    name: stock.name || '',
    requested_at: new Date().toISOString(),
    source: 'line-webhook',
  };
  await axios.put(endpoint, {
    message: `Queue stock analysis ${stock.code}`,
    content: Buffer.from(`${JSON.stringify(request, null, 2)}\n`).toString('base64'),
    branch: config.STOCK_REQUEST_BRANCH,
  }, {
    headers: githubHeaders(),
    timeout: 8000,
  });
  return true;
};

export {
  queueStockAnalysis,
  stockAnalysisUrl,
};
