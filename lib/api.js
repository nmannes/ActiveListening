require("./args");

async function getMarketHistory(
  ticker,
  limit = 100,
  min_settled_ts = null,
  max_settled_ts = null,
) {
  const params = new URLSearchParams();
  if (limit) params.set("limit", limit);
  if (min_settled_ts) params.set("min_settled_ts", min_settled_ts);
  if (max_settled_ts) params.set("max_settled_ts", max_settled_ts);
  const response = await fetch(
    `${process.env.KALSHI_BASE_DOMAIN}/markets/${ticker}/history?${params.toString()}`,
  );
  if (!response.ok)
    throw new Error(`Failed to fetch market history: ${response.status}`);
  const data = await response.json();
  return data;
}

async function getMarkets(opts) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(opts)) {
    if (value !== undefined && value !== null) params.set(key, value);
  }

  const response = await fetch(
    `${process.env.KALSHI_BASE_DOMAIN}/markets?${params.toString()}`,
  );
  if (!response.ok)
    throw new Error(`Failed to fetch markets: ${response.status}`);
  const data = await response.json();
  return data;
}

async function getEvents(opts) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(opts)) {
    if (value !== undefined && value !== null) params.set(key, value);
  }

  const response = await fetch(
    `${process.env.KALSHI_BASE_DOMAIN}/events?${params.toString()}`,
  );
  if (!response.ok)
    throw new Error(`Failed to fetch events: ${response.status}`);
  const data = await response.json();
  return data;
}

async function getEvent(ticker, nested = false) {
  const response = await fetch(
    `${process.env.KALSHI_BASE_DOMAIN}/events/${ticker}?with_nested_markets=${nested}`,
  );
  if (!response.ok)
    throw new Error(`Failed to fetch event: ${response.status}`);
  const data = await response.json();
  return data;
}

async function getMarket(ticker) {
  const response = await fetch(
    `${process.env.KALSHI_BASE_DOMAIN}/markets/${ticker}`,
  );
  if (!response.ok)
    throw new Error(`Failed to fetch market: ${response.status}`);
  const data = await response.json();
  return data;
}

module.exports = {
  getMarketHistory,
  getMarkets,
  getEvents,
  getEvent,
  getMarket,
};
