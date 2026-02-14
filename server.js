const WebSocket = require('ws');
const fs = require('fs');
const { spawn } = require('child_process');
const { pipeline } = require('@xenova/transformers');

// Initialize the transcription pipeline
let transcriber;
const initTranscriber = async () => {
    console.log('Loading transcription model (Whisper base.en)...');
    transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base.en', {
        cache_dir: './models',
    });
    console.log('Model loaded.');
};

initTranscriber();

const wss = new WebSocket.Server({ port: 7654 });
const outputFile = fs.createWriteStream('received_stream.webm');

console.log('WebSocket server listening on ws://localhost:7654');

wss.on('connection', (ws) => {
    console.log('Client connected');

    // Spawn ffmpeg to convert WebM/Opus to PCM 16kHz Mono
    const ffmpeg = spawn('ffmpeg', [
        '-i', 'pipe:0',          // Input from stdin
        '-f', 's16le',           // Output format: 16-bit PCM little-endian
        '-acodec', 'pcm_s16le',
        '-ar', '16000',          // 16kHz
        '-ac', '1',              // Mono
        'pipe:1'                 // Output to stdout
    ]);

    let audioBuffer = [];
    const CHUNK_THRESHOLD = 16000 * 2 * 2; // ~2 seconds of audio (16k samples * 2 bytes/sample * 2s)

    ffmpeg.stdout.on('data', async (chunk) => {
        // Collect PCM data
        audioBuffer.push(chunk);

        const totalLength = audioBuffer.reduce((acc, c) => acc + c.length, 0);
        if (totalLength >= CHUNK_THRESHOLD) {
            const fullBuffer = Buffer.concat(audioBuffer);
            audioBuffer = []; // Clear for next batch

            // Convert to Float32Array for Transformers.js
            const float32Array = new Float32Array(fullBuffer.length / 2);
            for (let i = 0; i < float32Array.length; i++) {
                float32Array[i] = fullBuffer.readInt16LE(i * 2) / 32768.0;
            }

            if (transcriber) {
                try {
                    const result = await transcriber(float32Array);
                    console.log('Transcribed:', result.text);
                } catch (e) {
                    console.error('Transcription error:', e);
                }
            }
        }
    });

    ffmpeg.stderr.on('data', (data) => {
        // console.log(`ffmpeg debug: ${data}`);
    });

    ws.on('message', (message) => {
        // Log chunk metadata
        // console.log(`Received chunk of size: ${message.length} bytes`);

        // Save to file for verification
        outputFile.write(message);

        // Pipe to ffmpeg
        ffmpeg.stdin.write(message);
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        ffmpeg.stdin.end();
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        ffmpeg.stdin.end();
    });
});

process.on('SIGINT', () => {
    outputFile.end();
    wss.close();
    process.exit();
});
