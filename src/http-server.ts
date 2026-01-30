#!/usr/bin/env node
/**
 * HTTP Server for Tiny ERP MCP Server (Cloud Deployment)
 *
 * Implements the MCP Streamable HTTP transport for cloud deployment.
 * Uses stateless mode - each request is independent.
 *
 * Usage:
 *   npx tiny-mcp-http                    # Start HTTP server on port 3000
 *   PORT=8080 npx tiny-mcp-http          # Custom port
 */

import http from "http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { initializeApiClient } from "./services/api-client.js";

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

// Configuration
const PORT = parseInt(process.env.PORT || "3000");
const HOST = process.env.HOST || "0.0.0.0";

/**
 * Create a new MCP server instance with all tools registered
 */
function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "tiny-mcp-server",
    version: "1.0.0",
  });

  // Register all tools
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

  return server;
}

/**
 * Send JSON response
 */
function sendJson(
  res: http.ServerResponse,
  status: number,
  data: unknown
): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
  });
  res.end(JSON.stringify(data));
}

/**
 * Parse JSON body from request
 */
async function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : null);
      } catch (e) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

/**
 * Main HTTP request handler
 */
async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }

  // Root endpoint
  if (url.pathname === "/" && req.method === "GET") {
    sendJson(res, 200, {
      service: "tiny-mcp-server",
      version: "1.0.0",
      status: "running",
      endpoints: {
        health: "/health",
        mcp: "/mcp",
      },
    });
    return;
  }

  // Health check endpoint
  if (url.pathname === "/health" && req.method === "GET") {
    sendJson(res, 200, {
      status: "healthy",
      service: "tiny-mcp-server",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // MCP endpoint - POST only (stateless)
  if (url.pathname === "/mcp") {
    if (req.method === "POST") {
      // Create a fresh server and transport for each request (stateless)
      const server = createMcpServer();

      try {
        // Create stateless transport (sessionIdGenerator: undefined)
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });

        // Connect server to transport
        await server.connect(transport);

        // Parse the request body
        const body = await parseBody(req);

        // Handle the request
        await transport.handleRequest(req, res, body);

        // Clean up when response is finished
        res.on("close", () => {
          transport.close();
          server.close();
        });
      } catch (error) {
        console.error("Error handling MCP request:", error);
        if (!res.headersSent) {
          sendJson(res, 500, {
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "Internal server error",
            },
            id: null,
          });
        }
      }
      return;
    }

    // GET and DELETE not supported in stateless mode
    if (req.method === "GET" || req.method === "DELETE") {
      sendJson(res, 405, {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed. Use POST for stateless MCP requests.",
        },
        id: null,
      });
      return;
    }
  }

  // Not found
  sendJson(res, 404, { error: "Not found" });
}

/**
 * Start the HTTP server
 */
async function main(): Promise<void> {
  console.log(`\n========================================`);
  console.log(`Tiny ERP MCP HTTP Server - Starting`);
  console.log(`========================================\n`);
  console.log(`[${new Date().toISOString()}] Initializing server...`);

  // Log environment
  console.log(`\nConfiguration:`);
  console.log(`   PORT: ${PORT}`);
  console.log(`   HOST: ${HOST}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || "development"}`);
  console.log(`   Mode: Stateless HTTP`);

  // Check for OAuth credentials
  const clientId = process.env.TINY_CLIENT_ID;
  const clientSecret = process.env.TINY_CLIENT_SECRET;
  const hasTokens = !!process.env.TINY_TOKENS;

  console.log(`\nOAuth Status:`);
  console.log(`   TINY_CLIENT_ID: ${clientId ? "Set" : "Missing"}`);
  console.log(`   TINY_CLIENT_SECRET: ${clientSecret ? "Set" : "Missing"}`);
  console.log(`   TINY_TOKENS: ${hasTokens ? "Set" : "Not set (will use file)"}`);

  if (!clientId || !clientSecret) {
    console.warn(`\nOAuth credentials not configured.`);
    console.warn(
      `   API calls will fail until TINY_CLIENT_ID and TINY_CLIENT_SECRET are set.`
    );
  }

  // Initialize API client
  console.log(`\n[${new Date().toISOString()}] Initializing API client...`);
  initializeApiClient();
  console.log(`[${new Date().toISOString()}] API client initialized.`);

  // Create HTTP server
  console.log(`[${new Date().toISOString()}] Creating HTTP server...`);
  const server = http.createServer(async (req, res) => {
    try {
      await handleRequest(req, res);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Request error:`, error);
      if (!res.headersSent) {
        sendJson(res, 500, { error: "Internal server error" });
      }
    }
  });

  // Start server
  console.log(
    `[${new Date().toISOString()}] Starting server on ${HOST}:${PORT}...`
  );
  server.listen(PORT, HOST, () => {
    console.log(`\n========================================`);
    console.log(`Server running at http://${HOST}:${PORT}`);
    console.log(`========================================`);
    console.log(`\nEndpoints:`);
    console.log(`   GET  /        - Server info`);
    console.log(`   GET  /health  - Health check`);
    console.log(`   POST /mcp     - MCP requests (stateless)`);
    console.log(`\n[${new Date().toISOString()}] Ready for connections!\n`);
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });

  process.on("SIGTERM", () => {
    console.log("\nShutting down...");
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
