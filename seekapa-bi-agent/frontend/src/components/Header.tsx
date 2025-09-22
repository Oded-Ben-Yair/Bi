import React from 'react';
import { Menu, Sparkles, Settings, HelpCircle } from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
  isConnected: boolean;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  return (
    <header className="h-16 border-b border-copilot-border bg-copilot-dark/80 backdrop-blur-lg">
      <div className="h-full px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="p-2 text-copilot-text-secondary hover:text-copilot-primary transition-colors"
            aria-label="Toggle menu"
          >
            <Menu size={24} />
          </button>

          <div className="flex items-center gap-2">
            <Sparkles className="text-copilot-primary" size={24} />
            <h1 className="text-xl font-semibold">
              <span className="gradient-text">Seekapa Copilot</span>
            </h1>
            <span className="ml-2 px-2 py-0.5 text-xs bg-axia-primary/20 text-axia-primary rounded-full">
              DS-Axia
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="p-2 text-copilot-text-secondary hover:text-copilot-primary transition-colors"
            aria-label="Help"
          >
            <HelpCircle size={20} />
          </button>
          <button
            className="p-2 text-copilot-text-secondary hover:text-copilot-primary transition-colors"
            aria-label="Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;