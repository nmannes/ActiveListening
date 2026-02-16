const pino = require('pino');

const args = process.argv.slice(2);
const logLevelArg = args.find(arg => arg.startsWith('--log-level='));
const fileLogLevel = logLevelArg ? logLevelArg.split('=')[1] : (process.env.LOG_LEVEL || 'info');

const logger = pino({
    level: fileLogLevel,
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
