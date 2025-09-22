import { create } from 'zustand';
import { Message, Conversation } from '../types';

interface AppState {
  // Messages
  messages: Message[];
  addMessage: (message: Message) => void;
  updateLastMessage: (content: string) => void;
  clearMessages: () => void;

  // Conversations
  conversations: Conversation[];
  currentConversation: string | null;
  createConversation: (title: string) => Conversation;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;

  // UI State
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;

  // Settings
  streamResponses: boolean;
  setStreamResponses: (stream: boolean) => void;
  preferredModel: string | null;
  setPreferredModel: (model: string | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Messages
  messages: [],
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),
  updateLastMessage: (content) => set((state) => {
    const messages = [...state.messages];
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        lastMessage.content += content;
      }
    }
    return { messages };
  }),
  clearMessages: () => set({ messages: [] }),

  // Conversations
  conversations: [],
  currentConversation: null,
  createConversation: (title) => {
    const conversation: Conversation = {
      id: Date.now().toString(),
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      currentConversation: conversation.id,
      messages: [],
    }));
    return conversation;
  },
  selectConversation: (id) => {
    const conversation = get().conversations.find(c => c.id === id);
    if (conversation) {
      set({
        currentConversation: id,
        messages: conversation.messages,
      });
    }
  },
  deleteConversation: (id) => set((state) => ({
    conversations: state.conversations.filter(c => c.id !== id),
    currentConversation: state.currentConversation === id ? null : state.currentConversation,
  })),

  // UI State
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  theme: 'dark',
  setTheme: (theme) => set({ theme }),

  // Settings
  streamResponses: true,
  setStreamResponses: (stream) => set({ streamResponses: stream }),
  preferredModel: null,
  setPreferredModel: (model) => set({ preferredModel: model }),
}));