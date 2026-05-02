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
    this.setupClient();
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
      }
    ];
  }

  async executeTool(toolCall, callbacks) {
    const name = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);
    
    try {
      if (name === 'ls_files') {
        const targetPath = args.dirPath === '.' ? process.cwd() : path.resolve(process.cwd(), args.dirPath);
        const files = await fs.readdir(targetPath, { withFileTypes: true });
        const list = files.map(f => `${f.isDirectory() ? '[DIR] ' : '[FILE]'} ${f.name}`).join('\n');
        return list || 'Directory is empty.';
      } 
      
      else if (name === 'read_file') {
        const targetPath = path.resolve(process.cwd(), args.filePath);
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
          const approved = await callbacks.onRequestApproval(args.command);
          if (!approved) {
            return "Execution denied by user.";
          }
        }
        
        callbacks.onAgentStatus(`Running command: ${args.command}`);
        return await this.runShellWithPty(args.command);
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
      callbacks.onAgentStatus('Thinking...');
      
      // ReAct Loop
      let loopCount = 0;
      const MAX_LOOPS = 10;
      
      while (loopCount < MAX_LOOPS) {
        loopCount++;
        
        const response = await this.openai.chat.completions.create({
          model: process.env.LLM_MODEL || 'gpt-4o', // or llama3 via groq
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
