// CLI argument parsing
const args = process.argv.slice(2).reduce((acc, val, i, arr) => {
    if (val.startsWith('--')) {
        const key = val.slice(2);
        const next = arr[i + 1];
        if (next && !next.startsWith('--')) {
            acc[key] = next;
        } else {
            acc[key] = true;
        }
    }
    return acc;
}, {});

const KALSHI_ENV = args.env || 'demo';

require('dotenv').config({
    path: `.env.${KALSHI_ENV}`,
    quiet: true
});

module.exports = { args, KALSHI_ENV };
