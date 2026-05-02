#!/usr/bin/env node

const readline = require('readline');
const AgentManager = require('./agent-manager');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  red: "\x1b[31m"
};

const agentManager = new AgentManager();
const systemMessage = "You are an autonomous engineer operating from a terminal CLI. You have access to a terminal and file system. Use the run_shell tool to verify your changes before finishing.";

console.log(`${colors.bright}${colors.cyan}=================================================${colors.reset}`);
console.log(`${colors.bright}${colors.cyan}   🤖 YCode Agent CLI - Terminal Based IDE      ${colors.reset}`);
console.log(`${colors.bright}${colors.cyan}=================================================${colors.reset}`);
console.log(`${colors.yellow}Type your request below. Type 'exit' to quit.${colors.reset}\n`);

// Helper for interactive approval
const askApproval = (command) => {
  return new Promise((resolve) => {
    console.log(`\n${colors.bright}${colors.red}⚠️  AGENT REQUESTS SHELL EXECUTION ⚠️${colors.reset}`);
    console.log(`${colors.yellow}Command:${colors.reset} ${command}`);
    rl.question(`${colors.bright}Approve this command? (y/n): ${colors.reset}`, (answer) => {
      if (answer.toLowerCase().startsWith('y')) {
        resolve(true);
      } else {
        console.log(`${colors.red}Command denied.${colors.reset}`);
        resolve(false);
      }
    });
  });
};

const callbacks = {
  onAgentStatus: (status) => {
    // Only print meaningful status changes, clear line to avoid spam
    process.stdout.write(`\r\x1b[K${colors.magenta}[Agent Status]:${colors.reset} ${status}`);
    if (status === 'Idle' || status === 'Waiting for user approval...' || status === 'Error') {
      console.log(); // newline
    }
  },
  onRequestApproval: async (command) => {
    // Clear the line before asking
    process.stdout.write('\r\x1b[K');
    const approved = await askApproval(command);
    return approved;
  }
};

const chatLoop = () => {
  rl.question(`${colors.bright}${colors.green}You > ${colors.reset}`, async (input) => {
    const text = input.trim();
    if (!text) return chatLoop();
    
    if (text.toLowerCase() === 'exit' || text.toLowerCase() === 'quit') {
      console.log(`${colors.cyan}Goodbye!${colors.reset}`);
      rl.close();
      process.exit(0);
    }

    try {
      const response = await agentManager.run(text, systemMessage, callbacks);
      console.log(`\n${colors.bright}${colors.cyan}Agent > ${colors.reset}${response}\n`);
    } catch (error) {
      console.log(`\n${colors.red}Error: ${error.message}${colors.reset}\n`);
    }

    chatLoop();
  });
};

// Check if API key is set
if (!process.env.LLM_API_KEY && !agentManager.openai.apiKey) {
  console.log(`${colors.red}Warning: LLM_API_KEY environment variable is not set! The agent may not work.${colors.reset}\n`);
}

chatLoop();
