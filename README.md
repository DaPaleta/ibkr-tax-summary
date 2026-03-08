# IBKR Tax Summary

A Node.js script that turns Interactive Brokers (IBKR) activity statement CSVs into a single, ILS-based summary CSV suitable for **Israeli tax reporting**. It parses trade blocks, fetches USD→ILS exchange rates for the relevant dates, and computes cost basis, gains, and an optimized realized P/L in shekels.

## What it does

1. **Reads** an IBKR Activity Statement CSV (trades section).
2. **Parses** each trade block (Order → Trade / ClosedLot → end with blank row).
3. **Fetches** USD/ILS rates for every buy and sell date (via [Frankfurter](https://www.frankfurter.dev/) API).
4. **Builds** one row per trade with base columns plus derived values in ILS.
5. **Writes** a summary CSV with a totals row.

## Requirements (how the script answers them)

### Input format

- **Source:** IBKR activity statement CSV including closedLots data, featuring only `Close` orders.
- **Block start:** Row with `DataDiscriminator = "Order"`.
- **Block end:** Row with blank `DataDiscriminator`.
- **Relevant rows:** `Trade` (sell side) and `ClosedLot` (buy side).

### Output columns (in order)

| #   | Column            | Source                                   |
| --- | ----------------- | ---------------------------------------- |
| 1   | Symbol            | Order row                                |
| 2   | Currency          | Order row                                |
| 3   | Buy Date          | Date/Time from **ClosedLot** row         |
| 4   | Sell Date         | Date/Time from **Trade** row (date only) |
| 5   | Buy Price         | T. Price from **ClosedLot** row          |
| 6   | Sell Price        | T. Price from **Trade** row              |
| 7   | Sell Qty          | Quantity from **Trade** row              |
| 8   | USD/ILS Rate Buy  | Fetched for buy date                     |
| 9   | USD/ILS Rate Sell | Fetched for sell date                    |
| 10  | Fee               | Comm/Fee from **Trade** row              |

### Derived columns (extended by the script)

| Column               | Formula                                                   |
| -------------------- | --------------------------------------------------------- |
| **Cost (Buy Rate)**  | (5) × (7) × (8) — cost basis using buy-date rate          |
| **Cost (Sell Rate)** | (5) × (7) × (9) — cost basis using sell-date rate         |
| **Gains after fees** | (6)×(7)×(9) − (10)×(9) — proceeds in ILS minus fee in ILS |
| **Optimized P/L**    | See below                                                 |
| **Status**           | `Profit` or `Loss`                                        |

**Optimized P/L** (tax-friendly realized P/L in ILS):

- Compute: `Gains − Cost (Buy Rate)` and `Gains − Cost (Sell Rate)`.
- If **both positive** → take the **minimum**.
- If **both negative** → take the **maximum**.
- If **one positive, one negative** → use **0**.

This follows the idea of choosing the most favorable cost basis (buy-date vs sell-date rate) while staying within the two alternatives.

### Totals row

- One **TOTAL** row at the bottom.
- Sums: Fee, Cost (Buy Rate), Cost (Sell Rate), Gains after fees, Optimized P/L.
- Other columns (symbol, dates, rates, etc.) are left empty in the totals row.

---

## Use for Israel tax reports

### Why ILS and why these columns?

- Israeli tax on **capital gains from securities** is usually calculated in **NIS (ILS)**.
- If you trade in **USD**, you must convert:
  - **Proceeds** (sell price × quantity) and **fees** at the **sell-date** rate.
  - **Cost basis** can be calculated using either the **buy-date** or **sell-date** USD/ILS rate, preferrable the cheaper option for you; the script supports both and then computes an **optimized** realized P/L.
- The output CSV gives you, per trade and in total:
  - Cost in ILS (buy-date and sell-date variants).
  - Gains in ILS after fees.
  - A single **Optimized P/L** figure in ILS and a Profit/Loss label.

### How to use the output

1. **Input:** Export your IBKR Activity Statement as CSV for the tax year and place the file in `data/` (see [Setup](#setup) for the expected path).
2. **Run:** `npm start` (or `node index.js`). The script reads the CSV, fetches rates, and writes `output/EXAMPLE_CSV.csv`.
3. **Use the CSV:**

- As a **working summary** of your trades in ILS.
- To **reconcile** with your own records or with forms (e.g. Israeli tax forms that ask for capital gains in NIS).
- To **report** total gains/losses and optimized P/L; consult a tax advisor for how exactly to map these columns onto your return.

**Disclaimer:** This tool is for convenience and does not constitute tax or legal advice. Always confirm treatment of foreign-currency gains and cost basis with the Israeli Tax Authority or a qualified tax professional.

---

## Setup

### Prerequisites

- **Node.js** 18+ (ES modules).

### Install

```bash
npm install
```

### Configuration

- **Input file:** Edit `CSV_NAME` in `src/config.js` so the script will pick it up from `data/CSV_NAME`.
- **Output file:** The script writes `CSV_NAME` in the output folder.
- **Exchange rates:** The script uses the [Frankfurter API](https://www.frankfurter.dev/) (no API key). If a date fails, it falls back to a default rate (see `FALLBACK_RATE` in `src/config.js`).

### Run

```bash
npm start
```

Or:

```bash
node src/parse-ibkr-trades.js
```

You should see something like:

```
🚀 Starting transformation...
🌐 Fetching exchange rates for N unique dates...
✅ Success! File saved as EXAMPLE_CSV.csv
```

---

## Upload to Google Sheets

The script **copies** your template spreadsheet (via the Drive API), then fills the copy with trade data: row 3 is duplicated for each trade (keeping formulas in C, D, H, etc.) and columns A, B, E, F, G, I, J, M are filled. Trades are sorted by Sell Date ascending. The original spreadsheet is never modified.

### Setup

1. **Google Cloud:** In [Google Cloud Console](https://console.cloud.google.com/), create a project, enable **Google Sheets API** and **Google Drive API**, and configure the **OAuth consent screen** (e.g. External for personal use). Add scopes for Sheets and Drive.
2. **OAuth client:** Create **OAuth 2.0** credentials — use **Web application** and add authorized redirect URI `http://localhost:3232`. Download the client secret JSON (or use **Desktop app** and add the same redirect URI if your console allows).
3. **Credentials:** Put the client secret file in the project root as `client_secret_*.json`, or set `OAUTH_CREDENTIALS_PATH` to its path.
4. **Template spreadsheet:** Use a Google Sheet you can open (your template). Set `SPREADSHEET_ID` to its ID, or use the script default. You need at least view access; the script will duplicate it and fill the copy.

On first run, the script opens a browser so you can sign in with Google and authorize the app. **Sign in with the same Google account that has access to the template spreadsheet** (owner or shared with). Tokens are stored locally (e.g. `.credentials/token.json`) for future runs. If you get "Permission denied", delete the token file and run again, then sign in with the account that can open the spreadsheet. If the error says the **Drive API** is disabled, enable it in [APIs & Services](https://console.cloud.google.com/apis/library/drive.googleapis.com) for the same project that owns your OAuth client.

**Optional env:**

- `SPREADSHEET_ID` — template spreadsheet ID (the script copies this).
- `SHEET_GID` — sheet/tab gid in the template (default `2018551420`).
- `OUTPUT_CSV` — path to the output CSV if you don’t pass it as an argument.
- `COPY_DESTINATION_FOLDER_ID` — Drive folder ID where the copy should be created (optional).
- `COPY_NAME` — name for the new copy (default: `IBKR Tax Summary YYYY-MM-DD`).
- `GOOGLE_TOKEN_PATH` — where to store the OAuth token (default: `.credentials/token.json`).

### Run

```bash
npm run upload-sheets
```

Or with a specific CSV:

```bash
node src/upload-to-google-sheets.js output/your-file.csv
```

The script copies the template sheet, then writes the sorted trade data into the copy and prints the new spreadsheet URL.

---

## Project structure

```
├── data/                    # Put your IBKR Activity Statement CSV here
├── output/                  # Get your transformed CSV here
├── src/
│   ├── config.js            # Configuration constants
│   ├── parse-ibkr-trades.js # Main parser script
│   ├── upload-to-google-sheets.js
│   └── utils/
│       └── google-auth-helper.js  # Google OAuth utilities
├── package.json
└── README.md
```

---

## License

ISC.
