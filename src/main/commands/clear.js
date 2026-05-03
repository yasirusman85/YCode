module.exports = {
  name: 'clear',
  description: 'Clear agent memory context',
  execute: (args, { agentManager }) => {
    return agentManager.clearHistory();
  }
};
