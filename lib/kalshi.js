const { Configuration, PortfolioApi, MarketApi, OrdersApi } = require('kalshi-typescript');
const fs = require('fs');
const logger = require('./logger');

const { args, KALSHI_ENV } = require('./args');

class KalshiClient {
    constructor(keyId, privateKeyPath, environment = 'demo') {
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

    async placeOrder({ ticker, count, action = 'buy', side = 'yes', type = 'market' }) {
        try {
            const sideLower = side.toLowerCase();

            const response = await this.ordersApi.createOrder(
                {
                    ticker,
                    action,
                    side,
                    count,
                    type,
                    client_order_id: `auto_${(new Date()).getTime()}`
                }
            );
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

    async getOrderbook(ticker) {
        try {
            const response = await this.marketApi.getMarketOrderbook(ticker);
            return response.data.orderbook;
        } catch (error) {
            this.handleError('getOrderbook', error);
        }
    }

    handleError(context, error) {
        logger.error(`${context} failed`, error.response?.data || error.message);
        throw error;
    }


    /**
     * Calculate the cost and profit of filling the entire orderbook on each side.
     * Each level is [price_in_cents, quantity].
     * Cost to buy a level = price * quantity (in cents).
     * Payout if it resolves in your favor = 100 * quantity (each contract pays $1).
     */
    analyzeOrderbook(orderbook) {
        const analyze = (levels) => {
            let totalCost = 0;
            let totalContracts = 0;
            for (const [price, qty] of levels) {
                totalCost += price * qty;
                totalContracts += qty;
            }
            const payout = totalContracts * 100; // each contract pays $1 = 100 cents
            return {
                totalCostCents: totalCost,
                totalCostDollars: (totalCost / 100).toFixed(2),
                totalContracts,
                payoutCents: payout,
                payoutDollars: (payout / 100).toFixed(2),
                profitCents: payout - totalCost,
                profitDollars: ((payout - totalCost) / 100).toFixed(2),
            };
        };

        return {
            yes: orderbook.yes ? analyze(orderbook.yes) : null,
            no: orderbook.no ? analyze(orderbook.no) : null,
        };
    }


    async getOrderbookValue(ticker) {
        const orderbook = await this.getOrderbook(ticker);
        return this.analyzeOrderbook(orderbook);
    }

}

module.exports = KalshiClient;
