const pino = require('pino');

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        targets: [
            {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                    destination: 1 // stdout
                },
            },
            {
                target: 'pino/file',
                options: {
                    destination: './app.log',
                    mkdir: true
                },
            },
        ],
    },
});

module.exports = logger;
