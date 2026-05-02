# YCode

A modern, highly extensible code editor built with Electron and Monaco Editor. YCode features secure code execution via Docker containers and an integrated **Autonomous AI Agent Harness** that acts as your AI pair programmer.

## Features

- **Autonomous AI Agent**: Built-in AI collaborator that can read files, list directories, and execute shell commands (with your approval) to help you build software.
- **Monaco Editor**: Professional code editing with syntax highlighting and LSP (Language Server Protocol) support.
- **Secure Code Execution**: Run code in isolated Docker containers with memory and network restrictions.
- **Integrated Terminal**: Built-in xterm.js terminal powered by node-pty.
- **Multi-language Support**: First-class support for JavaScript, TypeScript, Python, Go, and Rust.
- **Extension System**: Extensible architecture allowing custom themes and commands.

## Prerequisites

1. **Node.js** (LTS version)
2. **Git**
3. **Docker Desktop for Windows** - Required for secure code execution.
4. **Ripgrep (rg)** - (Optional but recommended) Required for the Agent's `search_code` tool to work optimally.

## Installation

1. Clone the repository
2. Run the following command to install dependencies:

```bash
npm install
```

## Configuring the AI Agent

The Agent Harness requires an LLM API key. By default, it supports OpenAI, but it is fully compatible with any OpenAI-compatible endpoint (like Groq, Ollama, vLLM, etc.).

Set the following environment variables before starting the application:

```powershell
# For Windows PowerShell
$env:LLM_API_KEY="your-api-key-here"

# (Optional) If using Groq or another provider:
$env:LLM_BASE_URL="https://api.groq.com/openai/v1"
$env:LLM_MODEL="llama3-8b-8192"
```

## Running the Application

```bash
npm start
```

## Usage

### AI Agent
1. Click the **🤖 Agent** button in the top toolbar to open the Agent sidebar.
2. Type a request (e.g., "List the files in this directory" or "Create a new folder called utils").
3. **Guardrails**: If the Agent needs to execute a shell command, a toast notification will appear asking for your Approval or Denial. Commands timeout automatically after 30 seconds to prevent infinite loops.

### General Editor
1. **Open File**: Click "Open File" to select a file from your system.
2. **Edit Code**: Write or edit code in the Monaco Editor.
3. **Run Code**: Click "▶ Run Code" to execute your code in a Docker container safely.
4. **Terminal**: Click "Terminal" to open a local command prompt.

## Code Execution

The editor uses Docker containers to safely execute code:
- Each execution runs in an isolated container.
- Network access is disabled for security.
- Memory and CPU are limited.
- Containers are automatically removed after execution.

Supported execution languages:
- JavaScript/TypeScript (`node:alpine`)
- Python (`python:alpine`)
- Go (`golang:alpine`)
- Rust (`rust:alpine`)

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to contribute to YCode.

## License
ISC