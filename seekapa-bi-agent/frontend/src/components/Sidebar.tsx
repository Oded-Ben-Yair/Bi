import React from 'react';
import { motion } from 'framer-motion';
import { Plus, MessageSquare, Trash2, Database, TrendingUp, BarChart2 } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { format } from 'date-fns';

interface SidebarProps {
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const { conversations, currentConversation, createConversation, selectConversation, deleteConversation } = useAppStore();

  const handleNewChat = () => {
    createConversation('New Chat');
  };

  return (
    <div className="h-full flex flex-col bg-copilot-dark">
      {/* Header */}
      <div className="p-4 border-b border-copilot-border">
        <button
          onClick={handleNewChat}
          className="w-full p-3 bg-copilot-primary hover:bg-copilot-secondary text-white rounded-lg
                   flex items-center justify-center gap-2 transition-colors"
        >
          <Plus size={20} />
          <span>New Chat</span>
        </button>
      </div>

      {/* Quick Actions */}
      <div className="p-4 space-y-2 border-b border-copilot-border">
        <h3 className="text-xs text-copilot-text-muted uppercase tracking-wider mb-2">Quick Actions</h3>

        <button className="w-full p-2 text-left text-copilot-text-secondary hover:text-copilot-primary
                         hover:bg-copilot-hover rounded transition-all flex items-center gap-2">
          <Database size={16} />
          <span className="text-sm">Dataset Info</span>
        </button>

        <button className="w-full p-2 text-left text-copilot-text-secondary hover:text-copilot-primary
                         hover:bg-copilot-hover rounded transition-all flex items-center gap-2">
          <TrendingUp size={16} />
          <span className="text-sm">Analyze Trends</span>
        </button>

        <button className="w-full p-2 text-left text-copilot-text-secondary hover:text-copilot-primary
                         hover:bg-copilot-hover rounded transition-all flex items-center gap-2">
          <BarChart2 size={16} />
          <span className="text-sm">Generate Report</span>
        </button>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        <h3 className="text-xs text-copilot-text-muted uppercase tracking-wider mb-2">Recent Chats</h3>

        {conversations.length === 0 ? (
          <p className="text-sm text-copilot-text-muted text-center py-8">
            No conversations yet
          </p>
        ) : (
          <div className="space-y-1">
            {conversations.map((conversation) => (
              <motion.div
                key={conversation.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`group flex items-center gap-2 p-2 rounded cursor-pointer transition-all ${
                  currentConversation === conversation.id
                    ? 'bg-copilot-primary/20 text-copilot-primary'
                    : 'hover:bg-copilot-hover text-copilot-text-secondary'
                }`}
                onClick={() => selectConversation(conversation.id)}
              >
                <MessageSquare size={16} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{conversation.title}</p>
                  <p className="text-xs text-copilot-text-muted">
                    {format(new Date(conversation.updatedAt), 'MMM d, HH:mm')}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conversation.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-copilot-text-muted
                           hover:text-red-500 transition-all"
                  aria-label="Delete conversation"
                >
                  <Trash2 size={14} />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-copilot-border">
        <div className="text-xs text-copilot-text-muted">
          <p>Connected to DS-Axia</p>
          <p className="text-copilot-text-muted/60">Dataset ID: 2d5e711e-d013...</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;