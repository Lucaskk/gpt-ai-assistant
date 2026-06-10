import express from 'express';
import { handleEvents, printPrompts } from '../app/index.js';
import config from '../config/index.js';
import { validateLineSignature } from '../middleware/index.js';
import storage from '../storage/index.js';
import { getStockAnalysis } from '../services/stock.js';
import { renderStockAnalysis, renderStockError } from '../app/views/stock.js';
import { fetchVersion, getVersion } from '../utils/index.js';

const app = express();

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
    const analysis = await getStockAnalysis(req.params.query);
    res.set('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=86400');
    res.status(200).send(renderStockAnalysis(analysis));
  } catch (err) {
    console.error(err.message);
    res.status(503).send(renderStockError(err.message));
  }
});

app.post(config.APP_WEBHOOK_PATH, validateLineSignature, async (req, res) => {
  try {
    await storage.initialize();
    await handleEvents(req.body.events);
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
