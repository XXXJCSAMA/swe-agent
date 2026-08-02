/**
 * App - 主应用组件
 */

export interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool?: string;
  timestamp: number;
}

export interface AppState {
  messages: Message[];
  isRunning: boolean;
  error: string | null;
}

/**
 * 渲染应用
 */
export function renderApp(container: HTMLElement): void {
  const state: AppState = {
    messages: [],
    isRunning: false,
    error: null
  };

  // HTML template
  container.innerHTML = `
    <div class="app">
      <header>
        <h1>WSE Agent</h1>
        <div class="status" id="status"></div>
      </header>
      
      <div class="chat" id="chat"></div>
      
      <div class="input-area">
        <textarea id="task-input" placeholder="输入任务描述..." rows="3"></textarea>
        <button id="run-btn" disabled>运行 Agent</button>
      </div>
    </div>
  `;

  const statusEl = container.querySelector("#status")!;
  const chatEl = container.querySelector("#chat")!;
  const inputEl = container.querySelector<HTMLTextAreaElement>("#task-input")!;
  const runBtn = container.querySelector<HTMLButtonElement>("#run-btn")!;

  function updateStatus(): void {
    statusEl.textContent = state.isRunning ? "运行中..." : "就绪";
    statusEl.className = `status ${state.isRunning ? "running" : "ready"}`;
    runBtn.disabled = state.isRunning || !inputEl.value.trim();
  }

  function addMessage(role: Message["role"], content: string, tool?: string): void {
    const msg: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      role,
      content,
      tool,
      timestamp: Date.now()
    };
    state.messages.push(msg);
    renderMessages();
  }

  function renderMessages(): void {
    chatEl.innerHTML = state.messages
      .map((msg) => {
        const time = new Date(msg.timestamp).toLocaleTimeString();
        const roleLabel = {
          user: "用户",
          assistant: "助手",
          system: "系统",
          tool: `[${msg.tool || "工具"}]`
        }[msg.role];
        return `<div class="message ${msg.role}">
          <span class="role">${roleLabel}</span>
          <span class="time">${time}</span>
          <div class="content">${escapeHtml(msg.content)}</div>
        </div>`;
      })
      .join("");
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .replace(/\n/g, "<br>");
  }

  async function runAgent(): Promise<void> {
    const task = inputEl.value.trim();
    if (!task) return;

    state.isRunning = true;
    state.error = null;
    updateStatus();
    addMessage("user", task);

    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, stream: true })
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              handleStreamEvent(data);
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      state.error = (err as Error).message;
      addMessage("system", `错误: ${state.error}`);
    } finally {
      state.isRunning = false;
      updateStatus();
    }
  }

  function handleStreamEvent(data: { type: string; [key: string]: unknown }): void {
    switch (data.type) {
      case "thinking":
        addMessage("system", data.text as string);
        break;
      case "tool_call":
        addMessage("tool", `${data.name}(${JSON.stringify(data.args)})`, data.name as string);
        break;
      case "tool_result":
        addMessage("tool", String(data.result), data.tool as string);
        break;
      case "finish":
        addMessage("assistant", data.summary as string);
        break;
      case "error":
        addMessage("system", `错误: ${data.message}`);
        break;
    }
  }

  // Event listeners
  inputEl.addEventListener("input", updateStatus);
  runBtn.addEventListener("click", runAgent);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.ctrlKey) {
      runAgent();
    }
  });

  updateStatus();
}

// Add basic styles
const style = document.createElement("style");
style.textContent = `
  .app {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 4rem);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 1rem;
    border-bottom: 1px solid #333;
    margin-bottom: 1rem;
  }
  h1 { font-size: 1.5rem; color: #00d4ff; }
  .status {
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.875rem;
  }
  .status.ready { background: #22c55e33; color: #22c55e; }
  .status.running { background: #f59e0b33; color: #f59e0b; }
  .chat {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    background: #16213e;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }
  .message {
    margin-bottom: 1rem;
    padding: 0.5rem;
    border-radius: 0.25rem;
  }
  .message.user { background: #1e3a5f; }
  .message.assistant { background: #2d4a3e; }
  .message.tool { background: #3d3a5f; font-family: monospace; font-size: 0.875rem; }
  .message.system { background: #3a3a3a; color: #aaa; }
  .role { font-weight: bold; margin-right: 0.5rem; }
  .time { color: #666; font-size: 0.75rem; }
  .content { margin-top: 0.25rem; white-space: pre-wrap; }
  .input-area {
    display: flex;
    gap: 0.5rem;
  }
  textarea {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #333;
    border-radius: 0.5rem;
    background: #16213e;
    color: #eee;
    font-size: 1rem;
    resize: none;
  }
  textarea:focus { outline: none; border-color: #00d4ff; }
  button {
    padding: 0.75rem 1.5rem;
    background: #00d4ff;
    color: #1a1a2e;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
  }
  button:hover { background: #00b8e6; }
  button:disabled { background: #555; cursor: not-allowed; }
`;
document.head.appendChild(style);
