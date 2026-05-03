#!/usr/bin/env node

const readline = require('readline');
const AgentManager = require('./main/agent-manager');
const commandRegistry = require('./main/command-registry');
const path = require('path');

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  bgBlue: "\x1b[44m",
  white: "\x1b[37m"
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer: (line) => {
    const hits = commandRegistry.findMatches(line).map(c => `/${c.name} `);
    return [hits.length ? hits : [], line];
  }
});

const agentManager = new AgentManager();
const workspacePath = path.basename(process.cwd());

const renderDashboard = () => {
  const width = 60;
  const line = "━".repeat(width);
  console.log(`\n${colors.blue}┏${line}┓${colors.reset}`);
  console.log(`${colors.blue}┃${colors.reset} ${colors.bright}${colors.cyan}YCODE TERMINAL IDE${colors.reset}${" ".repeat(width - 19)}${colors.blue}┃${colors.reset}`);
  console.log(`${colors.blue}┣${line}┫${colors.reset}`);
  console.log(`${colors.blue}┃${colors.reset} ${colors.yellow}Workspace:${colors.reset} ${workspacePath.padEnd(15)} ${colors.yellow}Model:${colors.reset} ${agentManager.model.padEnd(20)} ${colors.blue}┃${colors.reset}`);
  console.log(`${colors.blue}┗${line}┛${colors.reset}\n`);
};

const interactiveSelect = async (options, title) => {
  let selectedIndex = 0;
  
  return new Promise((resolve) => {
    const render = () => {
      process.stdout.write('\u001b[s'); // Save cursor
      console.log(`\n${colors.bright}${colors.cyan}── ${title} ──${colors.reset}`);
      options.forEach((opt, i) => {
        if (i === selectedIndex) {
          console.log(`${colors.green}  ➜ ${colors.bright}${opt}${colors.reset}`);
        } else {
          console.log(`${colors.dim}    ${opt}${colors.reset}`);
        }
      });
      console.log(`${colors.dim}  (Use Arrows to navigate, Enter to select)${colors.reset}`);
    };

    render();

    const handleKey = (str, key) => {
      if (key.name === 'up') {
        selectedIndex = (selectedIndex - 1 + options.length) % options.length;
        process.stdout.write('\u001b[u\u001b[J'); // Restore and clear below
        render();
      } else if (key.name === 'down') {
        selectedIndex = (selectedIndex + 1) % options.length;
        process.stdout.write('\u001b[u\u001b[J');
        render();
      } else if (key.name === 'return') {
        process.stdin.removeListener('keypress', handleKey);
        process.stdout.write('\u001b[u\u001b[J');
        resolve(options[selectedIndex]);
      }
    };

    process.stdin.on('keypress', handleKey);
  });
};

const callbacks = {
  onStatus: (status) => {
    process.stdout.write(`\r\x1b[K${colors.magenta}✨ [Agent]:${colors.reset} ${status}...`);
  },
  onRequestApproval: async (command) => {
    process.stdout.write('\r\x1b[K');
    console.log(`\n${colors.bgBlue}${colors.white}  PENDING APPROVAL  ${colors.reset}`);
    console.log(`${colors.dim}┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓${colors.reset}`);
    console.log(` ${colors.yellow}${command}${colors.reset}`);
    console.log(`${colors.dim}┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛${colors.reset}`);
    
    const answer = await new Promise(r => rl.question(`${colors.bright}Approve? (y/n): ${colors.reset}`, r));
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  }
};

// Real-time Command Hints
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);

process.stdin.on('keypress', (str, key) => {
  if (key && key.ctrl && key.name === 'c') process.exit();
  
  setImmediate(() => {
    const line = rl.line;
    process.stdout.write('\u001b[s');
    process.stdout.write('\u001b[1B\u001b[2K\r');
    if (line.startsWith('/')) {
      const matches = commandRegistry.findMatches(line);
      if (matches.length > 0) {
        const hint = matches.map(m => `${colors.green}/${m.name}${colors.reset}`).join('  ');
        process.stdout.write(`${colors.dim}Suggestions: ${colors.reset}${hint}`);
      }
    }
    process.stdout.write('\u001b[u');
  });
});

renderDashboard();

const chatLoop = () => {
  rl.question(`${colors.bright}${colors.green}You ❯ ${colors.reset}`, async (input) => {
    const text = input.trim();
    if (!text) return chatLoop();
    
    if (text.toLowerCase() === 'exit' || text.toLowerCase() === 'quit') {
      console.log(`\n${colors.cyan}Goodbye! See you soon.${colors.reset}`);
      rl.close();
      process.exit(0);
    }

    process.stdout.write('\u001b[s\u001b[1B\u001b[2K\u001b[u');

    if (text.startsWith('/')) {
      const cmdParts = text.split(' ');
      const cmdName = cmdParts[0].slice(1).toLowerCase();
      
      // Special handling for interactive model selection
      if (cmdName === 'model' && cmdParts.length === 1) {
        const cmdModule = require('./main/commands/model');
        const selected = await interactiveSelect(cmdModule.suggestedModels, 'Select LLM Model');
        const result = agentManager.updateSettings({ model: selected });
        console.log(`\n${colors.bright}${colors.cyan}Agent ❯ ${colors.reset}${result}\n`);
        return chatLoop();
      }

      const result = await commandRegistry.execute(text, { agentManager, colors });
      if (result !== null) {
        if (cmdName === 'help' || text === '/') {
          console.log(`\n${colors.bright}${colors.cyan}── Command List ──${colors.reset}`);
          commandRegistry.getCommandList().forEach(c => {
            console.log(`  ${colors.green}/${c.name.padEnd(12)}${colors.reset} ${colors.dim}${c.description}${colors.reset}`);
          });
          console.log('');
        } else {
          console.log(`\n${colors.bright}${colors.cyan}Agent ❯ ${colors.reset}${result}\n`);
        }
        return chatLoop();
      }
    }

    if (!process.env.LLM_API_KEY && (!agentManager.openai || agentManager.openai.apiKey === 'dummy-key')) {
      console.log(`\n${colors.bright}${colors.red}✖ Error:${colors.reset} No API key detected.`);
      console.log(`${colors.dim}Use ${colors.green}/key <your-key>${colors.dim} to get started.${colors.reset}\n`);
      return chatLoop();
    }

    try {
      const response = await agentManager.run(text, "You are a world-class autonomous software engineer. Be precise and proactive.", callbacks);
      console.log(`\n${colors.bright}${colors.cyan}Agent ❯ ${colors.reset}${response}\n`);
    } catch (error) {
      console.log(`\n${colors.red}✖ Error: ${error.message}${colors.reset}\n`);
    }

    chatLoop();
  });
};

chatLoop();
