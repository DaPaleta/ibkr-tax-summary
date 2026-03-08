import fs from "node:fs"
import axios from "axios"
import { parse } from "csv-parse/sync"
import { stringify } from "csv-stringify/sync"
import { CSV_NAME, FALLBACK_RATE, BOI_EXR_BASE } from "./config.js"

/**
 * Fetch USD/ILS rates from Bank of Israel (BOI) as a time series.
 * Returns { [date: string]: rate } for dates in [startPeriod, endPeriod].
 * CSV format: "Time Period", "RER_USD_ILS:..." with rows "YYYY-MM-DD", "3.66"
 */
async function fetchBoiRatesForRange(startPeriod, endPeriod) {
  const params = new URLSearchParams()
  params.set("c[SERIES_CODE]", "RER_USD_ILS")
  params.set("format", "csv-series")
  params.set("startperiod", startPeriod)
  params.set("endperiod", endPeriod)
  const url = `${BOI_EXR_BASE}?${params.toString()}`
  const response = await axios.get(url, { timeout: 15_000 })
  const records = parse(response.data, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  })
  const byDate = {}
  const dateKey = "Time Period"
  for (const row of records) {
    const date = row[dateKey]?.trim()
    const value = row[Object.keys(row).find((k) => k !== dateKey)]?.trim()
    if (date && value) {
      const rate = Number(value)
      if (Number.isFinite(rate)) byDate[date] = rate
    }
  }
  return byDate
}

/**
 * Closest date on or before `requested` from sorted list of available dates.
 */
function closestPriorDate(requested, sortedAvailable) {
  const idx = sortedAvailable.findIndex((d) => d > requested)
  if (idx === 0) return null
  if (idx === -1) return sortedAvailable.at(-1) ?? null
  return sortedAvailable[idx - 1]
}

/**
 * Save BOI rates to output folder as CSV: Date,USD/ILS.
 */
function saveBoiRatesToOutput(byDate, startPeriod, endPeriod) {
  const outDir = "output"
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const filename = `${outDir}/boi_rates_${startPeriod}_${endPeriod}.csv`
  const sortedDates = Object.keys(byDate).sort((a, b) => a.localeCompare(b))
  const rows = [["Date", "USD/ILS"], ...sortedDates.map((d) => [d, byDate[d]])]
  fs.writeFileSync(filename, stringify(rows))
  console.log(`   BOI rates saved to ${filename}.`)
}

async function fetchExchangeRates(trades) {
  const uniqueDates = [
    ...new Set(trades.flatMap((t) => [t.buyDate, t.sellDate])),
  ]
  const validDates = uniqueDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  if (validDates.length === 0) return {}

  const sortedDates = [...validDates].sort((a, b) => a.localeCompare(b))
  const min = sortedDates[0]
  const max = sortedDates[sortedDates.length - 1]
  const rates = {}

  console.log(
    `🌐 Fetching exchange rates for ${uniqueDates.length} unique dates...`
  )

  // 1) Try Bank of Israel (BOI) time series first
  try {
    const byDate = await fetchBoiRatesForRange(min, max)
    const availableDates = Object.keys(byDate).sort((a, b) =>
      a.localeCompare(b)
    )

    for (const d of uniqueDates) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        rates[d] = FALLBACK_RATE
        continue
      }
      let rate = byDate[d]
      if (rate == null) {
        const prior = closestPriorDate(d, availableDates)
        rate = prior != null ? byDate[prior] : FALLBACK_RATE
        if (prior != null) {
          console.error(
            `No BOI rate for ${d} (weekend/holiday), using closest prior ${prior}.`
          )
        } else {
          console.error(
            `No BOI rate for ${d}, using fallback ${FALLBACK_RATE}.`
          )
        }
      }
      rates[d] = rate
    }

    saveBoiRatesToOutput(byDate, min, max)
    console.log("   Using Bank of Israel (BOI) rates.")
    return rates
  } catch (error) {
    console.error(
      `   BOI unavailable (${error.response?.status ?? error.message}), falling back to Frankfurter.`
    )
  }

  // 2) Fallback: Frankfurter (per-date)
  for (const date of uniqueDates) {
    rates[date] = await fetchFrankfurterRate(date)
  }
  return rates
}

async function fetchFrankfurterRate(date) {
  try {
    const response = await axios.get(
      `https://api.frankfurter.dev/v1/${date}?base=USD&symbols=ILS`
    )
    return response.data?.rates?.ILS ?? FALLBACK_RATE
  } catch (error) {
    console.error(
      `Could not fetch rate for ${date}, using fallback ${FALLBACK_RATE}\n\t${error.message}`
    )
    return FALLBACK_RATE
  }
}

function parseTradesCsv() {
  const fileContent = fs.readFileSync(`data/${CSV_NAME}`, "utf-8")
  const records = parse(fileContent, {
    columns: false,
    skip_empty_lines: true,
    relax_column_count: true,
  })

  const trades = []
  let currentTrade = null

  for (const row of records) {
    const [
      table,
      ,
      discriminator,
      ,
      currency,
      symbol,
      dateTime,
      ,
      quantity,
      tPrice,
      ,
      ,
      commFee,
    ] = row

    if (table !== "Trades") continue

    if (discriminator === "Order") {
      currentTrade = { symbol, currency }
    } else if (discriminator === "Trade" && currentTrade) {
      currentTrade.sellDate = dateTime.split(",")[0].trim()
      currentTrade.sellPrice = Math.abs(Number(tPrice))
      currentTrade.sellQty = Math.abs(Number(quantity))
      currentTrade.fee = Math.abs(Number(commFee))
    } else if (discriminator === "ClosedLot" && currentTrade) {
      currentTrade.buyDate = dateTime.trim()
      currentTrade.buyPrice = Number(tPrice)
    } else if (discriminator === "" && currentTrade) {
      if (currentTrade.buyDate && currentTrade.sellDate) {
        trades.push({ ...currentTrade })
      }
      currentTrade = null
    }
  }

  return trades
}

function calculateProfitLoss(trades, rates) {
  const processedData = trades.map((t) => {
    const rateBuy = rates[t.buyDate]
    const rateSell = rates[t.sellDate]

    const costBuyDate = t.buyPrice * t.sellQty * rateBuy
    const costSellDate = t.buyPrice * t.sellQty * rateSell
    const gains = t.sellPrice * t.sellQty * rateSell - t.fee * rateSell

    const diffA = gains - costBuyDate
    const diffB = gains - costSellDate

    let optimizedPL = 0
    if (diffA > 0 && diffB > 0) optimizedPL = Math.min(diffA, diffB)
    else if (diffA < 0 && diffB < 0) optimizedPL = Math.max(diffA, diffB)

    return [
      t.symbol,
      t.currency,
      t.buyDate,
      t.sellDate,
      t.buyPrice,
      t.sellPrice,
      t.sellQty,
      rateBuy,
      rateSell,
      t.fee,
      costBuyDate.toFixed(2),
      costSellDate.toFixed(2),
      gains.toFixed(2),
      optimizedPL.toFixed(2),
      optimizedPL >= 0 ? "Profit" : "Loss",
    ]
  })

  return processedData
}

function calculateTotals(processedData) {
  const totals = processedData.reduce((acc, row) => {
    acc[9] += Number(row[9]) // Fee
    acc[10] += Number(row[10]) // Cost (Buy Rate)
    acc[11] += Number(row[11]) // Cost (Sell Rate)
    acc[12] += Number(row[12]) // Gains
    acc[13] += Number(row[13]) // Opt. P/L
    return acc
  }, new Array(15).fill(0))

  totals[0] = "TOTAL"
  return totals
}

function writeOutput(processedData, totals) {
  const headers = [
    "Symbol",
    "Currency",
    "Buy Date",
    "Sell Date",
    "Buy Price",
    "Sell Price",
    "Sell Qty",
    "USD.ILS Rate Buy",
    "USD.ILS Rate Sell",
    "Fee",
    "Cost (Buy Rate)",
    "Cost (Sell Rate)",
    "Gains after fees",
    "Optimized P/L",
    "Status",
  ]
  const totalsRow = totals.map((v, i) => {
    if (v === "TOTAL") return "TOTAL"
    if (typeof v !== "number") return ""
    if (v === 0 && [0, 1, 2, 3, 4, 5, 6, 7, 8, 14].includes(i)) return ""
    return v.toFixed(2)
  })
  const finalRows = [headers, ...processedData, totalsRow]

  fs.writeFileSync(`output/${CSV_NAME}`, stringify(finalRows))
  console.log(`✅ Success! File saved as output/${CSV_NAME}`)
}

async function processTrades() {
  console.log("🚀 Starting transformation...")

  const trades = parseTradesCsv()
  const rates = await fetchExchangeRates(trades)
  const processedData = calculateProfitLoss(trades, rates)
  const totals = calculateTotals(processedData)
  writeOutput(processedData, totals)
}

await processTrades()
