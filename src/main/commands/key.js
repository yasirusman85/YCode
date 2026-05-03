module.exports = {
  name: 'key',
  description: 'Set API Key',
  execute: (args, { agentManager }) => {
    const apiKey = args.join(' ').trim();
    if (!apiKey) {
      return 'Please provide an API key: /key sk-...';
    }
    agentManager.updateSettings({ apiKey });
    return 'API Key updated securely.';
  }
};
