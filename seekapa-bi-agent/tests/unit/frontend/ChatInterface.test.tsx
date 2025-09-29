/**
 * Unit tests for ChatInterface Component
 * Tests the main chat interface functionality, message handling, and user interactions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ChatInterface from '../../../frontend/src/components/ChatInterface';
import { useWebSocket } from '../../../frontend/src/hooks/useWebSocket';
import { useAppStore } from '../../../frontend/src/store/appStore';

// Mock the hooks
vi.mock('../../../frontend/src/hooks/useWebSocket');
vi.mock('../../../frontend/src/store/appStore');
vi.mock('../../../frontend/src/components/MessageList', () => ({
  default: ({ messages }: { messages: any[] }) => (
    <div data-testid="message-list">
      {messages.map((msg, index) => (
        <div key={index} data-testid={`message-${index}`}>
          {msg.content}
        </div>
      ))}
    </div>
  )
}));

vi.mock('../../../frontend/src/components/TypingIndicator', () => ({
  default: ({ isTyping }: { isTyping: boolean }) =>
    isTyping ? <div data-testid="typing-indicator">Typing...</div> : null
}));

vi.mock('../../../frontend/src/components/SuggestedPrompts', () => ({
  default: ({ onPromptSelect }: { onPromptSelect: (prompt: string) => void }) => (
    <div data-testid="suggested-prompts">
      <button onClick={() => onPromptSelect("What are the top sales by region?")}>
        Top Sales
      </button>
      <button onClick={() => onPromptSelect("Show me revenue trends")}>
        Revenue Trends
      </button>
    </div>
  )
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    textarea: ({ children, ...props }: any) => <textarea {...props}>{children}</textarea>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('ChatInterface', () => {
  const mockSendMessage = vi.fn();
  const mockAddMessage = vi.fn();
  const mockMessages = [
    {
      id: '1',
      role: 'user',
      content: 'Hello',
      timestamp: '2024-01-01T00:00:00Z'
    },
    {
      id: '2',
      role: 'assistant',
      content: 'Hi there! How can I help you with your data analysis today?',
      timestamp: '2024-01-01T00:00:01Z'
    }
  ];

  beforeEach(() => {
    // Mock useWebSocket hook
    vi.mocked(useWebSocket).mockReturnValue({
      sendMessage: mockSendMessage,
      isTyping: false,
      connectionStatus: 'connected',
      lastMessage: null
    });

    // Mock useAppStore hook
    vi.mocked(useAppStore).mockReturnValue({
      messages: mockMessages,
      addMessage: mockAddMessage,
      clearMessages: vi.fn(),
      updateMessage: vi.fn(),
      theme: 'light',
      setTheme: vi.fn()
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders chat interface with all components', () => {
    render(<ChatInterface />);

    expect(screen.getByTestId('message-list')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    expect(screen.getByTestId('suggested-prompts')).toBeInTheDocument();
  });

  it('displays existing messages', () => {
    render(<ChatInterface />);

    expect(screen.getByTestId('message-0')).toHaveTextContent('Hello');
    expect(screen.getByTestId('message-1')).toHaveTextContent('Hi there!');
  });

  it('sends message when send button is clicked', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    const textArea = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(textArea, 'Test message');
    await user.click(sendButton);

    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'user',
        content: 'Test message'
      })
    );
    expect(mockSendMessage).toHaveBeenCalledWith('Test message');
  });

  it('sends message when Enter key is pressed', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    const textArea = screen.getByRole('textbox');

    await user.type(textArea, 'Test message{enter}');

    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'user',
        content: 'Test message'
      })
    );
    expect(mockSendMessage).toHaveBeenCalledWith('Test message');
  });

  it('does not send empty messages', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.click(sendButton);

    expect(mockAddMessage).not.toHaveBeenCalled();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('clears input after sending message', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    const textArea = screen.getByRole('textbox') as HTMLTextAreaElement;
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(textArea, 'Test message');
    expect(textArea.value).toBe('Test message');

    await user.click(sendButton);
    expect(textArea.value).toBe('');
  });

  it('shows typing indicator when assistant is typing', () => {
    vi.mocked(useWebSocket).mockReturnValue({
      sendMessage: mockSendMessage,
      isTyping: true,
      connectionStatus: 'connected',
      lastMessage: null
    });

    render(<ChatInterface />);

    expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
    expect(screen.getByText('Typing...')).toBeInTheDocument();
  });

  it('hides typing indicator when assistant is not typing', () => {
    render(<ChatInterface />);

    expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument();
  });

  it('handles suggested prompt selection', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    const topSalesButton = screen.getByText('Top Sales');
    await user.click(topSalesButton);

    const textArea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textArea.value).toBe('What are the top sales by region?');
  });

  it('auto-focuses input on mount', () => {
    render(<ChatInterface />);

    const textArea = screen.getByRole('textbox');
    expect(textArea).toHaveFocus();
  });

  it('handles Shift+Enter for multiline input', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    const textArea = screen.getByRole('textbox') as HTMLTextAreaElement;

    await user.type(textArea, 'Line 1{shift}{enter}Line 2');

    expect(textArea.value).toBe('Line 1\nLine 2');
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('disables send button when input is empty', () => {
    render(<ChatInterface />);

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();
  });

  it('enables send button when input has content', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    const textArea = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(textArea, 'Test');

    expect(sendButton).not.toBeDisabled();
  });

  it('handles voice recording toggle', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    const micButton = screen.getByRole('button', { name: /microphone/i });
    await user.click(micButton);

    // Voice recording functionality would be tested here
    // This is a placeholder for voice recording tests
  });

  it('handles file attachment', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);

    const attachButton = screen.getByRole('button', { name: /attach/i });
    await user.click(attachButton);

    // File attachment functionality would be tested here
    // This is a placeholder for file attachment tests
  });

  it('scrolls to bottom when new messages arrive', () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    const { rerender } = render(<ChatInterface />);

    const newMessages = [...mockMessages, {
      id: '3',
      role: 'assistant',
      content: 'New message',
      timestamp: '2024-01-01T00:00:02Z'
    }];

    vi.mocked(useAppStore).mockReturnValue({
      messages: newMessages,
      addMessage: mockAddMessage,
      clearMessages: vi.fn(),
      updateMessage: vi.fn(),
      theme: 'light',
      setTheme: vi.fn()
    });

    rerender(<ChatInterface />);

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('handles websocket connection states', () => {
    vi.mocked(useWebSocket).mockReturnValue({
      sendMessage: mockSendMessage,
      isTyping: false,
      connectionStatus: 'disconnected',
      lastMessage: null
    });

    render(<ChatInterface />);

    // Connection status should be indicated in the UI
    // This would test connection status indicators
  });

  it('generates unique message IDs', async () => {
    const user = userEvent.setup();

    // Mock Date.now to return predictable values
    const mockNow = vi.fn();
    mockNow.mockReturnValueOnce(1000).mockReturnValueOnce(2000);
    vi.spyOn(Date, 'now').mockImplementation(mockNow);

    render(<ChatInterface />);

    const textArea = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(textArea, 'Message 1');
    await user.click(sendButton);

    await user.type(textArea, 'Message 2');
    await user.click(sendButton);

    expect(mockAddMessage).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ id: '1000' })
    );
    expect(mockAddMessage).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ id: '2000' })
    );

    vi.restoreAllMocks();
  });

  it('handles message timestamps correctly', async () => {
    const user = userEvent.setup();
    const mockDate = new Date('2024-01-01T12:00:00Z');
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate.toISOString());

    render(<ChatInterface />);

    const textArea = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(textArea, 'Timestamped message');
    await user.click(sendButton);

    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: '2024-01-01T12:00:00.000Z'
      })
    );

    vi.restoreAllMocks();
  });

  it('maintains accessibility features', () => {
    render(<ChatInterface />);

    const textArea = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: /send/i });

    expect(textArea).toHaveAttribute('aria-label');
    expect(sendButton).toHaveAttribute('aria-label');
  });
});