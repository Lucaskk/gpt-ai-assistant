import express from 'express';
import { handleEvents, printPrompts } from '../app/index.js';
import config from '../config/index.js';
import { validateLineSignature } from '../middleware/index.js';
import storage from '../storage/index.js';
import { queueStockAnalysis, stockAnalysisUrl } from '../services/stock-requests.js';
import { resolveStock } from '../services/stock.js';
import { isNewsCommand, queueNewsCommand } from '../services/news-requests.js';
import { isSourceCommand, queueSourceCommand } from '../services/source-requests.js';
import { fetchVersion, getVersion } from '../utils/index.js';

const app = express();

app.get('/news-command-capability', (req, res) => {
  res.json({ version: '2026-09-14', command: '重新產出',
    queueConfigured: Boolean(config.STOCK_REQUEST_GITHUB_TOKEN), mode: 'diagnose-only' });
});

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  },
}));

app.get('/', (req, res) => {
  if (config.APP_URL) {
    res.redirect(config.APP_URL);
    return;
  }
  res.sendStatus(200);
});

app.get('/info', async (req, res) => {
  const currentVersion = getVersion();
  const latestVersion = await fetchVersion();
  res.status(200).send({ currentVersion, latestVersion });
});

app.get('/stock/:query', async (req, res) => {
  try {
    const stock = await resolveStock(req.params.query);
    const requestedAt = await queueStockAnalysis(stock);
    res.redirect(302, stockAnalysisUrl(stock, requestedAt || ''));
  } catch (err) {
    console.error(err.message);
    res.status(404).send(err.message);
  }
});

app.post(config.APP_WEBHOOK_PATH, validateLineSignature, async (req, res) => {
  try {
    const remaining = [];
    for (const event of req.body.events || []) {
      if (isNewsCommand(event)) await queueNewsCommand(event, config.STOCK_REQUEST_GITHUB_TOKEN);
      else if (isSourceCommand(event)) await queueSourceCommand(event, config.STOCK_REQUEST_GITHUB_TOKEN);
      else remaining.push(event);
    }
    if (!remaining.length) { res.sendStatus(200); return; }
    await storage.initialize();
    await handleEvents(remaining);
    res.sendStatus(200);
  } catch (err) {
    console.error(err.message);
    if (err.config?.baseURL) console.error(`${err.config.method.toUpperCase()} ${err.config.baseURL}${err.config.url}`);
    if (err.response?.data) console.error(err.response.data);
    res.sendStatus(500);
  }
  if (config.APP_DEBUG) printPrompts();
});

if (config.APP_PORT) {
  app.listen(config.APP_PORT);
}

export default app;
