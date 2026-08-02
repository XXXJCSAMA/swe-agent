/**
 * Executor - 工具执行器
 * 
 * 在 TypeScript 端执行内置工具（文件系统、Shell）。
 * Python 端工具（RAG、embedding 等）通过子进程调用。
 */

import { spawn } from "child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { promisify } from "util";

export interface ToolResponse {
  toolCallId: string;
  output: string;
  isError: boolean;
}

/**
 * 读取文件
 */
function readFile(path: string, startLine?: number, endLine?: number): string {
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }

  const content = readFileSync(path, "utf-8");
  const lines = content.split("\n");
  const totalLines = lines.length;

  const start = startLine ? Math.max(1, startLine) : 1;
  const end = endLine ? Math.min(totalLines, endLine) : Math.min(200, totalLines);

  const slicedLines = lines.slice(start - 1, end);
  
  return `[${start}-${end}]/${totalLines} lines:\n${slicedLines.join("\n")}`;
}

/**
 * 写入文件
 */
function writeFile(path: string, content: string, mode: string = "overwrite"): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (mode === "append") {
    const existing = existsSync(path) ? readFileSync(path, "utf-8") : "";
    writeFileSync(path, existing + content, "utf-8");
  } else {
    writeFileSync(path, content, "utf-8");
  }
}

/**
 * 执行 Shell 命令
 */
function runShell(command: string, timeout: number = 60): { stdout: string; stderr: string; code: number | null } {
  return new Promise((resolve) => {
    const proc = spawn(command, [], {
      shell: true,
      timeout: timeout * 1000
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({ stdout, stderr, code });
    });

    proc.on("error", (err) => {
      resolve({ stdout: "", stderr: err.message, code: null });
    });

    // Timeout
    setTimeout(() => {
      proc.kill();
      resolve({ stdout, stderr: "Command timed out", code: null });
    }, timeout * 1000);
  });
}

/**
 * 执行 Python 工具（子进程）
 */
async function runPythonTool(toolName: string, params: Record<string, unknown>): Promise<string> {
  return new Promise((resolve, reject) => {
    const pyPath = join(process.cwd(), "..", "py", "tools", `${toolName}.py`);
    
    const proc = spawn("python3", [pyPath, JSON.stringify(params)], {
      cwd: join(process.cwd(), "..", "py")
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `Python tool exited with code ${code}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * 执行工具
 */
export async function executeTool(
  toolName: string,
  argsStr: string,
  toolCallId: string
): Promise<ToolResponse> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsStr);
  } catch {
    return {
      toolCallId,
      output: `Error: Invalid JSON arguments: ${argsStr}`,
      isError: true
    };
  }

  try {
    let output: string;

    switch (toolName) {
      case "read_file":
        output = readFile(
          args.path as string,
          args.start_line as number | undefined,
          args.end_line as number | undefined
        );
        break;

      case "write_file":
        writeFile(
          args.path as string,
          args.content as string,
          args.mode as string | undefined
        );
        output = "File written successfully";
        break;

      case "run_shell":
        const result = runShell(args.command as string, args.timeout as number | undefined);
        if (result.stderr) {
          output = `[stdout]\n${result.stdout}\n[stderr]\n${result.stderr}`;
        } else {
          output = result.stdout;
        }
        break;

      case "finish":
        output = args.summary as string || "";
        break;

      default:
        // 尝试调用 Python 工具
        output = await runPythonTool(toolName, args);
        break;
    }

    return {
      toolCallId,
      output,
      isError: false
    };
  } catch (error) {
    return {
      toolCallId,
      output: `Error: ${error instanceof Error ? error.message : String(error)}`,
      isError: true
    };
  }
}
