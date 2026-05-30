# Zerodha Tradebook Analyzer

A reusable, browser-based FIFO tradebook analyzer for Zerodha-style equity tradebook `.xlsx` files. You need to go to https://console.zerodha.com/reports/tradebook. Select a date range for which you want to analyze your trades, download in xlsx format.

## Run

```bash
npm run start
```

Open `http://localhost:4173`, upload the downloaded tradebook, and the app will parse closed long trades using strict FIFO matching. The visible closed-trades table groups FIFO fragments by ticker, buy date, and sell date with weighted average buy/sell prices.

The browser page loads SheetJS and Chart.js from public CDNs, so the first run needs internet access for workbook parsing and charts.

## What It Shows

- Core metrics: net P/L, win rate, profit factor, average win/loss ratio, max drawdown, and average holding time
- Interactive charts: cumulative equity curve, ticker P/L bars, and win/loss histogram
- Trading Coach insights based on ticker and holding-time performance
- Ticker search that filters metrics, charts, insights, and the trade table
- Sortable grouped closed FIFO round-trip trade table

## Notes

- Closed trades are calculated only when a sell can be matched against prior buys for the same ticker.
- Sells with no available prior buys are reported as unmatched. This can happen if your uploaded date range starts after the original purchase.
- Calculations currently use trade price and quantity. Broker fees, taxes, and charges are not included unless they appear in the uploaded tradebook as price/quantity effects.

## Sample dashboard after analysis
<img width="3024" height="4560" alt="Screen Shot 2026-05-30 at 17 23 47" src="https://github.com/user-attachments/assets/9a551173-e80a-4c26-b70e-1358588317ae" />
