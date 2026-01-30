#!/usr/bin/env node
/**
 * CLI tool for Tiny ERP OAuth 2.0 authentication
 *
 * Usage:
 *   npx tiny-mcp-auth          # Start OAuth flow
 *   npx tiny-mcp-auth status   # Check authentication status
 *   npx tiny-mcp-auth logout   # Clear stored tokens
 */

import {
  authenticate,
  getOAuthConfigFromEnv,
  loadTokens,
  clearTokens,
  isAccessTokenExpired,
  isRefreshTokenExpired,
} from "./services/oauth.js";

async function main() {
  const command = process.argv[2] || "login";

  switch (command) {
    case "login":
      await login();
      break;
    case "status":
      checkStatus();
      break;
    case "logout":
      logout();
      break;
    case "help":
    case "--help":
    case "-h":
      showHelp();
      break;
    default:
      console.error(`Comando desconhecido: ${command}`);
      showHelp();
      process.exit(1);
  }
}

async function login() {
  console.log("\n🔐 Autenticação Tiny ERP MCP Server");
  console.log("===================================\n");

  try {
    const config = getOAuthConfigFromEnv();

    console.log("Configuração OAuth:");
    console.log(`  Client ID: ${config.clientId.substring(0, 8)}...`);
    console.log(`  Redirect URI: ${config.redirectUri}\n`);

    const tokens = await authenticate(config);

    console.log("\n✅ Autenticação bem-sucedida!");
    console.log(`\nToken de acesso válido por: ${Math.round(tokens.expires_in / 60)} minutos`);
    console.log(`Token de refresh válido por: ${Math.round(tokens.refresh_expires_in / 3600)} horas`);
    console.log("\nAgora você pode usar o MCP server com o Tiny ERP.");

  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ Erro: ${error.message}`);
    } else {
      console.error("\n❌ Erro desconhecido durante autenticação");
    }
    process.exit(1);
  }
}

function checkStatus() {
  console.log("\n🔍 Status da Autenticação Tiny ERP");
  console.log("===================================\n");

  const tokens = loadTokens();

  if (!tokens) {
    console.log("❌ Não autenticado");
    console.log("\nExecute 'npx tiny-mcp-auth' para fazer login.");
    return;
  }

  const now = Date.now();

  // Check access token
  if (isAccessTokenExpired(tokens)) {
    console.log("⚠️  Access token expirado (será renovado automaticamente)");
  } else {
    const accessExpiresIn = tokens.access_token_expires_at! - now;
    console.log(`✅ Access token válido por: ${Math.round(accessExpiresIn / 60000)} minutos`);
  }

  // Check refresh token
  if (isRefreshTokenExpired(tokens)) {
    console.log("❌ Refresh token expirado");
    console.log("\nExecute 'npx tiny-mcp-auth' para fazer login novamente.");
  } else {
    const refreshExpiresIn = tokens.refresh_token_expires_at! - now;
    console.log(`✅ Refresh token válido por: ${Math.round(refreshExpiresIn / 3600000)} horas`);
  }

  console.log("\n📁 Tokens armazenados em: ~/.tiny-mcp/tokens.json");
}

function logout() {
  console.log("\n🚪 Logout Tiny ERP");
  console.log("==================\n");

  const tokens = loadTokens();

  if (!tokens) {
    console.log("Você já está deslogado.");
    return;
  }

  clearTokens();
  console.log("✅ Tokens removidos com sucesso.");
  console.log("Você foi desconectado do Tiny ERP.");
}

function showHelp() {
  console.log(`
Tiny ERP MCP Server - Ferramenta de Autenticação OAuth 2.0

Uso:
  npx tiny-mcp-auth [comando]

Comandos:
  login    Iniciar fluxo de autenticação OAuth (padrão)
  status   Verificar status da autenticação
  logout   Remover tokens armazenados
  help     Mostrar esta ajuda

Variáveis de Ambiente Necessárias:
  TINY_CLIENT_ID      ID do aplicativo OAuth no Tiny ERP
  TINY_CLIENT_SECRET  Secret do aplicativo OAuth
  TINY_REDIRECT_URI   URI de redirecionamento (padrão: http://localhost:8080/callback)

Exemplo:
  export TINY_CLIENT_ID="seu-client-id"
  export TINY_CLIENT_SECRET="seu-client-secret"
  npx tiny-mcp-auth

Para obter as credenciais OAuth:
  1. Acesse o Tiny ERP
  2. Vá em Integrações > Aplicativos API V3
  3. Crie um novo aplicativo
  4. Copie o Client ID e Client Secret
`);
}

main().catch((error) => {
  console.error("Erro fatal:", error);
  process.exit(1);
});
