/**
 * Pure computation functions for trade history from Kalshi API data.
 * Takes raw API response arrays, returns computed summaries.
 */

/**
 * Compute P&L from fills and settlements grouped by ticker.
 * @param {Array} fills - raw fill objects from Kalshi API
 * @param {Array} settlements - raw settlement objects from Kalshi API
 * @returns {{ tickers: Array, summary: { totalFees, totalRevenue, netPnL } }}
 */
function computeMarketPnL(fills, settlements) {
  const byTicker = {};

  for (const f of fills) {
    const t = f.ticker;
    if (!byTicker[t]) {
      byTicker[t] = {
        ticker: t,
        fills: [],
        totalBoughtYes: 0,
        totalSoldYes: 0,
        totalBoughtNo: 0,
        totalSoldNo: 0,
        totalFees: 0,
        yesCostBasis: 0,
        noCostBasis: 0,
        yesFillCount: 0,
        noFillCount: 0,
      };
    }

    const rec = byTicker[t];
    rec.fills.push(f);

    const side = (f.side || "").toLowerCase();
    const action = (f.action || "").toLowerCase();
    const count = parseFloat(f.count_fp || f.count || 0);
    const fee = parseFloat(f.fee_cost || 0);
    const price = side === "yes"
      ? parseFloat(f.yes_price_dollars || 0)
      : parseFloat(f.no_price_dollars || 0);

    rec.totalFees += fee;

    if (side === "yes" && action === "buy") {
      rec.totalBoughtYes += count;
      rec.yesCostBasis += count * price;
      rec.yesFillCount += count;
    } else if (side === "yes" && action === "sell") {
      rec.totalSoldYes += count;
    } else if (side === "no" && action === "buy") {
      rec.totalBoughtNo += count;
      rec.noCostBasis += count * price;
      rec.noFillCount += count;
    } else if (side === "no" && action === "sell") {
      rec.totalSoldNo += count;
    }
  }

  // Merge settlements
  for (const s of settlements) {
    const t = s.ticker;
    if (!byTicker[t]) {
      byTicker[t] = {
        ticker: t,
        fills: [],
        totalBoughtYes: 0, totalSoldYes: 0, totalBoughtNo: 0, totalSoldNo: 0,
        totalFees: 0, yesCostBasis: 0, noCostBasis: 0, yesFillCount: 0, noFillCount: 0,
      };
    }
    byTicker[t].settlement = s;
  }

  const tickerResults = [];
  let totalFees = 0;
  let totalRevenue = 0;
  let totalCost = 0;

  for (const [ticker, rec] of Object.entries(byTicker)) {
    const settlement = rec.settlement;
    const revenue = settlement ? parseFloat(settlement.revenue || 0) / 100 : 0;
    const costBasis = rec.yesCostBasis + rec.noCostBasis;
    const netPnL = revenue - costBasis - rec.totalFees;

    totalFees += rec.totalFees;
    totalRevenue += revenue;
    totalCost += costBasis;

    tickerResults.push({
      ticker,
      fills: rec.fills,
      settlement: settlement || null,
      marketResult: settlement ? (settlement.market_result || null) : null,
      totals: {
        boughtYes: rec.totalBoughtYes,
        soldYes: rec.totalSoldYes,
        boughtNo: rec.totalBoughtNo,
        soldNo: rec.totalSoldNo,
        yesAvgPrice: rec.yesFillCount > 0 ? (rec.yesCostBasis / rec.yesFillCount) : 0,
        noAvgPrice: rec.noFillCount > 0 ? (rec.noCostBasis / rec.noFillCount) : 0,
        fees: rec.totalFees,
        revenue,
        netPnL,
      },
    });
  }

  return {
    tickers: tickerResults,
    summary: {
      totalFees,
      totalRevenue,
      totalCost,
      netPnL: totalRevenue - totalCost - totalFees,
    },
  };
}

/**
 * Summarize orders by status and ticker.
 * @param {Array} orders - raw order objects from Kalshi API
 * @returns {{ totalCount, byStatus: {}, byTicker: {} }}
 */
function summarizeOrders(orders) {
  const byStatus = {};
  const byTicker = {};

  for (const o of orders) {
    const status = o.status || "unknown";
    const ticker = o.ticker || "unknown";

    if (!byStatus[status]) byStatus[status] = 0;
    byStatus[status]++;

    if (!byTicker[ticker]) byTicker[ticker] = { count: 0, executed: 0, resting: 0, canceled: 0 };
    byTicker[ticker].count++;
    if (status === "executed") byTicker[ticker].executed++;
    else if (status === "resting") byTicker[ticker].resting++;
    else if (status === "canceled") byTicker[ticker].canceled++;
  }

  return {
    totalCount: orders.length,
    byStatus,
    byTicker,
  };
}

module.exports = { computeMarketPnL, summarizeOrders };
