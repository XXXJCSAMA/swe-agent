# Main module
import subprocess
import os

MAX_LINES = 200


def read_file(params: dict) -> dict:
    """分页读取文件内容
    
    参数:
        path: 文件路径
        start_line: 起始行号（可选，默认1）
        end_line: 结束行号（可选，不传则自动计算）
    
    返回:
        包含 success、content、total_lines、start_line、end_line、error
    """
    path = params.get("path")
    
    if not path:
        return {"success": False, "error": "path is required"}
    
    if not os.path.exists(path):
        return {"success": False, "error": f"File not found: {path}"}
    
    try:
        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        
        total_lines = len(lines)
        start_line = params.get("start_line", 1)
        
        # 转换为0索引
        start_idx = max(0, start_line - 1)
        
        # 计算结束行
        end_line = params.get("end_line")
        if end_line is None:
            end_line = min(start_line + MAX_LINES - 1, total_lines)
        
        end_idx = min(end_line, total_lines)
        
        # 边界检查
        if start_idx >= total_lines:
            return {
                "success": True,
                "content": "",
                "total_lines": total_lines,
                "start_line": start_line,
                "end_line": end_line,
                "error": None
            }
        
        # 切片读取
        content_lines = lines[start_idx:end_idx]
        content = "".join(content_lines)
        
        return {
            "success": True,
            "output": content,
            "total_lines": total_lines,
            "start_line": start_line,
            "end_line": end_line,
            "error": None
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}


def write_file(params: dict) -> dict:
    """写入文件内容
    
    参数:
        path: 文件路径
        content: 要写入的内容
        mode: 模式 - "overwrite"(覆盖) 或 "append"(追加)，默认 "overwrite"
    
    返回:
        包含 success 和 error
    """
    path = params.get("path")
    content = params.get("content", "")
    mode = params.get("mode", "overwrite")
    
    if not path:
        return {"success": False, "error": "path is required"}
    
    # 验证 mode
    if mode not in ("overwrite", "append"):
        return {"success": False, "error": f"Invalid mode: {mode}. Use 'overwrite' or 'append'"}
    
    try:
        # 确保目录存在
        dir_path = os.path.dirname(path)
        if dir_path and not os.path.exists(dir_path):
            os.makedirs(dir_path, exist_ok=True)
        
        # 选择模式: overwrite='w', append='a'
        open_mode = "w" if mode == "overwrite" else "a"
        
        with open(path, open_mode, encoding="utf-8") as f:
            f.write(content)
        
        return {"success": True, "error": None}
        
    except Exception as e:
        return {"success": False, "error": str(e)}


def run_shell(params: dict) -> dict:
    command = params["command"]
    timeout = params.get("timeout", 30)

    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )

        return {
            "success": result.returncode == 0,
            "output": result.stdout,
            "error": result.stderr,
            "returncode": result.returncode,
        }

    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "output": "",
            "error": f"Command timed out after {timeout} seconds",
            "returncode": None,
        }