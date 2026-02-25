/**
 * Efficient keyword matching module.
 *
 * Instead of iterating every keyword on every incoming word (O(K) per word),
 * we index keywords by their last word for O(1) average-case lookups.
 */

/**
 * Build an index of keyword phrases keyed by their last word.
 *
 * @param {Object} keywords - Map of phrase → value (e.g. ticker)
 * @returns {Object} index keyed by last word, each value is an array of
 *   { key (original phrase), words (lowercased array), value }
 */
function buildKeywordIndex(keywords) {
    const index = {};
    for (const [key, value] of Object.entries(keywords)) {
        const words = key.toLowerCase().split(' ');
        const lastWord = words[words.length - 1];
        if (!index[lastWord]) {
            index[lastWord] = [];
        }
        index[lastWord].push({ key, words, value });
    }
    return index;
}

/**
 * Check whether the newly added word completes any keyword phrase.
 *
 * @param {Object} index - The last-word index from buildKeywordIndex
 * @param {string[]} transcript - The running transcript array (already lowercased/cleaned)
 * @param {string} word - The word that was just pushed onto the transcript
 * @returns {{ key: string, value: any } | null} The matched entry, or null
 */
function findKeywordMatch(index, transcript, word) {
    const candidates = index[word];
    if (!candidates) return null;

    for (const candidate of candidates) {
        const len = candidate.words.length;
        if (transcript.length < len) continue;

        const tail = transcript.slice(-len);
        let match = true;
        for (let i = 0; i < len; i++) {
            if (tail[i] !== candidate.words[i]) {
                match = false;
                break;
            }
        }

        if (match) {
            return { key: candidate.key, value: candidate.value };
        }
    }

    return null;
}

/**
 * Remove a matched keyword from the index so it won't match again.
 *
 * @param {Object} index - The last-word index
 * @param {string} key - The original keyword phrase to remove
 */
function removeFromIndex(index, key) {
    const words = key.toLowerCase().split(' ');
    const lastWord = words[words.length - 1];
    if (index[lastWord]) {
        index[lastWord] = index[lastWord].filter(c => c.key !== key);
        if (index[lastWord].length === 0) {
            delete index[lastWord];
        }
    }
}

module.exports = { buildKeywordIndex, findKeywordMatch, removeFromIndex };
