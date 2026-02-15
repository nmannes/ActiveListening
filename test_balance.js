require('dotenv').config();
const KalshiClient = require('./lib/kalshi');
const logger = require('./lib/logger');

async function testBalance() {
    const kalshi = new KalshiClient(
        process.env.KALSHI_KEY_ID,
        process.env.KALSHI_PRIVATE_KEY_PATH,
        process.env.KALSHI_ENV
    );

    try {
        logger.info('Testing Kalshi balance retrieval...');
        const balance = await kalshi.getBalance();
        logger.info(`Verification Successful! Current Balance: $${balance / 100}`);
    } catch (error) {
        logger.error('Verification Failed!');
        if (error.response) {
            logger.error(`Status: ${error.response.status}`);
            logger.error(`Data: ${JSON.stringify(error.response.data)}`);
        } else {
            logger.error(error.message);
        }
        process.exit(1);
    }
}

testBalance();
