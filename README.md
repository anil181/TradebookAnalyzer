# Zerodha Tradebook Analyzer

A simple, browser-based tool to analyze your Zerodha equity trading history. Just download your tradebook file from Zerodha Console, upload it here, and get an instant dashboard of your trading performance—completely free and private.

No technical background required!

## 🚀 How to Use It (Step-by-Step)

### Step 1: Download your Tradebook from Zerodha
Go to the Zerodha Console Tradebook Page.

Select Equity as the category.

Choose the Date Range you want to analyze (e.g., last month, last year).

Click the download button and choose the .xlsx (Excel) format. Save this file on your computer.

### Step 2: Open the Tool on Your Computer
If you are setting this up for the first time, you just need to run a simple command to start it.

1. Open your computer's Terminal (Mac) or Command Prompt (Windows).

2. Navigate to this project's folder.

3. Type the following command and press Enter:

```bash
npm run start
```

4. Open your web browser (Chrome, Safari, Edge, etc.) and go to this web address: http://localhost:4173

💡 Note for First-Time Setup: Make sure your computer is connected to the internet the first time you open the page. The app needs to quickly download a couple of secure tools to read your Excel files and draw the charts.

### Step 3: Upload and Analyze
1. Click the Upload button on the web page.
2. Select the .xlsx file you downloaded from Zerodha in Step 1.
3. Done! Your trading dashboard will generate instantly.

## 📈 What Insights Do You Get?

Once your file is uploaded, the tool automatically calculates and displays:

- Core Performance Metrics: See your total Net Profit/Loss (P/L), Win Rate (percentage of profitable trades), Profit Factor, average Win/Loss ratio, your maximum drop in account value (Drawdown), and how long you typically hold a stock.

- Interactive Visual Charts: Beautiful charts showing your growing account curve (Cumulative Equity), which specific stocks made or lost the most money (Ticker P/L), and a breakdown of your wins vs. losses.

- Built-in Trading Coach: Personalized, automated advice based on your trading habits and holding times to help you improve.

- Stock Search Bar: Type in any stock symbol (e.g., RELIANCE or TATASTEEL) to instantly filter all metrics, charts, and trade tables for just that stock.

- Detailed Trade Table: A neat list of all your closed trades. It automatically matches your "Buys" and "Sells" using the standard FIFO (First In, First Out) accounting method.

- Open Positions Snapshot: A clear look at your current stock holdings that you haven't sold yet, showing exactly what they cost you to buy.


## Important Things to Keep in Mind

- No Hidden Fees Calculated: The calculations are strictly based on the trade price and quantity you paid/received. Brokerage fees, government taxes, and STT charges are not included unless they are factored into the trade price by Zerodha.

- "Unmatched" Sells: If you see an "unmatched sell" error, it just means you sold a stock during the date range you downloaded, but you bought it before that date range started. To fix this, simply redownload your tradebook from Zerodha using an older start date.

- Current Stock Prices: The "Open Positions" section shows your remaining stocks at their original cost. It does not connect to the live stock market, so it won't show your live, fluctuating day-to-day profits.

- 100% Private: Your financial data never leaves your computer. All parsing and analysis happen right inside your web browser.

## Sample dashboard generated
<img width="3024" height="5474" alt="Screen Shot 2026-05-30 at 21 22 06" src="https://github.com/user-attachments/assets/6c85ff00-1c4b-4b5b-9535-19c6916de241" />

  
