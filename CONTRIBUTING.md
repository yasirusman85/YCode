# Contributing to YCode

First off, thank you for considering contributing to YCode! It's people like you that make YCode such a great editor.

## Where do I go from here?

If you've noticed a bug or have a feature request, make sure to check our [Issues](https://github.com/yasirusman85/YCode/issues) page to see if someone else has already created a ticket. If not, go ahead and make one!

## Development Setup

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/your-username/YCode.git
   cd YCode
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Run the app** in development mode:
   ```bash
   npm start
   ```

## Architecture Overview

- **`main.js`**: The Electron main process. Handles window creation, IPC routing, file operations, and Docker interactions.
- **`preload.js`**: Context bridge exposing specific `ipcRenderer` APIs to the browser window safely.
- **`index.html`**: The UI renderer. Loads Monaco editor, xterm.js, and the AI Agent UI.
- **`agent-manager.js`**: Core of the AI Agent Harness. Implements the ReAct loop and tool registry for the autonomous agent.
- **`lsp-manager.js`**: Manages Language Server processes for IntelliSense.
- **`extension-manager.js`**: Loads and manages YCode extensions and plugins.

## Working with the AI Agent

If you are modifying the Agent Harness (`agent-manager.js`), please ensure you test changes with a valid `LLM_API_KEY`. 
When adding new tools to the registry:
1. Add the tool's JSON schema in `getToolsSchema()`.
2. Implement the tool's logic in `executeTool()`.
3. If the tool modifies the system (like writing a file or running a shell command), you MUST ensure appropriate guardrails are in place (e.g., calling `callbacks.onRequestApproval()`).

## Pull Request Process

1. Ensure any install or build dependencies are removed before the end of the layer when doing a build.
2. Update the README.md with details of changes to the interface, this includes new environment variables, exposed ports, useful file locations and container parameters.
3. You may merge the Pull Request in once you have the sign-off of two other developers, or if you do not have permission to do that, you may request the second reviewer to merge it for you.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct. Please be respectful to all members of the community.
