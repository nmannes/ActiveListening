require('dotenv').config();
const { Configuration, PortfolioApi } = require('kalshi-typescript');
const fs = require('fs');
const path = require('path');
// Adjust path to logger since we are in tests/
const logger = require('../lib/logger');

describe('Kalshi SDK Integration', () => {
    let portfolioApi;

    beforeAll(() => {
        const keyId = process.env.KALSHI_KEY_ID;
        const keyPath = process.env.KALSHI_PRIVATE_KEY_PATH;

        if (!keyId || !keyPath) {
            console.warn('Skipping SDK tests: Missing KALSHI_KEY_ID or KALSHI_PRIVATE_KEY_PATH');
            return;
        }

        // Handle relative path for key if needed, though env usually has absolute or root-relative
        // If keyPath is relative and we run from root, it should be fine. 
        // But let's ensure we can read it.
        let pem;
        try {
            pem = fs.readFileSync(keyPath, 'utf8');
        } catch (e) {
            // Try resolving relative to root if simple read fails
            pem = fs.readFileSync(path.resolve(process.cwd(), keyPath), 'utf8');
        }

        const config = new Configuration({
            basePath: 'https://api.elections.kalshi.com/trade-api/v2',
            apiKey: keyId,
            privateKeyPem: pem
        });

        portfolioApi = new PortfolioApi(config);
    });

    test('should fetch user balance successfully', async () => {
        if (!portfolioApi) {
            logger.warn('Skipping test: SDK not initialized');
            return;
        }

        try {
            logger.info('Fetching balance via SDK in test...');
            const response = await portfolioApi.getBalance();
            expect(response).toBeDefined();
            expect(response.data).toBeDefined();
            expect(typeof response.data.balance).toBe('number');
            logger.info(`SDK Test Successful! Balance: $${response.data.balance / 100}`);
        } catch (error) {
            logger.error('SDK Test Failed', error.response?.data || error.message);
            throw error;
        }
    });
});
