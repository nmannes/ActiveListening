const pino = require('pino');

const { KALSHI_ENV } = require('./args');

const logLevel = process.env.LOG_LEVEL || 'info';

const logger = pino({
    level: logLevel,
    transport: {
        targets: [
            {
                target: 'pino-pretty',
                level: logLevel,
                options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                    destination: 2 // stderr
                },
            },
            {
                target: 'pino/file',
                level: logLevel,
                options: {
                    destination: `./app-${KALSHI_ENV}.log`,
                    mkdir: true
                },
            },
        ],
    },
});

module.exports = logger;
