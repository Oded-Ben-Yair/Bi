import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Database, Settings, Menu, X } from 'lucide-react';
import ChatInterface from './components/ChatInterface';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { useWebSocket } from './hooks/useWebSocket';
import { useAppStore } from './store/appStore';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { isConnected } = useWebSocket();
  const { currentConversation } = useAppStore();

  return (
    <div className="flex h-screen bg-copilot-darker overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.div
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-80 bg-copilot-dark border-r border-copilot-border"
          >
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <Header
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          isConnected={isConnected}
        />

        {/* Chat Interface */}
        <main className="flex-1 overflow-hidden">
          <ChatInterface />
        </main>
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="p-3 bg-copilot-primary rounded-full shadow-copilot hover:shadow-copilot-hover transition-shadow"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle sidebar"
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </motion.button>
      </div>

      {/* Connection Status Indicator */}
      <div className="fixed bottom-8 left-8">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full glass ${
          isConnected ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`} />
          <span className="text-sm text-copilot-text-secondary">
            {isConnected ? 'Connected to DS-Axia' : 'Connecting...'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default App;