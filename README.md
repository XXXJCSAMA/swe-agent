WSE Agent
An AI Agent built with a TypeScript + Python layered architecture.
Architecture Overview
┌─────────────────────────────────────────────────────────────┐
│                    TypeScript Layer (ts/)                    │
├─────────────────────────────────────────────────────────────┤
│  Frontend     │  Agent Orchestrator  │  API Layer         │
│  User UI      │  Tool Schema         │  Streaming         │
│  Plugin System│  Workflow Runtime    │  REST API          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Python Layer (py/)                        │
├──────────────────────────────────────────────────────────── ─┤
│  Model Experiments │  RAG Pipeline │  Embedding │  Eval                 │
│  Fine‑tuning       │  Data Processing │ Offline Tasks │ Complex Computation │
└─────────────────────────────────────────────────────────────┘

wse‑agent/
├── ts/                          # TypeScript Layer
│   ├── src/
│   │   ├── agent/              # Agent orchestrator
│   │   │   ├── agent.ts        # Agent main class
│   │   │   ├── tools.ts        # Tool schema definitions
│   │   │   ├── runtime.ts      # Workflow runtime
│   │   │   ├── streaming.ts    # Streaming support
│   │   │   ├── executor.ts     # Tool executor
│   │   │   └── framework/      # Working Framework (Task Card / Verification Record / Migration Decision)
│   │   ├── api/                # API layer
│   │   │   ├── routes.ts        # API routes
│   │   │   └── server.ts        # Express server
│   │   ├── plugins/            # Plugin system
│   │   ├── user‑interaction/   # User interaction module
│   │   └── frontend/           # Frontend UI
│   ├── package.json
│   └── tsconfig.json
│
├── py/                          # Python Layer
│   ├── tools/                   # Python‑backed tools
│   │   ├── rag.py             # RAG pipeline
│   │   ├── embedding.py        # Vector embedding utilities
│   │   ├── eval.py            # Evaluation toolkit
│   │   └── offline.py         # Offline task runner
│   ├── framework.py            # Working Framework CLI (Task Card / Verification Record / Migration Decision validation, rendering, persistence)
│   ├── agent.py                # Agent tool‑execution layer
│   ├── parser.py               # Tool call parser
│   ├── executor.py             # Python‑side tool executor
│   └── requirements.txt
│
└── README.md
Example workflow:
User: "Help me create hello.py that prints Hello World"
↓
Agent receives task and invokes GLM‑4‑flash
↓
GLM responds: "I will call run_shell({'command': 'cat > hello.py <<EOF...EOF'})"
↓
Agent executes the shell command and creates the file
↓
GLM responds: "I will call finish({'summary': 'hello.py created successfully'})"
↓
Task completes and returns the summary
Limitations (Missing Capabilities)
‑ No real‑world task memory: lacks long‑term memory; every task starts from scratch
‑ No sandbox / boundary enforcement: run_shell can execute arbitrary commands (file deletion, disk formatting, etc.)
‑ No built‑in RAG / knowledge retrieval: cannot pull answers from document knowledge bases
‑ No multi‑agent collaboration: single sequential execution loop
Core insight: An Agent becomes functional once the three‑stage pipeline Tool Calling → Execute → Loop is wired end‑to‑end.

Core Pipeline Definition
‑ Tool Calling: Map string‑formatted tool names to executable function references (parser.py: parse_and_execute)
‑ Execute: Perform real work via three atomic primitives (executor.py: read / write / shell)
‑ Loop: while‑true loop on TypeScript side that orchestrates LLM ↔ Python execution (TS ↔ agent.py: main)
