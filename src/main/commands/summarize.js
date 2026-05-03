module.exports = {
  name: 'summarize',
  description: 'Compress memory context',
  async execute(args, { agentManager }) {
    return await agentManager.summarizeHistory();
  }
};
