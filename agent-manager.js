const { OpenAI } = require('openai');
const fs = require('fs').promises;
const path = require('path');
const pty = require('node-pty');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class AgentManager {
  constructor() {
    this.history = [];
    this.openai = null;
    this.model = process.env.LLM_MODEL || 'gpt-4o';
    this.setupClient();
  }

  updateSettings({ model, apiKey, baseURL }) {
    if (model) this.model = model;
    if (apiKey || baseURL) {
      this.setupClient(
        baseURL || (this.openai ? this.openai.baseURL : process.env.LLM_BASE_URL),
        apiKey || (this.openai ? this.openai.apiKey : process.env.LLM_API_KEY)
      );
    }
    return `Agent configured to use model: ${this.model}`;
  }

  setupClient(baseURL = process.env.LLM_BASE_URL, apiKey = process.env.LLM_API_KEY) {
    // Default to OpenAI if not provided, but allow override for Groq/Ollama/etc.
    const config = {};
    if (baseURL) config.baseURL = baseURL;
    if (apiKey) {
      config.apiKey = apiKey;
    } else {
      // Fallback for dummy initialization if no key is provided yet
      config.apiKey = 'dummy-key'; 
    }
    
    // Explicitly allow browser-like environments if necessary, but we are in main process
    this.openai = new OpenAI(config);
  }

  validatePath(targetPath) {
    const resolvedPath = path.resolve(process.cwd(), targetPath);
    const cwd = process.cwd();
    if (resolvedPath !== cwd && !resolvedPath.startsWith(cwd + path.sep)) {
      throw new Error(`Path traversal denied: ${resolvedPath} is outside the workspace.`);
    }
    return resolvedPath;
  }

  clearHistory() {
    if (this.history.length > 0 && this.history[0].role === 'system') {
      this.history = [this.history[0]];
    } else {
      this.history = [];
    }
    return "Agent context cleared.";
  }

  async summarizeHistory() {
    if (this.history.length <= 2) return "History is too short to summarize.";
    const systemMessage = this.history.length > 0 && this.history[0].role === 'system' ? this.history[0] : null;
    const historyToCompress = systemMessage ? this.history.slice(1) : this.history;

    try {
      const summaryPrompt = "Please summarize the following conversation history, focusing on the technical objectives, architectural decisions, and actions taken so far. Keep it concise but detailed enough to maintain situational awareness.";
      const messages = [...historyToCompress, { role: 'user', content: summaryPrompt }];
      
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: messages
      });

      const summaryText = response.choices[0].message.content;
      this.history = [];
      if (systemMessage) this.history.push(systemMessage);
      this.history.push({ role: 'assistant', content: `[MEMORY SUMMARY]: ${summaryText}` });
      
      return "Agent context successfully summarized and compressed.";
    } catch (error) {
      throw new Error(`Failed to summarize history: ${error.message}`);
    }
  }

  getToolsSchema() {
    return [
      {
        type: "function",
        function: {
          name: "ls_files",
          description: "List files and directories in a given path.",
          parameters: {
            type: "object",
            properties: {
              dirPath: { type: "string", description: "The directory path to list. Use '.' for current workspace." }
            },
            required: ["dirPath"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "read_file",
          description: "Read the contents of a file.",
          parameters: {
            type: "object",
            properties: {
              filePath: { type: "string", description: "The path to the file to read." }
            },
            required: ["filePath"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "search_code",
          description: "Search for a string or regex across the codebase using ripgrep.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "The search query (regex allowed)." },
              dirPath: { type: "string", description: "Directory to search in." }
            },
            required: ["query", "dirPath"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "run_shell",
          description: "Execute a shell command. Requires user approval. Use this to run scripts, tests, or modify files via cli.",
          parameters: {
            type: "object",
            properties: {
              command: { type: "string", description: "The bash or powershell command to run." }
            },
            required: ["command"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "write_file",
          description: "Write content to a file.",
          parameters: {
            type: "object",
            properties: {
              filePath: { type: "string", description: "The path to the file to write." },
              content: { type: "string", description: "The content to write to the file." }
            },
            required: ["filePath", "content"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "git_sync",
          description: "Sync changes to git by staging all files and committing.",
          parameters: {
            type: "object",
            properties: {
              commitMessage: { type: "string", description: "The commit message describing the changes." }
            },
            required: ["commitMessage"]
          }
        }
      }
    ];
  }

  async executeTool(toolCall, callbacks) {
    const name = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);
    
    try {
      if (name === 'ls_files') {
        const targetPath = args.dirPath === '.' ? process.cwd() : this.validatePath(args.dirPath);
        const files = await fs.readdir(targetPath, { withFileTypes: true });
        const list = files.map(f => `${f.isDirectory() ? '[DIR] ' : '[FILE]'} ${f.name}`).join('\n');
        return list || 'Directory is empty.';
      } 
      
      else if (name === 'read_file') {
        const targetPath = this.validatePath(args.filePath);
        const content = await fs.readFile(targetPath, 'utf-8');
        return content;
      } 
      
      else if (name === 'search_code') {
        // Fallback search code if rg is not installed
        try {
          const { stdout } = await execPromise(`rg "${args.query}" "${args.dirPath}"`);
          return stdout || 'No matches found.';
        } catch (error) {
          // If rg fails, maybe it's not installed or no matches. Return output if available.
          if (error.stdout) return error.stdout;
          return `Error running ripgrep: ${error.message}. Is ripgrep installed?`;
        }
      } 
      
      else if (name === 'run_shell') {
        // Guardrail: Ask for human approval
        if (callbacks && callbacks.onRequestApproval) {
          callbacks.onAgentStatus('Waiting for user approval...');
          const prompt = `[RUN_SHELL]\nCommand: ${args.command}`;
          const approved = await callbacks.onRequestApproval(prompt);
          if (!approved) {
            return "Execution denied by user.";
          }
        }
        
        callbacks.onAgentStatus(`Running command: ${args.command}`);
        return await this.runShellWithPty(args.command);
      }
      
      else if (name === 'write_file') {
        const targetPath = this.validatePath(args.filePath);
        if (callbacks && callbacks.onRequestApproval) {
          callbacks.onAgentStatus('Waiting for user approval to write file...');
          const prompt = `[WRITE_FILE]\nPath: ${targetPath}\n\nContent:\n${args.content}`;
          const approved = await callbacks.onRequestApproval(prompt);
          if (!approved) return "File write denied by user.";
        }
        await fs.writeFile(targetPath, args.content, 'utf-8');
        return `Successfully wrote to ${targetPath}`;
      }

      else if (name === 'git_sync') {
        if (callbacks && callbacks.onRequestApproval) {
          callbacks.onAgentStatus('Waiting for user approval to commit...');
          const prompt = `[GIT_SYNC]\nCommit Message: ${args.commitMessage}\nCommand: git add . && git commit -m "${args.commitMessage}"`;
          const approved = await callbacks.onRequestApproval(prompt);
          if (!approved) return "Git sync denied by user.";
        }
        callbacks.onAgentStatus(`Committing to Git: ${args.commitMessage}`);
        try {
          const { stdout } = await execPromise(`git add . && git commit -m "${args.commitMessage}"`);
          return stdout || "Changes committed successfully.";
        } catch (error) {
          return `Git error: ${error.message}\n${error.stdout || ''}`;
        }
      }

      return `Error: Unknown tool ${name}`;
    } catch (error) {
      return `Tool execution error: ${error.message}`;
    }
  }

  runShellWithPty(command) {
    return new Promise((resolve) => {
      const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
      const shellArgs = process.platform === 'win32' ? ['-Command', command] : ['-c', command];
      
      const ptyProcess = pty.spawn(shell, shellArgs, {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
        env: process.env
      });

      let output = '';
      ptyProcess.onData((data) => {
        output += data;
      });

      let finished = false;
      
      // Guardrail: 30 second timeout
      const timeoutId = setTimeout(() => {
        if (!finished) {
          finished = true;
          ptyProcess.kill();
          resolve(output + '\n\n[Process killed: Exceeded 30 second timeout limit]');
        }
      }, 30000);

      ptyProcess.onExit(({ exitCode }) => {
        if (!finished) {
          finished = true;
          clearTimeout(timeoutId);
          resolve(output + `\n\n[Process exited with code ${exitCode}]`);
        }
      });
    });
  }

  async run(userMessage, systemMessage, callbacks) {
    if (this.history.length === 0 && systemMessage) {
      this.history.push({ role: 'system', content: systemMessage });
    }
    
    this.history.push({ role: 'user', content: userMessage });

    try {
      // Sliding window logic
      if (this.history.length > 40) {
        if (callbacks && callbacks.onAgentStatus) callbacks.onAgentStatus('Compressing memory context...');
        
        const systemMessage = this.history[0].role === 'system' ? this.history[0] : null;
        const recentMessages = this.history.slice(-10);
        const historyToCompress = this.history.slice(systemMessage ? 1 : 0, -10);

        const summaryPrompt = "Please summarize the following older conversation history. Focus on the main goals, architectural state, and actions completed. This will serve as compressed memory.";
        const messages = [...historyToCompress, { role: 'user', content: summaryPrompt }];
        
        const response = await this.openai.chat.completions.create({
          model: this.model,
          messages: messages
        });

        const summaryText = response.choices[0].message.content;
        
        this.history = [];
        if (systemMessage) this.history.push(systemMessage);
        this.history.push({ role: 'assistant', content: `[OLDER MEMORY SUMMARY]: ${summaryText}` });
        this.history.push(...recentMessages);
      }

      callbacks.onAgentStatus('Thinking...');
      
      // ReAct Loop
      let loopCount = 0;
      const MAX_LOOPS = 10;
      
      while (loopCount < MAX_LOOPS) {
        loopCount++;
        
        const response = await this.openai.chat.completions.create({
          model: this.model,
          messages: this.history,
          tools: this.getToolsSchema(),
          tool_choice: 'auto'
        });

        const message = response.choices[0].message;
        this.history.push(message);

        // If the model wants to call tools
        if (message.tool_calls && message.tool_calls.length > 0) {
          callbacks.onAgentStatus('Executing tools...');
          
          for (const toolCall of message.tool_calls) {
            const toolResult = await this.executeTool(toolCall, callbacks);
            
            // Append observation back to history
            this.history.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: String(toolResult)
            });
          }
        } else {
          // Final response
          callbacks.onAgentStatus('Idle');
          return message.content;
        }
      }
      
      return "Error: Agent reached maximum iterations (10 loops).";
    } catch (error) {
      callbacks.onAgentStatus('Error');
      return `Agent Error: ${error.message}\nMake sure your LLM_API_KEY and LLM_BASE_URL are correctly set in the environment or settings.`;
    }
  }
}

module.exports = AgentManager;
