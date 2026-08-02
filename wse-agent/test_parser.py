"""Parser 测试"""
from parser import parse_and_execute, execute_tool_call, process_tool_calls
import os


def test_execute_read_file():
    """测试 read_file 调用"""
    result = parse_and_execute("read_file", {"path": "parser.py"})
    assert result["success"] == True
    assert "output" in result  # 验证 output 字段
    print("read_file 测试通过")


def test_execute_write_file():
    """测试 write_file 调用"""
    test_path = "test_parser.txt"
    result = parse_and_execute("write_file", {
        "path": test_path,
        "content": "parser test content"
    })
    assert result["success"] == True
    
    # 验证
    with open(test_path) as f:
        assert f.read() == "parser test content"
    
    os.remove(test_path)
    print("write_file 测试通过")


def test_execute_run_shell():
    """测试 run_shell 调用"""
    result = parse_and_execute("run_shell", {"command": "echo hello from parser"})
    assert result["success"] == True
    assert "hello from parser" in result["output"]
    print("run_shell 测试通过")


def test_unknown_tool():
    """测试未知工具"""
    result = parse_and_execute("unknown_tool", {})
    assert result["success"] == False
    assert "Unknown tool" in result["error"]
    print("unknown tool 测试通过")


def test_execute_tool_call_glm_format():
    """测试 GLM 格式的工具调用"""
    # 模拟 GLM 返回的 tool_call 格式
    tool_call = {
        "id": "call_123",
        "function": {
            "name": "read_file",
            "arguments": '{"path": "parser.py"}'
        },
        "type": "function"
    }
    
    result = execute_tool_call(tool_call)
    
    assert result["tool_call_id"] == "call_123"
    assert result["is_error"] == False
    assert "Parser" in result["output"]  # 文件包含 Parser 关键字
    print("GLM 格式 tool_call 测试通过")
    print(f"  output preview: {result['output'][:50]}...")


def test_execute_tool_call_run_shell():
    """测试执行 shell 命令"""
    tool_call = {
        "id": "call_456",
        "function": {
            "name": "run_shell",
            "arguments": '{"command": "echo hello"}'
        },
        "type": "function"
    }
    
    result = execute_tool_call(tool_call)
    
    assert result["tool_call_id"] == "call_456"
    assert result["is_error"] == False
    assert "hello" in result["output"]
    print("run_shell tool_call 测试通过")


def test_execute_tool_call_error():
    """测试工具调用错误"""
    tool_call = {
        "id": "call_789",
        "function": {
            "name": "read_file",
            "arguments": '{"path": "not_exist.txt"}'
        },
        "type": "function"
    }
    
    result = execute_tool_call(tool_call)
    
    assert result["tool_call_id"] == "call_789"
    assert result["is_error"] == True
    assert "not found" in result["output"].lower()
    print("tool_call 错误处理测试通过")


def test_process_multiple_tool_calls():
    """测试批量处理工具调用"""
    tool_calls = [
        {
            "id": "call_1",
            "function": {"name": "run_shell", "arguments": '{"command": "echo first"}'},
            "type": "function"
        },
        {
            "id": "call_2", 
            "function": {"name": "run_shell", "arguments": '{"command": "echo second"}'},
            "type": "function"
        }
    ]
    
    results = process_tool_calls(tool_calls)
    
    assert len(results) == 2
    assert results[0]["output"] == "first\n"
    assert results[1]["output"] == "second\n"
    print("批量处理 tool_calls 测试通过")


if __name__ == "__main__":
    test_execute_read_file()
    test_execute_write_file()
    test_execute_run_shell()
    test_unknown_tool()
    test_execute_tool_call_glm_format()
    test_execute_tool_call_run_shell()
    test_execute_tool_call_error()
    test_process_multiple_tool_calls()
    print("\nParser 所有测试通过!")
