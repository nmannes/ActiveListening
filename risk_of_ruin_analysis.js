/**
 * Kalshi Risk & Expected Value Analysis
 */

// 1. Break-Even Win Probability
function getBreakevenWinProb(contractPriceCents) {
    return contractPriceCents / 100;
}

// 2. Expected Value (EV) per contract
function calculateEV(contractPriceCents, estimatedWinProb) {
    const profitIfWin = 100 - contractPriceCents;
    const lossIfMiss = contractPriceCents;
    return (estimatedWinProb * profitIfWin) - ((1 - estimatedWinProb) * lossIfMiss);
}

// 3. Recommended Kelly Criterion Bet Size
function calculateKellyFraction(contractPriceCents, estimatedWinProb) {
    const p = estimatedWinProb;
    const q = 1 - p;
    const b = (100 - contractPriceCents) / contractPriceCents; 

    return (p * b - q) / b;
}

// --- User Inputs --- //
const currentBankroll = 10000;            // 10,000 cents ($100.00)
const bankrollRiskPercent = 0.10;         // You want to risk 10% of your bankroll per trade

const contractPriceCents = 80;            // Price of a single contract (1 to 99)
const myEstimatedWinProb = 0.95;          // You expect your bets to win 95% of the time

// FATAL ERROR ADJUSTMENT
// "Some number of the time the win rate is wrong and I lose everything"
const modelConfidence = 1.0;             // Setting this to 1.0 so we use 95% exactly

// Your *true* probability accounts for the chance of your model being wrong
const trueWinProb = myEstimatedWinProb * modelConfidence;

console.log(`========== KALSHI TRADE ANALYSIS ==========`);
console.log(`Starting Bankroll:   ${currentBankroll} ¢`);
console.log(`Target Risk:         ${(bankrollRiskPercent * 100).toFixed(2)}% of bankroll`);
console.log(`Contract Price:      ${contractPriceCents} ¢`);
console.log(`-------------------------------------------`);

const breakEven = getBreakevenWinProb(contractPriceCents);
console.log(`Break-Even Win %:    ${(breakEven * 100).toFixed(1)}%`);
console.log(`Model Estimated %:   ${(myEstimatedWinProb * 100).toFixed(1)}%`);
console.log(`True Win % (Safe):   ${(trueWinProb * 100).toFixed(1)}%`);

const evPerContract = calculateEV(contractPriceCents, trueWinProb);
console.log(`Expected Value:      ${evPerContract > 0 ? '+' : ''}${evPerContract.toFixed(2)} ¢ per contract (Adjusted for Safety)`);

console.log(`\n--- Position Sizing ---`);
const targetWagerCents = currentBankroll * bankrollRiskPercent;
const numContracts = Math.floor(targetWagerCents / contractPriceCents);
const actualCostCents = numContracts * contractPriceCents;
const profitIfWin = numContracts * (100 - contractPriceCents);
const totalEV = numContracts * evPerContract;

console.log(`Target Wager:        ${targetWagerCents.toFixed(0)} ¢`);
console.log(`Actual Bet:          ${numContracts} contracts (Total Cost: ${actualCostCents} ¢)`);
console.log(`Potential Profit:    +${profitIfWin} ¢`);
console.log(`Total EV of Trade:   ${totalEV > 0 ? '+' : ''}${totalEV.toFixed(2)} ¢`);

console.log(`\n--- Kelly Optimization ---`);
const fullKelly = calculateKellyFraction(contractPriceCents, trueWinProb);
if (fullKelly > 0) {
    console.log(`Full Kelly:          Risk ${(fullKelly * 100).toFixed(2)}% of your bankroll.`);
    console.log(`Half Kelly (Safer):  Risk ${((fullKelly * 100) / 2).toFixed(2)}% of your bankroll.`);
    console.log(`Qtr Kelly (Safest):  Risk ${((fullKelly * 100) / 4).toFixed(2)}% of your bankroll.`);
} else {
    console.log(`Kelly Criterion says DO NOT BET (Negative true EV)`);
}
console.log(`===========================================`);

// --- MONTE CARLO SIMULATION --- //
console.log(`\n--- Running Monte Carlo Simulation ---`);
// Simulating N paths of M trades to see actual Risk of Ruin
const numSimulations = 10000;
const tradesPerSim = 250;
let bankruptcies = 0;
let profitableRuns = 0;

let totalEndingBankroll = 0;
const RUIN_THRESHOLD = contractPriceCents; // You are ruined if you can't even buy 1 contract

for (let i = 0; i < numSimulations; i++) {
    let simBankroll = currentBankroll;
    
    for (let t = 0; t < tradesPerSim; t++) {
        // Stop if ruined
        if (simBankroll < RUIN_THRESHOLD) {
            break;
        }

        // We use dynamic bet sizing: Risking 10% of current bankroll each trade
        const currentTargetWager = simBankroll * bankrollRiskPercent;
        const currentNumContracts = Math.floor(currentTargetWager / contractPriceCents);
        
        // If bankroll dropped so low we can't buy 1 contract but we haven't hit threshold
        if (currentNumContracts === 0) {
            continue;
        }

        const tradeCost = currentNumContracts * contractPriceCents;
        const tradeProfit = currentNumContracts * (100 - contractPriceCents);

        // Run the trade outcome
        if (Math.random() < trueWinProb) {
            simBankroll += tradeProfit; // Win
        } else {
            simBankroll -= tradeCost;   // Lose
        }
    }

    if (simBankroll < RUIN_THRESHOLD) {
        bankruptcies++;
    } else if (simBankroll > currentBankroll) {
        profitableRuns++;
    }
    
    totalEndingBankroll += simBankroll;
}

console.log(`Simulated ${tradesPerSim} consecutive trades, repeated ${numSimulations} times.`);
console.log(`Strategy: Dynamically wager ${(bankrollRiskPercent * 100).toFixed(2)}% of current bankroll every trade.`);
console.log(`Results:`);
console.log(`- Bankruptcies (Ruin): ${(bankruptcies / numSimulations * 100).toFixed(2)}% of simulations`);
console.log(`- Profitable Runs:     ${(profitableRuns / numSimulations * 100).toFixed(2)}% of simulations`);
console.log(`- Avg End Bankroll:    ${(totalEndingBankroll / numSimulations).toFixed(0)} ¢`);
console.log(`===========================================`);