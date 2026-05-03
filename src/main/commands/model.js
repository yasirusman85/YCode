module.exports = {
  name: 'model',
  description: 'Switch LLM model',
  suggestedModels: [
    'gpt-4o',
    'gpt-3.5-turbo',
    'claude-3-opus-20240229',
    'llama3-70b-8192',
    'llama3-8b-8192'
  ],
  execute: (args, { agentManager, colors }) => {
    const model = args.join(' ').trim();
    if (!model) {
      return null; // Signals CLI to enter interactive mode
    }
    return agentManager.updateSettings({ model });
  }
};
