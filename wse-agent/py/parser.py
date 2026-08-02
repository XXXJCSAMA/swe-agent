"""Parser - 工具调用解析器

负责解析 LLM 返回的工具调用请求，调用 executor 执行，并返回结果。
"""
import json
from executor import read_file, write_file, run_shell


def finish(params: dict) -> dict:
    """finish 工具 - 标记任务完成

    不执行实际操作，只返回确认信息。
    """
    return {
        "success": True,
        "summary": params.get("summary", "")
    }


# 工具注册表
TOOLS = {
    "read_file": read_file,
    "write_file": write_file,
    "run_shell": run_shell,
    "finish": finish,
}


def parse_and_execute(tool_name: str, params: dict) -> dict:
    """解析工具名称并执行
    
    Args:
        tool_name: 工具名称
        params: 工具参数
        
    Returns:
        执行结果字典
    """
    if tool_name not in TOOLS:
        return {
            "success": False,
            "error": f"Unknown tool: {tool_name}. Available tools: {list(TOOLS.keys())}"
        }
    
    try:
        func = TOOLS[tool_name]
        result = func(params)
        return result
    except Exception as e:
        return {
            "success": False,
            "error": f"Execution error: {str(e)}"
        }


def _normalize_tool_call(tool_call) -> dict:
    """将 GLM Pydantic 模型或字典转换为统一格式
    
    Args:
        tool_call: tool_call 对象或字典
        
    Returns:
        标准化后的字典
    """
    if isinstance(tool_call, dict):
        return tool_call
    
    # Pydantic 模型 - 使用 model_dump() 或直接访问属性
    if hasattr(tool_call, "model_dump"):
        return tool_call.model_dump()
    
    # 直接访问属性
    return {
        "id": tool_call.id,
        "type": tool_call.type,
        "function": {
            "name": tool_call.function.name,
            "arguments": tool_call.function.arguments
        }
    }


def execute_tool_call(tool_call) -> dict:
    """执行单个工具调用（GLM 格式）
    
    Args:
        tool_call: GLM 返回的 tool_call（Pydantic 对象或字典），格式为：
            {
                "id": "call_xxx",
                "function": {
                    "name": "func_name",
                    "arguments": '{"param": "value"}'
                },
                "type": "function"
            }
    
    Returns:
        工具响应字典，格式为：
            {
                "tool_call_id": "call_xxx",
                "output": "result string",
                "is_error": False
            }
    """
    tc = _normalize_tool_call(tool_call)
    
    tool_call_id = tc.get("id")
    func = tc.get("function", {})
    func_name = func.get("name")
    arguments_str = func.get("arguments", "{}")
    
    # 解析参数
    try:
        params = json.loads(arguments_str)
    except json.JSONDecodeError:
        return {
            "tool_call_id": tool_call_id,
            "output": "",
            "is_error": True,
            "error": f"Invalid JSON arguments: {arguments_str}"
        }
    
    # 执行工具
    result = parse_and_execute(func_name, params)
    
    # 格式化输出
    if result.get("success"):
        # 成功时返回关键信息
        output = _format_result(func_name, result)
        return {
            "tool_call_id": tool_call_id,
            "output": output,
            "is_error": False
        }
    else:
        # 失败时返回错误信息
        return {
            "tool_call_id": tool_call_id,
            "output": f"Error: {result.get('error', 'Unknown error')}",
            "is_error": True
        }


def _format_result(func_name: str, result: dict) -> str:
    """格式化执行结果为字符串"""
    if func_name == "read_file":
        total = result.get("total_lines", 0)
        start = result.get("start_line", 1)
        end = result.get("end_line", 0)
        content = result.get("output", "")  # 修复：统一用 output
        return f"[{start}-{end}]/{total} lines:\n{content}"
    
    elif func_name == "write_file":
        return "File written successfully"
    
    elif func_name == "run_shell":
        output = result.get("output", "")
        stderr = result.get("error", "")
        if stderr:
            return f"[stdout]\n{output}\n[stderr]\n{stderr}"
        return output
    
    elif func_name == "finish":
        return result.get("summary", "")
    
    else:
        return str(result)


def process_tool_calls(tool_calls: list) -> list:
    """批量处理工具调用
    
    Args:
        tool_calls: GLM 返回的 tool_calls 列表
        
    Returns:
        工具响应列表
    """
    return [execute_tool_call(tc) for tc in tool_calls]
