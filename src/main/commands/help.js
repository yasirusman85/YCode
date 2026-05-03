module.exports = {
  name: 'help',
  description: 'Show available commands',
  execute: (args, { agentManager, colors }) => {
    console.log(`\n${colors.bright}${colors.cyan}Available Commands:${colors.reset}`);
    return null; // Registry will handle printing the list
  }
};
