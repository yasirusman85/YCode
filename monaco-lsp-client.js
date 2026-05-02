// Monaco LSP Client - Simple integration for code intelligence
class MonacoLSPClient {
  constructor(editor, electronAPI) {
    this.editor = editor;
    this.electronAPI = electronAPI;
    this.currentLanguage = null;
    this.currentUri = null;
    this.version = 1;
    this.disposables = [];
    this.languageMap = {
      'javascript': 'javascript',
      'typescript': 'typescript', 
      'python': 'python'
    };
  }

  // Initialize LSP for a file
  async initialize(uri, languageId) {
    this.currentUri = uri;
    this.currentLanguage = this.languageMap[languageId];
    this.version = 1;

    if (!this.currentLanguage) {
      console.log(`No LSP support for ${languageId}`);
      return;
    }

    // Start LSP server
    const result = await this.electronAPI.lspStart(this.currentLanguage);
    if (!result.success) {
      console.error('Failed to start LSP server:', result.error);
      return;
    }

    // Register completion provider
    const completionDisposable = monaco.languages.registerCompletionItemProvider(languageId, {
      triggerCharacters: ['.', ':', '>'],
      provideCompletionItems: async (model, position) => {
        return await this.provideCompletionItems(model, position);
      }
    });
    this.disposables.push(completionDisposable);

    // Register hover provider
    const hoverDisposable = monaco.languages.registerHoverProvider(languageId, {
      provideHover: async (model, position) => {
        return await this.provideHover(model, position);
      }
    });
    this.disposables.push(hoverDisposable);

    // Register definition provider
    const definitionDisposable = monaco.languages.registerDefinitionProvider(languageId, {
      provideDefinition: async (model, position) => {
        return await this.provideDefinition(model, position);
      }
    });
    this.disposables.push(definitionDisposable);

    // Send didOpen notification
    const text = this.editor.getValue();
    await this.electronAPI.lspDidOpen(this.currentLanguage, uri, languageId, this.version, text);

    // Listen for content changes
    this.editor.onDidChangeModelContent(async (e) => {
      this.version++;
      const contentChanges = e.changes.map(change => ({
        range: {
          start: { line: change.range.startLineNumber - 1, character: change.range.startColumn - 1 },
          end: { line: change.range.endLineNumber - 1, character: change.range.endColumn - 1 }
        },
        text: change.text
      }));

      await this.electronAPI.lspDidChange(
        this.currentLanguage, 
        uri, 
        this.version, 
        contentChanges
      );
    });
  }

  async provideCompletionItems(model, position) {
    if (!this.currentLanguage) return null;

    const result = await this.electronAPI.lspCompletion(
      this.currentLanguage,
      this.currentUri,
      position.lineNumber - 1,
      position.column - 1
    );

    if (!result.success || !result.result) {
      return null;
    }

    const items = result.result.items || [];
    const suggestions = items.map(item => ({
      label: item.label,
      kind: this.mapCompletionKind(item.kind),
      detail: item.detail,
      documentation: item.documentation?.value || item.documentation,
      insertText: item.insertText || item.label,
      range: item.textEdit?.range ? {
        startLineNumber: item.textEdit.range.start.line + 1,
        startColumn: item.textEdit.range.start.character + 1,
        endLineNumber: item.textEdit.range.end.line + 1,
        endColumn: item.textEdit.range.end.character + 1
      } : undefined
    }));

    return { suggestions };
  }

  async provideHover(model, position) {
    if (!this.currentLanguage) return null;

    const result = await this.electronAPI.lspHover(
      this.currentLanguage,
      this.currentUri,
      position.lineNumber - 1,
      position.column - 1
    );

    if (!result.success || !result.result) {
      return null;
    }

    const contents = result.result.contents;
    let hoverContent = '';

    if (typeof contents === 'string') {
      hoverContent = contents;
    } else if (Array.isArray(contents)) {
      hoverContent = contents.map(c => typeof c === 'string' ? c : c.value).join('\n');
    } else {
      hoverContent = contents.value || '';
    }

    return {
      contents: [{ value: hoverContent, isTrusted: true }]
    };
  }

  async provideDefinition(model, position) {
    if (!this.currentLanguage) return null;

    const result = await this.electronAPI.lspDefinition(
      this.currentLanguage,
      this.currentUri,
      position.lineNumber - 1,
      position.column - 1
    );

    if (!result.success || !result.result) {
      return null;
    }

    const locations = Array.isArray(result.result) ? result.result : [result.result];
    
    return locations.map(loc => ({
      uri: monaco.Uri.parse(loc.uri),
      range: {
        startLineNumber: loc.range.start.line + 1,
        startColumn: loc.range.start.character + 1,
        endLineNumber: loc.range.end.line + 1,
        endColumn: loc.range.end.character + 1
      }
    }));
  }

  mapCompletionKind(lspKind) {
    const kindMap = {
      1: monaco.languages.CompletionItemKind.Text,
      2: monaco.languages.CompletionItemKind.Method,
      3: monaco.languages.CompletionItemKind.Function,
      4: monaco.languages.CompletionItemKind.Constructor,
      5: monaco.languages.CompletionItemKind.Field,
      6: monaco.languages.CompletionItemKind.Variable,
      7: monaco.languages.CompletionItemKind.Class,
      8: monaco.languages.CompletionItemKind.Interface,
      9: monaco.languages.CompletionItemKind.Module,
      10: monaco.languages.CompletionItemKind.Property,
      11: monaco.languages.CompletionItemKind.Unit,
      12: monaco.languages.CompletionItemKind.Value,
      13: monaco.languages.CompletionItemKind.Enum,
      14: monaco.languages.CompletionItemKind.Keyword,
      15: monaco.languages.CompletionItemKind.Snippet,
      16: monaco.languages.CompletionItemKind.Color,
      17: monaco.languages.CompletionItemKind.File,
      18: monaco.languages.CompletionItemKind.Reference,
      19: monaco.languages.CompletionItemKind.Folder,
      20: monaco.languages.CompletionItemKind.EnumMember,
      21: monaco.languages.CompletionItemKind.Constant,
      22: monaco.languages.CompletionItemKind.Struct,
      23: monaco.languages.CompletionItemKind.Event,
      24: monaco.languages.CompletionItemKind.Operator,
      25: monaco.languages.CompletionItemKind.TypeParameter
    };
    return kindMap[lspKind] || monaco.languages.CompletionItemKind.Text;
  }

  dispose() {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    if (this.currentLanguage) {
      this.electronAPI.lspStop(this.currentLanguage);
    }
  }
}

// AI Completion Handler
class AICompletionHandler {
  constructor(editor, electronAPI) {
    this.editor = editor;
    this.electronAPI = electronAPI;
    this.setupKeybinding();
  }

  setupKeybinding() {
    // Add Alt+Enter keybinding for AI completion
    this.editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.Enter, async () => {
      await this.triggerAICompletion();
    });

    // Also add Ctrl+Space for intelligent completion
    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, async () => {
      // Trigger Monaco's built-in completion
      this.editor.trigger('', 'editor.action.triggerSuggest', {});
    });
  }

  async triggerAICompletion() {
    const position = this.editor.getPosition();
    const model = this.editor.getModel();
    const code = model.getValue();
    const language = model.getLanguageId();
    
    // Show loading indicator
    const loadingMessage = 'AI: Generating suggestions...';
    
    try {
      const result = await this.electronAPI.aiComplete(code, language, {
        line: position.lineNumber,
        column: position.column
      });

      if (result.success) {
        // Insert AI suggestion at cursor position
        const suggestion = result.suggestion;
        if (suggestion) {
          this.editor.executeEdits('ai-completion', [{
            range: new monaco.Range(
              position.lineNumber,
              position.column,
              position.lineNumber,
              position.column
            ),
            text: suggestion
          }]);
        }
      } else {
        // Show error or info message
        console.log('AI Completion:', result.error || 'No suggestion available');
      }
    } catch (error) {
      console.error('AI completion error:', error);
    }
  }
}

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MonacoLSPClient, AICompletionHandler };
}
