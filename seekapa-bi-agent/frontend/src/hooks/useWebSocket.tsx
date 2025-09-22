import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { toast } from 'react-hot-toast';

const WS_URL = 'ws://localhost:8000/ws/chat';

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  const { addMessage, updateLastMessage } = useAppStore();

  const connect = useCallback(() => {
    try {
      ws.current = new WebSocket(WS_URL);

      ws.current.onopen = () => {
        console.log('WebSocket Connected');
        setIsConnected(true);
        reconnectAttempts.current = 0;
        toast.success('Connected to Seekapa Copilot');
      };

      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleMessage(data);
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket Error:', error);
        toast.error('Connection error');
      };

      ws.current.onclose = () => {
        console.log('WebSocket Disconnected');
        setIsConnected(false);
        handleReconnect();
      };

    } catch (error) {
      console.error('Failed to connect:', error);
      handleReconnect();
    }
  }, []);

  const handleMessage = (data: any) => {
    switch (data.type) {
      case 'connection':
        console.log('Connection established:', data.client_id);
        break;

      case 'typing':
        setIsTyping(data.is_typing);
        break;

      case 'response':
        setIsTyping(false);
        addMessage({
          id: Date.now().toString(),
          role: 'assistant',
          content: data.message,
          timestamp: data.timestamp,
          model: data.model_used,
        });
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
        toast.error(data.error || 'An error occurred');
        break;

      case 'heartbeat':
        // Heartbeat received
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  };

  const handleReconnect = () => {
    if (reconnectAttempts.current < 5) {
      reconnectAttempts.current++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);

      toast.loading(`Reconnecting... (Attempt ${reconnectAttempts.current}/5)`);

      reconnectTimer.current = setTimeout(() => {
        connect();
      }, delay);
    } else {
      toast.error('Failed to connect. Please refresh the page.');
    }
  };

  const sendMessage = useCallback(async (message: string, stream: boolean = false) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      toast.error('Not connected. Please wait...');
      return;
    }

    try {
      ws.current.send(JSON.stringify({
        type: 'chat',
        message,
        stream,
        context: {
          dataset: 'axia',
          timestamp: new Date().toISOString(),
        },
      }));
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
    }
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  }, []);

  useEffect(() => {
    connect();

    // Send heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 30000);

    return () => {
      clearInterval(heartbeatInterval);
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    isTyping,
    sendMessage,
    disconnect,
    reconnect: connect,
  };
};