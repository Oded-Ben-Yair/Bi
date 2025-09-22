import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Paperclip, Mic, StopCircle } from 'lucide-react';
import MessageList from './MessageList';
import TypingIndicator from './TypingIndicator';
import SuggestedPrompts from './SuggestedPrompts';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAppStore } from '../store/appStore';
import { Message } from '../types';

const ChatInterface: React.FC = () => {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { sendMessage, isTyping } = useWebSocket();
  const { messages, addMessage, currentConversation } = useAppStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    addMessage(userMessage);
    setInput('');

    // Send via WebSocket
    await sendMessage(input);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full bg-copilot-darker">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-4xl mx-auto py-8">
          {messages.length === 0 ? (
            <div className="text-center py-16">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-8"
              >
                <div className="inline-flex p-6 rounded-full bg-gradient-to-br from-copilot-primary/20 to-copilot-accent/20 mb-6">
                  <Sparkles size={48} className="text-copilot-primary" />
                </div>
                <h1 className="text-3xl font-bold mb-2 gradient-text">
                  Seekapa Copilot
                </h1>
                <p className="text-copilot-text-secondary text-lg">
                  Your AI assistant for DS-Axia data analysis
                </p>
              </motion.div>

              <SuggestedPrompts onPromptClick={handlePromptClick} />
            </div>
          ) : (
            <>
              <MessageList messages={messages} />
              {isTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-copilot-border bg-copilot-dark">
        <div className="max-w-4xl mx-auto p-4">
          <div className="flex items-end gap-2">
            {/* Attachment Button */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-3 text-copilot-text-secondary hover:text-copilot-primary transition-colors"
              aria-label="Attach file"
            >
              <Paperclip size={20} />
            </motion.button>

            {/* Input Field */}
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about DS-Axia data..."
                className="w-full px-4 py-3 bg-copilot-darker border border-copilot-border rounded-lg
                         text-copilot-text-primary placeholder-copilot-text-muted
                         focus:outline-none focus:border-copilot-primary resize-none
                         transition-all duration-200"
                rows={1}
                style={{ minHeight: '48px', maxHeight: '120px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                }}
              />
            </div>

            {/* Voice Input Button */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className={`p-3 transition-colors ${
                isRecording
                  ? 'text-red-500 hover:text-red-600'
                  : 'text-copilot-text-secondary hover:text-copilot-primary'
              }`}
              onClick={() => setIsRecording(!isRecording)}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {isRecording ? <StopCircle size={20} /> : <Mic size={20} />}
            </motion.button>

            {/* Send Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSend}
              disabled={!input.trim()}
              className={`p-3 rounded-lg transition-all duration-200 ${
                input.trim()
                  ? 'bg-copilot-primary text-white hover:bg-copilot-secondary'
                  : 'bg-copilot-border text-copilot-text-muted cursor-not-allowed'
              }`}
              aria-label="Send message"
            >
              <Send size={20} />
            </motion.button>
          </div>

          {/* Input hints */}
          <div className="mt-2 text-xs text-copilot-text-muted">
            Press <kbd className="px-1 py-0.5 bg-copilot-border rounded">Enter</kbd> to send,{' '}
            <kbd className="px-1 py-0.5 bg-copilot-border rounded">Shift+Enter</kbd> for new line
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;