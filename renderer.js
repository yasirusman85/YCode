require.config({ paths: { 'vs': 'node_modules/monaco-editor/min/vs' }});
require(['vs/editor/editor.main'], function() {
  const editor = monaco.editor.create(document.getElementById('container'), {
    value: [
      '// Welcome to YCode',
      '// Start coding here...',
      'function hello() {',
      '  console.log("Hello, World!");',
      '}'
    ].join('\n'),
    language: 'javascript',
    theme: 'vs-dark',
    automaticLayout: true,
    fontSize: 14,
    minimap: { enabled: true },
    scrollBeyondLastLine: false,
    wordWrap: 'on'
  });

  let currentFilePath = null;
  let lspClient = null;
  let aiHandler = null;

  // Initialize LSP and AI features
  function initializeLSP(uri, language) {
    if (lspClient) {
      lspClient.dispose();
      lspClient = null;
    }
    if (['javascript', 'typescript', 'python'].includes(language)) {
      lspClient = new MonacoLSPClient(editor, window.electronAPI);
      lspClient.initialize(uri, language);
    }
  }

  if (typeof AICompletionHandler !== 'undefined') {
    aiHandler = new AICompletionHandler(editor, window.electronAPI);
  }

  document.getElementById('openBtn').addEventListener('click', async () => {
    const result = await window.electronAPI.selectFile();
    if (result.success && !result.canceled) {
      currentFilePath = result.filePath;
      document.getElementById('filename').textContent = result.filePath;
      editor.setValue(result.content);
      
      const ext = result.filePath.split('.').pop().toLowerCase();
      const languageMap = {
        'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
        'html': 'html', 'htm': 'html', 'css': 'css', 'json': 'json', 'md': 'markdown'
      };
      const language = languageMap[ext] || 'plaintext';
      monaco.editor.setModelLanguage(editor.getModel(), language);
      
      const fileUri = `file://${result.filePath}`;
      initializeLSP(fileUri, language);
    }
  });

  document.getElementById('saveBtn').addEventListener('click', async () => {
    const content = editor.getValue();
    let result;
    if (currentFilePath) {
      result = await window.electronAPI.writeFile(currentFilePath, content);
      if (result.success) alert('File saved successfully!');
      else alert('Error saving file: ' + result.error);
    } else {
      result = await window.electronAPI.saveFile(content);
      if (result.success && !result.canceled) {
        currentFilePath = result.filePath;
        document.getElementById('filename').textContent = result.filePath;
        alert('File saved successfully!');
      } else if (!result.canceled) {
        alert('Error saving file: ' + result.error);
      }
    }
  });

  document.getElementById('runBtn').addEventListener('click', async () => {
    const code = editor.getValue();
    const language = editor.getModel().getLanguageId();
    const outputPanel = document.getElementById('outputPanel');
    const outputContent = document.getElementById('outputContent');
    
    outputPanel.classList.remove('hidden');
    outputPanel.classList.add('flex');
    outputContent.textContent = 'Running code...';
    outputContent.classList.remove('text-ycode-red');
    
    const result = await window.electronAPI.executeCode(code, language);
    if (result.success) {
      outputContent.textContent = result.output || 'Code executed successfully (no output)';
    } else {
      outputContent.textContent = result.dockerError || result.error;
      outputContent.classList.add('text-ycode-red');
    }
  });

  document.getElementById('closeOutput').addEventListener('click', () => {
    const outputPanel = document.getElementById('outputPanel');
    outputPanel.classList.add('hidden');
    outputPanel.classList.remove('flex');
  });

  // Terminal setup
  let terminal = null;
  let terminalPid = null;

  document.getElementById('terminalBtn').addEventListener('click', async () => {
    const terminalPanel = document.getElementById('terminalPanel');
    
    if (!terminal) {
      terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Consolas, Courier New, monospace',
        theme: { background: '#1e1e1e', foreground: '#cccccc', cursor: '#cccccc' }
      });

      terminal.open(document.getElementById('terminal'));

      const result = await window.electronAPI.createTerminal();
      if (result.success) {
        terminalPid = result.pid;

        window.electronAPI.onTerminalData((pid, data) => {
          if (pid === terminalPid) terminal.write(data);
        });

        window.electronAPI.onTerminalExit((pid) => {
          if (pid === terminalPid) terminal.write('\r\nTerminal closed\r\n');
        });

        terminal.onData((data) => {
          if (terminalPid) window.electronAPI.terminalInput(terminalPid, data);
        });

        const resizeObserver = new ResizeObserver(() => {
          const container = document.getElementById('terminalContainer');
          if (terminalPid && container) {
            const cols = Math.floor(container.clientWidth / 8.5);
            const rows = Math.floor(container.clientHeight / 17);
            terminal.resize(cols, rows);
            window.electronAPI.terminalResize(terminalPid, cols, rows);
          }
        });
        resizeObserver.observe(document.getElementById('terminalContainer'));
      } else {
        alert('Failed to create terminal: ' + result.error);
        terminal.dispose();
        terminal = null;
        return;
      }
    }

    terminalPanel.classList.remove('hidden');
    terminalPanel.classList.add('flex');
  });

  document.getElementById('closeTerminal').addEventListener('click', async () => {
    const terminalPanel = document.getElementById('terminalPanel');
    if (terminalPid) {
      await window.electronAPI.closeTerminal(terminalPid);
      terminalPid = null;
    }
    if (terminal) {
      terminal.dispose();
      terminal = null;
    }
    terminalPanel.classList.add('hidden');
    terminalPanel.classList.remove('flex');
  });

  // Agent functionality
  const agentBtn = document.getElementById('agentBtn');
  const agentPanel = document.getElementById('agentPanel');
  const closeAgent = document.getElementById('closeAgent');
  const agentSubmit = document.getElementById('agentSubmit');
  const agentInput = document.getElementById('agentInput');
  const agentChat = document.getElementById('agentChat');
  const agentStatus = document.getElementById('agentStatus');
  
  const approvalToast = document.getElementById('approvalToast');
  const approvalCommand = document.getElementById('approvalCommand');
  const btnApprove = document.getElementById('btnApprove');
  const btnDeny = document.getElementById('btnDeny');

  agentBtn.addEventListener('click', () => {
    if (agentPanel.classList.contains('hidden')) {
      agentPanel.classList.remove('hidden');
      agentPanel.classList.add('flex');
      agentInput.focus();
    } else {
      agentPanel.classList.add('hidden');
      agentPanel.classList.remove('flex');
    }
  });

  closeAgent.addEventListener('click', () => {
    agentPanel.classList.add('hidden');
    agentPanel.classList.remove('flex');
  });

  const appendMessage = (role, text) => {
    const div = document.createElement('div');
    if (role === 'user') {
      div.className = 'bg-ycode-blue p-2 rounded self-end whitespace-pre-wrap';
    } else {
      div.className = 'bg-[#2d2d2d] p-2 rounded whitespace-pre-wrap';
    }
    div.textContent = text;
    agentChat.appendChild(div);
    agentChat.scrollTop = agentChat.scrollHeight;
  };

  const sendAgentMessage = async () => {
    const text = agentInput.value.trim();
    if (!text) return;
    
    agentInput.value = '';
    appendMessage('user', text);
    
    const result = await window.electronAPI.agentChat(text);
    if (result.success) {
      appendMessage('agent', result.response);
    } else {
      appendMessage('agent', 'Error: ' + result.error);
    }
  };

  agentSubmit.addEventListener('click', sendAgentMessage);
  agentInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendAgentMessage();
  });

  if (window.electronAPI.onAgentStatus) {
    window.electronAPI.onAgentStatus((status) => {
      agentStatus.textContent = status;
    });

    window.electronAPI.onAgentRequestApproval((command) => {
      approvalCommand.textContent = command;
      approvalToast.classList.remove('hidden');
      approvalToast.classList.add('flex');
    });

    btnApprove.addEventListener('click', () => {
      approvalToast.classList.add('hidden');
      approvalToast.classList.remove('flex');
      window.electronAPI.sendAgentApprovalResponse(true);
    });

    btnDeny.addEventListener('click', () => {
      approvalToast.classList.add('hidden');
      approvalToast.classList.remove('flex');
      window.electronAPI.sendAgentApprovalResponse(false);
    });
  }
});
