# Vision

This project helps Israeli taxpayers prepare and submit their annual income tax filing on the Israeli Tax Authority web portal.

## Problem

The Tax Authority's Form 1301 (and related forms) is filled by hand on a Hebrew, RTL HTML form at `secapp.taxes.gov.il`. The values that go into it live in messy source documents:

- **T106** — the employer's annual salary certificate, distributed as a PDF whose internal text encoding is deliberately obfuscated (digit shift, custom bracket glyphs, Apple-PUA Hebrew characters).
- **IBKR activity statement CSV** — Interactive Brokers' annual export, with trade, dividend, and lot data in USD that must be re-stated in ILS at the correct historical exchange rate.
- **Form 867** — Israeli broker tax certificate, also a PDF.
- Misc: donation receipts, prior-year carry-forward amounts.

Manually transcribing these into Form 1301 is error-prone, slow, and has to be redone every year.

## What we're building

A browser extension that **sits next to the user while they fill the tax form** and:

1. Reads the source documents (T106 PDF, IBKR CSV, 867 PDF) directly in the browser.
2. Generates the helper artifacts the user has historically built by hand (e.g. the per-trade ILS summary that today lives as a Google Sheet) and offers them as downloadable `.xlsx` files to upload back into the portal where required.
3. Drops the parsed values straight into the live Form 1301 inputs on the Tax Authority page — `txt158`, `txt042`, etc. — with per-field manual override.
4. Surfaces clear errors when the current page isn't the tax form, a source file fails to parse, or a value looks suspicious.

## Non-goals

- Not a tax advisor — does not interpret the law or decide what is taxable.
- Not a record-keeper — does not store the user's documents server-side. Everything runs in-browser (and on the user's machine for the CLI).
- Not a replacement for the Tax Authority portal — it assists form-filling, it does not submit.

## Today vs. tomorrow

- **Today:** Node CLI that parses a T106 PDF and writes values into a **local copy** of Form 1301 HTML.
- **Tomorrow (v1 of the extension):** Draggable in-page panel that fills the live Form 1301 from a T106 upload, with manual override.
- **Later:** IBKR CSV + 867 support, in-browser generation of the per-trade ILS xlsx helper, downloadable to upload to the portal.
