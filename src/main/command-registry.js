const fs = require('fs');
const path = require('path');

class CommandRegistry {
  constructor() {
    this.commands = new Map();
    this.loadCommands();
  }

  loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsPath)) return;

    const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const command = require(path.join(commandsPath, file));
      if (command.name) {
        this.commands.set(command.name, command);
      }
    }
  }

  getCommandList() {
    return Array.from(this.commands.values());
  }

  findMatches(query) {
    if (!query.startsWith('/')) return [];
    const q = query.slice(1).toLowerCase();
    return this.getCommandList().filter(c => c.name.startsWith(q));
  }

  async execute(input, context) {
    const parts = input.trim().split(/\s+/);
    const cmdName = parts[0].slice(1).toLowerCase();
    const args = parts.slice(1);

    const command = this.commands.get(cmdName);
    if (command) {
      return await command.execute(args, context);
    }
    return null;
  }
}

module.exports = new CommandRegistry();
