const { CHANNEL_MAPPINGS } = require("./yttv_channels");

/**
 * Reverses the CHANNEL_MAPPINGS to allow URL -> English Name lookup.
 */
const URL_TO_CHANNEL = Object.fromEntries(
    Object.entries(CHANNEL_MAPPINGS)
        .filter(([name, url]) => url && url.startsWith("http"))
        .map(([name, url]) => [url, name])
);

/**
 * Maps common local station call signs (specifically DC area) to English names.
 */
function getLocalStationName(name) {
    if (!name) return null;
    const clean = name.toUpperCase();
    
    if (clean.includes("WUSA") || clean.includes("CBS")) return "CBS";
    if (clean.includes("WRC") || clean.includes("NBC")) return "NBC";
    if (clean.includes("WJLA") || clean.includes("ABC")) return "ABC";
    if (clean.includes("WTTG") || clean.includes("FOX")) return "FOX";
    if (clean.includes("WETA") || clean.includes("WHUT") || clean.includes("PBS")) return "PBS";
    if (clean.includes("WDCW") || clean.includes("CW")) return "The CW";
    if (clean.includes("WDCA") || clean.includes("MYNETWORKTV")) return "MyNetworkTV";
    if (clean.includes("WFDC") || clean.includes("UNIVISION")) return "Univision";
    if (clean.includes("WZDC") || clean.includes("TELEMUNDO")) return "Telemundo";
    
    return null;
}

/**
 * Derives a "common" English name for a media source.
 * @param {Object} mediaSource - The media source object {type, name, url, ...}
 * @returns {string} - The common English name or the original name if no mapping found.
 */
function getMediaSourceCommonName(mediaSource) {
    if (!mediaSource) return "Unknown";
    
    const { type, name, url } = mediaSource;
    
    // 1. Try URL lookup (works for YouTube TV)
    if (url && URL_TO_CHANNEL[url]) {
        return URL_TO_CHANNEL[url];
    }
    
    // 2. Try type-specific defaults
    if (type === "amazon") return "Amazon Prime Video";
    if (type === "cspan") return "C-SPAN";
    if (type === "espn") {
        if (name && (name.toUpperCase().includes("ESPN") || name.length > 0)) return name;
        return "ESPN";
    }
    
    // 3. Try local station mapping
    const localName = getLocalStationName(name);
    if (localName) return localName;
    
    // 4. Fallback to original name (e.g. "CNN", "MSNBC" or "WRC-DT • 4.1")
    if (name === "Market Stream") return "YouTube";
    
    return name || "Unknown";
}

module.exports = { getMediaSourceCommonName };
