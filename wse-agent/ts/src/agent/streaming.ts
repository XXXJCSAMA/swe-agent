/**
 * Streaming - 流式响应支持
 * 
 * 提供流式输出能力，用于实时显示 Agent 执行过程。
 */

export type StreamEventType = 
  | "thinking"
  | "tool_call_start"
  | "tool_call_end"
  | "tool_result"
  | "step_complete"
  | "error"
  | "finish";

export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
  timestamp: number;
}

export interface StreamingOptions {
  onEvent?: (event: StreamEvent) => void;
  onThinking?: (text: string) => void;
  onToolCall?: (name: string, args: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: unknown) => void;
  onFinish?: (summary: string) => void;
  onError?: (error: Error) => void;
}

/**
 * 创建流事件
 */
export function createStreamEvent(
  type: StreamEventType,
  data: unknown
): StreamEvent {
  return {
    type,
    data,
    timestamp: Date.now()
  };
}

/**
 * Streaming Handler 类
 */
export class StreamingHandler {
  private options: StreamingOptions;
  private eventLog: StreamEvent[] = [];

  constructor(options: StreamingOptions) {
    this.options = options;
  }

  emit(type: StreamEventType, data: unknown): void {
    const event = createStreamEvent(type, data);
    this.eventLog.push(event);
    this.options.onEvent?.(event);

    switch (type) {
      case "thinking":
        this.options.onThinking?.(data as string);
        break;
      case "tool_call_end":
        const { name, args } = data as { name: string; args: Record<string, unknown> };
        this.options.onToolCall?.(name, args);
        break;
      case "tool_result":
        const { tool, result } = data as { tool: string; result: unknown };
        this.options.onToolResult?.(tool, result);
        break;
      case "finish":
        this.options.onFinish?.(data as string);
        break;
      case "error":
        this.options.onError?.(data as Error);
        break;
    }
  }

  getEventLog(): StreamEvent[] {
    return [...this.eventLog];
  }

  clearLog(): void {
    this.eventLog = [];
  }
}

/**
 * 格式化流事件为可读文本
 */
export function formatStreamEvent(event: StreamEvent): string {
  switch (event.type) {
    case "thinking":
      return `[思考] ${event.data}`;
    case "tool_call_start":
      return `[调用工具] ${event.data}`;
    case "tool_call_end":
      const { name, args } = event.data as { name: string; args: Record<string, unknown> };
      return `[工具调用] ${name}(${JSON.stringify(args)})`;
    case "tool_result":
      const { tool, result } = event.data as { tool: string; result: unknown };
      return `[${tool}] ${String(result).slice(0, 200)}`;
    case "step_complete":
      return `[步骤完成] Step ${event.data}`;
    case "error":
      return `[错误] ${event.data}`;
    case "finish":
      return `[完成] ${event.data}`;
    default:
      return `[${event.type}] ${JSON.stringify(event.data)}`;
  }
}
