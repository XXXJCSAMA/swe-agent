"""Agent - 自主任务执行 Agent

负责与 GLM API 交互，根据任务指令自主调用工具完成任务。
"""
import json
import os
from openai import OpenAI
from parser import process_tool_calls, execute_tool_call, parse_and_execute


# ============ 配置 ============
MAX_STEPS = 20
MAX_HISTORY = 10
MODEL = "glm-4-flash"

# ============ System Prompt ============
SYSTEM_PROMPT = """
你是一个自主执行任务的 AI Agent。

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
summary 字段简洁描述结果，例如："成功创建 hello.py 文件"
"""

# ============ 工具 Schema ============
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "run_shell",
            "description": "执行 Shell 命令，返回标准输出和错误信息",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "要执行的 Shell 命令"
                    },
                    "timeout": {
                        "type": "number",
                        "description": "超时时间（秒），默认 60"
                    }
                },
                "required": ["command"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "读取文件内容，支持分页",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "文件路径"
                    },
                    "start_line": {
                        "type": "integer",
                        "description": "起始行号（从 1 开始），默认 1"
                    },
                    "end_line": {
                        "type": "integer",
                        "description": "结束行号，默认 200（自动分页）"
                    }
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "写入文件内容",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "文件路径"
                    },
                    "content": {
                        "type": "string",
                        "description": "文件内容"
                    },
                    "mode": {
                        "type": "string",
                        "description": "写入模式：overwrite（默认）或 append"
                    }
                },
                "required": ["path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "finish",
            "description": "标记任务完成，结束 Agent 执行",
            "parameters": {
                "type": "object",
                "properties": {
                    "summary": {
                        "type": "string",
                        "description": "任务执行结果的简明总结"
                    }
                },
                "required": ["summary"]
            }
        }
    }
]


class Agent:
    """自主任务执行 Agent"""
    
    def __init__(self, api_key: str, base_url: str = "https://open.bigmodel.cn/api/paas/v4"):
        """初始化 Agent
        
        Args:
            api_key: GLM API 密钥
            base_url: API 基础地址（默认使用智谱 API）
        """
        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.messages = []
        self.recent_commands = []
        self.step = 0
    
    def reset(self):
        """重置 Agent 状态"""
        self.messages = []
        self.recent_commands = []
        self.step = 0
    
    def run(self, task: str) -> str:
        """运行 Agent 执行任务
        
        Args:
            task: 任务描述
            
        Returns:
            任务执行结果（summary）
        """
        self.reset()
        
        # 初始化 messages
        self.messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": task}
        ]
        
        while True:
            # 1. step cap 检测
            self.step += 1
            if self.step > MAX_STEPS:
                return self._handle_max_steps()
            
            # 2. sliding window（保留 system + 最近 N 条消息）
            # system message 在 messages[0]，永远保留
            # 只截断历史对话部分
            if len(self.messages) > MAX_HISTORY + 1:
                self.messages = [self.messages[0]] + self.messages[-(MAX_HISTORY):]
            
            # 3. 调用 LLM
            response = self.client.chat.completions.create(
                model=MODEL,
                messages=self.messages,
                tools=TOOLS,
                tool_choice="auto"
            )
            
            msg = response.choices[0].message
            
            # 4. 判断返回类型
            if msg.tool_calls:
                # 死循环检测：检查是否有重复命令
                for tc in msg.tool_calls:
                    command = tc.function.arguments
                    if len(self.recent_commands) >= 2:
                        if (self.recent_commands[-1] == command and 
                            self.recent_commands[-2] == command):
                            print(f"[Agent] 检测到死循环（step {self.step}），强制终止")
                            return self._handle_dead_loop()
                    self.recent_commands.append(command)
                    self.recent_commands = self.recent_commands[-3:]
                
                # 执行工具
                results = process_tool_calls(msg.tool_calls)
                
                # 把 assistant 消息加入 messages
                self.messages.append(msg.model_dump(exclude_none=True))
                
                # 把 tool 结果加入 messages
                for r in results:
                    self.messages.append({
                        "role": "tool",
                        "tool_call_id": r["tool_call_id"],
                        "content": r["output"]
                    })
                
                # 检查是否调用了 finish
                for tc in msg.tool_calls:
                    if tc.function.name == "finish":
                        args = json.loads(tc.function.arguments)
                        summary = args.get("summary", "")
                        print(f"[Agent] 任务完成: {summary}")
                        return summary
            
            else:
                # LLM 直接回复，没有调用工具
                content = msg.content or ""
                print(f"[Agent] {content}")
                return content
    
    def _handle_max_steps(self) -> str:
        """处理超出最大步数的情况"""
        print(f"[Agent] 超出最大步数（{MAX_STEPS}），强制结束任务")
        
        # 尝试让 LLM 总结已完成的工作
        self.messages.append({
            "role": "user",
            "content": "任务已达到最大步数限制，请调用 finish 总结已完成的工作。"
        })
        
        response = self.client.chat.completions.create(
            model=MODEL,
            messages=self.messages,
            tools=TOOLS
        )
        
        msg = response.choices[0].message
        
        # 如果 LLM 返回了 finish，提取 summary
        if msg.tool_calls:
            for tc in msg.tool_calls:
                if tc.function.name == "finish":
                    args = json.loads(tc.function.arguments)
                    return args.get("summary", "任务超时，未能完成")
        
        return "任务超时，未能完成"
    
    def _handle_dead_loop(self) -> str:
        """处理死循环情况"""
        # 强制调用 finish
        result = parse_and_execute("finish", {
            "summary": f"检测到重复操作导致死循环，任务在第 {self.step} 步被强制终止。"
        })
        return result.get("summary", "任务因死循环被终止")


def main():
    """命令行入口"""
    import sys
    
    if len(sys.argv) < 2:
        print("用法: python agent.py <任务描述>")
        sys.exit(1)
    
    task = sys.argv[1]
    api_key = os.environ.get("GLM_API_KEY")
    
    if not api_key:
        print("错误: 请设置 GLM_API_KEY 环境变量")
        sys.exit(1)
    
    agent = Agent(api_key=api_key)
    result = agent.run(task)
    print(f"\n最终结果: {result}")


if __name__ == "__main__":
    main()
