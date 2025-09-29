import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import WebSocketManager from '../services/websocketManager';

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const { addMessage, updateLastMessage } = useAppStore();

  const wsManager = WebSocketManager.getInstance();

  const handleMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'connection':
        console.log('Connection established:', data.client_id);
        break;

      case 'typing':
        setIsTyping(data.is_typing);
        break;

      case 'response':
        console.log('📥 Response received, adding to messages:', data.message);
        setIsTyping(false);
        const assistantMsg = {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.message,
          timestamp: data.timestamp,
          model: data.model_used,
        };
        console.log('💬 Adding assistant message:', assistantMsg);
        addMessage(assistantMsg);
        break;

      case 'stream':
        // Handle streaming response
        updateLastMessage(data.content);
        break;

      case 'stream_end':
        setIsTyping(false);
        break;

      case 'error':
        setIsTyping(false);
        // Error toast is handled in WebSocketManager
        break;

      case 'heartbeat':
        // Heartbeat received
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  }, [addMessage, updateLastMessage]);

  const handleConnectionChange = useCallback((connected: boolean) => {
    setIsConnected(connected);
  }, []);

  useEffect(() => {
    // Register event listeners
    wsManager.on('message', handleMessage);
    wsManager.on('connected', handleConnectionChange);

    // Set initial connection state
    setIsConnected(wsManager.isConnected());

    // Send heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      wsManager.sendHeartbeat();
    }, 30000);

    // Cleanup
    return () => {
      clearInterval(heartbeatInterval);
      wsManager.off('message', handleMessage);
      wsManager.off('connected', handleConnectionChange);
    };
  }, [handleMessage, handleConnectionChange]);

  const sendMessage = useCallback(async (message: string, stream: boolean = false) => {
    return wsManager.sendMessage(message, stream);
  }, []);

  const disconnect = useCallback(() => {
    wsManager.disconnect();
  }, []);

  const reconnect = useCallback(() => {
    // The WebSocketManager handles reconnection automatically
    // This is here for compatibility
  }, []);

  return {
    isConnected,
    isTyping,
    sendMessage,
    disconnect,
    reconnect,
  };
};