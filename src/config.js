export const CSV_NAME = "EXAMPLE_CSV.csv"
export const FALLBACK_RATE = 3.5
export const BOI_EXR_BASE =
  "https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/"

export const DEFAULT_CSV_PATH = `output/${CSV_NAME}`
// Courtesy of FinTranslator[https://fintranslator.com/israel-tax-return-example-2019/]
export const SOURCE_SPREADSHEET_ID =
  "1_aa1DzPFsVM_Cnqh-wXr42pqNFuardz2D-SbZHTu7n4"
export const TEMPLATE_SHEET_GID = 2018551420
export const TEMPLATE_ROW_1_BASED = 3
export const TEMPLATE_ROW_0_BASED = TEMPLATE_ROW_1_BASED - 1

export const SPREADSHEET_COPY_NAME = `IBKR Tax Summary ${new Date().toISOString().slice(0, 10)}`
// Optional: folder ID where the copy should be created (share folder with your account)
export const COPY_DESTINATION_FOLDER_ID = ""

export const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
]
export const REDIRECT_URI = "http://localhost:3232"
export const LOOPBACK_PORT = 3232

// OAuth: path to Google OAuth client secret JSON (Web or Desktop app)
// If unset, a client_secret_*.json file in the project root is used.
export const OAUTH_CREDENTIALS_PATH =
  process.env.OAUTH_CREDENTIALS_PATH ||
  process.env.GOOGLE_CLIENT_SECRET_PATH ||
  ""
// Where to store the OAuth token
export const GOOGLE_TOKEN_PATH =
  process.env.GOOGLE_TOKEN_PATH || ".credentials/token.json"
