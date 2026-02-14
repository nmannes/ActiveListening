const WebSocket = require('ws');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

describe('WebSocket Server', () => {
    let serverProcess;
    const serverScript = path.resolve(__dirname, '../server.js');
    const port = 7654;

    beforeAll((done) => {
        // Clean up any existing output file
        if (fs.existsSync('received_stream.webm')) {
            fs.unlinkSync('received_stream.webm');
        }

        serverProcess = spawn('node', [serverScript]);

        serverProcess.stdout.on('data', (data) => {
            if (data.toString().includes(`ws://localhost:${port}`)) {
                done();
            }
        });

        serverProcess.on('error', (err) => {
            done(err);
        });
    });

    afterAll(() => {
        if (serverProcess) {
            serverProcess.kill('SIGINT');
        }
    });

    test('should receive data chunks and write to file', (done) => {
        const ws = new WebSocket(`ws://localhost:${port}`);

        ws.on('open', () => {
            const data = Buffer.from('test-chunk');
            ws.send(data);

            // Wait a bit for the server to process
            setTimeout(() => {
                ws.close();
                expect(fs.existsSync('received_stream.webm')).toBe(true);
                const content = fs.readFileSync('received_stream.webm');
                expect(content.includes(Buffer.from('test-chunk'))).toBe(true);
                done();
            }, 500);
        });

        ws.on('error', (err) => {
            done(err);
        });
    });
});
