const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  listFiles: (dirPath) => ipcRenderer.invoke('list-files', dirPath),
  selectFile: () => ipcRenderer.invoke('select-file'),
  saveFile: (content) => ipcRenderer.invoke('save-file', content),
  executeCode: (code, language) => ipcRenderer.invoke('execute-code', code, language),
  // Terminal APIs
  createTerminal: () => ipcRenderer.invoke('create-terminal'),
  terminalInput: (pid, data) => ipcRenderer.invoke('terminal-input', pid, data),
  terminalResize: (pid, cols, rows) => ipcRenderer.invoke('terminal-resize', pid, cols, rows),
  closeTerminal: (pid) => ipcRenderer.invoke('close-terminal', pid),
  onTerminalData: (callback) => ipcRenderer.on('terminal-data', (event, pid, data) => callback(pid, data)),
  onTerminalExit: (callback) => ipcRenderer.on('terminal-exit', (event, pid) => callback(pid)),
  // LSP APIs
  lspStart: (language) => ipcRenderer.invoke('lsp-start', language),
  lspStop: (language) => ipcRenderer.invoke('lsp-stop', language),
  lspDidOpen: (language, uri, languageId, version, text) => ipcRenderer.invoke('lsp-did-open', language, uri, languageId, version, text),
  lspDidChange: (language, uri, version, contentChanges) => ipcRenderer.invoke('lsp-did-change', language, uri, version, contentChanges),
  lspCompletion: (language, uri, line, character) => ipcRenderer.invoke('lsp-completion', language, uri, line, character),
  lspHover: (language, uri, line, character) => ipcRenderer.invoke('lsp-hover', language, uri, line, character),
  lspDefinition: (language, uri, line, character) => ipcRenderer.invoke('lsp-definition', language, uri, line, character),
  // AI Completion API
  aiComplete: (code, language, cursorPosition) => ipcRenderer.invoke('ai-complete', code, language, cursorPosition),
  // Extension APIs
  extensionLoad: (extensionPath) => ipcRenderer.invoke('extension-load', extensionPath),
  extensionUnload: (extensionId) => ipcRenderer.invoke('extension-unload', extensionId),
  extensionsList: () => ipcRenderer.invoke('extensions-list'),
  extensionGetThemes: () => ipcRenderer.invoke('extension-get-themes'),
  extensionGetCommands: () => ipcRenderer.invoke('extension-get-commands'),
  extensionExecuteCommand: (commandId, ...args) => ipcRenderer.invoke('extension-execute-command', commandId, ...args),
  // Agent APIs
  agentChat: (message) => ipcRenderer.invoke('agent-chat', message),
  onAgentStatus: (callback) => ipcRenderer.on('agent-status', (event, status) => callback(status)),
  onAgentRequestApproval: (callback) => ipcRenderer.on('agent-request-approval', (event, command) => callback(command)),
  sendAgentApprovalResponse: (isApproved) => ipcRenderer.send('agent-approval-response', isApproved)
});
