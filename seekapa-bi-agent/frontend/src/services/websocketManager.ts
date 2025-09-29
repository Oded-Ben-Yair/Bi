import { toast } from 'react-hot-toast';

const WS_URL = 'ws://localhost:8000/ws/chat';

class WebSocketManager {
  private static instance: WebSocketManager | null = null;
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isConnecting = false;

  private constructor() {
    this.connect();
  }

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  private connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;

    try {
      console.log('🔌 Creating single WebSocket connection...');
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('✅ WebSocket Connected (Singleton)');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.emit('connected', true);
        toast.success('Connected to Seekapa Copilot');
      };

      this.ws.onmessage = (event) => {
        console.log('📨 WebSocket raw message:', event.data);
        try {
          const data = JSON.parse(event.data);
          console.log('📦 Parsed message:', data);
          this.emit('message', data);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
        this.isConnecting = false;
        toast.error('Connection error');
      };

      this.ws.onclose = () => {
        console.log('WebSocket Disconnected');
        this.isConnecting = false;
        this.emit('connected', false);
        this.handleReconnect();
      };

    } catch (error) {
      console.error('Failed to connect:', error);
      this.isConnecting = false;
      this.handleReconnect();
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < 5) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

      toast.loading(`Reconnecting... (Attempt ${this.reconnectAttempts}/5)`);

      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      toast.error('Failed to connect. Please refresh the page.');
    }
  }

  sendMessage(message: string, stream: boolean = false) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      toast.error('Not connected. Please wait...');
      return false;
    }

    try {
      const payload = {
        type: 'chat',
        message,
        stream,
        context: {
          dataset: 'axia',
          timestamp: new Date().toISOString(),
        },
      };
      console.log('📤 Sending message:', payload);
      this.ws.send(JSON.stringify(payload));
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
      return false;
    }
  }

  sendHeartbeat() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'heartbeat' }));
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
    }
  }

  private emit(event: string, data: any) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(callback => callback(data));
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export default WebSocketManager;