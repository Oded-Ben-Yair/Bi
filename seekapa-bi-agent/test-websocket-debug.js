#!/usr/bin/env node

/**
 * WebSocket Debug Script for Seekapa Copilot
 * Tests direct WebSocket connection and message flow
 */

const WebSocket = require('ws');
const readline = require('readline');
const colors = require('colors/safe');

// Configuration
const WS_URL = 'ws://localhost:8001/ws/chat';
const TEST_MESSAGES = [
  'Hello, are you there?',
  'What is DS-Axia dataset?',
  'Show me sales metrics',
  'Can you help analyze trends?'
];

// Color-coded console logging
const log = {
  info: (msg) => console.log(colors.blue('[INFO]'), msg),
  success: (msg) => console.log(colors.green('[SUCCESS]'), msg),
  error: (msg) => console.log(colors.red('[ERROR]'), msg),
  warn: (msg) => console.log(colors.yellow('[WARN]'), msg),
  data: (msg) => console.log(colors.cyan('[DATA]'), msg)
};

class WebSocketDebugger {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.messageQueue = [];
    this.responseCount = 0;
    this.startTime = null;
    this.clientId = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      log.info(`Connecting to ${this.url}...`);
      this.startTime = Date.now();

      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        const connectionTime = Date.now() - this.startTime;
        log.success(`Connected in ${connectionTime}ms`);
        this.connected = true;
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          log.error(`Failed to parse message: ${error.message}`);
          log.data(data.toString());
        }
      });

      this.ws.on('error', (error) => {
        log.error(`WebSocket error: ${error.message}`);
        reject(error);
      });

      this.ws.on('close', (code, reason) => {
        log.warn(`Connection closed. Code: ${code}, Reason: ${reason}`);
        this.connected = false;
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('Connection timeout after 10 seconds'));
        }
      }, 10000);
    });
  }

  handleMessage(message) {
    const timestamp = new Date().toISOString();

    switch (message.type) {
      case 'connection':
        log.success(`Connection established with client ID: ${message.client_id}`);
        this.clientId = message.client_id;
        log.info(`Welcome message: ${message.message}`);
        break;

      case 'typing':
        log.info(`Assistant is ${message.is_typing ? 'typing...' : 'done typing'}`);
        break;

      case 'response':
        this.responseCount++;
        const responseTime = Date.now() - this.lastMessageTime;
        log.success(`Response #${this.responseCount} received in ${responseTime}ms`);
        log.data(`Assistant: ${message.message}`);
        if (message.model_used) {
          log.info(`Model used: ${message.model_used}`);
        }
        break;

      case 'stream':
        process.stdout.write(colors.cyan(message.content));
        break;

      case 'stream_end':
        console.log(''); // New line after stream
        log.success('Stream completed');
        break;

      case 'error':
        log.error(`Error from server: ${message.error}`);
        if (message.error_code) {
          log.error(`Error code: ${message.error_code}`);
        }
        break;

      case 'heartbeat':
        log.info('Heartbeat received');
        break;

      default:
        log.warn(`Unknown message type: ${message.type}`);
        log.data(JSON.stringify(message, null, 2));
    }
  }

  sendMessage(text, stream = false) {
    if (!this.connected) {
      log.error('Not connected to WebSocket');
      return;
    }

    const message = {
      type: 'chat',
      message: text,
      stream: stream,
      context: {
        dataset: 'axia',
        timestamp: new Date().toISOString()
      }
    };

    log.info(`Sending message: "${text}" (stream: ${stream})`);
    this.lastMessageTime = Date.now();
    this.ws.send(JSON.stringify(message));
  }

  sendHeartbeat() {
    if (!this.connected) return;

    const message = { type: 'heartbeat' };
    this.ws.send(JSON.stringify(message));
    log.info('Heartbeat sent');
  }

  async runTests() {
    log.info('Starting automated tests...\n');

    for (let i = 0; i < TEST_MESSAGES.length; i++) {
      const message = TEST_MESSAGES[i];
      log.info(`Test ${i + 1}/${TEST_MESSAGES.length}: "${message}"`);

      this.sendMessage(message, i % 2 === 0); // Alternate between stream and non-stream

      // Wait for response
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log('---\n');
    }

    log.success('Automated tests completed');
    log.info(`Total responses received: ${this.responseCount}`);
  }

  startInteractiveMode() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: colors.magenta('You> ')
    });

    console.log('\n' + colors.green('Interactive mode started. Type your messages:'));
    console.log(colors.gray('Commands: /quit, /heartbeat, /stream <message>, /test\n'));

    rl.prompt();

    rl.on('line', (line) => {
      const input = line.trim();

      if (input === '/quit') {
        this.disconnect();
        rl.close();
        process.exit(0);
      } else if (input === '/heartbeat') {
        this.sendHeartbeat();
      } else if (input.startsWith('/stream ')) {
        const message = input.substring(8);
        this.sendMessage(message, true);
      } else if (input === '/test') {
        this.runTests().then(() => rl.prompt());
        return;
      } else if (input) {
        this.sendMessage(input, false);
      }

      rl.prompt();
    });
  }

  disconnect() {
    if (this.ws) {
      log.info('Closing connection...');
      this.ws.close();
    }
  }

  async start(interactive = true) {
    try {
      await this.connect();

      if (interactive) {
        this.startInteractiveMode();
      } else {
        await this.runTests();
        this.disconnect();
      }
    } catch (error) {
      log.error(`Failed to start: ${error.message}`);
      process.exit(1);
    }
  }
}

// Main execution
const main = async () => {
  console.log(colors.bold.cyan('\n================================='));
  console.log(colors.bold.cyan('  Seekapa WebSocket Debugger'));
  console.log(colors.bold.cyan('=================================\n'));

  const args = process.argv.slice(2);
  const interactive = !args.includes('--auto');

  const wsDebugger = new WebSocketDebugger(WS_URL);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n');
    log.info('Shutting down...');
    wsDebugger.disconnect();
    process.exit(0);
  });

  await wsDebugger.start(interactive);
};

// Check if ws module is installed
try {
  require('ws');
  require('colors/safe');
} catch (error) {
  console.error('Required modules not found. Installing...');
  require('child_process').execSync('npm install ws colors', { stdio: 'inherit' });
  console.log('Modules installed. Please run the script again.');
  process.exit(0);
}

// Run the debugger
main().catch(console.error);