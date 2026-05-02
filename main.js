const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const Docker = require('dockerode');
const docker = new Docker();

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

app.whenReady().then(() => {
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
