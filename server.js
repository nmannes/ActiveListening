const WebSocket = require('ws');
const fs = require('fs');

const wss = new WebSocket.Server({ port: 7654 });
const outputFile = fs.createWriteStream('received_stream.webm');

console.log('WebSocket server listening on ws://localhost:7654');

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
        // Log chunk metadata
        console.log(`Received chunk of size: ${message.length} bytes`);

        // Save to file for verification
        outputFile.write(message);
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

process.on('SIGINT', () => {
    outputFile.end();
    wss.close();
    process.exit();
});
