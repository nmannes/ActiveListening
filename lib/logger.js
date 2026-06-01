const pino = require("pino");
const path = require("path");
const fs = require("fs");

const { KALSHI_ENV, args } = require("./args");

const logLevel = process.env.LOG_LEVEL || "info";

function createLogger({ runUUID, sessionId } = {}) {
  const logDir = "runtime_logs";
  const logFile = runUUID
    ? path.join(logDir, `${sessionId || "nosession"}::${runUUID}.log`)
    : args.logFile || path.join(logDir, `./app-${KALSHI_ENV}.log`);

  if (runUUID && !fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const targets = [
    {
      target: "pino/file",
      level: logLevel,
      options: {
        destination: 1, // stdout
      },
    },
    {
      target: "pino/file",
      level: logLevel,
      options: {
        destination: logFile,
        mkdir: true,
      },
    },
  ];

  return pino({
    level: logLevel,
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: { targets },
  });
}

const logger = createLogger();
logger.createLogger = createLogger;

module.exports = logger;
