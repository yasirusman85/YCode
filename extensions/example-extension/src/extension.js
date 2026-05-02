// YCode Example Extension
// Demonstrates the Extension API

console.log('Example Extension is now active!');

// Register a simple hello world command
const helloCommand = ycode.registerCommand(
  'helloWorld',
  'Hello World',
  async () => {
    const greeting = await ycode.getState('greeting') || 'Hello';
    ycode.showInformationMessage(`${greeting} from YCode Extension!`);
    return { success: true, message: 'Hello World executed' };
  }
);

// Register show info command
const infoCommand = ycode.registerCommand(
  'showInfo',
  'Show Extension Info',
  async () => {
    const info = {
      extension: 'ycode-example-extension',
      version: '1.0.0',
      features: [
        'Command registration',
        'State management',
        'Theme contribution',
        'Status bar integration'
      ]
    };
    
    ycode.showInformationMessage(`Extension Info: ${JSON.stringify(info, null, 2)}`);
    return { success: true, info };
  }
);

// Register a status bar item
const statusBarItem = ycode.registerStatusBarItem(
  'exampleStatus',
  '🎉 Example',
  'Click to run Hello World',
  'example.helloWorld'
);

// Register theme contribution
const theme = ycode.registerTheme('example-dark', {
  name: 'Example Dark',
  type: 'dark',
  colors: {
    'editor.background': '#1a1a2e',
    'editor.foreground': '#eee',
    'activityBar.background': '#16213e',
    'sideBar.background': '#0f3460'
  },
  tokenColors: [
    {
      scope: 'comment',
      settings: {
        foreground: '#6c7983',
        fontStyle: 'italic'
      }
    }
  ]
});

// Listen for file events
const fileOpenHandler = ycode.onFileOpen((filePath) => {
  console.log(`File opened: ${filePath}`);
});

const fileSaveHandler = ycode.onFileSave((filePath) => {
  console.log(`File saved: ${filePath}`);
  ycode.showInformationMessage(`Saved: ${filePath}`);
});

// Store some initial state
ycode.setState('greeting', 'Welcome');
ycode.setState('activated', new Date().toISOString());

console.log('Example Extension commands registered:', [
  helloCommand.id,
  infoCommand.id
]);

console.log('Example Extension status bar item:', statusBarItem.id);

// Export for debugging
exports.activate = () => {
  console.log('Extension activated');
};

exports.deactivate = () => {
  console.log('Extension deactivated');
  // Cleanup
  helloCommand.dispose();
  infoCommand.dispose();
  theme.dispose();
  fileOpenHandler.dispose();
  fileSaveHandler.dispose();
};
