#!/usr/bin/env node
/**
 * HTTP Server for Tiny ERP MCP Server (Cloud Deployment)
 *
 * Implements the MCP Streamable HTTP transport for cloud deployment.
 * Supports both POST (client messages) and GET (SSE streams) methods.
 *
 * Usage:
 *   npx tiny-mcp-http                    # Start HTTP server on port 3000
 *   PORT=8080 npx tiny-mcp-http          # Custom port
 */

import http from "http";
import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
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
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",") || ["*"];

// Session management
interface Session {
  id: string;
  server: McpServer;
  transport: SSEServerTransport;
  createdAt: number;
  lastActivity: number;
}

const sessions = new Map<string, Session>();

// Session timeout (30 minutes of inactivity)
const SESSION_TIMEOUT = 30 * 60 * 1000;

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
 * Validate Origin header for security
 */
function validateOrigin(origin: string | undefined): boolean {
  if (ALLOWED_ORIGINS.includes("*")) {
    return true;
  }
  if (!origin) {
    return false;
  }
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Clean up expired sessions
 */
function cleanupSessions(): void {
  const now = Date.now();
  for (const [sessionId, session] of sessions) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      console.log(`Cleaning up expired session: ${sessionId}`);
      sessions.delete(sessionId);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupSessions, 5 * 60 * 1000);

/**
 * Handle CORS preflight requests
 */
function handleCors(
  req: http.IncomingMessage,
  res: http.ServerResponse
): boolean {
  const origin = req.headers.origin;

  // Set CORS headers
  if (origin && validateOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (ALLOWED_ORIGINS.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Mcp-Session-Id, Authorization"
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  res.setHeader("Access-Control-Max-Age", "86400");

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }

  return false;
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
 * Send JSON response
 */
function sendJson(
  res: http.ServerResponse,
  status: number,
  data: unknown
): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify(data));
}

/**
 * Send error response
 */
function sendError(
  res: http.ServerResponse,
  status: number,
  message: string
): void {
  sendJson(res, status, { error: message });
}

/**
 * Main HTTP request handler
 */
async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  // Handle CORS
  if (handleCors(req, res)) {
    return;
  }

  // Validate origin for non-GET requests
  if (req.method !== "GET" && !validateOrigin(req.headers.origin)) {
    sendError(res, 403, "Invalid origin");
    return;
  }

  // Health check endpoint
  if (url.pathname === "/health" && req.method === "GET") {
    sendJson(res, 200, {
      status: "healthy",
      service: "tiny-mcp-server",
      timestamp: new Date().toISOString(),
      activeSessions: sessions.size,
    });
    return;
  }

  // MCP endpoint
  if (url.pathname === "/mcp" || url.pathname === "/sse") {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    // GET - Start SSE stream for server-to-client messages
    if (req.method === "GET") {
      // Create new session
      const newSessionId = randomUUID();
      const server = createMcpServer();
      const transport = new SSEServerTransport("/mcp", res);

      const session: Session = {
        id: newSessionId,
        server,
        transport,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };

      sessions.set(newSessionId, session);

      // Set session header
      res.setHeader("Mcp-Session-Id", newSessionId);

      console.log(`New session created: ${newSessionId}`);

      // Connect server to transport
      await server.connect(transport);

      // Clean up on close
      req.on("close", () => {
        console.log(`Session closed: ${newSessionId}`);
        sessions.delete(newSessionId);
      });

      return;
    }

    // POST - Handle client-to-server messages
    if (req.method === "POST") {
      if (!sessionId) {
        sendError(res, 400, "Missing Mcp-Session-Id header");
        return;
      }

      const session = sessions.get(sessionId);
      if (!session) {
        sendError(res, 404, "Session not found");
        return;
      }

      // Update last activity
      session.lastActivity = Date.now();

      try {
        const body = await parseBody(req);

        // Forward message to transport
        await session.transport.handlePostMessage(req, res, body);
      } catch (error) {
        console.error("Error handling POST:", error);
        sendError(
          res,
          500,
          error instanceof Error ? error.message : "Internal error"
        );
      }

      return;
    }

    // DELETE - Close session
    if (req.method === "DELETE") {
      if (!sessionId) {
        sendError(res, 400, "Missing Mcp-Session-Id header");
        return;
      }

      const session = sessions.get(sessionId);
      if (session) {
        sessions.delete(sessionId);
        console.log(`Session deleted: ${sessionId}`);
      }

      res.writeHead(204);
      res.end();
      return;
    }
  }

  // Not found
  sendError(res, 404, "Not found");
}

/**
 * Start the HTTP server
 */
async function main(): Promise<void> {
  // Initialize API client
  initializeApiClient();

  // Create HTTP server
  const server = http.createServer(async (req, res) => {
    try {
      await handleRequest(req, res);
    } catch (error) {
      console.error("Request error:", error);
      if (!res.headersSent) {
        sendError(res, 500, "Internal server error");
      }
    }
  });

  // Start server
  server.listen(PORT, HOST, () => {
    console.log(`\n🚀 Tiny ERP MCP HTTP Server`);
    console.log(`===========================\n`);
    console.log(`Server running at http://${HOST}:${PORT}`);
    console.log(`\nEndpoints:`);
    console.log(`  GET  /health  - Health check`);
    console.log(`  GET  /mcp     - Start SSE session`);
    console.log(`  POST /mcp     - Send message to session`);
    console.log(`  DELETE /mcp   - Close session`);
    console.log(`\nEnvironment variables:`);
    console.log(`  PORT            - Server port (default: 3000)`);
    console.log(`  HOST            - Server host (default: 0.0.0.0)`);
    console.log(`  ALLOWED_ORIGINS - Comma-separated allowed origins (default: *)`);
    console.log(`  TINY_CLIENT_ID  - OAuth client ID`);
    console.log(`  TINY_CLIENT_SECRET - OAuth client secret`);
    console.log(`\n✅ Ready for connections\n`);
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
