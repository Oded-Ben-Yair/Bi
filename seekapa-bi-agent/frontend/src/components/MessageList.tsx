import React from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { User, Bot, Copy, Check, RotateCcw, ThumbsUp, ThumbsDown } from 'lucide-react';
import { format } from 'date-fns';
import { Message } from '../types';
import { useState } from 'react';

interface MessageListProps {
  messages: Message[];
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<{ [key: string]: 'up' | 'down' }>({});

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFeedback = (messageId: string, type: 'up' | 'down') => {
    setFeedbackGiven({ ...feedbackGiven, [messageId]: type });
    // Here you would send feedback to your backend
  };

  return (
    <div className="space-y-6 px-4">
      {messages.map((message, index) => (
        <motion.div
          key={message.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
        >
          {/* Avatar */}
          <div className={`flex-shrink-0 ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              message.role === 'user'
                ? 'bg-axia-primary/20 text-axia-primary'
                : 'bg-copilot-primary/20 text-copilot-primary'
            }`}>
              {message.role === 'user' ? <User size={20} /> : <Bot size={20} />}
            </div>
          </div>

          {/* Message Content */}
          <div className={`flex-1 ${message.role === 'user' ? 'order-1' : 'order-2'}`}>
            <div className={`${message.role === 'user' ? 'text-right' : 'text-left'}`}>
              <div className="text-xs text-copilot-text-muted mb-1">
                {message.role === 'user' ? 'You' : 'Seekapa Copilot'} • {' '}
                {format(new Date(message.timestamp), 'HH:mm')}
              </div>

              <div className={`inline-block max-w-full ${
                message.role === 'user' ? 'text-right' : 'text-left'
              }`}>
                <div className={`p-4 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-axia-primary/10 border border-axia-primary/30'
                    : 'bg-copilot-dark border border-copilot-border'
                }`}>
                  {message.role === 'assistant' ? (
                    <div className="markdown-content">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ node, inline, className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                              <div className="relative group">
                                <button
                                  onClick={() => handleCopy(String(children), `code-${message.id}`)}
                                  className="absolute top-2 right-2 p-1.5 bg-copilot-darker rounded
                                           opacity-0 group-hover:opacity-100 transition-opacity"
                                  aria-label="Copy code"
                                >
                                  {copiedId === `code-${message.id}` ? (
                                    <Check size={14} className="text-green-500" />
                                  ) : (
                                    <Copy size={14} className="text-copilot-text-secondary" />
                                  )}
                                </button>
                                <SyntaxHighlighter
                                  style={oneDark}
                                  language={match[1]}
                                  PreTag="div"
                                  {...props}
                                >
                                  {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              </div>
                            ) : (
                              <code className={className} {...props}>
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}

                  {/* Actions for assistant messages */}
                  {message.role === 'assistant' && (
                    <div className="mt-3 pt-3 border-t border-copilot-border flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(message.content, message.id)}
                        className="p-1.5 text-copilot-text-secondary hover:text-copilot-primary
                                 transition-colors rounded hover:bg-copilot-hover"
                        aria-label="Copy message"
                      >
                        {copiedId === message.id ? (
                          <Check size={16} className="text-green-500" />
                        ) : (
                          <Copy size={16} />
                        )}
                      </button>

                      <button
                        className="p-1.5 text-copilot-text-secondary hover:text-copilot-primary
                                 transition-colors rounded hover:bg-copilot-hover"
                        aria-label="Regenerate response"
                      >
                        <RotateCcw size={16} />
                      </button>

                      <div className="ml-auto flex items-center gap-1">
                        <button
                          onClick={() => handleFeedback(message.id, 'up')}
                          className={`p-1.5 transition-colors rounded hover:bg-copilot-hover ${
                            feedbackGiven[message.id] === 'up'
                              ? 'text-green-500'
                              : 'text-copilot-text-secondary hover:text-copilot-primary'
                          }`}
                          aria-label="Good response"
                        >
                          <ThumbsUp size={16} />
                        </button>

                        <button
                          onClick={() => handleFeedback(message.id, 'down')}
                          className={`p-1.5 transition-colors rounded hover:bg-copilot-hover ${
                            feedbackGiven[message.id] === 'down'
                              ? 'text-red-500'
                              : 'text-copilot-text-secondary hover:text-copilot-primary'
                          }`}
                          aria-label="Bad response"
                        >
                          <ThumbsDown size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default MessageList;