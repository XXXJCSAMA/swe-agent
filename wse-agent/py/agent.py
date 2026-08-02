"""
Agent - 自主任务执行 Agent (Python 工具执行层)

在新的 TS/Python 分层架构中，Python 端退化为纯工具执行层。
主要负责：
- 内置工具执行（文件系统、Shell）
- 模型/数据处理工具调用（RAG、embedding、eval 等）
- 提供 CLI 接口供 TypeScript 端调用
"""

import json
import sys
import os

# 工具导入
from executor import (
    read_file as _read_file,
    write_file as _write_file,
    run_shell as _run_shell,
    parse_and_execute,
    process_tool_calls
)


def main():
    """CLI 入口 - 供 TypeScript 端调用"""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python agent.py <action> <params_json>"}))
        return

    action = sys.argv[1]

    if action == "execute":
        # 执行单个工具调用
        params = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
        tool_name = params.get("tool_name", "")
        tool_args = params.get("args", {})
        result = parse_and_execute(tool_name, tool_args)
        print(json.dumps(result))

    elif action == "batch":
        # 批量执行工具调用
        params = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
        tool_calls = params.get("tool_calls", [])
        results = process_tool_calls(tool_calls)
        print(json.dumps(results))

    elif action == "tools":
        # 返回可用工具列表
        from parser import TOOLS
        print(json.dumps({"tools": list(TOOLS.keys())}))

    else:
        print(json.dumps({"error": f"Unknown action: {action}"}))


def run_task(task: str, api_key: str = None) -> str:
    """
    运行 Agent 任务（保留原有接口，deprecated）
    
    注意：在新的 TS/Python 分层架构中，建议使用 TypeScript 端的 Agent。
    此方法仅用于向后兼容。
    """
    import os as _os
    
    key = api_key or _os.environ.get("GLM_API_KEY")
    if not key:
        return json.dumps({"error": "GLM_API_KEY not found"})

    # 导入并使用原有 Agent
    from openai import OpenAI

    client = OpenAI(api_key=key, base_url="https://open.bigmodel.cn/api/paas/v4")
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": task}
    ]

    from parser import TOOLS
    from agent import TOOLS as TOOL_SCHEMAS

    response = client.chat.completions.create(
        model="glm-4-flash",
        messages=messages,
        tools=TOOL_SCHEMAS,
        tool_choice="auto"
    )

    msg = response.choices[0].message
    if msg.tool_calls:
        results = process_tool_calls(msg.tool_calls)
        return json.dumps({"results": results})

    return json.dumps({"content": msg.content})


if __name__ == "__main__":
    main()
