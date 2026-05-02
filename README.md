# YCode

A code editor built with Electron and Monaco Editor, featuring secure code execution via Docker containers.

## Features

- **Monaco Editor**: Professional code editing with syntax highlighting
- **File Operations**: Open, save, and edit files on your Windows system
- **Secure Code Execution**: Run code in isolated Docker containers
- **Multi-language Support**: JavaScript, TypeScript, Python, Go, Rust

## Prerequisites

1. **Node.js** (LTS version) - Already installed if you followed the setup
2. **Git** - Already installed if you followed the setup
3. **Docker Desktop for Windows** - Required for code execution

## Installing Docker Desktop

1. Download Docker Desktop for Windows from: https://www.docker.com/products/docker-desktop/
2. Run the installer and follow the setup wizard
3. Start Docker Desktop from your Start menu
4. Wait for Docker to start (you'll see the Docker icon in your system tray)
5. Verify installation by running `docker --version` in PowerShell

## Installation

```bash
npm install
```

## Running the Application

```bash
npm start
```

## Usage

1. **Open File**: Click "Open File" to select a file from your system
2. **Edit Code**: Write or edit code in the Monaco Editor
3. **Run Code**: Click "▶ Run Code" to execute your code in a Docker container
4. **Save File**: Click "Save File" to save your changes

## Code Execution

The editor uses Docker containers to safely execute code:
- Each execution runs in an isolated container
- Network access is disabled for security
- Memory and CPU are limited
- Containers are automatically removed after execution

Supported languages:
- JavaScript/TypeScript (node:alpine)
- Python (python:alpine)
- Go (golang:alpine)
- Rust (rust:alpine)