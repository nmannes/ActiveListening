# Earnings Report

Generated 2026-09-21 · 5 companies with upcoming word markets · 72 words

## Method

Targets are the words in currently open Kalshi earnings-mention markets (from the market caches). Word matching follows Kalshi's resolution rules (word boundaries, plural/possessive forms). Aliases that share a market slug are the same market (the cache splits a market word like "Gas / Gasoline / Fuel" into its pieces), so they render as one joined row.

- Aggregate transitions over all upcoming words: P(word said | said last call) = 558/792 = 70.5% vs P(said | not said last call) = 252/1520 = 16.6% (base rate 35.0%)
- Baseline P blends the aggregate transition rate with the word's own presence rate (Laplace-smoothed); per-word evidence dominates as call history grows
- Baseline P: from prior earnings call transcripts dated strictly before the event (`transcripts/{TICKER}/`; same-day excluded, so the answer can't leak in); '-' = no pre-event history
- Only markets whose event is today or later are listed — a past event means the market is resolved-by-information, not an opportunity
- Last YES: last traded price for the word's currently open market (Kalshi API, active markets only; the NO side is the pair complement and always sums to $1.00). A $0.00 last price is the listing default for markets with no trades at all (Kalshi's minimum trade is $0.01), so those count as unpriced ('-') and never appear as opportunities. '-' = no open market, no trades, or fetch failed
- Verdict tiers: Strong YES (P ≥ 60%), Likely YES (45–60%), Coin flip (30–45%), Unlikely (<30%)

**1 of 5 companies lack transcript history** — run `./bin/kalshi transcripts --from-markets` to fill baselines.

## Opportunities (prior data vs market)

Sorted by gap descending — a positive gap means prior data says the word is more likely than the market prices it (buy YES); a negative gap means less likely (buy NO).

| Company | Word | Baseline P | Market YES | Gap |
|---|---|---|---|---|
| STZ | dividend | 80% | $0.36 | +44 |
| CCL | princess | 79% | $0.47 | +32 |
| STZ | especial | 90% | $0.64 | +26 |
| STZ | inventory | 84% | $0.62 | +22 |
| STZ | wine | 92% | $0.71 | +21 |
| DPZ | closure | 84% | $0.63 | +21 |
| CCL | inflation | 51% | $0.31 | +20 |
| STZ | depletion / depletions | 96% | $0.78 | +18 |
| CCL | dry dock | 79% | $0.67 | +12 |
| DPZ | insurance | 40% | $0.28 | +12 |
| DPZ | india | 56% | $0.45 | +11 |
| UAL | nonstop / non stop | 36% | $0.26 | +10 |
| UAL | atc / air traffic control | 43% | $0.35 | +8 |
| UAL | weather | 60% | $0.54 | +6 |
| CCL | tailwind | 51% | $0.46 | +5 |
| STZ | pacifico | 84% | $0.79 | +5 |
| STZ | inflation | 57% | $0.52 | +5 |
| STZ | ice | 5% | $0.01 | +4 |
| CCL | iran | 11% | $0.07 | +4 |
| CCL | oil | 17% | $0.14 | +3 |
| UAL | american airlines | 16% | $0.13 | +3 |
| UAL | tariff | 19% | $0.18 | +1 |
| UAL | newark | 74% | $0.75 | -1 |
| DPZ | inflation | 47% | $0.49 | -2 |
| CCL | tariff | 14% | $0.19 | -5 |
| DPZ | tailwind | 41% | $0.49 | -8 |
| CCL | headwind | 57% | $0.66 | -9 |
| UAL | holiday | 40% | $0.53 | -13 |
| DPZ | tariff | 5% | $0.19 | -14 |
| DPZ | ai / artificial intelligence | 14% | $0.29 | -15 |
| UAL | chase | 43% | $0.58 | -15 |
| STZ | tariff | 24% | $0.44 | -20 |
| STZ | aluminum | 30% | $0.51 | -21 |
| UAL | oil | 22% | $0.43 | -21 |
| CCL | consumer sentiment | 20% | $0.42 | -22 |
| STZ | mi campo | 24% | $0.46 | -22 |
| CCL | holland america | 57% | $0.81 | -24 |
| DPZ | andrew gregory | 7% | $0.31 | -24 |
| DPZ | parmesan | 21% | $0.50 | -29 |
| CCL | dividend | 45% | $0.74 | -29 |
| STZ | oil / gas / gasoline | 30% | $0.61 | -31 |
| DPZ | world cup | 10% | $0.42 | -32 |
| DPZ | signature | 7% | $0.40 | -33 |
| CCL | middle east | 20% | $0.54 | -34 |
| UAL | crj450 | 5% | $0.41 | -36 |
| UAL | middle east | 36% | $0.72 | -36 |
| DPZ | doordash | 14% | $0.53 | -39 |
| STZ | victoria | 18% | $0.57 | -39 |
| CCL | propel | 26% | $0.67 | -41 |
| UAL | a321xlr | 19% | $0.61 | -42 |
| UAL | relax row | 12% | $0.56 | -44 |
| CCL | modernization | 17% | $0.62 | -45 |
| CCL | ai / artificial intelligence | 14% | $0.60 | -46 |
| DPZ | stuffed crust | 11% | $0.65 | -54 |
| UAL | starlink | 32% | $0.88 | -56 |
| UAL | coastliner | 12% | $0.70 | -58 |
| DPZ | same store | 13% | $0.99 | -86 |
| DPZ | joe jordan | 5% | $0.95 | -90 |

## Aritzia (ARITZIA)
**Upcoming event:** 2026-10-14
*No transcript history — baseline unavailable. Run `./bin/kalshi transcripts --from-markets` to fill it in.*

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ai | - | - | $0.76 | **-** |
| cashmere | - | - | $0.35 | **-** |
| china | - | - | $0.33 | **-** |
| conversion | - | - | $0.54 | **-** |
| flagship | - | - | $0.70 | **-** |
| franchise | - | - | $0.53 | **-** |
| influencer | - | - | $0.30 | **-** |
| new orleans | - | - | $0.26 | **-** |
| payback | - | - | $0.46 | **-** |
| personalization | - | - | $0.38 | **-** |
| runway | - | - | $0.67 | **-** |
| super puff | - | - | $0.30 | **-** |
| tariff | - | - | $0.91 | **-** |
| top of mind | - | - | $0.41 | **-** |

---

## Carnival Corporation (CCL)
**Upcoming event:** 2026-09-28

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ai / artificial intelligence | 2/28 | 14% | $0.60 | **Unlikely** |
| consumer sentiment | 4/28 | 20% | $0.42 | **Unlikely** |
| dividend | 12/28 | 45% | $0.74 | **Coin flip** |
| dry dock | 24/28 | 79% | $0.67 | **Strong YES** |
| headwind | 16/28 | 57% | $0.66 | **Likely YES** |
| holland america | 16/28 | 57% | $0.81 | **Likely YES** |
| inflation | 15/28 | 51% | $0.31 | **Likely YES** |
| iran | 2/28 | 11% | $0.07 | **Unlikely** |
| middle east | 4/28 | 20% | $0.54 | **Unlikely** |
| modernization | 3/28 | 17% | $0.62 | **Unlikely** |
| oil | 4/28 | 17% | $0.14 | **Unlikely** |
| princess | 23/28 | 79% | $0.47 | **Strong YES** |
| propel | 6/28 | 26% | $0.67 | **Unlikely** |
| tailwind | 14/28 | 51% | $0.46 | **Likely YES** |
| tariff | 2/28 | 14% | $0.19 | **Unlikely** |

---

## Domino's Pizza (DPZ)
**Upcoming event:** 2026-10-15

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ai / artificial intelligence | 8/63 | 14% | $0.29 | **Unlikely** |
| andrew gregory | 2/63 | 7% | $0.31 | **Unlikely** |
| closure | 55/63 | 84% | $0.63 | **Strong YES** |
| doordash | 7/63 | 14% | $0.53 | **Unlikely** |
| india | 35/63 | 56% | $0.45 | **Likely YES** |
| inflation | 30/63 | 47% | $0.49 | **Likely YES** |
| insurance | 25/63 | 40% | $0.28 | **Coin flip** |
| joe jordan | 1/63 | 5% | $0.95 | **Unlikely** |
| parmesan | 12/63 | 21% | $0.50 | **Unlikely** |
| same store | 7/63 | 13% | $0.99 | **Unlikely** |
| signature | 2/63 | 7% | $0.40 | **Unlikely** |
| stuffed crust | 5/63 | 11% | $0.65 | **Unlikely** |
| tailwind | 26/63 | 41% | $0.49 | **Coin flip** |
| tariff | 2/63 | 5% | $0.19 | **Unlikely** |
| world cup | 4/63 | 10% | $0.42 | **Unlikely** |

---

## Constellation Brands (STZ)
**Upcoming event:** 2026-10-05

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| aluminum | 13/44 | 30% | $0.51 | **Coin flip** |
| depletion / depletions | 44/44 | 96% | $0.78 | **Strong YES** |
| dividend | 37/44 | 80% | $0.36 | **Strong YES** |
| especial | 41/44 | 90% | $0.64 | **Strong YES** |
| ice | 1/44 | 5% | $0.01 | **Unlikely** |
| inflation | 25/44 | 57% | $0.52 | **Likely YES** |
| inventory | 39/44 | 84% | $0.62 | **Strong YES** |
| mi campo | 9/44 | 24% | $0.46 | **Unlikely** |
| oil / gas / gasoline | 12/44 | 30% | $0.61 | **Unlikely** |
| pacifico | 38/44 | 84% | $0.79 | **Strong YES** |
| tariff | 10/44 | 24% | $0.44 | **Unlikely** |
| victoria | 7/44 | 18% | $0.57 | **Unlikely** |
| wine | 42/44 | 92% | $0.71 | **Strong YES** |

---

## United Airlines Holdings (UAL)
**Upcoming event:** 2026-10-14

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| a321xlr | 4/25 | 19% | $0.61 | **Unlikely** |
| american airlines | 3/25 | 16% | $0.13 | **Unlikely** |
| atc / air traffic control | 11/25 | 43% | $0.35 | **Coin flip** |
| chase | 10/25 | 43% | $0.58 | **Coin flip** |
| coastliner | 1/25 | 12% | $0.70 | **Unlikely** |
| crj450 | 0/25 | 5% | $0.41 | **Unlikely** |
| holiday | 10/25 | 40% | $0.53 | **Coin flip** |
| middle east | 8/25 | 36% | $0.72 | **Coin flip** |
| newark | 19/25 | 74% | $0.75 | **Strong YES** |
| nonstop / non stop | 9/25 | 36% | $0.26 | **Coin flip** |
| oil | 4/25 | 22% | $0.43 | **Unlikely** |
| relax row | 1/25 | 12% | $0.56 | **Unlikely** |
| starlink | 7/25 | 32% | $0.88 | **Coin flip** |
| tariff | 3/25 | 19% | $0.18 | **Unlikely** |
| weather | 16/25 | 60% | $0.54 | **Strong YES** |

---
