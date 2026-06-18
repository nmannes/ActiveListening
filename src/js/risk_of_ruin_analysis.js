/**
 * Kalshi Risk & Expected Value Analysis
 */

// Helper to format cents into USD strings
function formatDollars(cents) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

// 1. Break-Even Win Probability
function getBreakevenWinProb(contractPriceCents) {
  return contractPriceCents / 100;
}

// 2. Expected Value (EV) per contract
function calculateEV(contractPriceCents, estimatedWinProb) {
  const profitIfWin = 100 - contractPriceCents;
  const lossIfMiss = contractPriceCents;
  return estimatedWinProb * profitIfWin - (1 - estimatedWinProb) * lossIfMiss;
}

// 3. Recommended Kelly Criterion Bet Size
function calculateKellyFraction(contractPriceCents, estimatedWinProb) {
  const p = estimatedWinProb;
  const q = 1 - p;
  const b = (100 - contractPriceCents) / contractPriceCents;

  return (p * b - q) / b;
}

// --- User Inputs --- //
const currentBankroll = 100 * 1000; // 100,000 cents ($1,000.00)
const bankrollRiskPercent = 0.1; // Risk 10% of bankroll per trade

// New Liquidity / Bet Sizing Caps (Empirical values from market_tracking data)
const maxWagerCents = 200 * 100; // Max wager capped at $200 (Median for NBA/NCAA)
const maxProfitCents = 350 * 100; // Max profit capped at $350 (Liquidity Limit)

const contractPriceCents = 80; // Price of a single contract (1 to 99)
const myEstimatedWinProb = 0.95; // You expect your bets to win 95% of the time

// FATAL ERROR ADJUSTMENT
const modelConfidence = 1.0; // Setting this to 1.0 so we use 95% exactly
const trueWinProb = myEstimatedWinProb * modelConfidence;

// Helper to calculate position sizing rules consistently across the scripts
function getContractsToBuy(bankrollCents, priceCents) {
  let wager = Math.min(bankrollCents * bankrollRiskPercent, maxWagerCents);
  let contracts = Math.floor(wager / priceCents);

  // Enforce liquidity cap on potential profit
  const profitPerContract = 100 - priceCents;
  const maxContractsByProfit = Math.floor(maxProfitCents / profitPerContract);

  return Math.min(contracts, maxContractsByProfit);
}

console.log(`========== KALSHI TRADE ANALYSIS ==========`);
console.log("START");
console.log(`Starting Bankroll:   ${formatDollars(currentBankroll)}`);
console.log(
  `Target Risk:         ${(bankrollRiskPercent * 100).toFixed(2)}% of bankroll`,
);
console.log(`Max Wager Cap:       ${formatDollars(maxWagerCents)}`);
console.log(
  `Max Profit Cap:      ${formatDollars(maxProfitCents)} (Liquidity Limit)`,
);
console.log(`Contract Price:      ${formatDollars(contractPriceCents)}`);
console.log(`-------------------------------------------`);

const breakEven = getBreakevenWinProb(contractPriceCents);
console.log(`Break-Even Win %:    ${(breakEven * 100).toFixed(1)}%`);
console.log(`Model Estimated %:   ${(myEstimatedWinProb * 100).toFixed(1)}%`);
console.log(`True Win % (Safe):   ${(trueWinProb * 100).toFixed(1)}%`);

const evPerContract = calculateEV(contractPriceCents, trueWinProb);
const evSign = evPerContract > 0 ? "+" : "";
console.log(
  `Expected Value:      ${evSign}${formatDollars(Math.abs(evPerContract))} per contract`,
);

console.log(`\n--- Position Sizing ---`);

const numContracts = getContractsToBuy(currentBankroll, contractPriceCents);
const actualCostCents = numContracts * contractPriceCents;
const profitIfWinCents = numContracts * (100 - contractPriceCents);
const totalEVCents = numContracts * evPerContract;

console.log(
  `Actual Bet:          ${numContracts} contracts (Total Cost: ${formatDollars(actualCostCents)})`,
);
console.log(`Potential Profit:    +${formatDollars(profitIfWinCents)}`);
const totalEVSign = totalEVCents > 0 ? "+" : "";
console.log(
  `Total EV of Trade:   ${totalEVSign}${formatDollars(Math.abs(totalEVCents))}`,
);

console.log(`\n--- Kelly Optimization ---`);
const fullKelly = calculateKellyFraction(contractPriceCents, trueWinProb);
if (fullKelly > 0) {
  console.log(
    `Full Kelly:          Risk ${(fullKelly * 100).toFixed(2)}% of your bankroll.`,
  );
  console.log(
    `Half Kelly (Safer):  Risk ${((fullKelly * 100) / 2).toFixed(2)}% of your bankroll.`,
  );
  console.log(
    `Qtr Kelly (Safest):  Risk ${((fullKelly * 100) / 4).toFixed(2)}% of your bankroll.`,
  );
} else {
  console.log(`Kelly Criterion says DO NOT BET (Negative true EV)`);
}
console.log(`===========================================`);

// --- PRICE SENSITIVITY ANALYSIS --- //
console.log(
  `\n--- Price Sensitivity Analysis (Assuming ${(trueWinProb * 100).toFixed(1)}% True Win Rate) ---`,
);
console.log(`Price  | Brk-Even | EV/Cont  | Total EV  | Full Kelly`);
console.log(`-------------------------------------------------------`);
for (let price = 10; price <= 95; price += 5) {
  const brkEven = getBreakevenWinProb(price);
  const ev = calculateEV(price, trueWinProb);
  const optKelly = calculateKellyFraction(price, trueWinProb);

  const numCont = getContractsToBuy(currentBankroll, price);
  const totalEVTrade = numCont * ev;

  const priceStr = formatDollars(price).padEnd(6);
  const brkStr = (brkEven * 100).toFixed(0).padStart(3) + "%";

  const evSignCont = ev > 0 ? "+" : ev < 0 ? "-" : " ";
  const evContStr = evSignCont + formatDollars(Math.abs(ev)).padStart(6);

  const evSignTot = totalEVTrade > 0 ? "+" : totalEVTrade < 0 ? "-" : " ";
  const evTotStr =
    evSignTot + formatDollars(Math.abs(totalEVTrade)).padStart(7);

  const kellyStr =
    optKelly > 0 ? (optKelly * 100).toFixed(1) + "%" : "DO NOT BET";

  console.log(
    `${priceStr} | ${brkStr.padEnd(8)} | ${evContStr} | ${evTotStr} | ${kellyStr}`,
  );
}
console.log(`===========================================`);

// --- MONTE CARLO SIMULATION --- //
console.log(
  `\n--- Running Monte Carlo Simulation (Randomized Prices 45¢ - 95¢, Skewed High) ---`,
);
// Simulating N paths of M trades to see actual Risk of Ruin
const numSimulations = 1000;
const tradesPerSim = 250;
let bankruptcies = 0;
let profitableRuns = 0;

let totalEndingBankrollCents = 0;

// Helper for skewed random price (concentrated towards 45-95 range)
function getRandomSimulationPrice() {
  // Generates a price between 45 and 95, skewed towards the higher end (95)
  // Using power 0.5 to push values higher
  return 45 + Math.floor(Math.pow(Math.random(), 0.5) * 51);
}

for (let i = 0; i < numSimulations; i++) {
  if (i % 100 === 0) console.log("i=" + i);
  let simBankrollCents = currentBankroll;

  for (let t = 0; t < tradesPerSim; t++) {
    const randomPrice = getRandomSimulationPrice();
    const ruinThreshold = randomPrice;

    // CRITICAL: Only bet if the trade has positive expected value
    // If the price is 95 cents and your win rate is 95%, EV is zero. Skip!
    const breakEvenWinProb = randomPrice / 100;
    if (trueWinProb <= breakEvenWinProb) {
      continue;
    }

    // Stop if ruined
    if (simBankrollCents < ruinThreshold) {
      break;
    }

    const currentNumContracts = getContractsToBuy(
      simBankrollCents,
      randomPrice,
    );

    // If bankroll dropped so low we can't buy 1 contract but we haven't hit threshold
    if (currentNumContracts === 0) {
      continue;
    }

    const tradeCost = currentNumContracts * randomPrice;
    const tradeProfit = currentNumContracts * (100 - randomPrice);

    // Run the trade outcome
    if (Math.random() < trueWinProb) {
      simBankrollCents += tradeProfit; // Win
    } else {
      simBankrollCents -= tradeCost; // Lose
    }
  }

  if (simBankrollCents < 75) {
    // Using 75 as a generic ruin floor for the summary
    bankruptcies++;
  } else if (simBankrollCents > currentBankroll) {
    profitableRuns++;
  }

  totalEndingBankrollCents += simBankrollCents;
}

console.log(
  `Simulated ${tradesPerSim} consecutive trades, repeated ${numSimulations} times.`,
);
console.log(
  `Strategy: Wager ${(bankrollRiskPercent * 100).toFixed(2)}% of current bankroll (capped at $200 wager and $350 profit) every trade.`,
);
console.log(`Results:`);
console.log(
  `- Bankruptcies (Ruin): ${((bankruptcies / numSimulations) * 100).toFixed(2)}% of simulations`,
);
console.log(
  `- Profitable Runs:     ${((profitableRuns / numSimulations) * 100).toFixed(2)}% of simulations`,
);

const avgEndBankrollCents = totalEndingBankrollCents / numSimulations;
console.log(`- Avg End Bankroll:    ${formatDollars(avgEndBankrollCents)}`);
console.log(`===========================================`);
