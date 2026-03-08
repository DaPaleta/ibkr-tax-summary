import fs from "node:fs"
import path from "node:path"
import http from "node:http"
import { URL } from "node:url"
import { google } from "googleapis"
import open from "open"
import {
  SCOPES,
  REDIRECT_URI,
  LOOPBACK_PORT,
  OAUTH_CREDENTIALS_PATH,
  GOOGLE_TOKEN_PATH,
} from "../config.js"

export function getClientSecretPath() {
  const env = OAUTH_CREDENTIALS_PATH
  if (env && fs.existsSync(env)) return path.resolve(env)
  const cwd = process.cwd()
  const files = fs
    .readdirSync(cwd)
    .filter((f) => f.startsWith("client_secret") && f.endsWith(".json"))
  if (files.length > 0) return path.join(cwd, files[0])
  return null
}

export function getTokenPath() {
  return path.resolve(GOOGLE_TOKEN_PATH)
}

export function loadClientSecret(credsPath) {
  const raw = JSON.parse(fs.readFileSync(credsPath, "utf-8"))
  const block = raw?.installed || raw?.web
  if (!block?.client_id || !block.client_secret) {
    throw new Error(
      `Client secret JSON must have installed or web with client_id and client_secret.`
    )
  }
  return { clientId: block.client_id, clientSecret: block.client_secret }
}

export function loadSavedToken(tokenPath) {
  if (!fs.existsSync(tokenPath)) return null
  try {
    const raw = JSON.parse(fs.readFileSync(tokenPath, "utf-8"))
    if (raw?.refresh_token) return raw
  } catch {
    // ignore
  }
  return null
}

export function saveToken(tokenPath, tokens) {
  const dir = path.dirname(tokenPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2), "utf-8")
}

export function runLoopbackAuth(oauth2Client) {
  return new Promise((resolve, reject) => {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
    })

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || "", `http://localhost:${LOOPBACK_PORT}`)
      if (url.pathname !== "/" && !url.pathname.startsWith("/?")) {
        res.writeHead(404).end()
        return
      }
      const code = url.searchParams.get("code")
      if (!code) {
        res.writeHead(400).end("Missing code in redirect.")
        return
      }
      res.writeHead(200, { "Content-Type": "text/html" })
      res.end(
        "<p>Authorization successful. You can close this tab and return to the terminal.</p>"
      )
      server.close()

      try {
        const { tokens } = await oauth2Client.getToken(code)
        oauth2Client.setCredentials(tokens)
        resolve(tokens)
      } catch (e) {
        reject(e)
      }
    })

    server.listen(LOOPBACK_PORT, "127.0.0.1", () => {
      console.log("Opening browser for Google sign-in...")
      open(authUrl).catch(() => {
        console.log("Open this URL in your browser:", authUrl)
      })
    })

    server.on("error", reject)
  })
}

export async function getOAuth2Client() {
  const credsPath = getClientSecretPath()
  if (!credsPath) {
    console.error(
      "OAuth credentials not found. Set OAUTH_CREDENTIALS_PATH to your client secret JSON, or place a client_secret_*.json file in the project root."
    )
    process.exit(1)
  }

  const { clientId, clientSecret } = loadClientSecret(credsPath)
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    REDIRECT_URI
  )

  const tokenPath = getTokenPath()
  const saved = loadSavedToken(tokenPath)
  if (saved) {
    oauth2Client.setCredentials(saved)
    return { oauth2Client, tokenPath }
  }

  const tokens = await runLoopbackAuth(oauth2Client)
  saveToken(tokenPath, tokens)
  return { oauth2Client, tokenPath }
}
