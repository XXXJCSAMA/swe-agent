/**
 * Server - API 服务器
 * 
 * 启动 Express 服务器提供 Agent API。
 */

import express from "express";
import cors from "cors";
import { createAgentRouter } from "./routes.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api/agent", createAgentRouter());

// Start server
app.listen(PORT, () => {
  console.log(`[API Server] Running on http://localhost:${PORT}`);
  console.log(`[API Server] Endpoints:`);
  console.log(`  POST /api/agent/run - Run agent task`);
  console.log(`  GET  /api/agent/task/:id - Get task status`);
  console.log(`  GET  /api/agent/tasks - List all tasks`);
  console.log(`  DELETE /api/agent/task/:id - Delete task`);
});

export { app };
