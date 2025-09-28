// WebSocket Test Script
const WebSocket = require('ws');

const WS_URL = 'ws://localhost:8001/ws/chat';

console.log('Testing WebSocket connection to:', WS_URL);

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('✅ WebSocket Connected Successfully!');
    console.log('Sending test message...');

    // Send a test message
    ws.send(JSON.stringify({
        type: 'chat',
        message: 'Hello, can you help me analyze the Axia dataset?',
        stream: false,
        context: {
            dataset: 'axia',
            timestamp: new Date().toISOString()
        }
    }));
});

ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('📨 Received message:', JSON.stringify(message, null, 2));

    if (message.type === 'response') {
        console.log('✅ Full test completed successfully!');
        console.log('The WebSocket is working properly.');
        ws.close();
        process.exit(0);
    }
});

ws.on('error', (error) => {
    console.error('❌ WebSocket Error:', error.message);
    process.exit(1);
});

ws.on('close', () => {
    console.log('WebSocket connection closed');
});

// Timeout after 30 seconds
setTimeout(() => {
    console.log('⏱️ Test timeout after 30 seconds');
    ws.close();
    process.exit(1);
}, 30000);