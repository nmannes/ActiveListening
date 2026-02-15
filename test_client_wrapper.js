require('dotenv').config();
const KalshiClient = require('./lib/kalshi');
const logger = require('./lib/logger');

async function testWrapper() {
    try {
        const keyId = process.env.KALSHI_KEY_ID;
        const keyPath = process.env.KALSHI_PRIVATE_KEY_PATH;
        // confirmed credentials are prod
        const env = 'prod';

        logger.info(`Testing KalshiClient wrapper in ${env} mode...`);

        const client = new KalshiClient(keyId, keyPath, env);

        logger.info('Fetching balance...');
        const balance = await client.getBalance();

        logger.info(`Wrapper Verification Successful! Balance: $${balance / 100}`);

    } catch (error) {
        logger.error('Wrapper Verification Failed!');
        process.exit(1);
    }
}

testWrapper();
