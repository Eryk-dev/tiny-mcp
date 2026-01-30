/**
 * OAuth 2.0 Authentication Service for Tiny ERP API
 *
 * Uses Keycloak-based OpenID Connect flow:
 * - Authorization Code Grant for initial login
 * - Refresh Token Grant for token renewal
 */

import http from "http";
import { URL } from "url";
import fs from "fs";
import path from "path";
import axios from "axios";
import open from "open";

// OAuth 2.0 Configuration
const OAUTH_CONFIG = {
  authorizationUrl: "https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth",
  tokenUrl: "https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token",
  scope: "openid",
  responseType: "code",
  // Token expiration times (in seconds)
  accessTokenExpiry: 4 * 60 * 60, // 4 hours
  refreshTokenExpiry: 24 * 60 * 60, // 1 day
};

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in: number;
  // Computed fields
  access_token_expires_at?: number;
  refresh_token_expires_at?: number;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Get the path to the token storage file
 */
function getTokenFilePath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || ".";
  const configDir = path.join(homeDir, ".tiny-mcp");

  // Ensure config directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  return path.join(configDir, "tokens.json");
}

/**
 * Save tokens to file
 */
export function saveTokens(tokens: OAuthTokens): void {
  const filePath = getTokenFilePath();

  // Add expiration timestamps
  const now = Date.now();
  tokens.access_token_expires_at = now + (tokens.expires_in * 1000);
  tokens.refresh_token_expires_at = now + (tokens.refresh_expires_in * 1000);

  fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2), "utf-8");
}

/**
 * Load tokens from file
 */
export function loadTokens(): OAuthTokens | null {
  const filePath = getTokenFilePath();

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data) as OAuthTokens;
  } catch {
    return null;
  }
}

/**
 * Delete stored tokens
 */
export function clearTokens(): void {
  const filePath = getTokenFilePath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Check if access token is expired or about to expire (within 5 minutes)
 */
export function isAccessTokenExpired(tokens: OAuthTokens): boolean {
  if (!tokens.access_token_expires_at) return true;
  const bufferTime = 5 * 60 * 1000; // 5 minutes
  return Date.now() >= (tokens.access_token_expires_at - bufferTime);
}

/**
 * Check if refresh token is expired
 */
export function isRefreshTokenExpired(tokens: OAuthTokens): boolean {
  if (!tokens.refresh_token_expires_at) return true;
  return Date.now() >= tokens.refresh_token_expires_at;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  config: OAuthConfig
): Promise<OAuthTokens> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    code: code,
  });

  const response = await axios.post<OAuthTokens>(
    OAUTH_CONFIG.tokenUrl,
    params.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const tokens = response.data;
  saveTokens(tokens);
  return tokens;
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  config: OAuthConfig
): Promise<OAuthTokens> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  });

  const response = await axios.post<OAuthTokens>(
    OAUTH_CONFIG.tokenUrl,
    params.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const tokens = response.data;
  saveTokens(tokens);
  return tokens;
}

/**
 * Get a valid access token, refreshing if necessary
 */
export async function getValidAccessToken(config: OAuthConfig): Promise<string> {
  const tokens = loadTokens();

  if (!tokens) {
    throw new Error(
      "Não autenticado. Execute 'tiny-mcp-auth' para fazer login OAuth."
    );
  }

  // Check if refresh token is expired
  if (isRefreshTokenExpired(tokens)) {
    clearTokens();
    throw new Error(
      "Sessão expirada. Execute 'tiny-mcp-auth' para fazer login novamente."
    );
  }

  // Check if access token needs refresh
  if (isAccessTokenExpired(tokens)) {
    try {
      const newTokens = await refreshAccessToken(tokens.refresh_token, config);
      return newTokens.access_token;
    } catch (error) {
      clearTokens();
      throw new Error(
        "Falha ao renovar token. Execute 'tiny-mcp-auth' para fazer login novamente."
      );
    }
  }

  return tokens.access_token;
}

/**
 * Build the authorization URL
 */
export function buildAuthorizationUrl(config: OAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: OAUTH_CONFIG.scope,
    response_type: OAUTH_CONFIG.responseType,
    state: state,
  });

  return `${OAUTH_CONFIG.authorizationUrl}?${params.toString()}`;
}

/**
 * Start local HTTP server to handle OAuth callback
 */
export function startCallbackServer(
  port: number,
  config: OAuthConfig
): Promise<OAuthTokens> {
  return new Promise((resolve, reject) => {
    const state = Math.random().toString(36).substring(2, 15);

    const server = http.createServer(async (req, res) => {
      if (!req.url) {
        res.writeHead(400);
        res.end("Bad Request");
        return;
      }

      const url = new URL(req.url, `http://localhost:${port}`);

      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code");
        const returnedState = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");

        if (error) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #e74c3c;">Erro na Autenticação</h1>
                <p>${errorDescription || error}</p>
                <p>Você pode fechar esta janela.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error(errorDescription || error));
          return;
        }

        if (!code || returnedState !== state) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #e74c3c;">Erro</h1>
                <p>Código de autorização inválido ou state incorreto.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error("Invalid authorization code or state"));
          return;
        }

        try {
          const tokens = await exchangeCodeForTokens(code, config);

          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #27ae60;">Autenticação Concluída!</h1>
                <p>Você foi autenticado com sucesso no Tiny ERP.</p>
                <p>Pode fechar esta janela e voltar ao terminal.</p>
              </body>
            </html>
          `);

          server.close();
          resolve(tokens);
        } catch (err) {
          res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #e74c3c;">Erro</h1>
                <p>Falha ao trocar código por tokens.</p>
                <p>${err instanceof Error ? err.message : "Erro desconhecido"}</p>
              </body>
            </html>
          `);
          server.close();
          reject(err);
        }
      } else {
        res.writeHead(404);
        res.end("Not Found");
      }
    });

    server.listen(port, () => {
      const authUrl = buildAuthorizationUrl(config, state);
      console.log("\n🔐 Autenticação OAuth 2.0 do Tiny ERP");
      console.log("=====================================\n");
      console.log("Abrindo navegador para autenticação...\n");
      console.log("Se o navegador não abrir automaticamente, acesse:");
      console.log(`\n${authUrl}\n`);

      // Try to open browser
      open(authUrl).catch(() => {
        console.log("Não foi possível abrir o navegador automaticamente.");
      });
    });

    server.on("error", (err) => {
      reject(err);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("Timeout: autenticação não completada em 5 minutos"));
    }, 5 * 60 * 1000);
  });
}

/**
 * Run the OAuth authentication flow
 */
export async function authenticate(config: OAuthConfig): Promise<OAuthTokens> {
  // Extract port from redirect URI
  const redirectUrl = new URL(config.redirectUri);
  const port = parseInt(redirectUrl.port) || 8080;

  console.log(`\nIniciando servidor de callback na porta ${port}...`);

  return startCallbackServer(port, config);
}

/**
 * Get OAuth configuration from environment variables
 */
export function getOAuthConfigFromEnv(): OAuthConfig {
  const clientId = process.env.TINY_CLIENT_ID;
  const clientSecret = process.env.TINY_CLIENT_SECRET;
  const redirectUri = process.env.TINY_REDIRECT_URI || "http://localhost:8080/callback";

  if (!clientId || !clientSecret) {
    throw new Error(
      "Variáveis de ambiente TINY_CLIENT_ID e TINY_CLIENT_SECRET são obrigatórias.\n" +
      "Configure-as com as credenciais do seu aplicativo no Tiny ERP."
    );
  }

  return { clientId, clientSecret, redirectUri };
}
