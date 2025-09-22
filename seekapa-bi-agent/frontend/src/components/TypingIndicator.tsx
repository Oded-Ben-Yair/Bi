import React from 'react';
import { motion } from 'framer-motion';

const TypingIndicator: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex gap-4 px-4 py-2"
    >
      <div className="w-10 h-10 rounded-full bg-copilot-primary/20 flex items-center justify-center">
        <div className="typing-dots flex gap-1">
          <span className="w-2 h-2 bg-copilot-primary rounded-full"></span>
          <span className="w-2 h-2 bg-copilot-primary rounded-full"></span>
          <span className="w-2 h-2 bg-copilot-primary rounded-full"></span>
        </div>
      </div>
      <div className="flex items-center text-sm text-copilot-text-secondary">
        Seekapa Copilot is thinking...
      </div>
    </motion.div>
  );
};

export default TypingIndicator;