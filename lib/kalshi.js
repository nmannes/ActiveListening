const { Configuration, PortfolioApi, MarketApi, OrdersApi } = require('kalshi-typescript');
const fs = require('fs');
const logger = require('./logger');

class KalshiClient {
    constructor(keyId, privateKeyPath, environment = 'prod') {
        this.keyId = keyId;
        this.privateKeyPath = privateKeyPath;
        this.basePath = environment === 'prod'
            ? 'https://api.elections.kalshi.com/trade-api/v2'
            : 'https://demo-api.kalshi.co/trade-api/v2';

        this.config = null;
        this.portfolioApi = null;
        this.marketApi = null;
        this.ordersApi = null;

        this.init();
    }

    init() {
        try {
            const privateKey = fs.readFileSync(this.privateKeyPath, 'utf8');
            this.config = new Configuration({
                basePath: this.basePath,
                apiKey: this.keyId,
                privateKeyPem: privateKey
            });

            this.portfolioApi = new PortfolioApi(this.config);
            this.marketApi = new MarketApi(this.config);
            this.ordersApi = new OrdersApi(this.config);

            logger.info(`Initialized Kalshi SDK for ${this.basePath}`);
        } catch (error) {
            logger.error(`Failed to initialize Kalshi SDK`, error.message);
            throw error;
        }
    }

    async getBalance() {
        try {
            const response = await this.portfolioApi.getBalance();
            return response.data.balance;
        } catch (error) {
            this.handleError('getBalance', error);
        }
    }

    async placeOrder({ ticker, side, count, price, type = 'limit' }) {
        try {
            logger.info(`Placing ${side} order for ${count} contracts of ${ticker} at $${price / 100}`);

            // Ensure 'side' matches SDK expectation (yes/no)
            const action = 'buy';
            const sideLower = side.toLowerCase();

            const response = await this.ordersApi.createOrder({
                createOrderRequest: {
                    ticker,
                    action,
                    side: sideLower,
                    count,
                    price,
                    type,
                    client_order_id: `auto_${Date.now()}`
                }
            });
            return response.data.order;
        } catch (error) {
            this.handleError('placeOrder', error);
        }
    }

    async getMarket(ticker) {
        try {
            const response = await this.marketApi.getMarket(ticker);
            return response.data.market;
        } catch (error) {
            this.handleError('getMarket', error);
        }
    }

    handleError(context, error) {
        logger.error(`${context} failed`, error.response?.data || error.message);
        throw error;
    }
}

module.exports = KalshiClient;
