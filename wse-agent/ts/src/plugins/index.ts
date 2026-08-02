/**
 * Plugins - 插件系统
 * 
 * 提供可扩展的插件机制，允许自定义工具和中间件。
 */

export interface Plugin {
  name: string;
  version: string;
  tools?: Record<string, unknown>;
  middleware?: Middleware[];
  onLoad?: () => Promise<void>;
  onUnload?: () => Promise<void>;
}

export interface Middleware {
  name: string;
  before?: (context: Context) => Promise<void>;
  after?: (context: Context, result: unknown) => Promise<void>;
}

export interface Context {
  toolName: string;
  args: Record<string, unknown>;
  messages: unknown[];
  state: Record<string, unknown>;
}

/**
 * 插件管理器
 */
export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private tools: Map<string, unknown> = new Map();
  private middleware: Middleware[] = [];

  /**
   * 注册插件
   */
  async register(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} is already registered`);
    }

    await plugin.onLoad?.();
    this.plugins.set(plugin.name, plugin);

    // 注册工具
    if (plugin.tools) {
      for (const [name, tool] of Object.entries(plugin.tools)) {
        this.tools.set(name, tool);
      }
    }

    // 注册中间件
    if (plugin.middleware) {
      this.middleware.push(...plugin.middleware);
    }

    console.log(`[PluginManager] Registered plugin: ${plugin.name}@${plugin.version}`);
  }

  /**
   * 卸载插件
   */
  async unregister(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} is not registered`);
    }

    await plugin.onUnload?.();
    this.plugins.delete(name);

    // 移除工具
    if (plugin.tools) {
      for (const toolName of Object.keys(plugin.tools)) {
        this.tools.delete(toolName);
      }
    }

    // 移除中间件
    this.middleware = this.middleware.filter(m => {
      return !plugin.middleware?.some(pm => pm.name === m.name);
    });

    console.log(`[PluginManager] Unregistered plugin: ${name}`);
  }

  /**
   * 获取所有工具
   */
  getTools(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [name, tool] of this.tools) {
      result[name] = tool;
    }
    return result;
  }

  /**
   * 获取所有中间件
   */
  getMiddleware(): Middleware[] {
    return [...this.middleware];
  }

  /**
   * 执行中间件
   */
  async runMiddleware(
    context: Context,
    fn: (ctx: Context) => Promise<unknown>
  ): Promise<unknown> {
    // Before middlewares
    for (const m of this.middleware) {
      await m.before?.(context);
    }

    const result = await fn(context);

    // After middlewares
    for (const m of this.middleware) {
      await m.after?.(context, result);
    }

    return result;
  }

  /**
   * 获取已注册插件列表
   */
  listPlugins(): { name: string; version: string }[] {
    return Array.from(this.plugins.values()).map(p => ({
      name: p.name,
      version: p.version
    }));
  }
}

// 全局插件管理器
export const pluginManager = new PluginManager();
