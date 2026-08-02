/**
 * User Interaction - 用户交互
 * 
 * 提供与用户交互的能力：确认、输入、多选等。
 */

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

export interface InputOptions {
  title: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
}

export interface SelectOptions<T = string> {
  title: string;
  message: string;
  options: { value: T; label: string }[];
  multiple?: boolean;
}

export type UserResponse = string | boolean | Record<string, unknown> | null;

/**
 * 用户交互接口
 */
export interface UserInteraction {
  confirm(options: ConfirmOptions): Promise<boolean>;
  input(options: InputOptions): Promise<string | null>;
  select<T = string>(options: SelectOptions<T>): Promise<T | T[] | null>;
  notify(message: string, type?: "info" | "success" | "warning" | "error"): void;
}

/**
 * Console 实现（默认）
 */
export class ConsoleInteraction implements UserInteraction {
  async confirm(options: ConfirmOptions): Promise<boolean> {
    const { confirmText = "确认", cancelText = "取消" } = options;
    const answer = prompt(`${options.message}\n输入 "${confirmText}" 确认，或 "${cancelText}" 取消: `);
    return answer === confirmText;
  }

  async input(options: InputOptions): Promise<string | null> {
    return prompt(options.message) || null;
  }

  async select<T = string>(options: SelectOptions<T>): Promise<T | T[] | null> {
    console.log(`\n${options.title}`);
    console.log(options.message);
    
    options.options.forEach((opt, idx) => {
      console.log(`  ${idx + 1}. ${opt.label}`);
    });

    const answer = prompt("请选择: ");
    if (!answer) return null;

    const idx = parseInt(answer, 10) - 1;
    if (idx >= 0 && idx < options.options.length) {
      return options.options[idx].value;
    }
    return null;
  }

  notify(message: string, type: "info" | "success" | "warning" | "error" = "info"): void {
    const prefix = {
      info: "ℹ️",
      success: "✅",
      warning: "⚠️",
      error: "❌"
    }[type];
    console.log(`${prefix} ${message}`);
  }
}

/**
 * API 实现（供前端调用）
 */
export class ApiInteraction implements UserInteraction {
  private baseUrl: string;

  constructor(baseUrl: string = "/api/interaction") {
    this.baseUrl = baseUrl;
  }

  async confirm(options: ConfirmOptions): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options)
    });
    return response.json();
  }

  async input(options: InputOptions): Promise<string | null> {
    const response = await fetch(`${this.baseUrl}/input`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options)
    });
    const data = await response.json();
    return data.value ?? null;
  }

  async select<T = string>(options: SelectOptions<T>): Promise<T | T[] | null> {
    const response = await fetch(`${this.baseUrl}/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options)
    });
    return response.json();
  }

  notify(_message: string, _type?: "info" | "success" | "warning" | "error"): void {
    // 通知通过 WebSocket/SSE 发送
  }
}

/**
 * 空实现（无交互）
 */
export class NoInteraction implements UserInteraction {
  async confirm(_options: ConfirmOptions): Promise<boolean> {
    return false;
  }

  async input(_options: InputOptions): Promise<string | null> {
    return null;
  }

  async select<T = string>(_options: SelectOptions<T>): Promise<T | T[] | null> {
    return null;
  }

  notify(_message: string, _type?: "info" | "success" | "warning" | "error"): void {
    // Do nothing
  }
}

// 导出工厂函数
export function createInteraction(mode: "console" | "api" | "none" = "console"): UserInteraction {
  switch (mode) {
    case "console":
      return new ConsoleInteraction();
    case "api":
      return new ApiInteraction();
    case "none":
      return new NoInteraction();
  }
}
