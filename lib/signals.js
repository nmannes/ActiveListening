const logger = require('./logger');

class SignalMatcher {
    constructor(config = {}) {
        this.keywords = config.keywords || [];
        this.confidenceThreshold = config.confidenceThreshold || 0.8;
    }

    /**
     * Matches keywords in a transcript chunk.
     * @param {string} text - The transcribed text.
     * @param {number} confidence - ASR confidence (mocked for now).
     * @returns {Array} - List of detected signals.
     */
    match(text, confidence = 1.0) {
        const signals = [];
        if (confidence < this.confidenceThreshold) return signals;

        const normalizedText = text.toLowerCase();

        for (const item of this.keywords) {
            const { word, ticker, side } = item;
            if (normalizedText.includes(word.toLowerCase())) {
                logger.info(`Signal DETECTED: "${word}" in transcript for ticker ${ticker}`);
                signals.push({
                    word,
                    ticker,
                    side,
                    confidence,
                    matchedText: text
                });
            }
        }

        return signals;
    }
}

module.exports = SignalMatcher;
