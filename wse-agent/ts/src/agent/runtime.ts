/**
 * Runtime - 工作流运行时
 * 
 * 负责 Agent 主循环的运行控制：
 * - Step cap 检测
 * - Sliding window 上下文管理
 * - 死循环检测
 */

import type { ChatCompletionMessageParam } from "openai/resources/beta/chat/completions";

export interface RuntimeConfig {
  maxSteps: number;
  maxHistory: number;
}

export interface RuntimeState {
  step: number;
  recentCommands: string[];
  isRunning: boolean;
}

export const DEFAULT_CONFIG: RuntimeConfig = {
  maxSteps: 20,
  maxHistory: 10
};

/**
 * 创建运行时状态
 */
export function createRuntimeState(): RuntimeState {
  return {
    step: 0,
    recentCommands: [],
    isRunning: true
  };
}

/**
 * Step cap 检测
 */
export function checkStepCap(state: RuntimeState, config: RuntimeConfig): boolean {
  state.step++;
  if (state.step > config.maxSteps) {
    state.isRunning = false;
    return false;
  }
  return true;
}

/**
 * Sliding window - 保留 system + 最近 N 条消息
 * 
 * system message 在 messages[0]，永远保留
 * 只截断历史对话部分
 */
export function applySlidingWindow(
  messages: ChatCompletionMessageParam[],
  config: RuntimeConfig
): ChatCompletionMessageParam[] {
  const maxLen = config.maxHistory + 1; // +1 for system message
  if (messages.length <= maxLen) {
    return messages;
  }
  return [messages[0], ...messages.slice(-config.maxHistory)];
}

/**
 * 死循环检测 - 连续 3 条相同命令
 */
export function checkDeadLoop(
  state: RuntimeState,
  commands: string[]
): { detected: boolean; command: string } {
  for (const command of commands) {
    if (state.recentCommands.length >= 2) {
      const last = state.recentCommands[state.recentCommands.length - 1];
      const secondLast = state.recentCommands[state.recentCommands.length - 2];
      if (last === command && secondLast === command) {
        state.isRunning = false;
        return { detected: true, command };
      }
    }
    state.recentCommands.push(command);
    // 只保留最近 3 条
    if (state.recentCommands.length > 3) {
      state.recentCommands.shift();
    }
  }
  return { detected: false, command: "" };
}

/**
 * 重置运行时状态
 */
export function resetRuntime(state: RuntimeState): void {
  state.step = 0;
  state.recentCommands = [];
  state.isRunning = true;
}
