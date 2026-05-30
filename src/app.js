import { analyzeTrades, formatDate, rowsToTrades, summarizeClosedTrades } from "./analyzer.js";

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const PERCENT = new Intl.NumberFormat("en-IN", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

const state = {
  charts: {},
  allGroupedTrades: [],
  allOpenPositions: [],
  displayTrades: [],
  displayOpenPositions: [],
  sort: { key: "sellDate", direction: "desc" },
  openSort: { key: "costBasis", direction: "desc" },
  tickerFilter: ""
};

const elements = {
  fileInput: document.querySelector("#fileInput"),
  fileName: document.querySelector("#fileName"),
  status: document.querySelector("#status"),
  metrics: document.querySelector("#metrics"),
  warnings: document.querySelector("#warnings"),
  coachHeadline: document.querySelector("#coachHeadline"),
  coachList: document.querySelector("#coachList"),
  tableBody: document.querySelector("#closedTradesBody"),
  tableCount: document.querySelector("#tableCount"),
  openTableBody: document.querySelector("#openLotsBody"),
  openTableCount: document.querySelector("#openLotsCount"),
  openLotsPanel: document.querySelector("#openLotsPanel"),
  tickerSearch: document.querySelector("#tickerSearch"),
  tickerOptions: document.querySelector("#tickerOptions"),
  clearTicker: document.querySelector("#clearTicker"),
  downloadClosedCsv: document.querySelector("#downloadClosedCsv"),
  filterSummary: document.querySelector("#filterSummary"),
  emptyState: document.querySelector("#emptyState"),
  dashboard: document.querySelector("#dashboard")
};

document.body.dataset.appReady = "true";

elements.fileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  await handleFile(file);
});

document.querySelectorAll("[data-sort]").forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.sort;
    if (state.sort.key === key) {
      state.sort.direction = state.sort.direction === "asc" ? "desc" : "asc";
    } else {
      state.sort = { key, direction: "asc" };
    }
    renderTable();
  });
});

document.querySelectorAll("[data-open-sort]").forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.openSort;
    if (state.openSort.key === key) {
      state.openSort.direction = state.openSort.direction === "asc" ? "desc" : "asc";
    } else {
      state.openSort = { key, direction: "asc" };
    }
    renderOpenPositionsTable();
  });
});

elements.tickerSearch.addEventListener("input", () => {
  state.tickerFilter = elements.tickerSearch.value.trim().toUpperCase();
  applyTickerFilter();
});

elements.clearTicker.addEventListener("click", () => {
  elements.tickerSearch.value = "";
  state.tickerFilter = "";
  applyTickerFilter();
});

elements.downloadClosedCsv.addEventListener("click", () => {
  downloadClosedTradesCsv();
});

async function handleFile(file) {
  try {
    setStatus("Reading workbook...");
    elements.fileName.textContent = file.name;
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, {
      header: 1,
      defval: "",
      raw: false
    });
    analyzeRows(rows);
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Could not parse this workbook.", true);
  }
}

function analyzeRows(rows) {
  const trades = rowsToTrades(rows);
  const analysis = analyzeTrades(trades);
  state.allGroupedTrades = analysis.groupedClosedTrades;
  state.allOpenPositions = analysis.groupedOpenPositions;
  state.displayTrades = analysis.groupedClosedTrades;
  state.displayOpenPositions = analysis.groupedOpenPositions;
  state.analysis = analysis;
  state.tickerFilter = "";
  state.sort = { key: "sellDate", direction: "desc" };
  state.openSort = { key: "costBasis", direction: "desc" };
  elements.tickerSearch.value = "";
  renderAnalysis(analysis);
  setStatus(`Parsed ${analysis.inputCount} trade rows, matched ${analysis.closedTrades.length} FIFO lots, grouped them into ${analysis.groupedClosedTrades.length} date-level trades, and found ${analysis.groupedOpenPositions.length} open position lots.`);
  return analysis;
}

function renderAnalysis(analysis) {
  elements.emptyState.hidden = true;
  elements.dashboard.hidden = false;
  renderTickerOptions([...analysis.groupedClosedTrades, ...analysis.groupedOpenPositions]);
  renderMetrics(analysis.metrics);
  renderWarnings(analysis.warnings);
  renderCharts(analysis.series);
  renderCoach(analysis.insights);
  renderTable();
  renderOpenPositionsTable();
}

function applyTickerFilter() {
  const query = state.tickerFilter;
  state.displayTrades = query
    ? state.allGroupedTrades.filter((trade) => trade.symbol.includes(query))
    : state.allGroupedTrades;
  state.displayOpenPositions = query
    ? state.allOpenPositions.filter((position) => position.symbol.includes(query))
    : state.allOpenPositions;

  const summary = summarizeClosedTrades(state.displayTrades);
  renderMetrics(summary.metrics);
  renderCharts(summary.series);
  renderCoach(summary.insights);
  renderFilterSummary();
  renderTable();
  renderOpenPositionsTable();
}

function renderTickerOptions(items) {
  const tickers = [...new Set(items.map((item) => item.symbol))].sort();
  elements.tickerOptions.innerHTML = tickers
    .map((ticker) => `<option value="${escapeHtml(ticker)}"></option>`)
    .join("");
  renderFilterSummary();
}

function renderFilterSummary() {
  const query = state.tickerFilter;
  const shown = state.displayTrades.length;
  const total = state.allGroupedTrades.length;
  const shownOpen = state.displayOpenPositions.length;
  const totalOpen = state.allOpenPositions.length;
  elements.filterSummary.textContent = query
    ? `${shown} of ${total} grouped closed trades and ${shownOpen} of ${totalOpen} open lots match "${query}"`
    : `${total} grouped closed trades and ${totalOpen} open lots`;
  elements.clearTicker.disabled = !query;
}

function renderMetrics(metrics) {
  const metricCards = [
    {
      label: "Total Net P/L",
      value: INR.format(metrics.netProfit),
      delta: PERCENT.format(metrics.netProfitPct),
      tone: metrics.netProfit >= 0 ? "positive" : "negative"
    },
    {
      label: "Win Rate",
      value: PERCENT.format(metrics.winRate),
      delta: `${metrics.totalClosedTrades} closed trades`
    },
    {
      label: "Profit Factor",
      value: Number.isFinite(metrics.profitFactor) ? metrics.profitFactor.toFixed(2) : "∞",
      delta: `${INR.format(metrics.grossProfit)} / ${INR.format(metrics.grossLoss)}`
    },
    {
      label: "Avg Win / Avg Loss",
      value: Number.isFinite(metrics.riskReward) ? `${metrics.riskReward.toFixed(2)}x` : "∞",
      delta: `${INR.format(metrics.averageWin)} vs ${INR.format(metrics.averageLoss)}`
    },
    {
      label: "Maximum Drawdown",
      value: INR.format(metrics.maxDrawdown),
      delta: PERCENT.format(metrics.maxDrawdownPct),
      tone: metrics.maxDrawdown > 0 ? "negative" : "neutral"
    },
    {
      label: "Avg Holding Time",
      value: `${metrics.averageHoldingDays.toFixed(1)} days`,
      delta: "Grouped date-level trades"
    }
  ];

  elements.metrics.innerHTML = metricCards
    .map((card) => {
      return `
        <article class="metric-card ${card.tone || ""}">
          <span>${card.label}</span>
          <strong>${card.value}</strong>
          <small>${card.delta}</small>
        </article>
      `;
    })
    .join("");
}

function renderWarnings(warnings) {
  elements.warnings.innerHTML = warnings
    .map((warning) => `<li>${escapeHtml(warning)}</li>`)
    .join("");
  elements.warnings.hidden = warnings.length === 0;
}

function renderCharts(series) {
  destroyCharts();
  if (typeof Chart === "undefined") {
    renderNativeCharts(series);
    return;
  }

  const equityLabels = series.equity.map((point) => point.date);
  const equityData = series.equity.map((point) => point.value);
  const tickerData = series.tickerPnL.slice(0, 12);

  state.charts.equity = new Chart(document.querySelector("#equityChart"), {
    type: "line",
    data: {
      labels: equityLabels,
      datasets: [{
        label: "Cumulative P/L",
        data: equityData,
        borderColor: "#166534",
        backgroundColor: "rgba(22, 101, 52, 0.12)",
        tension: 0.25,
        fill: true,
        pointRadius: 3
      }]
    },
    options: baseChartOptions({ yCurrency: true })
  });

  state.charts.ticker = new Chart(document.querySelector("#tickerChart"), {
    type: "bar",
    data: {
      labels: tickerData.map((item) => item.symbol),
      datasets: [{
        label: "Net P/L",
        data: tickerData.map((item) => item.pnl),
        backgroundColor: tickerData.map((item) => item.pnl >= 0 ? "#15803d" : "#b91c1c")
      }]
    },
    options: baseChartOptions({ yCurrency: true })
  });

  state.charts.histogram = new Chart(document.querySelector("#histogramChart"), {
    type: "bar",
    data: {
      labels: series.histogram.map((bucket) => bucket.label),
      datasets: [{
        label: "Closed trades",
        data: series.histogram.map((bucket) => bucket.count),
        backgroundColor: "#2563eb"
      }]
    },
    options: baseChartOptions()
  });
}

function renderCoach(insights) {
  elements.coachHeadline.textContent = insights.headline;
  elements.coachList.innerHTML = insights.bullets
    .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
    .join("");
}

function renderTable() {
  const sorted = [...state.displayTrades].sort((a, b) => compareTrade(a, b, state.sort));
  elements.tableCount.textContent = `${sorted.length} grouped trade${sorted.length === 1 ? "" : "s"}`;
  elements.downloadClosedCsv.disabled = sorted.length === 0;
  elements.tableBody.innerHTML = sorted
    .map((trade) => {
      const pnlClass = trade.netProfit >= 0 ? "positive-text" : "negative-text";
      return `
        <tr>
          <td>${escapeHtml(trade.symbol)}</td>
          <td>${formatDate(trade.buyDate)}</td>
          <td>${formatDate(trade.sellDate)}</td>
          <td class="numeric">${trade.quantity.toFixed(2)}</td>
          <td class="numeric">${INR.format(trade.buyPrice)}</td>
          <td class="numeric">${INR.format(trade.sellPrice)}</td>
          <td class="numeric">${trade.holdDays.toFixed(1)}</td>
          <td class="numeric">${PERCENT.format(trade.roi)}</td>
          <td class="numeric ${pnlClass}">${INR.format(trade.netProfit)}</td>
        </tr>
      `;
    })
    .join("");
}

function downloadClosedTradesCsv() {
  const rows = [...state.displayTrades].sort((a, b) => compareTrade(a, b, state.sort));
  if (!rows.length) return;

  const headers = [
    "Ticker",
    "Buy Date",
    "Sell Date",
    "Quantity",
    "Average Buy Price",
    "Average Sell Price",
    "Hold Days",
    "ROI %",
    "Net Profit",
    "Cost Basis",
    "Proceeds"
  ];
  const csvRows = rows.map((trade) => [
    trade.symbol,
    formatDate(trade.buyDate),
    formatDate(trade.sellDate),
    trade.quantity.toFixed(2),
    trade.buyPrice.toFixed(2),
    trade.sellPrice.toFixed(2),
    trade.holdDays.toFixed(1),
    (trade.roi * 100).toFixed(2),
    trade.netProfit.toFixed(2),
    trade.costBasis.toFixed(2),
    trade.proceeds.toFixed(2)
  ]);
  const csv = [headers, ...csvRows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const tickerPart = state.tickerFilter ? `-${state.tickerFilter}` : "";
  link.href = url;
  link.download = `closed-fifo-round-trips${tickerPart}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderOpenPositionsTable() {
  const sorted = [...state.displayOpenPositions].sort((a, b) => compareTrade(a, b, state.openSort));
  const totalCost = sorted.reduce((total, position) => total + position.costBasis, 0);
  const totalQty = sorted.reduce((total, position) => total + position.quantity, 0);
  elements.openLotsPanel.hidden = state.allOpenPositions.length === 0;
  elements.openTableCount.textContent = `${sorted.length} open lot${sorted.length === 1 ? "" : "s"} • ${totalQty.toFixed(2)} shares • ${INR.format(totalCost)} cost`;
  elements.openTableBody.innerHTML = sorted
    .map((position) => {
      return `
        <tr>
          <td>${escapeHtml(position.symbol)}</td>
          <td>${formatDate(position.buyDate)}</td>
          <td class="numeric">${position.quantity.toFixed(2)}</td>
          <td class="numeric">${INR.format(position.averageBuyPrice)}</td>
          <td class="numeric">${INR.format(position.costBasis)}</td>
          <td class="numeric">${position.ageDays.toFixed(1)}</td>
        </tr>
      `;
    })
    .join("");
}

function compareTrade(a, b, sort) {
  const direction = sort.direction === "asc" ? 1 : -1;
  const aValue = a[sort.key];
  const bValue = b[sort.key];
  if (aValue instanceof Date && bValue instanceof Date) {
    return (aValue.valueOf() - bValue.valueOf()) * direction;
  }
  if (typeof aValue === "number" && typeof bValue === "number") {
    return (aValue - bValue) * direction;
  }
  return String(aValue).localeCompare(String(bValue)) * direction;
}

function baseChartOptions({ yCurrency = false } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            return yCurrency ? INR.format(value) : value;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: { maxRotation: 0, autoSkip: true },
        grid: { display: false }
      },
      y: {
        ticks: {
          callback: (value) => yCurrency ? INR.format(value) : value
        },
        grid: { color: "rgba(15, 23, 42, 0.08)" }
      }
    }
  };
}

function destroyCharts() {
  Object.values(state.charts).forEach((chart) => chart.destroy?.());
  state.charts = {};
}

function renderNativeCharts(series) {
  const equityCanvas = document.querySelector("#equityChart");
  const tickerCanvas = document.querySelector("#tickerChart");
  const histogramCanvas = document.querySelector("#histogramChart");

  drawLineChart(equityCanvas, series.equity.map((point) => point.value));
  drawBarChart(tickerCanvas, series.tickerPnL.slice(0, 12).map((item) => ({
    label: item.symbol,
    value: item.pnl,
    color: item.pnl >= 0 ? "#15803d" : "#b91c1c"
  })));
  drawBarChart(histogramCanvas, series.histogram.map((bucket) => ({
    label: bucket.label,
    value: bucket.count,
    color: "#2563eb"
  })), { integerAxis: true });

  state.charts.native = {
    destroy() {
      [equityCanvas, tickerCanvas, histogramCanvas].forEach(clearCanvas);
    }
  };
}

function prepareCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width: rect.width, height: rect.height };
}

function clearCanvas(canvas) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
}

function drawLineChart(canvas, values) {
  const { context, width, height } = prepareCanvas(canvas);
  const pad = { top: 18, right: 18, bottom: 28, left: 56 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  drawAxes(context, pad, width, height);
  if (!values.length || min === max) return;

  context.beginPath();
  values.forEach((value, index) => {
    const x = pad.left + (values.length === 1 ? 0 : (index / (values.length - 1)) * plotWidth);
    const y = pad.top + plotHeight - ((value - min) / (max - min)) * plotHeight;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.lineWidth = 2.5;
  context.strokeStyle = "#166534";
  context.stroke();
}

function drawBarChart(canvas, bars) {
  const { context, width, height } = prepareCanvas(canvas);
  const pad = { top: 18, right: 18, bottom: 48, left: 56 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const values = bars.map((bar) => bar.value);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  drawAxes(context, pad, width, height);
  if (!bars.length || min === max) return;

  const zeroY = pad.top + plotHeight - ((0 - min) / (max - min)) * plotHeight;
  const gap = 6;
  const barWidth = Math.max(6, (plotWidth - gap * (bars.length - 1)) / bars.length);

  bars.forEach((bar, index) => {
    const x = pad.left + index * (barWidth + gap);
    const y = pad.top + plotHeight - ((bar.value - min) / (max - min)) * plotHeight;
    context.fillStyle = bar.color;
    context.fillRect(x, Math.min(y, zeroY), barWidth, Math.max(1, Math.abs(zeroY - y)));
  });
}

function drawAxes(context, pad, width, height) {
  context.clearRect(0, 0, width, height);
  context.strokeStyle = "rgba(15, 23, 42, 0.16)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(pad.left, pad.top);
  context.lineTo(pad.left, height - pad.bottom);
  context.lineTo(width - pad.right, height - pad.bottom);
  context.stroke();
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
