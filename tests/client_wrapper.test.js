require('dotenv').config();
const KalshiClient = require('../lib/kalshi');
const logger = require('../lib/logger');

describe('KalshiClient Wrapper', () => {
    let client;

    beforeAll(() => {
        const keyId = process.env.KALSHI_KEY_ID;
        const keyPath = process.env.KALSHI_PRIVATE_KEY_PATH;
        // User keys are validated for PROD in other tests
        const env = 'prod';

        logger.info(`Initializing KalshiClient with env: ${env}`);

        if (!keyId || !keyPath) {
            logger.warn('Skipping KalshiClient tests: Missing credentials');
            return;
        }

        client = new KalshiClient(keyId, keyPath, env);
    });

    test('should initialize and fetch balance', async () => {
        if (!client) return;

        logger.info('Testing KalshiClient wrapper balance fetch...');
        try {
            const balance = await client.getBalance();
            logger.info(`Wrapper Balance: ${balance}`);

            // Balance should be a number (cents)
            expect(typeof balance).toBe('number');
            expect(balance).toBeGreaterThanOrEqual(0);
        } catch (error) {
            logger.error('Wrapper test failed:', error);
            throw error;
        }
    });

    // We can add more tests here later for other wrapper methods like placeOrder
});
