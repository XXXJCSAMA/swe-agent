from executor import run_shell, read_file, write_file
import os

def test_normal():
    result = run_shell({"command": "echo hello"})
    assert result["success"] == True
    assert result["returncode"] == 0
    assert "hello" in result["output"]
    print("测试1 通过:", result)

def test_command_not_found():
    result = run_shell({"command": "blahblah_not_exist"})
    assert result["success"] == False
    assert result["returncode"] == 127
    print("测试2 通过:", result)

def test_timeout():
    result = run_shell({"command": "sleep 10", "timeout": 2})
    assert result["success"] == False
    assert "timed out" in result["error"]
    print("测试3 通过:", result)


# read_file 测试

def test_read_normal():
    # 先创建一个测试文件
    with open("test_sample.txt", "w") as f:
        f.write("\n".join([f"line {i}" for i in range(1, 301)]))  # 300行
    
    result = read_file({"path": "test_sample.txt"})
    assert result["success"] == True
    assert result["total_lines"] == 300
    assert result["start_line"] == 1
    assert result["end_line"] == 200      # 默认截断200行
    print("read测试1 通过:", result["total_lines"], "行,返回了", result["end_line"], "行")

def test_read_with_range():
    result = read_file({"path": "test_sample.txt", "start_line": 250, "end_line": 260})
    assert result["success"] == True
    assert result["start_line"] == 250
    assert result["end_line"] == 260
    assert "line 250" in result["output"]  # 验证 output 字段
    print("read测试2 通过:", result["output"][:30])

def test_read_not_found():
    result = read_file({"path": "not_exist.txt"})
    assert result["success"] == False
    assert "not found" in result["error"].lower()
    print("read测试3 通过:", result["error"])


# write_file 测试

def test_write_overwrite():
    """测试 overwrite 模式"""
    test_path = "test_write.txt"
    result = write_file({"path": test_path, "content": "hello world"})
    assert result["success"] == True
    assert result["error"] is None
    
    # 验证内容
    with open(test_path) as f:
        assert f.read() == "hello world"
    
    os.remove(test_path)
    print("write测试1（overwrite）通过")

def test_write_append():
    """测试 append 模式"""
    test_path = "test_append.txt"
    
    # 先写一些内容
    with open(test_path, "w") as f:
        f.write("first\n")
    
    # 追加内容
    result = write_file({"path": test_path, "content": "second\n", "mode": "append"})
    assert result["success"] == True
    
    # 验证内容
    with open(test_path) as f:
        content = f.read()
        assert content == "first\nsecond\n"
    
    os.remove(test_path)
    print("write测试2（append）通过")

def test_write_invalid_mode():
    """测试无效 mode"""
    result = write_file({"path": "test.txt", "content": "test", "mode": "invalid"})
    assert result["success"] == False
    assert "invalid mode" in result["error"].lower()
    print("write测试3（无效mode）通过")


if __name__ == "__main__":
    test_normal()
    test_command_not_found()
    test_timeout()
    test_read_normal()
    test_read_with_range()
    test_read_not_found()
    test_write_overwrite()
    test_write_append()
    test_write_invalid_mode()
    os.remove("test_sample.txt")  # 清理测试文件
    print("\n所有测试通过!")
