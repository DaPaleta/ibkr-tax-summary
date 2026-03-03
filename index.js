import fs from "node:fs"
import axios from "axios"
import { parse } from "csv-parse/sync"
import { stringify } from "csv-stringify/sync"

const CSV_NAME = "EXAMPLE_CSV.csv"
const FALLBACK_RATE = 3.5

async function fetchExchangeRates(trades) {
  const uniqueDates = [
    ...new Set(trades.flatMap((t) => [t.buyDate, t.sellDate])),
  ]
  const rates = {}

  console.log(
    `🌐 Fetching exchange rates for ${uniqueDates.length} unique dates...`
  )
  for (const date of uniqueDates) {
    rates[date] = await fetchExchangeRate(date)
  }

  return rates
}

async function fetchExchangeRate(date) {
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
