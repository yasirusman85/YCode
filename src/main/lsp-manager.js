const { spawn } = require('child_process');
const path = require('path');

class LSPManager {
  constructor() {
    this.servers = new Map();
    this.messageHandlers = new Map();
    this.requestId = 0;
  }

  // Language server configurations
  getServerConfig(language) {
    const configs = {
      'javascript': {
        command: 'typescript-language-server',
        args: ['--stdio'],
        options: { cwd: process.cwd() }
      },
      'typescript': {
        command: 'typescript-language-server',
        args: ['--stdio'],
        options: { cwd: process.cwd() }
      },
      'python': {
        command: 'pyright-langserver',
        args: ['--stdio'],
        options: { cwd: process.cwd() }
      }
    };
    return configs[language];
  }

  async startServer(language) {
    if (this.servers.has(language)) {
      return { success: true, language };
    }

    const config = this.getServerConfig(language);
    if (!config) {
      return { success: false, error: `No LSP server configured for ${language}` };
    }

    try {
      const serverProcess = spawn(config.command, config.args, config.options);
      
      let buffer = '';
      serverProcess.stdout.on('data', (data) => {
        buffer += data.toString();
        this.processMessages(buffer, language);
      });

      serverProcess.stderr.on('data', (data) => {
        console.error(`LSP ${language} stderr:`, data.toString());
      });

      serverProcess.on('close', (code) => {
        console.log(`LSP server ${language} exited with code ${code}`);
        this.servers.delete(language);
      });

      serverProcess.on('error', (error) => {
        console.error(`LSP server ${language} error:`, error);
        this.servers.delete(language);
      });

      // Wait a bit for server to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Initialize the server
      const initResult = await this.initializeServer(language, serverProcess);
      if (initResult.success) {
        this.servers.set(language, {
          process: serverProcess,
          initialized: true
        });
        return { success: true, language };
      } else {
        serverProcess.kill();
        return initResult;
      }

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async initializeServer(language, serverProcess) {
    return new Promise((resolve) => {
      const initRequest = {
        jsonrpc: '2.0',
        id: ++this.requestId,
        method: 'initialize',
        params: {
          processId: process.pid,
          rootUri: `file://${process.cwd()}`,
          capabilities: {
            textDocument: {
              hover: { dynamicRegistration: true },
              completion: { 
                dynamicRegistration: true,
                completionItem: {
                  snippetSupport: true,
                  commitCharactersSupport: true,
                  documentationFormat: ['markdown', 'plaintext'],
                  deprecatedSupport: true,
                  preselectSupport: true
                }
              },
              definition: { dynamicRegistration: true },
              documentSymbol: { dynamicRegistration: true },
              codeAction: { dynamicRegistration: true },
              formatting: { dynamicRegistration: true },
              rename: { dynamicRegistration: true }
            },
            workspace: {
              applyEdit: true,
              workspaceEdit: { documentChanges: true }
            }
          },
          workspaceFolders: [{
            uri: `file://${process.cwd()}`,
            name: 'workspace'
          }]
        }
      };

      this.sendMessage(serverProcess, initRequest);

      // Set up one-time handler for initialization response
      const checkInterval = setInterval(() => {
        if (!serverProcess.killed) {
          // Check if we got initialized response
          // In a real implementation, you'd properly parse the response
          clearInterval(checkInterval);
          resolve({ success: true });
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve({ success: false, error: 'Initialization timeout' });
      }, 5000);
    });
  }

  sendMessage(serverProcess, message) {
    const content = JSON.stringify(message);
    const headers = `Content-Length: ${Buffer.byteLength(content, 'utf8')}\r\n\r\n`;
    serverProcess.stdin.write(headers + content);
  }

  processMessages(buffer, language) {
    // Parse LSP messages from buffer
    // This is a simplified implementation
    while (true) {
      const headerMatch = buffer.match(/Content-Length:\s*(\d+)\r\n/);
      if (!headerMatch) break;

      const contentLength = parseInt(headerMatch[1]);
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;

      if (buffer.length < messageEnd) break;

      const messageContent = buffer.substring(messageStart, messageEnd);
      buffer = buffer.substring(messageEnd);

      try {
        const message = JSON.parse(messageContent);
        this.handleMessage(message, language);
      } catch (e) {
        console.error('Failed to parse LSP message:', e);
      }
    }
  }

  handleMessage(message, language) {
    // Route messages to appropriate handlers
    if (this.messageHandlers.has(language)) {
      const handlers = this.messageHandlers.get(language);
      handlers.forEach(handler => handler(message));
    }
  }

  registerMessageHandler(language, handler) {
    if (!this.messageHandlers.has(language)) {
      this.messageHandlers.set(language, []);
    }
    this.messageHandlers.get(language).push(handler);
  }

  sendRequest(language, method, params) {
    const server = this.servers.get(language);
    if (!server) {
      return { success: false, error: `Server not started for ${language}` };
    }

    const request = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params
    };

    this.sendMessage(server.process, request);
    return { success: true, requestId: this.requestId };
  }

  sendNotification(language, method, params) {
    const server = this.servers.get(language);
    if (!server) return;

    const notification = {
      jsonrpc: '2.0',
      method,
      params
    };

    this.sendMessage(server.process, notification);
  }

  didOpen(language, uri, languageId, version, text) {
    this.sendNotification(language, 'textDocument/didOpen', {
      textDocument: {
        uri,
        languageId,
        version,
        text
      }
    });
  }

  didChange(language, uri, version, contentChanges) {
    this.sendNotification(language, 'textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges
    });
  }

  requestCompletion(language, uri, line, character) {
    return this.sendRequest(language, 'textDocument/completion', {
      textDocument: { uri },
      position: { line, character }
    });
  }

  requestHover(language, uri, line, character) {
    return this.sendRequest(language, 'textDocument/hover', {
      textDocument: { uri },
      position: { line, character }
    });
  }

  requestDefinition(language, uri, line, character) {
    return this.sendRequest(language, 'textDocument/definition', {
      textDocument: { uri },
      position: { line, character }
    });
  }

  stopServer(language) {
    const server = this.servers.get(language);
    if (server) {
      server.process.kill();
      this.servers.delete(language);
      this.messageHandlers.delete(language);
    }
  }

  stopAll() {
    this.servers.forEach((server, language) => {
      this.stopServer(language);
    });
  }
}

module.exports = LSPManager;
