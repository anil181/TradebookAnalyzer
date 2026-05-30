import assert from "node:assert/strict";
import { analyzeTrades, formatDate, rowsToTrades } from "../src/analyzer.js";

const rows = [
  ["", "Metadata"],
  ["", "Symbol", "Trade Date", "Trade Type", "Quantity", "Price", "Order Execution Time"],
  ["", "AAA", "2026-01-01", "buy", "10", "100", "2026-01-01 09:16:00"],
  ["", "AAA", "2026-01-02", "buy", "5", "120", "2026-01-02 09:16:00"],
  ["", "AAA", "2026-01-03", "sell", "12", "130", "2026-01-03 09:16:00"],
  ["", "BBB", "2026-01-04", "sell", "1", "50", "2026-01-04 09:16:00"]
];

const trades = rowsToTrades(rows);
assert.equal(trades.length, 4);

const analysis = analyzeTrades(trades);
assert.equal(analysis.closedTrades.length, 2);
assert.equal(analysis.groupedClosedTrades.length, 2);
assert.equal(analysis.closedTrades[0].quantity, 10);
assert.equal(analysis.closedTrades[0].buyPrice, 100);
assert.equal(analysis.closedTrades[0].sellPrice, 130);
assert.equal(analysis.closedTrades[0].netProfit, 300);
assert.equal(analysis.closedTrades[1].quantity, 2);
assert.equal(analysis.closedTrades[1].buyPrice, 120);
assert.equal(analysis.closedTrades[1].netProfit, 20);
assert.equal(analysis.metrics.netProfit, 320);
assert.equal(analysis.unmatchedSells.length, 1);
assert.equal(analysis.openPositions.length, 1);
assert.equal(analysis.openPositions[0].remaining, 3);
assert.equal(formatDate(analysis.closedTrades[0].buyDate), "2026-01-01");

const fragmentRows = [
  ["", "Symbol", "Trade Date", "Trade Type", "Quantity", "Price", "Order Execution Time"],
  ["", "XYZ", "2026-02-01", "buy", "10", "100", "2026-02-01 09:16:00"],
  ["", "XYZ", "2026-02-01", "buy", "5", "110", "2026-02-01 09:17:00"],
  ["", "XYZ", "2026-02-03", "sell", "8", "120", "2026-02-03 09:18:00"],
  ["", "XYZ", "2026-02-03", "sell", "4", "125", "2026-02-03 09:19:00"]
];
const groupedAnalysis = analyzeTrades(rowsToTrades(fragmentRows));
assert.equal(groupedAnalysis.closedTrades.length, 3);
assert.equal(groupedAnalysis.groupedClosedTrades.length, 1);
assert.equal(groupedAnalysis.groupedClosedTrades[0].quantity, 12);
assert.equal(Math.round(groupedAnalysis.groupedClosedTrades[0].buyPrice * 100) / 100, 101.67);
assert.equal(Math.round(groupedAnalysis.groupedClosedTrades[0].sellPrice * 100) / 100, 121.67);
assert.equal(groupedAnalysis.groupedClosedTrades[0].netProfit, 240);
assert.equal(
  groupedAnalysis.insights.bullets.some((bullet) => bullet.includes("least profitable")),
  false
);
assert.equal(
  groupedAnalysis.insights.bullets.some((bullet) => bullet.includes("most profitable")),
  false
);

console.log("Analyzer FIFO tests passed.");
