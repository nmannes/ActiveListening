const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('./logger');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../trading.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        logger.error('Could not connect to database', err);
    } else {
        logger.info('Connected to SQLite database');
    }
});

db.serialize(() => {
    // Trades table
    db.run(`CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    ticker TEXT NOT NULL,
    side TEXT NOT NULL,
    price INTEGER NOT NULL,
    size INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

    // Signals table
    db.run(`CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    keyword TEXT NOT NULL,
    confidence REAL NOT NULL,
    transcript TEXT,
    action_taken TEXT,
    trade_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(trade_id) REFERENCES trades(id)
  )`);
});

module.exports = db;
