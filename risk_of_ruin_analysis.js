/**
 * Kalshi Risk & Expected Value Analysis
 */

// 1. Break-Even Win Probability
// Calculates the exact win percentage needed to break even on a contract.
function getBreakevenWinProb(wagerCents) {
    return wagerCents / 100;
}

// 2. Expected Value (EV) per contract
// Calculates the expected profit/loss per contract in cents.
function calculateEV(wagerCents, estimatedWinProb) {
    const profitIfWin = 100 - wagerCents;
    const lossIfMiss = wagerCents;
    return (estimatedWinProb * profitIfWin) - ((1 - estimatedWinProb) * lossIfMiss);
}

// 3. Recommended Kelly Criterion Bet Size
// The Kelly Criterion tells you the mathematically optimal fraction of your 
// bankroll to risk based on your perceived edge to maximize long-term growth.
function calculateKellyFraction(wagerCents, estimatedWinProb) {
    const p = estimatedWinProb;
    const q = 1 - p;
    // 'b' is the net odds received (profit divided by amount risked)
    const b = (100 - wagerCents) / wagerCents; 

    return (p * b - q) / b;
}

// --- Example Scenario --- //
const currentBankroll = 10000; // 10,000 cents
const contractPriceCents = 80;   // Wager amount between 1 and 90
const myEstimatedWinProb = 0.85; // Let's assume you think you win this 85% of the time

console.log(`========== KALSHI TRADE ANALYSIS ==========`);
console.log(`Starting Bankroll: ${currentBankroll} ¢`);
console.log(`Contract Price:    ${contractPriceCents} ¢`);
console.log(`Potential Profit:  ${100 - contractPriceCents} ¢`);
console.log(`-------------------------------------------`);

const breakEven = getBreakevenWinProb(contractPriceCents);
console.log(`Break-Even Win %:  ${(breakEven * 100).toFixed(1)}%`);

if (myEstimatedWinProb) {
    console.log(`Your Estimated %:  ${(myEstimatedWinProb * 100).toFixed(1)}%`);
    
    const ev = calculateEV(contractPriceCents, myEstimatedWinProb);
    console.log(`Expected Value:    ${ev > 0 ? '+' : ''}${ev.toFixed(2)} ¢ per contract`);

    const kelly = calculateKellyFraction(contractPriceCents, myEstimatedWinProb);
    if (kelly > 0) {
        const betAmount = Math.floor(currentBankroll * kelly);
        const numContracts = Math.floor(betAmount / contractPriceCents);
        console.log(`Kelly Criterion:   Risk ${(kelly * 100).toFixed(2)}% of your bankroll`);
        console.log(`Suggested Bet:     ${numContracts} contracts (Total Cost: ${numContracts * contractPriceCents} ¢)`);
    } else {
        console.log(`Kelly Criterion:   DO NOT BET (Negative EV)`);
    }
}
console.log(`===========================================`);