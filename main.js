const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const Docker = require('dockerode');
const docker = new Docker();
const pty = require('node-pty');
const LSPManager = require('./lsp-manager');
const ExtensionManager = require('./extension-manager');

// Terminal management
const terminals = new Map();

// LSP management
const lspManager = new LSPManager();

// Extension management
const extensionManager = new ExtensionManager(app.getAppPath());

// Store pending LSP requests
const pendingLSPRequests = new Map();

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');
}

// IPC Handlers for file operations
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-files', async (event, dirPath) => {
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    const fileList = files.map(file => ({
      name: file.name,
      isDirectory: file.isDirectory()
    }));
    return { success: true, files: fileList };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('select-file', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'JavaScript', extensions: ['js', 'jsx'] },
        { name: 'TypeScript', extensions: ['ts', 'tsx'] },
        { name: 'HTML', extensions: ['html', 'htm'] },
        { name: 'CSS', extensions: ['css'] },
        { name: 'JSON', extensions: ['json'] }
      ]
    });
    
    if (result.canceled) {
      return { success: false, canceled: true };
    }
    
    const filePath = result.filePaths[0];
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, filePath, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-file', async (event, content) => {
  try {
    const result = await dialog.showSaveDialog({
      filters: [
        { name: 'JavaScript', extensions: ['js'] },
        { name: 'TypeScript', extensions: ['ts'] },
        { name: 'HTML', extensions: ['html'] },
        { name: 'CSS', extensions: ['css'] },
        { name: 'JSON', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.canceled) {
      return { success: false, canceled: true };
    }
    
    await fs.writeFile(result.filePath, content, 'utf-8');
    return { success: true, filePath: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC Handler for code execution in Docker
ipcMain.handle('execute-code', async (event, code, language) => {
  try {
    // Check if Docker is available
    await docker.ping();
    
    // Map language to Docker image
    const imageMap = {
      'javascript': 'node:alpine',
      'typescript': 'node:alpine',
      'python': 'python:alpine',
      'go': 'golang:alpine',
      'rust': 'rust:alpine'
    };
    
    const imageName = imageMap[language] || 'node:alpine';
    
    // Pull image if not exists (with timeout)
    try {
      await new Promise((resolve, reject) => {
        docker.pull(imageName, (err, stream) => {
          if (err) return reject(err);
          docker.modem.followProgress(stream, (err) => {
            if (err) return reject(err);
            resolve();
          });
        });
      });
    } catch (pullError) {
      // Image might already exist, continue
    }
    
    // Create and run container
    const container = await docker.createContainer({
      Image: imageName,
      Cmd: ['sh', '-c', code],
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      NetworkDisabled: true, // Disable network for security
      Memory: 128 * 1024 * 1024, // 128MB limit
      CpuQuota: 50000, // Limit CPU
    });
    
    // Start container and capture output
    await container.start();
    
    const stream = await container.logs({
      stdout: true,
      stderr: true,
      tail: 100
    });
    
    let output = '';
    stream.on('data', (chunk) => {
      output += chunk.toString('utf-8');
    });
    
    await new Promise((resolve) => {
      stream.on('end', resolve);
      stream.on('error', resolve);
    });
    
    // Wait for container to finish
    await container.wait();
    
    // Remove container
    await container.remove({ force: true });
    
    // Clean up output (remove Docker log prefixes)
    output = output.replace(/^[\x00-\x1F\x7F]/gm, '').trim();
    
    return { success: true, output };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      dockerError: error.message.includes('connect') ? 'Docker is not running. Please start Docker Desktop.' : null
    };
  }
});

// IPC Handlers for Terminal
ipcMain.handle('create-terminal', async (event) => {
  try {
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env
    });

    const pid = ptyProcess.pid;
    terminals.set(pid, ptyProcess);

    // Send data to renderer
    ptyProcess.onData((data) => {
      event.sender.send('terminal-data', pid, data);
    });

    // Handle exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      terminals.delete(pid);
      event.sender.send('terminal-exit', pid);
    });

    return { success: true, pid };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('terminal-input', async (event, pid, data) => {
  const ptyProcess = terminals.get(pid);
  if (ptyProcess) {
    ptyProcess.write(data);
  }
});

ipcMain.handle('terminal-resize', async (event, pid, cols, rows) => {
  const ptyProcess = terminals.get(pid);
  if (ptyProcess) {
    ptyProcess.resize(cols, rows);
  }
});

ipcMain.handle('close-terminal', async (event, pid) => {
  const ptyProcess = terminals.get(pid);
  if (ptyProcess) {
    ptyProcess.kill();
    terminals.delete(pid);
  }
});

// Clean up terminals on app quit
app.on('before-quit', () => {
  terminals.forEach((ptyProcess) => {
    ptyProcess.kill();
  });
  terminals.clear();
  lspManager.stopAll();
});

// IPC Handlers for LSP
ipcMain.handle('lsp-start', async (event, language) => {
  return await lspManager.startServer(language);
});

ipcMain.handle('lsp-stop', async (event, language) => {
  lspManager.stopServer(language);
  return { success: true };
});

ipcMain.handle('lsp-did-open', async (event, language, uri, languageId, version, text) => {
  lspManager.didOpen(language, uri, languageId, version, text);
  return { success: true };
});

ipcMain.handle('lsp-did-change', async (event, language, uri, version, contentChanges) => {
  lspManager.didChange(language, uri, version, contentChanges);
  return { success: true };
});

ipcMain.handle('lsp-completion', async (event, language, uri, line, character) => {
  const result = lspManager.requestCompletion(language, uri, line, character);
  if (result.success) {
    return new Promise((resolve) => {
      const requestId = result.requestId;
      pendingLSPRequests.set(requestId, resolve);
      
      // Set up message handler for this request
      const handler = (message) => {
        if (message.id === requestId) {
          resolve({ success: true, result: message.result });
          pendingLSPRequests.delete(requestId);
          lspManager.registerMessageHandler(language, handler);
        }
      };
      lspManager.registerMessageHandler(language, handler);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (pendingLSPRequests.has(requestId)) {
          pendingLSPRequests.delete(requestId);
          resolve({ success: false, error: 'Completion request timeout' });
        }
      }, 5000);
    });
  }
  return result;
});

ipcMain.handle('lsp-hover', async (event, language, uri, line, character) => {
  const result = lspManager.requestHover(language, uri, line, character);
  if (result.success) {
    return new Promise((resolve) => {
      const requestId = result.requestId;
      pendingLSPRequests.set(requestId, resolve);
      
      const handler = (message) => {
        if (message.id === requestId) {
          resolve({ success: true, result: message.result });
          pendingLSPRequests.delete(requestId);
          lspManager.registerMessageHandler(language, handler);
        }
      };
      lspManager.registerMessageHandler(language, handler);
      
      setTimeout(() => {
        if (pendingLSPRequests.has(requestId)) {
          pendingLSPRequests.delete(requestId);
          resolve({ success: false, error: 'Hover request timeout' });
        }
      }, 5000);
    });
  }
  return result;
});

ipcMain.handle('lsp-definition', async (event, language, uri, line, character) => {
  const result = lspManager.requestDefinition(language, uri, line, character);
  if (result.success) {
    return new Promise((resolve) => {
      const requestId = result.requestId;
      pendingLSPRequests.set(requestId, resolve);
      
      const handler = (message) => {
        if (message.id === requestId) {
          resolve({ success: true, result: message.result });
          pendingLSPRequests.delete(requestId);
          lspManager.registerMessageHandler(language, handler);
        }
      };
      lspManager.registerMessageHandler(language, handler);
      
      setTimeout(() => {
        if (pendingLSPRequests.has(requestId)) {
          pendingLSPRequests.delete(requestId);
          resolve({ success: false, error: 'Definition request timeout' });
        }
      }, 5000);
    });
  }
  return result;
});

// AI Completion handler
ipcMain.handle('ai-complete', async (event, code, language, cursorPosition) => {
  // Placeholder for AI completion - requires OpenAI API key
  // In production, you'd call OpenAI API here
  return { 
    success: false, 
    error: 'AI completion requires API key configuration. Add OPENAI_API_KEY to your environment variables.'
  };
});

// Extension IPC Handlers
ipcMain.handle('extension-load', async (event, extensionPath) => {
  return await extensionManager.loadExtension(extensionPath);
});

ipcMain.handle('extension-unload', async (event, extensionId) => {
  return { success: extensionManager.unloadExtension(extensionId) };
});

ipcMain.handle('extensions-list', async () => {
  return { 
    success: true, 
    extensions: extensionManager.getLoadedExtensions() 
  };
});

ipcMain.handle('extension-get-themes', async () => {
  const themes = extensionManager.extensionAPIs.get('themes');
  return { 
    success: true, 
    themes: themes ? Array.from(themes.entries()) : [] 
  };
});

ipcMain.handle('extension-get-commands', async () => {
  const commands = [];
  extensionManager.loadedExtensions.forEach((ext, id) => {
    if (ext.manifest.contributes?.commands) {
      ext.manifest.contributes.commands.forEach(cmd => {
        commands.push({
          id: `${id}.${cmd.command}`,
          title: cmd.title,
          category: cmd.category
        });
      });
    }
  });
  return { success: true, commands };
});

ipcMain.handle('extension-execute-command', async (event, commandId, ...args) => {
  try {
    const result = await ipcMain.emit(`command:${commandId}`, event, ...args);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

app.whenReady().then(async () => {
  // Initialize extension manager
  await extensionManager.initialize();
  
  // Load all extensions
  const loadResult = await extensionManager.loadAllExtensions();
  console.log('Extensions loaded:', loadResult);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
