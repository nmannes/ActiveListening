# Earnings Backtest

Generated 2026-09-20

## Strategy

For each finalized word market: a transcript baseline P is computed from calls before the event; an isotonic recalibration of P(word said) (fit on train markets only) is also evaluated as an experiment — see the Temporal holdout table for the verdict. The baseline is compared to the executable price at the 24h-before-close lead (the last traded hourly candle at or before close − 24h; the YES ask/bid where orderbook data exists). Bet the undervalued side: YES when baseline > YES price, NO when 1 − baseline > NO price; skip when neither side is undervalued; settle at the actual resolution. Gap = edge on the chosen side.

The call date — the cutoff deciding which transcripts count — is the earlier of the date Kalshi prints on the event and the market's own close date. A market resolves immediately after the call it prices, so its close bounds the call from above. For the "-26JUN30" batch both printed fields carry the *contract* date, up to five months late, and trusting either one scored a quarter of the trades using a transcript of the very call the market was predicting. Erring earlier only drops a transcript the strategy could legitimately have used; erring later feeds it the answer.

## Coverage

- 2357 finalized markets with history fetched
- 2186 with a price at the 24h lead (close − 24h)
- 2143 with a transcript baseline (pre-event calls)
- 2140 tradable (both price and baseline)
- **entry-price basis: restricted to the 2357 markets whose 24h entry price came from a candle that actually traded — a real print, not a carried-forward close. Everything below, including the coverage counts and the holdout, is computed on this basis only, so the Execution-validity split is degenerate by construction**
- fee: 3% on profit

- 86 trades use day-less event tickers (e.g. -25MAY) whose call date is approximated as the 1st of the month

- 1588 train markets with a baseline (train = closing before 2026-07-01)
- 555 test markets with a baseline (test = closing on/after 2026-07-01)

## Threshold sweep (min |gap|, raw baseline)

Net if always YES / always NO shows the same candidates traded on one fixed side — the benchmark the side selection must beat. See Temporal holdout for the out-of-sample view.

| Min \|gap\| | Trades | Wins | Win rate | Gross | Net | YES (n/wins/net) | NO (n/wins/net) | Always YES | Always NO |
|---|---|---|---|---|---|---|---|---|---|
| 0.00 | 2140 | 935 | 44% | +126.87 | +113.95 | 479 / 198 / -9.06 | 1661 / 737 / +123.01 | -148.79 | +126.75 |
| 0.05 | 1838 | 786 | 43% | +125.59 | +113.97 | 357 / 140 / -4.73 | 1481 / 646 / +118.69 | -138.73 | +119.25 |
| 0.10 | 1552 | 644 | 41% | +111.75 | +101.75 | 257 / 94 / -1.05 | 1295 / 550 / +102.80 | -117.53 | +100.88 |
| 0.15 | 1312 | 510 | 39% | +93.89 | +85.49 | 183 / 62 / +1.20 | 1129 / 448 / +84.29 | -94.98 | +81.00 |
| 0.20 | 1142 | 419 | 37% | +80.00 | +72.78 | 134 / 40 / +0.03 | 1008 / 379 / +72.75 | -83.26 | +71.23 |
| 0.25 | 975 | 340 | 35% | +74.32 | +68.18 | 94 / 29 / +4.15 | 881 / 311 / +64.03 | -68.95 | +58.90 |
| 0.30 | 815 | 254 | 31% | +51.11 | +46.29 | 62 / 16 / +1.67 | 753 / 238 / +44.62 | -50.45 | +42.35 |

## Temporal holdout

Same strategy evaluated on each side of the cutoff (2026-07-01), with and without calibration. The calibration is always fit on train only, so the test rows are fully out-of-sample. Edge vs NO is the net minus what the same candidates return if every one of them is bet NO regardless of the baseline — the bar any side selection has to clear, and the one that decides whether the baseline is adding information or just re-deriving the base rate. t (edge) is the paired t-statistic of that difference — the benchmark uses the same trades, so the comparison is paired. |t| below about 2 means the edge is not distinguishable from zero at this sample size, however healthy the net looks.

| Min \|gap\| | Split | Calibrated | Trades | Wins | Win rate | Net | Always NO | Edge vs NO | t (edge) |
|---|---|---|---|---|---|---|---|---|---|
| 0.00 | train | no | 1587 | 677 | 43% | +89.01 | +111.23 | -22.22 | -1.46 |
| 0.05 | train | no | 1358 | 567 | 42% | +89.11 | +105.86 | -16.75 | -1.26 |
| 0.10 | train | no | 1146 | 465 | 41% | +78.59 | +89.61 | -11.01 | -0.99 |
| 0.15 | train | no | 958 | 366 | 38% | +70.01 | +74.54 | -4.53 | -0.50 |
| 0.20 | train | no | 845 | 308 | 36% | +62.71 | +65.65 | -2.94 | -0.37 |
| 0.25 | train | no | 727 | 251 | 35% | +58.63 | +57.03 | +1.60 | +0.24 |
| 0.30 | train | no | 613 | 188 | 31% | +40.26 | +40.30 | -0.04 | -0.01 |
| 0.00 | train | yes | 1580 | 500 | 32% | +41.13 | +108.68 | -67.55 | -3.41 |
| 0.05 | train | yes | 1309 | 379 | 29% | +36.27 | +85.42 | -49.15 | -2.86 |
| 0.10 | train | yes | 1093 | 284 | 26% | +34.65 | +66.05 | -31.40 | -2.10 |
| 0.15 | train | yes | 903 | 207 | 23% | +19.35 | +45.48 | -26.12 | -2.03 |
| 0.20 | train | yes | 721 | 143 | 20% | +13.76 | +30.33 | -16.57 | -1.61 |
| 0.25 | train | yes | 559 | 96 | 17% | +9.86 | +12.01 | -2.15 | -0.26 |
| 0.30 | train | yes | 438 | 63 | 14% | +5.25 | +7.00 | -1.75 | -0.27 |
| 0.00 | test | no | 553 | 258 | 47% | +24.94 | +15.52 | +9.42 | +0.87 |
| 0.05 | test | no | 480 | 219 | 46% | +24.85 | +13.39 | +11.47 | +1.14 |
| 0.10 | test | no | 406 | 179 | 44% | +23.16 | +11.28 | +11.88 | +1.40 |
| 0.15 | test | no | 354 | 144 | 41% | +15.48 | +6.46 | +9.02 | +1.18 |
| 0.20 | test | no | 297 | 111 | 37% | +10.07 | +5.58 | +4.49 | +0.72 |
| 0.25 | test | no | 248 | 89 | 36% | +9.55 | +1.86 | +7.68 | +1.55 |
| 0.30 | test | no | 202 | 66 | 33% | +6.04 | +2.06 | +3.98 | +1.00 |
| 0.00 | test | yes | 551 | 191 | 35% | +8.43 | +15.50 | -7.07 | -0.50 |
| 0.05 | test | yes | 468 | 146 | 31% | +6.34 | +11.16 | -4.83 | -0.39 |
| 0.10 | test | yes | 387 | 112 | 29% | +6.24 | +9.27 | -3.03 | -0.28 |
| 0.15 | test | yes | 318 | 85 | 27% | +6.08 | +0.92 | +5.16 | +0.52 |
| 0.20 | test | yes | 254 | 62 | 24% | +4.69 | -1.30 | +5.99 | +0.71 |
| 0.25 | test | yes | 178 | 36 | 20% | +0.38 | -5.80 | +6.19 | +0.90 |
| 0.30 | test | yes | 119 | 19 | 16% | -0.76 | -3.54 | +2.78 | +0.56 |

## Edge by entry time (raw baseline, min |gap| 0.10)

Same strategy entered at different horizons: at each lead the entry price is the last traded hourly candle at or before close − lead hours (markets that were not live or untraded that far out have no price and drop out — see With price). Train/test are the temporal split above (closing before/after 2026-07-01); test is out-of-sample. The headline rows are lead 24h.

| Lead (h) | With price | Tradable | Train trades | Train net | Test trades | Test wins | Win rate | Test net |
|---|---|---|---|---|---|---|---|---|
| 1 | 2347 | 2295 | 1361 | +8.49 | 444 | 68 | 15% | +3.71 |
| 3 | 2344 | 2292 | 1313 | +41.07 | 433 | 130 | 30% | +19.10 |
| 6 | 2344 | 2291 | 1303 | +45.68 | 428 | 146 | 34% | +20.59 |
| 12 | 2343 | 2289 | 1318 | +64.78 | 420 | 141 | 34% | +17.11 |
| 18 | 2280 | 2227 | 1262 | +73.38 | 414 | 178 | 43% | +24.54 |
| **24** | 2186 | 2140 | 1146 | +78.59 | 406 | 179 | 44% | +23.16 |
| 36 | 2092 | 2047 | 1075 | +72.64 | 393 | 169 | 43% | +17.12 |
| 48 | 2011 | 1967 | 1034 | +83.62 | 390 | 178 | 46% | +22.43 |
| 72 | 1836 | 1798 | 941 | +67.98 | 379 | 178 | 47% | +26.09 |
| 96 | 1746 | 1711 | 883 | +64.26 | 367 | 175 | 48% | +24.26 |

## Capacity

Fillable size is capped at **10% of the market's own traded volume**. Depth is bounded by *flow* rather than by a modelled book because the entry-time book is not observable: at the 24h lead the entry hour never traded at all for most of these markets, so any resting depth quoted there would be invented. The worked model spends the volume traded between entry and close; the taker model only the entry hour. Participation is a flag, not a fitted parameter — nothing in this repo pins it down. 13 of 1552 (1%) of these trades saw no volume at all between entry and close and never fill under any size.

**The worked model is the optimistic bound, not a forecast.** It fills at the posted price no matter which way the market moved, but a resting order is filled precisely when someone chooses to trade against it — flow dries up when the price moves away from your quote and arrives when it moves through it. Real fills therefore skew toward the losing side in a way this model cannot see. This basis removes the largest amplification of it — every entry here is a price that actually traded, so a fill at the posted price is at least a fill at a real price — but the directional skew is untouched: the model still cannot distinguish a fill that happened because the market moved toward the quote from one that happened because it moved away. Read the worked column as "is there enough flow?" (yes, comfortably) and the taker column as "what if the order has to cross?" (it collapses). The taker slippage uses the *shape* of live books captured around earnings calls — call-time is the most liquid moment, so those depths are an upper bound on entry-regime depth and the taker fill rates are the optimistic end of that assumption.

**ROI rises slightly with size rather than decaying** (19.4% at N=1 to 20.4% at N=1000). That is compositional, not extra edge: the participation cap bites hardest on low-volume markets, so a larger order concentrates its fill on high-volume markets — which are also the ones whose entry price was genuinely traded rather than stale, and those carry the higher ROI. The curve is bounded by the capital the universe can absorb, not by the edge decaying.

| Position N | Contracts wanted | Filled | Fill rate | Net | ROI | Capital deployed | Avg slippage | Trades filled | Partially filled |
|---|---|---|---|---|---|---|---|---|---|
| **1** | 1552 | 1539 | 99% | +102.86 | 19.4% | 531.14 | +0.000 | 1539 | 1 |
| 10 | 15520 | 15332 | 99% | +1028.60 | 19.4% | 5309.54 | +0.000 | 1539 | 12 |
| 25 | 38800 | 38175 | 98% | +2563.43 | 19.3% | 13260.97 | +0.000 | 1539 | 21 |
| 50 | 77600 | 75874 | 98% | +5093.08 | 19.3% | 26405.16 | +0.000 | 1539 | 41 |
| 100 | 155200 | 149510 | 96% | +9972.30 | 19.1% | 52249.35 | +0.000 | 1539 | 95 |
| 250 | 388000 | 350410 | 90% | +23470.58 | 19.0% | 123748.34 | +0.000 | 1539 | 318 |
| 500 | 776000 | 608153 | 78% | +42131.85 | 19.3% | 218617.22 | +0.000 | 1539 | 681 |
| 1000 | 1552000 | 934124 | 60% | +70294.30 | 20.4% | 345372.62 | +0.000 | 1539 | 1044 |

## Execution model: worked vs taker

**worked** rests a limit order at the entry price across the whole entry-to-close window and is filled by the flow that trades through it: the fill price is the posted price, so slippage is zero and the only cost is unfilled size. **taker** crosses the spread at entry, so only the entry hour's flow is available and the ladder's VWAP sets the cost. Worked is the headline; taker is the conservative lower bound.

| Position N | Worked fill | Worked net | Worked ROI | Taker fill | Taker net | Taker ROI | Taker slippage |
|---|---|---|---|---|---|---|---|
| 1 | 99% | +102.86 | 19.4% | 84% | +50.43 | 10.5% | +0.031 |
| 10 | 99% | +1028.60 | 19.4% | 48% | +142.66 | 5.0% | +0.051 |
| 100 | 96% | +9972.30 | 19.1% | 13% | +111.73 | 1.5% | +0.061 |
| 1000 | 60% | +70294.30 | 20.4% | 2% | +258.08 | 2.8% | +0.061 |

## Fees: flat 3% of profit vs Kalshi 0.07·C·P·(1−P)

The flat model charges only winners; Kalshi's taker schedule charges every fill, losers included, and is rounded up to the cent per order. Unlimited fill, so the fee effect is not confounded with capacity.

| Min \|gap\| | Trades | Stake | Net (flat 3%) | Net (Kalshi 7%) | Delta | ROI (flat) | ROI (Kalshi) |
|---|---|---|---|---|---|---|---|
| 0.00 | 2140 | 808.13 | +113.95 | +91.25 | -22.70 | 14.1% | 11.3% |
| 0.05 | 1838 | 660.41 | +113.97 | +94.60 | -19.37 | 17.3% | 14.3% |
| 0.10 | 1552 | 532.25 | +101.75 | +85.31 | -16.44 | 19.1% | 16.0% |
| 0.15 | 1312 | 416.11 | +85.49 | +71.69 | -13.80 | 20.5% | 17.2% |
| 0.20 | 1142 | 339.00 | +72.78 | +60.98 | -11.80 | 21.5% | 18.0% |
| 0.25 | 975 | 265.68 | +68.18 | +58.35 | -9.83 | 25.7% | 22.0% |
| 0.30 | 815 | 202.89 | +46.29 | +38.05 | -8.25 | 22.8% | 18.8% |

## Per company (min |gap| 0.10)

| Company | Trades | Wins | Net |
|---|---|---|---|
| AAL | 11 | 5 | +1.16 |
| AAOI | 1 | 0 | -0.28 |
| AAP | 4 | 1 | -0.60 |
| AAPL | 43 | 21 | +4.29 |
| ABNB | 17 | 2 | -2.45 |
| ACI | 7 | 3 | +0.39 |
| ADBE | 17 | 9 | +2.39 |
| ALK | 5 | 4 | +1.39 |
| ALLY | 4 | 2 | +0.24 |
| AMAT | 7 | 3 | +0.74 |
| AMC | 4 | 2 | +0.86 |
| AMD | 12 | 3 | -0.90 |
| AMZN | 57 | 19 | -0.47 |
| AS | 6 | 3 | +1.08 |
| ASTS | 2 | 0 | -0.80 |
| AVAV | 5 | 3 | +0.66 |
| AVGO | 16 | 5 | -0.20 |
| AXP | 10 | 4 | +0.91 |
| BA | 3 | 1 | -0.13 |
| BAC | 10 | 5 | +1.69 |
| BLK | 9 | 4 | +2.27 |
| BULL | 12 | 5 | +0.61 |
| C | 2 | 1 | +0.17 |
| CAR | 2 | 2 | +0.66 |
| CAVA | 17 | 4 | -2.09 |
| CBRL | 8 | 3 | -0.59 |
| CCL | 2 | 0 | -0.29 |
| CELH | 6 | 4 | +1.09 |
| CHWY | 5 | 1 | +0.13 |
| CIEN | 1 | 1 | +0.65 |
| CMG | 12 | 6 | +2.14 |
| COINBASE | 11 | 2 | +0.07 |
| COST | 27 | 5 | -0.83 |
| CRM | 6 | 1 | +0.16 |
| CRWD | 9 | 6 | +2.60 |
| CRWV | 9 | 2 | +0.27 |
| CVNA | 5 | 4 | +1.85 |
| DAL | 10 | 5 | +1.69 |
| DASH | 6 | 3 | +0.04 |
| DE | 11 | 3 | -0.48 |
| DELL | 15 | 9 | +3.16 |
| DIS | 23 | 9 | +1.53 |
| DKNG | 7 | 1 | -0.78 |
| DKS | 4 | 1 | -0.09 |
| DPZ | 11 | 5 | +0.59 |
| DUOL | 3 | 1 | -0.39 |
| EA | 5 | 0 | -0.05 |
| EBAY | 3 | 2 | +0.36 |
| F | 7 | 4 | +0.68 |
| FDX | 10 | 2 | -1.66 |
| FIG | 2 | 1 | +0.19 |
| FUTU | 1 | 1 | +0.52 |
| GEV | 3 | 0 | -0.63 |
| GIS | 3 | 2 | +0.87 |
| GME | 1 | 0 | -0.08 |
| GOOGL | 31 | 16 | +4.19 |
| GRAB | 10 | 3 | -0.77 |
| GS | 12 | 7 | +2.70 |
| HD | 10 | 7 | +3.74 |
| HIMS | 32 | 11 | +1.53 |
| HLT | 7 | 5 | +1.56 |
| HOOD | 22 | 4 | -3.54 |
| HPE | 16 | 6 | +0.33 |
| INTC | 21 | 7 | +1.28 |
| INTU | 6 | 3 | +1.56 |
| JNJ | 10 | 6 | +2.42 |
| JPM | 14 | 5 | +0.45 |
| KLAR | 8 | 7 | +4.06 |
| KO | 14 | 11 | +4.66 |
| KR | 10 | 3 | +1.02 |
| LEVI | 11 | 5 | +0.46 |
| LLY | 8 | 4 | +1.89 |
| LMT | 2 | 1 | +0.84 |
| LOW | 2 | 1 | +0.27 |
| LUCID | 1 | 0 | -0.24 |
| LULU | 2 | 0 | -0.37 |
| LUNR | 6 | 4 | +1.68 |
| LYFT | 20 | 7 | +0.38 |
| M | 2 | 1 | +0.45 |
| MCD | 33 | 15 | +3.96 |
| MDT | 3 | 1 | +0.04 |
| MELI | 1 | 0 | -0.17 |
| META | 34 | 17 | +5.11 |
| MRVL | 18 | 9 | +1.91 |
| MS | 4 | 3 | +0.96 |
| MSFT | 12 | 4 | -0.77 |
| MTN | 5 | 2 | -0.28 |
| MU | 22 | 10 | +0.81 |
| NBIS | 11 | 4 | +0.82 |
| NFLX | 47 | 16 | +0.03 |
| NKE | 17 | 6 | +0.88 |
| NVDA | 50 | 20 | +2.23 |
| OKLO | 2 | 0 | -0.20 |
| ON | 5 | 3 | +1.09 |
| ORCL | 23 | 12 | +2.70 |
| PANW | 1 | 1 | +0.77 |
| PEP | 12 | 6 | -0.49 |
| PG | 14 | 6 | -0.13 |
| PGR | 7 | 5 | +3.06 |
| PLTR | 31 | 18 | +4.75 |
| PSKY | 7 | 1 | -0.81 |
| PYPL | 13 | 7 | +1.87 |
| RDDT | 12 | 3 | -0.19 |
| RIVN | 5 | 2 | +0.08 |
| RKLB | 8 | 1 | -1.74 |
| ROKU | 12 | 7 | +1.42 |
| ROST | 3 | 2 | +0.80 |
| SBUX | 17 | 8 | +1.44 |
| SFM | 3 | 2 | +0.99 |
| SHOP | 8 | 4 | +1.78 |
| SNAP | 11 | 4 | +0.20 |
| SNOW | 10 | 4 | +0.25 |
| SPOT | 18 | 11 | +2.73 |
| STZ | 8 | 6 | +1.61 |
| TFC | 4 | 2 | +0.39 |
| TGT | 16 | 9 | +3.34 |
| TOL | 10 | 3 | -1.40 |
| TOST | 1 | 0 | -0.38 |
| TSLA | 61 | 23 | +2.62 |
| UAL | 20 | 5 | -1.47 |
| UBER | 29 | 8 | +0.52 |
| ULTA | 30 | 9 | -1.94 |
| URBN | 11 | 6 | +0.77 |
| V | 9 | 6 | +2.54 |
| VSCO | 10 | 1 | -1.84 |
| VZ | 8 | 4 | -0.23 |
| WEN | 6 | 4 | +0.51 |
| WFC | 18 | 5 | +0.75 |
| WING | 6 | 4 | +1.17 |
| WMT | 29 | 9 | +1.73 |
| YETI | 4 | 3 | +1.15 |
| YUM | 3 | 2 | +0.56 |
| ZETA | 1 | 1 | +0.54 |
| ZM | 3 | 1 | +0.06 |

## Trades (min |gap| 0.10)

| Event | Company | Word | Prior | Last | Baseline | Price | Gap | Side | Result | Gross | Net |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2025-03-01 | NKE | Athleisure | 4/58 | ❌ | 9% | 0.77 | +14 | NO | no | +0.23 | +0.22 |
| 2025-03-01 | NKE | Direct-to-consumer / Direct to consumer / DTC / D2C | 41/58 | ❌ | 68% | 0.40 | +28 | YES | no | -0.40 | -0.40 |
| 2025-03-01 | NKE | Jordan | 51/58 | ✅ | 86% | 0.02 | +12 | NO | yes | -0.02 | -0.02 |
| 2025-03-20 | FDX | Labor | 26/49 | ❌ | 52% | 0.37 | +15 | YES | no | -0.37 | -0.37 |
| 2025-03-20 | MU | Cloud | 47/58 | ✅ | 80% | 0.68 | +12 | YES | no | -0.68 | -0.68 |
| 2025-03-20 | MU | Data Center | 49/58 | ✅ | 83% | 0.02 | +15 | NO | yes | -0.02 | -0.02 |
| 2025-03-20 | MU | DRAM Pricing | 24/58 | ❌ | 41% | 0.15 | +26 | YES | no | -0.15 | -0.15 |
| 2025-03-24 | GME | Close / Closure | 39/51 | ✅ | 75% | 0.08 | +67 | YES | no | -0.08 | -0.08 |
| 2025-04-23 | TSLA | 4680 battery cell | 1/58 | ❌ | 4% | 0.82 | +14 | NO | no | +0.18 | +0.17 |
| 2025-04-23 | TSLA | Autonomous | 30/58 | ✅ | 52% | 0.04 | +44 | NO | yes | -0.04 | -0.04 |
| 2025-04-23 | TSLA | Gigafactory | 32/58 | ✅ | 55% | 0.34 | +11 | NO | yes | -0.34 | -0.34 |
| 2025-04-23 | TSLA | Megapack | 19/58 | ✅ | 34% | 0.10 | +56 | NO | yes | -0.10 | -0.10 |
| 2025-04-24 | GOOGL | Generative AI / Gen-AI / Gen AI | 8/56 | ✅ | 17% | 0.10 | +73 | NO | no | +0.90 | +0.87 |
| 2025-04-24 | GOOGL | Regulator / Regulation / Regulatory | 19/56 | ❌ | 34% | 0.47 | +19 | NO | yes | -0.47 | -0.47 |
| 2025-04-24 | GOOGL | Workspace | 19/56 | ✅ | 36% | 0.01 | +63 | NO | yes | -0.01 | -0.01 |
| 2025-04-24 | GOOGL | YouTube Premium | 11/56 | ❌ | 21% | 0.63 | +16 | NO | no | +0.37 | +0.36 |
| 2025-04-24 | GOOGL | YouTube Shorts | 15/56 | ❌ | 27% | 0.45 | +28 | NO | yes | -0.45 | -0.45 |
| 2025-05-01 | AMZN | Pharmaceutical / Pharma | 1/58 | ❌ | 4% | 0.76 | +20 | NO | no | +0.24 | +0.23 |
| 2025-05-01 | AMZN | Regulator / Regulation | 3/58 | ❌ | 7% | 0.50 | +43 | NO | no | +0.50 | +0.48 |
| 2025-05-01 | AMZN | Subscription | 26/58 | ❌ | 44% | 0.26 | +30 | NO | no | +0.74 | +0.72 |
| 2025-05-01 | AMZN | Trump | 1/58 | ❌ | 4% | 0.81 | +15 | NO | no | +0.19 | +0.18 |
| 2025-05-01 | META | Ad targeting / Ad-targeting | 17/51 | ❌ | 34% | 0.21 | +13 | YES | no | -0.21 | -0.21 |
| 2025-05-01 | META | Efficiency | 22/51 | ✅ | 44% | 0.10 | +46 | NO | yes | -0.10 | -0.10 |
| 2025-05-01 | META | Metaverse | 14/51 | ✅ | 30% | 0.15 | +55 | NO | yes | -0.15 | -0.15 |
| 2025-05-01 | META | Moderation | 6/51 | ❌ | 14% | 0.69 | +17 | NO | no | +0.31 | +0.30 |
| 2025-05-01 | META | Quest 3 | 5/51 | ✅ | 13% | 0.70 | +17 | NO | no | +0.30 | +0.29 |
| 2025-05-01 | META | Reels | 19/51 | ✅ | 39% | 0.08 | +53 | NO | yes | -0.08 | -0.08 |
| 2025-05-01 | META | Regulator / Regulatory / Regulation | 28/51 | ✅ | 55% | 0.07 | +38 | NO | yes | -0.07 | -0.07 |
| 2025-05-01 | META | Threads | 12/51 | ✅ | 26% | 0.05 | +69 | NO | yes | -0.05 | -0.05 |
| 2025-05-01 | META | TikTok | 9/51 | ❌ | 19% | 0.51 | +30 | NO | no | +0.49 | +0.48 |
| 2025-05-01 | META | WhatsApp | 44/51 | ✅ | 84% | 0.04 | +12 | NO | yes | -0.04 | -0.04 |
| 2025-05-01 | MSFT | Enterprise AI | 4/59 | ✅ | 10% | 0.61 | +29 | NO | no | +0.39 | +0.38 |
| 2025-05-06 | F | Autonomous | 24/27 | ❌ | 82% | 0.24 | +58 | YES | no | -0.24 | -0.24 |
| 2025-05-06 | F | F-150 Lightning | 2/27 | ✅ | 14% | 0.60 | +26 | NO | no | +0.40 | +0.39 |
| 2025-05-06 | LUCID | International | 9/13 | ❌ | 61% | 0.24 | +37 | YES | no | -0.24 | -0.24 |
| 2025-05-06 | PLTR | Apollo | 16/18 | ✅ | 83% | 0.59 | +24 | YES | yes | +0.41 | +0.40 |
| 2025-05-06 | PLTR | Civil liberties | 4/18 | ❌ | 25% | 0.53 | +22 | NO | no | +0.47 | +0.46 |
| 2025-05-06 | PLTR | Kill | 7/18 | ❌ | 38% | 0.35 | +27 | NO | no | +0.65 | +0.63 |
| 2025-05-07 | AMD | AI Chip | 0/59 | ❌ | 2% | 0.76 | +22 | NO | no | +0.24 | +0.23 |
| 2025-05-07 | AMD | Automotive / Automobile | 18/59 | ✅ | 32% | 0.51 | +17 | NO | yes | -0.51 | -0.51 |
| 2025-05-07 | AMD | Buyback | 1/59 | ❌ | 4% | 0.83 | +13 | NO | no | +0.17 | +0.16 |
| 2025-05-07 | AMD | China | 31/59 | ✅ | 53% | 0.20 | +27 | NO | yes | -0.20 | -0.20 |
| 2025-05-07 | AMD | HPC | 27/59 | ✅ | 47% | 0.21 | +32 | NO | yes | -0.21 | -0.21 |
| 2025-05-07 | AMD | Inference | 10/59 | ✅ | 20% | 0.07 | +73 | NO | yes | -0.07 | -0.07 |
| 2025-05-07 | AMD | Xilinx | 16/59 | ✅ | 29% | 0.16 | +13 | YES | yes | +0.84 | +0.81 |
| 2025-05-07 | DIS | Cruise line | 33/59 | ❌ | 55% | 0.20 | +25 | NO | no | +0.80 | +0.78 |
| 2025-05-07 | DIS | IP / Intellectual property | 42/59 | ✅ | 70% | 0.13 | +17 | NO | yes | -0.13 | -0.13 |
| 2025-05-07 | DIS | Merchandise | 47/59 | ❌ | 77% | 0.30 | +47 | YES | no | -0.30 | -0.30 |
| 2025-05-07 | DIS | Netflix | 37/59 | ❌ | 61% | 0.37 | +24 | YES | no | -0.37 | -0.37 |
| 2025-05-07 | DIS | Pricing power | 9/59 | ❌ | 17% | 0.70 | +13 | NO | no | +0.30 | +0.29 |
| 2025-05-08 | AMC | Box office recovery | 4/25 | ❌ | 19% | 0.46 | +35 | NO | no | +0.54 | +0.52 |
| 2025-05-08 | AMC | Theater attendance | 4/25 | ❌ | 19% | 0.63 | +18 | NO | no | +0.37 | +0.36 |
| 2025-05-09 | COINBASE | Decentralized Exchange / DEX | 9/16 | ✅ | 57% | 0.42 | +15 | YES | yes | +0.58 | +0.56 |
| 2025-05-09 | COINBASE | Margin | 8/16 | ✅ | 52% | 0.22 | +26 | NO | yes | -0.22 | -0.22 |
| 2025-05-09 | COINBASE | Stablecoin | 11/16 | ✅ | 67% | 0.08 | +25 | NO | yes | -0.08 | -0.08 |
| 2025-05-29 | NVDA | CUDA | 37/58 | ✅ | 63% | 0.07 | +30 | NO | yes | -0.07 | -0.07 |
| 2025-05-29 | NVDA | Data center | 49/58 | ✅ | 83% | 0.01 | +16 | NO | yes | -0.01 | -0.01 |
| 2025-05-29 | NVDA | DGX Cloud | 5/58 | ❌ | 10% | 0.69 | +21 | NO | no | +0.31 | +0.30 |
| 2025-05-29 | NVDA | Export restriction | 1/58 | ✅ | 5% | 0.70 | +25 | NO | yes | -0.70 | -0.70 |
| 2025-05-29 | NVDA | H100 | 12/58 | ✅ | 23% | 0.31 | +46 | NO | yes | -0.31 | -0.31 |
| 2025-05-29 | NVDA | Quantum | 20/58 | ✅ | 36% | 0.16 | +48 | NO | yes | -0.16 | -0.16 |
| 2025-07-16 | NFLX | Ad-supported | 13/59 | ❌ | 23% | 0.39 | +38 | NO | yes | -0.39 | -0.39 |
| 2025-07-16 | NFLX | Churn | 46/59 | ✅ | 77% | 0.62 | +15 | YES | no | -0.62 | -0.62 |
| 2025-07-16 | NFLX | Engagement | 39/59 | ✅ | 66% | 0.01 | +33 | NO | yes | -0.01 | -0.01 |
| 2025-07-16 | NFLX | Squid Game | 11/59 | ✅ | 21% | 0.05 | +74 | NO | yes | -0.05 | -0.05 |
| 2025-07-21 | TSLA | Autonomous | 30/58 | ✅ | 52% | 0.03 | +45 | NO | yes | -0.03 | -0.03 |
| 2025-07-21 | TSLA | Big Beautiful Bill | 0/58 | ❌ | 2% | 0.59 | +39 | NO | no | +0.41 | +0.40 |
| 2025-07-21 | TSLA | DOGE / Department of Government Efficiency | 1/58 | ✅ | 5% | 0.72 | +23 | NO | no | +0.28 | +0.27 |
| 2025-07-21 | TSLA | Dojo | 13/58 | ❌ | 23% | 0.59 | +18 | NO | yes | -0.59 | -0.59 |
| 2025-07-21 | TSLA | Full Self-Driving / FSD | 29/58 | ✅ | 51% | 0.04 | +45 | NO | yes | -0.04 | -0.04 |
| 2025-07-21 | TSLA | Gigafactory | 32/58 | ✅ | 55% | 0.28 | +17 | NO | no | +0.72 | +0.70 |
| 2025-07-21 | TSLA | Grok4 | 0/58 | ❌ | 2% | 0.39 | +59 | NO | yes | -0.39 | -0.39 |
| 2025-07-21 | TSLA | Robotaxi | 17/58 | ✅ | 31% | 0.04 | +65 | NO | yes | -0.04 | -0.04 |
| 2025-07-21 | TSLA | Supercharger / Super Charger / Super-charger | 30/58 | ❌ | 51% | 0.21 | +28 | NO | no | +0.79 | +0.77 |
| 2025-07-21 | TSLA | Tariff | 9/58 | ✅ | 18% | 0.11 | +71 | NO | yes | -0.11 | -0.11 |
| 2025-07-21 | TSLA | Trump | 3/58 | ✅ | 9% | 0.49 | +42 | NO | no | +0.51 | +0.49 |
| 2025-07-21 | TSLA | xAI | 3/58 | ❌ | 7% | 0.28 | +65 | NO | yes | -0.28 | -0.28 |
| 2025-07-22 | GOOGL | Youtube Shorts | 15/57 | ✅ | 28% | 0.01 | +71 | NO | yes | -0.01 | -0.01 |
| 2025-07-31 | AAPL | M3 | 4/56 | ✅ | 11% | 0.36 | +53 | NO | no | +0.64 | +0.62 |
| 2025-07-31 | AAPL | Tariff | 7/56 | ✅ | 16% | 0.10 | +74 | NO | yes | -0.10 | -0.10 |
| 2025-07-31 | AAPL | WWDC | 12/56 | ✅ | 24% | 0.29 | +47 | NO | yes | -0.29 | -0.29 |
| 2025-07-31 | AMZN | Advertising | 46/59 | ✅ | 77% | 0.05 | +18 | NO | yes | -0.05 | -0.05 |
| 2025-07-31 | AMZN | Supply Chain | 15/59 | ✅ | 28% | 0.25 | +47 | NO | no | +0.75 | +0.73 |
| 2025-07-31 | AMZN | Tariff | 0/59 | ✅ | 4% | 0.03 | +93 | NO | yes | -0.03 | -0.03 |
| 2025-07-31 | AMZN | Thursday Night Football | 15/59 | ❌ | 26% | 0.60 | +14 | NO | no | +0.40 | +0.39 |
| 2025-08-04 | PLTR | Kill | 7/18 | ❌ | 38% | 0.03 | +35 | YES | no | -0.03 | -0.03 |
| 2025-08-05 | AMD | healthcare | 11/59 | ✅ | 21% | 0.01 | +78 | NO | yes | -0.01 | -0.01 |
| 2025-08-05 | AMD | HPC | 27/59 | ✅ | 47% | 0.01 | +52 | NO | yes | -0.01 | -0.01 |
| 2025-08-06 | UBER | Capital Allocation | 15/24 | ❌ | 59% | 0.01 | +40 | NO | yes | -0.01 | -0.01 |
| 2025-08-06 | UBER | Ecosystem | 10/24 | ❌ | 41% | 0.38 | +21 | NO | yes | -0.38 | -0.38 |
| 2025-08-06 | UBER | Hailable | 12/24 | ❌ | 48% | 0.19 | +29 | YES | no | -0.19 | -0.19 |
| 2025-08-06 | UBER | India | 11/24 | ❌ | 44% | 0.11 | +33 | YES | no | -0.11 | -0.11 |
| 2025-08-06 | UBER | Lucid | 0/24 | ❌ | 5% | 0.01 | +94 | NO | yes | -0.01 | -0.01 |
| 2025-08-06 | UBER | Onboarding | 8/24 | ❌ | 34% | 0.19 | +15 | YES | no | -0.19 | -0.19 |
| 2025-08-06 | UBER | Tesla | 3/24 | ❌ | 16% | 0.01 | +83 | NO | yes | -0.01 | -0.01 |
| 2025-08-11 | AMC | Box office | 23/25 | ✅ | 87% | 0.01 | +12 | NO | yes | -0.01 | -0.01 |
| 2025-08-11 | AMC | Streaming | 18/25 | ❌ | 67% | 0.01 | +32 | NO | yes | -0.01 | -0.01 |
| 2025-08-21 | WMT | Automation | 22/55 | ✅ | 41% | 0.01 | +58 | NO | yes | -0.01 | -0.01 |
| 2025-08-21 | WMT | Back-to-school | 23/55 | ✅ | 43% | 0.08 | +49 | NO | yes | -0.08 | -0.08 |
| 2025-08-21 | WMT | Brick-and-mortar | 3/55 | ❌ | 8% | 0.01 | +91 | NO | yes | -0.01 | -0.01 |
| 2025-08-21 | WMT | Capex | 17/55 | ✅ | 33% | 0.20 | +13 | YES | no | -0.20 | -0.20 |
| 2025-08-21 | WMT | Free cash flow | 33/55 | ❌ | 58% | 0.02 | +40 | NO | yes | -0.02 | -0.02 |
| 2025-08-21 | WMT | Omnichannel | 21/55 | ✅ | 40% | 0.21 | +39 | NO | yes | -0.21 | -0.21 |
| 2025-08-21 | WMT | Operating margin | 11/55 | ❌ | 21% | 0.01 | +78 | NO | yes | -0.01 | -0.01 |
| 2025-08-21 | WMT | Profit faster than sales | 9/55 | ✅ | 19% | 0.02 | +79 | NO | yes | -0.02 | -0.02 |
| 2025-08-21 | WMT | Q3 | 33/55 | ✅ | 60% | 0.13 | +27 | NO | yes | -0.13 | -0.13 |
| 2025-08-27 | NVDA | Blackwell | 5/58 | ✅ | 12% | 0.02 | +86 | NO | yes | -0.02 | -0.02 |
| 2025-08-27 | NVDA | Cosmos | 1/58 | ✅ | 5% | 0.25 | +70 | NO | yes | -0.25 | -0.25 |
| 2025-08-27 | NVDA | Datacenter | 0/58 | ❌ | 2% | 0.01 | +97 | NO | yes | -0.01 | -0.01 |
| 2025-08-27 | NVDA | Enterprise | 50/58 | ✅ | 84% | 0.02 | +14 | NO | yes | -0.02 | -0.02 |
| 2025-08-27 | NVDA | Hopper | 12/58 | ✅ | 23% | 0.10 | +67 | NO | yes | -0.10 | -0.10 |
| 2025-08-27 | NVDA | Inference | 37/58 | ✅ | 63% | 0.02 | +35 | NO | yes | -0.02 | -0.02 |
| 2025-08-27 | NVDA | Networking | 28/58 | ✅ | 49% | 0.05 | +46 | NO | yes | -0.05 | -0.05 |
| 2025-08-27 | NVDA | Production | 49/58 | ✅ | 83% | 0.03 | +14 | NO | yes | -0.03 | -0.03 |
| 2025-08-27 | NVDA | Professional | 46/58 | ❌ | 77% | 0.64 | +13 | YES | yes | +0.36 | +0.35 |
| 2025-08-27 | NVDA | Sovereign | 7/58 | ✅ | 15% | 0.10 | +75 | NO | yes | -0.10 | -0.10 |
| 2025-09-10 | ORCL | RPO /  Remaining Performance Obligation | 20/60 | ✅ | 35% | 0.01 | +64 | NO | yes | -0.01 | -0.01 |
| 2025-09-17 | CBRL | Breakfast | 23/26 | ❌ | 81% | 0.71 | +10 | YES | yes | +0.29 | +0.28 |
| 2025-09-17 | CBRL | Logo | 0/26 | ❌ | 5% | 0.28 | +67 | NO | yes | -0.28 | -0.28 |
| 2025-09-17 | CBRL | Rebrand | 0/26 | ❌ | 5% | 0.70 | +25 | NO | no | +0.30 | +0.29 |
| 2025-09-17 | CBRL | Tariff | 5/26 | ✅ | 25% | 0.16 | +59 | NO | yes | -0.16 | -0.16 |
| 2025-09-23 | MU | China | 37/60 | ❌ | 60% | 0.25 | +15 | NO | no | +0.75 | +0.73 |
| 2025-09-23 | MU | Cloud | 48/60 | ❌ | 77% | 0.45 | +32 | YES | yes | +0.55 | +0.53 |
| 2025-09-23 | MU | Expansion | 38/60 | ❌ | 62% | 0.21 | +17 | NO | yes | -0.21 | -0.21 |
| 2025-09-23 | MU | GPU | 11/60 | ✅ | 21% | 0.18 | +61 | NO | no | +0.82 | +0.80 |
| 2025-09-23 | MU | Idaho | 10/60 | ✅ | 19% | 0.19 | +62 | NO | yes | -0.19 | -0.19 |
| 2025-09-23 | MU | Nvidia | 16/60 | ✅ | 29% | 0.24 | +47 | NO | yes | -0.24 | -0.24 |
| 2025-09-23 | MU | Trump | 0/60 | ✅ | 4% | 0.82 | +14 | NO | no | +0.18 | +0.17 |
| 2025-09-25 | COST | Hot Dog | 13/60 | ✅ | 24% | 0.60 | +16 | NO | yes | -0.60 | -0.60 |
| 2025-09-25 | COST | Revenue | 26/60 | ❌ | 43% | 0.36 | +21 | NO | yes | -0.36 | -0.36 |
| 2025-09-25 | COST | Tariff | 10/60 | ✅ | 19% | 0.08 | +73 | NO | yes | -0.08 | -0.08 |
| 2025-09-30 | NKE | Consumer Demand | 43/60 | ❌ | 69% | 0.42 | +27 | YES | no | -0.42 | -0.42 |
| 2025-09-30 | NKE | Tatum | 7/60 | ✅ | 15% | 0.48 | +37 | NO | no | +0.52 | +0.50 |
| 2025-10-09 | DAL | Nonstop / Non-Stop | 0/25 | ✅ | 8% | 0.55 | +37 | NO | no | +0.45 | +0.44 |
| 2025-10-09 | DAL | Partnership | 18/25 | ✅ | 70% | 0.11 | +19 | NO | yes | -0.11 | -0.11 |
| 2025-10-09 | DAL | Tariff | 6/25 | ✅ | 29% | 0.15 | +56 | NO | yes | -0.15 | -0.15 |
| 2025-10-09 | DAL | Weather | 13/25 | ✅ | 53% | 0.23 | +24 | NO | no | +0.77 | +0.75 |
| 2025-10-09 | DAL | YouTube | 1/25 | ❌ | 9% | 0.70 | +21 | NO | yes | -0.70 | -0.70 |
| 2025-10-10 | BLK | Digital asset | 8/20 | ✅ | 43% | 0.01 | +56 | NO | yes | -0.01 | -0.01 |
| 2025-10-10 | BLK | ETF inflow | 2/20 | ❌ | 15% | 0.01 | +84 | NO | yes | -0.01 | -0.01 |
| 2025-10-10 | BLK | HPS acquisition | 1/20 | ✅ | 14% | 0.26 | +60 | NO | no | +0.74 | +0.72 |
| 2025-10-10 | BLK | Record AUM | 5/20 | ✅ | 31% | 0.18 | +51 | NO | yes | -0.18 | -0.18 |
| 2025-10-10 | BLK | Revenue growth | 16/20 | ✅ | 76% | 0.01 | +75 | YES | no | -0.01 | -0.01 |
| 2025-10-14 | GS | Charge Off / Charge-Off | 20/25 | ✅ | 77% | 0.10 | +13 | NO | yes | -0.10 | -0.10 |
| 2025-10-14 | GS | Inflation | 19/25 | ❌ | 70% | 0.40 | +30 | YES | no | -0.40 | -0.40 |
| 2025-10-14 | GS | Tariff | 1/25 | ✅ | 12% | 0.34 | +54 | NO | no | +0.66 | +0.64 |
| 2025-10-14 | JPM | Buyback | 26/41 | ✅ | 63% | 0.01 | +36 | NO | yes | -0.01 | -0.01 |
| 2025-10-14 | JPM | Tariff | 2/41 | ✅ | 10% | 0.01 | +89 | NO | yes | -0.01 | -0.01 |
| 2025-10-14 | JPM | Trading | 36/41 | ✅ | 85% | 0.01 | +14 | NO | yes | -0.01 | -0.01 |
| 2025-10-15 | BAC | Tariff | 2/60 | ✅ | 7% | 0.21 | +72 | NO | yes | -0.21 | -0.21 |
| 2025-10-16 | UAL | ATC | 3/21 | ✅ | 22% | 0.29 | +49 | NO | yes | -0.29 | -0.29 |
| 2025-10-16 | UAL | Newark | 15/21 | ✅ | 69% | 0.08 | +23 | NO | yes | -0.08 | -0.08 |
| 2025-10-16 | UAL | Record | 18/21 | ✅ | 81% | 0.06 | +13 | NO | no | +0.94 | +0.91 |
| 2025-10-17 | AXP | Coinbase | 0/55 | ✅ | 4% | 0.52 | +44 | NO | no | +0.48 | +0.47 |
| 2025-10-17 | AXP | Currency | 14/55 | ✅ | 28% | 0.50 | +22 | NO | no | +0.50 | +0.48 |
| 2025-10-17 | AXP | Millennial | 24/55 | ✅ | 45% | 0.02 | +53 | NO | yes | -0.02 | -0.02 |
| 2025-10-21 | KO | Dividend | 32/41 | ❌ | 74% | 0.04 | +70 | YES | no | -0.04 | -0.04 |
| 2025-10-21 | KO | International | 11/41 | ✅ | 30% | 0.01 | +69 | NO | yes | -0.01 | -0.01 |
| 2025-10-21 | NFLX | Acquisition | 43/60 | ✅ | 71% | 0.15 | +14 | NO | yes | -0.15 | -0.15 |
| 2025-10-21 | NFLX | Ad Supported | 1/60 | ❌ | 4% | 0.47 | +49 | NO | no | +0.53 | +0.51 |
| 2025-10-21 | NFLX | Churn | 47/60 | ❌ | 76% | 0.34 | +42 | YES | no | -0.34 | -0.34 |
| 2025-10-21 | NFLX | Gaming | 18/60 | ✅ | 32% | 0.35 | +33 | NO | yes | -0.35 | -0.35 |
| 2025-10-21 | NFLX | Hollywood | 19/60 | ✅ | 33% | 0.49 | +18 | NO | yes | -0.49 | -0.49 |
| 2025-10-21 | NFLX | Live Event | 10/60 | ✅ | 19% | 0.08 | +73 | NO | yes | -0.08 | -0.08 |
| 2025-10-21 | NFLX | Partnership | 34/60 | ✅ | 57% | 0.30 | +13 | NO | yes | -0.30 | -0.30 |
| 2025-10-21 | NFLX | Profitable | 29/60 | ✅ | 49% | 0.23 | +28 | NO | yes | -0.23 | -0.23 |
| 2025-10-21 | NFLX | Subscriber | 56/60 | ❌ | 90% | 0.68 | +22 | YES | no | -0.68 | -0.68 |
| 2025-10-22 | TSLA | Competition | 10/59 | ✅ | 20% | 0.54 | +26 | NO | yes | -0.54 | -0.54 |
| 2025-10-22 | TSLA | Cybertruck | 22/59 | ❌ | 37% | 0.17 | +46 | NO | no | +0.83 | +0.81 |
| 2025-10-22 | TSLA | Delivery | 45/59 | ✅ | 75% | 0.10 | +15 | NO | yes | -0.10 | -0.10 |
| 2025-10-22 | TSLA | Energy | 46/59 | ✅ | 77% | 0.03 | +20 | NO | yes | -0.03 | -0.03 |
| 2025-10-22 | TSLA | FSD / Full Self Driving | 24/59 | ✅ | 42% | 0.04 | +54 | NO | yes | -0.04 | -0.04 |
| 2025-10-22 | TSLA | Gigafactory | 33/59 | ❌ | 55% | 0.30 | +15 | NO | no | +0.70 | +0.68 |
| 2025-10-22 | TSLA | Grok4 | 0/59 | ❌ | 2% | 0.72 | +26 | NO | no | +0.28 | +0.27 |
| 2025-10-22 | TSLA | Optimus | 13/59 | ✅ | 24% | 0.05 | +71 | NO | yes | -0.05 | -0.05 |
| 2025-10-22 | TSLA | Supercharger / Super Charger | 30/59 | ❌ | 50% | 0.30 | +20 | YES | yes | +0.70 | +0.68 |
| 2025-10-22 | TSLA | Robotaxi | 18/59 | ✅ | 32% | 0.03 | +65 | NO | yes | -0.03 | -0.03 |
| 2025-10-23 | AAL | Shutdown / Shut Down | 3/21 | ❌ | 18% | 0.27 | +55 | NO | yes | -0.27 | -0.27 |
| 2025-10-23 | AAL | Tariff | 1/21 | ✅ | 14% | 0.55 | +31 | NO | no | +0.45 | +0.44 |
| 2025-10-23 | AAL | World Cup | 1/21 | ❌ | 10% | 0.46 | +44 | NO | no | +0.54 | +0.52 |
| 2025-10-23 | INTC | AIPC | 0/60 | ❌ | 2% | 0.17 | +81 | NO | yes | -0.17 | -0.17 |
| 2025-10-23 | INTC | Department of Defense | 5/60 | ❌ | 10% | 0.62 | +28 | NO | no | +0.38 | +0.37 |
| 2025-10-23 | INTC | Trump | 1/60 | ❌ | 4% | 0.55 | +41 | NO | yes | -0.55 | -0.55 |
| 2025-10-24 | PG | Competition | 35/43 | ❌ | 78% | 0.44 | +34 | YES | no | -0.44 | -0.44 |
| 2025-10-24 | PG | E-commerce | 32/43 | ✅ | 73% | 0.39 | +34 | YES | no | -0.39 | -0.39 |
| 2025-10-24 | PG | Mason Campus | 0/43 | ❌ | 3% | 0.72 | +25 | NO | no | +0.28 | +0.27 |
| 2025-10-24 | PG | Revenue | 20/43 | ✅ | 48% | 0.37 | +11 | YES | no | -0.37 | -0.37 |
| 2025-10-28 | EA | Acquisition | 31/40 | ❌ | 74% | 0.01 | +73 | YES | no | -0.01 | -0.01 |
| 2025-10-28 | EA | Apex Legends | 26/40 | ✅ | 64% | 0.01 | +63 | YES | no | -0.01 | -0.01 |
| 2025-10-28 | EA | Competition | 33/40 | ✅ | 80% | 0.01 | +79 | YES | no | -0.01 | -0.01 |
| 2025-10-28 | EA | Mobile | 40/40 | ✅ | 96% | 0.01 | +95 | YES | no | -0.01 | -0.01 |
| 2025-10-28 | EA | EA Sports FC | 13/40 | ✅ | 35% | 0.01 | +34 | YES | no | -0.01 | -0.01 |
| 2025-10-28 | PYPL | Blue Owl | 0/39 | ❌ | 4% | 0.34 | +62 | NO | yes | -0.34 | -0.34 |
| 2025-10-28 | PYPL | Unprofitable | 4/39 | ✅ | 15% | 0.48 | +37 | NO | yes | -0.48 | -0.48 |
| 2025-10-29 | COINBASE | Margin | 9/17 | ✅ | 54% | 0.17 | +29 | NO | yes | -0.17 | -0.17 |
| 2025-10-29 | COINBASE | Prediction Market | 1/17 | ✅ | 16% | 0.26 | +58 | NO | yes | -0.26 | -0.26 |
| 2025-10-29 | COINBASE | Stablecoin | 12/17 | ✅ | 68% | 0.06 | +26 | NO | yes | -0.06 | -0.06 |
| 2025-10-29 | COINBASE | Web3 | 10/17 | ❌ | 54% | 0.11 | +43 | YES | yes | +0.89 | +0.86 |
| 2025-10-29 | HOOD | Prediction Market | 2/16 | ✅ | 22% | 0.07 | +71 | NO | yes | -0.07 | -0.07 |
| 2025-10-29 | META | Algorithm | 11/52 | ✅ | 24% | 0.44 | +32 | NO | no | +0.56 | +0.54 |
| 2025-10-29 | META | Dividend | 9/52 | ✅ | 20% | 0.06 | +74 | NO | yes | -0.06 | -0.06 |
| 2025-10-29 | META | Orion | 2/52 | ✅ | 8% | 0.31 | +61 | NO | yes | -0.31 | -0.31 |
| 2025-10-29 | META | VR / Virtual Reality | 39/52 | ❌ | 72% | 0.62 | +10 | YES | no | -0.62 | -0.62 |
| 2025-10-29 | SBUX | Non Dairy | 0/42 | ❌ | 3% | 0.56 | +41 | NO | yes | -0.56 | -0.56 |
| 2025-10-29 | SBUX | Pumpkin Spice | 8/42 | ✅ | 23% | 0.46 | +31 | NO | no | +0.54 | +0.52 |
| 2025-10-30 | AAPL | Formula 1 / F1 | 2/57 | ✅ | 7% | 0.28 | +65 | NO | yes | -0.28 | -0.28 |
| 2025-10-30 | AAPL | Manufacturing | 33/57 | ✅ | 58% | 0.29 | +13 | NO | yes | -0.29 | -0.29 |
| 2025-10-30 | AAPL | Modem | 5/57 | ❌ | 11% | 0.71 | +18 | NO | no | +0.29 | +0.28 |
| 2025-10-30 | AAPL | Streaming | 17/57 | ✅ | 32% | 0.52 | +16 | NO | no | +0.48 | +0.47 |
| 2025-10-30 | AAPL | The Studio | 2/57 | ✅ | 7% | 0.09 | +84 | NO | yes | -0.09 | -0.09 |
| 2025-10-30 | AAPL | Widget | 1/57 | ✅ | 6% | 0.62 | +32 | NO | no | +0.38 | +0.37 |
| 2025-10-30 | AMZN | Amazon Bedrock | 7/60 | ✅ | 15% | 0.25 | +60 | NO | yes | -0.25 | -0.25 |
| 2025-10-30 | AMZN | China | 25/60 | ✅ | 43% | 0.28 | +29 | NO | no | +0.72 | +0.70 |
| 2025-10-30 | AMZN | Live Sports | 12/60 | ✅ | 22% | 0.25 | +53 | NO | yes | -0.25 | -0.25 |
| 2025-10-30 | AMZN | Operating Margin | 44/60 | ✅ | 72% | 0.03 | +25 | NO | yes | -0.03 | -0.03 |
| 2025-10-30 | AMZN | Project Kuiper | 5/60 | ✅ | 12% | 0.23 | +65 | NO | yes | -0.23 | -0.23 |
| 2025-10-30 | AMZN | RxPass | 4/60 | ❌ | 9% | 0.81 | +10 | NO | no | +0.19 | +0.18 |
| 2025-10-30 | AMZN | Sponsored Products | 13/60 | ✅ | 24% | 0.32 | +44 | NO | yes | -0.32 | -0.32 |
| 2025-10-30 | AMZN | Supply Chain | 16/60 | ❌ | 27% | 0.37 | +36 | NO | no | +0.63 | +0.61 |
| 2025-10-30 | AMZN | Third Party Sellers | 1/60 | ❌ | 4% | 0.38 | +58 | NO | yes | -0.38 | -0.38 |
| 2025-10-30 | GOOGL | Acquisition | 58/59 | ✅ | 96% | 0.77 | +19 | YES | yes | +0.23 | +0.22 |
| 2025-10-30 | GOOGL | DeepMind / Deep Mind | 20/59 | ❌ | 34% | 0.33 | +33 | NO | no | +0.67 | +0.65 |
| 2025-10-30 | GOOGL | Privacy | 26/59 | ❌ | 44% | 0.33 | +11 | YES | no | -0.33 | -0.33 |
| 2025-10-30 | GOOGL | Wiz | 1/59 | ❌ | 4% | 0.69 | +27 | NO | no | +0.31 | +0.30 |
| 2025-10-30 | RDDT | Election | 3/5 | ❌ | 48% | 0.17 | +31 | YES | no | -0.17 | -0.17 |
| 2025-10-30 | RDDT | Game | 3/5 | ✅ | 60% | 0.46 | +14 | YES | yes | +0.54 | +0.52 |
| 2025-10-30 | RDDT | OpenAI / Open AI | 4/5 | ❌ | 58% | 0.27 | +31 | YES | no | -0.27 | -0.27 |
| 2025-10-30 | RDDT | Reddit Pro (3+ times) | 0/5 | ❌ | 17% | 0.24 | +59 | NO | yes | -0.24 | -0.24 |
| 2025-10-30 | RDDT | Traffic | 5/5 | ✅ | 80% | 0.01 | +19 | NO | yes | -0.01 | -0.01 |
| 2025-10-30 | ROKU | Bundle (3+ times) | 0/31 | ❌ | 4% | 0.69 | +27 | NO | no | +0.31 | +0.30 |
| 2025-10-30 | ROKU | Hour | 29/31 | ✅ | 89% | 0.53 | +36 | YES | yes | +0.47 | +0.46 |
| 2025-10-30 | ROKU | Howdy | 0/31 | ❌ | 4% | 0.27 | +69 | NO | yes | -0.27 | -0.27 |
| 2025-10-30 | ROKU | Tariff | 5/31 | ❌ | 19% | 0.71 | +10 | NO | no | +0.29 | +0.28 |
| 2025-10-30 | UBER | Market Share | 11/25 | ❌ | 43% | 0.18 | +25 | YES | no | -0.18 | -0.18 |
| 2025-10-30 | UBER | Safety | 15/25 | ✅ | 60% | 0.27 | +13 | NO | no | +0.73 | +0.71 |
| 2025-10-30 | UBER | Waymo | 5/25 | ✅ | 26% | 0.04 | +70 | NO | yes | -0.04 | -0.04 |
| 2025-11-03 | HIMS | Canada | 1/18 | ✅ | 16% | 0.16 | +68 | NO | yes | -0.16 | -0.16 |
| 2025-11-03 | HIMS | Europe | 1/18 | ✅ | 16% | 0.40 | +44 | NO | yes | -0.40 | -0.40 |
| 2025-11-03 | HIMS | FDA | 3/18 | ✅ | 25% | 0.23 | +52 | NO | yes | -0.23 | -0.23 |
| 2025-11-03 | HIMS | Tariff | 1/18 | ✅ | 16% | 0.46 | +38 | NO | no | +0.54 | +0.52 |
| 2025-11-03 | HIMS | Testosterone | 4/18 | ✅ | 29% | 0.09 | +62 | NO | yes | -0.09 | -0.09 |
| 2025-11-03 | HIMS | Vitamin | 3/18 | ✅ | 25% | 0.16 | +59 | NO | yes | -0.16 | -0.16 |
| 2025-11-03 | PLTR | AI Growth | 0/19 | ❌ | 7% | 0.83 | +10 | NO | no | +0.17 | +0.16 |
| 2025-11-03 | PLTR | Gotham Platform | 1/19 | ❌ | 11% | 0.78 | +11 | NO | no | +0.22 | +0.21 |
| 2025-11-03 | PLTR | Hadean | 0/19 | ❌ | 7% | 0.38 | +55 | NO | no | +0.62 | +0.60 |
| 2025-11-03 | PLTR | Lethal | 4/19 | ✅ | 28% | 0.36 | +36 | NO | yes | -0.36 | -0.36 |
| 2025-11-03 | PLTR | Nvidia | 0/19 | ❌ | 7% | 0.09 | +84 | NO | no | +0.91 | +0.88 |
| 2025-11-03 | PLTR | Shutdown / Shut Down | 0/19 | ❌ | 7% | 0.26 | +67 | NO | no | +0.74 | +0.72 |
| 2025-11-03 | PLTR | Warp Speed | 0/19 | ❌ | 7% | 0.19 | +74 | NO | yes | -0.19 | -0.19 |
| 2025-11-05 | CAVA | Automation | 4/9 | ❌ | 42% | 0.48 | +10 | NO | no | +0.52 | +0.50 |
| 2025-11-05 | CAVA | Dining | 8/9 | ✅ | 79% | 0.66 | +13 | YES | yes | +0.34 | +0.33 |
| 2025-11-05 | CAVA | Hyphen | 1/9 | ❌ | 19% | 0.37 | +44 | NO | no | +0.63 | +0.61 |
| 2025-11-05 | CAVA | Tariff | 2/9 | ✅ | 34% | 0.52 | +14 | NO | yes | -0.52 | -0.52 |
| 2025-11-05 | CELH | Amazon | 25/32 | ✅ | 76% | 0.10 | +14 | NO | no | +0.90 | +0.87 |
| 2025-11-05 | LYFT | Competition | 12/25 | ✅ | 50% | 0.37 | +13 | NO | no | +0.63 | +0.61 |
| 2025-11-05 | LYFT | Expansion | 13/25 | ✅ | 53% | 0.19 | +28 | NO | no | +0.81 | +0.79 |
| 2025-11-05 | LYFT | FreeNow / Free Now | 1/25 | ✅ | 12% | 0.11 | +77 | NO | yes | -0.11 | -0.11 |
| 2025-11-05 | LYFT | International | 6/25 | ❌ | 26% | 0.64 | +10 | NO | yes | -0.64 | -0.64 |
| 2025-11-05 | LYFT | Membership | 11/25 | ❌ | 43% | 0.30 | +13 | YES | no | -0.30 | -0.30 |
| 2025-11-05 | LYFT | Mobileye | 3/25 | ❌ | 16% | 0.56 | +28 | NO | no | +0.44 | +0.43 |
| 2025-11-05 | LYFT | Waymo | 8/25 | ❌ | 33% | 0.10 | +57 | NO | yes | -0.10 | -0.10 |
| 2025-11-06 | DKNG | Missouri | 3/21 | ✅ | 22% | 0.11 | +67 | NO | yes | -0.11 | -0.11 |
| 2025-11-06 | DKNG | Prediction | 5/21 | ✅ | 30% | 0.02 | +68 | NO | yes | -0.02 | -0.02 |
| 2025-11-06 | MCD | Competition | 35/61 | ❌ | 56% | 0.01 | +55 | YES | no | -0.01 | -0.01 |
| 2025-11-06 | MCD | Delivery | 45/61 | ✅ | 73% | 0.05 | +22 | NO | yes | -0.05 | -0.05 |
| 2025-11-06 | MCD | Happy Meal | 16/61 | ✅ | 28% | 0.02 | +70 | NO | yes | -0.02 | -0.02 |
| 2025-11-06 | MCD | McCrispy Chicken | 9/61 | ❌ | 16% | 0.03 | +13 | YES | no | -0.03 | -0.03 |
| 2025-11-06 | MCD | Revenue | 29/61 | ❌ | 47% | 0.05 | +42 | YES | no | -0.05 | -0.05 |
| 2025-11-06 | MCD | Supply Chain | 33/61 | ✅ | 54% | 0.01 | +45 | NO | yes | -0.01 | -0.01 |
| 2025-11-06 | MCD | Tariff | 3/61 | ✅ | 8% | 0.01 | +91 | NO | yes | -0.01 | -0.01 |
| 2025-11-06 | SNAP | Platinum | 0/18 | ✅ | 11% | 0.66 | +23 | NO | yes | -0.66 | -0.66 |
| 2025-11-06 | SNAP | Storage | 0/18 | ✅ | 11% | 0.32 | +57 | NO | yes | -0.32 | -0.32 |
| 2025-11-06 | SNAP | Xbox | 0/18 | ❌ | 7% | 0.28 | +65 | NO | no | +0.72 | +0.70 |
| 2025-11-07 | ABNB | Domestic | 13/19 | ✅ | 67% | 0.10 | +23 | NO | yes | -0.10 | -0.10 |
| 2025-11-07 | ABNB | Service Agent | 6/19 | ✅ | 37% | 0.14 | +49 | NO | yes | -0.14 | -0.14 |
| 2025-11-07 | ABNB | Social Media | 9/19 | ✅ | 49% | 0.12 | +39 | NO | yes | -0.12 | -0.12 |
| 2025-11-10 | CRWV | CrowdStrike / Crowd Strike | 0/1 | ❌ | 27% | 0.18 | +55 | NO | yes | -0.18 | -0.18 |
| 2025-11-10 | CRWV | Government | 0/1 | ✅ | 56% | 0.28 | +16 | NO | yes | -0.28 | -0.28 |
| 2025-11-10 | CRWV | Healthcare | 0/1 | ✅ | 56% | 0.27 | +17 | NO | no | +0.73 | +0.71 |
| 2025-11-10 | CRWV | Marimo | 0/1 | ❌ | 27% | 0.05 | +68 | NO | yes | -0.05 | -0.05 |
| 2025-11-10 | CRWV | Meta | 0/1 | ✅ | 56% | 0.09 | +35 | NO | yes | -0.09 | -0.09 |
| 2025-11-10 | CRWV | Nvidia | 1/1 | ✅ | 67% | 0.03 | +30 | NO | yes | -0.03 | -0.03 |
| 2025-11-10 | CRWV | Shutdown / Shut Down | 0/1 | ❌ | 27% | 0.55 | +18 | NO | no | +0.45 | +0.44 |
| 2025-11-10 | RKLB | Golden Dome | 1/16 | ✅ | 17% | 0.12 | +71 | NO | yes | -0.12 | -0.12 |
| 2025-11-10 | RKLB | Japan | 3/16 | ❌ | 22% | 0.30 | +48 | NO | yes | -0.30 | -0.30 |
| 2025-11-10 | RKLB | Lunar | 5/16 | ❌ | 32% | 0.50 | +18 | NO | no | +0.50 | +0.48 |
| 2025-11-10 | RKLB | Mars | 14/16 | ✅ | 82% | 0.07 | +11 | NO | yes | -0.07 | -0.07 |
| 2025-11-10 | RKLB | Reusable | 12/16 | ✅ | 72% | 0.17 | +11 | NO | yes | -0.17 | -0.17 |
| 2025-11-10 | RKLB | Shutdown / Shut Down | 2/16 | ❌ | 18% | 0.60 | +22 | NO | yes | -0.60 | -0.60 |
| 2025-11-11 | NBIS | Uber | 5/7 | ✅ | 67% | 0.13 | +20 | NO | no | +0.87 | +0.84 |
| 2025-11-13 | DIS | Abu Dhabi | 1/61 | ✅ | 5% | 0.28 | +67 | NO | yes | -0.28 | -0.28 |
| 2025-11-13 | DIS | Buyback | 19/61 | ❌ | 32% | 0.16 | +16 | YES | no | -0.16 | -0.16 |
| 2025-11-13 | DIS | Competition | 28/61 | ✅ | 47% | 0.10 | +43 | NO | yes | -0.10 | -0.10 |
| 2025-11-13 | DIS | DraftKings | 1/61 | ❌ | 4% | 0.21 | +75 | NO | no | +0.79 | +0.77 |
| 2025-11-13 | DIS | NFL Deal | 4/61 | ✅ | 10% | 0.64 | +26 | NO | no | +0.36 | +0.35 |
| 2025-11-13 | DIS | YouTube TV | 1/61 | ❌ | 4% | 0.44 | +52 | NO | no | +0.56 | +0.54 |
| 2025-11-13 | DIS | Zootopia | 20/61 | ✅ | 34% | 0.08 | +58 | NO | yes | -0.08 | -0.08 |
| 2025-11-18 | HD | Synergy | 3/60 | ❌ | 7% | 0.45 | +48 | NO | yes | -0.45 | -0.45 |
| 2025-11-18 | HD | Volatility | 9/60 | ✅ | 18% | 0.35 | +47 | NO | no | +0.65 | +0.63 |
| 2025-11-19 | TGT | Black Friday | 19/49 | ❌ | 39% | 0.05 | +56 | NO | no | +0.95 | +0.92 |
| 2025-11-19 | TGT | Inflation | 21/49 | ✅ | 44% | 0.24 | +32 | NO | no | +0.76 | +0.74 |
| 2025-11-19 | TGT | Labor | 33/49 | ✅ | 67% | 0.37 | +30 | YES | yes | +0.63 | +0.61 |
| 2025-11-19 | TGT | Netflix | 0/49 | ❌ | 3% | 0.36 | +61 | NO | no | +0.64 | +0.62 |
| 2025-11-19 | TGT | Revenue | 25/49 | ❌ | 50% | 0.37 | +13 | YES | no | -0.37 | -0.37 |
| 2025-11-19 | TGT | Shutdown / Shut Down | 3/49 | ❌ | 8% | 0.72 | +20 | NO | no | +0.28 | +0.27 |
| 2025-11-20 | NVDA | Automation | 13/60 | ✅ | 24% | 0.44 | +32 | NO | yes | -0.44 | -0.44 |
| 2025-11-20 | NVDA | Domestic | 10/60 | ❌ | 18% | 0.55 | +27 | NO | no | +0.45 | +0.44 |
| 2025-11-20 | NVDA | GM / General Motors | 4/60 | ❌ | 9% | 0.78 | +13 | NO | no | +0.22 | +0.21 |
| 2025-11-20 | NVDA | H20 | 3/60 | ✅ | 8% | 0.09 | +83 | NO | yes | -0.09 | -0.09 |
| 2025-11-20 | NVDA | Humanoid | 4/60 | ❌ | 9% | 0.38 | +53 | NO | no | +0.62 | +0.60 |
| 2025-11-20 | NVDA | Omniverse | 19/60 | ✅ | 33% | 0.15 | +52 | NO | yes | -0.15 | -0.15 |
| 2025-11-20 | NVDA | Self Driving | 0/60 | ❌ | 2% | 0.39 | +59 | NO | yes | -0.39 | -0.39 |
| 2025-11-20 | NVDA | Talent | 4/60 | ❌ | 9% | 0.49 | +42 | NO | no | +0.51 | +0.49 |
| 2025-11-20 | NVDA | Tariff | 3/60 | ❌ | 7% | 0.59 | +34 | NO | no | +0.41 | +0.40 |
| 2025-11-20 | NVDA | Trump | 1/60 | ❌ | 4% | 0.59 | +37 | NO | no | +0.41 | +0.40 |
| 2025-11-20 | NVDA | TSMC | 20/60 | ✅ | 35% | 0.29 | +36 | NO | yes | -0.29 | -0.29 |
| 2025-11-20 | NVDA | VR / Virtual Reality | 23/60 | ❌ | 38% | 0.15 | +23 | YES | no | -0.15 | -0.15 |
| 2025-11-20 | WMT | Omnichannel | 22/56 | ✅ | 41% | 0.32 | +27 | NO | yes | -0.32 | -0.32 |
| 2025-11-20 | WMT | OnePay / One Pay | 0/56 | ✅ | 4% | 0.23 | +73 | NO | yes | -0.23 | -0.23 |
| 2025-11-20 | WMT | OpenAI | 0/56 | ❌ | 3% | 0.25 | +72 | NO | yes | -0.25 | -0.25 |
| 2025-11-20 | WMT | Shutdown / Shut Down | 4/56 | ❌ | 9% | 0.62 | +29 | NO | no | +0.38 | +0.37 |
| 2025-11-20 | WMT | Skip | 5/56 | ❌ | 11% | 0.79 | +10 | NO | no | +0.21 | +0.20 |
| 2025-11-20 | WMT | SNAP | 11/56 | ❌ | 21% | 0.44 | +35 | NO | no | +0.56 | +0.54 |
| 2025-11-20 | WMT | Tariff | 30/56 | ✅ | 54% | 0.05 | +41 | NO | yes | -0.05 | -0.05 |
| 2025-11-26 | DE | AI / Artificial Intelligence | 3/61 | ✅ | 8% | 0.52 | +40 | NO | no | +0.48 | +0.47 |
| 2025-11-26 | DE | Automation | 18/61 | ✅ | 31% | 0.41 | +28 | NO | yes | -0.41 | -0.41 |
| 2025-11-26 | DE | Efficiency | 29/61 | ✅ | 48% | 0.38 | +14 | NO | no | +0.62 | +0.60 |
| 2025-11-26 | DELL | AI Factory | 3/18 | ❌ | 20% | 0.10 | +70 | NO | yes | -0.10 | -0.10 |
| 2025-11-26 | DELL | China | 6/18 | ❌ | 34% | 0.22 | +12 | YES | no | -0.22 | -0.22 |
| 2025-11-26 | DELL | Dividend (3+ times) | 0/18 | ❌ | 7% | 0.50 | +43 | NO | no | +0.50 | +0.48 |
| 2025-11-26 | DELL | New Product | 6/18 | ❌ | 34% | 0.36 | +30 | NO | no | +0.64 | +0.62 |
| 2025-11-26 | DELL | Nvidia (5+ times) | 0/18 | ❌ | 7% | 0.50 | +43 | NO | no | +0.50 | +0.48 |
| 2025-11-26 | DELL | RTX Pro 6000 | 2/18 | ❌ | 16% | 0.41 | +43 | NO | no | +0.59 | +0.57 |
| 2025-12-02 | MRVL | Microsoft | 7/43 | ✅ | 20% | 0.45 | +35 | NO | no | +0.55 | +0.53 |
| 2025-12-03 | SNOW | Azure | 13/19 | ✅ | 67% | 0.56 | +11 | YES | no | -0.56 | -0.56 |
| 2025-12-03 | SNOW | Hiring | 18/19 | ✅ | 88% | 0.74 | +14 | YES | yes | +0.26 | +0.25 |
| 2025-12-03 | SNOW | Iceberg | 10/19 | ✅ | 54% | 0.11 | +35 | NO | no | +0.89 | +0.86 |
| 2025-12-04 | HPE | Nvidia | 9/17 | ✅ | 54% | 0.11 | +35 | NO | yes | -0.11 | -0.11 |
| 2025-12-04 | HPE | Quantum | 1/17 | ✅ | 16% | 0.56 | +28 | NO | yes | -0.56 | -0.56 |
| 2025-12-04 | KR | AI / Artificial Intelligence | 7/20 | ✅ | 39% | 0.19 | +42 | NO | yes | -0.19 | -0.19 |
| 2025-12-04 | KR | Holiday | 9/20 | ❌ | 44% | 0.08 | +48 | NO | yes | -0.08 | -0.08 |
| 2025-12-04 | KR | Instacart | 5/20 | ✅ | 31% | 0.31 | +38 | NO | yes | -0.31 | -0.31 |
| 2025-12-04 | ULTA | Reward | 12/17 | ❌ | 64% | 0.45 | +19 | YES | no | -0.45 | -0.45 |
| 2025-12-04 | ULTA | Space NK | 0/17 | ✅ | 12% | 0.32 | +56 | NO | yes | -0.32 | -0.32 |
| 2025-12-04 | ULTA | Tariff | 2/17 | ✅ | 21% | 0.52 | +27 | NO | yes | -0.52 | -0.52 |
| 2025-12-04 | ULTA | Traffic | 16/17 | ❌ | 83% | 0.72 | +11 | YES | yes | +0.28 | +0.27 |
| 2025-12-04 | ULTA | Uncertainty | 9/17 | ✅ | 54% | 0.12 | +34 | NO | yes | -0.12 | -0.12 |
| 2025-12-04 | ULTA | Wicked | 1/17 | ❌ | 12% | 0.30 | +58 | NO | no | +0.70 | +0.68 |
| 2025-12-10 | ADBE | Black Friday | 9/56 | ❌ | 17% | 0.30 | +53 | NO | no | +0.70 | +0.68 |
| 2025-12-10 | ADBE | Firefly Video | 4/56 | ✅ | 11% | 0.29 | +60 | NO | no | +0.71 | +0.69 |
| 2025-12-10 | ADBE | Google Cloud | 0/56 | ❌ | 3% | 0.54 | +43 | NO | no | +0.46 | +0.45 |
| 2025-12-10 | ADBE | Humain | 0/56 | ❌ | 3% | 0.44 | +53 | NO | yes | -0.44 | -0.44 |
| 2025-12-10 | ADBE | LLM Optimizer | 0/56 | ✅ | 4% | 0.17 | +79 | NO | yes | -0.17 | -0.17 |
| 2025-12-10 | ADBE | Qualcomm | 5/56 | ❌ | 11% | 0.44 | +45 | NO | no | +0.56 | +0.54 |
| 2025-12-10 | ADBE | YouTube | 8/56 | ❌ | 16% | 0.44 | +40 | NO | yes | -0.44 | -0.44 |
| 2025-12-10 | CHWY | SmartEquine | 0/21 | ❌ | 6% | 0.07 | +87 | NO | yes | -0.07 | -0.07 |
| 2025-12-10 | ORCL | Automation | 28/60 | ❌ | 46% | 0.36 | +18 | NO | no | +0.64 | +0.62 |
| 2025-12-10 | ORCL | Backlog | 16/60 | ✅ | 29% | 0.28 | +43 | NO | yes | -0.28 | -0.28 |
| 2025-12-10 | ORCL | Health | 33/60 | ❌ | 54% | 0.31 | +15 | NO | yes | -0.31 | -0.31 |
| 2025-12-10 | ORCL | Stargate | 2/60 | ❌ | 5% | 0.47 | +48 | NO | no | +0.53 | +0.51 |
| 2025-12-10 | ORCL | Tariff | 1/60 | ✅ | 5% | 0.70 | +25 | NO | no | +0.30 | +0.29 |
| 2025-12-11 | AVGO | Acquisition | 37/41 | ❌ | 85% | 0.02 | +83 | YES | no | -0.02 | -0.02 |
| 2025-12-11 | AVGO | Optic | 22/41 | ❌ | 52% | 0.03 | +45 | NO | yes | -0.03 | -0.03 |
| 2025-12-11 | COST | Black Friday | 12/61 | ❌ | 21% | 0.01 | +78 | NO | yes | -0.01 | -0.01 |
| 2025-12-11 | COST | Dividend | 45/61 | ❌ | 71% | 0.06 | +65 | YES | no | -0.06 | -0.06 |
| 2025-12-11 | COST | Expansion | 52/61 | ✅ | 84% | 0.01 | +15 | NO | yes | -0.01 | -0.01 |
| 2025-12-11 | COST | Holiday | 44/61 | ✅ | 71% | 0.01 | +28 | NO | yes | -0.01 | -0.01 |
| 2025-12-11 | COST | Hot Dog | 14/61 | ✅ | 25% | 0.09 | +16 | YES | no | -0.09 | -0.09 |
| 2025-12-11 | COST | Inflation | 54/61 | ✅ | 87% | 0.01 | +12 | NO | yes | -0.01 | -0.01 |
| 2025-12-11 | COST | Inventory | 54/61 | ✅ | 87% | 0.01 | +12 | NO | yes | -0.01 | -0.01 |
| 2025-12-11 | COST | Kirkland | 43/61 | ✅ | 70% | 0.01 | +29 | NO | yes | -0.01 | -0.01 |
| 2025-12-11 | COST | Labor | 44/61 | ✅ | 71% | 0.01 | +28 | NO | yes | -0.01 | -0.01 |
| 2025-12-11 | COST | Revenue | 26/61 | ✅ | 44% | 0.01 | +55 | NO | yes | -0.01 | -0.01 |
| 2025-12-11 | COST | Spending | 38/61 | ✅ | 62% | 0.08 | +54 | YES | no | -0.08 | -0.08 |
| 2025-12-11 | COST | Tariff | 11/61 | ✅ | 21% | 0.01 | +78 | NO | yes | -0.01 | -0.01 |
| 2025-12-18 | FDX | De Minimis | 3/52 | ✅ | 10% | 0.24 | +66 | NO | yes | -0.24 | -0.24 |
| 2025-12-18 | FDX | Dividend | 31/52 | ✅ | 60% | 0.20 | +20 | NO | yes | -0.20 | -0.20 |
| 2025-12-18 | FDX | EV / Electric Vehicle | 6/52 | ❌ | 13% | 0.74 | +13 | NO | no | +0.26 | +0.25 |
| 2025-12-18 | FDX | Inventory | 39/52 | ❌ | 72% | 0.54 | +18 | YES | no | -0.54 | -0.54 |
| 2025-12-18 | FDX | Labor | 26/52 | ✅ | 51% | 0.34 | +17 | YES | no | -0.34 | -0.34 |
| 2025-12-18 | FDX | Smith | 43/52 | ❌ | 79% | 0.26 | +53 | YES | yes | +0.74 | +0.72 |
| 2025-12-18 | FDX | Tariff | 16/52 | ✅ | 33% | 0.49 | +18 | NO | yes | -0.49 | -0.49 |
| 2025-12-18 | MU | Automation | 21/62 | ✅ | 35% | 0.19 | +16 | YES | no | -0.19 | -0.19 |
| 2025-12-18 | MU | Gaming | 27/62 | ❌ | 43% | 0.15 | +28 | YES | no | -0.15 | -0.15 |
| 2025-12-18 | MU | Hyperscaler | 6/62 | ✅ | 13% | 0.61 | +26 | NO | no | +0.39 | +0.38 |
| 2025-12-18 | MU | Layoff | 0/62 | ❌ | 2% | 0.87 | +11 | NO | no | +0.13 | +0.13 |
| 2025-12-18 | MU | New York | 9/62 | ✅ | 17% | 0.61 | +22 | NO | no | +0.39 | +0.38 |
| 2025-12-18 | MU | Nvidia | 18/62 | ❌ | 30% | 0.58 | +12 | NO | no | +0.42 | +0.41 |
| 2025-12-18 | MU | Taiwan | 33/62 | ❌ | 52% | 0.38 | +14 | YES | no | -0.38 | -0.38 |
| 2025-12-18 | MU | Tariff | 12/62 | ✅ | 22% | 0.37 | +41 | NO | no | +0.63 | +0.61 |
| 2025-12-18 | NKE | Amazon | 9/61 | ✅ | 17% | 0.48 | +35 | NO | no | +0.52 | +0.50 |
| 2025-12-18 | NKE | Black Friday | 7/61 | ❌ | 13% | 0.09 | +78 | NO | yes | -0.09 | -0.09 |
| 2025-12-18 | NKE | Consumer Demand | 43/61 | ✅ | 70% | 0.24 | +46 | YES | no | -0.24 | -0.24 |
| 2025-12-18 | NKE | Direct to Consumer / DTC | 36/61 | ❌ | 58% | 0.16 | +42 | YES | no | -0.16 | -0.16 |
| 2025-12-18 | NKE | Dividend | 18/61 | ✅ | 31% | 0.39 | +30 | NO | no | +0.61 | +0.59 |
| 2025-12-18 | NKE | Express Lane | 30/61 | ✅ | 50% | 0.23 | +27 | NO | no | +0.77 | +0.75 |
| 2025-12-18 | NKE | Nike Factory | 10/61 | ✅ | 19% | 0.24 | +57 | NO | no | +0.76 | +0.74 |
| 2025-12-18 | NKE | Retailer | 34/61 | ❌ | 55% | 0.40 | +15 | YES | no | -0.40 | -0.40 |
| 2025-12-18 | NKE | Sabrina | 10/61 | ✅ | 19% | 0.29 | +52 | NO | yes | -0.29 | -0.29 |
| 2025-12-18 | NKE | Tariff | 7/61 | ✅ | 14% | 0.08 | +78 | NO | yes | -0.08 | -0.08 |
| 2026-01-07 | ACI | AI / Artificial Intelligence | 5/12 | ❌ | 40% | 0.06 | +54 | NO | yes | -0.06 | -0.06 |
| 2026-01-07 | ACI | Dividend | 12/12 | ❌ | 83% | 0.72 | +11 | YES | yes | +0.28 | +0.27 |
| 2026-01-07 | ACI | GLP-1 | 3/12 | ❌ | 28% | 0.13 | +59 | NO | yes | -0.13 | -0.13 |
| 2026-01-07 | ACI | Personalization | 1/12 | ❌ | 16% | 0.35 | +49 | NO | yes | -0.35 | -0.35 |
| 2026-01-07 | ACI | Produce | 7/12 | ❌ | 52% | 0.37 | +11 | NO | no | +0.63 | +0.61 |
| 2026-01-07 | ACI | Tariff | 2/12 | ❌ | 22% | 0.55 | +23 | NO | no | +0.45 | +0.44 |
| 2026-01-07 | ACI | Uber | 0/12 | ❌ | 10% | 0.39 | +51 | NO | yes | -0.39 | -0.39 |
| 2026-01-08 | STZ | Depletion / Depletions | 41/41 | ✅ | 96% | 0.81 | +15 | YES | yes | +0.19 | +0.18 |
| 2026-01-08 | STZ | Dividend | 36/41 | ❌ | 83% | 0.48 | +35 | YES | no | -0.48 | -0.48 |
| 2026-01-08 | STZ | Holiday | 33/41 | ❌ | 77% | 0.31 | +46 | YES | yes | +0.69 | +0.67 |
| 2026-01-08 | STZ | Inventory | 36/41 | ✅ | 85% | 0.71 | +14 | YES | yes | +0.29 | +0.28 |
| 2026-01-13 | JPM | Crypto / Bitcoin | 0/42 | ❌ | 3% | 0.86 | +11 | NO | yes | -0.86 | -0.86 |
| 2026-01-13 | JPM | Geopolitical | 9/42 | ❌ | 23% | 0.42 | +35 | NO | yes | -0.42 | -0.42 |
| 2026-01-13 | JPM | Tariff | 3/42 | ✅ | 12% | 0.34 | +54 | NO | no | +0.66 | +0.64 |
| 2026-01-14 | BAC | M&A | 23/61 | ✅ | 39% | 0.48 | +13 | NO | no | +0.52 | +0.50 |
| 2026-01-14 | WFC | AI / Artificial Intelligence | 7/26 | ✅ | 31% | 0.01 | +68 | NO | yes | -0.01 | -0.01 |
| 2026-01-14 | WFC | Buyback | 20/26 | ✅ | 74% | 0.01 | +73 | YES | no | -0.01 | -0.01 |
| 2026-01-14 | WFC | Delinquency | 5/26 | ❌ | 22% | 0.01 | +77 | NO | yes | -0.01 | -0.01 |
| 2026-01-14 | WFC | Inflation | 15/26 | ✅ | 58% | 0.01 | +41 | NO | yes | -0.01 | -0.01 |
| 2026-01-14 | WFC | Middle Market | 23/26 | ✅ | 84% | 0.01 | +15 | NO | yes | -0.01 | -0.01 |
| 2026-01-14 | WFC | Private Equity | 17/26 | ✅ | 64% | 0.01 | +35 | NO | yes | -0.01 | -0.01 |
| 2026-01-14 | WFC | Recession | 5/26 | ❌ | 22% | 0.01 | +21 | YES | no | -0.01 | -0.01 |
| 2026-01-14 | WFC | Tariff | 2/26 | ✅ | 15% | 0.01 | +14 | YES | no | -0.01 | -0.01 |
| 2026-01-15 | BLK | Crypto / Bitcoin | 8/21 | ❌ | 38% | 0.22 | +40 | NO | no | +0.78 | +0.76 |
| 2026-01-15 | BLK | Digital Asset | 9/21 | ❌ | 42% | 0.01 | +57 | NO | yes | -0.01 | -0.01 |
| 2026-01-15 | BLK | ETF Inflow | 2/21 | ❌ | 14% | 0.73 | +13 | NO | no | +0.27 | +0.26 |
| 2026-01-15 | BLK | Record AUM | 6/21 | ❌ | 30% | 0.22 | +48 | NO | no | +0.78 | +0.76 |
| 2026-01-15 | GS | Buyback | 18/26 | ❌ | 65% | 0.51 | +14 | YES | yes | +0.49 | +0.48 |
| 2026-01-15 | GS | Charge Off / Charge-Off | 21/26 | ✅ | 78% | 0.07 | +15 | NO | yes | -0.07 | -0.07 |
| 2026-01-15 | GS | Inflation | 19/26 | ❌ | 68% | 0.52 | +16 | YES | yes | +0.48 | +0.47 |
| 2026-01-15 | GS | Marcus | 18/26 | ❌ | 65% | 0.18 | +47 | YES | yes | +0.82 | +0.80 |
| 2026-01-15 | GS | Recession | 7/26 | ❌ | 28% | 0.16 | +12 | YES | no | -0.16 | -0.16 |
| 2026-01-15 | GS | Tariff | 2/26 | ❌ | 12% | 0.70 | +18 | NO | no | +0.30 | +0.29 |
| 2026-01-15 | GS | Trading | 25/26 | ✅ | 91% | 0.77 | +14 | YES | yes | +0.23 | +0.22 |
| 2026-01-20 | NFLX | Acquisition | 44/61 | ✅ | 71% | 0.08 | +21 | NO | yes | -0.08 | -0.08 |
| 2026-01-20 | NFLX | Ad-Supported | 14/61 | ❌ | 24% | 0.63 | +13 | NO | yes | -0.63 | -0.63 |
| 2026-01-20 | NFLX | Gaming | 19/61 | ✅ | 33% | 0.31 | +36 | NO | yes | -0.31 | -0.31 |
| 2026-01-20 | NFLX | Hollywood | 20/61 | ✅ | 34% | 0.34 | +32 | NO | no | +0.66 | +0.64 |
| 2026-01-20 | NFLX | Jake Paul | 3/61 | ✅ | 8% | 0.45 | +47 | NO | yes | -0.45 | -0.45 |
| 2026-01-20 | NFLX | Live Event | 11/61 | ✅ | 21% | 0.06 | +73 | NO | yes | -0.06 | -0.06 |
| 2026-01-20 | NFLX | Paramount | 7/61 | ✅ | 14% | 0.30 | +56 | NO | yes | -0.30 | -0.30 |
| 2026-01-20 | NFLX | Partnership | 35/61 | ✅ | 57% | 0.23 | +20 | NO | yes | -0.23 | -0.23 |
| 2026-01-20 | NFLX | Profitable | 30/61 | ✅ | 50% | 0.24 | +26 | NO | no | +0.76 | +0.74 |
| 2026-01-20 | NFLX | Stranger Things | 23/61 | ✅ | 39% | 0.05 | +56 | NO | yes | -0.05 | -0.05 |
| 2026-01-20 | NFLX | Subscriber | 56/61 | ❌ | 88% | 0.61 | +27 | YES | no | -0.61 | -0.61 |
| 2026-01-20 | NFLX | Warner Bros | 5/61 | ❌ | 10% | 0.30 | +60 | NO | no | +0.70 | +0.68 |
| 2026-01-21 | JNJ | Trufill | 0/42 | ❌ | 3% | 0.49 | +48 | NO | no | +0.51 | +0.49 |
| 2026-01-21 | UAL | ATC / Air Traffic Control | 9/22 | ✅ | 44% | 0.37 | +19 | NO | yes | -0.37 | -0.37 |
| 2026-01-21 | UAL | JetBlue | 4/22 | ❌ | 21% | 0.48 | +31 | NO | no | +0.52 | +0.50 |
| 2026-01-21 | UAL | Nonstop / Non-Stop | 10/22 | ❌ | 44% | 0.29 | +15 | YES | no | -0.29 | -0.29 |
| 2026-01-21 | UAL | Shutdown / Shut Down | 5/22 | ✅ | 28% | 0.22 | +50 | NO | yes | -0.22 | -0.22 |
| 2026-01-22 | INTC | Arizona | 15/61 | ✅ | 27% | 0.17 | +56 | NO | yes | -0.17 | -0.17 |
| 2026-01-22 | INTC | Nvidia | 6/61 | ✅ | 13% | 0.09 | +78 | NO | yes | -0.09 | -0.09 |
| 2026-01-22 | INTC | Panther Lake | 8/61 | ✅ | 16% | 0.11 | +73 | NO | yes | -0.11 | -0.11 |
| 2026-01-22 | INTC | Security | 33/61 | ✅ | 54% | 0.21 | +25 | NO | yes | -0.21 | -0.21 |
| 2026-01-22 | INTC | Tariff | 6/61 | ❌ | 12% | 0.44 | +44 | NO | yes | -0.44 | -0.44 |
| 2026-01-22 | INTC | Trump | 1/61 | ✅ | 5% | 0.37 | +58 | NO | no | +0.63 | +0.61 |
| 2026-01-22 | INTC | Ultra 3 / Ultra Series 3 | 0/61 | ❌ | 2% | 0.16 | +82 | NO | yes | -0.16 | -0.16 |
| 2026-01-22 | INTC | Xeon | 48/61 | ✅ | 77% | 0.10 | +13 | NO | yes | -0.10 | -0.10 |
| 2026-01-22 | PG | Advertising | 34/44 | ❌ | 74% | 0.62 | +12 | YES | yes | +0.38 | +0.37 |
| 2026-01-22 | PG | Beauty | 38/44 | ❌ | 82% | 0.59 | +23 | YES | yes | +0.41 | +0.40 |
| 2026-01-22 | PG | Revenue | 21/44 | ❌ | 47% | 0.25 | +22 | YES | no | -0.25 | -0.25 |
| 2026-01-22 | PG | Tariff | 8/44 | ✅ | 22% | 0.02 | +76 | NO | yes | -0.02 | -0.02 |
| 2026-01-27 | AAL | ATC | 4/22 | ❌ | 21% | 0.52 | +27 | NO | no | +0.48 | +0.47 |
| 2026-01-27 | AAL | Centennial | 0/22 | ❌ | 6% | 0.30 | +64 | NO | yes | -0.30 | -0.30 |
| 2026-01-27 | AAL | Chicago / O’Hare | 15/22 | ✅ | 67% | 0.05 | +28 | NO | yes | -0.05 | -0.05 |
| 2026-01-27 | AAL | Shutdown / Shut Down | 3/22 | ✅ | 21% | 0.10 | +69 | NO | yes | -0.10 | -0.10 |
| 2026-01-27 | AAL | Weather | 10/22 | ❌ | 44% | 0.33 | +23 | NO | yes | -0.33 | -0.33 |
| 2026-01-28 | META | Algorithm | 12/53 | ❌ | 24% | 0.65 | +11 | NO | yes | -0.65 | -0.65 |
| 2026-01-28 | META | Hyperion | 1/53 | ❌ | 4% | 0.67 | +29 | NO | no | +0.33 | +0.32 |
| 2026-01-28 | META | Llama | 10/53 | ✅ | 22% | 0.17 | +61 | NO | no | +0.83 | +0.81 |
| 2026-01-28 | META | Oakley | 2/53 | ✅ | 8% | 0.08 | +84 | NO | no | +0.92 | +0.89 |
| 2026-01-28 | META | SAM | 1/53 | ❌ | 4% | 0.48 | +48 | NO | no | +0.52 | +0.50 |
| 2026-01-28 | META | Thread / Threads | 24/53 | ✅ | 46% | 0.02 | +52 | NO | yes | -0.02 | -0.02 |
| 2026-01-28 | MSFT | College | 1/61 | ❌ | 4% | 0.82 | +14 | NO | no | +0.18 | +0.17 |
| 2026-01-28 | MSFT | LinkedIn | 38/61 | ✅ | 62% | 0.02 | +36 | NO | yes | -0.02 | -0.02 |
| 2026-01-28 | MSFT | R&D / Research and Development | 21/61 | ✅ | 36% | 0.51 | +13 | NO | yes | -0.51 | -0.51 |
| 2026-01-28 | MSFT | Teams | 44/61 | ✅ | 71% | 0.03 | +26 | NO | yes | -0.03 | -0.03 |
| 2026-01-28 | SBUX | Comparable Sales | 12/43 | ❌ | 29% | 0.60 | +11 | NO | no | +0.40 | +0.39 |
| 2026-01-28 | SBUX | Loyalty | 36/43 | ❌ | 80% | 0.57 | +23 | YES | no | -0.57 | -0.57 |
| 2026-01-28 | SBUX | Promotion | 25/43 | ✅ | 58% | 0.16 | +26 | NO | no | +0.84 | +0.81 |
| 2026-01-28 | TSLA | Competition | 11/60 | ✅ | 21% | 0.34 | +45 | NO | yes | -0.34 | -0.34 |
| 2026-01-28 | TSLA | Cybertruck | 22/60 | ❌ | 37% | 0.36 | +27 | NO | yes | -0.36 | -0.36 |
| 2026-01-28 | TSLA | Delivery | 46/60 | ✅ | 76% | 0.13 | +11 | NO | yes | -0.13 | -0.13 |
| 2026-01-28 | TSLA | FSD / Full Self Driving | 25/60 | ✅ | 43% | 0.01 | +56 | NO | yes | -0.01 | -0.01 |
| 2026-01-28 | TSLA | Grok 5 | 0/60 | ✅ | 4% | 0.72 | +24 | NO | no | +0.28 | +0.27 |
| 2026-01-28 | TSLA | Regulator / Regulatory / Regulation | 46/60 | ✅ | 76% | 0.07 | +17 | NO | yes | -0.07 | -0.07 |
| 2026-01-28 | TSLA | Tariff | 11/60 | ✅ | 21% | 0.24 | +55 | NO | yes | -0.24 | -0.24 |
| 2026-01-28 | TSLA | Robotaxi | 19/60 | ✅ | 33% | 0.01 | +66 | NO | yes | -0.01 | -0.01 |
| 2026-01-29 | AAPL | Apple Pay | 35/58 | ✅ | 60% | 0.19 | +21 | NO | yes | -0.19 | -0.19 |
| 2026-01-29 | AAPL | Creator Studio | 0/58 | ❌ | 2% | 0.49 | +49 | NO | yes | -0.49 | -0.49 |
| 2026-01-29 | AAPL | Formula 1 / F1 | 3/58 | ✅ | 9% | 0.24 | +67 | NO | yes | -0.24 | -0.24 |
| 2026-01-29 | AAPL | Fold / Folding / Foldable | 1/58 | ✅ | 5% | 0.68 | +27 | NO | no | +0.32 | +0.31 |
| 2026-01-29 | AAPL | Gemini | 0/58 | ❌ | 2% | 0.22 | +76 | NO | no | +0.78 | +0.76 |
| 2026-01-29 | AAPL | Liquid Glass | 1/58 | ✅ | 5% | 0.48 | +47 | NO | no | +0.52 | +0.50 |
| 2026-01-29 | AAPL | M3 | 5/58 | ❌ | 10% | 0.73 | +17 | NO | no | +0.27 | +0.26 |
| 2026-01-29 | AAPL | Manufacturing | 34/58 | ✅ | 59% | 0.13 | +28 | NO | yes | -0.13 | -0.13 |
| 2026-01-29 | AAPL | Severance | 8/58 | ✅ | 17% | 0.37 | +46 | NO | no | +0.63 | +0.61 |
| 2026-01-29 | AAPL | Siri | 30/58 | ✅ | 52% | 0.14 | +34 | NO | yes | -0.14 | -0.14 |
| 2026-01-29 | AAPL | Streaming | 18/58 | ❌ | 31% | 0.51 | +18 | NO | no | +0.49 | +0.48 |
| 2026-01-29 | AAPL | Wearable | 35/58 | ✅ | 60% | 0.04 | +36 | NO | yes | -0.04 | -0.04 |
| 2026-01-29 | AAPL | Widget | 2/58 | ❌ | 6% | 0.74 | +20 | NO | no | +0.26 | +0.25 |
| 2026-01-29 | V | Blockchain | 10/62 | ✅ | 19% | 0.14 | +67 | NO | yes | -0.14 | -0.14 |
| 2026-01-29 | V | Holiday | 21/62 | ✅ | 35% | 0.16 | +49 | NO | yes | -0.16 | -0.16 |
| 2026-01-29 | V | Loyalty | 20/62 | ❌ | 33% | 0.45 | +22 | NO | no | +0.55 | +0.53 |
| 2026-01-29 | V | Mercuryo | 0/62 | ❌ | 2% | 0.21 | +77 | NO | no | +0.79 | +0.77 |
| 2026-01-29 | V | Rate Cap / 10% Cap | 0/62 | ❌ | 2% | 0.73 | +25 | NO | no | +0.27 | +0.26 |
| 2026-01-29 | V | Regulation / Regulatory | 43/62 | ✅ | 69% | 0.21 | +10 | NO | no | +0.79 | +0.77 |
| 2026-01-29 | V | Trump | 1/62 | ❌ | 4% | 0.59 | +37 | NO | no | +0.41 | +0.40 |
| 2026-01-30 | AXP | Millennial | 25/56 | ✅ | 46% | 0.17 | +37 | NO | yes | -0.17 | -0.17 |
| 2026-01-30 | AXP | Rate Cap / 10% Cap | 0/56 | ❌ | 3% | 0.79 | +18 | NO | no | +0.21 | +0.20 |
| 2026-01-30 | AXP | Stablecoin | 2/56 | ❌ | 6% | 0.15 | +79 | NO | no | +0.85 | +0.82 |
| 2026-01-30 | VZ | Outage | 0/26 | ❌ | 5% | 0.62 | +33 | NO | yes | -0.62 | -0.62 |
| 2026-01-30 | VZ | Satellite | 8/26 | ❌ | 32% | 0.58 | +10 | NO | no | +0.42 | +0.41 |
| 2026-01-30 | VZ | Spectrum | 26/26 | ✅ | 94% | 0.81 | +13 | YES | no | -0.81 | -0.81 |
| 2026-01-30 | VZ | Starry | 0/26 | ✅ | 8% | 0.44 | +48 | NO | yes | -0.44 | -0.44 |
| 2026-01-30 | VZ | Tariff | 1/26 | ❌ | 8% | 0.79 | +13 | NO | no | +0.21 | +0.20 |
| 2026-02-02 | DIS | Competition | 29/62 | ✅ | 48% | 0.06 | +46 | NO | yes | -0.06 | -0.06 |
| 2026-02-02 | DIS | DraftKings | 1/62 | ❌ | 4% | 0.77 | +19 | NO | no | +0.23 | +0.22 |
| 2026-02-02 | DIS | YouTube TV | 1/62 | ✅ | 5% | 0.82 | +13 | NO | no | +0.18 | +0.17 |
| 2026-02-02 | PLTR | Commercial Growth | 2/20 | ✅ | 18% | 0.62 | +20 | NO | no | +0.38 | +0.37 |
| 2026-02-02 | PLTR | Lethal | 5/20 | ✅ | 31% | 0.11 | +58 | NO | yes | -0.11 | -0.11 |
| 2026-02-02 | PLTR | Nvidia | 0/20 | ❌ | 6% | 0.47 | +47 | NO | no | +0.53 | +0.51 |
| 2026-02-02 | PLTR | Partnership | 17/20 | ✅ | 80% | 0.07 | +13 | NO | no | +0.93 | +0.90 |
| 2026-02-02 | PLTR | Revenue guidance | 14/20 | ✅ | 68% | 0.28 | +40 | YES | no | -0.28 | -0.28 |
| 2026-02-02 | PLTR | Warp Speed | 0/20 | ❌ | 6% | 0.10 | +84 | NO | yes | -0.10 | -0.10 |
| 2026-02-03 | CMG | Honey Chicken | 4/62 | ❌ | 8% | 0.46 | +46 | NO | no | +0.54 | +0.52 |
| 2026-02-03 | CMG | Inflation | 55/62 | ✅ | 87% | 0.03 | +10 | NO | yes | -0.03 | -0.03 |
| 2026-02-03 | CMG | Promotion | 49/62 | ✅ | 78% | 0.10 | +12 | NO | yes | -0.10 | -0.10 |
| 2026-02-03 | CMG | Share Purchase | 3/62 | ✅ | 8% | 0.46 | +46 | NO | yes | -0.46 | -0.46 |
| 2026-02-03 | PEP | Acquisition | 13/26 | ✅ | 51% | 0.23 | +26 | NO | yes | -0.23 | -0.23 |
| 2026-02-03 | PEP | Artificial Color | 2/26 | ❌ | 12% | 0.54 | +34 | NO | no | +0.46 | +0.45 |
| 2026-02-03 | PEP | Away from Home | 15/26 | ✅ | 58% | 0.20 | +22 | NO | yes | -0.20 | -0.20 |
| 2026-02-03 | PEP | Celsius | 9/26 | ❌ | 35% | 0.44 | +21 | NO | yes | -0.44 | -0.44 |
| 2026-02-03 | PEP | China | 17/26 | ✅ | 64% | 0.15 | +21 | NO | yes | -0.15 | -0.15 |
| 2026-02-03 | PEP | Food for Tomorrow | 0/26 | ❌ | 5% | 0.75 | +20 | NO | no | +0.25 | +0.24 |
| 2026-02-03 | PEP | GLP-1 | 3/26 | ✅ | 18% | 0.65 | +17 | NO | yes | -0.65 | -0.65 |
| 2026-02-03 | PEP | Healthy | 20/26 | ❌ | 71% | 0.50 | +21 | YES | no | -0.50 | -0.50 |
| 2026-02-03 | PEP | Nvidia | 0/26 | ❌ | 5% | 0.56 | +39 | NO | no | +0.44 | +0.43 |
| 2026-02-03 | PEP | Prebiotic | 0/26 | ✅ | 8% | 0.75 | +17 | NO | no | +0.25 | +0.24 |
| 2026-02-03 | PYPL | Biometric | 5/40 | ✅ | 17% | 0.27 | +56 | NO | yes | -0.27 | -0.27 |
| 2026-02-03 | PYPL | Bitcoin | 2/40 | ❌ | 8% | 0.81 | +11 | NO | no | +0.19 | +0.18 |
| 2026-02-03 | PYPL | Blue Owl | 0/40 | ✅ | 5% | 0.40 | +55 | NO | no | +0.60 | +0.58 |
| 2026-02-03 | PYPL | Regulation / Regulator / Regulatory | 22/40 | ❌ | 53% | 0.24 | +29 | YES | no | -0.24 | -0.24 |
| 2026-02-03 | PYPL | Stablecoin / Stable Coin | 4/40 | ✅ | 15% | 0.29 | +56 | NO | no | +0.71 | +0.69 |
| 2026-02-04 | GOOGL | Autonomous | 23/59 | ✅ | 40% | 0.35 | +25 | NO | yes | -0.35 | -0.35 |
| 2026-02-04 | GOOGL | Nano Banana | 0/59 | ✅ | 4% | 0.32 | +64 | NO | yes | -0.32 | -0.32 |
| 2026-02-04 | GOOGL | Quantum | 5/59 | ✅ | 12% | 0.40 | +48 | NO | no | +0.60 | +0.58 |
| 2026-02-04 | GOOGL | Search Advertising / Search Ad | 39/59 | ✅ | 66% | 0.55 | +11 | YES | yes | +0.45 | +0.44 |
| 2026-02-04 | GOOGL | Youtube Shorts | 17/59 | ✅ | 31% | 0.23 | +46 | NO | no | +0.77 | +0.75 |
| 2026-02-04 | SNAP | Family Center | 1/18 | ❌ | 11% | 0.63 | +26 | NO | no | +0.37 | +0.36 |
| 2026-02-04 | SNAP | Platinum | 0/18 | ✅ | 11% | 0.41 | +48 | NO | no | +0.59 | +0.57 |
| 2026-02-04 | UBER | Avride | 2/26 | ❌ | 12% | 0.56 | +32 | NO | yes | -0.56 | -0.56 |
| 2026-02-04 | UBER | Driver Incentives | 10/26 | ❌ | 38% | 0.19 | +19 | YES | no | -0.19 | -0.19 |
| 2026-02-04 | UBER | Lucid | 1/26 | ❌ | 8% | 0.28 | +64 | NO | yes | -0.28 | -0.28 |
| 2026-02-04 | UBER | Market Share | 11/26 | ❌ | 42% | 0.15 | +27 | YES | no | -0.15 | -0.15 |
| 2026-02-04 | UBER | Regulator / Regulatory / Regulation | 20/26 | ❌ | 71% | 0.36 | +35 | YES | yes | +0.64 | +0.62 |
| 2026-02-05 | AMZN | China | 26/61 | ❌ | 42% | 0.39 | +19 | NO | no | +0.61 | +0.59 |
| 2026-02-05 | AMZN | Drone | 4/61 | ❌ | 8% | 0.76 | +16 | NO | no | +0.24 | +0.23 |
| 2026-02-05 | AMZN | OpenAI | 1/61 | ❌ | 4% | 0.50 | +46 | NO | yes | -0.50 | -0.50 |
| 2026-02-05 | AMZN | Prime Day | 29/61 | ✅ | 48% | 0.35 | +17 | NO | no | +0.65 | +0.63 |
| 2026-02-05 | AMZN | Project Kuiper | 6/61 | ✅ | 13% | 0.39 | +48 | NO | no | +0.61 | +0.59 |
| 2026-02-05 | AMZN | Rufus | 4/61 | ✅ | 10% | 0.20 | +70 | NO | yes | -0.20 | -0.20 |
| 2026-02-05 | AMZN | Silicon | 9/61 | ✅ | 17% | 0.10 | +73 | NO | yes | -0.10 | -0.10 |
| 2026-02-05 | AMZN | Sponsored Products | 14/61 | ✅ | 25% | 0.17 | +58 | NO | yes | -0.17 | -0.17 |
| 2026-02-05 | AMZN | Supply Chain | 16/61 | ❌ | 27% | 0.43 | +30 | NO | no | +0.57 | +0.55 |
| 2026-02-05 | AMZN | Tariff | 2/61 | ✅ | 7% | 0.13 | +80 | NO | yes | -0.13 | -0.13 |
| 2026-02-05 | AMZN | Third Party Sellers | 1/61 | ❌ | 4% | 0.24 | +72 | NO | yes | -0.24 | -0.24 |
| 2026-02-05 | RDDT | Emplifi | 0/6 | ❌ | 15% | 0.43 | +42 | NO | no | +0.57 | +0.55 |
| 2026-02-09 | ON | EV / Electric Vehicle | 35/42 | ✅ | 81% | 0.03 | +16 | NO | yes | -0.03 | -0.03 |
| 2026-02-09 | ON | Nvidia | 5/42 | ✅ | 16% | 0.42 | +42 | NO | no | +0.58 | +0.56 |
| 2026-02-10 | HOOD | Acquisition | 11/17 | ✅ | 64% | 0.12 | +24 | NO | yes | -0.12 | -0.12 |
| 2026-02-10 | HOOD | Bitcoin | 4/17 | ✅ | 31% | 0.39 | +30 | NO | yes | -0.39 | -0.39 |
| 2026-02-10 | HOOD | Blockchain | 2/17 | ✅ | 21% | 0.42 | +37 | NO | yes | -0.42 | -0.42 |
| 2026-02-10 | HOOD | Indonesia | 0/17 | ❌ | 7% | 0.48 | +45 | NO | no | +0.52 | +0.50 |
| 2026-02-10 | HOOD | International | 13/17 | ✅ | 73% | 0.09 | +18 | NO | yes | -0.09 | -0.09 |
| 2026-02-10 | HOOD | Perp / Perpetual | 1/17 | ❌ | 12% | 0.60 | +28 | NO | yes | -0.60 | -0.60 |
| 2026-02-10 | HOOD | Prediction Market | 3/17 | ✅ | 26% | 0.05 | +69 | NO | yes | -0.05 | -0.05 |
| 2026-02-10 | HOOD | SIG / Susquehanna | 0/17 | ❌ | 7% | 0.41 | +52 | NO | yes | -0.41 | -0.41 |
| 2026-02-10 | HOOD | Social | 5/17 | ✅ | 35% | 0.20 | +45 | NO | yes | -0.20 | -0.20 |
| 2026-02-10 | KO | Acquisition | 28/42 | ❌ | 64% | 0.36 | +28 | YES | yes | +0.64 | +0.62 |
| 2026-02-10 | KO | Cane Sugar | 1/42 | ❌ | 5% | 0.49 | +46 | NO | no | +0.51 | +0.49 |
| 2026-02-10 | KO | Influencer | 6/42 | ❌ | 16% | 0.72 | +12 | NO | no | +0.28 | +0.27 |
| 2026-02-10 | KO | International | 12/42 | ✅ | 31% | 0.37 | +32 | NO | no | +0.63 | +0.61 |
| 2026-02-10 | KO | Prebiotic | 2/42 | ❌ | 8% | 0.75 | +17 | NO | no | +0.25 | +0.24 |
| 2026-02-10 | KO | Retro | 0/42 | ✅ | 5% | 0.70 | +25 | NO | no | +0.30 | +0.29 |
| 2026-02-10 | KO | Tariff | 3/42 | ❌ | 10% | 0.67 | +23 | NO | no | +0.33 | +0.32 |
| 2026-02-10 | LYFT | Expansion | 14/26 | ❌ | 51% | 0.19 | +30 | NO | yes | -0.19 | -0.19 |
| 2026-02-10 | LYFT | FreeNow / Free Now | 2/26 | ✅ | 15% | 0.16 | +69 | NO | yes | -0.16 | -0.16 |
| 2026-02-10 | LYFT | International | 6/26 | ✅ | 28% | 0.38 | +34 | NO | no | +0.62 | +0.60 |
| 2026-02-10 | LYFT | Membership | 11/26 | ❌ | 42% | 0.23 | +19 | YES | no | -0.23 | -0.23 |
| 2026-02-10 | LYFT | Revenue | 26/26 | ✅ | 94% | 0.83 | +11 | YES | yes | +0.17 | +0.16 |
| 2026-02-10 | LYFT | Waymo | 8/26 | ✅ | 35% | 0.10 | +55 | NO | yes | -0.10 | -0.10 |
| 2026-02-10 | SPOT | Apple TV | 1/30 | ✅ | 10% | 0.67 | +23 | NO | no | +0.33 | +0.32 |
| 2026-02-10 | SPOT | Bookshop / Bookshop.org | 0/30 | ❌ | 4% | 0.35 | +61 | NO | yes | -0.35 | -0.35 |
| 2026-02-10 | SPOT | ChatGPT | 0/30 | ✅ | 7% | 0.66 | +27 | NO | no | +0.34 | +0.33 |
| 2026-02-10 | SPOT | Message | 7/30 | ✅ | 28% | 0.55 | +17 | NO | no | +0.45 | +0.44 |
| 2026-02-10 | SPOT | Meta | 0/30 | ✅ | 7% | 0.67 | +26 | NO | no | +0.33 | +0.32 |
| 2026-02-10 | SPOT | Monetization | 23/30 | ✅ | 74% | 0.05 | +20 | NO | yes | -0.05 | -0.05 |
| 2026-02-10 | SPOT | Netflix | 7/30 | ✅ | 28% | 0.34 | +38 | NO | no | +0.66 | +0.64 |
| 2026-02-10 | SPOT | Wrapped | 8/30 | ✅ | 31% | 0.14 | +55 | NO | yes | -0.14 | -0.14 |
| 2026-02-11 | HLT | AI / Artificial Intelligence | 2/26 | ✅ | 15% | 0.11 | +74 | NO | yes | -0.11 | -0.11 |
| 2026-02-11 | HLT | Honor / Honors | 24/26 | ✅ | 88% | 0.76 | +12 | YES | yes | +0.24 | +0.23 |
| 2026-02-11 | HLT | LivSmart | 4/26 | ❌ | 18% | 0.68 | +14 | NO | no | +0.32 | +0.31 |
| 2026-02-11 | HLT | Minnesota / Minneapolis | 0/26 | ❌ | 5% | 0.65 | +30 | NO | no | +0.35 | +0.34 |
| 2026-02-11 | HLT | Spark | 11/26 | ✅ | 45% | 0.13 | +42 | NO | no | +0.87 | +0.84 |
| 2026-02-11 | HLT | Tariff | 3/26 | ✅ | 18% | 0.37 | +45 | NO | no | +0.63 | +0.61 |
| 2026-02-11 | HLT | World Cup | 3/26 | ✅ | 18% | 0.67 | +15 | NO | yes | -0.67 | -0.67 |
| 2026-02-11 | MCD | Buffalo | 0/61 | ❌ | 2% | 0.71 | +27 | NO | no | +0.29 | +0.28 |
| 2026-02-11 | MCD | Caviar | 0/61 | ❌ | 2% | 0.64 | +34 | NO | no | +0.36 | +0.35 |
| 2026-02-11 | MCD | Dividend | 40/61 | ✅ | 65% | 0.07 | +28 | NO | yes | -0.07 | -0.07 |
| 2026-02-11 | MCD | DoorDash | 5/61 | ❌ | 10% | 0.78 | +12 | NO | no | +0.22 | +0.21 |
| 2026-02-11 | MCD | Grinch | 2/61 | ❌ | 5% | 0.37 | +58 | NO | yes | -0.37 | -0.37 |
| 2026-02-11 | MCD | Happy Meal | 16/61 | ✅ | 28% | 0.33 | +39 | NO | no | +0.67 | +0.65 |
| 2026-02-11 | MCD | Loyalty | 34/61 | ✅ | 56% | 0.15 | +29 | NO | yes | -0.15 | -0.15 |
| 2026-02-11 | MCD | McCrispy Chicken | 9/61 | ❌ | 16% | 0.71 | +13 | NO | no | +0.29 | +0.28 |
| 2026-02-11 | MCD | Monopoly | 15/61 | ✅ | 27% | 0.23 | +50 | NO | yes | -0.23 | -0.23 |
| 2026-02-11 | MCD | Revenue | 29/61 | ❌ | 47% | 0.25 | +22 | YES | yes | +0.75 | +0.73 |
| 2026-02-11 | MCD | Tariff | 3/61 | ✅ | 8% | 0.25 | +67 | NO | no | +0.75 | +0.73 |
| 2026-02-11 | SHOP | Black Friday | 23/41 | ❌ | 54% | 0.08 | +38 | NO | no | +0.92 | +0.89 |
| 2026-02-11 | SHOP | Klarna | 3/41 | ✅ | 12% | 0.69 | +19 | NO | no | +0.31 | +0.30 |
| 2026-02-11 | SHOP | OpenAI | 3/41 | ✅ | 12% | 0.26 | +62 | NO | yes | -0.26 | -0.26 |
| 2026-02-11 | SHOP | Shop Pay | 24/41 | ❌ | 57% | 0.13 | +30 | NO | yes | -0.13 | -0.13 |
| 2026-02-11 | SHOP | Tariff | 4/41 | ✅ | 14% | 0.15 | +71 | NO | yes | -0.15 | -0.15 |
| 2026-02-12 | ABNB | Acquisition | 9/19 | ❌ | 45% | 0.35 | +10 | YES | no | -0.35 | -0.35 |
| 2026-02-12 | ABNB | Boutique | 4/19 | ✅ | 28% | 0.35 | +37 | NO | yes | -0.35 | -0.35 |
| 2026-02-12 | ABNB | China | 11/19 | ❌ | 54% | 0.32 | +22 | YES | no | -0.32 | -0.32 |
| 2026-02-12 | ABNB | Domestic | 13/19 | ✅ | 67% | 0.22 | +11 | NO | yes | -0.22 | -0.22 |
| 2026-02-12 | ABNB | Home Sharing | 3/19 | ❌ | 20% | 0.70 | +10 | NO | no | +0.30 | +0.29 |
| 2026-02-12 | ABNB | Service Agent | 6/19 | ✅ | 37% | 0.20 | +43 | NO | yes | -0.20 | -0.20 |
| 2026-02-12 | ABNB | Social Media | 9/19 | ✅ | 49% | 0.17 | +34 | NO | no | +0.83 | +0.81 |
| 2026-02-12 | NBIS | Aether | 0/8 | ✅ | 21% | 0.32 | +47 | NO | yes | -0.32 | -0.32 |
| 2026-02-12 | NBIS | ClickHouse / Click House | 5/8 | ❌ | 53% | 0.29 | +18 | NO | yes | -0.29 | -0.29 |
| 2026-02-12 | NBIS | Hyperscaler | 4/8 | ❌ | 45% | 0.45 | +10 | NO | yes | -0.45 | -0.45 |
| 2026-02-12 | NBIS | Meta | 1/8 | ✅ | 29% | 0.20 | +51 | NO | yes | -0.20 | -0.20 |
| 2026-02-12 | NBIS | Neocloud | 1/8 | ✅ | 29% | 0.60 | +11 | NO | no | +0.40 | +0.39 |
| 2026-02-12 | NBIS | Nvidia | 4/8 | ✅ | 53% | 0.07 | +40 | NO | no | +0.93 | +0.90 |
| 2026-02-12 | NBIS | Robotics | 2/8 | ✅ | 37% | 0.46 | +17 | NO | no | +0.54 | +0.52 |
| 2026-02-12 | NBIS | Token | 1/8 | ✅ | 29% | 0.26 | +45 | NO | yes | -0.26 | -0.26 |
| 2026-02-12 | ROKU | Acquisition | 24/32 | ❌ | 71% | 0.43 | +28 | YES | yes | +0.57 | +0.55 |
| 2026-02-12 | ROKU | Brazil | 16/32 | ❌ | 48% | 0.22 | +26 | YES | yes | +0.78 | +0.76 |
| 2026-02-12 | ROKU | FreeWheel / Free Wheel | 0/32 | ❌ | 4% | 0.83 | +13 | NO | no | +0.17 | +0.16 |
| 2026-02-12 | ROKU | Hour | 30/32 | ✅ | 90% | 0.69 | +21 | YES | no | -0.69 | -0.69 |
| 2026-02-12 | ROKU | Howdy | 0/32 | ✅ | 7% | 0.24 | +69 | NO | yes | -0.24 | -0.24 |
| 2026-02-12 | ROKU | Live | 21/32 | ✅ | 65% | 0.25 | +10 | NO | no | +0.75 | +0.73 |
| 2026-02-12 | ROKU | Olympic / Olympics | 4/32 | ✅ | 18% | 0.28 | +54 | NO | yes | -0.28 | -0.28 |
| 2026-02-12 | ROKU | Roku City | 8/32 | ❌ | 26% | 0.34 | +40 | NO | yes | -0.34 | -0.34 |
| 2026-02-13 | COINBASE | Decentralized Exchange / DEX | 12/19 | ✅ | 62% | 0.15 | +23 | NO | yes | -0.15 | -0.15 |
| 2026-02-13 | COINBASE | Margin | 11/19 | ✅ | 58% | 0.06 | +36 | NO | yes | -0.06 | -0.06 |
| 2026-02-13 | COINBASE | Stablecoin | 14/19 | ✅ | 71% | 0.02 | +27 | NO | yes | -0.02 | -0.02 |
| 2026-02-13 | COINBASE | Web3 | 11/19 | ❌ | 54% | 0.34 | +20 | YES | no | -0.34 | -0.34 |
| 2026-02-13 | DKNG | Canada | 9/22 | ❌ | 40% | 0.27 | +13 | YES | no | -0.27 | -0.27 |
| 2026-02-13 | DKNG | Feature | 17/22 | ✅ | 74% | 0.64 | +10 | YES | no | -0.64 | -0.64 |
| 2026-02-13 | DKNG | Super Bowl | 13/22 | ✅ | 59% | 0.06 | +35 | NO | yes | -0.06 | -0.06 |
| 2026-02-13 | WEN | Baconator | 1/22 | ❌ | 10% | 0.68 | +22 | NO | yes | -0.68 | -0.68 |
| 2026-02-13 | WEN | Tariff | 2/22 | ❌ | 13% | 0.67 | +20 | NO | no | +0.33 | +0.32 |
| 2026-02-14 | CAVA | Salmon | 1/9 | ✅ | 27% | 0.22 | +51 | NO | yes | -0.22 | -0.22 |
| 2026-02-14 | CAVA | Same Store | 1/9 | ❌ | 19% | 0.06 | +13 | YES | no | -0.06 | -0.06 |
| 2026-02-14 | CAVA | Spice | 2/9 | ✅ | 34% | 0.52 | +14 | NO | yes | -0.52 | -0.52 |
| 2026-02-14 | CAVA | Sweet Potato | 1/9 | ❌ | 19% | 0.19 | +62 | NO | yes | -0.19 | -0.19 |
| 2026-02-18 | CVNA | AI / Artificial Intelligence | 5/33 | ✅ | 20% | 0.12 | +68 | NO | yes | -0.12 | -0.12 |
| 2026-02-18 | CVNA | Automation | 2/33 | ✅ | 12% | 0.56 | +32 | NO | no | +0.44 | +0.43 |
| 2026-02-18 | CVNA | Tariff | 3/33 | ✅ | 15% | 0.40 | +45 | NO | no | +0.60 | +0.58 |
| 2026-02-18 | DASH | Autonomous | 4/18 | ✅ | 29% | 0.07 | +64 | NO | yes | -0.07 | -0.07 |
| 2026-02-18 | DASH | Kroger | 0/18 | ✅ | 11% | 0.76 | +13 | NO | yes | -0.76 | -0.76 |
| 2026-02-18 | DASH | Robot / Robotic / Robotics | 2/18 | ✅ | 20% | 0.64 | +16 | NO | no | +0.36 | +0.35 |
| 2026-02-18 | DASH | Waymo | 0/18 | ❌ | 7% | 0.70 | +23 | NO | no | +0.30 | +0.29 |
| 2026-02-18 | WING | Lemon Pepper | 1/30 | ❌ | 7% | 0.76 | +17 | NO | no | +0.24 | +0.23 |
| 2026-02-18 | WING | Tender | 12/30 | ✅ | 42% | 0.28 | +30 | NO | yes | -0.28 | -0.28 |
| 2026-02-19 | CAR | AI / Artificial Intelligence | 0/18 | ✅ | 11% | 0.60 | +29 | NO | no | +0.40 | +0.39 |
| 2026-02-19 | DE | Tariff | 15/62 | ✅ | 26% | 0.08 | +66 | NO | yes | -0.08 | -0.08 |
| 2026-02-19 | DE | Tenna | 0/62 | ❌ | 2% | 0.27 | +71 | NO | yes | -0.27 | -0.27 |
| 2026-02-19 | SFM | Inflation | 18/22 | ❌ | 75% | 0.50 | +25 | YES | yes | +0.50 | +0.48 |
| 2026-02-19 | SFM | Personalization | 11/22 | ✅ | 51% | 0.10 | +39 | NO | yes | -0.10 | -0.10 |
| 2026-02-19 | SFM | Revenue | 4/22 | ✅ | 25% | 0.38 | +37 | NO | no | +0.62 | +0.60 |
| 2026-02-19 | WMT | Omnichannel | 23/57 | ✅ | 42% | 0.15 | +43 | NO | yes | -0.15 | -0.15 |
| 2026-02-19 | WMT | OpenAi | 0/57 | ✅ | 4% | 0.43 | +53 | NO | yes | -0.43 | -0.43 |
| 2026-02-19 | WMT | Tariff | 31/57 | ✅ | 55% | 0.06 | +39 | NO | yes | -0.06 | -0.06 |
| 2026-02-23 | DPZ | AI / Artificial Intelligence | 7/60 | ❌ | 13% | 0.58 | +29 | NO | no | +0.42 | +0.41 |
| 2026-02-23 | DPZ | Automation | 3/60 | ❌ | 7% | 0.81 | +12 | NO | no | +0.19 | +0.18 |
| 2026-02-23 | DPZ | DoorDash (5+ times) | 0/60 | ❌ | 2% | 0.34 | +64 | NO | yes | -0.34 | -0.34 |
| 2026-02-23 | DPZ | Parmesan | 11/60 | ❌ | 20% | 0.22 | +58 | NO | yes | -0.22 | -0.22 |
| 2026-02-23 | DPZ | Same Store | 6/60 | ❌ | 12% | 0.04 | +84 | NO | yes | -0.04 | -0.04 |
| 2026-02-23 | HIMS | Cancer | 2/19 | ✅ | 19% | 0.12 | +69 | NO | yes | -0.12 | -0.12 |
| 2026-02-23 | HIMS | Microdose / Microdosing | 0/19 | ✅ | 11% | 0.70 | +19 | NO | no | +0.30 | +0.29 |
| 2026-02-23 | HIMS | Regulation | 3/19 | ❌ | 20% | 0.39 | +41 | NO | no | +0.61 | +0.59 |
| 2026-02-23 | HIMS | Tariff | 2/19 | ❌ | 15% | 0.60 | +25 | NO | no | +0.40 | +0.39 |
| 2026-02-23 | HIMS | Zava | 1/19 | ✅ | 15% | 0.24 | +61 | NO | yes | -0.24 | -0.24 |
| 2026-02-24 | HD | Competition / Competitor | 30/61 | ❌ | 48% | 0.10 | +42 | NO | no | +0.90 | +0.87 |
| 2026-02-24 | HD | E-commerce / Ecommerce | 17/61 | ❌ | 28% | 0.10 | +62 | NO | no | +0.90 | +0.87 |
| 2026-02-24 | HD | Holiday | 37/61 | ✅ | 61% | 0.04 | +35 | NO | no | +0.96 | +0.93 |
| 2026-02-25 | NVDA | Arizona | 2/60 | ❌ | 5% | 0.60 | +35 | NO | no | +0.40 | +0.39 |
| 2026-02-25 | NVDA | Automation | 13/60 | ✅ | 24% | 0.22 | +54 | NO | no | +0.78 | +0.76 |
| 2026-02-25 | NVDA | Domestic | 10/60 | ❌ | 18% | 0.65 | +17 | NO | no | +0.35 | +0.34 |
| 2026-02-25 | NVDA | Taiwan | 10/60 | ❌ | 18% | 0.54 | +28 | NO | no | +0.46 | +0.45 |
| 2026-02-25 | NVDA | Talent | 4/60 | ❌ | 9% | 0.65 | +26 | NO | yes | -0.65 | -0.65 |
| 2026-02-25 | NVDA | Tariff | 3/60 | ❌ | 7% | 0.33 | +60 | NO | no | +0.67 | +0.65 |
| 2026-02-25 | NVDA | VR / Virtual Reality | 23/60 | ❌ | 38% | 0.14 | +24 | YES | no | -0.14 | -0.14 |
| 2026-02-25 | SNOW | Hiring | 19/20 | ✅ | 89% | 0.73 | +16 | YES | yes | +0.27 | +0.26 |
| 2026-02-25 | SNOW | Partnership | 18/20 | ✅ | 85% | 0.03 | +12 | NO | yes | -0.03 | -0.03 |
| 2026-02-26 | CELH | Amazon | 26/33 | ❌ | 74% | 0.62 | +12 | YES | no | -0.62 | -0.62 |
| 2026-02-26 | CELH | Competition | 14/33 | ❌ | 42% | 0.47 | +11 | NO | no | +0.53 | +0.51 |
| 2026-02-26 | CELH | Electrolyte | 1/33 | ❌ | 7% | 0.75 | +18 | NO | no | +0.25 | +0.24 |
| 2026-02-26 | CELH | Input Cost | 4/33 | ❌ | 15% | 0.74 | +11 | NO | no | +0.26 | +0.25 |
| 2026-02-26 | CELH | PepsiCo | 17/33 | ✅ | 52% | 0.17 | +31 | NO | yes | -0.17 | -0.17 |
| 2026-02-26 | DELL | China | 6/18 | ❌ | 34% | 0.19 | +15 | YES | no | -0.19 | -0.19 |
| 2026-02-26 | DELL | Dividend (3+ times) | 0/18 | ❌ | 7% | 0.44 | +49 | NO | yes | -0.44 | -0.44 |
| 2026-02-26 | DELL | McLaren | 0/18 | ❌ | 7% | 0.77 | +16 | NO | no | +0.23 | +0.22 |
| 2026-02-26 | DELL | New Product | 6/18 | ❌ | 34% | 0.37 | +29 | NO | no | +0.63 | +0.61 |
| 2026-02-26 | DELL | Nvidia | 8/18 | ✅ | 47% | 0.27 | +26 | NO | no | +0.73 | +0.71 |
| 2026-02-26 | DELL | PowerEdge / Power Edge | 9/18 | ❌ | 47% | 0.31 | +22 | NO | no | +0.69 | +0.67 |
| 2026-02-26 | DELL | Windows 10 | 8/18 | ❌ | 43% | 0.28 | +15 | YES | no | -0.28 | -0.28 |
| 2026-02-26 | RKLB | Momentum | 6/17 | ✅ | 40% | 0.43 | +17 | NO | yes | -0.43 | -0.43 |
| 2026-02-26 | RKLB | Shutdown / Shut Down | 2/17 | ✅ | 21% | 0.54 | +25 | NO | yes | -0.54 | -0.54 |
| 2026-03-02 | ASTS | Golden Dome | 1/17 | ❌ | 12% | 0.56 | +32 | NO | yes | -0.56 | -0.56 |
| 2026-03-02 | ASTS | New Glenn | 4/17 | ✅ | 31% | 0.24 | +45 | NO | yes | -0.24 | -0.24 |
| 2026-03-02 | PSKY | Antitrust / FTC / DOJ | 1/19 | ❌ | 11% | 0.31 | +58 | NO | yes | -0.31 | -0.31 |
| 2026-03-02 | PSKY | CNN | 0/19 | ❌ | 7% | 0.28 | +65 | NO | yes | -0.28 | -0.28 |
| 2026-03-02 | PSKY | HBO | 2/19 | ✅ | 19% | 0.14 | +67 | NO | yes | -0.14 | -0.14 |
| 2026-03-02 | PSKY | Investment Grade | 1/19 | ✅ | 15% | 0.11 | +74 | NO | yes | -0.11 | -0.11 |
| 2026-03-02 | PSKY | RedBird | 2/19 | ❌ | 15% | 0.19 | +66 | NO | yes | -0.19 | -0.19 |
| 2026-03-02 | PSKY | Synergy | 1/19 | ❌ | 11% | 0.07 | +82 | NO | yes | -0.07 | -0.07 |
| 2026-03-02 | PSKY | Trump / Administration | 0/19 | ❌ | 7% | 0.70 | +23 | NO | no | +0.30 | +0.29 |
| 2026-03-03 | CRWD | China | 2/26 | ✅ | 15% | 0.50 | +35 | NO | no | +0.50 | +0.48 |
| 2026-03-03 | CRWD | Gen AI / Generative AI | 9/26 | ❌ | 35% | 0.37 | +28 | NO | no | +0.63 | +0.61 |
| 2026-03-03 | CRWD | Outage | 6/26 | ✅ | 28% | 0.17 | +11 | YES | no | -0.17 | -0.17 |
| 2026-03-03 | CRWD | SGNL / Signal | 5/26 | ❌ | 22% | 0.12 | +66 | NO | yes | -0.12 | -0.12 |
| 2026-03-03 | TGT | Inflation | 22/50 | ❌ | 43% | 0.40 | +17 | NO | no | +0.60 | +0.58 |
| 2026-03-03 | TGT | Labor | 34/50 | ✅ | 67% | 0.57 | +10 | YES | yes | +0.43 | +0.42 |
| 2026-03-03 | TGT | Synthetic Color | 2/50 | ❌ | 6% | 0.77 | +17 | NO | yes | -0.77 | -0.77 |
| 2026-03-04 | AVGO | Hyperscaler | 16/42 | ✅ | 40% | 0.08 | +52 | NO | yes | -0.08 | -0.08 |
| 2026-03-04 | AVGO | OpenAI | 0/42 | ✅ | 5% | 0.39 | +56 | NO | yes | -0.39 | -0.39 |
| 2026-03-04 | AVGO | Organic | 12/42 | ✅ | 31% | 0.53 | +16 | NO | no | +0.47 | +0.46 |
| 2026-03-04 | AVGO | Tomahawk 6 | 5/42 | ✅ | 16% | 0.06 | +78 | NO | yes | -0.06 | -0.06 |
| 2026-03-05 | COST | Automation | 4/62 | ❌ | 8% | 0.78 | +14 | NO | no | +0.22 | +0.21 |
| 2026-03-05 | COST | Dividend | 45/62 | ❌ | 70% | 0.60 | +10 | YES | yes | +0.40 | +0.39 |
| 2026-03-05 | COST | Hot Dog | 15/62 | ❌ | 25% | 0.54 | +21 | NO | no | +0.46 | +0.45 |
| 2026-03-05 | COST | Kirkland | 44/62 | ✅ | 70% | 0.05 | +25 | NO | yes | -0.05 | -0.05 |
| 2026-03-05 | COST | Revenue | 27/62 | ✅ | 44% | 0.13 | +43 | NO | yes | -0.13 | -0.13 |
| 2026-03-05 | COST | Spending | 39/62 | ❌ | 61% | 0.23 | +16 | NO | yes | -0.23 | -0.23 |
| 2026-03-05 | KR | AI / Artificial Intelligence | 8/21 | ✅ | 42% | 0.09 | +49 | NO | yes | -0.09 | -0.09 |
| 2026-03-05 | KR | Albertsons | 9/21 | ✅ | 46% | 0.32 | +14 | YES | no | -0.32 | -0.32 |
| 2026-03-05 | KR | Economy | 8/21 | ✅ | 42% | 0.32 | +26 | NO | no | +0.68 | +0.66 |
| 2026-03-05 | KR | GLP-1 | 8/21 | ✅ | 42% | 0.25 | +33 | NO | yes | -0.25 | -0.25 |
| 2026-03-05 | KR | SNAP / Food Stamp | 9/21 | ✅ | 46% | 0.23 | +31 | NO | no | +0.77 | +0.75 |
| 2026-03-05 | MRVL | AWS / Amazon | 8/43 | ❌ | 20% | 0.40 | +40 | NO | no | +0.60 | +0.58 |
| 2026-03-05 | MRVL | Tariff | 6/43 | ✅ | 18% | 0.50 | +32 | NO | no | +0.50 | +0.48 |
| 2026-03-05 | VSCO | AI / Artificial Intelligence | 2/5 | ❌ | 38% | 0.45 | +17 | NO | no | +0.55 | +0.53 |
| 2026-03-05 | VSCO | Tariff | 0/5 | ✅ | 29% | 0.08 | +63 | NO | yes | -0.08 | -0.08 |
| 2026-03-05 | VSCO | Valentine | 1/5 | ❌ | 27% | 0.20 | +53 | NO | yes | -0.20 | -0.20 |
| 2026-03-09 | HPE | Government | 5/18 | ✅ | 34% | 0.43 | +23 | NO | yes | -0.43 | -0.43 |
| 2026-03-09 | HPE | Morpheus | 4/18 | ✅ | 29% | 0.15 | +56 | NO | no | +0.85 | +0.82 |
| 2026-03-09 | HPE | Nvidia | 10/18 | ✅ | 56% | 0.05 | +39 | NO | no | +0.95 | +0.92 |
| 2026-03-09 | HPE | Quantum | 2/18 | ✅ | 20% | 0.50 | +30 | NO | no | +0.50 | +0.48 |
| 2026-03-09 | HPE | Self Driving | 0/18 | ❌ | 7% | 0.64 | +29 | NO | yes | -0.64 | -0.64 |
| 2026-03-09 | HPE | Synergy | 2/18 | ✅ | 20% | 0.17 | +63 | NO | yes | -0.17 | -0.17 |
| 2026-03-09 | HPE | Tariff | 3/18 | ❌ | 20% | 0.45 | +35 | NO | yes | -0.45 | -0.45 |
| 2026-03-09 | MTN | Canada / Canadian | 24/24 | ❌ | 91% | 0.73 | +18 | YES | no | -0.73 | -0.73 |
| 2026-03-09 | MTN | Gen Z | 0/24 | ❌ | 5% | 0.26 | +69 | NO | yes | -0.26 | -0.26 |
| 2026-03-09 | MTN | Snowpack | 2/24 | ❌ | 13% | 0.42 | +45 | NO | yes | -0.42 | -0.42 |
| 2026-03-10 | ORCL | Air Force | 0/61 | ❌ | 2% | 0.82 | +16 | NO | no | +0.18 | +0.17 |
| 2026-03-10 | ORCL | Backlog | 17/61 | ✅ | 30% | 0.18 | +52 | NO | yes | -0.18 | -0.18 |
| 2026-03-10 | ORCL | Health | 33/61 | ✅ | 54% | 0.25 | +21 | NO | yes | -0.25 | -0.25 |
| 2026-03-10 | ORCL | Hyperscaler | 13/61 | ✅ | 24% | 0.24 | +52 | NO | no | +0.76 | +0.74 |
| 2026-03-10 | ORCL | Multicloud | 1/61 | ❌ | 4% | 0.04 | +92 | NO | yes | -0.04 | -0.04 |
| 2026-03-10 | ORCL | Partner | 26/61 | ✅ | 44% | 0.11 | +45 | NO | yes | -0.11 | -0.11 |
| 2026-03-10 | ORCL | Red Bull | 0/61 | ❌ | 2% | 0.81 | +17 | NO | no | +0.19 | +0.18 |
| 2026-03-10 | ORCL | Sovereign | 8/61 | ❌ | 15% | 0.61 | +24 | NO | yes | -0.61 | -0.61 |
| 2026-03-10 | ORCL | Stargate | 2/61 | ❌ | 5% | 0.50 | +45 | NO | no | +0.50 | +0.48 |
| 2026-03-10 | ORCL | Tariff | 2/61 | ❌ | 5% | 0.70 | +25 | NO | no | +0.30 | +0.29 |
| 2026-03-12 | ADBE | 3D | 28/57 | ✅ | 50% | 0.30 | +20 | NO | yes | -0.30 | -0.30 |
| 2026-03-12 | ADBE | Firefly Video | 5/57 | ❌ | 11% | 0.44 | +45 | NO | no | +0.56 | +0.54 |
| 2026-03-12 | ADBE | Inference | 5/57 | ❌ | 11% | 0.69 | +20 | NO | no | +0.31 | +0.30 |
| 2026-03-12 | ADBE | Semrush | 0/57 | ✅ | 4% | 0.12 | +84 | NO | yes | -0.12 | -0.12 |
| 2026-03-12 | ADBE | YouTube | 8/57 | ✅ | 17% | 0.53 | +30 | NO | no | +0.47 | +0.46 |
| 2026-03-12 | ULTA | AI / Artificial Intelligence | 5/18 | ❌ | 29% | 0.58 | +13 | NO | yes | -0.58 | -0.58 |
| 2026-03-12 | ULTA | Holiday | 16/18 | ✅ | 83% | 0.06 | +11 | NO | yes | -0.06 | -0.06 |
| 2026-03-12 | ULTA | Middle East | 2/18 | ✅ | 20% | 0.33 | +47 | NO | yes | -0.33 | -0.33 |
| 2026-03-12 | ULTA | Space NK | 1/18 | ✅ | 16% | 0.09 | +75 | NO | yes | -0.09 | -0.09 |
| 2026-04-07 | LEVI | AI / Artificial Intelligence | 15/58 | ✅ | 28% | 0.24 | +48 | NO | yes | -0.24 | -0.24 |
| 2026-04-07 | LEVI | Beyond Yoga | 17/58 | ✅ | 31% | 0.05 | +64 | NO | yes | -0.05 | -0.05 |
| 2026-04-07 | LEVI | China | 56/58 | ❌ | 93% | 0.75 | +18 | YES | yes | +0.25 | +0.24 |
| 2026-04-07 | LEVI | Dockers | 51/58 | ❌ | 85% | 0.70 | +15 | YES | yes | +0.30 | +0.29 |
| 2026-04-07 | LEVI | Nike | 7/58 | ✅ | 15% | 0.47 | +38 | NO | yes | -0.47 | -0.47 |
| 2026-04-07 | LEVI | Tariff | 10/58 | ✅ | 20% | 0.04 | +76 | NO | yes | -0.04 | -0.04 |
| 2026-04-07 | LEVI | World Cup | 0/58 | ✅ | 4% | 0.34 | +62 | NO | yes | -0.34 | -0.34 |
| 2026-04-09 | STZ | Dividend | 36/42 | ❌ | 81% | 0.58 | +23 | YES | yes | +0.42 | +0.41 |
| 2026-04-09 | STZ | Especial | 40/42 | ❌ | 90% | 0.50 | +40 | YES | yes | +0.50 | +0.48 |
| 2026-04-13 | GS | IPO | 21/27 | ✅ | 75% | 0.06 | +19 | NO | yes | -0.06 | -0.06 |
| 2026-04-13 | GS | Marcus | 18/27 | ✅ | 66% | 0.38 | +28 | YES | yes | +0.62 | +0.60 |
| 2026-04-14 | C | Banamex | 6/16 | ✅ | 42% | 0.13 | +45 | NO | yes | -0.13 | -0.13 |
| 2026-04-14 | C | Iran | 0/16 | ❌ | 8% | 0.69 | +23 | NO | no | +0.31 | +0.30 |
| 2026-04-14 | JNJ | Administration | 15/43 | ✅ | 37% | 0.34 | +29 | NO | no | +0.66 | +0.64 |
| 2026-04-14 | JNJ | AI / Artificial Intelligence | 7/43 | ❌ | 18% | 0.45 | +37 | NO | no | +0.55 | +0.53 |
| 2026-04-14 | JNJ | Nipocalimab / Lupus | 17/43 | ✅ | 41% | 0.35 | +24 | NO | no | +0.65 | +0.63 |
| 2026-04-14 | JNJ | Rybrevant | 15/43 | ✅ | 37% | 0.05 | +58 | NO | yes | -0.05 | -0.05 |
| 2026-04-14 | JNJ | Tariff | 5/43 | ✅ | 16% | 0.05 | +79 | NO | yes | -0.05 | -0.05 |
| 2026-04-14 | JNJ | Vaccine | 22/43 | ❌ | 50% | 0.20 | +30 | YES | no | -0.20 | -0.20 |
| 2026-04-14 | JPM | Crypto / Bitcoin | 0/43 | ✅ | 5% | 0.59 | +36 | NO | no | +0.41 | +0.40 |
| 2026-04-14 | JPM | Fintech | 12/43 | ✅ | 31% | 0.55 | +14 | NO | no | +0.45 | +0.44 |
| 2026-04-14 | JPM | Geopolitical | 9/43 | ✅ | 24% | 0.31 | +45 | NO | yes | -0.31 | -0.31 |
| 2026-04-14 | JPM | Hiring | 12/43 | ✅ | 31% | 0.30 | +39 | NO | no | +0.70 | +0.68 |
| 2026-04-14 | JPM | Inflation | 20/43 | ✅ | 48% | 0.13 | +39 | NO | no | +0.87 | +0.84 |
| 2026-04-14 | JPM | Recession | 22/43 | ✅ | 52% | 0.34 | +14 | NO | yes | -0.34 | -0.34 |
| 2026-04-14 | JPM | Regulation | 18/43 | ✅ | 43% | 0.26 | +31 | NO | yes | -0.26 | -0.26 |
| 2026-04-14 | WFC | Basel 3 | 0/27 | ❌ | 5% | 0.34 | +61 | NO | yes | -0.34 | -0.34 |
| 2026-04-14 | WFC | Buyback | 21/27 | ✅ | 75% | 0.47 | +28 | YES | no | -0.47 | -0.47 |
| 2026-04-14 | WFC | Inflation | 16/27 | ✅ | 59% | 0.20 | +21 | NO | no | +0.80 | +0.78 |
| 2026-04-14 | WFC | Oil | 6/27 | ❌ | 24% | 0.62 | +14 | NO | yes | -0.62 | -0.62 |
| 2026-04-14 | WFC | Private Equity | 18/27 | ✅ | 66% | 0.49 | +17 | YES | yes | +0.51 | +0.49 |
| 2026-04-14 | WFC | Recession | 5/27 | ❌ | 21% | 0.57 | +22 | NO | no | +0.43 | +0.42 |
| 2026-04-14 | WFC | Severance | 11/27 | ✅ | 43% | 0.29 | +28 | NO | yes | -0.29 | -0.29 |
| 2026-04-14 | WFC | Tariff | 3/27 | ❌ | 15% | 0.50 | +35 | NO | no | +0.50 | +0.48 |
| 2026-04-15 | BAC | Delinquency | 31/62 | ✅ | 51% | 0.18 | +31 | NO | yes | -0.18 | -0.18 |
| 2026-04-15 | BAC | Inflation | 22/62 | ✅ | 37% | 0.28 | +35 | NO | yes | -0.28 | -0.28 |
| 2026-04-15 | BAC | Oil | 12/62 | ❌ | 20% | 0.28 | +52 | NO | no | +0.72 | +0.70 |
| 2026-04-15 | BAC | Rate Cut | 16/62 | ✅ | 28% | 0.15 | +57 | NO | yes | -0.15 | -0.15 |
| 2026-04-15 | BAC | Tariff | 4/62 | ✅ | 10% | 0.52 | +38 | NO | yes | -0.52 | -0.52 |
| 2026-04-15 | MS | Oil | 3/27 | ❌ | 15% | 0.44 | +41 | NO | no | +0.56 | +0.54 |
| 2026-04-15 | MS | Tailwind | 13/27 | ✅ | 50% | 0.28 | +22 | NO | no | +0.72 | +0.70 |
| 2026-04-15 | MS | Tariff | 2/27 | ❌ | 11% | 0.77 | +12 | NO | no | +0.23 | +0.22 |
| 2026-04-15 | MS | Zero Hash | 1/27 | ✅ | 11% | 0.50 | +39 | NO | yes | -0.50 | -0.50 |
| 2026-04-15 | PGR | Buyback | 4/49 | ❌ | 10% | 0.03 | +87 | NO | no | +0.97 | +0.94 |
| 2026-04-15 | PGR | Catastrophe | 19/49 | ✅ | 40% | 0.21 | +39 | NO | no | +0.79 | +0.77 |
| 2026-04-15 | PGR | Headwind | 9/49 | ✅ | 21% | 0.01 | +20 | YES | yes | +0.99 | +0.96 |
| 2026-04-15 | PGR | M&A / Acquisition | 41/49 | ✅ | 82% | 0.04 | +14 | NO | yes | -0.04 | -0.04 |
| 2026-04-15 | PGR | Pet Insurance | 0/49 | ✅ | 5% | 0.69 | +26 | NO | no | +0.31 | +0.30 |
| 2026-04-15 | PGR | Rosella | 0/49 | ❌ | 3% | 0.85 | +12 | NO | no | +0.15 | +0.15 |
| 2026-04-15 | PGR | Snapshot | 42/49 | ✅ | 84% | 0.01 | +83 | YES | no | -0.01 | -0.01 |
| 2026-04-16 | NFLX | Acquisition | 45/62 | ✅ | 72% | 0.10 | +18 | NO | yes | -0.10 | -0.10 |
| 2026-04-16 | NFLX | Ad-Supported | 14/62 | ✅ | 25% | 0.19 | +56 | NO | no | +0.81 | +0.79 |
| 2026-04-16 | NFLX | Competition | 50/62 | ✅ | 79% | 0.10 | +11 | NO | yes | -0.10 | -0.10 |
| 2026-04-16 | NFLX | Gaming | 20/62 | ✅ | 34% | 0.23 | +43 | NO | yes | -0.23 | -0.23 |
| 2026-04-16 | NFLX | Hollywood | 21/62 | ❌ | 34% | 0.23 | +11 | YES | yes | +0.77 | +0.75 |
| 2026-04-16 | NFLX | Live Event | 12/62 | ✅ | 22% | 0.08 | +70 | NO | yes | -0.08 | -0.08 |
| 2026-04-16 | NFLX | MLB | 2/62 | ❌ | 5% | 0.23 | +72 | NO | yes | -0.23 | -0.23 |
| 2026-04-16 | NFLX | Paramount | 8/62 | ✅ | 16% | 0.41 | +43 | NO | yes | -0.41 | -0.41 |
| 2026-04-16 | NFLX | Profitable | 31/62 | ❌ | 49% | 0.26 | +25 | NO | no | +0.74 | +0.72 |
| 2026-04-16 | NFLX | Skyscraper | 1/62 | ✅ | 5% | 0.49 | +46 | NO | yes | -0.49 | -0.49 |
| 2026-04-16 | NFLX | Stranger Things | 24/62 | ✅ | 40% | 0.48 | +12 | NO | no | +0.52 | +0.50 |
| 2026-04-16 | NFLX | Subscriber | 56/62 | ❌ | 87% | 0.33 | +54 | YES | yes | +0.67 | +0.65 |
| 2026-04-16 | NFLX | WWE | 9/62 | ❌ | 16% | 0.63 | +21 | NO | no | +0.37 | +0.36 |
| 2026-04-16 | PEP | Nvidia | 0/27 | ❌ | 5% | 0.84 | +11 | NO | no | +0.16 | +0.16 |
| 2026-04-17 | TFC | Credit Card | 7/30 | ✅ | 28% | 0.45 | +27 | NO | no | +0.55 | +0.53 |
| 2026-04-17 | TFC | Middle Market | 10/30 | ✅ | 36% | 0.15 | +49 | NO | yes | -0.15 | -0.15 |
| 2026-04-17 | TFC | Orioles | 0/30 | ❌ | 4% | 0.69 | +27 | NO | no | +0.31 | +0.30 |
| 2026-04-17 | TFC | Recession | 14/30 | ❌ | 45% | 0.29 | +16 | YES | no | -0.29 | -0.29 |
| 2026-04-21 | ALK | Iceland | 0/17 | ✅ | 12% | 0.59 | +29 | NO | no | +0.41 | +0.40 |
| 2026-04-21 | ALK | Oneworld | 14/17 | ✅ | 78% | 0.66 | +12 | YES | yes | +0.34 | +0.33 |
| 2026-04-21 | ALK | Starlink | 0/17 | ✅ | 12% | 0.11 | +77 | NO | yes | -0.11 | -0.11 |
| 2026-04-22 | BA | Airbus | 23/45 | ✅ | 52% | 0.18 | +34 | YES | no | -0.18 | -0.18 |
| 2026-04-22 | GEV | Robotic / Robotics | 3/7 | ✅ | 49% | 0.20 | +31 | NO | yes | -0.20 | -0.20 |
| 2026-04-22 | GEV | Vietnam / India | 3/7 | ✅ | 49% | 0.22 | +29 | NO | yes | -0.22 | -0.22 |
| 2026-04-22 | TSLA | Competition | 12/61 | ✅ | 22% | 0.39 | +39 | NO | yes | -0.39 | -0.39 |
| 2026-04-22 | TSLA | Cybertruck | 22/61 | ✅ | 37% | 0.48 | +15 | NO | no | +0.52 | +0.50 |
| 2026-04-22 | TSLA | Delivery | 47/61 | ✅ | 76% | 0.07 | +17 | NO | yes | -0.07 | -0.07 |
| 2026-04-22 | TSLA | Dojo / Dojo3 | 14/61 | ❌ | 24% | 0.51 | +25 | NO | yes | -0.51 | -0.51 |
| 2026-04-22 | TSLA | Gigafactory | 33/61 | ❌ | 53% | 0.37 | +16 | YES | no | -0.37 | -0.37 |
| 2026-04-22 | TSLA | Grok 5 | 1/61 | ❌ | 4% | 0.82 | +14 | NO | no | +0.18 | +0.17 |
| 2026-04-22 | TSLA | Leader / Leadership | 21/61 | ✅ | 36% | 0.52 | +12 | NO | no | +0.48 | +0.47 |
| 2026-04-22 | TSLA | Optimus | 15/61 | ✅ | 27% | 0.01 | +72 | NO | yes | -0.01 | -0.01 |
| 2026-04-22 | TSLA | Roadster | 29/61 | ✅ | 48% | 0.24 | +28 | NO | yes | -0.24 | -0.24 |
| 2026-04-22 | TSLA | Supercharger / Super Charger | 30/61 | ❌ | 48% | 0.34 | +14 | YES | yes | +0.66 | +0.64 |
| 2026-04-22 | TSLA | SpaceX / xAI | 17/61 | ✅ | 30% | 0.13 | +57 | NO | yes | -0.13 | -0.13 |
| 2026-04-22 | TSLA | Tariff | 12/61 | ✅ | 22% | 0.18 | +60 | NO | yes | -0.18 | -0.18 |
| 2026-04-22 | TSLA | Terafab | 0/61 | ✅ | 4% | 0.10 | +86 | NO | yes | -0.10 | -0.10 |
| 2026-04-22 | TSLA | Trump | 4/61 | ❌ | 8% | 0.79 | +13 | NO | no | +0.21 | +0.20 |
| 2026-04-22 | UAL | Middle East | 7/23 | ❌ | 31% | 0.16 | +53 | NO | yes | -0.16 | -0.16 |
| 2026-04-22 | UAL | Nonstop / Non-Stop | 10/23 | ❌ | 42% | 0.23 | +19 | YES | no | -0.23 | -0.23 |
| 2026-04-22 | UAL | Oil  | 3/23 | ❌ | 17% | 0.27 | +56 | NO | yes | -0.27 | -0.27 |
| 2026-04-22 | UAL | On-Time / On Time | 13/23 | ✅ | 57% | 0.07 | +36 | NO | yes | -0.07 | -0.07 |
| 2026-04-22 | UAL | Relax Row | 0/23 | ❌ | 6% | 0.59 | +35 | NO | yes | -0.59 | -0.59 |
| 2026-04-22 | UAL | Starlink | 5/23 | ✅ | 27% | 0.14 | +59 | NO | yes | -0.14 | -0.14 |
| 2026-04-22 | UAL | Tariff | 3/23 | ❌ | 17% | 0.66 | +17 | NO | no | +0.34 | +0.33 |
| 2026-04-22 | UAL | World Cup | 0/23 | ✅ | 9% | 0.56 | +35 | NO | no | +0.44 | +0.43 |
| 2026-04-23 | AXP | Lounge | 28/57 | ✅ | 50% | 0.31 | +19 | NO | yes | -0.31 | -0.31 |
| 2026-04-23 | INTC | Arizona | 16/62 | ✅ | 28% | 0.26 | +46 | NO | no | +0.74 | +0.72 |
| 2026-04-23 | INTC | Dividend | 49/62 | ❌ | 76% | 0.20 | +56 | YES | no | -0.20 | -0.20 |
| 2026-04-23 | INTC | Nvidia | 7/62 | ✅ | 14% | 0.18 | +68 | NO | yes | -0.18 | -0.18 |
| 2026-04-23 | INTC | Panther Lake | 9/62 | ✅ | 17% | 0.08 | +75 | NO | yes | -0.08 | -0.08 |
| 2026-04-23 | INTC | Tariff | 6/62 | ✅ | 13% | 0.54 | +33 | NO | no | +0.46 | +0.45 |
| 2026-04-23 | INTC | Ultra 3 / Ultra Series 3 | 0/62 | ✅ | 4% | 0.11 | +85 | NO | yes | -0.11 | -0.11 |
| 2026-04-24 | PG | AI / Artificial Intelligence | 5/45 | ✅ | 15% | 0.19 | +66 | NO | yes | -0.19 | -0.19 |
| 2026-04-24 | PG | Beauty | 38/45 | ✅ | 82% | 0.68 | +14 | YES | yes | +0.32 | +0.31 |
| 2026-04-24 | PG | Competition | 35/45 | ✅ | 76% | 0.55 | +21 | YES | no | -0.55 | -0.55 |
| 2026-04-24 | PG | Inflation | 28/45 | ✅ | 62% | 0.12 | +26 | NO | yes | -0.12 | -0.12 |
| 2026-04-24 | PG | Old Spice | 9/45 | ✅ | 23% | 0.57 | +20 | NO | no | +0.43 | +0.42 |
| 2026-04-24 | PG | WNBA | 0/45 | ❌ | 3% | 0.55 | +42 | NO | no | +0.45 | +0.44 |
| 2026-04-27 | DPZ | Emergency Pizza | 7/61 | ❌ | 13% | 0.53 | +34 | NO | no | +0.47 | +0.46 |
| 2026-04-27 | DPZ | Parmesan | 11/61 | ✅ | 21% | 0.16 | +63 | NO | no | +0.84 | +0.81 |
| 2026-04-27 | DPZ | Tailwind | 24/61 | ✅ | 41% | 0.19 | +40 | NO | yes | -0.19 | -0.19 |
| 2026-04-27 | VZ | Synergy | 2/27 | ✅ | 14% | 0.13 | +73 | NO | yes | -0.13 | -0.13 |
| 2026-04-28 | HOOD | Acquisition | 12/18 | ✅ | 65% | 0.14 | +21 | NO | yes | -0.14 | -0.14 |
| 2026-04-28 | HOOD | Bitcoin | 5/18 | ✅ | 34% | 0.55 | +11 | NO | yes | -0.55 | -0.55 |
| 2026-04-28 | HOOD | Blockchain | 3/18 | ✅ | 25% | 0.43 | +32 | NO | no | +0.57 | +0.55 |
| 2026-04-28 | HOOD | Indonesia | 0/18 | ✅ | 11% | 0.77 | +12 | NO | yes | -0.77 | -0.77 |
| 2026-04-28 | HOOD | Kalshi | 1/18 | ❌ | 11% | 0.68 | +21 | NO | no | +0.32 | +0.31 |
| 2026-04-28 | HOOD | Perp / Perpetual | 1/18 | ✅ | 16% | 0.35 | +49 | NO | yes | -0.35 | -0.35 |
| 2026-04-28 | HOOD | Social | 6/18 | ✅ | 38% | 0.05 | +57 | NO | yes | -0.05 | -0.05 |
| 2026-04-28 | HOOD | Tokenization | 3/18 | ✅ | 25% | 0.08 | +67 | NO | yes | -0.08 | -0.08 |
| 2026-04-28 | HOOD | Trump | 1/18 | ✅ | 16% | 0.34 | +50 | NO | yes | -0.34 | -0.34 |
| 2026-04-28 | KO | Cane Sugar | 1/43 | ❌ | 5% | 0.71 | +24 | NO | no | +0.29 | +0.28 |
| 2026-04-28 | KO | Dividend | 32/43 | ✅ | 73% | 0.16 | +11 | NO | no | +0.84 | +0.81 |
| 2026-04-28 | KO | Fairlife | 24/43 | ✅ | 56% | 0.04 | +40 | NO | yes | -0.04 | -0.04 |
| 2026-04-28 | KO | International | 13/43 | ❌ | 31% | 0.47 | +22 | NO | no | +0.53 | +0.51 |
| 2026-04-28 | KO | Tariff | 3/43 | ❌ | 10% | 0.70 | +20 | NO | no | +0.30 | +0.29 |
| 2026-04-28 | SBUX | Boyu | 0/44 | ✅ | 5% | 0.09 | +86 | NO | yes | -0.09 | -0.09 |
| 2026-04-28 | SBUX | Protein | 10/44 | ✅ | 26% | 0.04 | +70 | NO | yes | -0.04 | -0.04 |
| 2026-04-28 | SBUX | Tariff | 3/44 | ✅ | 11% | 0.04 | +85 | NO | yes | -0.04 | -0.04 |
| 2026-04-28 | SPOT | Award | 0/31 | ✅ | 7% | 0.71 | +22 | NO | no | +0.29 | +0.28 |
| 2026-04-28 | SPOT | Bookshop / Bookshop.org | 0/31 | ✅ | 7% | 0.32 | +61 | NO | no | +0.68 | +0.66 |
| 2026-04-28 | SPOT | ChatGPT | 1/31 | ❌ | 7% | 0.68 | +25 | NO | yes | -0.68 | -0.68 |
| 2026-04-28 | SPOT | Headwind | 15/31 | ✅ | 50% | 0.22 | +28 | NO | no | +0.78 | +0.76 |
| 2026-04-28 | SPOT | Monetization | 24/31 | ✅ | 75% | 0.06 | +19 | NO | yes | -0.06 | -0.06 |
| 2026-04-28 | SPOT | Physical | 8/31 | ✅ | 30% | 0.45 | +25 | NO | no | +0.55 | +0.53 |
| 2026-04-28 | V | Regulation / Regulatory | 44/63 | ✅ | 69% | 0.58 | +11 | YES | yes | +0.42 | +0.41 |
| 2026-04-28 | V | World Cup | 15/63 | ✅ | 26% | 0.29 | +45 | NO | yes | -0.29 | -0.29 |
| 2026-04-29 | AMZN | Alexa+ / Alexa Plus | 3/62 | ✅ | 8% | 0.05 | +87 | NO | yes | -0.05 | -0.05 |
| 2026-04-29 | AMZN | China | 26/62 | ❌ | 42% | 0.29 | +13 | YES | no | -0.29 | -0.29 |
| 2026-04-29 | AMZN | Data Center | 25/62 | ✅ | 41% | 0.11 | +48 | NO | yes | -0.11 | -0.11 |
| 2026-04-29 | AMZN | Drone | 4/62 | ❌ | 8% | 0.62 | +30 | NO | no | +0.38 | +0.37 |
| 2026-04-29 | AMZN | Prime Day | 30/62 | ❌ | 48% | 0.26 | +26 | NO | yes | -0.26 | -0.26 |
| 2026-04-29 | AMZN | Project Kuiper | 7/62 | ❌ | 13% | 0.77 | +10 | NO | no | +0.23 | +0.22 |
| 2026-04-29 | AMZN | Silicon | 10/62 | ✅ | 19% | 0.10 | +71 | NO | yes | -0.10 | -0.10 |
| 2026-04-29 | AMZN | Supply Chain | 16/62 | ❌ | 26% | 0.51 | +23 | NO | yes | -0.51 | -0.51 |
| 2026-04-29 | AMZN | Tariff | 3/62 | ✅ | 8% | 0.02 | +90 | NO | yes | -0.02 | -0.02 |
| 2026-04-29 | AMZN | Third Party Sellers | 1/62 | ❌ | 4% | 0.28 | +68 | NO | yes | -0.28 | -0.28 |
| 2026-04-29 | CAR | Upgrade | 2/19 | ❌ | 15% | 0.72 | +13 | NO | no | +0.28 | +0.27 |
| 2026-04-29 | CMG | Al Pastor | 11/63 | ✅ | 20% | 0.10 | +70 | NO | yes | -0.10 | -0.10 |
| 2026-04-29 | CMG | Autocado | 8/63 | ❌ | 14% | 0.66 | +20 | NO | no | +0.34 | +0.33 |
| 2026-04-29 | CMG | Carne Asada | 17/63 | ✅ | 29% | 0.47 | +24 | NO | no | +0.53 | +0.51 |
| 2026-04-29 | CMG | Chipotle Lane / Chipotlane | 28/63 | ❌ | 44% | 0.09 | +47 | NO | yes | -0.09 | -0.09 |
| 2026-04-29 | CMG | Headwind | 25/63 | ✅ | 41% | 0.37 | +22 | NO | no | +0.63 | +0.61 |
| 2026-04-29 | CMG | Tailwind | 8/63 | ✅ | 15% | 0.57 | +28 | NO | no | +0.43 | +0.42 |
| 2026-04-29 | CMG | Tariff | 4/63 | ✅ | 10% | 0.22 | +68 | NO | no | +0.78 | +0.76 |
| 2026-04-29 | CMG | Transaction Growth | 27/63 | ✅ | 44% | 0.23 | +33 | NO | yes | -0.23 | -0.23 |
| 2026-04-29 | CVNA | Bridgecrest | 0/34 | ❌ | 4% | 0.61 | +35 | NO | no | +0.39 | +0.38 |
| 2026-04-29 | CVNA | Same Day | 2/34 | ❌ | 9% | 0.40 | +51 | NO | no | +0.60 | +0.58 |
| 2026-04-29 | GOOGL | Autonomous | 24/60 | ✅ | 41% | 0.27 | +32 | NO | yes | -0.27 | -0.27 |
| 2026-04-29 | GOOGL | European Commission | 5/60 | ❌ | 10% | 0.77 | +13 | NO | no | +0.23 | +0.22 |
| 2026-04-29 | GOOGL | Privacy | 26/60 | ❌ | 43% | 0.25 | +18 | YES | no | -0.25 | -0.25 |
| 2026-04-29 | GOOGL | Quantum | 6/60 | ❌ | 12% | 0.56 | +32 | NO | no | +0.44 | +0.43 |
| 2026-04-29 | GOOGL | Regulator / Regulation / Regulatory | 20/60 | ❌ | 34% | 0.22 | +12 | YES | no | -0.22 | -0.22 |
| 2026-04-29 | META | Dividend | 11/54 | ✅ | 23% | 0.14 | +63 | NO | no | +0.86 | +0.83 |
| 2026-04-29 | META | Hyperion | 1/54 | ❌ | 4% | 0.64 | +32 | NO | no | +0.36 | +0.35 |
| 2026-04-29 | META | Llama | 11/54 | ❌ | 22% | 0.38 | +40 | NO | no | +0.62 | +0.60 |
| 2026-04-29 | META | Muse | 0/54 | ❌ | 3% | 0.03 | +94 | NO | yes | -0.03 | -0.03 |
| 2026-04-29 | META | Orion | 4/54 | ❌ | 9% | 0.51 | +40 | NO | no | +0.49 | +0.48 |
| 2026-04-29 | META | Thread / Threads | 25/54 | ✅ | 47% | 0.05 | +48 | NO | yes | -0.05 | -0.05 |
| 2026-04-29 | META | VR / Virtual Reality | 39/54 | ✅ | 71% | 0.53 | +18 | YES | yes | +0.47 | +0.46 |
| 2026-04-29 | MSFT | Gaming | 54/62 | ✅ | 85% | 0.04 | +11 | NO | yes | -0.04 | -0.04 |
| 2026-04-29 | MSFT | LinkedIn | 39/62 | ✅ | 63% | 0.04 | +33 | NO | yes | -0.04 | -0.04 |
| 2026-04-29 | WING | Hot Box | 0/31 | ❌ | 4% | 0.72 | +24 | NO | no | +0.28 | +0.27 |
| 2026-04-29 | WING | Tender | 13/31 | ✅ | 44% | 0.28 | +28 | NO | yes | -0.28 | -0.28 |
| 2026-04-30 | AAPL | Apple Pay | 36/59 | ✅ | 61% | 0.17 | +22 | NO | no | +0.83 | +0.81 |
| 2026-04-30 | AAPL | Creator Studio | 0/59 | ✅ | 4% | 0.42 | +54 | NO | no | +0.58 | +0.56 |
| 2026-04-30 | AAPL | Formula 1 / F1 | 4/59 | ✅ | 10% | 0.23 | +67 | NO | yes | -0.23 | -0.23 |
| 2026-04-30 | AAPL | Fold / Folding / Foldable | 2/59 | ❌ | 6% | 0.73 | +21 | NO | no | +0.27 | +0.26 |
| 2026-04-30 | AAPL | Gemini | 0/59 | ✅ | 4% | 0.54 | +42 | NO | no | +0.46 | +0.45 |
| 2026-04-30 | AAPL | Liquid Glass | 2/59 | ❌ | 6% | 0.66 | +28 | NO | no | +0.34 | +0.33 |
| 2026-04-30 | AAPL | Manufacturing | 35/59 | ✅ | 59% | 0.05 | +36 | NO | yes | -0.05 | -0.05 |
| 2026-04-30 | AAPL | Modem | 5/59 | ✅ | 12% | 0.73 | +15 | NO | yes | -0.73 | -0.73 |
| 2026-04-30 | AAPL | Siri | 31/59 | ✅ | 53% | 0.05 | +42 | NO | yes | -0.05 | -0.05 |
| 2026-04-30 | AAPL | Streaming | 18/59 | ❌ | 31% | 0.51 | +18 | NO | no | +0.49 | +0.48 |
| 2026-04-30 | AAPL | Tariff | 10/59 | ✅ | 20% | 0.05 | +75 | NO | yes | -0.05 | -0.05 |
| 2026-04-30 | AAPL | Widget | 2/59 | ❌ | 6% | 0.81 | +13 | NO | no | +0.19 | +0.18 |
| 2026-04-30 | LLY | AI / Artificial Intelligence | 1/43 | ✅ | 7% | 0.20 | +73 | NO | no | +0.80 | +0.78 |
| 2026-04-30 | LLY | China | 37/43 | ✅ | 84% | 0.05 | +11 | NO | yes | -0.05 | -0.05 |
| 2026-04-30 | LLY | Foundayo | 0/43 | ❌ | 3% | 0.02 | +95 | NO | yes | -0.02 | -0.02 |
| 2026-04-30 | LLY | Headwind | 38/43 | ❌ | 84% | 0.50 | +34 | YES | yes | +0.50 | +0.48 |
| 2026-04-30 | LLY | LillyDirect | 3/43 | ✅ | 11% | 0.05 | +84 | NO | yes | -0.05 | -0.05 |
| 2026-04-30 | LLY | Nvidia | 0/43 | ✅ | 5% | 0.49 | +46 | NO | no | +0.51 | +0.49 |
| 2026-04-30 | LLY | Pennsylvania | 0/43 | ❌ | 3% | 0.62 | +35 | NO | no | +0.38 | +0.37 |
| 2026-04-30 | LLY | Vial | 14/43 | ✅ | 35% | 0.11 | +54 | NO | yes | -0.11 | -0.11 |
| 2026-04-30 | RDDT | Game | 5/7 | ❌ | 57% | 0.41 | +16 | YES | no | -0.41 | -0.41 |
| 2026-04-30 | RDDT | Headwind | 3/7 | ❌ | 40% | 0.27 | +13 | YES | no | -0.27 | -0.27 |
| 2026-04-30 | RDDT | Reddit Pro | 6/7 | ✅ | 75% | 0.04 | +21 | NO | yes | -0.04 | -0.04 |
| 2026-04-30 | RDDT | Shopify | 0/7 | ❌ | 14% | 0.04 | +82 | NO | yes | -0.04 | -0.04 |
| 2026-04-30 | RIVN | Cox | 0/17 | ❌ | 7% | 0.58 | +35 | NO | no | +0.42 | +0.41 |
| 2026-04-30 | RIVN | Headwind | 6/17 | ❌ | 36% | 0.52 | +12 | NO | no | +0.48 | +0.47 |
| 2026-04-30 | RIVN | Robot / Robotic / Robotics | 6/17 | ✅ | 40% | 0.29 | +31 | NO | yes | -0.29 | -0.29 |
| 2026-04-30 | RIVN | Tornado | 0/17 | ❌ | 7% | 0.43 | +50 | NO | yes | -0.43 | -0.43 |
| 2026-04-30 | RIVN | Uber | 0/17 | ❌ | 7% | 0.07 | +86 | NO | yes | -0.07 | -0.07 |
| 2026-05-04 | ON | NIO | 2/43 | ❌ | 7% | 0.23 | +70 | NO | yes | -0.23 | -0.23 |
| 2026-05-04 | ON | Nvidia | 6/43 | ❌ | 16% | 0.54 | +30 | NO | no | +0.46 | +0.45 |
| 2026-05-04 | ON | Tariff | 8/43 | ❌ | 20% | 0.65 | +15 | NO | no | +0.35 | +0.34 |
| 2026-05-04 | PLTR | Commercial Growth | 3/21 | ❌ | 18% | 0.60 | +22 | NO | yes | -0.60 | -0.60 |
| 2026-05-04 | PLTR | Government Contract | 2/21 | ❌ | 14% | 0.75 | +11 | NO | no | +0.25 | +0.24 |
| 2026-05-04 | PLTR | Healthcare | 17/21 | ✅ | 77% | 0.56 | +21 | YES | no | -0.56 | -0.56 |
| 2026-05-04 | PLTR | Iran / Iranian | 2/21 | ❌ | 14% | 0.28 | +58 | NO | no | +0.72 | +0.70 |
| 2026-05-04 | PLTR | Revenue guidance | 15/21 | ❌ | 66% | 0.13 | +21 | NO | yes | -0.13 | -0.13 |
| 2026-05-04 | PLTR | Stellantis | 0/21 | ❌ | 6% | 0.72 | +22 | NO | no | +0.28 | +0.27 |
| 2026-05-05 | PYPL | Ads ID | 0/41 | ❌ | 3% | 0.31 | +66 | NO | no | +0.69 | +0.67 |
| 2026-05-05 | SHOP | Shop Pay | 24/42 | ✅ | 57% | 0.02 | +41 | NO | yes | -0.02 | -0.02 |
| 2026-05-05 | SHOP | Tariff | 5/42 | ✅ | 16% | 0.21 | +63 | NO | no | +0.79 | +0.77 |
| 2026-05-06 | DIS | Acquisition | 52/63 | ❌ | 80% | 0.52 | +28 | YES | yes | +0.48 | +0.47 |
| 2026-05-06 | DIS | Cruise | 48/63 | ✅ | 75% | 0.04 | +21 | NO | yes | -0.04 | -0.04 |
| 2026-05-06 | DIS | OpenAI / Sora | 0/63 | ✅ | 4% | 0.49 | +47 | NO | no | +0.51 | +0.49 |
| 2026-05-06 | DIS | Subscriber | 54/63 | ✅ | 84% | 0.05 | +11 | NO | yes | -0.05 | -0.05 |
| 2026-05-06 | UBER | Avride | 2/27 | ✅ | 14% | 0.42 | +44 | NO | no | +0.58 | +0.56 |
| 2026-05-06 | UBER | Driver Incentives | 10/27 | ❌ | 37% | 0.09 | +28 | YES | no | -0.09 | -0.09 |
| 2026-05-06 | UBER | Freight | 16/27 | ✅ | 59% | 0.22 | +19 | NO | yes | -0.22 | -0.22 |
| 2026-05-06 | UBER | Innovation | 21/27 | ❌ | 72% | 0.16 | +12 | NO | yes | -0.16 | -0.16 |
| 2026-05-06 | UBER | Market Share | 11/27 | ✅ | 43% | 0.12 | +45 | NO | no | +0.88 | +0.85 |
| 2026-05-06 | UBER | Nissan | 0/27 | ❌ | 5% | 0.47 | +48 | NO | no | +0.53 | +0.51 |
| 2026-05-06 | UBER | Waabi | 3/27 | ✅ | 17% | 0.34 | +49 | NO | no | +0.66 | +0.64 |
| 2026-05-06 | UBER | Waymo | 7/27 | ✅ | 30% | 0.04 | +66 | NO | yes | -0.04 | -0.04 |
| 2026-05-07 | ABNB | Boutique | 5/20 | ✅ | 31% | 0.17 | +52 | NO | yes | -0.17 | -0.17 |
| 2026-05-07 | ABNB | International | 14/20 | ✅ | 68% | 0.12 | +20 | NO | yes | -0.12 | -0.12 |
| 2026-05-07 | ABNB | Tailwind | 12/20 | ✅ | 60% | 0.21 | +19 | NO | yes | -0.21 | -0.21 |
| 2026-05-07 | LYFT | FreeNow / Free Now | 3/27 | ✅ | 17% | 0.04 | +79 | NO | yes | -0.04 | -0.04 |
| 2026-05-07 | LYFT | International | 7/27 | ❌ | 27% | 0.36 | +37 | NO | no | +0.64 | +0.62 |
| 2026-05-07 | LYFT | Membership | 11/27 | ❌ | 40% | 0.26 | +14 | YES | no | -0.26 | -0.26 |
| 2026-05-07 | LYFT | Mobileye | 3/27 | ✅ | 17% | 0.53 | +30 | NO | no | +0.47 | +0.46 |
| 2026-05-07 | LYFT | Waymo | 9/27 | ✅ | 37% | 0.07 | +56 | NO | yes | -0.07 | -0.07 |
| 2026-05-07 | MCD | Delivery | 46/62 | ❌ | 72% | 0.56 | +16 | YES | yes | +0.44 | +0.43 |
| 2026-05-07 | MCD | Happy Meal | 17/62 | ❌ | 28% | 0.38 | +34 | NO | yes | -0.38 | -0.38 |
| 2026-05-07 | MCD | Hot Honey | 1/62 | ❌ | 4% | 0.75 | +21 | NO | yes | -0.75 | -0.75 |
| 2026-05-07 | MCD | Loyalty | 35/62 | ✅ | 57% | 0.11 | +32 | NO | no | +0.89 | +0.86 |
| 2026-05-07 | MCD | McChicken | 12/62 | ❌ | 20% | 0.44 | +36 | NO | yes | -0.44 | -0.44 |
| 2026-05-07 | MCD | Monopoly | 16/62 | ✅ | 28% | 0.47 | +25 | NO | no | +0.53 | +0.51 |
| 2026-05-07 | MCD | Revenue | 29/62 | ✅ | 48% | 0.40 | +12 | NO | no | +0.60 | +0.58 |
| 2026-05-07 | MCD | Tariff | 4/62 | ❌ | 8% | 0.78 | +14 | NO | no | +0.22 | +0.21 |
| 2026-05-11 | HIMS | Canada | 3/20 | ✅ | 23% | 0.17 | +60 | NO | yes | -0.17 | -0.17 |
| 2026-05-11 | HIMS | Peptide | 4/20 | ✅ | 27% | 0.06 | +67 | NO | yes | -0.06 | -0.06 |
| 2026-05-11 | HIMS | Regulation | 3/20 | ❌ | 19% | 0.30 | +51 | NO | no | +0.70 | +0.68 |
| 2026-05-11 | HIMS | Vitamin | 5/20 | ✅ | 31% | 0.35 | +34 | NO | no | +0.65 | +0.63 |
| 2026-05-11 | HIMS | Zava | 2/20 | ✅ | 18% | 0.27 | +55 | NO | yes | -0.27 | -0.27 |
| 2026-05-12 | OKLO | Meta | 0/6 | ✅ | 26% | 0.10 | +64 | NO | yes | -0.10 | -0.10 |
| 2026-05-12 | OKLO | Tennessee | 1/6 | ✅ | 36% | 0.10 | +55 | NO | yes | -0.10 | -0.10 |
| 2026-05-13 | NBIS | Token | 2/9 | ✅ | 34% | 0.11 | +55 | NO | yes | -0.11 | -0.11 |
| 2026-05-14 | KLAR | Investment | 1/2 | ✅ | 58% | 0.15 | +26 | NO | no | +0.85 | +0.82 |
| 2026-05-14 | KLAR | Profitability | 2/2 | ✅ | 71% | 0.15 | +14 | NO | no | +0.85 | +0.82 |
| 2026-05-14 | KLAR | Sweden | 1/2 | ✅ | 58% | 0.16 | +26 | NO | no | +0.84 | +0.81 |
| 2026-05-19 | CAVA | Dining | 9/10 | ❌ | 73% | 0.63 | +10 | YES | no | -0.63 | -0.63 |
| 2026-05-19 | CAVA | Sweet Potato | 1/10 | ✅ | 25% | 0.49 | +26 | NO | yes | -0.49 | -0.49 |
| 2026-05-19 | HD | Competition / Competitor | 30/62 | ❌ | 48% | 0.28 | +20 | YES | yes | +0.72 | +0.70 |
| 2026-05-19 | HD | Synergy | 4/62 | ❌ | 8% | 0.46 | +46 | NO | no | +0.54 | +0.52 |
| 2026-05-19 | HD | Tariff | 14/62 | ✅ | 25% | 0.08 | +67 | NO | yes | -0.08 | -0.08 |
| 2026-05-20 | LOW | Hurricane | 29/62 | ✅ | 48% | 0.37 | +15 | NO | no | +0.63 | +0.61 |
| 2026-05-20 | LOW | Tariff | 7/62 | ✅ | 14% | 0.34 | +52 | NO | yes | -0.34 | -0.34 |
| 2026-05-20 | NVDA | Arizona | 2/61 | ❌ | 5% | 0.62 | +33 | NO | no | +0.38 | +0.37 |
| 2026-05-20 | NVDA | Cosmos | 4/61 | ✅ | 10% | 0.29 | +61 | NO | no | +0.71 | +0.69 |
| 2026-05-20 | NVDA | Domestic | 10/61 | ❌ | 18% | 0.60 | +22 | NO | no | +0.40 | +0.39 |
| 2026-05-20 | NVDA | H20 | 4/61 | ❌ | 8% | 0.45 | +47 | NO | no | +0.55 | +0.53 |
| 2026-05-20 | NVDA | Humanoid | 4/61 | ❌ | 8% | 0.44 | +48 | NO | yes | -0.44 | -0.44 |
| 2026-05-20 | NVDA | Hyperscaler | 25/61 | ✅ | 42% | 0.07 | +51 | NO | yes | -0.07 | -0.07 |
| 2026-05-20 | NVDA | Self Driving | 0/61 | ❌ | 2% | 0.26 | +72 | NO | yes | -0.26 | -0.26 |
| 2026-05-20 | NVDA | Taiwan | 10/61 | ❌ | 18% | 0.54 | +28 | NO | no | +0.46 | +0.45 |
| 2026-05-20 | NVDA | VR / Virtual Reality | 23/61 | ❌ | 38% | 0.20 | +18 | YES | no | -0.20 | -0.20 |
| 2026-05-20 | TOL | Apartment | 21/24 | ✅ | 83% | 0.72 | +11 | YES | yes | +0.28 | +0.27 |
| 2026-05-20 | TOL | Buffington / Arkansas | 0/24 | ❌ | 5% | 0.19 | +76 | NO | yes | -0.19 | -0.19 |
| 2026-05-20 | TOL | Customize / Customization | 8/24 | ✅ | 37% | 0.50 | +13 | NO | yes | -0.50 | -0.50 |
| 2026-05-20 | TOL | Headwind | 6/24 | ✅ | 30% | 0.26 | +44 | NO | no | +0.74 | +0.72 |
| 2026-05-20 | TOL | Lumber | 12/24 | ✅ | 51% | 0.35 | +14 | NO | yes | -0.35 | -0.35 |
| 2026-05-20 | TOL | Millennial | 18/24 | ✅ | 73% | 0.51 | +22 | YES | no | -0.51 | -0.51 |
| 2026-05-20 | TOL | Tariff | 5/24 | ✅ | 26% | 0.53 | +21 | NO | yes | -0.53 | -0.53 |
| 2026-05-20 | URBN | Holiday | 44/56 | ✅ | 77% | 0.60 | +17 | YES | no | -0.60 | -0.60 |
| 2026-05-20 | URBN | Tariff | 8/56 | ✅ | 17% | 0.10 | +73 | NO | yes | -0.10 | -0.10 |
| 2026-05-21 | BULL | Buyback / Repurchase | 0/3 | ❌ | 22% | 0.23 | +55 | NO | yes | -0.23 | -0.23 |
| 2026-05-21 | BULL | Kalshi | 3/3 | ❌ | 58% | 0.29 | +29 | YES | no | -0.29 | -0.29 |
| 2026-05-21 | BULL | Token / Tokenized | 2/3 | ❌ | 46% | 0.40 | +14 | NO | no | +0.60 | +0.58 |
| 2026-05-21 | DE | AI / Artificial Intelligence | 4/63 | ✅ | 10% | 0.33 | +57 | NO | no | +0.67 | +0.65 |
| 2026-05-21 | DE | Tariff | 16/63 | ✅ | 27% | 0.11 | +62 | NO | yes | -0.11 | -0.11 |
| 2026-05-21 | DE | Weather | 44/63 | ❌ | 68% | 0.40 | +28 | YES | no | -0.40 | -0.40 |
| 2026-05-21 | WMT | Dividend | 39/58 | ❌ | 65% | 0.23 | +12 | NO | no | +0.77 | +0.75 |
| 2026-05-21 | WMT | OnePay / One Pay | 2/58 | ✅ | 7% | 0.27 | +66 | NO | no | +0.73 | +0.71 |
| 2026-05-21 | WMT | OpenAI | 1/58 | ✅ | 5% | 0.29 | +66 | NO | no | +0.71 | +0.69 |
| 2026-05-21 | WMT | Prescription | 23/58 | ❌ | 39% | 0.13 | +26 | YES | yes | +0.87 | +0.84 |
| 2026-05-21 | WMT | Tariff | 32/58 | ✅ | 55% | 0.24 | +21 | NO | yes | -0.24 | -0.24 |
| 2026-05-21 | WMT | Upper Income | 1/58 | ❌ | 4% | 0.70 | +26 | NO | no | +0.30 | +0.29 |
| 2026-05-27 | CRM | AgentForce / Agent Force | 6/62 | ✅ | 13% | 0.07 | +80 | NO | yes | -0.07 | -0.07 |
| 2026-05-27 | CRM | Consumption | 9/62 | ✅ | 17% | 0.16 | +67 | NO | yes | -0.16 | -0.16 |
| 2026-05-27 | CRM | Trillion | 19/62 | ✅ | 32% | 0.20 | +48 | NO | yes | -0.20 | -0.20 |
| 2026-05-27 | MRVL | Electro-Optic / Electro Optic | 17/44 | ✅ | 40% | 0.15 | +45 | NO | no | +0.85 | +0.82 |
| 2026-05-27 | MRVL | Hyperscaler | 20/44 | ✅ | 47% | 0.17 | +36 | NO | yes | -0.17 | -0.17 |
| 2026-05-27 | MRVL | LPO | 3/44 | ❌ | 9% | 0.41 | +50 | NO | no | +0.59 | +0.57 |
| 2026-05-27 | MRVL | Nvidia | 8/44 | ❌ | 20% | 0.41 | +39 | NO | yes | -0.41 | -0.41 |
| 2026-05-27 | MRVL | Trainium | 1/44 | ❌ | 5% | 0.84 | +11 | NO | no | +0.16 | +0.16 |
| 2026-05-27 | SNOW | Europe | 13/21 | ✅ | 61% | 0.38 | +23 | YES | no | -0.38 | -0.38 |
| 2026-05-27 | SNOW | Repurchase | 12/21 | ✅ | 57% | 0.10 | +33 | NO | yes | -0.10 | -0.10 |
| 2026-05-28 | COST | Dividend | 45/63 | ✅ | 71% | 0.51 | +20 | YES | yes | +0.49 | +0.48 |
| 2026-05-28 | COST | Gold Bar | 2/63 | ✅ | 7% | 0.83 | +10 | NO | no | +0.17 | +0.16 |
| 2026-05-28 | COST | Instacart | 39/63 | ✅ | 62% | 0.26 | +12 | NO | yes | -0.26 | -0.26 |
| 2026-05-28 | COST | Kirkland | 45/63 | ✅ | 71% | 0.09 | +20 | NO | yes | -0.09 | -0.09 |
| 2026-05-28 | COST | Revenue | 28/63 | ✅ | 45% | 0.32 | +23 | NO | yes | -0.32 | -0.32 |
| 2026-05-28 | COST | Tariff | 13/63 | ✅ | 23% | 0.08 | +69 | NO | yes | -0.08 | -0.08 |
| 2026-05-28 | DELL | Nvidia | 9/19 | ❌ | 45% | 0.31 | +24 | NO | yes | -0.31 | -0.31 |
| 2026-05-28 | DELL | Texas | 1/19 | ❌ | 11% | 0.66 | +23 | NO | no | +0.34 | +0.33 |
| 2026-06-01 | HPE | Morpheus | 5/19 | ❌ | 28% | 0.51 | +21 | NO | yes | -0.51 | -0.51 |
| 2026-06-02 | ULTA | Google / Gemini | 2/19 | ❌ | 15% | 0.18 | +67 | NO | yes | -0.18 | -0.18 |
| 2026-06-02 | ULTA | Holiday | 17/19 | ✅ | 84% | 0.73 | +11 | YES | no | -0.73 | -0.73 |
| 2026-06-02 | ULTA | Middle East | 3/19 | ✅ | 24% | 0.27 | +49 | NO | yes | -0.27 | -0.27 |
| 2026-06-02 | ULTA | Rare Beauty | 0/19 | ✅ | 11% | 0.37 | +52 | NO | yes | -0.37 | -0.37 |
| 2026-06-02 | ULTA | Space NK | 2/19 | ✅ | 19% | 0.06 | +75 | NO | yes | -0.06 | -0.06 |
| 2026-06-02 | ULTA | Store Opening | 8/19 | ❌ | 41% | 0.43 | +16 | NO | no | +0.57 | +0.55 |
| 2026-06-02 | ULTA | Tailwind | 8/19 | ❌ | 41% | 0.28 | +13 | YES | no | -0.28 | -0.28 |
| 2026-06-02 | ULTA | Tariff | 4/19 | ❌ | 24% | 0.64 | +12 | NO | no | +0.36 | +0.35 |
| 2026-06-02 | ULTA | Traffic | 17/19 | ❌ | 80% | 0.58 | +22 | YES | yes | +0.42 | +0.41 |
| 2026-06-02 | ULTA | Uncertainty | 10/19 | ✅ | 54% | 0.14 | +32 | NO | yes | -0.14 | -0.14 |
| 2026-06-02 | VSCO | AI / Artificial Intelligence | 2/5 | ❌ | 38% | 0.25 | +13 | YES | no | -0.25 | -0.25 |
| 2026-06-02 | VSCO | Conversion | 4/5 | ✅ | 70% | 0.57 | +13 | YES | no | -0.57 | -0.57 |
| 2026-06-02 | VSCO | Fragrance | 3/5 | ✅ | 60% | 0.09 | +31 | NO | yes | -0.09 | -0.09 |
| 2026-06-02 | VSCO | Hailey Bieber | 1/5 | ❌ | 27% | 0.62 | +11 | NO | yes | -0.62 | -0.62 |
| 2026-06-02 | VSCO | Sport Bra / Sports Bra | 3/5 | ✅ | 60% | 0.25 | +15 | NO | yes | -0.25 | -0.25 |
| 2026-06-02 | VSCO | Tariff | 0/5 | ✅ | 29% | 0.05 | +66 | NO | yes | -0.05 | -0.05 |
| 2026-06-02 | VSCO | Ticker | 0/5 | ❌ | 17% | 0.26 | +57 | NO | yes | -0.26 | -0.26 |
| 2026-06-03 | AVGO | Acquisition | 37/43 | ❌ | 82% | 0.50 | +32 | YES | no | -0.50 | -0.50 |
| 2026-06-03 | AVGO | Competition | 15/43 | ✅ | 37% | 0.40 | +23 | NO | no | +0.60 | +0.58 |
| 2026-06-03 | AVGO | Hyperscaler | 17/43 | ✅ | 41% | 0.07 | +52 | NO | yes | -0.07 | -0.07 |
| 2026-06-03 | AVGO | Quantum | 0/43 | ❌ | 3% | 0.86 | +11 | NO | no | +0.14 | +0.14 |
| 2026-06-03 | CRWD | China | 3/27 | ❌ | 15% | 0.64 | +21 | NO | no | +0.36 | +0.35 |
| 2026-06-03 | CRWD | Germany | 0/27 | ❌ | 5% | 0.36 | +59 | NO | no | +0.64 | +0.62 |
| 2026-06-03 | CRWD | Headwind | 6/27 | ❌ | 24% | 0.51 | +25 | NO | no | +0.49 | +0.48 |
| 2026-06-03 | CRWD | SGNL / Signal | 5/27 | ✅ | 24% | 0.19 | +57 | NO | yes | -0.19 | -0.19 |
| 2026-06-04 | LULU | Headwind | 29/55 | ✅ | 53% | 0.26 | +21 | NO | yes | -0.26 | -0.26 |
| 2026-06-04 | LULU | Holiday | 44/55 | ❌ | 77% | 0.11 | +66 | YES | no | -0.11 | -0.11 |
| 2026-06-08 | MTN | Gen Z | 0/25 | ✅ | 8% | 0.36 | +56 | NO | no | +0.64 | +0.62 |
| 2026-06-08 | MTN | Snowpack | 2/25 | ✅ | 15% | 0.47 | +38 | NO | no | +0.53 | +0.51 |
| 2026-06-09 | CBRL | 250 | 1/29 | ❌ | 8% | 0.52 | +40 | NO | yes | -0.52 | -0.52 |
| 2026-06-09 | CBRL | Location | 22/29 | ❌ | 71% | 0.30 | +41 | YES | no | -0.30 | -0.30 |
| 2026-06-09 | CBRL | Meals for Two | 1/29 | ✅ | 10% | 0.69 | +21 | NO | no | +0.31 | +0.30 |
| 2026-06-09 | CBRL | Tariff | 8/29 | ✅ | 31% | 0.20 | +49 | NO | yes | -0.20 | -0.20 |
| 2026-06-10 | CHWY | App | 12/23 | ✅ | 53% | 0.08 | +39 | NO | yes | -0.08 | -0.08 |
| 2026-06-10 | CHWY | Modern Animal | 0/23 | ❌ | 6% | 0.04 | +90 | NO | yes | -0.04 | -0.04 |
| 2026-06-10 | ORCL | Automation | 28/62 | ✅ | 46% | 0.41 | +13 | NO | no | +0.59 | +0.57 |
| 2026-06-10 | ORCL | Backlog | 18/62 | ✅ | 31% | 0.25 | +44 | NO | no | +0.75 | +0.73 |
| 2026-06-10 | ORCL | Health | 34/62 | ✅ | 55% | 0.34 | +11 | NO | yes | -0.34 | -0.34 |
| 2026-06-10 | ORCL | Multicloud | 1/62 | ❌ | 4% | 0.08 | +88 | NO | yes | -0.08 | -0.08 |
| 2026-06-11 | ADBE | 3D | 29/58 | ✅ | 51% | 0.17 | +32 | NO | yes | -0.17 | -0.17 |
| 2026-06-18 | KR | AI / Artificial Intelligence | 9/22 | ✅ | 44% | 0.06 | +50 | NO | yes | -0.06 | -0.06 |
| 2026-06-23 | CCL | Celebration Key | 10/27 | ✅ | 40% | 0.04 | +56 | NO | yes | -0.04 | -0.04 |
| 2026-06-23 | CCL | Dividend | 11/27 | ✅ | 43% | 0.25 | +32 | NO | yes | -0.25 | -0.25 |
| 2026-06-23 | FDX | De Minimis | 5/54 | ✅ | 13% | 0.25 | +62 | NO | yes | -0.25 | -0.25 |
| 2026-06-23 | FDX | Dividend | 33/54 | ✅ | 61% | 0.20 | +19 | NO | yes | -0.20 | -0.20 |
| 2026-06-24 | MU | Anthropic | 0/63 | ❌ | 2% | 0.24 | +74 | NO | no | +0.76 | +0.74 |
| 2026-06-24 | MU | Hyperscaler | 7/63 | ❌ | 13% | 0.77 | +10 | NO | yes | -0.77 | -0.77 |
| 2026-06-24 | MU | Inventory | 57/63 | ✅ | 89% | 0.50 | +39 | YES | no | -0.50 | -0.50 |
| 2026-06-24 | MU | Nvidia | 18/63 | ✅ | 30% | 0.58 | +12 | NO | yes | -0.58 | -0.58 |
| 2026-06-29 | AVAV | Backpackable | 1/26 | ❌ | 8% | 0.64 | +28 | NO | no | +0.36 | +0.35 |
| 2026-06-29 | AVAV | Golden Dome | 2/26 | ✅ | 15% | 0.25 | +60 | NO | yes | -0.25 | -0.25 |
| 2026-06-29 | AVAV | Headwind | 11/26 | ✅ | 45% | 0.41 | +14 | NO | no | +0.59 | +0.57 |
| 2026-06-29 | AVAV | Tailwind | 1/26 | ❌ | 8% | 0.60 | +32 | NO | yes | -0.60 | -0.60 |
| 2026-06-29 | AVAV | Taiwan | 5/26 | ✅ | 25% | 0.39 | +36 | NO | no | +0.61 | +0.59 |
| 2026-06-29 | PEP | Autonomous | 0/28 | ❌ | 5% | 0.83 | +12 | NO | no | +0.17 | +0.16 |
| 2026-06-30 | NKE | Consumer Demand | 44/63 | ❌ | 68% | 0.19 | +49 | YES | no | -0.19 | -0.19 |
| 2026-06-30 | NKE | Tariff | 9/63 | ✅ | 17% | 0.14 | +69 | NO | yes | -0.14 | -0.14 |
| 2026-07-01 | GIS | Iran / Middle East | 8/10 | ✅ | 74% | 0.15 | +59 | YES | no | -0.15 | -0.15 |
| 2026-07-01 | GIS | Wilderness | 5/10 | ✅ | 53% | 0.36 | +17 | YES | yes | +0.64 | +0.62 |
| 2026-07-01 | GIS | World Cup | 1/10 | ❌ | 18% | 0.59 | +23 | NO | no | +0.41 | +0.40 |
| 2026-07-01 | STZ | Inflation | 25/43 | ❌ | 56% | 0.33 | +23 | YES | yes | +0.67 | +0.65 |
| 2026-07-01 | STZ | Mi Campo | 8/43 | ✅ | 22% | 0.59 | +19 | NO | yes | -0.59 | -0.59 |
| 2026-07-02 | NFLX | Ad-Supported | 15/63 | ❌ | 25% | 0.61 | +14 | NO | no | +0.39 | +0.38 |
| 2026-07-02 | NFLX | Hollywood | 21/63 | ✅ | 35% | 0.52 | +13 | NO | no | +0.48 | +0.47 |
| 2026-07-02 | NFLX | KPop Demon Hunters | 0/63 | ❌ | 2% | 0.71 | +27 | NO | yes | -0.71 | -0.71 |
| 2026-07-02 | NFLX | Live Event | 13/63 | ✅ | 23% | 0.16 | +61 | NO | yes | -0.16 | -0.16 |
| 2026-07-02 | NFLX | NFL | 11/63 | ✅ | 20% | 0.16 | +64 | NO | no | +0.84 | +0.81 |
| 2026-07-02 | NFLX | Paramount | 9/63 | ✅ | 17% | 0.71 | +12 | NO | no | +0.29 | +0.28 |
| 2026-07-02 | NFLX | Partnership | 37/63 | ✅ | 59% | 0.25 | +16 | NO | yes | -0.25 | -0.25 |
| 2026-07-02 | NFLX | Subscriber | 56/63 | ✅ | 87% | 0.59 | +28 | YES | yes | +0.41 | +0.40 |
| 2026-07-02 | NFLX | World Cup | 4/63 | ✅ | 10% | 0.46 | +44 | NO | no | +0.54 | +0.52 |
| 2026-07-08 | LEVI | Dockers | 51/59 | ✅ | 85% | 0.57 | +28 | YES | yes | +0.43 | +0.42 |
| 2026-07-08 | LEVI | Jordan | 25/59 | ✅ | 43% | 0.40 | +17 | NO | no | +0.60 | +0.58 |
| 2026-07-08 | LEVI | Nike | 8/59 | ✅ | 16% | 0.55 | +29 | NO | no | +0.45 | +0.44 |
| 2026-07-08 | LEVI | World Cup | 1/59 | ✅ | 5% | 0.37 | +58 | NO | yes | -0.37 | -0.37 |
| 2026-07-10 | DAL | Headwind | 17/28 | ✅ | 60% | 0.26 | +14 | NO | yes | -0.26 | -0.26 |
| 2026-07-10 | DAL | Oil | 3/28 | ✅ | 17% | 0.31 | +52 | NO | no | +0.69 | +0.67 |
| 2026-07-10 | DAL | Tailwind | 18/28 | ❌ | 61% | 0.35 | +26 | YES | no | -0.35 | -0.35 |
| 2026-07-10 | DAL | Tariff | 9/28 | ✅ | 36% | 0.29 | +35 | NO | no | +0.71 | +0.69 |
| 2026-07-10 | DAL | Weather | 15/28 | ✅ | 54% | 0.26 | +20 | NO | no | +0.74 | +0.72 |
| 2026-07-14 | BAC | CashPro | 21/63 | ✅ | 35% | 0.45 | +20 | NO | no | +0.55 | +0.53 |
| 2026-07-14 | BAC | M&A / Merger | 38/63 | ✅ | 60% | 0.22 | +18 | NO | no | +0.78 | +0.76 |
| 2026-07-14 | BAC | Tariff | 5/63 | ✅ | 11% | 0.45 | +44 | NO | no | +0.55 | +0.53 |
| 2026-07-14 | JPM | Inflation | 21/44 | ❌ | 47% | 0.33 | +20 | NO | yes | -0.33 | -0.33 |
| 2026-07-14 | WFC | AI / Artificial Intelligence | 9/28 | ✅ | 36% | 0.16 | +48 | NO | yes | -0.16 | -0.16 |
| 2026-07-14 | WFC | Severance | 12/28 | ✅ | 45% | 0.45 | +10 | NO | no | +0.55 | +0.53 |
| 2026-07-15 | JNJ | Administration | 16/44 | ❌ | 36% | 0.50 | +14 | NO | no | +0.50 | +0.48 |
| 2026-07-15 | JNJ | Halda Therapeutics | 1/44 | ✅ | 7% | 0.65 | +28 | NO | yes | -0.65 | -0.65 |
| 2026-07-15 | JNJ | Nipocalimab / Lupus | 18/44 | ❌ | 41% | 0.40 | +19 | NO | no | +0.60 | +0.58 |
| 2026-07-16 | UAL | Holiday | 10/24 | ❌ | 41% | 0.13 | +28 | YES | no | -0.13 | -0.13 |
| 2026-07-16 | UAL | Middle East | 7/24 | ✅ | 34% | 0.53 | +13 | NO | yes | -0.53 | -0.53 |
| 2026-07-16 | UAL | Oil | 3/24 | ✅ | 19% | 0.35 | +46 | NO | yes | -0.35 | -0.35 |
| 2026-07-16 | UAL | Red Eye | 1/24 | ✅ | 12% | 0.60 | +28 | NO | no | +0.40 | +0.39 |
| 2026-07-16 | UAL | Union | 13/24 | ❌ | 52% | 0.31 | +21 | YES | no | -0.31 | -0.31 |
| 2026-07-17 | HOOD | Blockchain | 4/19 | ❌ | 24% | 0.51 | +25 | NO | yes | -0.51 | -0.51 |
| 2026-07-17 | HOOD | Concierge | 0/19 | ✅ | 11% | 0.68 | +21 | NO | no | +0.32 | +0.31 |
| 2026-07-17 | HOOD | Social | 7/19 | ✅ | 41% | 0.08 | +51 | NO | yes | -0.08 | -0.08 |
| 2026-07-20 | DPZ | Best Deal Ever | 4/62 | ✅ | 10% | 0.28 | +62 | NO | yes | -0.28 | -0.28 |
| 2026-07-20 | DPZ | DomOS | 2/62 | ✅ | 7% | 0.46 | +47 | NO | no | +0.54 | +0.52 |
| 2026-07-20 | DPZ | Soccer / World Cup | 4/62 | ❌ | 8% | 0.73 | +19 | NO | yes | -0.73 | -0.73 |
| 2026-07-21 | ALLY | Basel | 3/20 | ✅ | 23% | 0.61 | +16 | NO | no | +0.39 | +0.38 |
| 2026-07-21 | ALLY | EV / Electric | 11/20 | ❌ | 52% | 0.31 | +21 | YES | yes | +0.69 | +0.67 |
| 2026-07-21 | ALLY | Oil | 0/20 | ✅ | 10% | 0.45 | +45 | NO | yes | -0.45 | -0.45 |
| 2026-07-21 | ALLY | Rate Cut / Cut Rate | 12/20 | ❌ | 56% | 0.36 | +20 | YES | no | -0.36 | -0.36 |
| 2026-07-22 | ALK | Iran / Middle East | 0/18 | ❌ | 7% | 0.81 | +12 | NO | no | +0.19 | +0.18 |
| 2026-07-22 | ALK | Tailwind | 15/18 | ❌ | 74% | 0.39 | +35 | YES | yes | +0.61 | +0.59 |
| 2026-07-22 | GEV | Blade | 7/8 | ❌ | 69% | 0.21 | +48 | YES | no | -0.21 | -0.21 |
| 2026-07-22 | GOOGL | Autonomous | 25/61 | ✅ | 42% | 0.24 | +34 | NO | no | +0.76 | +0.74 |
| 2026-07-22 | GOOGL | Gemini 3 | 2/61 | ✅ | 7% | 0.25 | +68 | NO | no | +0.75 | +0.73 |
| 2026-07-22 | GOOGL | Ironwood | 3/61 | ✅ | 8% | 0.75 | +17 | NO | no | +0.25 | +0.24 |
| 2026-07-22 | GOOGL | Nano Banana | 2/61 | ✅ | 7% | 0.45 | +48 | NO | no | +0.55 | +0.53 |
| 2026-07-22 | GOOGL | Nvidia | 12/61 | ✅ | 22% | 0.32 | +46 | NO | yes | -0.32 | -0.32 |
| 2026-07-22 | GOOGL | Privacy | 26/61 | ❌ | 42% | 0.18 | +24 | YES | no | -0.18 | -0.18 |
| 2026-07-22 | GOOGL | Regulator / Regulation / Regulatory | 20/61 | ❌ | 33% | 0.16 | +17 | YES | no | -0.16 | -0.16 |
| 2026-07-22 | GOOGL | Search Advertising / Search Ad | 41/61 | ❌ | 65% | 0.30 | +35 | YES | yes | +0.70 | +0.68 |
| 2026-07-22 | GOOGL | Tailwind | 19/61 | ✅ | 33% | 0.29 | +38 | NO | yes | -0.29 | -0.29 |
| 2026-07-22 | GOOGL | Wiz | 1/61 | ✅ | 5% | 0.32 | +63 | NO | yes | -0.32 | -0.32 |
| 2026-07-22 | GOOGL | Youtube Shorts | 18/61 | ❌ | 30% | 0.59 | +11 | NO | no | +0.41 | +0.40 |
| 2026-07-22 | TSLA | Affordable | 37/62 | ✅ | 60% | 0.29 | +11 | NO | yes | -0.29 | -0.29 |
| 2026-07-22 | TSLA | Competition | 13/62 | ✅ | 23% | 0.30 | +47 | NO | yes | -0.30 | -0.30 |
| 2026-07-22 | TSLA | Cybercab | 6/62 | ✅ | 13% | 0.03 | +84 | NO | yes | -0.03 | -0.03 |
| 2026-07-22 | TSLA | Gigafactory | 33/62 | ❌ | 52% | 0.29 | +23 | YES | no | -0.29 | -0.29 |
| 2026-07-22 | TSLA | Grok (3+ times) | 0/62 | ❌ | 2% | 0.42 | +56 | NO | yes | -0.42 | -0.42 |
| 2026-07-22 | TSLA | Intel | 5/62 | ✅ | 11% | 0.69 | +20 | NO | no | +0.31 | +0.30 |
| 2026-07-22 | TSLA | Iran / Middle East | 0/62 | ❌ | 2% | 0.86 | +12 | NO | no | +0.14 | +0.14 |
| 2026-07-22 | TSLA | Merge / Merger | 1/62 | ❌ | 4% | 0.67 | +29 | NO | no | +0.33 | +0.32 |
| 2026-07-22 | TSLA | Miami | 1/62 | ❌ | 4% | 0.15 | +81 | NO | no | +0.85 | +0.82 |
| 2026-07-22 | TSLA | Powerwall | 32/62 | ❌ | 51% | 0.39 | +10 | NO | no | +0.61 | +0.59 |
| 2026-07-22 | TSLA | Safety Monitor | 1/62 | ❌ | 4% | 0.80 | +16 | NO | yes | -0.80 | -0.80 |
| 2026-07-22 | TSLA | Supercharger / Super Charger | 30/62 | ✅ | 49% | 0.34 | +15 | YES | yes | +0.66 | +0.64 |
| 2026-07-22 | TSLA | Six-Seater / Six-Seat | 0/62 | ❌ | 2% | 0.64 | +34 | NO | no | +0.36 | +0.35 |
| 2026-07-23 | AAL | AT&T | 4/24 | ✅ | 23% | 0.35 | +42 | NO | no | +0.65 | +0.63 |
| 2026-07-23 | AAL | Basic Economy | 4/24 | ✅ | 23% | 0.42 | +35 | NO | yes | -0.42 | -0.42 |
| 2026-07-23 | AAL | World Cup | 1/24 | ✅ | 12% | 0.41 | +47 | NO | no | +0.59 | +0.57 |
| 2026-07-23 | INTC | Desktop | 46/63 | ❌ | 71% | 0.39 | +32 | YES | no | -0.39 | -0.39 |
| 2026-07-23 | INTC | Government | 31/63 | ❌ | 48% | 0.21 | +31 | NO | no | +0.79 | +0.77 |
| 2026-07-23 | INTC | Nvidia | 8/63 | ✅ | 15% | 0.20 | +65 | NO | no | +0.80 | +0.78 |
| 2026-07-23 | INTC | Ultra 3 / Ultra Series 3 | 1/63 | ✅ | 5% | 0.43 | +52 | NO | no | +0.57 | +0.55 |
| 2026-07-23 | LMT | NASA | 28/64 | ✅ | 45% | 0.03 | +42 | YES | yes | +0.97 | +0.94 |
| 2026-07-23 | LMT | Sikorsky | 42/64 | ✅ | 65% | 0.10 | +25 | NO | yes | -0.10 | -0.10 |
| 2026-07-24 | AXP | Basel | 8/58 | ✅ | 17% | 0.06 | +11 | YES | no | -0.06 | -0.06 |
| 2026-07-24 | AXP | Lounge | 29/58 | ✅ | 51% | 0.23 | +26 | NO | yes | -0.23 | -0.23 |
| 2026-07-24 | AXP | Regulation / Regulatory | 43/58 | ✅ | 73% | 0.28 | +45 | YES | no | -0.28 | -0.28 |
| 2026-07-24 | BULL | BlackRock | 3/4 | ❌ | 53% | 0.31 | +22 | YES | no | -0.31 | -0.31 |
| 2026-07-24 | BULL | MCP | 0/4 | ✅ | 33% | 0.27 | +40 | NO | yes | -0.27 | -0.27 |
| 2026-07-24 | BULL | MiCAR | 0/4 | ❌ | 19% | 0.52 | +29 | NO | no | +0.48 | +0.47 |
| 2026-07-24 | BULL | PDT / Pattern Day Trader | 0/4 | ✅ | 33% | 0.29 | +38 | NO | yes | -0.29 | -0.29 |
| 2026-07-24 | BULL | Self Clearing | 0/4 | ❌ | 19% | 0.55 | +26 | NO | no | +0.45 | +0.44 |
| 2026-07-24 | BULL | Tampa Bay | 0/4 | ✅ | 33% | 0.21 | +12 | YES | yes | +0.79 | +0.77 |
| 2026-07-24 | BULL | Thailand | 1/4 | ❌ | 30% | 0.39 | +31 | NO | yes | -0.39 | -0.39 |
| 2026-07-24 | BULL | Token / Tokenized | 2/4 | ❌ | 41% | 0.24 | +17 | YES | yes | +0.76 | +0.74 |
| 2026-07-24 | BULL | Vega (5+ times) | 0/4 | ❌ | 19% | 0.60 | +21 | NO | yes | -0.60 | -0.60 |
| 2026-07-24 | VZ | Home / MyHome | 26/28 | ✅ | 88% | 0.62 | +26 | YES | yes | +0.38 | +0.37 |
| 2026-07-24 | VZ | Rural | 10/28 | ❌ | 36% | 0.19 | +17 | YES | yes | +0.81 | +0.79 |
| 2026-07-28 | BA | Airbus | 24/46 | ❌ | 51% | 0.18 | +33 | YES | no | -0.18 | -0.18 |
| 2026-07-28 | BA | Space | 44/46 | ✅ | 93% | 0.76 | +17 | YES | yes | +0.24 | +0.23 |
| 2026-07-28 | F | AI / Artificial Intelligence | 15/29 | ✅ | 53% | 0.37 | +10 | NO | no | +0.63 | +0.61 |
| 2026-07-28 | F | Geely | 0/29 | ❌ | 5% | 0.60 | +35 | NO | yes | -0.60 | -0.60 |
| 2026-07-28 | F | Oakville | 3/29 | ✅ | 16% | 0.56 | +28 | NO | yes | -0.56 | -0.56 |
| 2026-07-28 | F | Skunk Works | 0/29 | ✅ | 7% | 0.65 | +28 | NO | no | +0.35 | +0.34 |
| 2026-07-28 | F | Tailwind | 12/29 | ❌ | 41% | 0.24 | +17 | YES | yes | +0.76 | +0.74 |
| 2026-07-28 | PYPL | Biometric | 7/42 | ✅ | 20% | 0.34 | +46 | NO | no | +0.66 | +0.64 |
| 2026-07-28 | PYPL | Google | 18/42 | ❌ | 42% | 0.22 | +20 | YES | no | -0.22 | -0.22 |
| 2026-07-28 | PYPL | Regulation / Regulator / Regulatory | 22/42 | ❌ | 51% | 0.25 | +26 | YES | no | -0.25 | -0.25 |
| 2026-07-28 | PYPL | Stablecoin / Stable Coin | 5/42 | ✅ | 16% | 0.35 | +49 | NO | no | +0.65 | +0.63 |
| 2026-07-28 | PYPL | Stripe | 2/42 | ❌ | 8% | 0.72 | +20 | NO | no | +0.28 | +0.27 |
| 2026-07-29 | META | Advertising | 55/55 | ❌ | 96% | 0.80 | +16 | YES | no | -0.80 | -0.80 |
| 2026-07-29 | META | Algorithm | 13/55 | ✅ | 26% | 0.52 | +22 | NO | no | +0.48 | +0.47 |
| 2026-07-29 | META | Cloud | 10/55 | ✅ | 21% | 0.11 | +68 | NO | yes | -0.11 | -0.11 |
| 2026-07-29 | META | Dividend | 12/55 | ❌ | 23% | 0.66 | +11 | NO | no | +0.34 | +0.33 |
| 2026-07-29 | META | Hiring | 39/55 | ✅ | 70% | 0.15 | +15 | NO | no | +0.85 | +0.82 |
| 2026-07-29 | META | Hyperion | 1/55 | ❌ | 4% | 0.61 | +35 | NO | no | +0.39 | +0.38 |
| 2026-07-29 | META | Silicon | 6/55 | ✅ | 14% | 0.39 | +47 | NO | yes | -0.39 | -0.39 |
| 2026-07-29 | MSFT | Anthropic | 2/63 | ✅ | 7% | 0.49 | +44 | NO | yes | -0.49 | -0.49 |
| 2026-07-29 | MSFT | Cybersecurity | 15/63 | ✅ | 26% | 0.62 | +12 | NO | no | +0.38 | +0.37 |
| 2026-07-29 | MSFT | Frontier | 13/63 | ✅ | 23% | 0.51 | +26 | NO | yes | -0.51 | -0.51 |
| 2026-07-29 | MSFT | Maia | 5/63 | ✅ | 11% | 0.46 | +43 | NO | yes | -0.46 | -0.46 |
| 2026-07-29 | MSFT | Windows 11 | 19/63 | ❌ | 31% | 0.58 | +11 | NO | no | +0.42 | +0.41 |
| 2026-07-29 | SBUX | Boyu | 1/45 | ✅ | 7% | 0.38 | +55 | NO | no | +0.62 | +0.60 |
| 2026-07-29 | SBUX | Canada | 18/45 | ❌ | 40% | 0.14 | +26 | YES | yes | +0.86 | +0.83 |
| 2026-07-29 | SBUX | Comparable Sales | 12/45 | ✅ | 29% | 0.52 | +19 | NO | yes | -0.52 | -0.52 |
| 2026-07-29 | SBUX | Loyalty | 36/45 | ✅ | 78% | 0.60 | +18 | YES | yes | +0.40 | +0.39 |
| 2026-07-29 | SBUX | Matcha | 5/45 | ✅ | 15% | 0.61 | +24 | NO | yes | -0.61 | -0.61 |
| 2026-07-29 | SBUX | Non Dairy | 0/45 | ❌ | 3% | 0.76 | +21 | NO | no | +0.24 | +0.23 |
| 2026-07-29 | SBUX | Promotion | 26/45 | ❌ | 56% | 0.40 | +16 | YES | no | -0.40 | -0.40 |
| 2026-07-29 | SBUX | Protein | 11/45 | ✅ | 27% | 0.13 | +60 | NO | no | +0.87 | +0.84 |
| 2026-07-29 | SBUX | Smart Queue / SmartQ | 3/45 | ✅ | 11% | 0.36 | +53 | NO | yes | -0.36 | -0.36 |
| 2026-07-29 | WING | Tajín | 0/32 | ❌ | 4% | 0.47 | +49 | NO | no | +0.53 | +0.51 |
| 2026-07-29 | WING | Tender | 14/32 | ✅ | 45% | 0.27 | +28 | NO | no | +0.73 | +0.71 |
| 2026-07-30 | AAPL | Broadcom | 0/60 | ❌ | 2% | 0.37 | +61 | NO | yes | -0.37 | -0.37 |
| 2026-07-30 | AAPL | Formula 1 / F1 | 5/60 | ❌ | 10% | 0.31 | +59 | NO | yes | -0.31 | -0.31 |
| 2026-07-30 | AAPL | Gemini | 1/60 | ❌ | 4% | 0.62 | +34 | NO | no | +0.38 | +0.37 |
| 2026-07-30 | AAPL | Manufacturing | 36/60 | ✅ | 60% | 0.23 | +17 | NO | yes | -0.23 | -0.23 |
| 2026-07-30 | AAPL | Modem | 6/60 | ✅ | 13% | 0.54 | +33 | NO | no | +0.46 | +0.45 |
| 2026-07-30 | AAPL | OpenAI / ChatGPT | 4/60 | ❌ | 9% | 0.74 | +17 | NO | no | +0.26 | +0.25 |
| 2026-07-30 | AAPL | Siri | 32/60 | ✅ | 54% | 0.07 | +39 | NO | yes | -0.07 | -0.07 |
| 2026-07-30 | AAPL | Sport | 20/60 | ✅ | 35% | 0.33 | +32 | NO | yes | -0.33 | -0.33 |
| 2026-07-30 | AAPL | Tariff | 11/60 | ✅ | 21% | 0.05 | +74 | NO | yes | -0.05 | -0.05 |
| 2026-07-30 | AMZN | Alexa+ / Alexa Plus | 4/63 | ✅ | 10% | 0.29 | +61 | NO | yes | -0.29 | -0.29 |
| 2026-07-30 | AMZN | Anthropic | 12/63 | ✅ | 21% | 0.18 | +61 | NO | yes | -0.18 | -0.18 |
| 2026-07-30 | AMZN | China | 26/63 | ❌ | 41% | 0.25 | +16 | YES | no | -0.25 | -0.25 |
| 2026-07-30 | AMZN | Data Center | 26/63 | ✅ | 42% | 0.16 | +42 | NO | yes | -0.16 | -0.16 |
| 2026-07-30 | AMZN | Drone | 4/63 | ❌ | 8% | 0.75 | +17 | NO | no | +0.25 | +0.24 |
| 2026-07-30 | AMZN | Gen-AI / Generative AI | 12/63 | ✅ | 21% | 0.26 | +53 | NO | yes | -0.26 | -0.26 |
| 2026-07-30 | AMZN | Iran / Middle East | 8/63 | ❌ | 14% | 0.49 | +37 | NO | yes | -0.49 | -0.49 |
| 2026-07-30 | AMZN | OpenAI | 2/63 | ✅ | 7% | 0.31 | +62 | NO | yes | -0.31 | -0.31 |
| 2026-07-30 | AMZN | Pinterest | 3/63 | ❌ | 7% | 0.60 | +33 | NO | yes | -0.60 | -0.60 |
| 2026-07-30 | AMZN | Prime Day | 30/63 | ✅ | 48% | 0.03 | +49 | NO | yes | -0.03 | -0.03 |
| 2026-07-30 | AMZN | Amazon Leo / Project Kuiper | 8/63 | ✅ | 15% | 0.19 | +66 | NO | yes | -0.19 | -0.19 |
| 2026-07-30 | AMZN | Robotic / Robotics | 17/63 | ✅ | 29% | 0.28 | +43 | NO | yes | -0.28 | -0.28 |
| 2026-07-30 | AMZN | Rufus | 6/63 | ✅ | 12% | 0.30 | +58 | NO | no | +0.70 | +0.68 |
| 2026-07-30 | AMZN | Snowflake | 0/63 | ❌ | 2% | 0.80 | +18 | NO | yes | -0.80 | -0.80 |
| 2026-07-30 | AMZN | Sponsored Products | 16/63 | ❌ | 26% | 0.51 | +23 | NO | yes | -0.51 | -0.51 |
| 2026-07-30 | AMZN | Supply Chain | 16/63 | ✅ | 27% | 0.35 | +38 | NO | yes | -0.35 | -0.35 |
| 2026-07-30 | AMZN | Tariff | 4/63 | ✅ | 10% | 0.04 | +86 | NO | yes | -0.04 | -0.04 |
| 2026-07-30 | AMZN | Trainium | 12/63 | ✅ | 21% | 0.04 | +75 | NO | yes | -0.04 | -0.04 |
| 2026-07-30 | AMZN | Zoox / Robotaxi | 3/63 | ✅ | 8% | 0.52 | +40 | NO | no | +0.48 | +0.47 |
| 2026-07-30 | RDDT | Google (3+ times) | 0/8 | ❌ | 13% | 0.56 | +31 | NO | no | +0.44 | +0.43 |
| 2026-07-30 | RDDT | Shopify | 0/8 | ✅ | 21% | 0.24 | +55 | NO | yes | -0.24 | -0.24 |
| 2026-07-30 | YUM | Beef | 6/24 | ✅ | 30% | 0.37 | +33 | NO | no | +0.63 | +0.61 |
| 2026-07-30 | YUM | Food Safety | 4/24 | ❌ | 20% | 0.47 | +33 | NO | yes | -0.47 | -0.47 |
| 2026-07-30 | YUM | Outbreak / Illness | 4/24 | ❌ | 20% | 0.57 | +23 | NO | no | +0.43 | +0.42 |
| 2026-08-03 | GRAB | Buyback / Buy Back | 6/20 | ✅ | 35% | 0.30 | +35 | NO | yes | -0.30 | -0.30 |
| 2026-08-03 | GRAB | Commission | 9/20 | ✅ | 47% | 0.31 | +22 | NO | yes | -0.31 | -0.31 |
| 2026-08-03 | GRAB | Delivery Hero | 1/20 | ❌ | 10% | 0.77 | +13 | NO | yes | -0.77 | -0.77 |
| 2026-08-03 | GRAB | Foodpanda | 3/20 | ✅ | 23% | 0.35 | +42 | NO | yes | -0.35 | -0.35 |
| 2026-08-03 | GRAB | GrabMart | 10/20 | ✅ | 52% | 0.20 | +28 | NO | yes | -0.20 | -0.20 |
| 2026-08-03 | GRAB | Iran / Middle East | 0/20 | ✅ | 10% | 0.56 | +34 | NO | no | +0.44 | +0.43 |
| 2026-08-03 | GRAB | MAI | 1/20 | ✅ | 14% | 0.44 | +42 | NO | no | +0.56 | +0.54 |
| 2026-08-03 | GRAB | Stash | 1/20 | ❌ | 10% | 0.38 | +52 | NO | yes | -0.38 | -0.38 |
| 2026-08-03 | GRAB | Superbank | 4/20 | ❌ | 23% | 0.06 | +71 | NO | yes | -0.06 | -0.06 |
| 2026-08-03 | GRAB | WeRide | 2/20 | ✅ | 18% | 0.35 | +47 | NO | no | +0.65 | +0.63 |
| 2026-08-03 | PLTR | Healthcare | 18/22 | ❌ | 75% | 0.50 | +25 | YES | no | -0.50 | -0.50 |
| 2026-08-03 | PLTR | Iran / Iranian | 2/22 | ❌ | 13% | 0.74 | +13 | NO | no | +0.26 | +0.25 |
| 2026-08-03 | PLTR | Israel | 6/22 | ✅ | 32% | 0.57 | +11 | NO | no | +0.43 | +0.42 |
| 2026-08-03 | PLTR | Lethal | 7/22 | ❌ | 33% | 0.50 | +17 | NO | no | +0.50 | +0.48 |
| 2026-08-03 | PLTR | Nvidia | 0/22 | ❌ | 6% | 0.59 | +35 | NO | yes | -0.59 | -0.59 |
| 2026-08-03 | PLTR | Slop / AI Slop | 0/22 | ✅ | 9% | 0.39 | +52 | NO | yes | -0.39 | -0.39 |
| 2026-08-03 | PLTR | Sovereign AI | 0/22 | ❌ | 6% | 0.36 | +58 | NO | yes | -0.36 | -0.36 |
| 2026-08-03 | PLTR | Warp Speed | 9/22 | ✅ | 44% | 0.24 | +32 | NO | no | +0.76 | +0.74 |
| 2026-08-03 | SNAP | Game | 11/20 | ✅ | 56% | 0.19 | +25 | NO | no | +0.81 | +0.79 |
| 2026-08-03 | SNAP | Glasses | 10/20 | ✅ | 52% | 0.14 | +34 | NO | yes | -0.14 | -0.14 |
| 2026-08-03 | SNAP | Memories Storage | 1/20 | ✅ | 14% | 0.29 | +57 | NO | yes | -0.29 | -0.29 |
| 2026-08-03 | SNAP | Restructuring | 7/20 | ✅ | 39% | 0.23 | +38 | NO | yes | -0.23 | -0.23 |
| 2026-08-03 | SNAP | Spectacles | 12/20 | ❌ | 56% | 0.33 | +23 | YES | no | -0.33 | -0.33 |
| 2026-08-03 | SNAP | Storage | 2/20 | ✅ | 18% | 0.25 | +57 | NO | yes | -0.25 | -0.25 |
| 2026-08-04 | AMD | Frontier | 15/63 | ❌ | 25% | 0.64 | +11 | NO | yes | -0.64 | -0.64 |
| 2026-08-04 | AMD | Meta | 9/63 | ✅ | 17% | 0.35 | +48 | NO | yes | -0.35 | -0.35 |
| 2026-08-04 | AMD | Microsoft / Azure | 49/63 | ❌ | 75% | 0.11 | +14 | NO | yes | -0.11 | -0.11 |
| 2026-08-04 | MCD | Big Arch | 7/63 | ✅ | 14% | 0.32 | +54 | NO | no | +0.68 | +0.66 |
| 2026-08-04 | MCD | Delivery | 46/63 | ✅ | 72% | 0.54 | +18 | YES | yes | +0.46 | +0.45 |
| 2026-08-04 | MCD | Dividend | 42/63 | ❌ | 65% | 0.17 | +48 | YES | no | -0.17 | -0.17 |
| 2026-08-04 | MCD | Monopoly | 17/63 | ❌ | 28% | 0.07 | +21 | YES | no | -0.07 | -0.07 |
| 2026-08-04 | MCD | Red Bull | 1/63 | ✅ | 5% | 0.42 | +53 | NO | yes | -0.42 | -0.42 |
| 2026-08-04 | MCD | Revenue | 30/63 | ❌ | 47% | 0.30 | +17 | YES | no | -0.30 | -0.30 |
| 2026-08-04 | MCD | Snack Wrap | 9/63 | ❌ | 16% | 0.43 | +41 | NO | no | +0.57 | +0.55 |
| 2026-08-04 | SPOT | Apple | 21/32 | ✅ | 65% | 0.36 | +29 | YES | yes | +0.64 | +0.62 |
| 2026-08-04 | SPOT | Claude | 1/32 | ✅ | 9% | 0.68 | +23 | NO | yes | -0.68 | -0.68 |
| 2026-08-04 | SPOT | Fitness | 0/32 | ✅ | 7% | 0.45 | +48 | NO | yes | -0.45 | -0.45 |
| 2026-08-04 | SPOT | Peloton | 0/32 | ✅ | 7% | 0.75 | +18 | NO | no | +0.25 | +0.24 |
| 2026-08-04 | TOST | Memory / Chip | 2/18 | ✅ | 20% | 0.38 | +42 | NO | yes | -0.38 | -0.38 |
| 2026-08-04 | ZETA | Snowflake | 12/19 | ❌ | 58% | 0.44 | +14 | YES | yes | +0.56 | +0.54 |
| 2026-08-05 | DASH | Autonomous | 6/20 | ✅ | 35% | 0.25 | +40 | NO | yes | -0.25 | -0.25 |
| 2026-08-05 | DASH | DashMart | 13/20 | ✅ | 64% | 0.51 | +13 | YES | yes | +0.49 | +0.48 |
| 2026-08-05 | DIS | Box Office | 51/64 | ✅ | 78% | 0.06 | +16 | NO | yes | -0.06 | -0.06 |
| 2026-08-05 | DIS | International Visitation | 10/64 | ✅ | 18% | 0.42 | +40 | NO | yes | -0.42 | -0.42 |
| 2026-08-05 | DIS | Moana | 17/64 | ✅ | 28% | 0.33 | +39 | NO | yes | -0.33 | -0.33 |
| 2026-08-05 | DIS | Toy Story 5 | 2/64 | ✅ | 6% | 0.17 | +77 | NO | yes | -0.17 | -0.17 |
| 2026-08-05 | DUOL | Chess | 6/19 | ✅ | 37% | 0.31 | +32 | NO | yes | -0.31 | -0.31 |
| 2026-08-05 | DUOL | Free Trial | 1/19 | ✅ | 15% | 0.66 | +19 | NO | yes | -0.66 | -0.66 |
| 2026-08-05 | DUOL | Tutor | 6/19 | ✅ | 37% | 0.40 | +23 | NO | no | +0.60 | +0.58 |
| 2026-08-05 | EBAY | GameStop | 0/32 | ❌ | 4% | 0.68 | +28 | NO | no | +0.32 | +0.31 |
| 2026-08-05 | EBAY | Klarna | 9/32 | ✅ | 32% | 0.40 | +28 | NO | yes | -0.40 | -0.40 |
| 2026-08-05 | EBAY | OpenAI / ChatGPT | 7/32 | ✅ | 26% | 0.54 | +20 | NO | no | +0.46 | +0.45 |
| 2026-08-05 | FIG | Gemini | 1/3 | ✅ | 51% | 0.24 | +27 | YES | no | -0.24 | -0.24 |
| 2026-08-05 | FIG | Governance Plus | 1/3 | ❌ | 34% | 0.56 | +10 | NO | no | +0.44 | +0.43 |
| 2026-08-05 | MELI | AI / Artificial Intelligence | 9/59 | ✅ | 18% | 0.17 | +65 | NO | yes | -0.17 | -0.17 |
| 2026-08-05 | SHOP | Stablecoin | 2/43 | ✅ | 9% | 0.61 | +30 | NO | no | +0.39 | +0.38 |
| 2026-08-05 | UBER | Drone | 0/28 | ❌ | 5% | 0.84 | +11 | NO | yes | -0.84 | -0.84 |
| 2026-08-05 | UBER | Expansion | 20/28 | ✅ | 70% | 0.18 | +12 | NO | no | +0.82 | +0.80 |
| 2026-08-05 | UBER | Market Share | 12/28 | ✅ | 45% | 0.15 | +30 | YES | no | -0.15 | -0.15 |
| 2026-08-05 | UBER | Nvidia | 2/28 | ✅ | 14% | 0.45 | +41 | NO | yes | -0.45 | -0.45 |
| 2026-08-05 | UBER | Waabi | 4/28 | ❌ | 17% | 0.72 | +11 | NO | no | +0.28 | +0.27 |
| 2026-08-05 | UBER | Waymo | 8/28 | ✅ | 32% | 0.20 | +48 | NO | yes | -0.20 | -0.20 |
| 2026-08-06 | AAOI | Quantum | 6/32 | ❌ | 21% | 0.28 | +51 | NO | yes | -0.28 | -0.28 |
| 2026-08-06 | ABNB | Boutique | 6/21 | ✅ | 34% | 0.30 | +36 | NO | yes | -0.30 | -0.30 |
| 2026-08-06 | ABNB | Project Hawaii | 0/21 | ✅ | 10% | 0.46 | +44 | NO | yes | -0.46 | -0.46 |
| 2026-08-06 | ABNB | Social Media | 10/21 | ❌ | 46% | 0.35 | +11 | YES | no | -0.35 | -0.35 |
| 2026-08-06 | ABNB | World Cup | 4/21 | ✅ | 26% | 0.14 | +60 | NO | yes | -0.14 | -0.14 |
| 2026-08-06 | LYFT | DoorDash | 5/28 | ✅ | 23% | 0.29 | +48 | NO | yes | -0.29 | -0.29 |
| 2026-08-06 | LYFT | Revenue | 28/28 | ✅ | 95% | 0.80 | +15 | YES | no | -0.80 | -0.80 |
| 2026-08-06 | NBIS | Hyperscaler | 5/10 | ✅ | 53% | 0.21 | +26 | NO | yes | -0.21 | -0.21 |
| 2026-08-07 | DKNG | Feature | 18/24 | ✅ | 73% | 0.46 | +27 | YES | yes | +0.54 | +0.52 |
| 2026-08-07 | DKNG | Super App | 0/24 | ✅ | 9% | 0.20 | +71 | NO | yes | -0.20 | -0.20 |
| 2026-08-07 | WEN | Closure | 16/24 | ✅ | 66% | 0.49 | +17 | YES | yes | +0.51 | +0.49 |
| 2026-08-07 | WEN | Minions | 0/24 | ✅ | 9% | 0.36 | +55 | NO | yes | -0.36 | -0.36 |
| 2026-08-07 | WEN | Pickle | 2/24 | ❌ | 13% | 0.75 | +12 | NO | no | +0.25 | +0.24 |
| 2026-08-07 | WEN | Spicy Chicken | 4/24 | ✅ | 23% | 0.49 | +28 | NO | no | +0.51 | +0.49 |
| 2026-08-10 | HIMS | Canada | 4/21 | ✅ | 26% | 0.12 | +62 | NO | yes | -0.12 | -0.12 |
| 2026-08-10 | HIMS | Cancer | 4/21 | ❌ | 22% | 0.57 | +21 | NO | no | +0.43 | +0.42 |
| 2026-08-10 | HIMS | Collaboration | 7/21 | ✅ | 38% | 0.41 | +21 | NO | yes | -0.41 | -0.41 |
| 2026-08-10 | HIMS | Eucalyptus | 1/21 | ✅ | 14% | 0.09 | +77 | NO | yes | -0.09 | -0.09 |
| 2026-08-10 | HIMS | Europe | 4/21 | ❌ | 22% | 0.45 | +33 | NO | yes | -0.45 | -0.45 |
| 2026-08-10 | HIMS | FDA | 6/21 | ✅ | 34% | 0.16 | +50 | NO | yes | -0.16 | -0.16 |
| 2026-08-10 | HIMS | Lab Testing | 6/21 | ✅ | 34% | 0.23 | +43 | NO | yes | -0.23 | -0.23 |
| 2026-08-10 | HIMS | Longevity | 7/21 | ✅ | 38% | 0.22 | +40 | NO | yes | -0.22 | -0.22 |
| 2026-08-10 | HIMS | Microdose / Microdosing | 1/21 | ❌ | 10% | 0.75 | +15 | NO | no | +0.25 | +0.24 |
| 2026-08-10 | HIMS | Peptide | 5/21 | ✅ | 30% | 0.05 | +65 | NO | yes | -0.05 | -0.05 |
| 2026-08-10 | HIMS | Testosterone | 7/21 | ✅ | 38% | 0.03 | +59 | NO | yes | -0.03 | -0.03 |
| 2026-08-10 | HIMS | Vitamin | 6/21 | ❌ | 30% | 0.44 | +26 | NO | no | +0.56 | +0.54 |
| 2026-08-10 | HIMS | Wearable | 4/21 | ✅ | 26% | 0.24 | +50 | NO | yes | -0.24 | -0.24 |
| 2026-08-10 | HIMS | Wegovy | 3/21 | ✅ | 22% | 0.11 | +67 | NO | yes | -0.11 | -0.11 |
| 2026-08-10 | HIMS | YourBio | 1/21 | ✅ | 14% | 0.43 | +43 | NO | no | +0.57 | +0.55 |
| 2026-08-10 | HIMS | Zava | 3/21 | ✅ | 22% | 0.30 | +48 | NO | no | +0.70 | +0.68 |
| 2026-08-11 | CAVA | AI / Artificial Intelligence | 7/11 | ✅ | 62% | 0.15 | +23 | NO | yes | -0.15 | -0.15 |
| 2026-08-11 | CAVA | CavaCore | 0/11 | ❌ | 10% | 0.30 | +60 | NO | yes | -0.30 | -0.30 |
| 2026-08-11 | CAVA | Cyclospora / Cyclosporiasis | 0/11 | ❌ | 10% | 0.63 | +27 | NO | yes | -0.63 | -0.63 |
| 2026-08-11 | CAVA | Dining | 9/11 | ❌ | 69% | 0.35 | +34 | YES | no | -0.35 | -0.35 |
| 2026-08-11 | CAVA | Salmon | 3/11 | ✅ | 36% | 0.03 | +61 | NO | yes | -0.03 | -0.03 |
| 2026-08-11 | CAVA | Same Store | 1/11 | ✅ | 23% | 0.08 | +15 | YES | no | -0.08 | -0.08 |
| 2026-08-11 | CAVA | Spice | 4/11 | ✅ | 43% | 0.35 | +22 | NO | no | +0.65 | +0.63 |
| 2026-08-11 | CRWV | Nvidia (3+ times) | 0/4 | ❌ | 19% | 0.17 | +64 | NO | yes | -0.17 | -0.17 |
| 2026-08-11 | CRWV | Storage | 4/4 | ✅ | 78% | 0.07 | +15 | NO | yes | -0.07 | -0.07 |
| 2026-08-13 | AMAT | EPIC Center | 9/45 | ✅ | 23% | 0.04 | +73 | NO | yes | -0.04 | -0.04 |
| 2026-08-13 | AMAT | Epitaxy | 6/45 | ✅ | 17% | 0.50 | +33 | NO | yes | -0.50 | -0.50 |
| 2026-08-13 | AMAT | EssilorLuxottica | 0/45 | ❌ | 3% | 0.51 | +46 | NO | no | +0.49 | +0.48 |
| 2026-08-13 | AMAT | SENZ | 0/45 | ❌ | 3% | 0.43 | +54 | NO | no | +0.57 | +0.55 |
| 2026-08-13 | AMAT | Singapore | 10/45 | ✅ | 25% | 0.23 | +52 | NO | yes | -0.23 | -0.23 |
| 2026-08-13 | AMAT | Smart Glasses | 0/45 | ❌ | 3% | 0.46 | +51 | NO | no | +0.54 | +0.52 |
| 2026-08-13 | AMAT | Supply Chain | 34/45 | ✅ | 74% | 0.04 | +22 | NO | yes | -0.04 | -0.04 |
| 2026-08-13 | LUNR | AI / Artificial Intelligence | 2/11 | ❌ | 23% | 0.32 | +45 | NO | no | +0.68 | +0.66 |
| 2026-08-13 | LUNR | Artemis III | 1/11 | ✅ | 23% | 0.63 | +14 | NO | no | +0.37 | +0.36 |
| 2026-08-13 | LUNR | China / Chinese | 7/11 | ❌ | 56% | 0.26 | +30 | YES | no | -0.26 | -0.26 |
| 2026-08-13 | LUNR | Goonhilly Earth Station | 1/11 | ✅ | 23% | 0.05 | +72 | NO | yes | -0.05 | -0.05 |
| 2026-08-13 | LUNR | Mars (3+ times) | 0/11 | ❌ | 10% | 0.64 | +26 | NO | no | +0.36 | +0.35 |
| 2026-08-13 | LUNR | SpaceX | 6/11 | ❌ | 49% | 0.36 | +13 | YES | yes | +0.64 | +0.62 |
| 2026-08-13 | YETI | China (3+ times) | 0/28 | ❌ | 5% | 0.55 | +40 | NO | no | +0.45 | +0.44 |
| 2026-08-13 | YETI | NFL | 7/28 | ❌ | 27% | 0.37 | +36 | NO | no | +0.63 | +0.61 |
| 2026-08-13 | YETI | Ranger | 3/28 | ✅ | 17% | 0.32 | +51 | NO | yes | -0.32 | -0.32 |
| 2026-08-13 | YETI | TikTok | 4/28 | ✅ | 20% | 0.56 | +24 | NO | no | +0.44 | +0.43 |
| 2026-08-18 | AS | Foot Locker | 1/9 | ✅ | 27% | 0.16 | +57 | NO | yes | -0.16 | -0.16 |
| 2026-08-18 | AS | Oil | 0/9 | ✅ | 20% | 0.66 | +14 | NO | no | +0.34 | +0.33 |
| 2026-08-18 | AS | Pickleball | 4/9 | ❌ | 42% | 0.17 | +25 | YES | no | -0.17 | -0.17 |
| 2026-08-18 | AS | REI | 5/9 | ✅ | 57% | 0.27 | +16 | NO | no | +0.73 | +0.71 |
| 2026-08-18 | AS | Supreme Court | 1/9 | ✅ | 27% | 0.55 | +18 | NO | no | +0.45 | +0.44 |
| 2026-08-18 | AS | Tariff | 6/9 | ✅ | 64% | 0.06 | +30 | NO | yes | -0.06 | -0.06 |
| 2026-08-18 | HD | Inflation | 54/63 | ❌ | 83% | 0.61 | +22 | YES | no | -0.61 | -0.61 |
| 2026-08-18 | HD | Synergy | 4/63 | ❌ | 8% | 0.64 | +28 | NO | no | +0.36 | +0.35 |
| 2026-08-18 | KLAR | AI / Artificial Intelligence | 3/3 | ❌ | 58% | 0.28 | +14 | NO | no | +0.72 | +0.70 |
| 2026-08-18 | KLAR | Inflation | 0/3 | ❌ | 22% | 0.55 | +23 | NO | no | +0.45 | +0.44 |
| 2026-08-18 | KLAR | JP Morgan Payment | 0/3 | ✅ | 39% | 0.37 | +24 | NO | yes | -0.37 | -0.37 |
| 2026-08-18 | KLAR | Southwest Airlines | 0/3 | ❌ | 22% | 0.54 | +24 | NO | no | +0.46 | +0.45 |
| 2026-08-18 | KLAR | Walmart | 3/3 | ✅ | 75% | 0.60 | +15 | YES | yes | +0.40 | +0.39 |
| 2026-08-18 | TOL | California | 20/25 | ❌ | 74% | 0.57 | +17 | YES | no | -0.57 | -0.57 |
| 2026-08-18 | TOL | Land Bank / Land Banking | 15/25 | ✅ | 60% | 0.26 | +14 | NO | yes | -0.26 | -0.26 |
| 2026-08-18 | TOL | Tariff | 6/25 | ✅ | 29% | 0.46 | +25 | NO | no | +0.54 | +0.52 |
| 2026-08-19 | TGT | Back to School | 33/52 | ✅ | 63% | 0.10 | +27 | NO | yes | -0.10 | -0.10 |
| 2026-08-19 | TGT | Nintendo Switch | 7/52 | ✅ | 17% | 0.30 | +53 | NO | no | +0.70 | +0.68 |
| 2026-08-19 | TGT | Target Plus | 12/52 | ✅ | 26% | 0.03 | +71 | NO | yes | -0.03 | -0.03 |
| 2026-08-19 | TGT | Revenue | 26/52 | ✅ | 51% | 0.30 | +19 | NO | yes | -0.30 | -0.30 |
| 2026-08-19 | TGT | Roundel | 16/52 | ✅ | 33% | 0.12 | +55 | NO | yes | -0.12 | -0.12 |
| 2026-08-19 | TGT | Synthetic Color | 3/52 | ✅ | 10% | 0.59 | +31 | NO | no | +0.41 | +0.40 |
| 2026-08-19 | TGT | Tariff | 11/52 | ✅ | 24% | 0.21 | +55 | NO | yes | -0.21 | -0.21 |
| 2026-08-20 | AAP | Advance Reward | 1/63 | ✅ | 5% | 0.20 | +75 | NO | yes | -0.20 | -0.20 |
| 2026-08-20 | AAP | LIFO | 26/63 | ✅ | 42% | 0.39 | +19 | NO | yes | -0.39 | -0.39 |
| 2026-08-20 | AAP | Peak Driving | 0/63 | ✅ | 4% | 0.65 | +31 | NO | no | +0.35 | +0.34 |
| 2026-08-20 | AAP | Tariff | 17/63 | ✅ | 29% | 0.35 | +36 | NO | yes | -0.35 | -0.35 |
| 2026-08-20 | DE | Efficiency | 31/64 | ❌ | 48% | 0.41 | +11 | NO | yes | -0.41 | -0.41 |
| 2026-08-20 | DE | Excavator | 15/64 | ✅ | 26% | 0.49 | +25 | NO | yes | -0.49 | -0.49 |
| 2026-08-20 | DE | Tariff | 17/64 | ✅ | 28% | 0.03 | +69 | NO | yes | -0.03 | -0.03 |
| 2026-08-20 | FUTU | Agentic | 0/24 | ❌ | 5% | 0.46 | +49 | NO | no | +0.54 | +0.52 |
| 2026-08-20 | ROST | Flywheel | 1/20 | ✅ | 14% | 0.53 | +33 | NO | yes | -0.53 | -0.53 |
| 2026-08-20 | ROST | New York | 4/20 | ✅ | 27% | 0.23 | +50 | NO | no | +0.77 | +0.75 |
| 2026-08-20 | ROST | Self-Checkout | 7/20 | ❌ | 35% | 0.40 | +25 | NO | no | +0.60 | +0.58 |
| 2026-08-20 | WMT | Competition / Competitor | 39/59 | ✅ | 66% | 0.45 | +21 | YES | no | -0.45 | -0.45 |
| 2026-08-20 | WMT | Drone | 3/59 | ✅ | 9% | 0.63 | +28 | NO | no | +0.37 | +0.36 |
| 2026-08-20 | WMT | Omnichannel | 25/59 | ✅ | 43% | 0.09 | +48 | NO | yes | -0.09 | -0.09 |
| 2026-08-20 | WMT | Tariff | 33/59 | ✅ | 56% | 0.06 | +38 | NO | yes | -0.06 | -0.06 |
| 2026-08-25 | DKS | Fast Break | 1/55 | ✅ | 6% | 0.08 | +86 | NO | yes | -0.08 | -0.08 |
| 2026-08-25 | DKS | Going Going Gone | 0/55 | ❌ | 3% | 0.75 | +22 | NO | no | +0.25 | +0.24 |
| 2026-08-25 | DKS | Sport and Culture | 5/55 | ✅ | 13% | 0.20 | +67 | NO | yes | -0.20 | -0.20 |
| 2026-08-25 | DKS | World Cup | 11/55 | ✅ | 23% | 0.05 | +72 | NO | yes | -0.05 | -0.05 |
| 2026-08-25 | INTU | Agentic | 5/50 | ❌ | 12% | 0.50 | +38 | NO | yes | -0.50 | -0.50 |
| 2026-08-25 | INTU | ARPU | 19/50 | ✅ | 40% | 0.34 | +26 | NO | no | +0.66 | +0.64 |
| 2026-08-25 | INTU | Investor Day | 42/50 | ❌ | 80% | 0.09 | +11 | NO | yes | -0.09 | -0.09 |
| 2026-08-25 | INTU | Pro Tax | 12/50 | ✅ | 27% | 0.13 | +60 | NO | no | +0.87 | +0.84 |
| 2026-08-25 | INTU | Restructuring | 5/50 | ✅ | 14% | 0.19 | +67 | NO | no | +0.81 | +0.79 |
| 2026-08-25 | INTU | TurboTax Live | 32/50 | ✅ | 64% | 0.12 | +24 | NO | yes | -0.12 | -0.12 |
| 2026-08-25 | ZM | Agentic | 5/28 | ✅ | 23% | 0.11 | +66 | NO | yes | -0.11 | -0.11 |
| 2026-08-25 | ZM | Scribe | 0/28 | ✅ | 8% | 0.68 | +24 | NO | no | +0.32 | +0.31 |
| 2026-08-25 | ZM | System of Action | 3/28 | ✅ | 17% | 0.14 | +69 | NO | yes | -0.14 | -0.14 |
| 2026-08-26 | CRM | MuleSoft | 32/63 | ✅ | 51% | 0.11 | +38 | NO | yes | -0.11 | -0.11 |
| 2026-08-26 | CRM | Slackbot | 2/63 | ✅ | 7% | 0.16 | +77 | NO | yes | -0.16 | -0.16 |
| 2026-08-26 | CRM | Tableau | 27/63 | ✅ | 44% | 0.11 | +45 | NO | no | +0.89 | +0.86 |
| 2026-08-26 | CRWD | AI Detection | 2/28 | ✅ | 14% | 0.44 | +42 | NO | no | +0.56 | +0.54 |
| 2026-08-26 | NVDA | Cosmos | 5/62 | ❌ | 10% | 0.30 | +60 | NO | yes | -0.30 | -0.30 |
| 2026-08-26 | NVDA | Dividend (2+ times) | 0/62 | ❌ | 2% | 0.74 | +24 | NO | no | +0.26 | +0.25 |
| 2026-08-26 | NVDA | Gaming | 57/62 | ✅ | 90% | 0.67 | +23 | YES | no | -0.67 | -0.67 |
| 2026-08-26 | NVDA | Hyperscaler | 26/62 | ✅ | 43% | 0.01 | +56 | NO | yes | -0.01 | -0.01 |
| 2026-08-26 | NVDA | Omniverse | 21/62 | ❌ | 34% | 0.37 | +29 | NO | yes | -0.37 | -0.37 |
| 2026-08-26 | NVDA | Talent | 5/62 | ❌ | 10% | 0.74 | +16 | NO | no | +0.26 | +0.25 |
| 2026-08-26 | URBN | Back to School | 16/57 | ❌ | 29% | 0.26 | +45 | NO | yes | -0.26 | -0.26 |
| 2026-08-26 | URBN | Claude | 0/57 | ✅ | 4% | 0.82 | +14 | NO | no | +0.18 | +0.17 |
| 2026-08-26 | URBN | Gemini | 0/57 | ✅ | 4% | 0.81 | +15 | NO | no | +0.19 | +0.18 |
| 2026-08-26 | URBN | Holiday | 45/57 | ❌ | 76% | 0.62 | +14 | YES | yes | +0.38 | +0.37 |
| 2026-08-26 | URBN | International / Internationally | 41/57 | ✅ | 71% | 0.59 | +12 | YES | yes | +0.41 | +0.40 |
| 2026-08-26 | URBN | Middle East | 5/57 | ✅ | 12% | 0.64 | +24 | NO | yes | -0.64 | -0.64 |
| 2026-08-26 | URBN | Refund | 0/57 | ✅ | 4% | 0.06 | +90 | NO | yes | -0.06 | -0.06 |
| 2026-08-26 | URBN | Store Opening | 26/57 | ✅ | 46% | 0.36 | +18 | NO | no | +0.64 | +0.62 |
| 2026-08-26 | URBN | Supply Chain | 31/57 | ❌ | 53% | 0.29 | +24 | YES | yes | +0.71 | +0.69 |
| 2026-08-27 | MRVL | Celestial | 1/45 | ✅ | 7% | 0.14 | +79 | NO | yes | -0.14 | -0.14 |
| 2026-08-27 | MRVL | Inference | 10/45 | ✅ | 25% | 0.26 | +49 | NO | yes | -0.26 | -0.26 |
| 2026-08-27 | MRVL | Nvidia | 8/45 | ✅ | 21% | 0.18 | +61 | NO | yes | -0.18 | -0.18 |
| 2026-08-27 | MRVL | Photonic Fabric | 1/45 | ✅ | 7% | 0.23 | +70 | NO | yes | -0.23 | -0.23 |
| 2026-08-27 | MRVL | Polariton | 0/45 | ✅ | 5% | 0.62 | +33 | NO | no | +0.38 | +0.37 |
| 2026-08-27 | MRVL | Prepayment | 1/45 | ✅ | 7% | 0.31 | +62 | NO | yes | -0.31 | -0.31 |
| 2026-08-27 | MRVL | Scale Across | 3/45 | ❌ | 9% | 0.15 | +76 | NO | yes | -0.15 | -0.15 |
| 2026-08-27 | MRVL | Storage | 42/45 | ❌ | 89% | 0.72 | +17 | YES | yes | +0.28 | +0.27 |
| 2026-08-27 | MRVL | Teralynx | 9/45 | ❌ | 21% | 0.68 | +11 | NO | yes | -0.68 | -0.68 |
| 2026-08-27 | MRVL | Xconn | 1/45 | ✅ | 7% | 0.33 | +60 | NO | no | +0.67 | +0.65 |
| 2026-08-27 | ULTA | AI / Artificial Intelligence | 6/20 | ✅ | 35% | 0.10 | +55 | NO | yes | -0.10 | -0.10 |
| 2026-08-27 | ULTA | Diamond | 9/20 | ❌ | 44% | 0.25 | +19 | YES | no | -0.25 | -0.25 |
| 2026-08-27 | ULTA | Google / Gemini | 2/20 | ✅ | 18% | 0.66 | +16 | NO | yes | -0.66 | -0.66 |
| 2026-08-27 | ULTA | Headwind | 16/20 | ❌ | 72% | 0.29 | +43 | YES | yes | +0.71 | +0.69 |
| 2026-08-27 | ULTA | Tailwind | 8/20 | ✅ | 43% | 0.12 | +31 | YES | no | -0.12 | -0.12 |
| 2026-08-27 | ULTA | Tariff | 4/20 | ❌ | 23% | 0.63 | +14 | NO | no | +0.37 | +0.36 |
| 2026-08-27 | ULTA | TikTok | 10/20 | ✅ | 52% | 0.20 | +28 | NO | yes | -0.20 | -0.20 |
| 2026-08-27 | ULTA | Times Square | 0/20 | ✅ | 10% | 0.72 | +18 | NO | no | +0.28 | +0.27 |
| 2026-08-27 | ULTA | Traffic | 17/20 | ✅ | 80% | 0.62 | +18 | YES | yes | +0.38 | +0.37 |
| 2026-08-27 | ULTA | Uncertainty | 11/20 | ✅ | 56% | 0.06 | +38 | NO | yes | -0.06 | -0.06 |
| 2026-09-01 | MDT | China | 6/7 | ✅ | 75% | 0.62 | +13 | YES | no | -0.62 | -0.62 |
| 2026-09-01 | MDT | PulseSelect | 5/7 | ❌ | 57% | 0.26 | +31 | YES | yes | +0.74 | +0.72 |
| 2026-09-01 | MDT | Tariff | 5/7 | ✅ | 67% | 0.06 | +27 | NO | yes | -0.06 | -0.06 |
| 2026-09-01 | PANW | Cortex Cloud | 4/7 | ✅ | 58% | 0.21 | +21 | NO | no | +0.79 | +0.77 |
| 2026-09-02 | AVGO | Ethernet | 23/44 | ✅ | 53% | 0.21 | +26 | NO | yes | -0.21 | -0.21 |
| 2026-09-02 | AVGO | Jericho 4 | 1/44 | ✅ | 7% | 0.55 | +38 | NO | no | +0.45 | +0.44 |
| 2026-09-02 | AVGO | Open Source | 2/44 | ❌ | 7% | 0.75 | +18 | NO | no | +0.25 | +0.24 |
| 2026-09-02 | AVGO | OpenAI | 2/44 | ✅ | 9% | 0.05 | +86 | NO | yes | -0.05 | -0.05 |
| 2026-09-02 | AVGO | Optic | 23/44 | ✅ | 53% | 0.39 | +14 | YES | no | -0.39 | -0.39 |
| 2026-09-02 | AVGO | Tomahawk 6 | 7/44 | ✅ | 20% | 0.25 | +55 | NO | yes | -0.25 | -0.25 |
| 2026-09-02 | HPE | Automation | 10/20 | ✅ | 52% | 0.30 | +18 | NO | no | +0.70 | +0.68 |
| 2026-09-02 | HPE | Department of Energy | 8/20 | ❌ | 39% | 0.16 | +23 | YES | no | -0.16 | -0.16 |
| 2026-09-02 | HPE | Government | 7/20 | ✅ | 39% | 0.41 | +20 | NO | no | +0.59 | +0.57 |
| 2026-09-02 | HPE | Headwind | 19/20 | ❌ | 85% | 0.53 | +32 | YES | no | -0.53 | -0.53 |
| 2026-09-02 | HPE | Self Driving | 0/20 | ❌ | 6% | 0.11 | +83 | NO | yes | -0.11 | -0.11 |
| 2026-09-02 | HPE | Tailwind | 7/20 | ✅ | 39% | 0.47 | +14 | NO | no | +0.53 | +0.51 |
| 2026-09-02 | SNOW | Europe | 14/22 | ❌ | 59% | 0.43 | +16 | YES | no | -0.43 | -0.43 |
| 2026-09-02 | SNOW | OpenAI | 5/22 | ✅ | 28% | 0.20 | +52 | NO | yes | -0.20 | -0.20 |
| 2026-09-02 | SNOW | Snowflake Intelligence | 5/22 | ✅ | 28% | 0.41 | +31 | NO | no | +0.59 | +0.57 |
| 2026-09-03 | CIEN | Tariff | 6/7 | ❌ | 66% | 0.33 | +33 | YES | yes | +0.67 | +0.65 |
| 2026-09-08 | ORCL | AMD | 5/63 | ❌ | 10% | 0.52 | +38 | NO | no | +0.48 | +0.47 |
| 2026-09-08 | ORCL | Backlog | 19/63 | ❌ | 31% | 0.51 | +18 | NO | no | +0.49 | +0.48 |
| 2026-09-08 | ORCL | OpenAI | 8/63 | ❌ | 14% | 0.63 | +23 | NO | yes | -0.63 | -0.63 |
| 2026-09-09 | CHWY | Chewy+ / Chewy Plus | 8/24 | ✅ | 37% | 0.24 | +39 | NO | yes | -0.24 | -0.24 |
| 2026-09-09 | CHWY | Loyalty | 17/24 | ❌ | 66% | 0.42 | +24 | YES | yes | +0.58 | +0.56 |
| 2026-09-10 | ADBE | 3D | 30/59 | ✅ | 51% | 0.32 | +17 | NO | yes | -0.32 | -0.32 |
| 2026-09-10 | ADBE | Anthropic | 1/59 | ✅ | 5% | 0.44 | +51 | NO | no | +0.56 | +0.54 |
| 2026-09-10 | ADBE | Generative AI / Gen AI | 14/59 | ❌ | 25% | 0.41 | +34 | NO | no | +0.59 | +0.57 |
| 2026-09-10 | ADBE | LLM Optimizer | 3/59 | ✅ | 9% | 0.42 | +49 | NO | yes | -0.42 | -0.42 |
| 2026-09-10 | M | Amazon | 3/32 | ✅ | 15% | 0.51 | +34 | NO | no | +0.49 | +0.48 |
| 2026-09-10 | M | Dividend | 28/32 | ✅ | 84% | 0.03 | +13 | NO | yes | -0.03 | -0.03 |
| 2026-09-11 | KR | AI | 10/23 | ✅ | 46% | 0.06 | +48 | NO | no | +0.94 | +0.91 |

*Prior = calls that said the word / prior calls on record. Last = the most recent pre-event call said the word (✅) or not (❌) — it drives the baseline's transition prior (0.67 vs 0.243).*
