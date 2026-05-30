# Tradebook Analyzer

A reusable, browser-based FIFO tradebook analyzer for Zerodha-style equity tradebook `.xlsx` files. Download the tradebook from https://console.zerodha.com/reports/tradebook in .xlsx for any date range. This file is the input to the tool for further analysis.

## Run

```bash
npm run start
```

Open `http://localhost:4173`, upload a broker tradebook, and the app will parse closed long trades using strict FIFO matching. The visible closed-trades table groups FIFO fragments by ticker, buy date, and sell date with weighted average buy/sell prices.

The browser page loads SheetJS and Chart.js from public CDNs, so the first run needs internet access for workbook parsing and charts.

## What It Shows

- Core metrics: net P/L, win rate, profit factor, average win/loss ratio, max drawdown, and average holding time
- Interactive charts: cumulative equity curve, ticker P/L bars, and win/loss histogram
- Trading Coach insights based on ticker and holding-time performance
- Ticker search that filters metrics, charts, insights, and the trade table
- Sortable grouped closed FIFO round-trip trade table
- Open FIFO lots table for remaining BUY positions, shown as a current portfolio snapshot at cost basis

## Notes

- Closed trades are calculated only when a sell can be matched against prior buys for the same ticker.
- Sells with no available prior buys are reported as unmatched. This can happen if your uploaded date range starts after the original purchase.
- Calculations currently use trade price and quantity. Broker fees, taxes, and charges are not included unless they appear in the uploaded tradebook as price/quantity effects.
- Open positions use remaining FIFO buy quantities from the uploaded file. They do not include live market prices, so unrealized P/L is not calculated yet.

## Analysis dashboard snapshot
<img width="2880" height="5070" alt="Screen Shot 2026-05-30 at 18 38 21" src="https://github.com/user-attachments/assets/6b5f794c-30de-49f8-aa2b-ac09957ad1ba" />

