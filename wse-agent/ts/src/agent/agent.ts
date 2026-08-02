/**
 * Agent - 自主任务执行 Agent (TypeScript)
 * 
 * 负责与 GLM API 交互，根据任务指令自主调用工具完成任务。
 */

import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/beta/chat/completions";
import { getToolsSchema, SYSTEM_PROMPT } from "./tools.js";
import {
  createRuntimeState,
  checkStepCap,
  applySlidingWindow,
  checkDeadLoop,
  resetRuntime,
  DEFAULT_CONFIG,
  type RuntimeConfig,
  type RuntimeState
} from "./runtime.js";
import { StreamingHandler, type StreamingOptions } from "./streaming.js";
import { executeTool } from "./executor.js";

export interface AgentConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  runtime?: RuntimeConfig;
  streaming?: StreamingOptions;
}

export interface ToolResult {
  toolCallId: string;
  output: string;
  isError: boolean;
}

/**
 * Agent 主类
 */
export class Agent {
  private client: OpenAI;
  private config: RuntimeConfig;
  private streaming: StreamingHandler | null = null;

  constructor(config: AgentConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || "https://open.bigmodel.cn/api/paas/v4"
    });
    this.config = config.runtime || DEFAULT_CONFIG;

    if (config.streaming) {
      this.streaming = new StreamingHandler(config.streaming);
    }
  }

  /**
   * 运行 Agent 执行任务
   */
  async run(task: string): Promise<string> {
    const state = createRuntimeState();
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: task }
    ];

    while (state.isRunning) {
      // 1. Step cap 检测
      if (!checkStepCap(state, this.config)) {
        return this.handleMaxSteps(messages);
      }

      // 2. Sliding window
      messages.splice(0, messages.length, ...applySlidingWindow(messages, this.config));

      // 3. 调用 LLM
      this.streaming?.emit("thinking", `Step ${state.step}: 正在思考...`);
      
      const response = await this.client.chat.completions.create({
        model: "glm-4-flash",
        messages,
        tools: getToolsSchema(),
        tool_choice: "auto"
      });

      const message = response.choices[0].message;

      // 4. 判断返回类型
      if (message.tool_calls && message.tool_calls.length > 0) {
        // 死循环检测
        const commands = message.tool_calls.map(tc => tc.function.arguments || "");
        const loop = checkDeadLoop(state, commands);
        if (loop.detected) {
          return this.handleDeadLoop(state.step, loop.command);
        }

        // 执行工具
        const results: ToolResult[] = [];
        for (const tc of message.tool_calls) {
          this.streaming?.emit("tool_call_end", {
            name: tc.function.name,
            args: tc.function.arguments ? JSON.parse(tc.function.arguments) : {}
          });

          const result = await executeTool(tc.function.name, tc.function.arguments || "{}", tc.id || "");
          results.push(result);

          this.streaming?.emit("tool_result", { tool: tc.function.name, result: result.output });

          // 检查 finish
          if (tc.function.name === "finish") {
            const args = JSON.parse(tc.function.arguments || "{}");
            const summary = args.summary || "";
            this.streaming?.emit("finish", summary);
            return summary;
          }
        }

        // 添加到 messages
        messages.push(message as ChatCompletionMessageParam);
        for (const result of results) {
          messages.push({
            role: "tool",
            tool_call_id: result.toolCallId,
            content: result.output
          });
        }

        this.streaming?.emit("step_complete", state.step);
      } else {
        // LLM 直接回复
        const content = message.content || "";
        this.streaming?.emit("finish", content);
        return content;
      }
    }

    return "Agent stopped";
  }

  /**
   * 处理超出最大步数
   */
  private async handleMaxSteps(messages: ChatCompletionMessageParam[]): Promise<string> {
    messages.push({
      role: "user",
      content: "任务已达到最大步数限制，请调用 finish 总结已完成的工作。"
    });

    const response = await this.client.chat.completions.create({
      model: "glm-4-flash",
      messages,
      tools: getToolsSchema()
    });

    const message = response.choices[0].message;
    if (message.tool_calls) {
      for (const tc of message.tool_calls) {
        if (tc.function.name === "finish") {
          const args = JSON.parse(tc.function.arguments || "{}");
          return args.summary || "任务超时，未能完成";
        }
      }
    }

    return "任务超时，未能完成";
  }

  /**
   * 处理死循环
   */
  private handleDeadLoop(step: number, command: string): string {
    const summary = `检测到重复操作导致死循环，任务在第 ${step} 步被强制终止。`;
    this.streaming?.emit("error", new Error(summary));
    this.streaming?.emit("finish", summary);
    return summary;
  }

  /**
   * 重置 Agent 状态
   */
  reset(): void {
    // Runtime state is reset per-run
  }
}

/**
 * 命令行入口
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log("用法: npx tsx src/agent/agent.ts <任务描述>");
    console.log("或设置环境变量 GLM_API_KEY");
    process.exit(1);
  }

  const task = args.join(" ");
  const apiKey = process.env.GLM_API_KEY;

  if (!apiKey) {
    console.error("错误: 请设置 GLM_API_KEY 环境变量");
    process.exit(1);
  }

  const agent = new Agent({
    apiKey,
    streaming: {
      onThinking: (text) => console.log(`[思考] ${text}`),
      onToolCall: (name, args) => console.log(`[调用] ${name}(${JSON.stringify(args)})`),
      onToolResult: (tool, result) => console.log(`[结果] ${tool}: ${String(result).slice(0, 100)}`),
      onFinish: (summary) => console.log(`\n[完成] ${summary}`)
    }
  });

  const result = await agent.run(task);
  console.log(`\n最终结果: ${result}`);
}
