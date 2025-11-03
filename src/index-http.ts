import express from "express";
import cors from "cors";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createIBMCPServer } from "./server.js";

try {
  const PORT = process.env.PORT || process.env.MCP_PORT || 8000;

  console.log(`🚀 Starting Interactive Brokers MCP Server in HTTP/SSE mode on port ${PORT}`);

  const app = express();
  app.use(cors());
  app.use(express.json());

  // Store active SSE transports
  const transports: { [sessionId: string]: SSEServerTransport } = {};

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      service: 'interactive-brokers-mcp',
      transport: 'http/sse' 
    });
  });

  // SSE endpoint - establishes the server-to-client event stream
  app.get('/mcp', async (req, res) => {
    console.log('📡 New SSE connection request received');
    
    try {
      // Create SSE transport
      const transport = new SSEServerTransport('/mcp/messages', res);
      const sessionId = transport.sessionId;
      transports[sessionId] = transport;

      console.log(`✅ SSE transport created with session ID: ${sessionId}`);

      // Create a new MCP server instance for this connection
      const server = createIBMCPServer({ config: {} });

      // Handle transport closure
      res.on("close", () => {
        console.log(`🔌 SSE connection closed for session: ${sessionId}`);
        delete transports[sessionId];
      });

      // Connect the server to the transport
      await server.connect(transport);
      console.log(`🔗 MCP server connected to SSE transport: ${sessionId}`);
    } catch (error) {
      console.error('❌ Failed to connect MCP server to SSE transport:', error);
      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }
    }
  });

  // Message endpoint - receives client-to-server messages
  app.post('/mcp/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    console.log(`📨 Received message for session: ${sessionId}`);

    const transport = transports[sessionId];
    if (transport) {
      try {
        await transport.handlePostMessage(req, res, req.body);
      } catch (error) {
        console.error('❌ Error handling POST message:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    } else {
      console.warn(`⚠️ No transport found for session ID: ${sessionId}`);
      res.status(400).json({ error: 'No transport found for sessionId' });
    }
  });

  // Start the server
  const server = app.listen(PORT, () => {
    console.log(`✅ HTTP/SSE server listening on http://localhost:${PORT}`);
    console.log(`📡 SSE endpoint: http://localhost:${PORT}/mcp`);
    console.log(`📨 Messages endpoint: http://localhost:${PORT}/mcp/messages`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  });

  // Handle server errors
  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use`);
      process.exit(1);
    } else {
      console.error('❌ Server error:', error);
      process.exit(1);
    }
  });

} catch (error) {
  console.error('❌ Fatal error starting HTTP/SSE server:', error);
  process.exit(1);
}
