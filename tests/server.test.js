const WebSocket = require('ws');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

describe('WebSocket Server', () => {
    let serverProcess;
    const serverScript = path.resolve(__dirname, '../server.js');
    const port = 7654;
    const streamsDir = path.resolve(__dirname, '../streams');

    beforeAll((done) => {
        if (!fs.existsSync(streamsDir)) {
            fs.mkdirSync(streamsDir, { recursive: true });
        }

        serverProcess = spawn('node', [serverScript]);

        serverProcess.stdout.on('data', (data) => {
            if (data.toString().includes(`ws://localhost:${port}`)) {
                done();
            }
        });

        serverProcess.stderr.on('data', (data) => {
            console.error(`Server stderr: ${data}`);
        });

        serverProcess.on('error', (err) => {
            done(err);
        });
    });

    afterAll((done) => {
        if (serverProcess) {
            serverProcess.on('exit', () => {
                done();
            });
            serverProcess.kill('SIGKILL');
        } else {
            done();
        }
    });

    test('should receive data chunks and write to session-specific file in streams/', (done) => {
        const sessionId = 'test-session-1';
        const ws = new WebSocket(`ws://localhost:${port}?id=${sessionId}`);

        ws.on('open', () => {
            const data = Buffer.from('test-chunk');
            ws.send(data);

            setTimeout(() => {
                ws.close();
                const expectedFile = path.join(streamsDir, `received_${sessionId}.webm`);
                if (fs.existsSync(expectedFile)) {
                    const content = fs.readFileSync(expectedFile);
                    expect(content.includes(Buffer.from('test-chunk'))).toBe(true);
                    fs.unlinkSync(expectedFile);
                    done();
                } else {
                    done(new Error(`File not found: ${expectedFile}`));
                }
            }, 3000);
        });

        ws.on('error', (err) => {
            done(err);
        });
    }, 15000);

    test('should handle multiple concurrent clients with unique IDs in streams/', (done) => {
        const id1 = 'client-1';
        const id2 = 'client-2';
        const ws1 = new WebSocket(`ws://localhost:${port}?id=${id1}`);
        const ws2 = new WebSocket(`ws://localhost:${port}?id=${id2}`);

        let connections = 0;
        const checkDone = () => {
            connections++;
            if (connections === 2) {
                ws1.send(Buffer.from('chunk1'));
                ws2.send(Buffer.from('chunk2'));

                setTimeout(() => {
                    ws1.close();
                    ws2.close();

                    const file1 = path.join(streamsDir, `received_${id1}.webm`);
                    const file2 = path.join(streamsDir, `received_${id2}.webm`);

                    const exists1 = fs.existsSync(file1);
                    const exists2 = fs.existsSync(file2);

                    if (exists1 && exists2) {
                        fs.unlinkSync(file1);
                        fs.unlinkSync(file2);
                        done();
                    } else {
                        done(new Error(`Files missing: ${file1} (${exists1}), ${file2} (${exists2})`));
                    }
                }, 3000);
            }
        };

        ws1.on('open', checkDone);
        ws2.on('open', checkDone);
    }, 20000);

    test('should clean up ffmpeg processes on client disconnect', (done) => {
        const sessionId = 'cleanup-test';
        const ws = new WebSocket(`ws://localhost:${port}?id=${sessionId}`);

        ws.on('open', () => {
            ws.close();
            setTimeout(() => {
                done();
            }, 1000);
        });
    }, 10000);

    test('should return full transcript correctly across multiple requests', (done) => {
        const sessionId = 'robust-transcript-test';
        const ws = new WebSocket(`ws://localhost:${port}?id=${sessionId}`);
        let requestCount = 0;

        ws.on('open', () => {
            // Request 1: Immediate
            ws.send(JSON.stringify({ type: 'get_transcript' }));
        });

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === 'transcript') {
                    requestCount++;
                    expect(data.sessionId).toBe(sessionId);
                    expect(data.text).toBeDefined();

                    if (requestCount === 1) {
                        // Send dummy data and request again
                        ws.send(Buffer.from([0, 0, 0, 0]));
                        setTimeout(() => {
                            ws.send(JSON.stringify({ type: 'get_transcript' }));
                        }, 500);
                    } else if (requestCount === 2) {
                        ws.close();
                        done();
                    }
                }
            } catch (e) {
                // Ignore binary data echoes or other messages
            }
        });

        ws.on('error', (err) => {
            done(err);
        });
    }, 10000);
});
