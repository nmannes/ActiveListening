const { exec } = require('child_process');
const path = require('path');

describe('CLI Argument Parsing', () => {
    const mainScript = path.resolve(__dirname, '../main.js');

    test('should parse custom URL and duration from arguments', (done) => {
        // We use a short duration and an invalid URL to hit a predictable failure point quickly
        // or just check the log output before it fails.
        // Actually, we can just check if it logs the correct "Launching browser for..." message.
        const child = exec(`node ${mainScript} --url https://example.com --duration 2`);

        let output = '';
        child.stdout.on('data', (data) => {
            output += data;
            if (output.includes('Launching browser for https://example.com (2s)...')) {
                child.kill();
                done();
            }
        });

        child.stderr.on('data', (data) => {
            // If it errors before we see the log, that's a failure
            if (!output.includes('Launching browser for')) {
                done(new Error(`Stderr: ${data}`));
            }
        });

        setTimeout(() => {
            child.kill();
            if (!output.includes('Launching browser for https://example.com (2s)...')) {
                done(new Error('Correct URL and duration not found in logs'));
            }
        }, 5000);
    });
});
