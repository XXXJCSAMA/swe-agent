/**
 * Tools Schema - 工具定义
 * 
 * 定义所有可用工具的 schema，用于 LLM 函数调用和参数验证。
 */

export interface ToolParam {
  type: string;
  description: string;
  default?: unknown;
  required?: boolean;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, Omit<ToolParam, "required">>;
    required?: string[];
  };
}

/**
 * 内置工具列表
 */
export const BUILTIN_TOOLS: ToolSchema[] = [
  {
    name: "run_shell",
    description: "执行 Shell 命令，返回标准输出和错误信息",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "要执行的 Shell 命令"
        },
        timeout: {
          type: "number",
          description: "超时时间（秒），默认 60"
        }
      },
      required: ["command"]
    }
  },
  {
    name: "read_file",
    description: "读取文件内容，支持分页",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "文件路径"
        },
        start_line: {
          type: "number",
          description: "起始行号（从 1 开始），默认 1"
        },
        end_line: {
          type: "number",
          description: "结束行号，默认 200（自动分页）"
        }
      },
      required: ["path"]
    }
  },
  {
    name: "write_file",
    description: "写入文件内容",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "文件路径"
        },
        content: {
          type: "string",
          description: "文件内容"
        },
        mode: {
          type: "string",
          description: "写入模式：overwrite（默认）或 append"
        }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "finish",
    description: "标记任务完成，结束 Agent 执行",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "任务执行结果的简明总结"
        }
      },
      required: ["summary"]
    }
  }
];

/**
 * 系统提示词
 */
export const SYSTEM_PROMPT = `你是一个自主执行任务的 AI Agent。

## 你拥有以下工具
- run_shell: 执行 Shell 命令，适用于运行程序、查看目录、搜索文件等操作。
- read_file: 读取文件内容，可按行读取，用于分析或理解代码和文本。
- write_file: 写入或覆盖文件内容，用于创建或修改文件。
- finish: 当任务完成或无法继续时，调用该工具结束任务。

## 执行规则
1. 收到任务后，先分析需要完成什么，再决定是否调用工具，不要盲目执行。
2. 如果缺少必要信息，不要猜测，先通过工具获取信息。
3. 如果工具执行失败，阅读错误信息，尝试修正后重新执行；无法解决则调用 finish 说明原因。
4. 如果问题无需工具即可回答，直接调用 finish 返回答案。

## 完成任务
任务完成后必须调用 finish 工具，不要直接输出最终答案。
summary 字段简洁描述结果，例如："成功创建 hello.py 文件"`;

/**
 * 获取所有工具的 OpenAI 格式 schema
 */
export function getToolsSchema(): object[] {
  return BUILTIN_TOOLS.map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
}
