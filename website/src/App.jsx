import React from 'react';
import { Terminal, Cpu, Zap, Download, Code2, Sparkles, Server } from 'lucide-react';

function App() {
  return (
    <div className="min-h-screen">
      {/* Background ambient light */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-ycode-purple/20 blur-[120px] pointer-events-none z-[-1]"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-ycode-blue/20 blur-[120px] pointer-events-none z-[-1]"></div>

      {/* Navbar */}
      <nav className="glass sticky top-0 z-50 px-6 py-4 flex justify-between items-center border-x-0 border-t-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-ycode-blue to-ycode-purple flex items-center justify-center glow-blue">
            <Terminal size={18} className="text-white" />
          </div>
          <span className="font-bold text-xl tracking-wider">YCODE</span>
        </div>
        <div className="flex gap-4">
          <a href="#install" className="text-sm font-medium hover:text-white transition-colors flex items-center gap-2">
            Installation
          </a>
          <a href="https://github.com/yasirusman85/YCode" target="_blank" rel="noreferrer" className="text-sm font-medium hover:text-white transition-colors flex items-center gap-2">
            GitHub
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 py-24 max-w-6xl mx-auto text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-ycode-blue font-medium mb-8">
          <Sparkles size={14} /> Meet the Autonomous Supervisor
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight tracking-tight">
          The Desktop IDE that <br className="hidden md:block"/> 
          <span className="gradient-text">Writes Itself</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-10 leading-relaxed">
          YCode is a next-generation local developer environment powered by Groq and Llama 3. Tell it what to build, and watch it coordinate agents, execute terminal commands, and write code—entirely autonomously.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 mb-16">
          <a href="#install" className="px-8 py-3 rounded-lg bg-ycode-blue hover:bg-blue-500 text-white font-semibold transition-all glow-blue flex items-center justify-center gap-2">
            <Download size={20} /> Download for Desktop
          </a>
          <a href="https://github.com/yasirusman85/YCode" target="_blank" rel="noreferrer" className="px-8 py-3 rounded-lg glass hover:bg-white/5 transition-all font-semibold flex items-center justify-center gap-2">
            <Terminal size={20} /> Open Source CLI
          </a>
        </div>

        {/* Hero Mockup */}
        <div className="w-full max-w-4xl glass rounded-xl overflow-hidden shadow-2xl border border-white/10 glow-purple">
          <div className="bg-[#1e1e1e] px-4 py-3 flex items-center gap-2 border-b border-white/5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <div className="mx-auto text-xs text-gray-500 font-mono">ycode — autonomous-supervisor</div>
          </div>
          <div className="bg-[#0f111a] p-6 text-left font-mono text-sm leading-loose">
            <div className="text-gray-400">➜ <span className="text-ycode-blue font-bold">/supervisor</span> Build a login page in React</div>
            <div className="text-gray-500 mt-2">┌─ 🧠 Supervisor Thought ─────────────────────────</div>
            <div className="text-yellow-400">│ I need to scaffold the React app first, then create the Login.jsx component.</div>
            <div className="text-gray-500">└─────────────────────────────────────────────────</div>
            <div className="text-blue-400 mt-2">┌─ ⚡ Supervisor Action ──────────────────────────</div>
            <div className="text-cyan-300">│ Agent, run 'npx create-react-app login-demo'</div>
            <div className="text-blue-400">└─────────────────────────────────────────────────</div>
            <div className="text-magenta-400 mt-2">✨ [Agent]: Running command...</div>
            <div className="text-green-400 mt-2">🎉 Goal achieved successfully.</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-black/20 border-y border-white/5 relative">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">No Servers Required.</h2>
            <p className="text-gray-400 max-w-xl mx-auto">Run everything locally. Bring your own API key. Own your environment.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="glass p-8 rounded-2xl">
              <div className="w-12 h-12 rounded-lg bg-ycode-purple/20 flex items-center justify-center mb-6 text-ycode-purple">
                <Cpu size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3">Autonomous Supervisor</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Give YCode a high-level goal and step back. The Supervisor manages sub-agents, reads terminal output, and fixes bugs autonomously until the task is complete.
              </p>
            </div>
            
            <div className="glass p-8 rounded-2xl">
              <div className="w-12 h-12 rounded-lg bg-ycode-blue/20 flex items-center justify-center mb-6 text-ycode-blue">
                <Zap size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3">Groq Powered</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                By natively supporting Groq hardware and Llama 3, the agent's thought process is instantaneous. Watch code generate faster than you can read it.
              </p>
            </div>

            <div className="glass p-8 rounded-2xl">
              <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center mb-6 text-green-500">
                <Code2 size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3">Desktop Integrated</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Unlike web playgrounds, YCode lives on your local machine. It edits your actual files, commits to your Git repo, and runs your local bash terminal.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Installation */}
      <section id="install" className="py-24 max-w-4xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">Get Started in Seconds</h2>
        
        <div className="glass rounded-xl overflow-hidden mb-8">
          <div className="bg-white/5 px-6 py-4 border-b border-white/5 font-semibold flex items-center gap-2">
            <Server size={18} className="text-ycode-purple" />
            1. Install the CLI Package
          </div>
          <div className="p-6 font-mono text-sm">
            <p className="text-gray-500 mb-2">// Requires Node.js v18+</p>
            <div className="bg-black p-4 rounded-lg flex justify-between items-center group cursor-pointer hover:bg-black/80 transition-colors">
              <span className="text-green-400">npm <span className="text-white">install -g ycode</span></span>
              <span className="text-gray-600 group-hover:text-white transition-colors text-xs uppercase tracking-widest">Copy</span>
            </div>
          </div>
        </div>

        <div className="glass rounded-xl overflow-hidden">
          <div className="bg-white/5 px-6 py-4 border-b border-white/5 font-semibold flex items-center gap-2">
            <Zap size={18} className="text-ycode-blue" />
            2. Configure Your Groq Key
          </div>
          <div className="p-6 font-mono text-sm">
            <p className="text-gray-500 mb-2">// Run ycode and use the built-in commands</p>
            <div className="bg-black p-4 rounded-lg flex flex-col gap-2">
              <div><span className="text-gray-400">$</span> <span className="text-blue-300">ycode</span></div>
              <div><span className="text-gray-400">Agent ❯</span> <span className="text-white">/key gsk_your_groq_api_key</span></div>
              <div><span className="text-gray-400">Agent ❯</span> <span className="text-white">/baseurl https://api.groq.com/openai/v1</span></div>
              <div><span className="text-gray-400">Agent ❯</span> <span className="text-white">/supervisor Build me a python snake game</span></div>
            </div>
          </div>
        </div>
        
        <div className="mt-12 text-center">
          <p className="text-gray-400 text-sm">
            Want the full GUI Desktop App? <a href="https://github.com/yasirusman85/YCode" className="text-ycode-blue hover:underline">Clone the repository</a> and run `npm start` for the gorgeous Electron interface.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-gray-500 text-sm">
        <p>© 2026 YCode. Built for autonomous developers.</p>
      </footer>
    </div>
  );
}

export default App;
