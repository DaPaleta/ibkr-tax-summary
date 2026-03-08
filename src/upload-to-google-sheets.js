import fs from "node:fs"
import path from "node:path"
import { parse } from "csv-parse/sync"
import { google } from "googleapis"
import {
  DEFAULT_CSV_PATH,
  SOURCE_SPREADSHEET_ID,
  TEMPLATE_SHEET_GID,
  TEMPLATE_ROW_0_BASED,
  SPREADSHEET_COPY_NAME,
  COPY_DESTINATION_FOLDER_ID,
} from "./config.js"
import { getOAuth2Client, getTokenPath } from "./utils/google-auth-helper.js"

function getCsvPath() {
  const arg = process.argv[2]
  if (arg) return path.resolve(arg)
  return path.resolve(DEFAULT_CSV_PATH)
}

function parseAndSortTrades(csvPath) {
  if (!fs.existsSync(csvPath)) {
    console.error(`Output CSV not found: ${csvPath}`)
    process.exit(1)
  }
  const raw = fs.readFileSync(csvPath, "utf-8")
  const records = parse(raw, { columns: true, skip_empty_lines: true })
  const dataRows = records.filter(
    (row) =>
      row.Symbol &&
      String(row.Symbol).trim() !== "" &&
      String(row.Symbol).trim().toUpperCase() !== "TOTAL"
  )
  dataRows.sort((a, b) => {
    const d1 = (a["Sell Date"] || "").trim()
    const d2 = (b["Sell Date"] || "").trim()
    return d1.localeCompare(d2)
  })
  return dataRows
}

function buildSheetValues(trades) {
  const n = trades.length
  const colA = []
  const colB = []
  const colE = []
  const colF = []
  const colG = []
  const colI = []
  const colJ = []
  const colM = []
  for (let i = 0; i < n; i++) {
    const t = trades[i]
    const qty = Number(t["Sell Qty"]) || 0
    const sellPrice = Number(t["Sell Price"]) || 0
    const buyPrice = Number(t["Buy Price"]) || 0
    colA.push(i + 1)
    colB.push((t.Symbol || "").trim())
    colE.push(qty * sellPrice)
    colF.push((t["Buy Date"] || "").trim())
    colG.push(qty * buyPrice)
    colI.push(t["USD.ILS Rate Buy"] ?? "")
    colJ.push(t["USD.ILS Rate Sell"] ?? "")
    colM.push((t["Sell Date"] || "").trim())
  }
  return {
    colA,
    colB,
    colE,
    colF,
    colG,
    colI,
    colJ,
    colM,
  }
}

async function copySpreadsheet(drive, sourceId) {
  const name = SPREADSHEET_COPY_NAME
  const body = { name }
  const folderId = COPY_DESTINATION_FOLDER_ID
  if (folderId) body.parents = [folderId]
  const res = await drive.files.copy({
    fileId: sourceId,
    requestBody: body,
  })
  return res.data.id
}

async function getSheetMetadata(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.get({ spreadsheetId })
  const sheet = res.data.sheets?.find(
    (s) => s.properties?.sheetId === TEMPLATE_SHEET_GID
  )
  if (!sheet) {
    throw new Error(
      `Sheet with gid ${TEMPLATE_SHEET_GID} not found in the spreadsheet.`
    )
  }
  const sheetTitle = sheet.properties.title
  const sheetId = sheet.properties.sheetId
  const rowCount = sheet.properties.gridProperties?.rowCount ?? 1000
  return { sheetTitle, sheetId, rowCount }
}

function a1Range(sheetTitle, colLetter, startRow1, endRow1) {
  return `'${sheetTitle}'!${colLetter}${startRow1}:${colLetter}${endRow1}`
}

async function findOldDataRows(sheets, spreadsheetId, sheetTitle) {
  const range = `'${sheetTitle}'!A4:A25`
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    })
    const values = res.data.values || []
    const oldDataRowIndices = []
    for (let i = 0; i < values.length; i++) {
      const cellValue = values[i]?.[0]
      if (cellValue && !Number.isNaN(Number(cellValue))) {
        oldDataRowIndices.push(3 + i)
      }
    }
    return oldDataRowIndices
  } catch {
    return []
  }
}

export async function uploadToSheets() {
  const csvPath = getCsvPath()
  const trades = parseAndSortTrades(csvPath)
  if (trades.length === 0) {
    console.log("No data rows to upload. Exiting.")
    return
  }
  const N = trades.length
  const values = buildSheetValues(trades)

  const { oauth2Client } = await getOAuth2Client()
  const sheets = google.sheets({ version: "v4", auth: oauth2Client })
  const drive = google.drive({ version: "v3", auth: oauth2Client })

  let copyId
  try {
    copyId = await copySpreadsheet(drive, SOURCE_SPREADSHEET_ID)
  } catch (e) {
    e.step = "Drive copy (source spreadsheet)"
    throw e
  }
  console.log(
    "Created copy: https://docs.google.com/spreadsheets/d/" + copyId + "/edit"
  )

  let sheetTitle, sheetId
  try {
    const meta = await getSheetMetadata(sheets, copyId)
    sheetTitle = meta.sheetTitle
    sheetId = meta.sheetId
  } catch (e) {
    e.step = "Sheets get (copy metadata)"
    throw e
  }

  let oldDataRowIndices = []
  try {
    oldDataRowIndices = await findOldDataRows(sheets, copyId, sheetTitle)
  } catch (e) {
    e.step = "Find old data rows"
    throw e
  }

  const firstDataRow1 = TEMPLATE_ROW_0_BASED + 1
  const lastDataRow1 = TEMPLATE_ROW_0_BASED + N

  const requests = []

  // Insert N-1 new rows at position after template row (row 3 will be used for first trade)
  requests.push({
    insertDimension: {
      range: {
        sheetId,
        dimension: "ROWS",
        startIndex: TEMPLATE_ROW_0_BASED + 1,
        endIndex: TEMPLATE_ROW_0_BASED + N,
      },
    },
  })

  for (let i = 0; i < N - 1; i++) {
    requests.push({
      copyPaste: {
        source: {
          sheetId,
          startRowIndex: TEMPLATE_ROW_0_BASED,
          endRowIndex: TEMPLATE_ROW_0_BASED + 1,
          startColumnIndex: 0,
          endColumnIndex: 17,
        },
        destination: {
          sheetId,
          startRowIndex: TEMPLATE_ROW_0_BASED + 1 + i,
          endRowIndex: TEMPLATE_ROW_0_BASED + 2 + i,
          startColumnIndex: 0,
          endColumnIndex: 17,
        },
        pasteType: "PASTE_NORMAL",
      },
    })
  }

  // Delete old data rows (adjust indices for the N-1 rows we just inserted)
  // Sort in descending order to delete from bottom to top
  const adjustedOldDataIndices = oldDataRowIndices
    .map((idx) => idx + (N - 1))
    .sort((a, b) => b - a)

  for (const rowIndex of adjustedOldDataIndices) {
    requests.push({
      deleteDimension: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: rowIndex,
          endIndex: rowIndex + 1,
        },
      },
    })
  }

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: copyId,
      requestBody: { requests },
    })
  } catch (e) {
    e.step = "Sheets batchUpdate (structure)"
    throw e
  }

  const data = [
    {
      range: a1Range(sheetTitle, "A", firstDataRow1, lastDataRow1),
      values: values.colA.map((v) => [v]),
    },
    {
      range: a1Range(sheetTitle, "B", firstDataRow1, lastDataRow1),
      values: values.colB.map((v) => [v]),
    },
    {
      range: a1Range(sheetTitle, "E", firstDataRow1, lastDataRow1),
      values: values.colE.map((v) => [v]),
    },
    {
      range: a1Range(sheetTitle, "F", firstDataRow1, lastDataRow1),
      values: values.colF.map((v) => [v]),
    },
    {
      range: a1Range(sheetTitle, "G", firstDataRow1, lastDataRow1),
      values: values.colG.map((v) => [v]),
    },
    {
      range: a1Range(sheetTitle, "I", firstDataRow1, lastDataRow1),
      values: values.colI.map((v) => [v]),
    },
    {
      range: a1Range(sheetTitle, "J", firstDataRow1, lastDataRow1),
      values: values.colJ.map((v) => [v]),
    },
    {
      range: a1Range(sheetTitle, "M", firstDataRow1, lastDataRow1),
      values: values.colM.map((v) => [v]),
    },
  ]

  try {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: copyId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data,
      },
    })
  } catch (e) {
    e.step = "Sheets values.batchUpdate (data)"
    throw e
  }

  console.log(`Uploaded ${N} trades to the spreadsheet (sorted by Sell Date).`)
}

try {
  await uploadToSheets()
} catch (err) {
  const data = err.response?.data
  const isDriveDisabled =
    data?.error?.code === 403 &&
    (data?.error?.status === "PERMISSION_DENIED" ||
      data?.error?.errors?.[0]?.reason === "accessNotConfigured") &&
    (data?.error?.message?.includes("Drive API") ||
      data?.error?.details?.some?.(
        (d) => d.metadata?.service === "drive.googleapis.com"
      ))

  if (isDriveDisabled) {
    console.error(
      "Google Drive API is not enabled for your project. The script needs it to copy the spreadsheet."
    )
    console.error(
      "Enable it here: https://console.cloud.google.com/apis/library/drive.googleapis.com"
    )
    console.error(
      "Select the same project that owns your OAuth client credentials, then enable the API and run the script again."
    )
  } else {
    const step = err.step ? `Failed at: ${err.step}. ` : ""
    const details = data ? JSON.stringify(data, null, 2) : err.message
    console.error(step + "Error:", details)
    if (err.code === 403 || err.message?.includes("permission")) {
      console.error(
        "The script uses the Google account you signed in with. If the spreadsheet is shared with a different account, delete the token file and run again, then sign in with the account that has access."
      )
      console.error("Token file:", getTokenPath())
    }
  }
  process.exit(1)
}
