const fs = require('fs').promises;
const path = require('path');
const { ipcMain } = require('electron');

class ExtensionManager {
  constructor(appPath) {
    this.extensionsPath = path.join(appPath, 'extensions');
    this.loadedExtensions = new Map();
    this.extensionAPIs = new Map();
    this.sandboxes = new Map();
  }

  async initialize() {
    try {
      await fs.mkdir(this.extensionsPath, { recursive: true });
      console.log('Extensions directory initialized:', this.extensionsPath);
    } catch (error) {
      console.error('Failed to create extensions directory:', error);
    }
  }

  // Load all extensions from extensions directory
  async loadAllExtensions() {
    try {
      const entries = await fs.readdir(this.extensionsPath, { withFileTypes: true });
      const extensionDirs = entries
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(this.extensionsPath, entry.name));

      for (const extDir of extensionDirs) {
        await this.loadExtension(extDir);
      }

      return {
        success: true,
        loaded: this.loadedExtensions.size,
        extensions: Array.from(this.loadedExtensions.keys())
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Load a single extension
  async loadExtension(extensionPath) {
    try {
      const manifestPath = path.join(extensionPath, 'package.json');
      const manifestData = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestData);

      // Validate manifest
      if (!this.validateManifest(manifest)) {
        throw new Error('Invalid extension manifest');
      }

      const extId = manifest.name;

      // Check if already loaded
      if (this.loadedExtensions.has(extId)) {
        console.warn(`Extension ${extId} is already loaded`);
        return { success: false, error: 'Extension already loaded' };
      }

      // Create sandbox environment
      const sandbox = this.createSandbox(extId, extensionPath, manifest);

      // Load main script if specified
      if (manifest.main) {
        const mainPath = path.join(extensionPath, manifest.main);
        await this.executeInSandbox(sandbox, mainPath);
      }

      // Register extension
      this.loadedExtensions.set(extId, {
        manifest,
        path: extensionPath,
        sandbox,
        activated: true
      });

      console.log(`Extension loaded: ${extId} v${manifest.version}`);

      return { success: true, extensionId: extId };

    } catch (error) {
      console.error(`Failed to load extension at ${extensionPath}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Validate extension manifest
  validateManifest(manifest) {
    const required = ['name', 'version', 'engines'];
    for (const field of required) {
      if (!manifest[field]) {
        console.error(`Missing required field: ${field}`);
        return false;
      }
    }

    // Check YCode engine compatibility
    if (!manifest.engines.ycode) {
      console.error('Missing ycode engine version');
      return false;
    }

    return true;
  }

  // Create sandbox environment for extension
  createSandbox(extId, extensionPath, manifest) {
    const sandbox = {
      id: extId,
      path: extensionPath,
      manifest,
      api: this.createExtensionAPI(extId),
      console: {
        log: (...args) => console.log(`[${extId}]`, ...args),
        error: (...args) => console.error(`[${extId}]`, ...args),
        warn: (...args) => console.warn(`[${extId}]`, ...args)
      }
    };

    this.sandboxes.set(extId, sandbox);
    return sandbox;
  }

  // Create API exposed to extensions
  createExtensionAPI(extId) {
    return {
      // UI Registration
      registerCommand: (commandId, title, callback) => {
        return this.registerCommand(extId, commandId, title, callback);
      },
      
      registerTheme: (themeId, themeData) => {
        return this.registerTheme(extId, themeId, themeData);
      },

      registerStatusBarItem: (id, text, tooltip, command) => {
        return this.registerStatusBarItem(extId, id, text, tooltip, command);
      },

      // Monaco Editor Integration
      registerCompletionProvider: (language, provider) => {
        return this.registerCompletionProvider(extId, language, provider);
      },

      registerHoverProvider: (language, provider) => {
        return this.registerHoverProvider(extId, language, provider);
      },

      // Terminal Integration
      registerTerminalCommand: (name, command) => {
        return this.registerTerminalCommand(extId, name, command);
      },

      // File System Access (restricted)
      readFile: async (filePath) => {
        return this.safeReadFile(extId, filePath);
      },

      writeFile: async (filePath, content) => {
        return this.safeWriteFile(extId, filePath, content);
      },

      // Event System
      onFileOpen: (callback) => {
        return this.registerEventHandler(extId, 'file-open', callback);
      },

      onFileSave: (callback) => {
        return this.registerEventHandler(extId, 'file-save', callback);
      },

      // LSP Integration
      registerLanguageServer: (language, serverConfig) => {
        return this.registerLanguageServer(extId, language, serverConfig);
      },

      // Storage
      getState: async (key) => {
        return this.getExtensionState(extId, key);
      },

      setState: async (key, value) => {
        return this.setExtensionState(extId, key, value);
      },

      // Utilities
      showInformationMessage: (message) => {
        return this.showMessage('info', message);
      },

      showErrorMessage: (message) => {
        return this.showMessage('error', message);
      },

      showWarningMessage: (message) => {
        return this.showMessage('warning', message);
      }
    };
  }

  // Register command from extension
  registerCommand(extId, commandId, title, callback) {
    const fullCommandId = `${extId}.${commandId}`;
    
    ipcMain.handle(`command:${fullCommandId}`, async (event, ...args) => {
      try {
        const result = await callback(...args);
        return { success: true, result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    return {
      id: fullCommandId,
      title,
      dispose: () => {
        ipcMain.removeHandler(`command:${fullCommandId}`);
      }
    };
  }

  // Register theme
  registerTheme(extId, themeId, themeData) {
    const fullThemeId = `${extId}.${themeId}`;
    
    // Store theme data
    if (!this.extensionAPIs.has('themes')) {
      this.extensionAPIs.set('themes', new Map());
    }
    this.extensionAPIs.get('themes').set(fullThemeId, themeData);

    return {
      id: fullThemeId,
      dispose: () => {
        this.extensionAPIs.get('themes').delete(fullThemeId);
      }
    };
  }

  // Register status bar item
  registerStatusBarItem(extId, id, text, tooltip, command) {
    const fullId = `${extId}.${id}`;
    
    return {
      id: fullId,
      text,
      tooltip,
      command,
      dispose: () => {
        // Cleanup handled by extension unload
      }
    };
  }

  // Safe file read (sandboxed)
  async safeReadFile(extId, filePath) {
    // Only allow reading within extension directory or workspace
    const ext = this.loadedExtensions.get(extId);
    if (!ext) throw new Error('Extension not found');

    const allowedPaths = [
      ext.path,
      process.cwd()
    ];

    const resolvedPath = path.resolve(filePath);
    const isAllowed = allowedPaths.some(allowed => 
      resolvedPath.startsWith(allowed)
    );

    if (!isAllowed) {
      throw new Error('Access denied: Path outside allowed directories');
    }

    return await fs.readFile(resolvedPath, 'utf-8');
  }

  // Safe file write (sandboxed)
  async safeWriteFile(extId, filePath, content) {
    const ext = this.loadedExtensions.get(extId);
    if (!ext) throw new Error('Extension not found');

    // Only allow writing to extension's own directory
    const allowedPath = ext.path;
    const resolvedPath = path.resolve(filePath);

    if (!resolvedPath.startsWith(allowedPath)) {
      throw new Error('Access denied: Can only write to extension directory');
    }

    return await fs.writeFile(resolvedPath, content, 'utf-8');
  }

  // Extension state management
  async getExtensionState(extId, key) {
    const statePath = path.join(this.extensionsPath, '.state', `${extId}.json`);
    try {
      const data = await fs.readFile(statePath, 'utf-8');
      const state = JSON.parse(data);
      return state[key];
    } catch {
      return undefined;
    }
  }

  async setExtensionState(extId, key, value) {
    const stateDir = path.join(this.extensionsPath, '.state');
    const statePath = path.join(stateDir, `${extId}.json`);
    
    await fs.mkdir(stateDir, { recursive: true });
    
    let state = {};
    try {
      const data = await fs.readFile(statePath, 'utf-8');
      state = JSON.parse(data);
    } catch {}
    
    state[key] = value;
    await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
  }

  // Execute extension main script in sandbox
  async executeInSandbox(sandbox, scriptPath) {
    // In a real implementation, this would use vm2 or similar
    // For now, we'll use a simplified approach with restricted require
    const code = await fs.readFile(scriptPath, 'utf-8');
    
    // Create sandboxed context
    const sandboxedRequire = (moduleName) => {
      // Whitelist allowed modules
      const allowed = ['path', 'fs'];
      if (!allowed.includes(moduleName)) {
        throw new Error(`Module '${moduleName}' is not allowed in extensions`);
      }
      return require(moduleName);
    };

    const sandboxedExports = {};
    const sandboxedModule = { exports: sandboxedExports };

    // Execute with Function constructor for basic sandboxing
    const sandboxedCode = `
      (function(require, module, exports, console, ycode) {
        ${code}
      })
    `;

    const fn = eval(sandboxedCode);
    fn(sandboxedRequire, sandboxedModule, sandboxedExports, sandbox.console, sandbox.api);

    return sandboxedModule.exports;
  }

  // Unload extension
  unloadExtension(extId) {
    const ext = this.loadedExtensions.get(extId);
    if (!ext) return false;

    // Cleanup
    this.sandboxes.delete(extId);
    this.loadedExtensions.delete(extId);

    console.log(`Extension unloaded: ${extId}`);
    return true;
  }

  // Get all loaded extensions
  getLoadedExtensions() {
    return Array.from(this.loadedExtensions.entries()).map(([id, ext]) => ({
      id,
      name: ext.manifest.displayName || ext.manifest.name,
      version: ext.manifest.version,
      description: ext.manifest.description,
      activated: ext.activated
    }));
  }

  // Show message to user (would integrate with UI)
  showMessage(type, message) {
    console.log(`[${type.toUpperCase()}] ${message}`);
    return { shown: true };
  }

  // Placeholder methods for providers (would integrate with Monaco/LSP)
  registerCompletionProvider(extId, language, provider) {
    console.log(`Extension ${extId} registered completion provider for ${language}`);
    return { dispose: () => {} };
  }

  registerHoverProvider(extId, language, provider) {
    console.log(`Extension ${extId} registered hover provider for ${language}`);
    return { dispose: () => {} };
  }

  registerTerminalCommand(extId, name, command) {
    console.log(`Extension ${extId} registered terminal command: ${name}`);
    return { dispose: () => {} };
  }

  registerLanguageServer(extId, language, serverConfig) {
    console.log(`Extension ${extId} registered language server for ${language}`);
    return { dispose: () => {} };
  }

  registerEventHandler(extId, event, callback) {
    console.log(`Extension ${extId} registered handler for: ${event}`);
    return { dispose: () => {} };
  }
}

module.exports = ExtensionManager;
