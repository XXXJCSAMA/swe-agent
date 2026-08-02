/**
 * Routes - API 路由定义
 * 
 * 定义 Agent API 的 REST 接口。
 */

import { Router, Request, Response } from "express";
import { Agent } from "../agent/agent.js";

export interface RunRequest {
  task: string;
  apiKey?: string;
  stream?: boolean;
}

export interface TaskStatus {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
  error?: string;
}

/**
 * 创建 Agent 路由
 */
export function createAgentRouter(): Router {
  const router = Router();
  const tasks = new Map<string, TaskStatus>();

  // POST /api/agent/run - 运行 Agent
  router.post("/run", async (req: Request, res: Response) => {
    const { task, apiKey, stream } = req.body as RunRequest;

    if (!task) {
      res.status(400).json({ error: "task is required" });
      return;
    }

    const key = apiKey || process.env.GLM_API_KEY;
    if (!key) {
      res.status(400).json({ error: "API key is required" });
      return;
    }

    if (stream) {
      // Streaming mode
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      });

      const agent = new Agent({
        apiKey: key,
        streaming: {
          onThinking: (text) => {
            res.write(`data: ${JSON.stringify({ type: "thinking", text })}\n\n`);
          },
          onToolCall: (name, args) => {
            res.write(`data: ${JSON.stringify({ type: "tool_call", name, args })}\n\n`);
          },
          onToolResult: (tool, result) => {
            res.write(`data: ${JSON.stringify({ type: "tool_result", tool, result })}\n\n`);
          },
          onFinish: (summary) => {
            res.write(`data: ${JSON.stringify({ type: "finish", summary })}\n\n`);
            res.end();
          },
          onError: (error) => {
            res.write(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`);
            res.end();
          }
        }
      });

      try {
        await agent.run(task);
      } catch (error) {
        res.write(`data: ${JSON.stringify({ type: "error", message: (error as Error).message })}\n\n`);
        res.end();
      }
    } else {
      // Non-streaming mode
      const taskId = `task_${Date.now()}`;
      tasks.set(taskId, { id: taskId, status: "running" });

      const agent = new Agent({ apiKey: key });

      try {
        const result = await agent.run(task);
        tasks.set(taskId, { id: taskId, status: "completed", result });
        res.json({ taskId, status: "completed", result });
      } catch (error) {
        const errorMessage = (error as Error).message;
        tasks.set(taskId, { id: taskId, status: "failed", error: errorMessage });
        res.status(500).json({ taskId, status: "failed", error: errorMessage });
      }
    }
  });

  // GET /api/agent/task/:id - 获取任务状态
  router.get("/task/:id", (req: Request, res: Response) => {
    const task = tasks.get(req.params.id);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    res.json(task);
  });

  // GET /api/agent/tasks - 列出所有任务
  router.get("/tasks", (_req: Request, res: Response) => {
    const list = Array.from(tasks.values());
    res.json({ tasks: list });
  });

  // DELETE /api/agent/task/:id - 删除任务
  router.delete("/task/:id", (req: Request, res: Response) => {
    if (tasks.delete(req.params.id)) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Task not found" });
    }
  });

  return router;
}
