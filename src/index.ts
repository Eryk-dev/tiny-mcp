#!/usr/bin/env node
/**
 * Tiny ERP MCP Server
 *
 * MCP server for integrating with Tiny ERP (Olist) API.
 * Provides tools for managing products, orders, invoices, contacts, and more.
 *
 * Authentication: OAuth 2.0 via Keycloak
 * Run 'npx tiny-mcp-auth' to authenticate before using the server.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initializeApiClient, isAuthenticated } from "./services/api-client.js";
import { loadTokens, isRefreshTokenExpired } from "./services/oauth.js";

// Import tool registration functions
import { registerProductTools } from "./tools/products.js";
import { registerOrderTools } from "./tools/orders.js";
import { registerInvoiceTools } from "./tools/invoices.js";
import { registerContactTools } from "./tools/contacts.js";
import { registerCRMTools } from "./tools/crm.js";
import { registerFinanceTools } from "./tools/finance.js";
import { registerPurchaseTools } from "./tools/purchases.js";
import { registerServiceOrderTools } from "./tools/service-orders.js";
import { registerShippingTools } from "./tools/shipping.js";
import { registerAuxiliaryTools } from "./tools/auxiliary.js";

// Create MCP server instance
const server = new McpServer({
  name: "tiny-mcp-server",
  version: "1.0.0"
});

/**
 * Register all tools with the server
 */
function registerAllTools(): void {
  registerProductTools(server);
  registerOrderTools(server);
  registerInvoiceTools(server);
  registerContactTools(server);
  registerCRMTools(server);
  registerFinanceTools(server);
  registerPurchaseTools(server);
  registerServiceOrderTools(server);
  registerShippingTools(server);
  registerAuxiliaryTools(server);
}

/**
 * Check authentication status and warn if needed
 */
function checkAuthStatus(): void {
  // Check for OAuth credentials
  const clientId = process.env.TINY_CLIENT_ID;
  const clientSecret = process.env.TINY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("⚠️  TINY_CLIENT_ID e TINY_CLIENT_SECRET não configurados.");
    console.error("Configure as variáveis de ambiente com as credenciais OAuth do Tiny ERP.");
    console.error("");
    console.error("Exemplo:");
    console.error("  export TINY_CLIENT_ID=\"seu-client-id\"");
    console.error("  export TINY_CLIENT_SECRET=\"seu-client-secret\"");
    console.error("");
  }

  // Check for stored tokens
  const tokens = loadTokens();

  if (!tokens) {
    console.error("⚠️  Não autenticado no Tiny ERP.");
    console.error("Execute 'npx tiny-mcp-auth' para fazer login OAuth.");
    console.error("");
  } else if (isRefreshTokenExpired(tokens)) {
    console.error("⚠️  Sessão expirada.");
    console.error("Execute 'npx tiny-mcp-auth' para fazer login novamente.");
    console.error("");
  }
}

/**
 * Main function to run the MCP server
 */
async function main(): Promise<void> {
  // Check authentication status (warnings only, don't block startup)
  checkAuthStatus();

  // Initialize API client
  initializeApiClient();

  // Register all tools
  registerAllTools();

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Tiny ERP MCP server running via stdio");
}

// Run the server
main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
