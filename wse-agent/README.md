# WSE Agent

基于 **TypeScript + Python** 分层架构的 AI Agent。

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    TypeScript 层 (ts/)                      │
├─────────────────────────────────────────────────────────────┤
│  Frontend     │  Agent Orchestrator  │  API Layer         │
│  用户交互      │  Tool Schema         │  Streaming         │
│  插件系统      │  Workflow Runtime    │  REST API          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Python 层 (py/)                          │
├─────────────────────────────────────────────────────────────┤
│  模型实验   │  RAG Pipeline   │  Embedding   │  Eval       │
│  Fine-tuning   │  数据处理   │  离线任务   │  复杂计算   │
└─────────────────────────────────────────────────────────────┘
```

## 目录结构

```
wse-agent/
├── ts/                          # TypeScript 层
│   ├── src/
│   │   ├── agent/              # Agent orchestrator
│   │   │   ├── agent.ts        # Agent 主类
│   │   │   ├── tools.ts        # Tool schema 定义
│   │   │   ├── runtime.ts      # Workflow runtime
│   │   │   ├── streaming.ts    # Streaming 支持
│   │   │   └── executor.ts     # 工具执行器
│   │   ├── api/                # API layer
│   │   │   ├── routes.ts        # API 路由
│   │   │   └── server.ts        # Express 服务器
│   │   ├── plugins/            # 插件系统
│   │   ├── user-interaction/   # 用户交互
│   │   └── frontend/           # 前端界面
│   ├── package.json
│   └── tsconfig.json
│
├── py/                          # Python 层
│   ├── tools/                   # Python 工具
│   │   ├── rag.py             # RAG pipeline
│   │   ├── embedding.py        # 向量嵌入
│   │   ├── eval.py            # 评估工具
│   │   └── offline.py         # 离线任务
│   ├── agent.py                # Agent（工具执行层）
│   ├── parser.py               # 工具解析器
│   ├── executor.py             # 工具执行器
│   └── requirements.txt
│
└── README.md
```

## 快速开始

### TypeScript 层

```bash
cd ts
npm install

# 运行 Agent
npm run dev

# 启动 API 服务器
npm run dev:api

# 启动前端
npm run dev:frontend
```

### Python 层

```bash
cd py
pip install -r requirements.txt

# 测试工具
python -m tools.rag
python -m tools.embedding
```

## API 接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/agent/run` | 运行 Agent 任务 |
| GET | `/api/agent/task/:id` | 获取任务状态 |
| GET | `/api/agent/tasks` | 列出所有任务 |
| DELETE | `/api/agent/task/:id` | 删除任务 |

## 环境变量

| 变量 | 描述 | 必需 |
|------|------|------|
| `GLM_API_KEY` | 智谱 GLM API 密钥 | 是 |
| `PORT` | API 服务器端口 | 否（默认 3001） |

## 许可证

MIT
