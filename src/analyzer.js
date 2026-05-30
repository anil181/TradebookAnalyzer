const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function parseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? "").replace(/,/g, "").trim();
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value;

  if (typeof value === "number" && Number.isFinite(value)) {
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + value * MS_PER_DAY);
  }

  const text = String(value ?? "").trim();
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](.*))?$/);
  if (iso) {
    const [, y, m, d, time = "00:00:00"] = iso;
    const date = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${time}`);
    return Number.isNaN(date.valueOf()) ? null : date;
  }

  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[ ,T]+(.*))?$/);
  if (dmy) {
    const [, d, m, yRaw, time = "00:00:00"] = dmy;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    const date = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${time}`);
    return Number.isNaN(date.valueOf()) ? null : date;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

export function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getField(row, aliases) {
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== "") return row[alias];
  }
  return "";
}

export function rowsToTrades(rows) {
  if (!Array.isArray(rows)) {
    throw new Error("Expected a two-dimensional worksheet row array.");
  }

  const headerRowIndex = rows.findIndex((row) => {
    const headers = new Set(row.map(normalizeHeader));
    return headers.has("symbol") && headers.has("tradedate") && headers.has("tradetype");
  });

  if (headerRowIndex === -1) {
    throw new Error("Could not find a tradebook header row with Symbol, Trade Date, and Trade Type.");
  }

  const headers = rows[headerRowIndex].map(normalizeHeader);
  return rows
    .slice(headerRowIndex + 1)
    .map((row, rowOffset) => {
      const record = {};
      headers.forEach((header, index) => {
        if (header) record[header] = row[index];
      });

      const symbol = String(getField(record, ["symbol", "ticker", "scrip"]) ?? "").trim().toUpperCase();
      const tradeType = String(getField(record, ["tradetype", "type", "buysell"]) ?? "").trim().toLowerCase();
      const tradeDate = parseDate(getField(record, ["tradedate", "date"]));
      const executionDate = parseDate(getField(record, ["orderexecutiontime", "executiontime", "time"]));
      const quantity = parseNumber(getField(record, ["quantity", "qty"]));
      const price = parseNumber(getField(record, ["price", "rate"]));

      return {
        symbol,
        tradeType,
        tradeDate,
        executionDate,
        quantity,
        price,
        tradeId: String(getField(record, ["tradeid"]) ?? ""),
        orderId: String(getField(record, ["orderid"]) ?? ""),
        rowNumber: headerRowIndex + rowOffset + 2
      };
    })
    .filter((trade) => {
      return (
        trade.symbol &&
        ["buy", "sell"].includes(trade.tradeType) &&
        trade.tradeDate &&
        trade.quantity > 0 &&
        trade.price > 0
      );
    });
}

export function analyzeTrades(inputTrades) {
  const trades = [...inputTrades].sort((a, b) => {
    const aTime = (a.executionDate || a.tradeDate).valueOf();
    const bTime = (b.executionDate || b.tradeDate).valueOf();
    if (aTime !== bTime) return aTime - bTime;
    return (a.rowNumber || 0) - (b.rowNumber || 0);
  });

  const openLots = new Map();
  const closedTrades = [];
  const unmatchedSells = [];

  for (const trade of trades) {
    if (!openLots.has(trade.symbol)) openLots.set(trade.symbol, []);
    const lots = openLots.get(trade.symbol);

    if (trade.tradeType === "buy") {
      lots.push({
        symbol: trade.symbol,
        date: trade.tradeDate,
        executionDate: trade.executionDate || trade.tradeDate,
        remaining: trade.quantity,
        price: trade.price,
        rowNumber: trade.rowNumber
      });
      continue;
    }

    let remainingSellQty = trade.quantity;

    while (remainingSellQty > 0 && lots.length > 0) {
      const lot = lots[0];
      const matchedQty = Math.min(remainingSellQty, lot.remaining);
      const buyValue = matchedQty * lot.price;
      const sellValue = matchedQty * trade.price;
      const netProfit = sellValue - buyValue;
      const holdDays = Math.max(0, Math.round(((trade.tradeDate.valueOf() - lot.date.valueOf()) / MS_PER_DAY) * 100) / 100);

      closedTrades.push({
        id: `${trade.symbol}-${closedTrades.length + 1}`,
        symbol: trade.symbol,
        quantity: matchedQty,
        buyDate: lot.date,
        sellDate: trade.tradeDate,
        buyPrice: lot.price,
        sellPrice: trade.price,
        costBasis: buyValue,
        proceeds: sellValue,
        netProfit,
        roi: buyValue ? netProfit / buyValue : 0,
        holdDays
      });

      lot.remaining -= matchedQty;
      remainingSellQty -= matchedQty;
      if (lot.remaining <= 1e-9) lots.shift();
    }

    if (remainingSellQty > 1e-9) {
      unmatchedSells.push({
        symbol: trade.symbol,
        quantity: remainingSellQty,
        date: trade.tradeDate,
        price: trade.price
      });
    }
  }

  const openPositions = [...openLots.values()].flat().filter((lot) => lot.remaining > 1e-9);
  const groupedClosedTrades = groupClosedTradesByDate(closedTrades);
  const groupedOpenPositions = groupOpenPositionsByDate(openPositions, trades.at(-1)?.tradeDate || new Date());
  return {
    closedTrades,
    groupedClosedTrades,
    groupedOpenPositions,
    ...summarizeClosedTrades(groupedClosedTrades),
    warnings: buildWarnings(unmatchedSells, openPositions),
    inputCount: trades.length,
    unmatchedSells,
    openPositions
  };
}

export function groupOpenPositionsByDate(openPositions, asOfDate = new Date()) {
  const groups = new Map();

  for (const lot of openPositions) {
    const key = [lot.symbol, formatDate(lot.date)].join("|");
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        symbol: lot.symbol,
        buyDate: lot.date,
        quantity: 0,
        costBasis: 0,
        sourceLots: 0
      });
    }

    const group = groups.get(key);
    group.quantity += lot.remaining;
    group.costBasis += lot.remaining * lot.price;
    group.sourceLots += 1;
  }

  return [...groups.values()]
    .map((position) => ({
      ...position,
      averageBuyPrice: position.quantity ? position.costBasis / position.quantity : 0,
      ageDays: Math.max(0, Math.round(((asOfDate.valueOf() - position.buyDate.valueOf()) / MS_PER_DAY) * 100) / 100)
    }))
    .sort((a, b) => {
      if (a.symbol !== b.symbol) return a.symbol.localeCompare(b.symbol);
      return a.buyDate - b.buyDate;
    });
}

export function summarizeClosedTrades(closedTrades) {
  return {
    metrics: calculateMetrics(closedTrades),
    series: buildSeries(closedTrades),
    insights: buildInsights(closedTrades)
  };
}

export function groupClosedTradesByDate(closedTrades) {
  const groups = new Map();

  for (const trade of closedTrades) {
    const key = [trade.symbol, formatDate(trade.buyDate), formatDate(trade.sellDate)].join("|");
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        symbol: trade.symbol,
        buyDate: trade.buyDate,
        sellDate: trade.sellDate,
        quantity: 0,
        costBasis: 0,
        proceeds: 0,
        netProfit: 0,
        sourceLots: 0
      });
    }

    const group = groups.get(key);
    group.quantity += trade.quantity;
    group.costBasis += trade.costBasis;
    group.proceeds += trade.proceeds;
    group.netProfit += trade.netProfit;
    group.sourceLots += 1;
  }

  return [...groups.values()]
    .map((trade) => {
      const holdDays = Math.max(0, Math.round(((trade.sellDate.valueOf() - trade.buyDate.valueOf()) / MS_PER_DAY) * 100) / 100);
      return {
        ...trade,
        buyPrice: trade.quantity ? trade.costBasis / trade.quantity : 0,
        sellPrice: trade.quantity ? trade.proceeds / trade.quantity : 0,
        roi: trade.costBasis ? trade.netProfit / trade.costBasis : 0,
        holdDays
      };
    })
    .sort((a, b) => {
      if (a.sellDate.valueOf() !== b.sellDate.valueOf()) return a.sellDate - b.sellDate;
      if (a.buyDate.valueOf() !== b.buyDate.valueOf()) return a.buyDate - b.buyDate;
      return a.symbol.localeCompare(b.symbol);
    });
}

export function calculateMetrics(closedTrades) {
  const totalCost = sum(closedTrades.map((trade) => trade.costBasis));
  const netProfit = sum(closedTrades.map((trade) => trade.netProfit));
  const wins = closedTrades.filter((trade) => trade.netProfit > 0);
  const losses = closedTrades.filter((trade) => trade.netProfit < 0);
  const grossProfit = sum(wins.map((trade) => trade.netProfit));
  const grossLoss = Math.abs(sum(losses.map((trade) => trade.netProfit)));
  const averageWin = wins.length ? grossProfit / wins.length : 0;
  const averageLoss = losses.length ? grossLoss / losses.length : 0;
  const equityPoints = buildEquityPoints(closedTrades);
  const drawdown = calculateMaxDrawdown(equityPoints.map((point) => point.value));

  return {
    totalClosedTrades: closedTrades.length,
    totalCost,
    netProfit,
    netProfitPct: totalCost ? netProfit / totalCost : 0,
    winRate: closedTrades.length ? wins.length / closedTrades.length : 0,
    profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    grossProfit,
    grossLoss,
    averageWin,
    averageLoss,
    riskReward: averageLoss ? averageWin / averageLoss : averageWin > 0 ? Infinity : 0,
    maxDrawdown: drawdown.absolute,
    maxDrawdownPct: drawdown.percent,
    averageHoldingDays: closedTrades.length ? sum(closedTrades.map((trade) => trade.holdDays)) / closedTrades.length : 0
  };
}

function buildSeries(closedTrades) {
  const byTicker = groupBy(closedTrades, (trade) => trade.symbol);
  const tickerPnL = [...byTicker.entries()]
    .map(([symbol, trades]) => ({
      symbol,
      pnl: sum(trades.map((trade) => trade.netProfit)),
      trades: trades.length
    }))
    .sort((a, b) => b.pnl - a.pnl);

  return {
    equity: buildEquityPoints(closedTrades),
    tickerPnL,
    histogram: buildHistogram(closedTrades)
  };
}

function buildEquityPoints(closedTrades) {
  const sorted = [...closedTrades].sort((a, b) => a.sellDate - b.sellDate);
  let cumulative = 0;
  return sorted.map((trade) => {
    cumulative += trade.netProfit;
    return {
      date: formatDate(trade.sellDate),
      value: roundCurrency(cumulative),
      tradeId: trade.id
    };
  });
}

function calculateMaxDrawdown(values) {
  let peak = 0;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;

  for (const value of values) {
    peak = Math.max(peak, value);
    const drawdown = peak - value;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPct = peak > 0 ? drawdown / peak : 0;
    }
  }

  return { absolute: maxDrawdown, percent: maxDrawdownPct };
}

function buildHistogram(closedTrades) {
  if (!closedTrades.length) return [];
  const values = closedTrades.map((trade) => trade.netProfit);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [{ label: formatCurrencyRange(min, max), count: values.length }];
  }

  const bucketCount = Math.min(10, Math.max(5, Math.ceil(Math.sqrt(values.length))));
  const size = (max - min) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const start = min + size * index;
    const end = index === bucketCount - 1 ? max : start + size;
    return { start, end, count: 0 };
  });

  for (const value of values) {
    const index = value === max ? bucketCount - 1 : Math.floor((value - min) / size);
    buckets[index].count += 1;
  }

  return buckets.map((bucket) => ({
    label: formatCurrencyRange(bucket.start, bucket.end),
    count: bucket.count
  }));
}

function buildInsights(closedTrades) {
  if (!closedTrades.length) {
    return {
      headline: "Upload a tradebook with completed FIFO round trips to generate coaching insights.",
      bullets: []
    };
  }

  const byTicker = [...groupBy(closedTrades, (trade) => trade.symbol).entries()]
    .map(([symbol, trades]) => {
      const pnl = sum(trades.map((trade) => trade.netProfit));
      return { symbol, pnl, trades, profitFactor: calculateMetrics(trades).profitFactor };
    })
    .sort((a, b) => b.pnl - a.pnl);

  const bestTicker = byTicker[0];
  const worstTicker = byTicker[byTicker.length - 1];
  const shortHolds = closedTrades.filter((trade) => trade.holdDays <= 5);
  const longHolds = closedTrades.filter((trade) => trade.holdDays > 5);
  const shortAvg = shortHolds.length ? sum(shortHolds.map((trade) => trade.netProfit)) / shortHolds.length : 0;
  const longAvg = longHolds.length ? sum(longHolds.map((trade) => trade.netProfit)) / longHolds.length : 0;
  const metrics = calculateMetrics(closedTrades);
  const bullets = [];

  if (byTicker.length === 1) {
    const ticker = bestTicker;
    const direction = ticker.pnl >= 0 ? "profitable" : "unprofitable";
    bullets.push(`${ticker.symbol} is ${direction} with ${formatMoney(ticker.pnl)} across ${ticker.trades.length} closed trade${ticker.trades.length === 1 ? "" : "s"}.`);
  } else {
    bullets.push(`${bestTicker.symbol} is your most profitable ticker with ${formatMoney(bestTicker.pnl)} across ${bestTicker.trades.length} closed trade${bestTicker.trades.length === 1 ? "" : "s"}.`);
    bullets.push(`${worstTicker.symbol} is your least profitable ticker with ${formatMoney(worstTicker.pnl)} across ${worstTicker.trades.length} closed trade${worstTicker.trades.length === 1 ? "" : "s"}.`);
  }

  if (shortHolds.length && longHolds.length) {
    const diff = longAvg - shortAvg;
    const relative = shortAvg ? Math.abs(diff / shortAvg) : 0;
    const comparison = diff < 0 ? "underperformed" : "outperformed";
    bullets.push(`Trades held over 5 days ${comparison} shorter holds by ${formatMoney(Math.abs(diff))} per trade${relative ? ` (${formatPercent(relative)} relative)` : ""}.`);
  } else if (longHolds.length) {
    bullets.push(`All completed trades were held over 5 days, averaging ${formatMoney(longAvg)} per trade.`);
  } else {
    bullets.push(`All completed trades were held 5 days or less, averaging ${formatMoney(shortAvg)} per trade.`);
  }

  if (metrics.averageLoss > metrics.averageWin && metrics.averageLoss > 0) {
    bullets.push(`Your average loss is larger than your average win; improving exits on losing trades would directly lift profit factor.`);
  } else if (worstTicker.pnl < 0) {
    bullets.push(`Reducing exposure to ${worstTicker.symbol} or tightening its exit rules would improve gross-loss drag and raise profit factor.`);
  } else if (byTicker.length === 1) {
    bullets.push(`Profit factor is healthy for ${bestTicker.symbol}; preserve the entry and exit pattern that produced these closed trades.`);
  } else {
    bullets.push(`Profit factor is healthy on closed trades; preserve the setups contributing to ${bestTicker.symbol} and monitor whether new tickers dilute it.`);
  }

  return {
    headline: `Trading Coach: ${closedTrades.length} completed FIFO round trip${closedTrades.length === 1 ? "" : "s"} analyzed.`,
    bullets
  };
}

function buildWarnings(unmatchedSells, openPositions) {
  const warnings = [];
  if (unmatchedSells.length) {
    const qty = sum(unmatchedSells.map((trade) => trade.quantity));
    warnings.push(`${unmatchedSells.length} sell row${unmatchedSells.length === 1 ? "" : "s"} (${qty.toFixed(2)} shares total) could not be matched to prior buys in the uploaded file.`);
  }
  if (openPositions.length) {
    const qty = sum(openPositions.map((lot) => lot.remaining));
    warnings.push(`${openPositions.length} open FIFO lot${openPositions.length === 1 ? "" : "s"} (${qty.toFixed(2)} shares total) remain after matching.`);
  }
  return warnings;
}

function groupBy(items, getKey) {
  const map = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatCurrencyRange(start, end) {
  return `${formatMoney(start)} to ${formatMoney(end)}`;
}

function formatMoney(value) {
  const sign = value < 0 ? "-" : "";
  return `${sign}₹${Math.abs(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}
