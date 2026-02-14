const { exec, spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');
const fs = require('fs');

describe('CLI Argument Parsing', () => {
    const mainScript = path.resolve(__dirname, '../main.js');
    let mockServer;

    beforeAll((done) => {
        mockServer = new WebSocket.Server({ port: 7654 });
        mockServer.on('connection', (ws) => {
            ws.on('message', () => { });
        });
        done();
    });

    afterAll((done) => {
        if (mockServer) {
            mockServer.close(() => {
                done();
            });
        } else {
            done();
        }
    });

    test('should parse custom URL and duration from arguments', (done) => {
        const child = exec(`node ${mainScript} --url https://example.com --duration 2`);
        let output = '';
        let finished = false;

        const timer = setTimeout(() => {
            if (finished) return;
            finished = true;
            child.kill('SIGKILL');
            done(new Error(`Correct URL and duration not found in logs. Output: ${output}`));
        }, 10000);

        child.stdout.on('data', (data) => {
            output += data;
            if (output.includes('Launching browser for https://example.com (2s)...')) {
                if (finished) return;
                finished = true;
                clearTimeout(timer);
                child.kill('SIGKILL');
                done();
            }
        });

        child.on('error', (err) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            done(err);
        });
    }, 15000);

    test('should handle navigation failure for unreachable URL', (done) => {
        const child = spawn('node', [mainScript, '--url', 'https://this.is.an.invalid.url.that.should.fail', '--duration', '1']);
        let stderr = '';
        let finished = false;

        const timer = setTimeout(() => {
            if (finished) return;
            finished = true;
            child.kill('SIGKILL');
            done(new Error(`Test timed out. Stderr: ${stderr}`));
        }, 20000);

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            if (stderr.includes('Streaming failed') || code !== 0) {
                done();
            } else {
                done(new Error('Should have failed for invalid URL'));
            }
        });

        child.on('error', (err) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            done(err);
        });
    }, 25000);

    test('should log error when no video element is found', (done) => {
        const child = spawn('node', [mainScript, '--url', 'data:text/html,<html><body>NoVideo</body></html>', '--duration', '3']);
        let stdout = '';
        let finished = false;

        const timer = setTimeout(() => {
            if (finished) return;
            finished = true;
            child.kill('SIGKILL');
            done(new Error(`No video element log not found. Output: ${stdout}`));
        }, 30000);

        child.stdout.on('data', (data) => {
            stdout += data.toString();
            if (stdout.includes('[Browser] ERROR: No video element found')) {
                if (finished) return;
                finished = true;
                clearTimeout(timer);
                child.kill('SIGKILL');
                done();
            }
        });

        child.on('error', (err) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            done(err);
        });
    }, 35000);
});
