const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const safeJson = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');

const formatNumber = (value, digits = 1, suffix = '') => {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  return `${value.toLocaleString('zh-TW', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}${suffix}`;
};

const yearGrowth = (latest, previous) => {
  if (latest === null || previous === null || previous === 0) return null;
  return ((latest - previous) / Math.abs(previous)) * 100;
};

const formatGrowth = (value) => {
  if (value === null || value === undefined) return '缺少前期比較';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
};

const card = (label, value, note, accent = 'blue') => `
  <article class="metric ${accent}">
    <div class="metric-label">${escapeHtml(label)}</div>
    <div class="metric-value">${escapeHtml(value)}</div>
    <div class="metric-note">${escapeHtml(note)}</div>
  </article>`;

const insightList = (title, items) => `
  <section class="insights">
    <h3>${escapeHtml(title)}</h3>
    <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
  </section>`;

const table = (metrics, years, rows) => `
  <div class="table-wrap">
    <table>
      <thead><tr><th>指標</th>${years.map((year) => `<th>${year}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.map(([label, key, digits, suffix]) => `
          <tr><td>${escapeHtml(label)}</td>${years.map((year) => `<td>${escapeHtml(formatNumber(metrics[year]?.[key], digits, suffix))}</td>`).join('')}</tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;

const renderStockAnalysis = (analysis) => {
  const {
    stock, years, metrics, fetchedAt, sources,
  } = analysis;
  const latestYear = years[0];
  const previousYear = years[1];
  const latest = metrics[latestYear] || {};
  const previous = metrics[previousYear] || {};
  const revenueGrowth = yearGrowth(latest.revenue, previous.revenue);
  const profitGrowth = yearGrowth(latest.netIncome, previous.netIncome);
  const cashFlowGrowth = yearGrowth(latest.operatingCashFlow, previous.operatingCashFlow);
  const marginChange = latest.netMargin !== null && previous.netMargin !== null
    ? latest.netMargin - previous.netMargin
    : null;
  const chartPayload = safeJson({ years: [...years].reverse(), metrics });

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(stock.name)} (${escapeHtml(stock.code)}) 台灣股票財務分析">
  <title>${escapeHtml(stock.name)} (${escapeHtml(stock.code)}) 股票分析</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.0/dist/chart.umd.min.js"></script>
  <style>
    :root {
      --ink: #17202d;
      --muted: #647084;
      --surface: #fff;
      --soft: #f4f6f9;
      --line: #d9e0e9;
      --blue: #2563eb;
      --green: #15803d;
      --orange: #b45309;
      --purple: #6d45a8;
      --red: #b42318;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--soft);
      color: var(--ink);
      font-family: -apple-system, BlinkMacSystemFont, "Noto Sans TC", "Microsoft JhengHei", sans-serif;
      letter-spacing: 0;
    }
    a { color: inherit; }
    .hero {
      min-height: 260px;
      padding: 34px clamp(18px, 5vw, 64px);
      display: flex;
      align-items: end;
      color: white;
      background-color: #17202d;
      background-image: linear-gradient(rgba(16, 24, 38, .76), rgba(16, 24, 38, .88)), url("https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1800&q=80");
      background-size: cover;
      background-position: center;
    }
    .hero-inner { width: min(1160px, 100%); margin: 0 auto; }
    .eyebrow { color: rgba(255,255,255,.72); font-size: 13px; margin-bottom: 8px; }
    h1 { margin: 0; font-size: clamp(34px, 6vw, 62px); line-height: 1.05; }
    .hero-meta { margin-top: 12px; color: rgba(255,255,255,.8); line-height: 1.55; }
    .source-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
    .source-links a {
      padding: 7px 10px;
      border: 1px solid rgba(255,255,255,.3);
      border-radius: 6px;
      text-decoration: none;
      background: rgba(0,0,0,.18);
      font-size: 13px;
    }
    .tabs {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      gap: 6px;
      padding: 10px max(18px, calc((100vw - 1160px) / 2));
      overflow-x: auto;
      background: rgba(244,246,249,.96);
      border-bottom: 1px solid var(--line);
      backdrop-filter: blur(12px);
    }
    .tab {
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      color: var(--muted);
      padding: 10px 14px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }
    .tab.active { background: var(--ink); border-color: var(--ink); color: white; }
    main { width: min(1196px, 100%); margin: 0 auto; padding: 20px 18px 42px; }
    .panel { display: none; }
    .panel.active { display: block; }
    h2 { margin: 6px 0 14px; font-size: 24px; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
    .metric {
      min-height: 116px;
      padding: 16px;
      border: 1px solid var(--line);
      border-top: 4px solid var(--blue);
      border-radius: 7px;
      background: var(--surface);
      box-shadow: 0 1px 3px rgba(15,23,42,.06);
    }
    .metric.green { border-top-color: var(--green); }
    .metric.orange { border-top-color: var(--orange); }
    .metric.purple { border-top-color: var(--purple); }
    .metric-label { color: var(--muted); font-size: 12px; font-weight: 700; }
    .metric-value { margin-top: 7px; font-size: clamp(22px, 3vw, 31px); font-weight: 760; line-height: 1.05; }
    .metric-note { margin-top: 8px; color: var(--muted); font-size: 13px; line-height: 1.4; }
    .insights, .notice, .chart, .table-wrap {
      border: 1px solid var(--line);
      border-radius: 7px;
      background: var(--surface);
      box-shadow: 0 1px 3px rgba(15,23,42,.05);
    }
    .insights { padding: 16px 18px; margin-bottom: 16px; }
    .insights h3 { margin: 0 0 8px; font-size: 15px; }
    .insights ul { margin: 0; padding-left: 20px; color: var(--muted); line-height: 1.7; }
    .notice { padding: 14px 16px; margin-bottom: 16px; color: #14532d; background: #f0fdf4; border-color: #bbf7d0; }
    .charts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-bottom: 16px; }
    .chart { padding: 16px; }
    .chart-title { margin-bottom: 12px; color: #334155; font-weight: 760; }
    .chart-canvas { position: relative; height: 270px; }
    .table-wrap { overflow-x: auto; margin-bottom: 16px; }
    table { width: 100%; min-width: 620px; border-collapse: collapse; font-size: 14px; }
    th { padding: 10px; text-align: right; color: white; background: #263245; }
    th:first-child, td:first-child { text-align: left; }
    td { padding: 10px; text-align: right; border-bottom: 1px solid var(--line); }
    tr:nth-child(even) td { background: #f8fafc; }
    .footer { margin-top: 22px; color: var(--muted); font-size: 13px; line-height: 1.7; }
    @media (max-width: 820px) {
      .metrics, .charts { grid-template-columns: 1fr; }
      .hero { min-height: 230px; }
      .chart-canvas { height: 235px; }
    }
  </style>
</head>
<body>
  <header class="hero">
    <div class="hero-inner">
      <div class="eyebrow">台灣股票財務分析 | 僅供研究參考</div>
      <h1>${escapeHtml(stock.name)} (${escapeHtml(stock.code)})</h1>
      <div class="hero-meta">市場：${escapeHtml(stock.marketLabel)}；行情日期：${escapeHtml(stock.date || 'n/a')}；財報期間：${escapeHtml(years.join(' / '))}</div>
      <div class="source-links">
        <a href="${escapeHtml(sources.quote)}">公開市場行情</a>
        <a href="${escapeHtml(sources.income)}">Goodinfo 損益表</a>
        <a href="${escapeHtml(sources.balance)}">Goodinfo 資產負債表</a>
        <a href="${escapeHtml(sources.cashFlow)}">Goodinfo 現金流量表</a>
        <a href="${escapeHtml(sources.mopsListed)}">MOPS 上市公告</a>
        <a href="${escapeHtml(sources.mopsOtc)}">MOPS 上櫃公告</a>
      </div>
    </div>
  </header>

  <nav class="tabs" aria-label="分析分頁">
    <button class="tab active" type="button" data-panel="summary">總覽</button>
    <button class="tab" type="button" data-panel="operations">經營分析</button>
    <button class="tab" type="button" data-panel="profit">獲利分析</button>
    <button class="tab" type="button" data-panel="finance">財務健全度</button>
  </nav>

  <main>
    <section id="summary" class="panel active">
      <h2>總覽</h2>
      <div class="metrics">
        ${card('最新收盤價', `${formatNumber(stock.close, 2)} 元`, `${stock.date || 'n/a'}；變動 ${formatNumber(stock.change, 2, ' 元')}`, 'blue')}
        ${card('成交量', `${formatNumber(stock.volume, 0)} 股`, `${stock.marketLabel}公開行情`, 'green')}
        ${card(`${latestYear} 年營收`, `${formatNumber(latest.revenue, 0)} 億`, `年增 ${formatGrowth(revenueGrowth)}`, 'orange')}
        ${card(`${latestYear} 年 EPS`, `${formatNumber(latest.eps, 2)} 元`, `ROE ${formatNumber(latest.roe, 1, '%')}`, 'purple')}
      </div>
      ${insightList('分析摘要', [
    `${latestYear} 年營收 ${formatNumber(latest.revenue, 0)} 億元，較 ${previousYear} 年 ${formatGrowth(revenueGrowth)}。`,
    `${latestYear} 年稅後淨利 ${formatNumber(latest.netIncome, 0)} 億元，年增 ${formatGrowth(profitGrowth)}。`,
    `毛利率 ${formatNumber(latest.grossMargin, 1, '%')}、營業利益率 ${formatNumber(latest.operatingMargin, 1, '%')}、淨利率 ${formatNumber(latest.netMargin, 1, '%')}。`,
  ])}
      <div class="notice">本頁由公開資料自動整理，請以公司公告及公開資訊觀測站核對；內容不構成買賣建議。</div>
    </section>

    <section id="operations" class="panel">
      <h2>經營分析</h2>
      <div class="metrics">
        ${card('營收', `${formatNumber(latest.revenue, 0)} 億`, `年增 ${formatGrowth(revenueGrowth)}`, 'blue')}
        ${card('毛利率', formatNumber(latest.grossMargin, 1, '%'), `前期 ${formatNumber(previous.grossMargin, 1, '%')}`, 'green')}
        ${card('營業利益率', formatNumber(latest.operatingMargin, 1, '%'), `前期 ${formatNumber(previous.operatingMargin, 1, '%')}`, 'orange')}
        ${card('營業費用率', formatNumber(latest.operatingExpenseRatio, 1, '%'), '推銷、管理與研發合計', 'purple')}
      </div>
      <div class="charts">
        <article class="chart"><div class="chart-title">營收與毛利率</div><div class="chart-canvas"><canvas id="revenueChart"></canvas></div></article>
        <article class="chart"><div class="chart-title">三費結構</div><div class="chart-canvas"><canvas id="expenseChart"></canvas></div></article>
        <article class="chart"><div class="chart-title">三層利潤率</div><div class="chart-canvas"><canvas id="marginChart"></canvas></div></article>
        <article class="chart"><div class="chart-title">營業利益</div><div class="chart-canvas"><canvas id="operatingChart"></canvas></div></article>
      </div>
      ${table(metrics, years, [
    ['營收（億元）', 'revenue', 0, ''],
    ['毛利率', 'grossMargin', 1, '%'],
    ['營業利益（億元）', 'operatingIncome', 0, ''],
    ['營業利益率', 'operatingMargin', 1, '%'],
    ['營業費用率', 'operatingExpenseRatio', 1, '%'],
  ])}
    </section>

    <section id="profit" class="panel">
      <h2>獲利分析</h2>
      <div class="metrics">
        ${card('稅後淨利', `${formatNumber(latest.netIncome, 0)} 億`, `年增 ${formatGrowth(profitGrowth)}`, 'green')}
        ${card('EPS', `${formatNumber(latest.eps, 2)} 元`, `${latestYear} 年`, 'blue')}
        ${card('ROE', formatNumber(latest.roe, 1, '%'), '股東權益報酬率', 'purple')}
        ${card('淨利率', formatNumber(latest.netMargin, 1, '%'), `較前期 ${marginChange === null ? 'n/a' : `${marginChange > 0 ? '+' : ''}${marginChange.toFixed(1)} 個百分點`}`, 'orange')}
      </div>
      <div class="charts">
        <article class="chart"><div class="chart-title">稅後淨利與淨利率</div><div class="chart-canvas"><canvas id="profitChart"></canvas></div></article>
        <article class="chart"><div class="chart-title">EPS 趨勢</div><div class="chart-canvas"><canvas id="epsChart"></canvas></div></article>
        <article class="chart"><div class="chart-title">ROE 與 ROA</div><div class="chart-canvas"><canvas id="returnChart"></canvas></div></article>
        <article class="chart"><div class="chart-title">現金股利</div><div class="chart-canvas"><canvas id="dividendChart"></canvas></div></article>
      </div>
      ${table(metrics, years, [
    ['稅後淨利（億元）', 'netIncome', 0, ''],
    ['EPS（元）', 'eps', 2, ''],
    ['淨利率', 'netMargin', 1, '%'],
    ['ROE', 'roe', 1, '%'],
    ['ROA', 'roa', 1, '%'],
    ['現金股利（億元）', 'dividends', 0, ''],
  ])}
    </section>

    <section id="finance" class="panel">
      <h2>財務健全度</h2>
      <div class="metrics">
        ${card('流動比率', formatNumber(latest.currentRatio, 1, '%'), '短期償債能力', 'blue')}
        ${card('負債比率', formatNumber(latest.debtRatio, 1, '%'), '總負債 / 總資產', 'orange')}
        ${card('營業現金流', `${formatNumber(latest.operatingCashFlow, 0)} 億`, `年增 ${formatGrowth(cashFlowGrowth)}`, 'green')}
        ${card('自由現金流', `${formatNumber(latest.freeCashFlow, 0)} 億`, '營業現金流加固定資產增減', 'purple')}
      </div>
      <div class="charts">
        <article class="chart"><div class="chart-title">負債與權益結構</div><div class="chart-canvas"><canvas id="structureChart"></canvas></div></article>
        <article class="chart"><div class="chart-title">現金流量三表</div><div class="chart-canvas"><canvas id="cashFlowChart"></canvas></div></article>
        <article class="chart"><div class="chart-title">流動比率與負債比率</div><div class="chart-canvas"><canvas id="ratioChart"></canvas></div></article>
        <article class="chart"><div class="chart-title">現金與自由現金流</div><div class="chart-canvas"><canvas id="cashChart"></canvas></div></article>
      </div>
      ${table(metrics, years, [
    ['現金及約當現金（億元）', 'cash', 0, ''],
    ['存貨（億元）', 'inventory', 0, ''],
    ['資產總額（億元）', 'assets', 0, ''],
    ['負債總額（億元）', 'liabilities', 0, ''],
    ['股東權益（億元）', 'equity', 0, ''],
    ['流動比率', 'currentRatio', 1, '%'],
    ['負債比率', 'debtRatio', 1, '%'],
    ['營業現金流（億元）', 'operatingCashFlow', 0, ''],
    ['自由現金流（億元）', 'freeCashFlow', 0, ''],
  ])}
    </section>

    <footer class="footer">
      更新時間：${escapeHtml(fetchedAt)}。資料來源：TWSE、TPEx、Goodinfo.tw 與公開資訊觀測站。
      金額單位若未特別標示均為新台幣億元。本分析僅供財務研究與學習參考，不構成投資建議。
    </footer>
  </main>

  <script>
    const analysis = ${chartPayload};
    const labels = analysis.years;
    const values = key => labels.map(year => analysis.metrics[year]?.[key] ?? null);
    const colors = { blue: '#2563eb', green: '#15803d', orange: '#b45309', purple: '#6d45a8' };
    document.querySelectorAll('.tab').forEach(button => {
      button.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(item => item.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        document.getElementById(button.dataset.panel).classList.add('active');
      });
    });
    const moneyAxis = { ticks: { callback: value => value.toLocaleString() } };
    const percentAxis = { position: 'right', grid: { display: false }, ticks: { callback: value => value + '%' } };
    const bar = (label, key, color, axis = 'y') => ({ label, data: values(key), backgroundColor: color + '33', borderColor: color, borderWidth: 2, yAxisID: axis });
    const line = (label, key, color, axis = 'y2') => ({ label, data: values(key), type: 'line', borderColor: color, backgroundColor: color, pointRadius: 4, tension: .25, yAxisID: axis });
    const create = (id, datasets, options = {}) => {
      const element = document.getElementById(id);
      if (!element || typeof Chart === 'undefined') return;
      new Chart(element, {
        type: 'bar',
        data: { labels, datasets },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, ...options },
      });
    };
    const mixed = { scales: { x: { grid: { display: false } }, y: moneyAxis, y2: percentAxis } };
    create('revenueChart', [bar('營收', 'revenue', colors.blue), line('毛利率', 'grossMargin', colors.green)], mixed);
    create('expenseChart', [bar('推銷', 'sellingExpense', colors.orange), bar('管理', 'adminExpense', colors.purple), bar('研發', 'rdExpense', colors.green)], { scales: { x: { stacked: true, grid: { display: false } }, y: { ...moneyAxis, stacked: true } } });
    create('marginChart', [line('毛利率', 'grossMargin', colors.green, 'y'), line('營益率', 'operatingMargin', colors.blue, 'y'), line('淨利率', 'netMargin', colors.orange, 'y')], { scales: { x: { grid: { display: false } }, y: { ticks: { callback: value => value + '%' } } } });
    create('operatingChart', [bar('營業利益', 'operatingIncome', colors.blue), line('營益率', 'operatingMargin', colors.orange)], mixed);
    create('profitChart', [bar('稅後淨利', 'netIncome', colors.green), line('淨利率', 'netMargin', colors.orange)], mixed);
    create('epsChart', [line('EPS', 'eps', colors.blue, 'y')], { scales: { x: { grid: { display: false } }, y: moneyAxis } });
    create('returnChart', [line('ROE', 'roe', colors.purple, 'y'), line('ROA', 'roa', colors.green, 'y')], { scales: { x: { grid: { display: false } }, y: { ticks: { callback: value => value + '%' } } } });
    create('dividendChart', [bar('現金股利', 'dividends', colors.orange)], { scales: { x: { grid: { display: false } }, y: moneyAxis } });
    create('structureChart', [bar('負債', 'liabilities', colors.orange), bar('權益', 'equity', colors.green)], { scales: { x: { stacked: true, grid: { display: false } }, y: { ...moneyAxis, stacked: true } } });
    create('cashFlowChart', [bar('營業 CF', 'operatingCashFlow', colors.green), bar('投資 CF', 'investingCashFlow', colors.orange), bar('融資 CF', 'financingCashFlow', colors.purple)], { scales: { x: { grid: { display: false } }, y: moneyAxis } });
    create('ratioChart', [line('流動比率', 'currentRatio', colors.blue, 'y'), line('負債比率', 'debtRatio', colors.orange, 'y')], { scales: { x: { grid: { display: false } }, y: { ticks: { callback: value => value + '%' } } } });
    create('cashChart', [bar('現金', 'cash', colors.blue), line('自由現金流', 'freeCashFlow', colors.green, 'y')], { scales: { x: { grid: { display: false } }, y: moneyAxis } });
  </script>
</body>
</html>`;
};

const renderStockError = (message) => `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>股票分析暫時無法完成</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f4f6f9; color: #17202d; font-family: -apple-system, BlinkMacSystemFont, "Noto Sans TC", sans-serif; }
    main { width: min(560px, 100%); padding: 24px; border: 1px solid #d9e0e9; border-radius: 7px; background: white; }
    h1 { margin: 0 0 12px; font-size: 24px; }
    p { margin: 0; color: #647084; line-height: 1.7; }
  </style>
</head>
<body><main><h1>股票分析暫時無法完成</h1><p>${escapeHtml(message)}</p></main></body>
</html>`;

export {
  renderStockAnalysis,
  renderStockError,
};
