import { BASE_DOMAIN } from "./constants.js"

export async function getMarketHistory(ticker, limit = 100, min_settled_ts = null, max_settled_ts = null) {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit);
    if (min_settled_ts) params.set('min_settled_ts', min_settled_ts);
    if (max_settled_ts) params.set('max_settled_ts', max_settled_ts);
    const response = await fetch(`${BASE_DOMAIN}/markets/${ticker}/history?${params.toString()}`);
    const data = await response.json();
    return data;
}

export async function getMarkets(opts) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(opts)) {
        if (value !== undefined && value !== null) params.set(key, value);
    }

    const response = await fetch(`${BASE_DOMAIN}/markets?${params.toString()}`);
    const data = await response.json();
    return data;
}

export async function getEvents(opts) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(opts)) {
        if (value !== undefined && value !== null) params.set(key, value);
    }

    const response = await fetch(`${BASE_DOMAIN}/events?${params.toString()}`);
    const data = await response.json();
    return data;
}