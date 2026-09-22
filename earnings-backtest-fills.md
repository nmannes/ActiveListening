# Earnings Backtest — Fillable Prices

Generated 2026-09-22

## What this tests

For each finalized word market: a transcript baseline P is computed from calls before the event, then compared against the prices a **taker order would have paid** at close − 24h — buying YES costs the candle's `yes_ask`, buying NO costs `1 − yes_bid`. Bet the undervalued side (YES when P > ask, NO when 1 − P > 1 − bid); skip when neither side is undervalued; settle at the actual resolution. Entry price *is* fill price: a market order pays the posted price or it does not go through, so there is no queue, no fill model, and no assumption about which way the price then moved.

The headline basis keeps only entries whose candle **actually traded** (`vol > 0`) — a print in that hour is evidence the market was alive at entry. The optimistic bound repeats the sweep over every entry with a live two-sided quote, untraded candles included; those quotes are often carried forward and are not evidence anyone would have taken the other side.

- fee: Kalshi's taker schedule, 0.07·C·P·(1−P) rounded up to the cent per order, charged win or lose
- The flat 3%-of-profit model is shown next to it, because that is what `earnings-backtest.md` headlines and the two are not comparable net of nothing.
- Prices are the candle's closing quote, one per hour. A fill inside the hour could have been better or worse.
- Depth is not modelled in the headline. A capacity section bounds size by the entry hour's traded volume, which is the only flow measure the historical candles expose.

## Coverage

- 5612 finalized markets in the history file
- 5441 with a live two-sided quote at the 24h lead
- 2190 of those whose entry candle actually traded
- 2144 with a transcript baseline (pre-event calls) on this basis
- **1986 tradable** (quote, baseline, and an undervalued side)

## Headline (traded entry candle, min |gap| sweep)

Net at the executable price. The YES and NO columns split it by side; **Always NO** re-bets the same candidates NO regardless of the baseline, which is the bar the side selection has to clear — most of this universe resolves NO and YES is quoted rich, so a positive net is not by itself evidence the word predicts anything. Edge vs NO is net − Always NO and t is its paired t-statistic: |t| below about 2 means the edge is indistinguishable from zero at this sample size.

| Min \|gap\| | Trades | Wins | Win rate | Gross | Net | Net (flat) | ROI | YES (n/net) | NO (n/net) | Always YES | Always NO | Edge vs NO | t |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.00 | 1986 | 832 | 42% | +56.32 | +22.87 | +45.38 | 2.9% | 440 / -23.48 | 1546 / +46.35 | -183.33 | +36.41 | -13.54 | -0.74 |
| 0.05 | 1686 | 683 | 41% | +53.74 | +24.91 | +44.17 | 4.0% | 328 / -16.50 | 1358 / +41.41 | -157.24 | +32.81 | -7.90 | -0.49 |
| 0.10 | 1410 | 546 | 39% | +52.31 | +28.00 | +44.21 | 5.7% | 227 / -8.24 | 1183 / +36.24 | -130.26 | +27.81 | +0.19 | +0.01 |
| 0.15 | 1203 | 432 | 36% | +40.52 | +19.87 | +33.68 | 5.1% | 163 / -4.52 | 1040 / +24.39 | -103.99 | +17.16 | +2.71 | +0.24 |
| 0.20 | 1027 | 350 | 34% | +35.94 | +18.57 | +30.17 | 5.9% | 115 / -1.74 | 912 / +20.31 | -86.46 | +13.90 | +4.67 | +0.50 |
| 0.25 | 891 | 283 | 32% | +32.74 | +17.90 | +27.80 | 7.2% | 88 / +2.31 | 803 / +15.59 | -68.55 | +6.66 | +11.24 | +1.38 |
| 0.30 | 751 | 214 | 28% | +20.99 | +8.74 | +17.06 | 4.5% | 60 / +1.21 | 691 / +7.53 | -52.92 | +1.58 | +7.16 | +1.11 |

## Is YES overpriced?

Realized resolution rate against the quoted price, by price band, on the headline basis at this lead. If the mid equalled the realized rate the two fixed-side benchmarks below would each sit at minus their own half of the spread — you pay the quote going in and it is worth its mid going out — so both would be negative, equal, and driven only by the spread and the fee. Where the mid runs above realized, YES is rich by that margin and a NO bet starts with a tailwind it did not earn from the transcript: the gap between the two benchmark columns below is exactly 2 × (mid − realized). This is a property of the *price*, not of the strategy, and it is why the headline table needs the Always-NO column.

| Mid band | n | Realized YES | Mean ask | Mean bid | Mean mid | Mid − realized |
|---|---|---|---|---|---|---|
| 0.00–0.20 | 227 | 8.8% | 0.141 | 0.102 | 0.122 | +3.4¢ |
| 0.20–0.40 | 409 | 23.2% | 0.330 | 0.274 | 0.302 | +7.0¢ |
| 0.40–0.60 | 456 | 39.5% | 0.543 | 0.465 | 0.504 | +10.9¢ |
| 0.60–0.80 | 486 | 63.2% | 0.724 | 0.678 | 0.701 | +7.0¢ |
| 0.80–1.00 | 612 | 90.2% | 0.924 | 0.893 | 0.908 | +0.6¢ |

The same price-level question asked as a trade rather than as a table: buy YES at the ask on every market, or buy NO at 1 − bid on every market, with no baseline and no side selection. Per contract, Kalshi taker fee included. This is what the quote alone pays, and it is the number the strategy's net has to beat by more than noise to have found anything the price had not already put there.

| Lead | n | Realized YES | Mean ask | Mean mid | Always YES (net/contract) | Always NO (net/contract) |
|---|---|---|---|---|---|---|
| 1 | 4367 | 52.4% | 0.587 | 0.555 | -0.071 | -0.010 |
| 3 | 4216 | 53.1% | 0.589 | 0.562 | -0.070 | -0.009 |
| 6 | 3634 | 53.4% | 0.595 | 0.571 | -0.075 | -0.002 |
| 12 | 3082 | 53.5% | 0.598 | 0.573 | -0.077 | -0.002 |
| 18 | 2855 | 52.3% | 0.594 | 0.571 | -0.086 | +0.009 |
| **24** | 2190 | 52.7% | 0.608 | 0.583 | -0.098 | +0.015 |
| 36 | 1510 | 52.6% | 0.601 | 0.574 | -0.090 | +0.005 |
| 48 | 1279 | 52.1% | 0.601 | 0.571 | -0.097 | +0.004 |
| 72 | 885 | 55.8% | 0.626 | 0.596 | -0.084 | -0.009 |
| 96 | 820 | 53.3% | 0.601 | 0.568 | -0.085 | -0.014 |

## Optimistic bound (every live quote, traded or not)

The same sweep without the traded-candle requirement: 5441 markets instead of 2190. Read the gap between the two as the price of insisting on evidence that a counterparty was there. Quotes on untraded candles are frequently carried forward — 27% of the stale candle's asks in this corpus are identical to the ask six to twenty-four hours earlier — so a fill against them is an assumption, not an observation.

| Min \|gap\| | Trades | Wins | Win rate | Gross | Net | ROI | Always NO | Edge vs NO | t |
|---|---|---|---|---|---|---|---|---|---|
| 0.00 | 4761 | 1917 | 40% | +94.26 | +16.99 | 0.9% | +10.39 | +6.60 | +0.24 |
| 0.05 | 3882 | 1499 | 39% | +99.91 | +35.49 | 2.5% | +22.27 | +13.22 | +0.54 |
| 0.10 | 3219 | 1175 | 37% | +92.49 | +38.27 | 3.5% | +11.87 | +26.40 | +1.26 |
| 0.15 | 2721 | 910 | 33% | +71.15 | +25.51 | 3.0% | -0.48 | +25.99 | +1.43 |
| 0.20 | 2306 | 719 | 31% | +62.58 | +24.49 | 3.7% | -2.16 | +26.65 | +1.77 |
| 0.25 | 1997 | 587 | 29% | +59.10 | +26.59 | 5.0% | +0.54 | +26.05 | +2.00 |
| 0.30 | 1684 | 450 | 27% | +38.74 | +11.80 | 2.9% | +2.17 | +9.63 | +0.99 |

## Entry time

The same strategy entered at each horizon, on the traded-candle basis, at min |gap| 0.10. The trade count falls with the lead because fewer markets have a traded candle to enter on: the quote is there at every horizon, but the evidence is not. The edge over Always-NO is **not** flat across them, and its shape is the useful part. An hour before close the strategy is significantly *worse* than doing nothing but betting NO: by then the call has happened, the price has absorbed what was said, and the baseline is built only from prior calls, so the widest gaps are exactly where the market knows something the transcript cannot (t = −4.24). Entered 3–12 hours out it beats the benchmark by 12–23¢ a trade, but at |t| ≈ 1.2 that is not significant at this sample size. From 18 hours out the gap is indistinguishable from zero at every horizon, and the net is the price level and nothing else. So mid-depth leads are the only ones where side selection adds anything at all — and even there the evidence is weak.

| Lead | Live quotes | Traded | Trades | Wins | Win rate | Net | Always NO | Edge vs NO | t |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 5608 | 4367 | 2969 | 288 | 10% | -60.74 | -7.84 | -52.90 | -4.32 |
| 3 | 5606 | 4216 | 2772 | 700 | 25% | +7.67 | -3.47 | +11.14 | +0.63 |
| 6 | 5606 | 3634 | 2344 | 784 | 33% | +40.89 | +17.91 | +22.98 | +1.29 |
| 12 | 5605 | 3082 | 1998 | 683 | 34% | +36.56 | +16.70 | +19.86 | +1.18 |
| 18 | 5571 | 2855 | 1857 | 682 | 37% | +25.35 | +23.17 | +2.18 | +0.14 |
| **24** | 5441 | 2190 | 1410 | 546 | 39% | +28.00 | +27.81 | +0.19 | +0.01 |
| 36 | 5290 | 1510 | 935 | 360 | 39% | +1.95 | +14.77 | -12.82 | -1.11 |
| 48 | 5157 | 1279 | 805 | 326 | 40% | +12.55 | +12.81 | -0.26 | -0.02 |
| 72 | 4693 | 885 | 539 | 209 | 39% | +5.82 | +5.28 | +0.54 | +0.06 |
| 96 | 4456 | 820 | 514 | 213 | 41% | +8.31 | +3.19 | +5.12 | +0.62 |

## Temporal split

Markets closing before 2026-07-01 (train) against those closing on or after it (test). No calibration is fit anywhere in this report — the baseline is the raw transcript one — so the split measures stability across time rather than out-of-sample skill of a fitted parameter. It is still the cheapest check on whether the test half behaves like the train half.

| Split | Trades | Wins | Win rate | Net | Always NO | Edge vs NO | t |
|---|---|---|---|---|---|---|---|
| train | 1017 | 381 | 37% | +21.02 | +30.06 | -9.04 | -0.90 |
| test | 393 | 165 | 42% | +6.98 | -2.25 | +9.23 | +1.12 |

## Capital

Fillable size is capped at **10% of the entry hour's traded volume** — a taker order can only take what someone else traded in the hour it crosses. Everything up to the cap fills at the quoted ask, which is the price this report already assumes; everything past it goes **unfilled** rather than filled worse. So this table is an upper bound on size, not a cost estimate: it does not know how much was actually resting at the ask, and a real order past the cap would either miss or walk deeper and pay more. Participation is a flag, not a fitted parameter — nothing in this repo pins it down.

Sizes are per trade, over the min |gap| 0.10 selection. Net, ROI and capital are at the executable price, so the per-contract average matches the headline table and the only thing size changes is how much of each bet you get.

| Position N | Contracts wanted | Filled | Fill rate | Net | ROI | Capital | Avg slippage | Trades filled | Partially filled |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1410 | 1179 | 84% | +22.68 | 5.5% | 413.99 | +0.000 | 1410 | 382 |
| 10 | 14100 | 6759 | 48% | +135.21 | 5.7% | 2351.69 | +0.000 | 1410 | 981 |
| 25 | 35250 | 11178 | 32% | +221.97 | 5.7% | 3865.49 | +0.000 | 1410 | 1202 |
| 50 | 70500 | 14868 | 21% | +190.80 | 3.8% | 5016.54 | +0.000 | 1410 | 1302 |
| 100 | 141000 | 18276 | 13% | +232.05 | 3.9% | 5956.18 | +0.000 | 1410 | 1368 |
| 250 | 352500 | 21814 | 6% | +564.91 | 8.7% | 6523.49 | +0.000 | 1410 | 1396 |
| 500 | 705000 | 24053 | 3% | +797.41 | 11.8% | 6744.86 | +0.000 | 1410 | 1406 |
| 1000 | 1410000 | 24916 | 2% | +788.31 | 11.6% | 6772.76 | +0.000 | 1410 | 1409 |

## Per company (min |gap| 0.10)

| Company | Trades | Wins | Net |
|---|---|---|---|
| AAL | 11 | 5 | +0.74 |
| AAOI | 1 | 0 | -0.58 |
| AAP | 4 | 1 | -0.66 |
| AAPL | 40 | 18 | +1.61 |
| ABNB | 15 | 1 | -3.40 |
| ACI | 6 | 2 | -0.30 |
| ADBE | 17 | 9 | +1.97 |
| ALK | 4 | 3 | +1.00 |
| ALLY | 4 | 2 | +0.07 |
| AMAT | 7 | 3 | +0.40 |
| AMC | 4 | 2 | +0.81 |
| AMD | 11 | 2 | -2.10 |
| AMZN | 53 | 16 | -2.52 |
| AS | 6 | 3 | +0.79 |
| ASTS | 2 | 0 | -0.92 |
| AVAV | 5 | 3 | +0.47 |
| AVGO | 16 | 5 | -0.55 |
| AXP | 9 | 3 | -0.11 |
| AZO | 3 | 0 | -0.61 |
| BA | 3 | 1 | -0.19 |
| BAC | 9 | 4 | +0.77 |
| BLK | 8 | 3 | +1.40 |
| BULL | 10 | 3 | -1.24 |
| C | 2 | 1 | +0.11 |
| CAR | 1 | 1 | +0.28 |
| CAVA | 11 | 2 | -1.52 |
| CBRL | 7 | 2 | -1.12 |
| CCL | 2 | 0 | -0.37 |
| CELH | 4 | 2 | +0.25 |
| CHWY | 5 | 1 | -0.05 |
| CIEN | 1 | 1 | +0.65 |
| CMG | 10 | 5 | +1.42 |
| COINBASE | 11 | 2 | -0.38 |
| COST | 25 | 5 | -0.46 |
| CRM | 6 | 1 | +0.10 |
| CRWD | 9 | 6 | +1.83 |
| CRWV | 9 | 2 | -0.16 |
| CVNA | 5 | 4 | +1.44 |
| DAL | 10 | 5 | +1.47 |
| DASH | 5 | 3 | +0.69 |
| DE | 11 | 3 | -0.99 |
| DELL | 14 | 8 | +2.21 |
| DIS | 20 | 7 | +0.13 |
| DKNG | 6 | 1 | -0.43 |
| DKS | 4 | 1 | -0.27 |
| DPZ | 11 | 5 | +0.13 |
| DUOL | 3 | 1 | -0.46 |
| EA | 5 | 0 | -0.10 |
| EBAY | 2 | 1 | -0.17 |
| F | 6 | 3 | -0.11 |
| FDX | 9 | 2 | -1.47 |
| FIG | 2 | 1 | +0.13 |
| FUTU | 1 | 1 | +0.34 |
| GEV | 3 | 0 | -0.75 |
| GIS | 3 | 2 | +0.74 |
| GME | 1 | 0 | -0.42 |
| GOOGL | 27 | 13 | +2.74 |
| GRAB | 10 | 3 | -1.00 |
| GS | 11 | 7 | +2.96 |
| HD | 7 | 4 | +0.89 |
| HIMS | 32 | 11 | +0.28 |
| HLT | 6 | 5 | +2.08 |
| HOOD | 18 | 4 | -1.85 |
| HPE | 15 | 6 | +0.50 |
| INTC | 21 | 7 | +0.62 |
| INTU | 6 | 3 | +1.39 |
| JNJ | 9 | 5 | +1.52 |
| JPM | 11 | 4 | +0.59 |
| KLAR | 4 | 3 | +1.14 |
| KO | 14 | 10 | +2.77 |
| KR | 10 | 3 | +0.83 |
| LEVI | 8 | 2 | -1.29 |
| LLY | 7 | 4 | +1.70 |
| LMT | 1 | 0 | -0.12 |
| LOW | 1 | 0 | -0.32 |
| LUCID | 1 | 0 | -0.35 |
| LULU | 2 | 0 | -0.51 |
| LUNR | 6 | 4 | +1.70 |
| LYFT | 15 | 4 | -0.70 |
| M | 2 | 1 | +0.42 |
| MCD | 32 | 14 | +2.83 |
| MDT | 3 | 1 | -0.00 |
| MELI | 1 | 0 | -0.20 |
| META | 30 | 15 | +4.28 |
| MRVL | 16 | 8 | +1.88 |
| MS | 3 | 2 | +0.67 |
| MSFT | 10 | 3 | -1.44 |
| MTN | 5 | 2 | -0.36 |
| MU | 16 | 6 | +0.54 |
| NBIS | 10 | 3 | -0.02 |
| NFLX | 46 | 15 | -1.68 |
| NKE | 18 | 7 | +1.43 |
| NVDA | 49 | 19 | +0.48 |
| OKLO | 2 | 0 | -0.54 |
| ON | 5 | 3 | +0.85 |
| ORCL | 21 | 11 | +1.66 |
| PANW | 1 | 1 | +0.76 |
| PEP | 12 | 6 | -1.02 |
| PG | 13 | 5 | -0.85 |
| PGR | 2 | 1 | -0.24 |
| PLTR | 24 | 11 | +1.05 |
| PSKY | 7 | 1 | -1.24 |
| PYPL | 12 | 6 | +1.41 |
| RDDT | 10 | 2 | -1.14 |
| RIVN | 5 | 2 | -0.32 |
| RKLB | 7 | 1 | -2.06 |
| ROKU | 9 | 4 | +0.03 |
| ROST | 3 | 2 | +0.66 |
| SBUX | 16 | 7 | +0.62 |
| SFM | 3 | 2 | +0.90 |
| SHOP | 8 | 4 | +1.63 |
| SNAP | 11 | 4 | -0.17 |
| SNOW | 8 | 3 | +0.28 |
| SPOT | 19 | 11 | +1.67 |
| STZ | 8 | 6 | +1.46 |
| TFC | 4 | 2 | +0.23 |
| TGT | 17 | 10 | +3.83 |
| TOL | 7 | 1 | -1.42 |
| TOST | 1 | 0 | -0.42 |
| TSLA | 56 | 20 | +0.83 |
| UAL | 18 | 3 | -3.34 |
| UBER | 21 | 5 | -0.93 |
| ULTA | 25 | 7 | -1.78 |
| URBN | 11 | 6 | +0.50 |
| V | 9 | 6 | +1.98 |
| VSCO | 9 | 0 | -2.72 |
| VZ | 8 | 4 | -0.63 |
| WEN | 4 | 3 | +0.77 |
| WFC | 16 | 3 | -0.71 |
| WING | 6 | 4 | +0.91 |
| WMT | 26 | 6 | -0.41 |
| YETI | 4 | 3 | +0.94 |
| YUM | 3 | 2 | +0.53 |
| ZETA | 1 | 1 | +0.53 |
| ZM | 3 | 1 | -0.03 |

## Trades (min |gap| 0.10)

Cost is the price paid; Ask and Bid are the entry candle's quotes, so `Cost` equals the ask on a YES bet and `1 − bid` on a NO bet. Gross and Net are per contract at $1 stake.

| Event | Company | Word | Baseline | Ask | Bid | Cost | Gap | Side | Result | Gross | Net |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2025-03-01 | NKE | Athleisure | 9% | 0.24 | 0.23 | 0.77 | +14 | NO | no | +0.23 | +0.21 |
| 2025-03-01 | NKE | Consumer demand | 72% | 0.83 | 0.82 | 0.18 | +10 | NO | no | +0.82 | +0.80 |
| 2025-03-01 | NKE | Direct-to-consumer / Direct to consumer / DTC / D2C | 68% | 0.40 | 0.36 | 0.40 | +28 | YES | no | -0.40 | -0.42 |
| 2025-03-01 | NKE | Jordan | 86% | 0.99 | 0.98 | 0.02 | +12 | NO | yes | -0.02 | -0.03 |
| 2025-03-20 | MU | Cloud | 80% | 0.67 | 0.60 | 0.67 | +13 | YES | no | -0.67 | -0.69 |
| 2025-03-20 | MU | Data Center | 83% | 0.99 | 0.97 | 0.03 | +14 | NO | yes | -0.03 | -0.04 |
| 2025-03-20 | MU | DRAM Pricing | 41% | 0.16 | 0.10 | 0.16 | +25 | YES | no | -0.16 | -0.17 |
| 2025-03-24 | GME | Close / Closure | 75% | 0.40 | 0.00 | 0.40 | +35 | YES | no | -0.40 | -0.42 |
| 2025-04-23 | TSLA | 4680 battery cell | 4% | 0.23 | 0.18 | 0.82 | +14 | NO | no | +0.18 | +0.16 |
| 2025-04-23 | TSLA | Autonomous | 52% | 0.99 | 0.96 | 0.04 | +44 | NO | yes | -0.04 | -0.05 |
| 2025-04-23 | TSLA | Megapack | 34% | 0.91 | 0.90 | 0.10 | +56 | NO | yes | -0.10 | -0.11 |
| 2025-04-24 | GOOGL | Generative AI / Gen-AI / Gen AI | 17% | 0.95 | 0.90 | 0.10 | +73 | NO | no | +0.90 | +0.89 |
| 2025-04-24 | GOOGL | Regulator / Regulation / Regulatory | 34% | 0.53 | 0.49 | 0.51 | +15 | NO | yes | -0.51 | -0.53 |
| 2025-04-24 | GOOGL | Workspace | 36% | 0.99 | 0.96 | 0.04 | +60 | NO | yes | -0.04 | -0.05 |
| 2025-04-24 | GOOGL | YouTube Shorts | 27% | 0.54 | 0.52 | 0.48 | +25 | NO | yes | -0.48 | -0.50 |
| 2025-05-01 | AMZN | Pharmaceutical / Pharma | 4% | 0.26 | 0.23 | 0.77 | +19 | NO | no | +0.23 | +0.21 |
| 2025-05-01 | AMZN | Regulator / Regulation | 7% | 0.47 | 0.43 | 0.57 | +36 | NO | no | +0.43 | +0.41 |
| 2025-05-01 | AMZN | Subscription | 44% | 0.75 | 0.67 | 0.33 | +23 | NO | no | +0.67 | +0.65 |
| 2025-05-01 | AMZN | Trump | 4% | 0.28 | 0.20 | 0.80 | +16 | NO | no | +0.20 | +0.18 |
| 2025-05-01 | META | Ad targeting / Ad-targeting | 34% | 0.21 | 0.15 | 0.21 | +13 | YES | no | -0.21 | -0.23 |
| 2025-05-01 | META | Efficiency | 44% | 0.95 | 0.90 | 0.10 | +46 | NO | yes | -0.10 | -0.11 |
| 2025-05-01 | META | Metaverse | 30% | 0.89 | 0.85 | 0.15 | +55 | NO | yes | -0.15 | -0.16 |
| 2025-05-01 | META | Reels | 39% | 0.96 | 0.92 | 0.08 | +53 | NO | yes | -0.08 | -0.09 |
| 2025-05-01 | META | Regulator / Regulatory / Regulation | 55% | 0.93 | 0.91 | 0.09 | +36 | NO | yes | -0.09 | -0.10 |
| 2025-05-01 | META | Threads | 26% | 0.96 | 0.92 | 0.08 | +66 | NO | yes | -0.08 | -0.09 |
| 2025-05-01 | META | TikTok | 19% | 0.49 | 0.42 | 0.58 | +23 | NO | no | +0.42 | +0.40 |
| 2025-05-01 | MSFT | Enterprise AI | 10% | 0.39 | 0.31 | 0.69 | +21 | NO | no | +0.31 | +0.29 |
| 2025-05-01 | MSFT | Quantum | 10% | 0.28 | 0.23 | 0.77 | +13 | NO | yes | -0.77 | -0.79 |
| 2025-05-06 | F | Autonomous | 82% | 0.24 | 0.17 | 0.24 | +58 | YES | no | -0.24 | -0.26 |
| 2025-05-06 | F | F-150 Lightning | 14% | 0.40 | 0.32 | 0.68 | +18 | NO | no | +0.32 | +0.30 |
| 2025-05-06 | LUCID | International | 61% | 0.33 | 0.25 | 0.33 | +28 | YES | no | -0.33 | -0.35 |
| 2025-05-07 | AMD | AI Chip | 2% | 0.28 | 0.23 | 0.77 | +21 | NO | no | +0.23 | +0.21 |
| 2025-05-07 | AMD | Automotive / Automobile | 32% | 0.53 | 0.49 | 0.51 | +17 | NO | yes | -0.51 | -0.53 |
| 2025-05-07 | AMD | Buyback | 4% | 0.26 | 0.17 | 0.83 | +13 | NO | no | +0.17 | +0.16 |
| 2025-05-07 | AMD | China | 53% | 0.79 | 0.71 | 0.29 | +18 | NO | yes | -0.29 | -0.31 |
| 2025-05-07 | AMD | HPC | 47% | 0.80 | 0.74 | 0.26 | +27 | NO | yes | -0.26 | -0.28 |
| 2025-05-07 | AMD | Inference | 20% | 0.94 | 0.87 | 0.13 | +67 | NO | yes | -0.13 | -0.14 |
| 2025-05-07 | DIS | Merchandise | 77% | 0.30 | 0.23 | 0.30 | +47 | YES | no | -0.30 | -0.32 |
| 2025-05-07 | DIS | Netflix | 61% | 0.28 | 0.19 | 0.28 | +33 | YES | no | -0.28 | -0.30 |
| 2025-05-07 | DIS | Pricing power | 17% | 0.30 | 0.27 | 0.73 | +10 | NO | no | +0.27 | +0.25 |
| 2025-05-08 | AMC | Box office recovery | 19% | 0.54 | 0.51 | 0.49 | +32 | NO | no | +0.51 | +0.49 |
| 2025-05-08 | AMC | Theater attendance | 19% | 0.41 | 0.38 | 0.62 | +19 | NO | no | +0.38 | +0.36 |
| 2025-05-09 | COINBASE | Decentralized Exchange / DEX | 57% | 0.43 | 0.42 | 0.43 | +14 | YES | yes | +0.57 | +0.55 |
| 2025-05-09 | COINBASE | Margin | 52% | 0.80 | 0.78 | 0.22 | +26 | NO | yes | -0.22 | -0.24 |
| 2025-05-09 | COINBASE | Stablecoin | 67% | 0.94 | 0.92 | 0.08 | +25 | NO | yes | -0.08 | -0.09 |
| 2025-05-29 | NVDA | CUDA | 63% | 0.93 | 0.91 | 0.09 | +28 | NO | yes | -0.09 | -0.10 |
| 2025-05-29 | NVDA | Data center | 83% | 1.00 | 0.98 | 0.02 | +15 | NO | yes | -0.02 | -0.03 |
| 2025-05-29 | NVDA | DGX Cloud | 10% | 0.38 | 0.31 | 0.69 | +21 | NO | no | +0.31 | +0.29 |
| 2025-05-29 | NVDA | Export restriction | 5% | 0.32 | 0.30 | 0.70 | +25 | NO | yes | -0.70 | -0.72 |
| 2025-05-29 | NVDA | H100 | 23% | 0.70 | 0.63 | 0.37 | +40 | NO | yes | -0.37 | -0.39 |
| 2025-05-29 | NVDA | Quantum | 36% | 0.84 | 0.80 | 0.20 | +44 | NO | yes | -0.20 | -0.22 |
| 2025-07-16 | NFLX | Ad-supported | 23% | 0.72 | 0.71 | 0.29 | +48 | NO | yes | -0.29 | -0.31 |
| 2025-07-16 | NFLX | Churn | 77% | 0.63 | 0.62 | 0.63 | +14 | YES | no | -0.63 | -0.65 |
| 2025-07-16 | NFLX | Engagement | 66% | 1.00 | 0.95 | 0.05 | +29 | NO | yes | -0.05 | -0.06 |
| 2025-07-16 | NFLX | Squid Game | 21% | 0.95 | 0.90 | 0.10 | +69 | NO | yes | -0.10 | -0.11 |
| 2025-07-21 | TSLA | Autonomous | 52% | 0.96 | 0.94 | 0.06 | +42 | NO | yes | -0.06 | -0.07 |
| 2025-07-21 | TSLA | Big Beautiful Bill | 2% | 0.40 | 0.32 | 0.68 | +30 | NO | no | +0.32 | +0.30 |
| 2025-07-21 | TSLA | DOGE / Department of Government Efficiency | 5% | 0.34 | 0.30 | 0.70 | +25 | NO | no | +0.30 | +0.28 |
| 2025-07-21 | TSLA | Full Self-Driving / FSD | 51% | 0.99 | 0.96 | 0.04 | +45 | NO | yes | -0.04 | -0.05 |
| 2025-07-21 | TSLA | Gigafactory | 55% | 0.78 | 0.74 | 0.26 | +19 | NO | no | +0.74 | +0.72 |
| 2025-07-21 | TSLA | Grok4 | 2% | 0.61 | 0.58 | 0.42 | +56 | NO | yes | -0.42 | -0.44 |
| 2025-07-21 | TSLA | Robotaxi | 31% | 0.99 | 0.96 | 0.04 | +65 | NO | yes | -0.04 | -0.05 |
| 2025-07-21 | TSLA | Supercharger / Super Charger / Super-charger | 51% | 0.69 | 0.67 | 0.33 | +16 | NO | no | +0.67 | +0.65 |
| 2025-07-21 | TSLA | Tariff | 18% | 0.89 | 0.85 | 0.15 | +67 | NO | yes | -0.15 | -0.16 |
| 2025-07-21 | TSLA | Trump | 9% | 0.52 | 0.49 | 0.51 | +40 | NO | no | +0.49 | +0.47 |
| 2025-07-21 | TSLA | xAI | 7% | 0.77 | 0.72 | 0.28 | +65 | NO | yes | -0.28 | -0.30 |
| 2025-07-22 | GOOGL | Youtube Shorts | 28% | 1.00 | 0.99 | 0.01 | +71 | NO | yes | -0.01 | -0.02 |
| 2025-07-31 | AAPL | M3 | 11% | 0.69 | 0.64 | 0.36 | +53 | NO | no | +0.64 | +0.62 |
| 2025-07-31 | AAPL | Tariff | 16% | 0.92 | 0.91 | 0.09 | +75 | NO | yes | -0.09 | -0.10 |
| 2025-07-31 | AAPL | WWDC | 24% | 0.72 | 0.71 | 0.29 | +47 | NO | yes | -0.29 | -0.31 |
| 2025-07-31 | AMZN | Advertising | 77% | 1.00 | 0.95 | 0.05 | +18 | NO | yes | -0.05 | -0.06 |
| 2025-07-31 | AMZN | Supply Chain | 28% | 0.76 | 0.69 | 0.31 | +41 | NO | no | +0.69 | +0.67 |
| 2025-07-31 | AMZN | Tariff | 4% | 0.98 | 0.94 | 0.06 | +90 | NO | yes | -0.06 | -0.07 |
| 2025-07-31 | AMZN | Thursday Night Football | 26% | 0.47 | 0.38 | 0.62 | +12 | NO | no | +0.38 | +0.36 |
| 2025-08-04 | PLTR | Kill | 38% | 0.03 | 0.00 | 0.03 | +35 | YES | no | -0.03 | -0.04 |
| 2025-08-05 | AMD | healthcare | 21% | 1.00 | 0.99 | 0.01 | +78 | NO | yes | -0.01 | -0.02 |
| 2025-08-05 | AMD | HPC | 47% | 1.00 | 0.99 | 0.01 | +52 | NO | yes | -0.01 | -0.02 |
| 2025-08-06 | UBER | Capital Allocation | 59% | 1.00 | 0.99 | 0.01 | +40 | NO | yes | -0.01 | -0.02 |
| 2025-08-06 | UBER | Ecosystem | 41% | 1.00 | 0.99 | 0.01 | +58 | NO | yes | -0.01 | -0.02 |
| 2025-08-06 | UBER | Lucid | 5% | 1.00 | 0.99 | 0.01 | +94 | NO | yes | -0.01 | -0.02 |
| 2025-08-06 | UBER | Tesla | 16% | 1.00 | 0.99 | 0.01 | +83 | NO | yes | -0.01 | -0.02 |
| 2025-08-11 | AMC | Box office | 87% | 1.00 | 0.99 | 0.01 | +12 | NO | yes | -0.01 | -0.02 |
| 2025-08-11 | AMC | Streaming | 67% | 1.00 | 0.99 | 0.01 | +32 | NO | yes | -0.01 | -0.02 |
| 2025-08-21 | WMT | Automation | 41% | 1.00 | 0.99 | 0.01 | +58 | NO | yes | -0.01 | -0.02 |
| 2025-08-21 | WMT | Back-to-school | 43% | 1.00 | 0.99 | 0.01 | +56 | NO | yes | -0.01 | -0.02 |
| 2025-08-21 | WMT | Brick-and-mortar | 8% | 1.00 | 0.99 | 0.01 | +91 | NO | yes | -0.01 | -0.02 |
| 2025-08-21 | WMT | Free cash flow | 58% | 1.00 | 0.91 | 0.09 | +33 | NO | yes | -0.09 | -0.10 |
| 2025-08-21 | WMT | Health and wellness | 73% | 1.00 | 0.99 | 0.01 | +26 | NO | yes | -0.01 | -0.02 |
| 2025-08-21 | WMT | Omnichannel | 40% | 1.00 | 0.99 | 0.01 | +59 | NO | yes | -0.01 | -0.02 |
| 2025-08-21 | WMT | Operating margin | 21% | 1.00 | 0.99 | 0.01 | +78 | NO | yes | -0.01 | -0.02 |
| 2025-08-21 | WMT | Profit faster than sales | 19% | 1.00 | 0.99 | 0.01 | +80 | NO | yes | -0.01 | -0.02 |
| 2025-08-21 | WMT | Q3 | 60% | 1.00 | 0.99 | 0.01 | +39 | NO | yes | -0.01 | -0.02 |
| 2025-08-27 | NVDA | Blackwell | 12% | 1.00 | 0.98 | 0.02 | +86 | NO | yes | -0.02 | -0.03 |
| 2025-08-27 | NVDA | Cosmos | 5% | 0.80 | 0.76 | 0.24 | +71 | NO | yes | -0.24 | -0.26 |
| 2025-08-27 | NVDA | Datacenter | 2% | 1.00 | 0.99 | 0.01 | +97 | NO | yes | -0.01 | -0.02 |
| 2025-08-27 | NVDA | Enterprise | 84% | 1.00 | 0.98 | 0.02 | +14 | NO | yes | -0.02 | -0.03 |
| 2025-08-27 | NVDA | Hopper | 23% | 0.91 | 0.90 | 0.10 | +67 | NO | yes | -0.10 | -0.11 |
| 2025-08-27 | NVDA | Inference | 63% | 1.00 | 0.98 | 0.02 | +35 | NO | yes | -0.02 | -0.03 |
| 2025-08-27 | NVDA | Networking | 49% | 0.97 | 0.95 | 0.05 | +46 | NO | yes | -0.05 | -0.06 |
| 2025-08-27 | NVDA | Production | 83% | 0.98 | 0.94 | 0.06 | +11 | NO | yes | -0.06 | -0.07 |
| 2025-08-27 | NVDA | Professional | 77% | 0.64 | 0.63 | 0.64 | +13 | YES | yes | +0.36 | +0.34 |
| 2025-08-27 | NVDA | Sovereign | 15% | 0.94 | 0.90 | 0.10 | +75 | NO | yes | -0.10 | -0.11 |
| 2025-09-10 | ORCL | RPO /  Remaining Performance Obligation | 35% | 1.00 | 0.99 | 0.01 | +64 | NO | yes | -0.01 | -0.02 |
| 2025-09-17 | CBRL | Logo | 5% | 0.81 | 0.72 | 0.28 | +67 | NO | yes | -0.28 | -0.30 |
| 2025-09-17 | CBRL | Rebrand | 5% | 0.38 | 0.30 | 0.70 | +25 | NO | no | +0.30 | +0.28 |
| 2025-09-17 | CBRL | Tariff | 25% | 0.84 | 0.83 | 0.17 | +58 | NO | yes | -0.17 | -0.18 |
| 2025-09-23 | MU | Cloud | 77% | 0.45 | 0.42 | 0.45 | +32 | YES | yes | +0.55 | +0.53 |
| 2025-09-23 | MU | Expansion | 62% | 0.79 | 0.73 | 0.27 | +11 | NO | yes | -0.27 | -0.29 |
| 2025-09-23 | MU | GPU | 21% | 0.82 | 0.80 | 0.20 | +59 | NO | no | +0.80 | +0.78 |
| 2025-09-23 | MU | Idaho | 19% | 0.85 | 0.81 | 0.19 | +62 | NO | yes | -0.19 | -0.21 |
| 2025-09-23 | MU | Nvidia | 29% | 0.82 | 0.76 | 0.24 | +47 | NO | yes | -0.24 | -0.26 |
| 2025-09-25 | COST | Revenue | 43% | 0.66 | 0.64 | 0.36 | +21 | NO | yes | -0.36 | -0.38 |
| 2025-09-25 | COST | Tariff | 19% | 0.94 | 0.92 | 0.08 | +73 | NO | yes | -0.08 | -0.09 |
| 2025-09-30 | NKE | Consumer Demand | 69% | 0.42 | 0.40 | 0.42 | +27 | YES | no | -0.42 | -0.44 |
| 2025-09-30 | NKE | Tatum | 15% | 0.54 | 0.51 | 0.49 | +36 | NO | no | +0.51 | +0.49 |
| 2025-10-09 | DAL | Nonstop / Non-Stop | 8% | 0.45 | 0.43 | 0.57 | +35 | NO | no | +0.43 | +0.41 |
| 2025-10-09 | DAL | Partnership | 70% | 0.89 | 0.86 | 0.14 | +16 | NO | yes | -0.14 | -0.15 |
| 2025-10-09 | DAL | Tariff | 29% | 0.85 | 0.76 | 0.24 | +47 | NO | yes | -0.24 | -0.26 |
| 2025-10-09 | DAL | Weather | 53% | 0.83 | 0.77 | 0.23 | +24 | NO | no | +0.77 | +0.75 |
| 2025-10-09 | DAL | YouTube | 9% | 0.35 | 0.30 | 0.70 | +21 | NO | yes | -0.70 | -0.72 |
| 2025-10-10 | BLK | Digital asset | 43% | 1.00 | 0.99 | 0.01 | +56 | NO | yes | -0.01 | -0.02 |
| 2025-10-10 | BLK | ETF inflow | 15% | 1.00 | 0.99 | 0.01 | +84 | NO | yes | -0.01 | -0.02 |
| 2025-10-10 | BLK | Record AUM | 31% | 0.99 | 0.81 | 0.19 | +50 | NO | yes | -0.19 | -0.21 |
| 2025-10-10 | BLK | Revenue growth | 76% | 0.01 | 0.00 | 0.01 | +75 | YES | no | -0.01 | -0.02 |
| 2025-10-14 | GS | Charge Off / Charge-Off | 77% | 0.92 | 0.89 | 0.11 | +12 | NO | yes | -0.11 | -0.12 |
| 2025-10-14 | GS | Tariff | 12% | 0.73 | 0.64 | 0.36 | +52 | NO | no | +0.64 | +0.62 |
| 2025-10-14 | JPM | Buyback | 63% | 1.00 | 0.99 | 0.01 | +36 | NO | yes | -0.01 | -0.02 |
| 2025-10-14 | JPM | Tariff | 10% | 1.00 | 0.99 | 0.01 | +89 | NO | yes | -0.01 | -0.02 |
| 2025-10-14 | JPM | Trading | 85% | 1.00 | 0.99 | 0.01 | +14 | NO | yes | -0.01 | -0.02 |
| 2025-10-15 | BAC | Tariff | 7% | 0.79 | 0.71 | 0.29 | +64 | NO | yes | -0.29 | -0.31 |
| 2025-10-16 | UAL | ATC | 22% | 0.70 | 0.62 | 0.38 | +40 | NO | yes | -0.38 | -0.40 |
| 2025-10-16 | UAL | Newark | 69% | 0.92 | 0.87 | 0.13 | +18 | NO | yes | -0.13 | -0.14 |
| 2025-10-17 | AXP | Coinbase | 4% | 0.48 | 0.47 | 0.53 | +43 | NO | no | +0.47 | +0.45 |
| 2025-10-17 | AXP | Currency | 28% | 0.50 | 0.47 | 0.53 | +19 | NO | no | +0.47 | +0.45 |
| 2025-10-17 | AXP | Millennial | 45% | 0.97 | 0.95 | 0.05 | +50 | NO | yes | -0.05 | -0.06 |
| 2025-10-21 | KO | Dividend | 74% | 0.03 | 0.02 | 0.03 | +71 | YES | no | -0.03 | -0.04 |
| 2025-10-21 | KO | International | 30% | 1.00 | 0.99 | 0.01 | +69 | NO | yes | -0.01 | -0.02 |
| 2025-10-21 | NFLX | Acquisition | 71% | 0.88 | 0.85 | 0.15 | +14 | NO | yes | -0.15 | -0.16 |
| 2025-10-21 | NFLX | Ad Supported | 4% | 0.54 | 0.53 | 0.47 | +49 | NO | no | +0.53 | +0.51 |
| 2025-10-21 | NFLX | Churn | 76% | 0.37 | 0.34 | 0.37 | +39 | YES | no | -0.37 | -0.39 |
| 2025-10-21 | NFLX | Gaming | 32% | 0.65 | 0.64 | 0.36 | +32 | NO | yes | -0.36 | -0.38 |
| 2025-10-21 | NFLX | Hollywood | 33% | 0.51 | 0.48 | 0.52 | +15 | NO | yes | -0.52 | -0.54 |
| 2025-10-21 | NFLX | Live Event | 19% | 0.95 | 0.92 | 0.08 | +73 | NO | yes | -0.08 | -0.09 |
| 2025-10-21 | NFLX | Partnership | 57% | 0.70 | 0.67 | 0.33 | +10 | NO | yes | -0.33 | -0.35 |
| 2025-10-21 | NFLX | Profitable | 49% | 0.76 | 0.74 | 0.26 | +25 | NO | yes | -0.26 | -0.28 |
| 2025-10-21 | NFLX | Subscriber | 90% | 0.68 | 0.67 | 0.68 | +22 | YES | no | -0.68 | -0.70 |
| 2025-10-22 | TSLA | Competition | 20% | 0.46 | 0.43 | 0.57 | +23 | NO | yes | -0.57 | -0.59 |
| 2025-10-22 | TSLA | Cybertruck | 37% | 0.85 | 0.83 | 0.17 | +46 | NO | no | +0.83 | +0.82 |
| 2025-10-22 | TSLA | Delivery | 75% | 0.90 | 0.87 | 0.13 | +12 | NO | yes | -0.13 | -0.14 |
| 2025-10-22 | TSLA | Energy | 77% | 0.98 | 0.97 | 0.03 | +20 | NO | yes | -0.03 | -0.04 |
| 2025-10-22 | TSLA | FSD / Full Self Driving | 42% | 0.97 | 0.96 | 0.04 | +54 | NO | yes | -0.04 | -0.05 |
| 2025-10-22 | TSLA | Gigafactory | 55% | 0.70 | 0.68 | 0.32 | +13 | NO | no | +0.68 | +0.66 |
| 2025-10-22 | TSLA | Grok4 | 2% | 0.30 | 0.28 | 0.72 | +26 | NO | no | +0.28 | +0.26 |
| 2025-10-22 | TSLA | Optimus | 24% | 0.98 | 0.95 | 0.05 | +71 | NO | yes | -0.05 | -0.06 |
| 2025-10-22 | TSLA | Supercharger / Super Charger | 50% | 0.30 | 0.28 | 0.30 | +20 | YES | yes | +0.70 | +0.68 |
| 2025-10-22 | TSLA | Robotaxi | 32% | 0.99 | 0.97 | 0.03 | +65 | NO | yes | -0.03 | -0.04 |
| 2025-10-23 | AAL | Shutdown / Shut Down | 18% | 0.73 | 0.65 | 0.35 | +47 | NO | yes | -0.35 | -0.37 |
| 2025-10-23 | AAL | Tariff | 14% | 0.50 | 0.45 | 0.55 | +31 | NO | no | +0.45 | +0.43 |
| 2025-10-23 | AAL | World Cup | 10% | 0.54 | 0.48 | 0.52 | +38 | NO | no | +0.48 | +0.46 |
| 2025-10-23 | INTC | AIPC | 2% | 0.83 | 0.76 | 0.24 | +74 | NO | yes | -0.24 | -0.26 |
| 2025-10-23 | INTC | Department of Defense | 10% | 0.38 | 0.33 | 0.67 | +23 | NO | no | +0.33 | +0.31 |
| 2025-10-23 | INTC | Trump | 4% | 0.67 | 0.45 | 0.55 | +41 | NO | yes | -0.55 | -0.57 |
| 2025-10-24 | PG | Competition | 78% | 0.44 | 0.36 | 0.44 | +34 | YES | no | -0.44 | -0.46 |
| 2025-10-24 | PG | E-commerce | 73% | 0.38 | 0.30 | 0.38 | +35 | YES | no | -0.38 | -0.40 |
| 2025-10-24 | PG | Mason Campus | 3% | 0.36 | 0.27 | 0.73 | +24 | NO | no | +0.27 | +0.25 |
| 2025-10-24 | PG | Revenue | 48% | 0.36 | 0.34 | 0.36 | +12 | YES | no | -0.36 | -0.38 |
| 2025-10-26 | SNOW | Hiring | 88% | 0.75 | 0.74 | 0.75 | +13 | YES | yes | +0.25 | +0.23 |
| 2025-10-26 | SNOW | Iceberg | 54% | 0.89 | 0.86 | 0.14 | +32 | NO | no | +0.86 | +0.85 |
| 2025-10-28 | EA | Acquisition | 74% | 0.01 | 0.00 | 0.01 | +73 | YES | no | -0.01 | -0.02 |
| 2025-10-28 | EA | Apex Legends | 64% | 0.01 | 0.00 | 0.01 | +63 | YES | no | -0.01 | -0.02 |
| 2025-10-28 | EA | Competition | 80% | 0.01 | 0.00 | 0.01 | +79 | YES | no | -0.01 | -0.02 |
| 2025-10-28 | EA | Mobile | 96% | 0.01 | 0.00 | 0.01 | +95 | YES | no | -0.01 | -0.02 |
| 2025-10-28 | EA | EA Sports FC | 35% | 0.01 | 0.00 | 0.01 | +34 | YES | no | -0.01 | -0.02 |
| 2025-10-28 | PYPL | Blue Owl | 4% | 0.68 | 0.59 | 0.41 | +55 | NO | yes | -0.41 | -0.43 |
| 2025-10-28 | PYPL | Unprofitable | 15% | 0.50 | 0.48 | 0.52 | +33 | NO | yes | -0.52 | -0.54 |
| 2025-10-29 | COINBASE | Margin | 54% | 0.83 | 0.76 | 0.24 | +22 | NO | yes | -0.24 | -0.26 |
| 2025-10-29 | COINBASE | Prediction Market | 16% | 0.74 | 0.68 | 0.32 | +52 | NO | yes | -0.32 | -0.34 |
| 2025-10-29 | COINBASE | Stablecoin | 68% | 1.00 | 0.94 | 0.06 | +26 | NO | yes | -0.06 | -0.07 |
| 2025-10-29 | COINBASE | Web3 | 54% | 0.16 | 0.11 | 0.16 | +38 | YES | yes | +0.84 | +0.83 |
| 2025-10-29 | HOOD | Prediction Market | 22% | 0.96 | 0.93 | 0.07 | +71 | NO | yes | -0.07 | -0.08 |
| 2025-10-29 | META | Algorithm | 24% | 0.56 | 0.53 | 0.47 | +29 | NO | no | +0.53 | +0.51 |
| 2025-10-29 | META | Dividend | 20% | 0.96 | 0.94 | 0.06 | +74 | NO | yes | -0.06 | -0.07 |
| 2025-10-29 | META | Orion | 8% | 0.72 | 0.69 | 0.31 | +61 | NO | yes | -0.31 | -0.33 |
| 2025-10-29 | SBUX | Non Dairy | 3% | 0.44 | 0.31 | 0.69 | +28 | NO | yes | -0.69 | -0.71 |
| 2025-10-29 | SBUX | Pumpkin Spice | 23% | 0.61 | 0.56 | 0.44 | +33 | NO | no | +0.56 | +0.54 |
| 2025-10-30 | AAPL | Formula 1 / F1 | 7% | 0.75 | 0.72 | 0.28 | +65 | NO | yes | -0.28 | -0.30 |
| 2025-10-30 | AAPL | Manufacturing | 58% | 0.74 | 0.71 | 0.29 | +13 | NO | yes | -0.29 | -0.31 |
| 2025-10-30 | AAPL | Modem | 11% | 0.35 | 0.28 | 0.72 | +17 | NO | no | +0.28 | +0.26 |
| 2025-10-30 | AAPL | The Studio | 7% | 0.91 | 0.83 | 0.17 | +76 | NO | yes | -0.17 | -0.18 |
| 2025-10-30 | AAPL | Widget | 6% | 0.37 | 0.29 | 0.71 | +23 | NO | no | +0.29 | +0.27 |
| 2025-10-30 | AMZN | Amazon Bedrock | 15% | 0.83 | 0.75 | 0.25 | +60 | NO | yes | -0.25 | -0.27 |
| 2025-10-30 | AMZN | China | 43% | 0.72 | 0.71 | 0.29 | +28 | NO | no | +0.71 | +0.69 |
| 2025-10-30 | AMZN | Live Sports | 22% | 0.83 | 0.75 | 0.25 | +53 | NO | yes | -0.25 | -0.27 |
| 2025-10-30 | AMZN | Operating Margin | 72% | 0.98 | 0.97 | 0.03 | +25 | NO | yes | -0.03 | -0.04 |
| 2025-10-30 | AMZN | Project Kuiper | 12% | 0.82 | 0.76 | 0.24 | +64 | NO | yes | -0.24 | -0.26 |
| 2025-10-30 | AMZN | Sponsored Products | 24% | 0.68 | 0.66 | 0.34 | +42 | NO | yes | -0.34 | -0.36 |
| 2025-10-30 | AMZN | Supply Chain | 27% | 0.63 | 0.56 | 0.44 | +29 | NO | no | +0.56 | +0.54 |
| 2025-10-30 | AMZN | Third Party Sellers | 4% | 0.69 | 0.62 | 0.38 | +58 | NO | yes | -0.38 | -0.40 |
| 2025-10-30 | GOOGL | Acquisition | 96% | 0.82 | 0.77 | 0.82 | +14 | YES | yes | +0.18 | +0.16 |
| 2025-10-30 | GOOGL | DeepMind / Deep Mind | 34% | 0.66 | 0.58 | 0.42 | +24 | NO | no | +0.58 | +0.56 |
| 2025-10-30 | GOOGL | Wiz | 4% | 0.36 | 0.26 | 0.74 | +22 | NO | no | +0.26 | +0.24 |
| 2025-10-30 | RDDT | Election | 48% | 0.18 | 0.05 | 0.18 | +30 | YES | no | -0.18 | -0.20 |
| 2025-10-30 | RDDT | OpenAI / Open AI | 58% | 0.28 | 0.27 | 0.28 | +30 | YES | no | -0.28 | -0.30 |
| 2025-10-30 | RDDT | Reddit Pro (3+ times) | 17% | 0.77 | 0.55 | 0.45 | +38 | NO | yes | -0.45 | -0.47 |
| 2025-10-30 | ROKU | Bundle (3+ times) | 4% | 0.38 | 0.31 | 0.69 | +27 | NO | no | +0.31 | +0.29 |
| 2025-10-30 | ROKU | Hour | 89% | 0.53 | 0.52 | 0.53 | +36 | YES | yes | +0.47 | +0.45 |
| 2025-10-30 | ROKU | Howdy | 4% | 0.81 | 0.72 | 0.28 | +68 | NO | yes | -0.28 | -0.30 |
| 2025-10-30 | UBER | Market Share | 43% | 0.19 | 0.13 | 0.19 | +24 | YES | no | -0.19 | -0.21 |
| 2025-10-30 | UBER | Waymo | 26% | 0.96 | 0.95 | 0.05 | +69 | NO | yes | -0.05 | -0.06 |
| 2025-11-03 | HIMS | Canada | 16% | 0.83 | 0.81 | 0.19 | +65 | NO | yes | -0.19 | -0.21 |
| 2025-11-03 | HIMS | Europe | 16% | 0.59 | 0.56 | 0.44 | +40 | NO | yes | -0.44 | -0.46 |
| 2025-11-03 | HIMS | FDA | 25% | 0.77 | 0.71 | 0.29 | +46 | NO | yes | -0.29 | -0.31 |
| 2025-11-03 | HIMS | Tariff | 16% | 0.62 | 0.41 | 0.59 | +25 | NO | no | +0.41 | +0.39 |
| 2025-11-03 | HIMS | Testosterone | 29% | 0.91 | 0.89 | 0.11 | +60 | NO | yes | -0.11 | -0.12 |
| 2025-11-03 | HIMS | Vitamin | 25% | 0.84 | 0.80 | 0.20 | +55 | NO | yes | -0.20 | -0.22 |
| 2025-11-03 | PLTR | Hadean | 7% | 0.64 | 0.61 | 0.39 | +54 | NO | no | +0.61 | +0.59 |
| 2025-11-03 | PLTR | Lethal | 28% | 0.64 | 0.63 | 0.37 | +35 | NO | yes | -0.37 | -0.39 |
| 2025-11-03 | PLTR | Nvidia | 7% | 0.91 | 0.86 | 0.14 | +79 | NO | no | +0.86 | +0.85 |
| 2025-11-03 | PLTR | Shutdown / Shut Down | 7% | 0.74 | 0.73 | 0.27 | +66 | NO | no | +0.73 | +0.71 |
| 2025-11-03 | PLTR | Warp Speed | 7% | 0.81 | 0.79 | 0.21 | +72 | NO | yes | -0.21 | -0.23 |
| 2025-11-05 | CAVA | Hyphen | 19% | 0.63 | 0.60 | 0.40 | +41 | NO | no | +0.60 | +0.58 |
| 2025-11-05 | CELH | Amazon | 76% | 0.93 | 0.90 | 0.10 | +14 | NO | no | +0.90 | +0.89 |
| 2025-11-05 | LYFT | Expansion | 53% | 0.81 | 0.72 | 0.28 | +19 | NO | no | +0.72 | +0.70 |
| 2025-11-05 | LYFT | FreeNow / Free Now | 12% | 0.88 | 0.84 | 0.16 | +72 | NO | yes | -0.16 | -0.17 |
| 2025-11-05 | LYFT | Membership | 43% | 0.30 | 0.23 | 0.30 | +13 | YES | no | -0.30 | -0.32 |
| 2025-11-05 | LYFT | Mobileye | 16% | 0.44 | 0.35 | 0.65 | +19 | NO | no | +0.35 | +0.33 |
| 2025-11-05 | LYFT | Waymo | 33% | 0.91 | 0.86 | 0.14 | +53 | NO | yes | -0.14 | -0.15 |
| 2025-11-06 | DKNG | Missouri | 22% | 0.89 | 0.87 | 0.13 | +65 | NO | yes | -0.13 | -0.14 |
| 2025-11-06 | DKNG | Prediction | 30% | 0.98 | 0.95 | 0.05 | +65 | NO | yes | -0.05 | -0.06 |
| 2025-11-06 | MCD | Competition | 56% | 0.01 | 0.00 | 0.01 | +55 | YES | no | -0.01 | -0.02 |
| 2025-11-06 | MCD | Delivery | 73% | 1.00 | 0.97 | 0.03 | +24 | NO | yes | -0.03 | -0.04 |
| 2025-11-06 | MCD | Happy Meal | 28% | 1.00 | 0.98 | 0.02 | +70 | NO | yes | -0.02 | -0.03 |
| 2025-11-06 | MCD | McCrispy Chicken | 16% | 0.03 | 0.00 | 0.03 | +13 | YES | no | -0.03 | -0.04 |
| 2025-11-06 | MCD | Revenue | 47% | 0.04 | 0.00 | 0.04 | +43 | YES | no | -0.04 | -0.05 |
| 2025-11-06 | MCD | Supply Chain | 54% | 1.00 | 0.99 | 0.01 | +45 | NO | yes | -0.01 | -0.02 |
| 2025-11-06 | MCD | Tariff | 8% | 1.00 | 0.99 | 0.01 | +91 | NO | yes | -0.01 | -0.02 |
| 2025-11-06 | SNAP | Platinum | 11% | 0.34 | 0.29 | 0.71 | +18 | NO | yes | -0.71 | -0.73 |
| 2025-11-06 | SNAP | Storage | 11% | 0.68 | 0.63 | 0.37 | +52 | NO | yes | -0.37 | -0.39 |
| 2025-11-06 | SNAP | Xbox | 7% | 0.76 | 0.71 | 0.29 | +64 | NO | no | +0.71 | +0.69 |
| 2025-11-07 | ABNB | China | 54% | 0.43 | 0.37 | 0.43 | +11 | YES | no | -0.43 | -0.45 |
| 2025-11-07 | ABNB | Domestic | 67% | 0.89 | 0.80 | 0.20 | +13 | NO | yes | -0.20 | -0.22 |
| 2025-11-07 | ABNB | Service Agent | 37% | 0.86 | 0.77 | 0.23 | +40 | NO | yes | -0.23 | -0.25 |
| 2025-11-07 | ABNB | Social Media | 49% | 0.88 | 0.80 | 0.20 | +31 | NO | yes | -0.20 | -0.22 |
| 2025-11-10 | CRWV | CrowdStrike / Crowd Strike | 27% | 0.87 | 0.81 | 0.19 | +54 | NO | yes | -0.19 | -0.21 |
| 2025-11-10 | CRWV | Government | 56% | 0.73 | 0.72 | 0.28 | +16 | NO | yes | -0.28 | -0.30 |
| 2025-11-10 | CRWV | Healthcare | 56% | 0.74 | 0.73 | 0.27 | +17 | NO | no | +0.73 | +0.71 |
| 2025-11-10 | CRWV | Marimo | 27% | 0.96 | 0.94 | 0.06 | +67 | NO | yes | -0.06 | -0.07 |
| 2025-11-10 | CRWV | Meta | 56% | 0.91 | 0.88 | 0.12 | +32 | NO | yes | -0.12 | -0.13 |
| 2025-11-10 | CRWV | Nvidia | 67% | 0.97 | 0.95 | 0.05 | +28 | NO | yes | -0.05 | -0.06 |
| 2025-11-10 | CRWV | Shutdown / Shut Down | 27% | 0.44 | 0.43 | 0.57 | +16 | NO | no | +0.43 | +0.41 |
| 2025-11-10 | RKLB | Golden Dome | 17% | 0.87 | 0.78 | 0.22 | +61 | NO | yes | -0.22 | -0.24 |
| 2025-11-10 | RKLB | Japan | 22% | 0.79 | 0.70 | 0.30 | +48 | NO | yes | -0.30 | -0.32 |
| 2025-11-10 | RKLB | Lunar | 32% | 0.50 | 0.45 | 0.55 | +13 | NO | no | +0.45 | +0.43 |
| 2025-11-10 | RKLB | Reusable | 72% | 0.86 | 0.83 | 0.17 | +11 | NO | yes | -0.17 | -0.18 |
| 2025-11-10 | RKLB | Shutdown / Shut Down | 18% | 0.49 | 0.40 | 0.60 | +22 | NO | yes | -0.60 | -0.62 |
| 2025-11-11 | NBIS | Uber | 67% | 0.87 | 0.77 | 0.23 | +10 | NO | no | +0.77 | +0.75 |
| 2025-11-13 | DIS | Abu Dhabi | 5% | 0.71 | 0.67 | 0.33 | +62 | NO | yes | -0.33 | -0.35 |
| 2025-11-13 | DIS | Buyback | 32% | 0.16 | 0.13 | 0.16 | +16 | YES | no | -0.16 | -0.17 |
| 2025-11-13 | DIS | Competition | 47% | 0.91 | 0.89 | 0.11 | +42 | NO | yes | -0.11 | -0.12 |
| 2025-11-13 | DIS | DraftKings | 4% | 0.53 | 0.52 | 0.48 | +48 | NO | no | +0.52 | +0.50 |
| 2025-11-13 | DIS | NFL Deal | 10% | 0.36 | 0.33 | 0.67 | +23 | NO | no | +0.33 | +0.31 |
| 2025-11-13 | DIS | YouTube TV | 4% | 0.56 | 0.55 | 0.45 | +51 | NO | no | +0.55 | +0.53 |
| 2025-11-13 | DIS | Zootopia | 34% | 0.93 | 0.92 | 0.08 | +58 | NO | yes | -0.08 | -0.09 |
| 2025-11-18 | HD | Synergy | 7% | 0.54 | 0.51 | 0.49 | +44 | NO | yes | -0.49 | -0.51 |
| 2025-11-18 | HD | Volatility | 18% | 0.64 | 0.60 | 0.40 | +42 | NO | no | +0.60 | +0.58 |
| 2025-11-19 | TGT | Black Friday | 39% | 0.94 | 0.91 | 0.09 | +52 | NO | no | +0.91 | +0.90 |
| 2025-11-19 | TGT | Inflation | 44% | 0.80 | 0.76 | 0.24 | +32 | NO | no | +0.76 | +0.74 |
| 2025-11-19 | TGT | Labor | 67% | 0.36 | 0.34 | 0.36 | +31 | YES | yes | +0.64 | +0.62 |
| 2025-11-19 | TGT | Netflix | 3% | 0.66 | 0.65 | 0.35 | +62 | NO | no | +0.65 | +0.63 |
| 2025-11-19 | TGT | Revenue | 50% | 0.37 | 0.34 | 0.37 | +13 | YES | no | -0.37 | -0.39 |
| 2025-11-19 | TGT | Shutdown / Shut Down | 8% | 0.33 | 0.28 | 0.72 | +20 | NO | no | +0.28 | +0.26 |
| 2025-11-20 | NVDA | Automation | 24% | 0.56 | 0.55 | 0.45 | +31 | NO | yes | -0.45 | -0.47 |
| 2025-11-20 | NVDA | Domestic | 18% | 0.45 | 0.42 | 0.58 | +24 | NO | no | +0.42 | +0.40 |
| 2025-11-20 | NVDA | H20 | 8% | 0.93 | 0.91 | 0.09 | +83 | NO | yes | -0.09 | -0.10 |
| 2025-11-20 | NVDA | Humanoid | 9% | 0.69 | 0.63 | 0.37 | +54 | NO | no | +0.63 | +0.61 |
| 2025-11-20 | NVDA | Omniverse | 33% | 0.89 | 0.88 | 0.12 | +55 | NO | yes | -0.12 | -0.13 |
| 2025-11-20 | NVDA | Self Driving | 2% | 0.61 | 0.58 | 0.42 | +56 | NO | yes | -0.42 | -0.44 |
| 2025-11-20 | NVDA | Talent | 9% | 0.51 | 0.47 | 0.53 | +38 | NO | no | +0.47 | +0.45 |
| 2025-11-20 | NVDA | Tariff | 7% | 0.47 | 0.46 | 0.54 | +39 | NO | no | +0.46 | +0.44 |
| 2025-11-20 | NVDA | Trump | 4% | 0.39 | 0.35 | 0.65 | +31 | NO | no | +0.35 | +0.33 |
| 2025-11-20 | NVDA | TSMC | 35% | 0.71 | 0.70 | 0.30 | +35 | NO | yes | -0.30 | -0.32 |
| 2025-11-20 | NVDA | VR / Virtual Reality | 38% | 0.16 | 0.13 | 0.16 | +22 | YES | no | -0.16 | -0.17 |
| 2025-11-20 | WMT | Omnichannel | 41% | 0.68 | 0.64 | 0.36 | +23 | NO | yes | -0.36 | -0.38 |
| 2025-11-20 | WMT | OnePay / One Pay | 4% | 0.76 | 0.69 | 0.31 | +65 | NO | yes | -0.31 | -0.33 |
| 2025-11-20 | WMT | OpenAI | 3% | 0.75 | 0.74 | 0.26 | +71 | NO | yes | -0.26 | -0.28 |
| 2025-11-20 | WMT | Shutdown / Shut Down | 9% | 0.34 | 0.30 | 0.70 | +21 | NO | no | +0.30 | +0.28 |
| 2025-11-20 | WMT | SNAP | 21% | 0.54 | 0.50 | 0.50 | +29 | NO | no | +0.50 | +0.48 |
| 2025-11-20 | WMT | Tariff | 54% | 0.95 | 0.93 | 0.07 | +39 | NO | yes | -0.07 | -0.08 |
| 2025-11-26 | DE | AI / Artificial Intelligence | 8% | 0.48 | 0.43 | 0.57 | +35 | NO | no | +0.43 | +0.41 |
| 2025-11-26 | DE | Automation | 31% | 0.60 | 0.57 | 0.43 | +26 | NO | yes | -0.43 | -0.45 |
| 2025-11-26 | DE | Efficiency | 48% | 0.62 | 0.61 | 0.39 | +13 | NO | no | +0.61 | +0.59 |
| 2025-11-26 | DELL | AI Factory | 20% | 0.91 | 0.88 | 0.12 | +68 | NO | yes | -0.12 | -0.13 |
| 2025-11-26 | DELL | China | 34% | 0.22 | 0.21 | 0.22 | +12 | YES | no | -0.22 | -0.24 |
| 2025-11-26 | DELL | Dividend (3+ times) | 7% | 0.50 | 0.47 | 0.53 | +40 | NO | no | +0.47 | +0.45 |
| 2025-11-26 | DELL | New Product | 34% | 0.65 | 0.64 | 0.36 | +30 | NO | no | +0.64 | +0.62 |
| 2025-11-26 | DELL | Nvidia (5+ times) | 7% | 0.50 | 0.49 | 0.51 | +42 | NO | no | +0.49 | +0.47 |
| 2025-11-26 | DELL | RTX Pro 6000 | 16% | 0.63 | 0.60 | 0.40 | +44 | NO | no | +0.60 | +0.58 |
| 2025-12-02 | MRVL | Microsoft | 20% | 0.56 | 0.55 | 0.45 | +35 | NO | no | +0.55 | +0.53 |
| 2025-12-04 | HPE | Nvidia | 54% | 0.93 | 0.89 | 0.11 | +35 | NO | yes | -0.11 | -0.12 |
| 2025-12-04 | HPE | Quantum | 16% | 0.46 | 0.44 | 0.56 | +28 | NO | yes | -0.56 | -0.58 |
| 2025-12-04 | KR | AI / Artificial Intelligence | 39% | 0.89 | 0.81 | 0.19 | +42 | NO | yes | -0.19 | -0.21 |
| 2025-12-04 | KR | Holiday | 44% | 0.96 | 0.92 | 0.08 | +48 | NO | yes | -0.08 | -0.09 |
| 2025-12-04 | KR | Instacart | 31% | 0.70 | 0.68 | 0.32 | +37 | NO | yes | -0.32 | -0.34 |
| 2025-12-04 | ULTA | Reward | 64% | 0.45 | 0.43 | 0.45 | +19 | YES | no | -0.45 | -0.47 |
| 2025-12-04 | ULTA | Space NK | 12% | 0.68 | 0.66 | 0.34 | +54 | NO | yes | -0.34 | -0.36 |
| 2025-12-04 | ULTA | Tariff | 21% | 0.48 | 0.45 | 0.55 | +24 | NO | yes | -0.55 | -0.57 |
| 2025-12-04 | ULTA | Uncertainty | 54% | 0.88 | 0.80 | 0.20 | +26 | NO | yes | -0.20 | -0.22 |
| 2025-12-04 | ULTA | Wicked | 12% | 0.72 | 0.67 | 0.33 | +55 | NO | no | +0.67 | +0.65 |
| 2025-12-10 | ADBE | Black Friday | 17% | 0.85 | 0.70 | 0.30 | +53 | NO | no | +0.70 | +0.68 |
| 2025-12-10 | ADBE | Firefly Video | 11% | 0.78 | 0.71 | 0.29 | +60 | NO | no | +0.71 | +0.69 |
| 2025-12-10 | ADBE | Google Cloud | 3% | 0.48 | 0.47 | 0.53 | +44 | NO | no | +0.47 | +0.45 |
| 2025-12-10 | ADBE | Humain | 3% | 0.59 | 0.56 | 0.44 | +53 | NO | yes | -0.44 | -0.46 |
| 2025-12-10 | ADBE | LLM Optimizer | 4% | 0.87 | 0.83 | 0.17 | +79 | NO | yes | -0.17 | -0.18 |
| 2025-12-10 | ADBE | Qualcomm | 11% | 0.58 | 0.56 | 0.44 | +45 | NO | no | +0.56 | +0.54 |
| 2025-12-10 | ADBE | YouTube | 16% | 0.69 | 0.56 | 0.44 | +40 | NO | yes | -0.44 | -0.46 |
| 2025-12-10 | CHWY | SmartEquine | 6% | 0.94 | 0.91 | 0.09 | +85 | NO | yes | -0.09 | -0.10 |
| 2025-12-10 | ORCL | Backlog | 29% | 0.75 | 0.72 | 0.28 | +43 | NO | yes | -0.28 | -0.30 |
| 2025-12-10 | ORCL | Health | 54% | 0.75 | 0.68 | 0.32 | +14 | NO | yes | -0.32 | -0.34 |
| 2025-12-10 | ORCL | Stargate | 5% | 0.53 | 0.51 | 0.49 | +46 | NO | no | +0.51 | +0.49 |
| 2025-12-10 | ORCL | Tariff | 5% | 0.30 | 0.27 | 0.73 | +22 | NO | no | +0.27 | +0.25 |
| 2025-12-11 | AVGO | Acquisition | 85% | 0.01 | 0.00 | 0.01 | +84 | YES | no | -0.01 | -0.02 |
| 2025-12-11 | AVGO | Optic | 52% | 0.99 | 0.96 | 0.04 | +44 | NO | yes | -0.04 | -0.05 |
| 2025-12-11 | COST | Black Friday | 21% | 1.00 | 0.99 | 0.01 | +78 | NO | yes | -0.01 | -0.02 |
| 2025-12-11 | COST | Dividend | 71% | 0.06 | 0.02 | 0.06 | +65 | YES | no | -0.06 | -0.07 |
| 2025-12-11 | COST | Expansion | 84% | 1.00 | 0.99 | 0.01 | +15 | NO | yes | -0.01 | -0.02 |
| 2025-12-11 | COST | Holiday | 71% | 1.00 | 0.99 | 0.01 | +28 | NO | yes | -0.01 | -0.02 |
| 2025-12-11 | COST | Inflation | 87% | 1.00 | 0.99 | 0.01 | +12 | NO | yes | -0.01 | -0.02 |
| 2025-12-11 | COST | Inventory | 87% | 1.00 | 0.99 | 0.01 | +12 | NO | yes | -0.01 | -0.02 |
| 2025-12-11 | COST | Kirkland | 70% | 1.00 | 0.99 | 0.01 | +29 | NO | yes | -0.01 | -0.02 |
| 2025-12-11 | COST | Labor | 71% | 1.00 | 0.99 | 0.01 | +28 | NO | yes | -0.01 | -0.02 |
| 2025-12-11 | COST | Revenue | 44% | 1.00 | 0.99 | 0.01 | +55 | NO | yes | -0.01 | -0.02 |
| 2025-12-11 | COST | Spending | 62% | 0.05 | 0.00 | 0.05 | +57 | YES | no | -0.05 | -0.06 |
| 2025-12-11 | COST | Tariff | 21% | 1.00 | 0.99 | 0.01 | +78 | NO | yes | -0.01 | -0.02 |
| 2025-12-18 | FDX | De Minimis | 10% | 0.78 | 0.77 | 0.23 | +67 | NO | yes | -0.23 | -0.25 |
| 2025-12-18 | FDX | Dividend | 60% | 0.80 | 0.79 | 0.21 | +19 | NO | yes | -0.21 | -0.23 |
| 2025-12-18 | FDX | EV / Electric Vehicle | 13% | 0.26 | 0.25 | 0.75 | +12 | NO | no | +0.25 | +0.23 |
| 2025-12-18 | FDX | Inventory | 72% | 0.54 | 0.53 | 0.54 | +18 | YES | no | -0.54 | -0.56 |
| 2025-12-18 | FDX | Labor | 51% | 0.34 | 0.31 | 0.34 | +17 | YES | no | -0.34 | -0.36 |
| 2025-12-18 | FDX | Smith | 79% | 0.25 | 0.24 | 0.25 | +54 | YES | yes | +0.75 | +0.73 |
| 2025-12-18 | FDX | Tariff | 33% | 0.51 | 0.50 | 0.50 | +17 | NO | yes | -0.50 | -0.52 |
| 2025-12-18 | MU | Automation | 35% | 0.20 | 0.15 | 0.20 | +15 | YES | no | -0.20 | -0.22 |
| 2025-12-18 | MU | Gaming | 43% | 0.16 | 0.13 | 0.16 | +27 | YES | no | -0.16 | -0.17 |
| 2025-12-18 | MU | Hyperscaler | 13% | 0.40 | 0.38 | 0.62 | +25 | NO | no | +0.38 | +0.36 |
| 2025-12-18 | MU | New York | 17% | 0.39 | 0.38 | 0.62 | +21 | NO | no | +0.38 | +0.36 |
| 2025-12-18 | MU | Taiwan | 52% | 0.37 | 0.34 | 0.37 | +15 | YES | no | -0.37 | -0.39 |
| 2025-12-18 | MU | Tariff | 22% | 0.63 | 0.61 | 0.39 | +39 | NO | no | +0.61 | +0.59 |
| 2025-12-18 | NKE | Amazon | 17% | 0.53 | 0.52 | 0.48 | +35 | NO | no | +0.52 | +0.50 |
| 2025-12-18 | NKE | Black Friday | 13% | 0.92 | 0.91 | 0.09 | +78 | NO | yes | -0.09 | -0.10 |
| 2025-12-18 | NKE | Consumer Demand | 70% | 0.24 | 0.23 | 0.24 | +46 | YES | no | -0.24 | -0.26 |
| 2025-12-18 | NKE | Direct to Consumer / DTC | 58% | 0.16 | 0.12 | 0.16 | +42 | YES | no | -0.16 | -0.17 |
| 2025-12-18 | NKE | Dividend | 31% | 0.61 | 0.60 | 0.40 | +29 | NO | no | +0.60 | +0.58 |
| 2025-12-18 | NKE | Express Lane | 50% | 0.79 | 0.77 | 0.23 | +27 | NO | no | +0.77 | +0.75 |
| 2025-12-18 | NKE | Nike Factory | 19% | 0.75 | 0.74 | 0.26 | +55 | NO | no | +0.74 | +0.72 |
| 2025-12-18 | NKE | Retailer | 55% | 0.40 | 0.39 | 0.40 | +15 | YES | no | -0.40 | -0.42 |
| 2025-12-18 | NKE | Sabrina | 19% | 0.71 | 0.70 | 0.30 | +51 | NO | yes | -0.30 | -0.32 |
| 2025-12-18 | NKE | Tariff | 14% | 0.93 | 0.92 | 0.08 | +78 | NO | yes | -0.08 | -0.09 |
| 2026-01-07 | ACI | AI / Artificial Intelligence | 40% | 0.97 | 0.95 | 0.05 | +55 | NO | yes | -0.05 | -0.06 |
| 2026-01-07 | ACI | Dividend | 83% | 0.72 | 0.65 | 0.72 | +11 | YES | yes | +0.28 | +0.26 |
| 2026-01-07 | ACI | GLP-1 | 28% | 0.89 | 0.87 | 0.13 | +59 | NO | yes | -0.13 | -0.14 |
| 2026-01-07 | ACI | Personalization | 16% | 0.68 | 0.65 | 0.35 | +49 | NO | yes | -0.35 | -0.37 |
| 2026-01-07 | ACI | Tariff | 22% | 0.45 | 0.44 | 0.56 | +22 | NO | no | +0.44 | +0.42 |
| 2026-01-07 | ACI | Uber | 10% | 0.62 | 0.61 | 0.39 | +51 | NO | yes | -0.39 | -0.41 |
| 2026-01-08 | STZ | Depletion / Depletions | 96% | 0.83 | 0.77 | 0.83 | +13 | YES | yes | +0.17 | +0.16 |
| 2026-01-08 | STZ | Dividend | 83% | 0.47 | 0.43 | 0.47 | +36 | YES | no | -0.47 | -0.49 |
| 2026-01-08 | STZ | Holiday | 77% | 0.32 | 0.22 | 0.32 | +45 | YES | yes | +0.68 | +0.66 |
| 2026-01-08 | STZ | Inventory | 85% | 0.74 | 0.69 | 0.74 | +11 | YES | yes | +0.26 | +0.24 |
| 2026-01-13 | JPM | Geopolitical | 23% | 0.58 | 0.54 | 0.46 | +31 | NO | yes | -0.46 | -0.48 |
| 2026-01-13 | JPM | Tariff | 12% | 0.67 | 0.66 | 0.34 | +54 | NO | no | +0.66 | +0.64 |
| 2026-01-14 | WFC | AI / Artificial Intelligence | 31% | 1.00 | 0.99 | 0.01 | +68 | NO | yes | -0.01 | -0.02 |
| 2026-01-14 | WFC | Buyback | 74% | 0.01 | 0.00 | 0.01 | +73 | YES | no | -0.01 | -0.02 |
| 2026-01-14 | WFC | Delinquency | 22% | 1.00 | 0.99 | 0.01 | +77 | NO | yes | -0.01 | -0.02 |
| 2026-01-14 | WFC | Inflation | 58% | 1.00 | 0.99 | 0.01 | +41 | NO | yes | -0.01 | -0.02 |
| 2026-01-14 | WFC | Middle Market | 84% | 1.00 | 0.99 | 0.01 | +15 | NO | yes | -0.01 | -0.02 |
| 2026-01-14 | WFC | Private Equity | 64% | 1.00 | 0.99 | 0.01 | +35 | NO | yes | -0.01 | -0.02 |
| 2026-01-14 | WFC | Recession | 22% | 0.01 | 0.00 | 0.01 | +21 | YES | no | -0.01 | -0.02 |
| 2026-01-14 | WFC | Tariff | 15% | 0.01 | 0.00 | 0.01 | +14 | YES | no | -0.01 | -0.02 |
| 2026-01-15 | BLK | Crypto / Bitcoin | 38% | 0.78 | 0.76 | 0.24 | +38 | NO | no | +0.76 | +0.74 |
| 2026-01-15 | BLK | Digital Asset | 42% | 0.99 | 0.98 | 0.02 | +56 | NO | yes | -0.02 | -0.03 |
| 2026-01-15 | BLK | ETF Inflow | 14% | 0.27 | 0.25 | 0.75 | +11 | NO | no | +0.25 | +0.23 |
| 2026-01-15 | BLK | Record AUM | 30% | 0.80 | 0.75 | 0.25 | +45 | NO | no | +0.75 | +0.73 |
| 2026-01-15 | GS | Buyback | 65% | 0.51 | 0.49 | 0.51 | +14 | YES | yes | +0.49 | +0.47 |
| 2026-01-15 | GS | Charge Off / Charge-Off | 78% | 0.93 | 0.92 | 0.08 | +14 | NO | yes | -0.08 | -0.09 |
| 2026-01-15 | GS | Inflation | 68% | 0.52 | 0.51 | 0.52 | +16 | YES | yes | +0.48 | +0.46 |
| 2026-01-15 | GS | Marcus | 65% | 0.18 | 0.17 | 0.18 | +47 | YES | yes | +0.82 | +0.80 |
| 2026-01-15 | GS | Recession | 28% | 0.16 | 0.15 | 0.16 | +12 | YES | no | -0.16 | -0.17 |
| 2026-01-15 | GS | Tariff | 12% | 0.30 | 0.27 | 0.73 | +15 | NO | no | +0.27 | +0.25 |
| 2026-01-15 | GS | Trading | 91% | 0.77 | 0.76 | 0.77 | +14 | YES | yes | +0.23 | +0.21 |
| 2026-01-20 | NFLX | Acquisition | 71% | 0.92 | 0.89 | 0.11 | +18 | NO | yes | -0.11 | -0.12 |
| 2026-01-20 | NFLX | Ad-Supported | 24% | 0.37 | 0.36 | 0.64 | +12 | NO | yes | -0.64 | -0.66 |
| 2026-01-20 | NFLX | Gaming | 33% | 0.70 | 0.69 | 0.31 | +36 | NO | yes | -0.31 | -0.33 |
| 2026-01-20 | NFLX | Hollywood | 34% | 0.69 | 0.65 | 0.35 | +31 | NO | no | +0.65 | +0.63 |
| 2026-01-20 | NFLX | Jake Paul | 8% | 0.57 | 0.55 | 0.45 | +47 | NO | yes | -0.45 | -0.47 |
| 2026-01-20 | NFLX | Live Event | 21% | 0.95 | 0.93 | 0.07 | +72 | NO | yes | -0.07 | -0.08 |
| 2026-01-20 | NFLX | Paramount | 14% | 0.73 | 0.68 | 0.32 | +54 | NO | yes | -0.32 | -0.34 |
| 2026-01-20 | NFLX | Partnership | 57% | 0.79 | 0.75 | 0.25 | +18 | NO | yes | -0.25 | -0.27 |
| 2026-01-20 | NFLX | Profitable | 50% | 0.77 | 0.75 | 0.25 | +25 | NO | no | +0.75 | +0.73 |
| 2026-01-20 | NFLX | Stranger Things | 39% | 0.96 | 0.93 | 0.07 | +54 | NO | yes | -0.07 | -0.08 |
| 2026-01-20 | NFLX | Subscriber | 88% | 0.62 | 0.59 | 0.62 | +26 | YES | no | -0.62 | -0.64 |
| 2026-01-20 | NFLX | Warner Bros | 10% | 0.69 | 0.68 | 0.32 | +58 | NO | no | +0.68 | +0.66 |
| 2026-01-21 | JNJ | Trufill | 3% | 0.51 | 0.49 | 0.51 | +46 | NO | no | +0.49 | +0.47 |
| 2026-01-21 | UAL | ATC / Air Traffic Control | 44% | 0.67 | 0.63 | 0.37 | +19 | NO | yes | -0.37 | -0.39 |
| 2026-01-21 | UAL | JetBlue | 21% | 0.53 | 0.52 | 0.48 | +31 | NO | no | +0.52 | +0.50 |
| 2026-01-21 | UAL | Nonstop / Non-Stop | 44% | 0.29 | 0.25 | 0.29 | +15 | YES | no | -0.29 | -0.31 |
| 2026-01-21 | UAL | Shutdown / Shut Down | 28% | 0.79 | 0.78 | 0.22 | +50 | NO | yes | -0.22 | -0.24 |
| 2026-01-22 | INTC | Arizona | 27% | 0.83 | 0.78 | 0.22 | +51 | NO | yes | -0.22 | -0.24 |
| 2026-01-22 | INTC | Nvidia | 13% | 0.92 | 0.91 | 0.09 | +78 | NO | yes | -0.09 | -0.10 |
| 2026-01-22 | INTC | Panther Lake | 16% | 0.89 | 0.88 | 0.12 | +72 | NO | yes | -0.12 | -0.13 |
| 2026-01-22 | INTC | Security | 54% | 0.78 | 0.75 | 0.25 | +21 | NO | yes | -0.25 | -0.27 |
| 2026-01-22 | INTC | Tariff | 12% | 0.56 | 0.50 | 0.50 | +38 | NO | yes | -0.50 | -0.52 |
| 2026-01-22 | INTC | Trump | 5% | 0.64 | 0.59 | 0.41 | +54 | NO | no | +0.59 | +0.57 |
| 2026-01-22 | INTC | Ultra 3 / Ultra Series 3 | 2% | 0.85 | 0.84 | 0.16 | +82 | NO | yes | -0.16 | -0.17 |
| 2026-01-22 | INTC | Xeon | 77% | 0.93 | 0.90 | 0.10 | +13 | NO | yes | -0.10 | -0.11 |
| 2026-01-22 | PG | Advertising | 74% | 0.62 | 0.60 | 0.62 | +12 | YES | yes | +0.38 | +0.36 |
| 2026-01-22 | PG | Beauty | 82% | 0.59 | 0.55 | 0.59 | +23 | YES | yes | +0.41 | +0.39 |
| 2026-01-22 | PG | Revenue | 47% | 0.25 | 0.24 | 0.25 | +22 | YES | no | -0.25 | -0.27 |
| 2026-01-22 | PG | Tariff | 22% | 0.98 | 0.97 | 0.03 | +75 | NO | yes | -0.03 | -0.04 |
| 2026-01-27 | AAL | ATC | 21% | 0.48 | 0.45 | 0.55 | +24 | NO | no | +0.45 | +0.43 |
| 2026-01-27 | AAL | Centennial | 6% | 0.70 | 0.65 | 0.35 | +59 | NO | yes | -0.35 | -0.37 |
| 2026-01-27 | AAL | Chicago / O’Hare | 67% | 0.97 | 0.95 | 0.05 | +28 | NO | yes | -0.05 | -0.06 |
| 2026-01-27 | AAL | Shutdown / Shut Down | 21% | 0.91 | 0.90 | 0.10 | +69 | NO | yes | -0.10 | -0.11 |
| 2026-01-27 | AAL | Weather | 44% | 0.68 | 0.67 | 0.33 | +23 | NO | yes | -0.33 | -0.35 |
| 2026-01-28 | META | Algorithm | 24% | 0.40 | 0.35 | 0.65 | +11 | NO | yes | -0.65 | -0.67 |
| 2026-01-28 | META | Hyperion | 4% | 0.37 | 0.33 | 0.67 | +29 | NO | no | +0.33 | +0.31 |
| 2026-01-28 | META | Llama | 22% | 0.82 | 0.76 | 0.24 | +54 | NO | no | +0.76 | +0.74 |
| 2026-01-28 | META | Oakley | 8% | 0.94 | 0.89 | 0.11 | +81 | NO | no | +0.89 | +0.88 |
| 2026-01-28 | META | SAM | 4% | 0.56 | 0.52 | 0.48 | +48 | NO | no | +0.52 | +0.50 |
| 2026-01-28 | META | Thread / Threads | 46% | 0.98 | 0.97 | 0.03 | +51 | NO | yes | -0.03 | -0.04 |
| 2026-01-28 | MSFT | LinkedIn | 62% | 0.98 | 0.97 | 0.03 | +35 | NO | yes | -0.03 | -0.04 |
| 2026-01-28 | MSFT | Teams | 71% | 0.97 | 0.96 | 0.04 | +25 | NO | yes | -0.04 | -0.05 |
| 2026-01-28 | SBUX | Loyalty | 80% | 0.57 | 0.56 | 0.57 | +23 | YES | no | -0.57 | -0.59 |
| 2026-01-28 | SBUX | Promotion | 58% | 0.83 | 0.79 | 0.21 | +21 | NO | no | +0.79 | +0.77 |
| 2026-01-28 | TSLA | Competition | 21% | 0.66 | 0.62 | 0.38 | +41 | NO | yes | -0.38 | -0.40 |
| 2026-01-28 | TSLA | Cybertruck | 37% | 0.67 | 0.65 | 0.35 | +28 | NO | yes | -0.35 | -0.37 |
| 2026-01-28 | TSLA | Delivery | 76% | 0.89 | 0.87 | 0.13 | +11 | NO | yes | -0.13 | -0.14 |
| 2026-01-28 | TSLA | FSD / Full Self Driving | 43% | 1.00 | 0.99 | 0.01 | +56 | NO | yes | -0.01 | -0.02 |
| 2026-01-28 | TSLA | Grok 5 | 4% | 0.28 | 0.25 | 0.75 | +21 | NO | no | +0.25 | +0.23 |
| 2026-01-28 | TSLA | Regulator / Regulatory / Regulation | 76% | 0.94 | 0.92 | 0.08 | +16 | NO | yes | -0.08 | -0.09 |
| 2026-01-28 | TSLA | Tariff | 21% | 0.84 | 0.75 | 0.25 | +54 | NO | yes | -0.25 | -0.27 |
| 2026-01-28 | TSLA | Robotaxi | 33% | 1.00 | 0.99 | 0.01 | +66 | NO | yes | -0.01 | -0.02 |
| 2026-01-29 | AAPL | Apple Pay | 60% | 0.80 | 0.75 | 0.25 | +15 | NO | yes | -0.25 | -0.27 |
| 2026-01-29 | AAPL | Creator Studio | 2% | 0.50 | 0.43 | 0.57 | +41 | NO | yes | -0.57 | -0.59 |
| 2026-01-29 | AAPL | Formula 1 / F1 | 9% | 0.72 | 0.71 | 0.29 | +62 | NO | yes | -0.29 | -0.31 |
| 2026-01-29 | AAPL | Fold / Folding / Foldable | 5% | 0.34 | 0.27 | 0.73 | +22 | NO | no | +0.27 | +0.25 |
| 2026-01-29 | AAPL | Gemini | 2% | 0.78 | 0.77 | 0.23 | +75 | NO | no | +0.77 | +0.75 |
| 2026-01-29 | AAPL | Liquid Glass | 5% | 0.39 | 0.32 | 0.68 | +27 | NO | no | +0.32 | +0.30 |
| 2026-01-29 | AAPL | Manufacturing | 59% | 0.89 | 0.87 | 0.13 | +28 | NO | yes | -0.13 | -0.14 |
| 2026-01-29 | AAPL | Severance | 17% | 0.62 | 0.55 | 0.45 | +38 | NO | no | +0.55 | +0.53 |
| 2026-01-29 | AAPL | Siri | 52% | 0.93 | 0.86 | 0.14 | +34 | NO | yes | -0.14 | -0.15 |
| 2026-01-29 | AAPL | Streaming | 31% | 0.57 | 0.50 | 0.50 | +19 | NO | no | +0.50 | +0.48 |
| 2026-01-29 | AAPL | Wearable | 60% | 0.96 | 0.95 | 0.05 | +35 | NO | yes | -0.05 | -0.06 |
| 2026-01-29 | AAPL | Widget | 6% | 0.26 | 0.20 | 0.80 | +14 | NO | no | +0.20 | +0.18 |
| 2026-01-29 | V | Blockchain | 19% | 0.86 | 0.79 | 0.21 | +60 | NO | yes | -0.21 | -0.23 |
| 2026-01-29 | V | Holiday | 35% | 0.84 | 0.77 | 0.23 | +42 | NO | yes | -0.23 | -0.25 |
| 2026-01-29 | V | Loyalty | 33% | 0.57 | 0.50 | 0.50 | +17 | NO | no | +0.50 | +0.48 |
| 2026-01-29 | V | Mercuryo | 2% | 0.78 | 0.72 | 0.28 | +70 | NO | no | +0.72 | +0.70 |
| 2026-01-29 | V | Rate Cap / 10% Cap | 2% | 0.27 | 0.21 | 0.79 | +19 | NO | no | +0.21 | +0.19 |
| 2026-01-29 | V | Regulation / Regulatory | 69% | 0.86 | 0.79 | 0.21 | +10 | NO | no | +0.79 | +0.77 |
| 2026-01-29 | V | Trump | 4% | 0.40 | 0.33 | 0.67 | +29 | NO | no | +0.33 | +0.31 |
| 2026-01-30 | AXP | Millennial | 46% | 0.89 | 0.83 | 0.17 | +37 | NO | yes | -0.17 | -0.18 |
| 2026-01-30 | AXP | Rate Cap / 10% Cap | 3% | 0.21 | 0.20 | 0.80 | +17 | NO | no | +0.20 | +0.18 |
| 2026-01-30 | VZ | 5G | 91% | 0.78 | 0.70 | 0.78 | +13 | YES | yes | +0.22 | +0.20 |
| 2026-01-30 | VZ | Outage | 5% | 0.44 | 0.35 | 0.65 | +30 | NO | yes | -0.65 | -0.67 |
| 2026-01-30 | VZ | Spectrum | 94% | 0.82 | 0.73 | 0.82 | +12 | YES | no | -0.82 | -0.84 |
| 2026-01-30 | VZ | Starry | 8% | 0.55 | 0.51 | 0.49 | +43 | NO | yes | -0.49 | -0.51 |
| 2026-01-30 | VZ | Tariff | 8% | 0.26 | 0.20 | 0.80 | +12 | NO | no | +0.20 | +0.18 |
| 2026-02-02 | DIS | Competition | 48% | 0.95 | 0.94 | 0.06 | +46 | NO | yes | -0.06 | -0.07 |
| 2026-02-02 | DIS | DraftKings | 4% | 0.28 | 0.25 | 0.75 | +21 | NO | no | +0.25 | +0.23 |
| 2026-02-02 | PLTR | Commercial Growth | 18% | 0.36 | 0.35 | 0.65 | +17 | NO | no | +0.35 | +0.33 |
| 2026-02-02 | PLTR | Lethal | 31% | 0.89 | 0.82 | 0.18 | +51 | NO | yes | -0.18 | -0.20 |
| 2026-02-02 | PLTR | Nvidia | 6% | 0.64 | 0.56 | 0.44 | +50 | NO | no | +0.56 | +0.54 |
| 2026-02-02 | PLTR | Revenue guidance | 68% | 0.28 | 0.27 | 0.28 | +40 | YES | no | -0.28 | -0.30 |
| 2026-02-02 | PLTR | Warp Speed | 6% | 0.91 | 0.82 | 0.18 | +76 | NO | yes | -0.18 | -0.20 |
| 2026-02-03 | CMG | Honey Chicken | 8% | 0.54 | 0.50 | 0.50 | +42 | NO | no | +0.50 | +0.48 |
| 2026-02-03 | CMG | Promotion | 78% | 0.90 | 0.88 | 0.12 | +10 | NO | yes | -0.12 | -0.13 |
| 2026-02-03 | CMG | Share Purchase | 8% | 0.58 | 0.53 | 0.47 | +45 | NO | yes | -0.47 | -0.49 |
| 2026-02-03 | PEP | Acquisition | 51% | 0.77 | 0.69 | 0.31 | +18 | NO | yes | -0.31 | -0.33 |
| 2026-02-03 | PEP | Artificial Color | 12% | 0.45 | 0.40 | 0.60 | +28 | NO | no | +0.40 | +0.38 |
| 2026-02-03 | PEP | Away from Home | 58% | 0.80 | 0.76 | 0.24 | +18 | NO | yes | -0.24 | -0.26 |
| 2026-02-03 | PEP | Celsius | 35% | 0.61 | 0.56 | 0.44 | +21 | NO | yes | -0.44 | -0.46 |
| 2026-02-03 | PEP | China | 64% | 0.85 | 0.84 | 0.16 | +20 | NO | yes | -0.16 | -0.17 |
| 2026-02-03 | PEP | Food for Tomorrow | 5% | 0.22 | 0.19 | 0.81 | +14 | NO | no | +0.19 | +0.17 |
| 2026-02-03 | PEP | GLP-1 | 18% | 0.42 | 0.34 | 0.66 | +16 | NO | yes | -0.66 | -0.68 |
| 2026-02-03 | PEP | Healthy | 71% | 0.54 | 0.49 | 0.54 | +17 | YES | no | -0.54 | -0.56 |
| 2026-02-03 | PEP | Nvidia | 5% | 0.45 | 0.40 | 0.60 | +35 | NO | no | +0.40 | +0.38 |
| 2026-02-03 | PEP | Prebiotic | 8% | 0.26 | 0.24 | 0.76 | +16 | NO | no | +0.24 | +0.22 |
| 2026-02-03 | PYPL | Biometric | 17% | 0.78 | 0.73 | 0.27 | +56 | NO | yes | -0.27 | -0.29 |
| 2026-02-03 | PYPL | Blue Owl | 5% | 0.62 | 0.60 | 0.40 | +55 | NO | no | +0.60 | +0.58 |
| 2026-02-03 | PYPL | Regulation / Regulator / Regulatory | 53% | 0.24 | 0.22 | 0.24 | +29 | YES | no | -0.24 | -0.26 |
| 2026-02-03 | PYPL | Stablecoin / Stable Coin | 15% | 0.71 | 0.70 | 0.30 | +55 | NO | no | +0.70 | +0.68 |
| 2026-02-04 | GOOGL | Autonomous | 40% | 0.65 | 0.60 | 0.40 | +20 | NO | yes | -0.40 | -0.42 |
| 2026-02-04 | GOOGL | Nano Banana | 4% | 0.68 | 0.64 | 0.36 | +60 | NO | yes | -0.36 | -0.38 |
| 2026-02-04 | GOOGL | Quantum | 12% | 0.60 | 0.57 | 0.43 | +45 | NO | no | +0.57 | +0.55 |
| 2026-02-04 | GOOGL | Search Advertising / Search Ad | 66% | 0.55 | 0.52 | 0.55 | +11 | YES | yes | +0.45 | +0.43 |
| 2026-02-04 | GOOGL | Youtube Shorts | 31% | 0.77 | 0.73 | 0.27 | +42 | NO | no | +0.73 | +0.71 |
| 2026-02-04 | SNAP | Family Center | 11% | 0.37 | 0.36 | 0.64 | +25 | NO | no | +0.36 | +0.34 |
| 2026-02-04 | SNAP | Platinum | 11% | 0.59 | 0.58 | 0.42 | +47 | NO | no | +0.58 | +0.56 |
| 2026-02-04 | UBER | Avride | 12% | 0.46 | 0.41 | 0.59 | +29 | NO | yes | -0.59 | -0.61 |
| 2026-02-04 | UBER | Driver Incentives | 38% | 0.19 | 0.02 | 0.19 | +19 | YES | no | -0.19 | -0.21 |
| 2026-02-04 | UBER | Lucid | 8% | 0.71 | 0.59 | 0.41 | +51 | NO | yes | -0.41 | -0.43 |
| 2026-02-04 | UBER | Market Share | 42% | 0.19 | 0.14 | 0.19 | +23 | YES | no | -0.19 | -0.21 |
| 2026-02-04 | UBER | Regulator / Regulatory / Regulation | 71% | 0.36 | 0.32 | 0.36 | +35 | YES | yes | +0.64 | +0.62 |
| 2026-02-05 | AMZN | China | 42% | 0.61 | 0.57 | 0.43 | +15 | NO | no | +0.57 | +0.55 |
| 2026-02-05 | AMZN | OpenAI | 4% | 0.50 | 0.43 | 0.57 | +39 | NO | yes | -0.57 | -0.59 |
| 2026-02-05 | AMZN | Prime Day | 48% | 0.65 | 0.61 | 0.39 | +13 | NO | no | +0.61 | +0.59 |
| 2026-02-05 | AMZN | Project Kuiper | 13% | 0.58 | 0.52 | 0.48 | +39 | NO | no | +0.52 | +0.50 |
| 2026-02-05 | AMZN | Rufus | 10% | 0.81 | 0.77 | 0.23 | +67 | NO | yes | -0.23 | -0.25 |
| 2026-02-05 | AMZN | Silicon | 17% | 0.90 | 0.87 | 0.13 | +70 | NO | yes | -0.13 | -0.14 |
| 2026-02-05 | AMZN | Sponsored Products | 25% | 0.83 | 0.79 | 0.21 | +54 | NO | yes | -0.21 | -0.23 |
| 2026-02-05 | AMZN | Supply Chain | 27% | 0.57 | 0.53 | 0.47 | +26 | NO | no | +0.53 | +0.51 |
| 2026-02-05 | AMZN | Tariff | 7% | 0.87 | 0.81 | 0.19 | +74 | NO | yes | -0.19 | -0.21 |
| 2026-02-05 | AMZN | Third Party Sellers | 4% | 0.76 | 0.74 | 0.26 | +70 | NO | yes | -0.26 | -0.28 |
| 2026-02-05 | RDDT | Emplifi | 15% | 0.57 | 0.53 | 0.47 | +38 | NO | no | +0.53 | +0.51 |
| 2026-02-09 | ON | EV / Electric Vehicle | 81% | 0.97 | 0.93 | 0.07 | +12 | NO | yes | -0.07 | -0.08 |
| 2026-02-09 | ON | Nvidia | 16% | 0.61 | 0.55 | 0.45 | +39 | NO | no | +0.55 | +0.53 |
| 2026-02-10 | HOOD | Acquisition | 64% | 0.94 | 0.88 | 0.12 | +24 | NO | yes | -0.12 | -0.13 |
| 2026-02-10 | HOOD | Bitcoin | 31% | 0.61 | 0.58 | 0.42 | +27 | NO | yes | -0.42 | -0.44 |
| 2026-02-10 | HOOD | Indonesia | 7% | 0.52 | 0.47 | 0.53 | +40 | NO | no | +0.47 | +0.45 |
| 2026-02-10 | HOOD | International | 73% | 0.97 | 0.91 | 0.09 | +18 | NO | yes | -0.09 | -0.10 |
| 2026-02-10 | HOOD | Prediction Market | 26% | 0.98 | 0.95 | 0.05 | +69 | NO | yes | -0.05 | -0.06 |
| 2026-02-10 | HOOD | SIG / Susquehanna | 7% | 0.59 | 0.51 | 0.49 | +44 | NO | yes | -0.49 | -0.51 |
| 2026-02-10 | HOOD | Social | 35% | 0.80 | 0.78 | 0.22 | +43 | NO | yes | -0.22 | -0.24 |
| 2026-02-10 | KO | Acquisition | 64% | 0.36 | 0.30 | 0.36 | +28 | YES | yes | +0.64 | +0.62 |
| 2026-02-10 | KO | Cane Sugar | 5% | 0.51 | 0.50 | 0.50 | +45 | NO | no | +0.50 | +0.48 |
| 2026-02-10 | KO | Influencer | 16% | 0.32 | 0.28 | 0.72 | +12 | NO | no | +0.28 | +0.26 |
| 2026-02-10 | KO | International | 31% | 0.63 | 0.62 | 0.38 | +31 | NO | no | +0.62 | +0.60 |
| 2026-02-10 | KO | Prebiotic | 8% | 0.25 | 0.21 | 0.79 | +13 | NO | no | +0.21 | +0.19 |
| 2026-02-10 | KO | Retro | 5% | 0.31 | 0.30 | 0.70 | +25 | NO | no | +0.30 | +0.28 |
| 2026-02-10 | KO | Tariff | 10% | 0.33 | 0.31 | 0.69 | +21 | NO | no | +0.31 | +0.29 |
| 2026-02-10 | LYFT | FreeNow / Free Now | 15% | 0.84 | 0.80 | 0.20 | +65 | NO | yes | -0.20 | -0.22 |
| 2026-02-10 | LYFT | Membership | 42% | 0.23 | 0.11 | 0.23 | +19 | YES | no | -0.23 | -0.25 |
| 2026-02-10 | LYFT | Waymo | 35% | 0.94 | 0.90 | 0.10 | +55 | NO | yes | -0.10 | -0.11 |
| 2026-02-10 | SPOT | Apple TV | 10% | 0.38 | 0.34 | 0.66 | +24 | NO | no | +0.34 | +0.32 |
| 2026-02-10 | SPOT | Bookshop / Bookshop.org | 4% | 0.65 | 0.59 | 0.41 | +55 | NO | yes | -0.41 | -0.43 |
| 2026-02-10 | SPOT | ChatGPT | 7% | 0.33 | 0.28 | 0.72 | +21 | NO | no | +0.28 | +0.26 |
| 2026-02-10 | SPOT | Message | 28% | 0.45 | 0.41 | 0.59 | +13 | NO | no | +0.41 | +0.39 |
| 2026-02-10 | SPOT | Meta | 7% | 0.37 | 0.34 | 0.66 | +27 | NO | no | +0.34 | +0.32 |
| 2026-02-10 | SPOT | Monetization | 74% | 0.95 | 0.93 | 0.07 | +18 | NO | yes | -0.07 | -0.08 |
| 2026-02-10 | SPOT | Netflix | 28% | 0.64 | 0.55 | 0.45 | +27 | NO | no | +0.55 | +0.53 |
| 2026-02-10 | SPOT | Wrapped | 31% | 0.94 | 0.85 | 0.15 | +54 | NO | yes | -0.15 | -0.16 |
| 2026-02-11 | HLT | AI / Artificial Intelligence | 15% | 0.89 | 0.88 | 0.12 | +73 | NO | yes | -0.12 | -0.13 |
| 2026-02-11 | HLT | Honor / Honors | 88% | 0.76 | 0.64 | 0.76 | +12 | YES | yes | +0.24 | +0.22 |
| 2026-02-11 | HLT | LivSmart | 18% | 0.32 | 0.31 | 0.69 | +13 | NO | no | +0.31 | +0.29 |
| 2026-02-11 | HLT | Minnesota / Minneapolis | 5% | 0.75 | 0.27 | 0.73 | +22 | NO | no | +0.27 | +0.25 |
| 2026-02-11 | HLT | Spark | 45% | 0.88 | 0.87 | 0.13 | +42 | NO | no | +0.87 | +0.86 |
| 2026-02-11 | HLT | Tariff | 18% | 0.63 | 0.61 | 0.39 | +43 | NO | no | +0.61 | +0.59 |
| 2026-02-11 | MCD | Buffalo | 2% | 0.32 | 0.17 | 0.83 | +15 | NO | no | +0.17 | +0.16 |
| 2026-02-11 | MCD | Caviar | 2% | 0.36 | 0.29 | 0.71 | +27 | NO | no | +0.29 | +0.27 |
| 2026-02-11 | MCD | Dividend | 65% | 0.94 | 0.89 | 0.11 | +24 | NO | yes | -0.11 | -0.12 |
| 2026-02-11 | MCD | DoorDash | 10% | 0.22 | 0.21 | 0.79 | +11 | NO | no | +0.21 | +0.19 |
| 2026-02-11 | MCD | Grinch | 5% | 0.64 | 0.62 | 0.38 | +57 | NO | yes | -0.38 | -0.40 |
| 2026-02-11 | MCD | Happy Meal | 28% | 0.67 | 0.61 | 0.39 | +33 | NO | no | +0.61 | +0.59 |
| 2026-02-11 | MCD | Loyalty | 56% | 0.86 | 0.85 | 0.15 | +29 | NO | yes | -0.15 | -0.16 |
| 2026-02-11 | MCD | Monopoly | 27% | 0.88 | 0.71 | 0.29 | +44 | NO | yes | -0.29 | -0.31 |
| 2026-02-11 | MCD | Revenue | 47% | 0.25 | 0.22 | 0.25 | +22 | YES | yes | +0.75 | +0.73 |
| 2026-02-11 | MCD | Tariff | 8% | 0.76 | 0.66 | 0.34 | +58 | NO | no | +0.66 | +0.64 |
| 2026-02-11 | SHOP | Black Friday | 54% | 0.92 | 0.91 | 0.09 | +37 | NO | no | +0.91 | +0.90 |
| 2026-02-11 | SHOP | Klarna | 12% | 0.86 | 0.31 | 0.69 | +19 | NO | no | +0.31 | +0.29 |
| 2026-02-11 | SHOP | OpenAI | 12% | 0.84 | 0.74 | 0.26 | +62 | NO | yes | -0.26 | -0.28 |
| 2026-02-11 | SHOP | Shop Pay | 57% | 0.95 | 0.87 | 0.13 | +30 | NO | yes | -0.13 | -0.14 |
| 2026-02-11 | SHOP | Tariff | 14% | 0.90 | 0.85 | 0.15 | +71 | NO | yes | -0.15 | -0.16 |
| 2026-02-12 | ABNB | Acquisition | 45% | 0.35 | 0.32 | 0.35 | +10 | YES | no | -0.35 | -0.37 |
| 2026-02-12 | ABNB | Boutique | 28% | 0.78 | 0.65 | 0.35 | +37 | NO | yes | -0.35 | -0.37 |
| 2026-02-12 | ABNB | China | 54% | 0.39 | 0.32 | 0.39 | +15 | YES | no | -0.39 | -0.41 |
| 2026-02-12 | ABNB | Service Agent | 37% | 0.82 | 0.80 | 0.20 | +43 | NO | yes | -0.20 | -0.22 |
| 2026-02-12 | ABNB | Social Media | 49% | 0.83 | 0.77 | 0.23 | +28 | NO | no | +0.77 | +0.75 |
| 2026-02-12 | NBIS | Aether | 21% | 0.68 | 0.67 | 0.33 | +46 | NO | yes | -0.33 | -0.35 |
| 2026-02-12 | NBIS | ClickHouse / Click House | 53% | 0.71 | 0.67 | 0.33 | +14 | NO | yes | -0.33 | -0.35 |
| 2026-02-12 | NBIS | Hyperscaler | 45% | 0.60 | 0.55 | 0.45 | +10 | NO | yes | -0.45 | -0.47 |
| 2026-02-12 | NBIS | Meta | 29% | 0.88 | 0.80 | 0.20 | +51 | NO | yes | -0.20 | -0.22 |
| 2026-02-12 | NBIS | Nvidia | 53% | 0.93 | 0.86 | 0.14 | +33 | NO | no | +0.86 | +0.85 |
| 2026-02-12 | NBIS | Robotics | 37% | 0.54 | 0.53 | 0.47 | +16 | NO | no | +0.53 | +0.51 |
| 2026-02-12 | NBIS | Token | 29% | 0.74 | 0.72 | 0.28 | +43 | NO | yes | -0.28 | -0.30 |
| 2026-02-12 | ROKU | Acquisition | 71% | 0.43 | 0.42 | 0.43 | +28 | YES | yes | +0.57 | +0.55 |
| 2026-02-12 | ROKU | Brazil | 48% | 0.22 | 0.20 | 0.22 | +26 | YES | yes | +0.78 | +0.76 |
| 2026-02-12 | ROKU | Hour | 90% | 0.70 | 0.61 | 0.70 | +20 | YES | no | -0.70 | -0.72 |
| 2026-02-12 | ROKU | Howdy | 7% | 0.78 | 0.76 | 0.24 | +69 | NO | yes | -0.24 | -0.26 |
| 2026-02-12 | ROKU | Olympic / Olympics | 18% | 0.72 | 0.70 | 0.30 | +52 | NO | yes | -0.30 | -0.32 |
| 2026-02-12 | ROKU | Roku City | 26% | 0.66 | 0.60 | 0.40 | +34 | NO | yes | -0.40 | -0.42 |
| 2026-02-13 | COINBASE | Decentralized Exchange / DEX | 62% | 0.85 | 0.81 | 0.19 | +19 | NO | yes | -0.19 | -0.21 |
| 2026-02-13 | COINBASE | Margin | 58% | 0.94 | 0.90 | 0.10 | +32 | NO | yes | -0.10 | -0.11 |
| 2026-02-13 | COINBASE | Stablecoin | 71% | 0.98 | 0.97 | 0.03 | +26 | NO | yes | -0.03 | -0.04 |
| 2026-02-13 | COINBASE | Web3 | 54% | 0.38 | 0.34 | 0.38 | +16 | YES | no | -0.38 | -0.40 |
| 2026-02-13 | DKNG | Canada | 40% | 0.30 | 0.27 | 0.30 | +10 | YES | no | -0.30 | -0.32 |
| 2026-02-13 | DKNG | Super Bowl | 59% | 0.95 | 0.91 | 0.09 | +32 | NO | yes | -0.09 | -0.10 |
| 2026-02-13 | WEN | Tariff | 13% | 0.42 | 0.25 | 0.75 | +12 | NO | no | +0.25 | +0.23 |
| 2026-02-14 | CAVA | Salmon | 27% | 0.78 | 0.76 | 0.24 | +49 | NO | yes | -0.24 | -0.26 |
| 2026-02-14 | CAVA | Sweet Potato | 19% | 0.78 | 0.76 | 0.24 | +57 | NO | yes | -0.24 | -0.26 |
| 2026-02-18 | CVNA | AI / Artificial Intelligence | 20% | 0.88 | 0.87 | 0.13 | +67 | NO | yes | -0.13 | -0.14 |
| 2026-02-18 | CVNA | Automation | 12% | 0.44 | 0.41 | 0.59 | +29 | NO | no | +0.41 | +0.39 |
| 2026-02-18 | CVNA | Tariff | 15% | 0.59 | 0.56 | 0.44 | +41 | NO | no | +0.56 | +0.54 |
| 2026-02-18 | DASH | Autonomous | 29% | 0.96 | 0.93 | 0.07 | +64 | NO | yes | -0.07 | -0.08 |
| 2026-02-18 | DASH | Robot / Robotic / Robotics | 20% | 0.35 | 0.33 | 0.67 | +13 | NO | no | +0.33 | +0.31 |
| 2026-02-18 | DASH | Waymo | 7% | 0.31 | 0.30 | 0.70 | +23 | NO | no | +0.30 | +0.28 |
| 2026-02-18 | WING | Lemon Pepper | 7% | 0.23 | 0.18 | 0.82 | +11 | NO | no | +0.18 | +0.16 |
| 2026-02-18 | WING | Tender | 42% | 0.72 | 0.71 | 0.29 | +29 | NO | yes | -0.29 | -0.31 |
| 2026-02-19 | CAR | AI / Artificial Intelligence | 11% | 0.41 | 0.30 | 0.70 | +19 | NO | no | +0.30 | +0.28 |
| 2026-02-19 | DE | Tariff | 26% | 0.96 | 0.92 | 0.08 | +66 | NO | yes | -0.08 | -0.09 |
| 2026-02-19 | DE | Tenna | 2% | 0.75 | 0.72 | 0.28 | +70 | NO | yes | -0.28 | -0.30 |
| 2026-02-19 | SFM | Inflation | 75% | 0.56 | 0.44 | 0.56 | +19 | YES | yes | +0.44 | +0.42 |
| 2026-02-19 | SFM | Personalization | 51% | 0.94 | 0.90 | 0.10 | +39 | NO | yes | -0.10 | -0.11 |
| 2026-02-19 | SFM | Revenue | 25% | 0.62 | 0.61 | 0.39 | +36 | NO | no | +0.61 | +0.59 |
| 2026-02-19 | WMT | Omnichannel | 42% | 0.85 | 0.83 | 0.17 | +41 | NO | yes | -0.17 | -0.18 |
| 2026-02-19 | WMT | OpenAi | 4% | 0.57 | 0.55 | 0.45 | +51 | NO | yes | -0.45 | -0.47 |
| 2026-02-19 | WMT | Tariff | 55% | 0.94 | 0.93 | 0.07 | +38 | NO | yes | -0.07 | -0.08 |
| 2026-02-23 | DPZ | AI / Artificial Intelligence | 13% | 0.42 | 0.41 | 0.59 | +28 | NO | no | +0.41 | +0.39 |
| 2026-02-23 | DPZ | Automation | 7% | 0.19 | 0.18 | 0.82 | +11 | NO | no | +0.18 | +0.16 |
| 2026-02-23 | DPZ | DoorDash (5+ times) | 2% | 0.71 | 0.66 | 0.34 | +64 | NO | yes | -0.34 | -0.36 |
| 2026-02-23 | DPZ | Parmesan | 20% | 0.78 | 0.77 | 0.23 | +57 | NO | yes | -0.23 | -0.25 |
| 2026-02-23 | DPZ | Same Store | 12% | 0.97 | 0.96 | 0.04 | +84 | NO | yes | -0.04 | -0.05 |
| 2026-02-23 | HIMS | Cancer | 19% | 0.89 | 0.88 | 0.12 | +69 | NO | yes | -0.12 | -0.13 |
| 2026-02-23 | HIMS | Microdose / Microdosing | 11% | 0.30 | 0.29 | 0.71 | +18 | NO | no | +0.29 | +0.27 |
| 2026-02-23 | HIMS | Regulation | 20% | 0.62 | 0.53 | 0.47 | +33 | NO | no | +0.53 | +0.51 |
| 2026-02-23 | HIMS | Tariff | 15% | 0.41 | 0.40 | 0.60 | +25 | NO | no | +0.40 | +0.38 |
| 2026-02-23 | HIMS | Zava | 15% | 0.78 | 0.77 | 0.23 | +62 | NO | yes | -0.23 | -0.25 |
| 2026-02-25 | NVDA | Arizona | 5% | 0.40 | 0.34 | 0.66 | +29 | NO | no | +0.34 | +0.32 |
| 2026-02-25 | NVDA | Automation | 24% | 0.78 | 0.73 | 0.27 | +49 | NO | no | +0.73 | +0.71 |
| 2026-02-25 | NVDA | Domestic | 18% | 0.35 | 0.30 | 0.70 | +12 | NO | no | +0.30 | +0.28 |
| 2026-02-25 | NVDA | Taiwan | 18% | 0.48 | 0.43 | 0.57 | +25 | NO | no | +0.43 | +0.41 |
| 2026-02-25 | NVDA | Talent | 9% | 0.35 | 0.30 | 0.70 | +21 | NO | yes | -0.70 | -0.72 |
| 2026-02-25 | NVDA | Tariff | 7% | 0.67 | 0.61 | 0.39 | +54 | NO | no | +0.61 | +0.59 |
| 2026-02-25 | NVDA | VR / Virtual Reality | 38% | 0.14 | 0.09 | 0.14 | +24 | YES | no | -0.14 | -0.15 |
| 2026-02-25 | SNOW | Partnership | 85% | 0.98 | 0.97 | 0.03 | +12 | NO | yes | -0.03 | -0.04 |
| 2026-02-26 | CELH | Amazon | 74% | 0.62 | 0.60 | 0.62 | +12 | YES | no | -0.62 | -0.64 |
| 2026-02-26 | CELH | Electrolyte | 7% | 0.25 | 0.20 | 0.80 | +13 | NO | no | +0.20 | +0.18 |
| 2026-02-26 | CELH | PepsiCo | 52% | 0.88 | 0.83 | 0.17 | +31 | NO | yes | -0.17 | -0.18 |
| 2026-02-26 | DELL | China | 34% | 0.19 | 0.16 | 0.19 | +15 | YES | no | -0.19 | -0.21 |
| 2026-02-26 | DELL | Dividend (3+ times) | 7% | 0.54 | 0.49 | 0.51 | +42 | NO | yes | -0.51 | -0.53 |
| 2026-02-26 | DELL | McLaren | 7% | 0.23 | 0.22 | 0.78 | +15 | NO | no | +0.22 | +0.20 |
| 2026-02-26 | DELL | New Product | 34% | 0.63 | 0.62 | 0.38 | +28 | NO | no | +0.62 | +0.60 |
| 2026-02-26 | DELL | Nvidia | 47% | 0.80 | 0.73 | 0.27 | +26 | NO | no | +0.73 | +0.71 |
| 2026-02-26 | DELL | Windows 10 | 43% | 0.29 | 0.27 | 0.29 | +14 | YES | no | -0.29 | -0.31 |
| 2026-02-26 | RKLB | Momentum | 40% | 0.57 | 0.52 | 0.48 | +12 | NO | yes | -0.48 | -0.50 |
| 2026-02-26 | RKLB | Shutdown / Shut Down | 21% | 0.46 | 0.39 | 0.61 | +18 | NO | yes | -0.61 | -0.63 |
| 2026-03-02 | ASTS | Golden Dome | 12% | 0.43 | 0.35 | 0.65 | +23 | NO | yes | -0.65 | -0.67 |
| 2026-03-02 | ASTS | New Glenn | 31% | 0.84 | 0.77 | 0.23 | +46 | NO | yes | -0.23 | -0.25 |
| 2026-03-02 | PSKY | Antitrust / FTC / DOJ | 11% | 0.77 | 0.69 | 0.31 | +58 | NO | yes | -0.31 | -0.33 |
| 2026-03-02 | PSKY | CNN | 7% | 0.59 | 0.42 | 0.58 | +35 | NO | yes | -0.58 | -0.60 |
| 2026-03-02 | PSKY | HBO | 19% | 0.86 | 0.85 | 0.15 | +66 | NO | yes | -0.15 | -0.16 |
| 2026-03-02 | PSKY | Investment Grade | 15% | 0.95 | 0.90 | 0.10 | +75 | NO | yes | -0.10 | -0.11 |
| 2026-03-02 | PSKY | RedBird | 15% | 0.86 | 0.83 | 0.17 | +68 | NO | yes | -0.17 | -0.18 |
| 2026-03-02 | PSKY | Synergy | 11% | 0.95 | 0.93 | 0.07 | +82 | NO | yes | -0.07 | -0.08 |
| 2026-03-02 | PSKY | Trump / Administration | 7% | 0.30 | 0.24 | 0.76 | +17 | NO | no | +0.24 | +0.22 |
| 2026-03-03 | CRWD | China | 15% | 0.50 | 0.43 | 0.57 | +28 | NO | no | +0.43 | +0.41 |
| 2026-03-03 | CRWD | Gen AI / Generative AI | 35% | 0.65 | 0.61 | 0.39 | +26 | NO | no | +0.61 | +0.59 |
| 2026-03-03 | CRWD | Outage | 28% | 0.18 | 0.16 | 0.18 | +10 | YES | no | -0.18 | -0.20 |
| 2026-03-03 | CRWD | SGNL / Signal | 22% | 0.88 | 0.84 | 0.16 | +62 | NO | yes | -0.16 | -0.17 |
| 2026-03-03 | TGT | Competition | 31% | 0.20 | 0.18 | 0.20 | +11 | YES | yes | +0.80 | +0.78 |
| 2026-03-03 | TGT | Inflation | 43% | 0.60 | 0.59 | 0.41 | +16 | NO | no | +0.59 | +0.57 |
| 2026-03-03 | TGT | Labor | 67% | 0.57 | 0.54 | 0.57 | +10 | YES | yes | +0.43 | +0.41 |
| 2026-03-03 | TGT | Synthetic Color | 6% | 0.23 | 0.20 | 0.80 | +14 | NO | yes | -0.80 | -0.82 |
| 2026-03-04 | AVGO | Hyperscaler | 40% | 0.92 | 0.90 | 0.10 | +50 | NO | yes | -0.10 | -0.11 |
| 2026-03-04 | AVGO | OpenAI | 5% | 0.61 | 0.57 | 0.43 | +52 | NO | yes | -0.43 | -0.45 |
| 2026-03-04 | AVGO | Organic | 31% | 0.47 | 0.46 | 0.54 | +15 | NO | no | +0.46 | +0.44 |
| 2026-03-04 | AVGO | Tomahawk 6 | 16% | 0.94 | 0.87 | 0.13 | +71 | NO | yes | -0.13 | -0.14 |
| 2026-03-05 | COST | Automation | 8% | 0.22 | 0.20 | 0.80 | +12 | NO | no | +0.20 | +0.18 |
| 2026-03-05 | COST | Dividend | 70% | 0.60 | 0.59 | 0.60 | +10 | YES | yes | +0.40 | +0.38 |
| 2026-03-05 | COST | Hot Dog | 25% | 0.46 | 0.41 | 0.59 | +16 | NO | no | +0.41 | +0.39 |
| 2026-03-05 | COST | Kirkland | 70% | 0.97 | 0.95 | 0.05 | +25 | NO | yes | -0.05 | -0.06 |
| 2026-03-05 | COST | Revenue | 44% | 0.90 | 0.88 | 0.12 | +44 | NO | yes | -0.12 | -0.13 |
| 2026-03-05 | COST | Spending | 61% | 0.82 | 0.77 | 0.23 | +16 | NO | yes | -0.23 | -0.25 |
| 2026-03-05 | KR | AI / Artificial Intelligence | 42% | 0.96 | 0.91 | 0.09 | +49 | NO | yes | -0.09 | -0.10 |
| 2026-03-05 | KR | Albertsons | 46% | 0.33 | 0.30 | 0.33 | +13 | YES | no | -0.33 | -0.35 |
| 2026-03-05 | KR | Economy | 42% | 0.67 | 0.60 | 0.40 | +18 | NO | no | +0.60 | +0.58 |
| 2026-03-05 | KR | GLP-1 | 42% | 0.79 | 0.75 | 0.25 | +33 | NO | yes | -0.25 | -0.27 |
| 2026-03-05 | KR | SNAP / Food Stamp | 46% | 0.85 | 0.77 | 0.23 | +31 | NO | no | +0.77 | +0.75 |
| 2026-03-05 | MRVL | AWS / Amazon | 20% | 0.65 | 0.60 | 0.40 | +40 | NO | no | +0.60 | +0.58 |
| 2026-03-05 | MRVL | Tariff | 18% | 0.51 | 0.46 | 0.54 | +28 | NO | no | +0.46 | +0.44 |
| 2026-03-05 | VSCO | Tariff | 29% | 0.93 | 0.92 | 0.08 | +63 | NO | yes | -0.08 | -0.09 |
| 2026-03-05 | VSCO | Valentine | 27% | 0.89 | 0.81 | 0.19 | +54 | NO | yes | -0.19 | -0.21 |
| 2026-03-09 | HPE | Government | 34% | 0.56 | 0.53 | 0.47 | +19 | NO | yes | -0.47 | -0.49 |
| 2026-03-09 | HPE | Morpheus | 29% | 0.87 | 0.85 | 0.15 | +56 | NO | no | +0.85 | +0.84 |
| 2026-03-09 | HPE | Nvidia | 56% | 0.93 | 0.91 | 0.09 | +35 | NO | no | +0.91 | +0.90 |
| 2026-03-09 | HPE | Quantum | 20% | 0.48 | 0.45 | 0.55 | +25 | NO | no | +0.45 | +0.43 |
| 2026-03-09 | HPE | Self Driving | 7% | 0.37 | 0.36 | 0.64 | +29 | NO | yes | -0.64 | -0.66 |
| 2026-03-09 | HPE | Synergy | 20% | 0.86 | 0.82 | 0.18 | +62 | NO | yes | -0.18 | -0.20 |
| 2026-03-09 | HPE | Tariff | 20% | 0.56 | 0.53 | 0.47 | +33 | NO | yes | -0.47 | -0.49 |
| 2026-03-09 | MTN | Canada / Canadian | 91% | 0.74 | 0.73 | 0.74 | +17 | YES | no | -0.74 | -0.76 |
| 2026-03-09 | MTN | Gen Z | 5% | 0.74 | 0.70 | 0.30 | +65 | NO | yes | -0.30 | -0.32 |
| 2026-03-09 | MTN | Snowpack | 13% | 0.66 | 0.63 | 0.37 | +50 | NO | yes | -0.37 | -0.39 |
| 2026-03-10 | ORCL | Air Force | 2% | 0.18 | 0.14 | 0.86 | +12 | NO | no | +0.14 | +0.13 |
| 2026-03-10 | ORCL | Backlog | 30% | 0.84 | 0.82 | 0.18 | +52 | NO | yes | -0.18 | -0.20 |
| 2026-03-10 | ORCL | Health | 54% | 0.75 | 0.74 | 0.26 | +20 | NO | yes | -0.26 | -0.28 |
| 2026-03-10 | ORCL | Hyperscaler | 24% | 0.80 | 0.76 | 0.24 | +52 | NO | no | +0.76 | +0.74 |
| 2026-03-10 | ORCL | Multicloud | 4% | 0.95 | 0.94 | 0.06 | +90 | NO | yes | -0.06 | -0.07 |
| 2026-03-10 | ORCL | Partner | 44% | 0.93 | 0.89 | 0.11 | +45 | NO | yes | -0.11 | -0.12 |
| 2026-03-10 | ORCL | Red Bull | 2% | 0.19 | 0.14 | 0.86 | +12 | NO | no | +0.14 | +0.13 |
| 2026-03-10 | ORCL | Sovereign | 15% | 0.38 | 0.31 | 0.69 | +16 | NO | yes | -0.69 | -0.71 |
| 2026-03-10 | ORCL | Stargate | 5% | 0.50 | 0.47 | 0.53 | +42 | NO | no | +0.47 | +0.45 |
| 2026-03-10 | ORCL | Tariff | 5% | 0.30 | 0.27 | 0.73 | +22 | NO | no | +0.27 | +0.25 |
| 2026-03-12 | ADBE | 3D | 50% | 0.70 | 0.69 | 0.31 | +19 | NO | yes | -0.31 | -0.33 |
| 2026-03-12 | ADBE | Firefly Video | 11% | 0.55 | 0.51 | 0.49 | +40 | NO | no | +0.51 | +0.49 |
| 2026-03-12 | ADBE | Inference | 11% | 0.32 | 0.23 | 0.77 | +12 | NO | no | +0.23 | +0.21 |
| 2026-03-12 | ADBE | Semrush | 4% | 0.91 | 0.89 | 0.11 | +85 | NO | yes | -0.11 | -0.12 |
| 2026-03-12 | ADBE | YouTube | 17% | 0.47 | 0.46 | 0.54 | +29 | NO | no | +0.46 | +0.44 |
| 2026-03-12 | ULTA | Holiday | 83% | 0.95 | 0.94 | 0.06 | +11 | NO | yes | -0.06 | -0.07 |
| 2026-03-12 | ULTA | Middle East | 20% | 0.69 | 0.67 | 0.33 | +47 | NO | yes | -0.33 | -0.35 |
| 2026-03-12 | ULTA | Space NK | 16% | 0.93 | 0.91 | 0.09 | +75 | NO | yes | -0.09 | -0.10 |
| 2026-04-07 | LEVI | AI / Artificial Intelligence | 28% | 0.76 | 0.73 | 0.27 | +45 | NO | yes | -0.27 | -0.29 |
| 2026-04-07 | LEVI | Beyond Yoga | 31% | 0.97 | 0.95 | 0.05 | +64 | NO | yes | -0.05 | -0.06 |
| 2026-04-07 | LEVI | China | 93% | 0.75 | 0.71 | 0.75 | +18 | YES | yes | +0.25 | +0.23 |
| 2026-04-07 | LEVI | Dockers | 85% | 0.70 | 0.67 | 0.70 | +15 | YES | yes | +0.30 | +0.28 |
| 2026-04-07 | LEVI | Nike | 15% | 0.52 | 0.46 | 0.54 | +31 | NO | yes | -0.54 | -0.56 |
| 2026-04-07 | LEVI | Tariff | 20% | 0.97 | 0.96 | 0.04 | +76 | NO | yes | -0.04 | -0.05 |
| 2026-04-07 | LEVI | World Cup | 4% | 0.70 | 0.63 | 0.37 | +59 | NO | yes | -0.37 | -0.39 |
| 2026-04-09 | STZ | Dividend | 81% | 0.57 | 0.54 | 0.57 | +24 | YES | yes | +0.43 | +0.41 |
| 2026-04-09 | STZ | Especial | 90% | 0.54 | 0.44 | 0.54 | +36 | YES | yes | +0.46 | +0.44 |
| 2026-04-13 | GS | IPO | 75% | 0.95 | 0.94 | 0.06 | +19 | NO | yes | -0.06 | -0.07 |
| 2026-04-13 | GS | Marcus | 66% | 0.38 | 0.36 | 0.38 | +28 | YES | yes | +0.62 | +0.60 |
| 2026-04-14 | C | Banamex | 42% | 0.92 | 0.87 | 0.13 | +45 | NO | yes | -0.13 | -0.14 |
| 2026-04-14 | C | Iran | 8% | 0.31 | 0.27 | 0.73 | +19 | NO | no | +0.27 | +0.25 |
| 2026-04-14 | JNJ | Administration | 37% | 0.67 | 0.53 | 0.47 | +16 | NO | no | +0.53 | +0.51 |
| 2026-04-14 | JNJ | AI / Artificial Intelligence | 18% | 0.58 | 0.55 | 0.45 | +37 | NO | no | +0.55 | +0.53 |
| 2026-04-14 | JNJ | Nipocalimab / Lupus | 41% | 0.66 | 0.61 | 0.39 | +20 | NO | no | +0.61 | +0.59 |
| 2026-04-14 | JNJ | Rybrevant | 37% | 0.95 | 0.93 | 0.07 | +56 | NO | yes | -0.07 | -0.08 |
| 2026-04-14 | JNJ | Tariff | 16% | 0.95 | 0.90 | 0.10 | +74 | NO | yes | -0.10 | -0.11 |
| 2026-04-14 | JNJ | Vaccine | 50% | 0.20 | 0.16 | 0.20 | +30 | YES | no | -0.20 | -0.22 |
| 2026-04-14 | JPM | Crypto / Bitcoin | 5% | 0.40 | 0.29 | 0.71 | +24 | NO | no | +0.29 | +0.27 |
| 2026-04-14 | JPM | Geopolitical | 24% | 0.83 | 0.69 | 0.31 | +45 | NO | yes | -0.31 | -0.33 |
| 2026-04-14 | JPM | Hiring | 31% | 0.70 | 0.62 | 0.38 | +31 | NO | no | +0.62 | +0.60 |
| 2026-04-14 | JPM | Inflation | 48% | 0.87 | 0.74 | 0.26 | +26 | NO | no | +0.74 | +0.72 |
| 2026-04-14 | JPM | Regulation | 43% | 0.74 | 0.64 | 0.36 | +21 | NO | yes | -0.36 | -0.38 |
| 2026-04-14 | WFC | Basel 3 | 5% | 0.66 | 0.65 | 0.35 | +60 | NO | yes | -0.35 | -0.37 |
| 2026-04-14 | WFC | Buyback | 75% | 0.47 | 0.46 | 0.47 | +28 | YES | no | -0.47 | -0.49 |
| 2026-04-14 | WFC | Inflation | 59% | 0.80 | 0.77 | 0.23 | +18 | NO | no | +0.77 | +0.75 |
| 2026-04-14 | WFC | Oil | 24% | 0.43 | 0.39 | 0.61 | +15 | NO | yes | -0.61 | -0.63 |
| 2026-04-14 | WFC | Recession | 21% | 0.42 | 0.35 | 0.65 | +14 | NO | no | +0.35 | +0.33 |
| 2026-04-14 | WFC | Severance | 43% | 0.76 | 0.71 | 0.29 | +28 | NO | yes | -0.29 | -0.31 |
| 2026-04-14 | WFC | Tariff | 15% | 0.50 | 0.48 | 0.52 | +33 | NO | no | +0.48 | +0.46 |
| 2026-04-15 | BAC | Delinquency | 51% | 0.92 | 0.82 | 0.18 | +31 | NO | yes | -0.18 | -0.20 |
| 2026-04-15 | BAC | Inflation | 37% | 0.76 | 0.69 | 0.31 | +32 | NO | yes | -0.31 | -0.33 |
| 2026-04-15 | BAC | Oil | 20% | 0.64 | 0.53 | 0.47 | +33 | NO | no | +0.53 | +0.51 |
| 2026-04-15 | BAC | Rate Cut | 28% | 0.86 | 0.85 | 0.15 | +57 | NO | yes | -0.15 | -0.16 |
| 2026-04-15 | BAC | Tariff | 10% | 0.49 | 0.48 | 0.52 | +38 | NO | yes | -0.52 | -0.54 |
| 2026-04-15 | MS | Oil | 15% | 0.60 | 0.56 | 0.44 | +41 | NO | no | +0.56 | +0.54 |
| 2026-04-15 | MS | Tailwind | 50% | 0.79 | 0.71 | 0.29 | +21 | NO | no | +0.71 | +0.69 |
| 2026-04-15 | MS | Zero Hash | 11% | 0.50 | 0.46 | 0.54 | +35 | NO | yes | -0.54 | -0.56 |
| 2026-04-15 | PGR | Pet Insurance | 5% | 0.58 | 0.18 | 0.82 | +13 | NO | no | +0.18 | +0.16 |
| 2026-04-15 | PGR | Snapshot | 84% | 0.38 | 0.03 | 0.38 | +46 | YES | no | -0.38 | -0.40 |
| 2026-04-16 | NFLX | Acquisition | 72% | 0.90 | 0.88 | 0.12 | +16 | NO | yes | -0.12 | -0.13 |
| 2026-04-16 | NFLX | Ad-Supported | 25% | 0.81 | 0.76 | 0.24 | +51 | NO | no | +0.76 | +0.74 |
| 2026-04-16 | NFLX | Competition | 79% | 0.92 | 0.90 | 0.10 | +11 | NO | yes | -0.10 | -0.11 |
| 2026-04-16 | NFLX | Gaming | 34% | 0.86 | 0.72 | 0.28 | +38 | NO | yes | -0.28 | -0.30 |
| 2026-04-16 | NFLX | Live Event | 22% | 0.97 | 0.93 | 0.07 | +71 | NO | yes | -0.07 | -0.08 |
| 2026-04-16 | NFLX | MLB | 5% | 0.78 | 0.75 | 0.25 | +70 | NO | yes | -0.25 | -0.27 |
| 2026-04-16 | NFLX | Paramount | 16% | 0.61 | 0.58 | 0.42 | +42 | NO | yes | -0.42 | -0.44 |
| 2026-04-16 | NFLX | Profitable | 49% | 0.73 | 0.65 | 0.35 | +16 | NO | no | +0.65 | +0.63 |
| 2026-04-16 | NFLX | Skyscraper | 5% | 0.55 | 0.52 | 0.48 | +47 | NO | yes | -0.48 | -0.50 |
| 2026-04-16 | NFLX | Stranger Things | 40% | 0.72 | 0.55 | 0.45 | +15 | NO | no | +0.55 | +0.53 |
| 2026-04-16 | NFLX | Subscriber | 87% | 0.33 | 0.30 | 0.33 | +54 | YES | yes | +0.67 | +0.65 |
| 2026-04-16 | NFLX | WWE | 16% | 0.71 | 0.48 | 0.52 | +32 | NO | no | +0.48 | +0.46 |
| 2026-04-16 | PEP | Nvidia | 5% | 0.19 | 0.16 | 0.84 | +11 | NO | no | +0.16 | +0.15 |
| 2026-04-17 | TFC | Credit Card | 28% | 0.55 | 0.54 | 0.46 | +26 | NO | no | +0.54 | +0.52 |
| 2026-04-17 | TFC | Middle Market | 36% | 0.87 | 0.75 | 0.25 | +39 | NO | yes | -0.25 | -0.27 |
| 2026-04-17 | TFC | Orioles | 4% | 0.32 | 0.31 | 0.69 | +27 | NO | no | +0.31 | +0.29 |
| 2026-04-17 | TFC | Recession | 45% | 0.29 | 0.20 | 0.29 | +16 | YES | no | -0.29 | -0.31 |
| 2026-04-21 | ALK | Iceland | 12% | 0.54 | 0.40 | 0.60 | +28 | NO | no | +0.40 | +0.38 |
| 2026-04-21 | ALK | Starlink | 12% | 0.90 | 0.89 | 0.11 | +77 | NO | yes | -0.11 | -0.12 |
| 2026-04-22 | BA | Airbus | 52% | 0.18 | 0.12 | 0.18 | +34 | YES | no | -0.18 | -0.20 |
| 2026-04-22 | GEV | Robotic / Robotics | 49% | 0.88 | 0.82 | 0.18 | +33 | NO | yes | -0.18 | -0.20 |
| 2026-04-22 | GEV | Vietnam / India | 49% | 0.77 | 0.70 | 0.30 | +21 | NO | yes | -0.30 | -0.32 |
| 2026-04-22 | TSLA | Competition | 22% | 0.61 | 0.60 | 0.40 | +38 | NO | yes | -0.40 | -0.42 |
| 2026-04-22 | TSLA | Cybertruck | 37% | 0.61 | 0.52 | 0.48 | +15 | NO | no | +0.52 | +0.50 |
| 2026-04-22 | TSLA | Delivery | 76% | 0.95 | 0.94 | 0.06 | +18 | NO | yes | -0.06 | -0.07 |
| 2026-04-22 | TSLA | Dojo / Dojo3 | 24% | 0.49 | 0.40 | 0.60 | +16 | NO | yes | -0.60 | -0.62 |
| 2026-04-22 | TSLA | Gigafactory | 53% | 0.39 | 0.36 | 0.39 | +14 | YES | no | -0.39 | -0.41 |
| 2026-04-22 | TSLA | Grok 5 | 4% | 0.16 | 0.14 | 0.86 | +10 | NO | no | +0.14 | +0.13 |
| 2026-04-22 | TSLA | Optimus | 27% | 1.00 | 0.99 | 0.01 | +72 | NO | yes | -0.01 | -0.02 |
| 2026-04-22 | TSLA | Roadster | 48% | 0.76 | 0.73 | 0.27 | +25 | NO | yes | -0.27 | -0.29 |
| 2026-04-22 | TSLA | Supercharger / Super Charger | 48% | 0.34 | 0.30 | 0.34 | +14 | YES | yes | +0.66 | +0.64 |
| 2026-04-22 | TSLA | SpaceX / xAI | 30% | 0.87 | 0.82 | 0.18 | +52 | NO | yes | -0.18 | -0.20 |
| 2026-04-22 | TSLA | Tariff | 22% | 0.82 | 0.76 | 0.24 | +54 | NO | yes | -0.24 | -0.26 |
| 2026-04-22 | TSLA | Terafab | 4% | 0.90 | 0.84 | 0.16 | +80 | NO | yes | -0.16 | -0.17 |
| 2026-04-22 | UAL | Middle East | 31% | 0.83 | 0.80 | 0.20 | +49 | NO | yes | -0.20 | -0.22 |
| 2026-04-22 | UAL | Nonstop / Non-Stop | 42% | 0.25 | 0.23 | 0.25 | +17 | YES | no | -0.25 | -0.27 |
| 2026-04-22 | UAL | Oil  | 17% | 0.72 | 0.71 | 0.29 | +54 | NO | yes | -0.29 | -0.31 |
| 2026-04-22 | UAL | On-Time / On Time | 57% | 0.93 | 0.92 | 0.08 | +35 | NO | yes | -0.08 | -0.09 |
| 2026-04-22 | UAL | Relax Row | 6% | 0.45 | 0.42 | 0.58 | +36 | NO | yes | -0.58 | -0.60 |
| 2026-04-22 | UAL | Starlink | 27% | 0.86 | 0.84 | 0.16 | +57 | NO | yes | -0.16 | -0.17 |
| 2026-04-22 | UAL | World Cup | 9% | 0.47 | 0.38 | 0.62 | +29 | NO | no | +0.38 | +0.36 |
| 2026-04-23 | AXP | Lounge | 50% | 0.80 | 0.69 | 0.31 | +19 | NO | yes | -0.31 | -0.33 |
| 2026-04-23 | INTC | Arizona | 28% | 0.83 | 0.75 | 0.25 | +47 | NO | no | +0.75 | +0.73 |
| 2026-04-23 | INTC | Dividend | 76% | 0.21 | 0.17 | 0.21 | +55 | YES | no | -0.21 | -0.23 |
| 2026-04-23 | INTC | Nvidia | 14% | 0.82 | 0.79 | 0.21 | +65 | NO | yes | -0.21 | -0.23 |
| 2026-04-23 | INTC | Panther Lake | 17% | 0.92 | 0.91 | 0.09 | +74 | NO | yes | -0.09 | -0.10 |
| 2026-04-23 | INTC | Tariff | 13% | 0.46 | 0.43 | 0.57 | +30 | NO | no | +0.43 | +0.41 |
| 2026-04-23 | INTC | Ultra 3 / Ultra Series 3 | 4% | 0.89 | 0.86 | 0.14 | +82 | NO | yes | -0.14 | -0.15 |
| 2026-04-24 | PG | AI / Artificial Intelligence | 15% | 0.86 | 0.82 | 0.18 | +67 | NO | yes | -0.18 | -0.20 |
| 2026-04-24 | PG | Beauty | 82% | 0.72 | 0.62 | 0.72 | +10 | YES | yes | +0.28 | +0.26 |
| 2026-04-24 | PG | Competition | 76% | 0.51 | 0.50 | 0.51 | +25 | YES | no | -0.51 | -0.53 |
| 2026-04-24 | PG | Inflation | 62% | 0.88 | 0.83 | 0.17 | +21 | NO | yes | -0.17 | -0.18 |
| 2026-04-24 | PG | WNBA | 3% | 0.46 | 0.37 | 0.63 | +34 | NO | no | +0.37 | +0.35 |
| 2026-04-27 | DPZ | Emergency Pizza | 13% | 0.48 | 0.32 | 0.68 | +19 | NO | no | +0.32 | +0.30 |
| 2026-04-27 | DPZ | Parmesan | 21% | 0.84 | 0.72 | 0.28 | +51 | NO | no | +0.72 | +0.70 |
| 2026-04-27 | DPZ | Tailwind | 41% | 0.84 | 0.81 | 0.19 | +40 | NO | yes | -0.19 | -0.21 |
| 2026-04-27 | VZ | Synergy | 14% | 0.88 | 0.87 | 0.13 | +73 | NO | yes | -0.13 | -0.14 |
| 2026-04-28 | HOOD | Acquisition | 65% | 0.90 | 0.86 | 0.14 | +21 | NO | yes | -0.14 | -0.15 |
| 2026-04-28 | HOOD | Blockchain | 25% | 0.57 | 0.50 | 0.50 | +25 | NO | no | +0.50 | +0.48 |
| 2026-04-28 | HOOD | Kalshi | 11% | 0.32 | 0.28 | 0.72 | +17 | NO | no | +0.28 | +0.26 |
| 2026-04-28 | HOOD | Perp / Perpetual | 16% | 0.70 | 0.59 | 0.41 | +43 | NO | yes | -0.41 | -0.43 |
| 2026-04-28 | HOOD | Social | 38% | 0.96 | 0.93 | 0.07 | +55 | NO | yes | -0.07 | -0.08 |
| 2026-04-28 | HOOD | Tokenization | 25% | 0.96 | 0.92 | 0.08 | +67 | NO | yes | -0.08 | -0.09 |
| 2026-04-28 | HOOD | Trump | 16% | 0.66 | 0.65 | 0.35 | +49 | NO | yes | -0.35 | -0.37 |
| 2026-04-28 | KO | Cane Sugar | 5% | 0.39 | 0.30 | 0.70 | +25 | NO | no | +0.30 | +0.28 |
| 2026-04-28 | KO | Fairlife | 56% | 0.96 | 0.95 | 0.05 | +39 | NO | yes | -0.05 | -0.06 |
| 2026-04-28 | KO | International | 31% | 0.54 | 0.52 | 0.48 | +21 | NO | no | +0.52 | +0.50 |
| 2026-04-28 | KO | Prebiotic | 7% | 0.25 | 0.19 | 0.81 | +12 | NO | yes | -0.81 | -0.83 |
| 2026-04-28 | KO | Tariff | 10% | 0.29 | 0.24 | 0.76 | +14 | NO | no | +0.24 | +0.22 |
| 2026-04-28 | SBUX | Boyu | 5% | 0.92 | 0.91 | 0.09 | +86 | NO | yes | -0.09 | -0.10 |
| 2026-04-28 | SBUX | Protein | 26% | 0.96 | 0.95 | 0.05 | +69 | NO | yes | -0.05 | -0.06 |
| 2026-04-28 | SBUX | Tariff | 11% | 0.96 | 0.92 | 0.08 | +81 | NO | yes | -0.08 | -0.09 |
| 2026-04-28 | SPOT | Award | 7% | 0.28 | 0.17 | 0.83 | +10 | NO | no | +0.17 | +0.16 |
| 2026-04-28 | SPOT | Bookshop / Bookshop.org | 7% | 0.67 | 0.58 | 0.42 | +51 | NO | no | +0.58 | +0.56 |
| 2026-04-28 | SPOT | ChatGPT | 7% | 0.34 | 0.24 | 0.76 | +17 | NO | yes | -0.76 | -0.78 |
| 2026-04-28 | SPOT | Headwind | 50% | 0.77 | 0.65 | 0.35 | +15 | NO | no | +0.65 | +0.63 |
| 2026-04-28 | SPOT | Monetization | 75% | 0.96 | 0.95 | 0.05 | +20 | NO | yes | -0.05 | -0.06 |
| 2026-04-28 | SPOT | Physical | 30% | 0.53 | 0.50 | 0.50 | +20 | NO | no | +0.50 | +0.48 |
| 2026-04-28 | V | Regulation / Regulatory | 69% | 0.56 | 0.51 | 0.56 | +13 | YES | yes | +0.44 | +0.42 |
| 2026-04-28 | V | World Cup | 26% | 0.70 | 0.61 | 0.39 | +35 | NO | yes | -0.39 | -0.41 |
| 2026-04-29 | AMZN | Alexa+ / Alexa Plus | 8% | 0.96 | 0.95 | 0.05 | +87 | NO | yes | -0.05 | -0.06 |
| 2026-04-29 | AMZN | China | 42% | 0.29 | 0.25 | 0.29 | +13 | YES | no | -0.29 | -0.31 |
| 2026-04-29 | AMZN | Data Center | 41% | 0.89 | 0.77 | 0.23 | +36 | NO | yes | -0.23 | -0.25 |
| 2026-04-29 | AMZN | Drone | 8% | 0.46 | 0.30 | 0.70 | +22 | NO | no | +0.30 | +0.28 |
| 2026-04-29 | AMZN | Prime Day | 48% | 0.75 | 0.74 | 0.26 | +26 | NO | yes | -0.26 | -0.28 |
| 2026-04-29 | AMZN | Silicon | 19% | 0.93 | 0.90 | 0.10 | +71 | NO | yes | -0.10 | -0.11 |
| 2026-04-29 | AMZN | Supply Chain | 26% | 0.49 | 0.42 | 0.58 | +16 | NO | yes | -0.58 | -0.60 |
| 2026-04-29 | AMZN | Tariff | 8% | 0.98 | 0.97 | 0.03 | +89 | NO | yes | -0.03 | -0.04 |
| 2026-04-29 | AMZN | Third Party Sellers | 4% | 0.72 | 0.69 | 0.31 | +65 | NO | yes | -0.31 | -0.33 |
| 2026-04-29 | CMG | Al Pastor | 20% | 0.90 | 0.87 | 0.13 | +67 | NO | yes | -0.13 | -0.14 |
| 2026-04-29 | CMG | Carne Asada | 29% | 0.52 | 0.40 | 0.60 | +11 | NO | no | +0.40 | +0.38 |
| 2026-04-29 | CMG | Chipotle Lane / Chipotlane | 44% | 0.93 | 0.91 | 0.09 | +47 | NO | yes | -0.09 | -0.10 |
| 2026-04-29 | CMG | Headwind | 41% | 0.76 | 0.62 | 0.38 | +21 | NO | no | +0.62 | +0.60 |
| 2026-04-29 | CMG | Tailwind | 15% | 0.42 | 0.34 | 0.66 | +19 | NO | no | +0.34 | +0.32 |
| 2026-04-29 | CMG | Tariff | 10% | 0.87 | 0.78 | 0.22 | +68 | NO | no | +0.78 | +0.76 |
| 2026-04-29 | CMG | Transaction Growth | 44% | 0.89 | 0.76 | 0.24 | +32 | NO | yes | -0.24 | -0.26 |
| 2026-04-29 | CVNA | Bridgecrest | 4% | 0.35 | 0.21 | 0.79 | +17 | NO | no | +0.21 | +0.19 |
| 2026-04-29 | CVNA | Same Day | 9% | 0.58 | 0.48 | 0.52 | +39 | NO | no | +0.48 | +0.46 |
| 2026-04-29 | GOOGL | Autonomous | 41% | 0.73 | 0.70 | 0.30 | +29 | NO | yes | -0.30 | -0.32 |
| 2026-04-29 | GOOGL | Privacy | 43% | 0.24 | 0.20 | 0.24 | +19 | YES | no | -0.24 | -0.26 |
| 2026-04-29 | GOOGL | Quantum | 12% | 0.44 | 0.43 | 0.57 | +31 | NO | no | +0.43 | +0.41 |
| 2026-04-29 | GOOGL | Regulator / Regulation / Regulatory | 34% | 0.23 | 0.22 | 0.23 | +11 | YES | no | -0.23 | -0.25 |
| 2026-04-29 | META | Dividend | 23% | 0.86 | 0.75 | 0.25 | +52 | NO | no | +0.75 | +0.73 |
| 2026-04-29 | META | Hyperion | 4% | 0.36 | 0.31 | 0.69 | +27 | NO | no | +0.31 | +0.29 |
| 2026-04-29 | META | Llama | 22% | 0.62 | 0.58 | 0.42 | +36 | NO | no | +0.58 | +0.56 |
| 2026-04-29 | META | Muse | 3% | 0.97 | 0.95 | 0.05 | +92 | NO | yes | -0.05 | -0.06 |
| 2026-04-29 | META | Orion | 9% | 0.49 | 0.39 | 0.61 | +30 | NO | no | +0.39 | +0.37 |
| 2026-04-29 | META | Thread / Threads | 47% | 0.97 | 0.95 | 0.05 | +48 | NO | yes | -0.05 | -0.06 |
| 2026-04-29 | META | VR / Virtual Reality | 71% | 0.59 | 0.52 | 0.59 | +12 | YES | yes | +0.41 | +0.39 |
| 2026-04-29 | MSFT | LinkedIn | 63% | 0.96 | 0.95 | 0.05 | +32 | NO | yes | -0.05 | -0.06 |
| 2026-04-29 | WING | Hot Box | 4% | 0.28 | 0.20 | 0.80 | +16 | NO | no | +0.20 | +0.18 |
| 2026-04-29 | WING | Tender | 44% | 0.73 | 0.70 | 0.30 | +26 | NO | yes | -0.30 | -0.32 |
| 2026-04-30 | AAPL | Apple Pay | 61% | 0.81 | 0.71 | 0.29 | +10 | NO | no | +0.71 | +0.69 |
| 2026-04-30 | AAPL | Creator Studio | 4% | 0.58 | 0.52 | 0.48 | +48 | NO | no | +0.52 | +0.50 |
| 2026-04-30 | AAPL | Formula 1 / F1 | 10% | 0.86 | 0.77 | 0.23 | +67 | NO | yes | -0.23 | -0.25 |
| 2026-04-30 | AAPL | Fold / Folding / Foldable | 6% | 0.27 | 0.23 | 0.77 | +17 | NO | no | +0.23 | +0.21 |
| 2026-04-30 | AAPL | Gemini | 4% | 0.44 | 0.37 | 0.63 | +33 | NO | no | +0.37 | +0.35 |
| 2026-04-30 | AAPL | Liquid Glass | 6% | 0.33 | 0.27 | 0.73 | +21 | NO | no | +0.27 | +0.25 |
| 2026-04-30 | AAPL | Manufacturing | 59% | 0.95 | 0.92 | 0.08 | +33 | NO | yes | -0.08 | -0.09 |
| 2026-04-30 | AAPL | Modem | 12% | 0.36 | 0.28 | 0.72 | +16 | NO | yes | -0.72 | -0.74 |
| 2026-04-30 | AAPL | Siri | 53% | 0.94 | 0.90 | 0.10 | +37 | NO | yes | -0.10 | -0.11 |
| 2026-04-30 | AAPL | Streaming | 31% | 0.50 | 0.46 | 0.54 | +15 | NO | no | +0.46 | +0.44 |
| 2026-04-30 | AAPL | Tariff | 20% | 0.97 | 0.95 | 0.05 | +75 | NO | yes | -0.05 | -0.06 |
| 2026-04-30 | LLY | AI / Artificial Intelligence | 7% | 0.80 | 0.76 | 0.24 | +69 | NO | no | +0.76 | +0.74 |
| 2026-04-30 | LLY | Foundayo | 3% | 0.98 | 0.96 | 0.04 | +93 | NO | yes | -0.04 | -0.05 |
| 2026-04-30 | LLY | Headwind | 84% | 0.52 | 0.43 | 0.52 | +32 | YES | yes | +0.48 | +0.46 |
| 2026-04-30 | LLY | LillyDirect | 11% | 0.96 | 0.91 | 0.09 | +80 | NO | yes | -0.09 | -0.10 |
| 2026-04-30 | LLY | Nvidia | 5% | 0.50 | 0.49 | 0.51 | +44 | NO | no | +0.49 | +0.47 |
| 2026-04-30 | LLY | Pennsylvania | 3% | 0.38 | 0.35 | 0.65 | +32 | NO | no | +0.35 | +0.33 |
| 2026-04-30 | LLY | Vial | 35% | 0.89 | 0.86 | 0.14 | +51 | NO | yes | -0.14 | -0.15 |
| 2026-04-30 | RDDT | Game | 57% | 0.40 | 0.29 | 0.40 | +17 | YES | no | -0.40 | -0.42 |
| 2026-04-30 | RDDT | Headwind | 40% | 0.27 | 0.25 | 0.27 | +13 | YES | no | -0.27 | -0.29 |
| 2026-04-30 | RDDT | Reddit Pro | 75% | 0.96 | 0.95 | 0.05 | +20 | NO | yes | -0.05 | -0.06 |
| 2026-04-30 | RDDT | Shopify | 14% | 0.97 | 0.96 | 0.04 | +82 | NO | yes | -0.04 | -0.05 |
| 2026-04-30 | RIVN | Cox | 7% | 0.44 | 0.24 | 0.76 | +17 | NO | no | +0.24 | +0.22 |
| 2026-04-30 | RIVN | Headwind | 36% | 0.49 | 0.46 | 0.54 | +10 | NO | no | +0.46 | +0.44 |
| 2026-04-30 | RIVN | Robot / Robotic / Robotics | 40% | 0.71 | 0.61 | 0.39 | +21 | NO | yes | -0.39 | -0.41 |
| 2026-04-30 | RIVN | Tornado | 7% | 0.57 | 0.54 | 0.46 | +47 | NO | yes | -0.46 | -0.48 |
| 2026-04-30 | RIVN | Uber | 7% | 0.95 | 0.92 | 0.08 | +85 | NO | yes | -0.08 | -0.09 |
| 2026-05-04 | ON | NIO | 7% | 0.85 | 0.72 | 0.28 | +65 | NO | yes | -0.28 | -0.30 |
| 2026-05-04 | ON | Nvidia | 16% | 0.46 | 0.43 | 0.57 | +27 | NO | no | +0.43 | +0.41 |
| 2026-05-04 | ON | Tariff | 20% | 0.35 | 0.31 | 0.69 | +11 | NO | no | +0.31 | +0.29 |
| 2026-05-04 | PLTR | Commercial Growth | 18% | 0.37 | 0.28 | 0.72 | +10 | NO | yes | -0.72 | -0.74 |
| 2026-05-04 | PLTR | Healthcare | 77% | 0.56 | 0.54 | 0.56 | +21 | YES | no | -0.56 | -0.58 |
| 2026-05-04 | PLTR | Iran / Iranian | 14% | 0.72 | 0.71 | 0.29 | +57 | NO | no | +0.71 | +0.69 |
| 2026-05-04 | PLTR | Revenue guidance | 66% | 0.87 | 0.86 | 0.14 | +20 | NO | yes | -0.14 | -0.15 |
| 2026-05-04 | PLTR | Stellantis | 6% | 0.32 | 0.26 | 0.74 | +20 | NO | no | +0.26 | +0.24 |
| 2026-05-05 | PYPL | Ads ID | 3% | 0.70 | 0.69 | 0.31 | +66 | NO | no | +0.69 | +0.67 |
| 2026-05-05 | SHOP | Shop Pay | 57% | 1.00 | 0.99 | 0.01 | +42 | NO | yes | -0.01 | -0.02 |
| 2026-05-05 | SHOP | Tariff | 16% | 0.78 | 0.72 | 0.28 | +56 | NO | no | +0.72 | +0.70 |
| 2026-05-06 | DIS | Acquisition | 80% | 0.50 | 0.45 | 0.50 | +30 | YES | yes | +0.50 | +0.48 |
| 2026-05-06 | DIS | Cruise | 75% | 0.96 | 0.92 | 0.08 | +17 | NO | yes | -0.08 | -0.09 |
| 2026-05-06 | DIS | OpenAI / Sora | 4% | 0.48 | 0.46 | 0.54 | +42 | NO | no | +0.46 | +0.44 |
| 2026-05-06 | DIS | Subscriber | 84% | 0.96 | 0.95 | 0.05 | +11 | NO | yes | -0.05 | -0.06 |
| 2026-05-06 | UBER | Avride | 14% | 0.60 | 0.49 | 0.51 | +35 | NO | no | +0.49 | +0.47 |
| 2026-05-06 | UBER | Driver Incentives | 37% | 0.19 | 0.11 | 0.19 | +18 | YES | no | -0.19 | -0.21 |
| 2026-05-06 | UBER | Nissan | 5% | 0.54 | 0.50 | 0.50 | +45 | NO | no | +0.50 | +0.48 |
| 2026-05-06 | UBER | Waabi | 17% | 0.57 | 0.55 | 0.45 | +38 | NO | no | +0.55 | +0.53 |
| 2026-05-06 | UBER | Waymo | 30% | 1.00 | 0.96 | 0.04 | +66 | NO | yes | -0.04 | -0.05 |
| 2026-05-07 | ABNB | Boutique | 31% | 0.86 | 0.83 | 0.17 | +52 | NO | yes | -0.17 | -0.18 |
| 2026-05-07 | ABNB | International | 68% | 0.88 | 0.86 | 0.14 | +18 | NO | yes | -0.14 | -0.15 |
| 2026-05-07 | ABNB | Tailwind | 60% | 0.81 | 0.79 | 0.21 | +19 | NO | yes | -0.21 | -0.23 |
| 2026-05-07 | LYFT | FreeNow / Free Now | 17% | 0.96 | 0.93 | 0.07 | +76 | NO | yes | -0.07 | -0.08 |
| 2026-05-07 | LYFT | International | 27% | 0.68 | 0.65 | 0.35 | +38 | NO | no | +0.65 | +0.63 |
| 2026-05-07 | LYFT | Membership | 40% | 0.24 | 0.18 | 0.24 | +16 | YES | no | -0.24 | -0.26 |
| 2026-05-07 | LYFT | Mobileye | 17% | 0.52 | 0.48 | 0.52 | +31 | NO | no | +0.48 | +0.46 |
| 2026-05-07 | LYFT | Waymo | 37% | 0.93 | 0.90 | 0.10 | +53 | NO | yes | -0.10 | -0.11 |
| 2026-05-07 | MCD | Delivery | 72% | 0.60 | 0.56 | 0.60 | +12 | YES | yes | +0.40 | +0.38 |
| 2026-05-07 | MCD | Happy Meal | 28% | 0.64 | 0.62 | 0.38 | +34 | NO | yes | -0.38 | -0.40 |
| 2026-05-07 | MCD | Hot Honey | 4% | 0.26 | 0.25 | 0.75 | +21 | NO | yes | -0.75 | -0.77 |
| 2026-05-07 | MCD | Loyalty | 57% | 0.95 | 0.91 | 0.09 | +34 | NO | no | +0.91 | +0.90 |
| 2026-05-07 | MCD | McChicken | 20% | 0.55 | 0.50 | 0.50 | +30 | NO | yes | -0.50 | -0.52 |
| 2026-05-07 | MCD | Monopoly | 28% | 0.55 | 0.53 | 0.47 | +25 | NO | no | +0.53 | +0.51 |
| 2026-05-07 | MCD | Revenue | 48% | 0.62 | 0.61 | 0.39 | +13 | NO | no | +0.61 | +0.59 |
| 2026-05-07 | MCD | Tariff | 8% | 0.27 | 0.25 | 0.75 | +17 | NO | no | +0.25 | +0.23 |
| 2026-05-11 | HIMS | Canada | 23% | 0.82 | 0.78 | 0.22 | +55 | NO | yes | -0.22 | -0.24 |
| 2026-05-11 | HIMS | Peptide | 27% | 0.95 | 0.91 | 0.09 | +64 | NO | yes | -0.09 | -0.10 |
| 2026-05-11 | HIMS | Regulation | 19% | 0.70 | 0.65 | 0.35 | +46 | NO | no | +0.65 | +0.63 |
| 2026-05-11 | HIMS | Vitamin | 31% | 0.64 | 0.56 | 0.44 | +25 | NO | no | +0.56 | +0.54 |
| 2026-05-11 | HIMS | Zava | 18% | 0.78 | 0.74 | 0.26 | +56 | NO | yes | -0.26 | -0.28 |
| 2026-05-12 | OKLO | Meta | 26% | 0.92 | 0.78 | 0.22 | +52 | NO | yes | -0.22 | -0.24 |
| 2026-05-12 | OKLO | Tennessee | 36% | 0.93 | 0.72 | 0.28 | +36 | NO | yes | -0.28 | -0.30 |
| 2026-05-13 | NBIS | Token | 34% | 0.90 | 0.81 | 0.19 | +47 | NO | yes | -0.19 | -0.21 |
| 2026-05-19 | CAVA | Sweet Potato | 25% | 0.51 | 0.45 | 0.55 | +20 | NO | yes | -0.55 | -0.57 |
| 2026-05-19 | HD | Competition / Competitor | 48% | 0.28 | 0.24 | 0.28 | +20 | YES | yes | +0.72 | +0.70 |
| 2026-05-19 | HD | Synergy | 8% | 0.58 | 0.54 | 0.46 | +46 | NO | no | +0.54 | +0.52 |
| 2026-05-19 | HD | Tariff | 25% | 0.93 | 0.91 | 0.09 | +66 | NO | yes | -0.09 | -0.10 |
| 2026-05-20 | LOW | Tariff | 14% | 0.81 | 0.70 | 0.30 | +56 | NO | yes | -0.30 | -0.32 |
| 2026-05-20 | NVDA | Arizona | 5% | 0.23 | 0.22 | 0.78 | +17 | NO | no | +0.22 | +0.20 |
| 2026-05-20 | NVDA | Cosmos | 10% | 0.74 | 0.71 | 0.29 | +61 | NO | no | +0.71 | +0.69 |
| 2026-05-20 | NVDA | Domestic | 18% | 0.36 | 0.32 | 0.68 | +14 | NO | no | +0.32 | +0.30 |
| 2026-05-20 | NVDA | H20 | 8% | 0.53 | 0.52 | 0.48 | +44 | NO | no | +0.52 | +0.50 |
| 2026-05-20 | NVDA | Humanoid | 8% | 0.56 | 0.48 | 0.52 | +40 | NO | yes | -0.52 | -0.54 |
| 2026-05-20 | NVDA | Hyperscaler | 42% | 0.93 | 0.90 | 0.10 | +48 | NO | yes | -0.10 | -0.11 |
| 2026-05-20 | NVDA | Self Driving | 2% | 0.75 | 0.74 | 0.26 | +72 | NO | yes | -0.26 | -0.28 |
| 2026-05-20 | NVDA | Taiwan | 18% | 0.49 | 0.44 | 0.56 | +26 | NO | no | +0.44 | +0.42 |
| 2026-05-20 | NVDA | VR / Virtual Reality | 38% | 0.18 | 0.16 | 0.18 | +20 | YES | no | -0.18 | -0.20 |
| 2026-05-20 | TOL | Buffington / Arkansas | 5% | 0.97 | 0.88 | 0.12 | +83 | NO | yes | -0.12 | -0.13 |
| 2026-05-20 | TOL | Customize / Customization | 37% | 0.98 | 0.50 | 0.50 | +13 | NO | yes | -0.50 | -0.52 |
| 2026-05-20 | TOL | Dividend | 76% | 0.93 | 0.89 | 0.11 | +13 | NO | yes | -0.11 | -0.12 |
| 2026-05-20 | TOL | Lumber | 51% | 0.99 | 0.73 | 0.27 | +22 | NO | yes | -0.27 | -0.29 |
| 2026-05-20 | URBN | Holiday | 77% | 0.65 | 0.46 | 0.65 | +12 | YES | no | -0.65 | -0.67 |
| 2026-05-20 | URBN | Tariff | 17% | 0.90 | 0.89 | 0.11 | +72 | NO | yes | -0.11 | -0.12 |
| 2026-05-21 | BULL | Buyback / Repurchase | 22% | 0.77 | 0.76 | 0.24 | +54 | NO | yes | -0.24 | -0.26 |
| 2026-05-21 | BULL | Kalshi | 58% | 0.47 | 0.35 | 0.47 | +11 | YES | no | -0.47 | -0.49 |
| 2026-05-21 | DE | AI / Artificial Intelligence | 10% | 0.67 | 0.55 | 0.45 | +45 | NO | no | +0.55 | +0.53 |
| 2026-05-21 | DE | Tariff | 27% | 0.92 | 0.89 | 0.11 | +62 | NO | yes | -0.11 | -0.12 |
| 2026-05-21 | DE | Weather | 68% | 0.54 | 0.40 | 0.54 | +14 | YES | no | -0.54 | -0.56 |
| 2026-05-21 | WMT | OnePay / One Pay | 7% | 0.83 | 0.70 | 0.30 | +63 | NO | no | +0.70 | +0.68 |
| 2026-05-21 | WMT | OpenAI | 5% | 0.71 | 0.55 | 0.45 | +50 | NO | no | +0.55 | +0.53 |
| 2026-05-21 | WMT | Tariff | 55% | 0.84 | 0.77 | 0.23 | +22 | NO | yes | -0.23 | -0.25 |
| 2026-05-21 | WMT | Upper Income | 4% | 0.32 | 0.26 | 0.74 | +22 | NO | no | +0.26 | +0.24 |
| 2026-05-27 | CRM | AgentForce / Agent Force | 13% | 0.96 | 0.93 | 0.07 | +80 | NO | yes | -0.07 | -0.08 |
| 2026-05-27 | CRM | Consumption | 17% | 0.85 | 0.84 | 0.16 | +67 | NO | yes | -0.16 | -0.17 |
| 2026-05-27 | CRM | Trillion | 32% | 0.85 | 0.80 | 0.20 | +48 | NO | yes | -0.20 | -0.22 |
| 2026-05-27 | MRVL | Electro-Optic / Electro Optic | 40% | 0.85 | 0.80 | 0.20 | +40 | NO | no | +0.80 | +0.78 |
| 2026-05-27 | MRVL | Hyperscaler | 47% | 0.90 | 0.86 | 0.14 | +39 | NO | yes | -0.14 | -0.15 |
| 2026-05-27 | MRVL | LPO | 9% | 0.58 | 0.43 | 0.57 | +34 | NO | no | +0.43 | +0.41 |
| 2026-05-27 | MRVL | Nvidia | 20% | 0.55 | 0.48 | 0.52 | +28 | NO | yes | -0.52 | -0.54 |
| 2026-05-27 | SNOW | Europe | 61% | 0.38 | 0.35 | 0.38 | +23 | YES | no | -0.38 | -0.40 |
| 2026-05-27 | SNOW | Repurchase | 57% | 0.93 | 0.91 | 0.09 | +34 | NO | yes | -0.09 | -0.10 |
| 2026-05-28 | COST | Dividend | 71% | 0.51 | 0.48 | 0.51 | +20 | YES | yes | +0.49 | +0.47 |
| 2026-05-28 | COST | Gold Bar | 7% | 0.22 | 0.18 | 0.82 | +11 | NO | no | +0.18 | +0.16 |
| 2026-05-28 | COST | Instacart | 62% | 0.76 | 0.74 | 0.26 | +12 | NO | yes | -0.26 | -0.28 |
| 2026-05-28 | COST | Kirkland | 71% | 0.96 | 0.90 | 0.10 | +19 | NO | yes | -0.10 | -0.11 |
| 2026-05-28 | COST | Revenue | 45% | 0.71 | 0.68 | 0.32 | +23 | NO | yes | -0.32 | -0.34 |
| 2026-05-28 | COST | Tariff | 23% | 0.95 | 0.92 | 0.08 | +69 | NO | yes | -0.08 | -0.09 |
| 2026-05-28 | DELL | Nvidia | 45% | 0.69 | 0.68 | 0.32 | +23 | NO | yes | -0.32 | -0.34 |
| 2026-05-28 | DELL | Texas | 11% | 0.44 | 0.36 | 0.64 | +25 | NO | no | +0.36 | +0.34 |
| 2026-06-02 | ULTA | Google / Gemini | 15% | 0.83 | 0.82 | 0.18 | +67 | NO | yes | -0.18 | -0.20 |
| 2026-06-02 | ULTA | Middle East | 24% | 0.76 | 0.73 | 0.27 | +49 | NO | yes | -0.27 | -0.29 |
| 2026-06-02 | ULTA | Rare Beauty | 11% | 0.63 | 0.62 | 0.38 | +51 | NO | yes | -0.38 | -0.40 |
| 2026-06-02 | ULTA | Space NK | 19% | 0.95 | 0.92 | 0.08 | +73 | NO | yes | -0.08 | -0.09 |
| 2026-06-02 | ULTA | Tariff | 24% | 0.37 | 0.36 | 0.64 | +12 | NO | no | +0.36 | +0.34 |
| 2026-06-02 | ULTA | Traffic | 80% | 0.58 | 0.57 | 0.58 | +22 | YES | yes | +0.42 | +0.40 |
| 2026-06-02 | ULTA | Uncertainty | 54% | 0.87 | 0.85 | 0.15 | +31 | NO | yes | -0.15 | -0.16 |
| 2026-06-02 | VSCO | AI / Artificial Intelligence | 38% | 0.25 | 0.22 | 0.25 | +13 | YES | no | -0.25 | -0.27 |
| 2026-06-02 | VSCO | Conversion | 70% | 0.60 | 0.56 | 0.60 | +10 | YES | no | -0.60 | -0.62 |
| 2026-06-02 | VSCO | Fragrance | 60% | 0.92 | 0.84 | 0.16 | +24 | NO | yes | -0.16 | -0.17 |
| 2026-06-02 | VSCO | Hailey Bieber | 27% | 0.48 | 0.39 | 0.61 | +12 | NO | yes | -0.61 | -0.63 |
| 2026-06-02 | VSCO | Sport Bra / Sports Bra | 60% | 0.75 | 0.72 | 0.28 | +12 | NO | yes | -0.28 | -0.30 |
| 2026-06-02 | VSCO | Tariff | 29% | 0.95 | 0.94 | 0.06 | +65 | NO | yes | -0.06 | -0.07 |
| 2026-06-02 | VSCO | Ticker | 17% | 0.73 | 0.66 | 0.34 | +49 | NO | yes | -0.34 | -0.36 |
| 2026-06-03 | AVGO | Acquisition | 82% | 0.47 | 0.30 | 0.47 | +35 | YES | no | -0.47 | -0.49 |
| 2026-06-03 | AVGO | Competition | 37% | 0.60 | 0.59 | 0.41 | +22 | NO | no | +0.59 | +0.57 |
| 2026-06-03 | AVGO | Hyperscaler | 41% | 0.93 | 0.92 | 0.08 | +51 | NO | yes | -0.08 | -0.09 |
| 2026-06-03 | AVGO | Quantum | 3% | 0.15 | 0.14 | 0.86 | +11 | NO | no | +0.14 | +0.13 |
| 2026-06-03 | CRWD | China | 15% | 0.34 | 0.26 | 0.74 | +11 | NO | no | +0.26 | +0.24 |
| 2026-06-03 | CRWD | Germany | 5% | 0.48 | 0.34 | 0.66 | +29 | NO | no | +0.34 | +0.32 |
| 2026-06-03 | CRWD | Headwind | 24% | 0.48 | 0.37 | 0.63 | +13 | NO | no | +0.37 | +0.35 |
| 2026-06-03 | CRWD | SGNL / Signal | 24% | 0.82 | 0.78 | 0.22 | +54 | NO | yes | -0.22 | -0.24 |
| 2026-06-04 | LULU | Headwind | 53% | 0.83 | 0.76 | 0.24 | +23 | NO | yes | -0.24 | -0.26 |
| 2026-06-04 | LULU | Holiday | 77% | 0.23 | 0.12 | 0.23 | +54 | YES | no | -0.23 | -0.25 |
| 2026-06-08 | MTN | Gen Z | 8% | 0.71 | 0.63 | 0.37 | +55 | NO | no | +0.63 | +0.61 |
| 2026-06-08 | MTN | Snowpack | 15% | 0.53 | 0.52 | 0.48 | +37 | NO | no | +0.52 | +0.50 |
| 2026-06-09 | CBRL | 250 | 8% | 0.47 | 0.41 | 0.59 | +33 | NO | yes | -0.59 | -0.61 |
| 2026-06-09 | CBRL | Location | 71% | 0.33 | 0.25 | 0.33 | +38 | YES | no | -0.33 | -0.35 |
| 2026-06-09 | CBRL | Meals for Two | 10% | 0.31 | 0.28 | 0.72 | +18 | NO | no | +0.28 | +0.26 |
| 2026-06-09 | CBRL | Tariff | 31% | 0.81 | 0.80 | 0.20 | +49 | NO | yes | -0.20 | -0.22 |
| 2026-06-10 | CHWY | App | 53% | 0.92 | 0.87 | 0.13 | +34 | NO | yes | -0.13 | -0.14 |
| 2026-06-10 | CHWY | Modern Animal | 6% | 0.97 | 0.96 | 0.04 | +90 | NO | yes | -0.04 | -0.05 |
| 2026-06-10 | ORCL | Automation | 46% | 0.59 | 0.56 | 0.44 | +10 | NO | no | +0.56 | +0.54 |
| 2026-06-10 | ORCL | Backlog | 31% | 0.76 | 0.75 | 0.25 | +44 | NO | no | +0.75 | +0.73 |
| 2026-06-10 | ORCL | Multicloud | 4% | 0.96 | 0.91 | 0.09 | +87 | NO | yes | -0.09 | -0.10 |
| 2026-06-11 | ADBE | 3D | 51% | 0.74 | 0.68 | 0.32 | +17 | NO | yes | -0.32 | -0.34 |
| 2026-06-18 | KR | AI / Artificial Intelligence | 44% | 0.95 | 0.94 | 0.06 | +50 | NO | yes | -0.06 | -0.07 |
| 2026-06-23 | CCL | Celebration Key | 40% | 0.96 | 0.89 | 0.11 | +49 | NO | yes | -0.11 | -0.12 |
| 2026-06-23 | CCL | Dividend | 43% | 0.80 | 0.77 | 0.23 | +34 | NO | yes | -0.23 | -0.25 |
| 2026-06-23 | FDX | De Minimis | 13% | 0.84 | 0.75 | 0.25 | +62 | NO | yes | -0.25 | -0.27 |
| 2026-06-23 | FDX | Dividend | 61% | 0.80 | 0.78 | 0.22 | +17 | NO | yes | -0.22 | -0.24 |
| 2026-06-24 | MU | Anthropic | 2% | 0.92 | 0.91 | 0.09 | +89 | NO | no | +0.91 | +0.90 |
| 2026-06-24 | MU | Inventory | 89% | 0.52 | 0.51 | 0.52 | +37 | YES | no | -0.52 | -0.54 |
| 2026-06-29 | AVAV | Backpackable | 8% | 0.43 | 0.34 | 0.66 | +26 | NO | no | +0.34 | +0.32 |
| 2026-06-29 | AVAV | Golden Dome | 15% | 0.75 | 0.73 | 0.27 | +58 | NO | yes | -0.27 | -0.29 |
| 2026-06-29 | AVAV | Headwind | 45% | 0.59 | 0.57 | 0.43 | +12 | NO | no | +0.57 | +0.55 |
| 2026-06-29 | AVAV | Tailwind | 8% | 0.39 | 0.38 | 0.62 | +30 | NO | yes | -0.62 | -0.64 |
| 2026-06-29 | AVAV | Taiwan | 25% | 0.59 | 0.55 | 0.45 | +30 | NO | no | +0.55 | +0.53 |
| 2026-06-29 | PEP | Autonomous | 5% | 0.18 | 0.15 | 0.85 | +10 | NO | no | +0.15 | +0.14 |
| 2026-06-30 | NKE | Consumer Demand | 68% | 0.19 | 0.18 | 0.19 | +49 | YES | no | -0.19 | -0.21 |
| 2026-06-30 | NKE | Tariff | 17% | 0.86 | 0.85 | 0.15 | +68 | NO | yes | -0.15 | -0.16 |
| 2026-07-01 | GIS | Iran / Middle East | 74% | 0.15 | 0.14 | 0.15 | +59 | YES | no | -0.15 | -0.16 |
| 2026-07-01 | GIS | Wilderness | 53% | 0.37 | 0.36 | 0.37 | +16 | YES | yes | +0.63 | +0.61 |
| 2026-07-01 | GIS | World Cup | 18% | 0.33 | 0.31 | 0.69 | +13 | NO | no | +0.31 | +0.29 |
| 2026-07-01 | STZ | Inflation | 56% | 0.33 | 0.32 | 0.33 | +23 | YES | yes | +0.67 | +0.65 |
| 2026-07-01 | STZ | Mi Campo | 22% | 0.42 | 0.41 | 0.59 | +19 | NO | yes | -0.59 | -0.61 |
| 2026-07-02 | NFLX | Ad-Supported | 25% | 0.39 | 0.38 | 0.62 | +13 | NO | no | +0.38 | +0.36 |
| 2026-07-02 | NFLX | Hollywood | 35% | 0.48 | 0.47 | 0.53 | +12 | NO | no | +0.47 | +0.45 |
| 2026-07-02 | NFLX | KPop Demon Hunters | 2% | 0.29 | 0.28 | 0.72 | +26 | NO | yes | -0.72 | -0.74 |
| 2026-07-02 | NFLX | Live Event | 23% | 0.84 | 0.83 | 0.17 | +60 | NO | yes | -0.17 | -0.18 |
| 2026-07-02 | NFLX | NFL | 20% | 0.86 | 0.85 | 0.15 | +65 | NO | no | +0.85 | +0.84 |
| 2026-07-02 | NFLX | Paramount | 17% | 0.29 | 0.28 | 0.72 | +11 | NO | no | +0.28 | +0.26 |
| 2026-07-02 | NFLX | Partnership | 59% | 0.76 | 0.75 | 0.25 | +16 | NO | yes | -0.25 | -0.27 |
| 2026-07-02 | NFLX | Subscriber | 87% | 0.59 | 0.58 | 0.59 | +28 | YES | yes | +0.41 | +0.39 |
| 2026-07-02 | NFLX | World Cup | 10% | 0.54 | 0.53 | 0.47 | +43 | NO | no | +0.53 | +0.51 |
| 2026-07-08 | LEVI | World Cup | 5% | 0.63 | 0.57 | 0.43 | +52 | NO | yes | -0.43 | -0.45 |
| 2026-07-10 | DAL | Headwind | 60% | 0.74 | 0.73 | 0.27 | +13 | NO | yes | -0.27 | -0.29 |
| 2026-07-10 | DAL | Oil | 17% | 0.70 | 0.69 | 0.31 | +52 | NO | no | +0.69 | +0.67 |
| 2026-07-10 | DAL | Tailwind | 61% | 0.31 | 0.30 | 0.31 | +30 | YES | no | -0.31 | -0.33 |
| 2026-07-10 | DAL | Tariff | 36% | 0.71 | 0.70 | 0.30 | +34 | NO | no | +0.70 | +0.68 |
| 2026-07-10 | DAL | Weather | 54% | 0.74 | 0.73 | 0.27 | +19 | NO | no | +0.73 | +0.71 |
| 2026-07-14 | BAC | CashPro | 35% | 0.56 | 0.55 | 0.45 | +20 | NO | no | +0.55 | +0.53 |
| 2026-07-14 | BAC | M&A / Merger | 60% | 0.78 | 0.77 | 0.23 | +17 | NO | no | +0.77 | +0.75 |
| 2026-07-14 | BAC | Tariff | 11% | 0.55 | 0.54 | 0.46 | +43 | NO | no | +0.54 | +0.52 |
| 2026-07-14 | JPM | Inflation | 47% | 0.67 | 0.63 | 0.37 | +16 | NO | yes | -0.37 | -0.39 |
| 2026-07-14 | WFC | AI / Artificial Intelligence | 36% | 0.84 | 0.73 | 0.27 | +37 | NO | yes | -0.27 | -0.29 |
| 2026-07-15 | JNJ | Halda Therapeutics | 7% | 0.34 | 0.32 | 0.68 | +25 | NO | yes | -0.68 | -0.70 |
| 2026-07-15 | JNJ | Nipocalimab / Lupus | 41% | 0.59 | 0.55 | 0.45 | +14 | NO | no | +0.55 | +0.53 |
| 2026-07-16 | UAL | Holiday | 41% | 0.15 | 0.12 | 0.15 | +26 | YES | no | -0.15 | -0.16 |
| 2026-07-16 | UAL | Middle East | 34% | 0.52 | 0.48 | 0.52 | +14 | NO | yes | -0.52 | -0.54 |
| 2026-07-16 | UAL | Oil | 19% | 0.63 | 0.62 | 0.38 | +43 | NO | yes | -0.38 | -0.40 |
| 2026-07-16 | UAL | Red Eye | 12% | 0.43 | 0.40 | 0.60 | +28 | NO | no | +0.40 | +0.38 |
| 2026-07-16 | UAL | Union | 52% | 0.32 | 0.31 | 0.32 | +20 | YES | no | -0.32 | -0.34 |
| 2026-07-17 | HOOD | Blockchain | 24% | 0.51 | 0.50 | 0.50 | +26 | NO | yes | -0.50 | -0.52 |
| 2026-07-17 | HOOD | Concierge | 11% | 0.33 | 0.28 | 0.72 | +17 | NO | no | +0.28 | +0.26 |
| 2026-07-17 | HOOD | Social | 41% | 0.92 | 0.91 | 0.09 | +50 | NO | yes | -0.09 | -0.10 |
| 2026-07-20 | DPZ | Best Deal Ever | 10% | 0.73 | 0.72 | 0.28 | +62 | NO | yes | -0.28 | -0.30 |
| 2026-07-20 | DPZ | DomOS | 7% | 0.56 | 0.54 | 0.46 | +47 | NO | no | +0.54 | +0.52 |
| 2026-07-20 | DPZ | Soccer / World Cup | 8% | 0.28 | 0.25 | 0.75 | +17 | NO | yes | -0.75 | -0.77 |
| 2026-07-21 | ALLY | Basel | 23% | 0.44 | 0.38 | 0.62 | +15 | NO | no | +0.38 | +0.36 |
| 2026-07-21 | ALLY | EV / Electric | 52% | 0.32 | 0.31 | 0.32 | +20 | YES | yes | +0.68 | +0.66 |
| 2026-07-21 | ALLY | Oil | 10% | 0.58 | 0.48 | 0.52 | +38 | NO | yes | -0.52 | -0.54 |
| 2026-07-21 | ALLY | Rate Cut / Cut Rate | 56% | 0.39 | 0.36 | 0.39 | +17 | YES | no | -0.39 | -0.41 |
| 2026-07-22 | ALK | Iran / Middle East | 7% | 0.19 | 0.18 | 0.82 | +11 | NO | no | +0.18 | +0.16 |
| 2026-07-22 | ALK | Tailwind | 74% | 0.40 | 0.39 | 0.40 | +34 | YES | yes | +0.60 | +0.58 |
| 2026-07-22 | GEV | Blade | 69% | 0.21 | 0.20 | 0.21 | +48 | YES | no | -0.21 | -0.23 |
| 2026-07-22 | GOOGL | Autonomous | 42% | 0.76 | 0.75 | 0.25 | +33 | NO | no | +0.75 | +0.73 |
| 2026-07-22 | GOOGL | Gemini 3 | 7% | 0.76 | 0.74 | 0.26 | +67 | NO | no | +0.74 | +0.72 |
| 2026-07-22 | GOOGL | Ironwood | 8% | 0.24 | 0.23 | 0.77 | +15 | NO | no | +0.23 | +0.21 |
| 2026-07-22 | GOOGL | Nano Banana | 7% | 0.55 | 0.54 | 0.46 | +47 | NO | no | +0.54 | +0.52 |
| 2026-07-22 | GOOGL | Nvidia | 22% | 0.74 | 0.72 | 0.28 | +50 | NO | yes | -0.28 | -0.30 |
| 2026-07-22 | GOOGL | Privacy | 42% | 0.18 | 0.17 | 0.18 | +24 | YES | no | -0.18 | -0.20 |
| 2026-07-22 | GOOGL | Regulator / Regulation / Regulatory | 33% | 0.17 | 0.16 | 0.17 | +16 | YES | no | -0.17 | -0.18 |
| 2026-07-22 | GOOGL | Search Advertising / Search Ad | 65% | 0.30 | 0.29 | 0.30 | +35 | YES | yes | +0.70 | +0.68 |
| 2026-07-22 | GOOGL | Tailwind | 33% | 0.71 | 0.70 | 0.30 | +37 | NO | yes | -0.30 | -0.32 |
| 2026-07-22 | GOOGL | Wiz | 5% | 0.69 | 0.68 | 0.32 | +63 | NO | yes | -0.32 | -0.34 |
| 2026-07-22 | TSLA | Affordable | 60% | 0.71 | 0.70 | 0.30 | +10 | NO | yes | -0.30 | -0.32 |
| 2026-07-22 | TSLA | Competition | 23% | 0.70 | 0.69 | 0.31 | +46 | NO | yes | -0.31 | -0.33 |
| 2026-07-22 | TSLA | Cybercab | 13% | 0.97 | 0.96 | 0.04 | +83 | NO | yes | -0.04 | -0.05 |
| 2026-07-22 | TSLA | Gigafactory | 52% | 0.29 | 0.28 | 0.29 | +23 | YES | no | -0.29 | -0.31 |
| 2026-07-22 | TSLA | Grok (3+ times) | 2% | 0.56 | 0.54 | 0.46 | +52 | NO | yes | -0.46 | -0.48 |
| 2026-07-22 | TSLA | Intel | 11% | 0.32 | 0.31 | 0.69 | +20 | NO | no | +0.31 | +0.29 |
| 2026-07-22 | TSLA | Iran / Middle East | 2% | 0.14 | 0.13 | 0.87 | +11 | NO | no | +0.13 | +0.12 |
| 2026-07-22 | TSLA | Merge / Merger | 4% | 0.37 | 0.36 | 0.64 | +32 | NO | no | +0.36 | +0.34 |
| 2026-07-22 | TSLA | Miami | 4% | 0.86 | 0.85 | 0.15 | +81 | NO | no | +0.85 | +0.84 |
| 2026-07-22 | TSLA | Safety Monitor | 4% | 0.21 | 0.20 | 0.80 | +16 | NO | yes | -0.80 | -0.82 |
| 2026-07-22 | TSLA | Supercharger / Super Charger | 49% | 0.34 | 0.33 | 0.34 | +15 | YES | yes | +0.66 | +0.64 |
| 2026-07-22 | TSLA | Six-Seater / Six-Seat | 2% | 0.36 | 0.35 | 0.65 | +33 | NO | no | +0.35 | +0.33 |
| 2026-07-23 | AAL | AT&T | 23% | 0.72 | 0.66 | 0.34 | +43 | NO | no | +0.66 | +0.64 |
| 2026-07-23 | AAL | Basic Economy | 23% | 0.57 | 0.52 | 0.48 | +29 | NO | yes | -0.48 | -0.50 |
| 2026-07-23 | AAL | World Cup | 12% | 0.59 | 0.56 | 0.44 | +44 | NO | no | +0.56 | +0.54 |
| 2026-07-23 | INTC | Desktop | 71% | 0.38 | 0.35 | 0.38 | +33 | YES | no | -0.38 | -0.40 |
| 2026-07-23 | INTC | Government | 48% | 0.80 | 0.79 | 0.21 | +31 | NO | no | +0.79 | +0.77 |
| 2026-07-23 | INTC | Nvidia | 15% | 0.82 | 0.79 | 0.21 | +64 | NO | no | +0.79 | +0.77 |
| 2026-07-23 | INTC | Ultra 3 / Ultra Series 3 | 5% | 0.57 | 0.56 | 0.44 | +51 | NO | no | +0.56 | +0.54 |
| 2026-07-23 | LMT | Sikorsky | 65% | 0.92 | 0.89 | 0.11 | +24 | NO | yes | -0.11 | -0.12 |
| 2026-07-24 | AXP | Basel | 17% | 0.05 | 0.04 | 0.05 | +12 | YES | no | -0.05 | -0.06 |
| 2026-07-24 | AXP | Lounge | 51% | 0.77 | 0.76 | 0.24 | +25 | NO | yes | -0.24 | -0.26 |
| 2026-07-24 | AXP | Regulation / Regulatory | 73% | 0.28 | 0.27 | 0.28 | +45 | YES | no | -0.28 | -0.30 |
| 2026-07-24 | BULL | BlackRock | 53% | 0.38 | 0.30 | 0.38 | +15 | YES | no | -0.38 | -0.40 |
| 2026-07-24 | BULL | MCP | 33% | 0.82 | 0.73 | 0.27 | +40 | NO | yes | -0.27 | -0.29 |
| 2026-07-24 | BULL | MiCAR | 19% | 0.48 | 0.42 | 0.58 | +23 | NO | no | +0.42 | +0.40 |
| 2026-07-24 | BULL | PDT / Pattern Day Trader | 33% | 0.79 | 0.70 | 0.30 | +37 | NO | yes | -0.30 | -0.32 |
| 2026-07-24 | BULL | Self Clearing | 19% | 0.53 | 0.45 | 0.55 | +26 | NO | no | +0.45 | +0.43 |
| 2026-07-24 | BULL | Thailand | 30% | 0.70 | 0.61 | 0.39 | +31 | NO | yes | -0.39 | -0.41 |
| 2026-07-24 | BULL | Token / Tokenized | 41% | 0.25 | 0.16 | 0.25 | +16 | YES | yes | +0.75 | +0.73 |
| 2026-07-24 | BULL | Vega (5+ times) | 19% | 0.47 | 0.39 | 0.61 | +20 | NO | yes | -0.61 | -0.63 |
| 2026-07-24 | VZ | Home / MyHome | 88% | 0.62 | 0.61 | 0.62 | +26 | YES | yes | +0.38 | +0.36 |
| 2026-07-24 | VZ | Rural | 36% | 0.19 | 0.18 | 0.19 | +17 | YES | yes | +0.81 | +0.79 |
| 2026-07-28 | BA | Airbus | 51% | 0.17 | 0.16 | 0.17 | +34 | YES | no | -0.17 | -0.18 |
| 2026-07-28 | BA | Space | 93% | 0.79 | 0.76 | 0.79 | +14 | YES | yes | +0.21 | +0.19 |
| 2026-07-28 | F | Geely | 5% | 0.40 | 0.39 | 0.61 | +34 | NO | yes | -0.61 | -0.63 |
| 2026-07-28 | F | Oakville | 16% | 0.45 | 0.44 | 0.56 | +28 | NO | yes | -0.56 | -0.58 |
| 2026-07-28 | F | Skunk Works | 7% | 0.37 | 0.34 | 0.66 | +27 | NO | no | +0.34 | +0.32 |
| 2026-07-28 | F | Tailwind | 41% | 0.24 | 0.23 | 0.24 | +17 | YES | yes | +0.76 | +0.74 |
| 2026-07-28 | PYPL | Biometric | 20% | 0.68 | 0.66 | 0.34 | +46 | NO | no | +0.66 | +0.64 |
| 2026-07-28 | PYPL | Google | 42% | 0.23 | 0.20 | 0.23 | +19 | YES | no | -0.23 | -0.25 |
| 2026-07-28 | PYPL | Regulation / Regulator / Regulatory | 51% | 0.26 | 0.23 | 0.26 | +25 | YES | no | -0.26 | -0.28 |
| 2026-07-28 | PYPL | Stablecoin / Stable Coin | 16% | 0.66 | 0.65 | 0.35 | +49 | NO | no | +0.65 | +0.63 |
| 2026-07-28 | PYPL | Stripe | 8% | 0.29 | 0.28 | 0.72 | +20 | NO | no | +0.28 | +0.26 |
| 2026-07-29 | META | Advertising | 96% | 0.81 | 0.80 | 0.81 | +15 | YES | no | -0.81 | -0.83 |
| 2026-07-29 | META | Algorithm | 26% | 0.48 | 0.47 | 0.53 | +21 | NO | no | +0.47 | +0.45 |
| 2026-07-29 | META | Cloud | 21% | 0.90 | 0.89 | 0.11 | +68 | NO | yes | -0.11 | -0.12 |
| 2026-07-29 | META | Dividend | 23% | 0.34 | 0.33 | 0.67 | +10 | NO | no | +0.33 | +0.31 |
| 2026-07-29 | META | Hiring | 70% | 0.86 | 0.85 | 0.15 | +15 | NO | no | +0.85 | +0.84 |
| 2026-07-29 | META | Hyperion | 4% | 0.40 | 0.39 | 0.61 | +35 | NO | no | +0.39 | +0.37 |
| 2026-07-29 | META | Silicon | 14% | 0.62 | 0.61 | 0.39 | +47 | NO | yes | -0.39 | -0.41 |
| 2026-07-29 | MSFT | Anthropic | 7% | 0.52 | 0.51 | 0.49 | +44 | NO | yes | -0.49 | -0.51 |
| 2026-07-29 | MSFT | Cybersecurity | 26% | 0.38 | 0.37 | 0.63 | +11 | NO | no | +0.37 | +0.35 |
| 2026-07-29 | MSFT | Frontier | 23% | 0.50 | 0.49 | 0.51 | +26 | NO | yes | -0.51 | -0.53 |
| 2026-07-29 | MSFT | Maia | 11% | 0.54 | 0.53 | 0.47 | +42 | NO | yes | -0.47 | -0.49 |
| 2026-07-29 | MSFT | Windows 11 | 31% | 0.42 | 0.41 | 0.59 | +10 | NO | no | +0.41 | +0.39 |
| 2026-07-29 | SBUX | Boyu | 7% | 0.62 | 0.61 | 0.39 | +54 | NO | no | +0.61 | +0.59 |
| 2026-07-29 | SBUX | Canada | 40% | 0.14 | 0.13 | 0.14 | +26 | YES | yes | +0.86 | +0.85 |
| 2026-07-29 | SBUX | Comparable Sales | 29% | 0.50 | 0.48 | 0.52 | +19 | NO | yes | -0.52 | -0.54 |
| 2026-07-29 | SBUX | Loyalty | 78% | 0.60 | 0.59 | 0.60 | +18 | YES | yes | +0.40 | +0.38 |
| 2026-07-29 | SBUX | Matcha | 15% | 0.39 | 0.38 | 0.62 | +23 | NO | yes | -0.62 | -0.64 |
| 2026-07-29 | SBUX | Non Dairy | 3% | 0.24 | 0.23 | 0.77 | +20 | NO | no | +0.23 | +0.21 |
| 2026-07-29 | SBUX | Promotion | 56% | 0.40 | 0.39 | 0.40 | +16 | YES | no | -0.40 | -0.42 |
| 2026-07-29 | SBUX | Protein | 27% | 0.86 | 0.83 | 0.17 | +56 | NO | no | +0.83 | +0.82 |
| 2026-07-29 | SBUX | Smart Queue / SmartQ | 11% | 0.64 | 0.63 | 0.37 | +52 | NO | yes | -0.37 | -0.39 |
| 2026-07-29 | WING | Tajín | 4% | 0.52 | 0.51 | 0.49 | +47 | NO | no | +0.51 | +0.49 |
| 2026-07-29 | WING | Tender | 45% | 0.74 | 0.73 | 0.27 | +28 | NO | no | +0.73 | +0.71 |
| 2026-07-30 | AAPL | Broadcom | 2% | 0.64 | 0.63 | 0.37 | +61 | NO | yes | -0.37 | -0.39 |
| 2026-07-30 | AAPL | Formula 1 / F1 | 10% | 0.69 | 0.68 | 0.32 | +58 | NO | yes | -0.32 | -0.34 |
| 2026-07-30 | AAPL | Gemini | 4% | 0.38 | 0.37 | 0.63 | +33 | NO | no | +0.37 | +0.35 |
| 2026-07-30 | AAPL | Manufacturing | 60% | 0.77 | 0.76 | 0.24 | +16 | NO | yes | -0.24 | -0.26 |
| 2026-07-30 | AAPL | Modem | 13% | 0.46 | 0.45 | 0.55 | +32 | NO | no | +0.45 | +0.43 |
| 2026-07-30 | AAPL | OpenAI / ChatGPT | 9% | 0.26 | 0.25 | 0.75 | +16 | NO | no | +0.25 | +0.23 |
| 2026-07-30 | AAPL | Siri | 54% | 0.93 | 0.92 | 0.08 | +38 | NO | yes | -0.08 | -0.09 |
| 2026-07-30 | AAPL | Sport | 35% | 0.66 | 0.65 | 0.35 | +30 | NO | yes | -0.35 | -0.37 |
| 2026-07-30 | AAPL | Tariff | 21% | 0.96 | 0.95 | 0.05 | +74 | NO | yes | -0.05 | -0.06 |
| 2026-07-30 | AMZN | Alexa+ / Alexa Plus | 10% | 0.71 | 0.70 | 0.30 | +60 | NO | yes | -0.30 | -0.32 |
| 2026-07-30 | AMZN | Anthropic | 21% | 0.82 | 0.81 | 0.19 | +60 | NO | yes | -0.19 | -0.21 |
| 2026-07-30 | AMZN | China | 41% | 0.25 | 0.24 | 0.25 | +16 | YES | no | -0.25 | -0.27 |
| 2026-07-30 | AMZN | Data Center | 42% | 0.84 | 0.83 | 0.17 | +41 | NO | yes | -0.17 | -0.18 |
| 2026-07-30 | AMZN | Drone | 8% | 0.25 | 0.24 | 0.76 | +16 | NO | no | +0.24 | +0.22 |
| 2026-07-30 | AMZN | Gen-AI / Generative AI | 21% | 0.74 | 0.73 | 0.27 | +52 | NO | yes | -0.27 | -0.29 |
| 2026-07-30 | AMZN | OpenAI | 7% | 0.69 | 0.68 | 0.32 | +61 | NO | yes | -0.32 | -0.34 |
| 2026-07-30 | AMZN | Pinterest | 7% | 0.59 | 0.40 | 0.60 | +33 | NO | yes | -0.60 | -0.62 |
| 2026-07-30 | AMZN | Prime Day | 48% | 0.97 | 0.96 | 0.04 | +48 | NO | yes | -0.04 | -0.05 |
| 2026-07-30 | AMZN | Amazon Leo / Project Kuiper | 15% | 0.81 | 0.80 | 0.20 | +65 | NO | yes | -0.20 | -0.22 |
| 2026-07-30 | AMZN | Robotic / Robotics | 29% | 0.73 | 0.72 | 0.28 | +43 | NO | yes | -0.28 | -0.30 |
| 2026-07-30 | AMZN | Rufus | 12% | 0.70 | 0.69 | 0.31 | +57 | NO | no | +0.69 | +0.67 |
| 2026-07-30 | AMZN | Snowflake | 2% | 0.28 | 0.27 | 0.73 | +25 | NO | yes | -0.73 | -0.75 |
| 2026-07-30 | AMZN | Sponsored Products | 26% | 0.49 | 0.48 | 0.52 | +22 | NO | yes | -0.52 | -0.54 |
| 2026-07-30 | AMZN | Supply Chain | 27% | 0.66 | 0.65 | 0.35 | +38 | NO | yes | -0.35 | -0.37 |
| 2026-07-30 | AMZN | Tariff | 10% | 0.96 | 0.95 | 0.05 | +85 | NO | yes | -0.05 | -0.06 |
| 2026-07-30 | AMZN | Trainium | 21% | 0.96 | 0.95 | 0.05 | +74 | NO | yes | -0.05 | -0.06 |
| 2026-07-30 | AMZN | Zoox / Robotaxi | 8% | 0.47 | 0.46 | 0.54 | +38 | NO | no | +0.46 | +0.44 |
| 2026-07-30 | RDDT | Google (3+ times) | 13% | 0.44 | 0.43 | 0.57 | +30 | NO | no | +0.43 | +0.41 |
| 2026-07-30 | RDDT | Shopify | 21% | 0.76 | 0.75 | 0.25 | +54 | NO | yes | -0.25 | -0.27 |
| 2026-07-30 | YUM | Beef | 30% | 0.64 | 0.63 | 0.37 | +33 | NO | no | +0.63 | +0.61 |
| 2026-07-30 | YUM | Food Safety | 20% | 0.54 | 0.53 | 0.47 | +33 | NO | yes | -0.47 | -0.49 |
| 2026-07-30 | YUM | Outbreak / Illness | 20% | 0.44 | 0.43 | 0.57 | +23 | NO | no | +0.43 | +0.41 |
| 2026-08-03 | GRAB | Buyback / Buy Back | 35% | 0.70 | 0.69 | 0.31 | +34 | NO | yes | -0.31 | -0.33 |
| 2026-08-03 | GRAB | Commission | 47% | 0.70 | 0.69 | 0.31 | +22 | NO | yes | -0.31 | -0.33 |
| 2026-08-03 | GRAB | Delivery Hero | 10% | 0.23 | 0.22 | 0.78 | +12 | NO | yes | -0.78 | -0.80 |
| 2026-08-03 | GRAB | Foodpanda | 23% | 0.68 | 0.67 | 0.33 | +44 | NO | yes | -0.33 | -0.35 |
| 2026-08-03 | GRAB | GrabMart | 52% | 0.80 | 0.79 | 0.21 | +27 | NO | yes | -0.21 | -0.23 |
| 2026-08-03 | GRAB | Iran / Middle East | 10% | 0.43 | 0.41 | 0.59 | +31 | NO | no | +0.41 | +0.39 |
| 2026-08-03 | GRAB | MAI | 14% | 0.56 | 0.53 | 0.47 | +39 | NO | no | +0.53 | +0.51 |
| 2026-08-03 | GRAB | Stash | 10% | 0.62 | 0.61 | 0.39 | +51 | NO | yes | -0.39 | -0.41 |
| 2026-08-03 | GRAB | Superbank | 23% | 0.95 | 0.94 | 0.06 | +71 | NO | yes | -0.06 | -0.07 |
| 2026-08-03 | GRAB | WeRide | 18% | 0.65 | 0.64 | 0.36 | +46 | NO | no | +0.64 | +0.62 |
| 2026-08-03 | PLTR | Healthcare | 75% | 0.50 | 0.49 | 0.50 | +25 | YES | no | -0.50 | -0.52 |
| 2026-08-03 | PLTR | Iran / Iranian | 13% | 0.27 | 0.26 | 0.74 | +13 | NO | no | +0.26 | +0.24 |
| 2026-08-03 | PLTR | Israel | 32% | 0.44 | 0.43 | 0.57 | +11 | NO | no | +0.43 | +0.41 |
| 2026-08-03 | PLTR | Lethal | 33% | 0.50 | 0.49 | 0.51 | +16 | NO | no | +0.49 | +0.47 |
| 2026-08-03 | PLTR | Nvidia | 6% | 0.42 | 0.41 | 0.59 | +35 | NO | yes | -0.59 | -0.61 |
| 2026-08-03 | PLTR | Slop / AI Slop | 9% | 0.62 | 0.61 | 0.39 | +52 | NO | yes | -0.39 | -0.41 |
| 2026-08-03 | PLTR | Sovereign AI | 6% | 0.65 | 0.63 | 0.37 | +57 | NO | yes | -0.37 | -0.39 |
| 2026-08-03 | PLTR | Warp Speed | 44% | 0.78 | 0.76 | 0.24 | +32 | NO | no | +0.76 | +0.74 |
| 2026-08-03 | SNAP | Game | 56% | 0.82 | 0.81 | 0.19 | +25 | NO | no | +0.81 | +0.79 |
| 2026-08-03 | SNAP | Glasses | 52% | 0.86 | 0.85 | 0.15 | +33 | NO | yes | -0.15 | -0.16 |
| 2026-08-03 | SNAP | Memories Storage | 14% | 0.71 | 0.62 | 0.38 | +48 | NO | yes | -0.38 | -0.40 |
| 2026-08-03 | SNAP | Restructuring | 39% | 0.81 | 0.78 | 0.22 | +39 | NO | yes | -0.22 | -0.24 |
| 2026-08-03 | SNAP | Spectacles | 56% | 0.33 | 0.32 | 0.33 | +23 | YES | no | -0.33 | -0.35 |
| 2026-08-03 | SNAP | Storage | 18% | 0.75 | 0.74 | 0.26 | +56 | NO | yes | -0.26 | -0.28 |
| 2026-08-04 | AMD | Frontier | 25% | 0.37 | 0.36 | 0.64 | +11 | NO | yes | -0.64 | -0.66 |
| 2026-08-04 | AMD | Meta | 17% | 0.65 | 0.64 | 0.36 | +47 | NO | yes | -0.36 | -0.38 |
| 2026-08-04 | AMD | Microsoft / Azure | 75% | 0.89 | 0.88 | 0.12 | +13 | NO | yes | -0.12 | -0.13 |
| 2026-08-04 | MCD | Big Arch | 14% | 0.68 | 0.67 | 0.33 | +53 | NO | no | +0.67 | +0.65 |
| 2026-08-04 | MCD | Delivery | 72% | 0.60 | 0.55 | 0.60 | +12 | YES | yes | +0.40 | +0.38 |
| 2026-08-04 | MCD | Dividend | 65% | 0.18 | 0.17 | 0.18 | +47 | YES | no | -0.18 | -0.20 |
| 2026-08-04 | MCD | Monopoly | 28% | 0.07 | 0.06 | 0.07 | +21 | YES | no | -0.07 | -0.08 |
| 2026-08-04 | MCD | Red Bull | 5% | 0.60 | 0.59 | 0.41 | +54 | NO | yes | -0.41 | -0.43 |
| 2026-08-04 | MCD | Revenue | 47% | 0.30 | 0.29 | 0.30 | +17 | YES | no | -0.30 | -0.32 |
| 2026-08-04 | MCD | Snack Wrap | 16% | 0.57 | 0.56 | 0.44 | +40 | NO | no | +0.56 | +0.54 |
| 2026-08-04 | SPOT | Apple | 65% | 0.36 | 0.35 | 0.36 | +29 | YES | yes | +0.64 | +0.62 |
| 2026-08-04 | SPOT | Claude | 9% | 0.39 | 0.34 | 0.66 | +25 | NO | yes | -0.66 | -0.68 |
| 2026-08-04 | SPOT | Fitness | 7% | 0.55 | 0.54 | 0.46 | +47 | NO | yes | -0.46 | -0.48 |
| 2026-08-04 | SPOT | Monetization | 76% | 0.88 | 0.87 | 0.13 | +11 | NO | yes | -0.13 | -0.14 |
| 2026-08-04 | SPOT | Peloton | 7% | 0.25 | 0.23 | 0.77 | +16 | NO | no | +0.23 | +0.21 |
| 2026-08-04 | TOST | Memory / Chip | 20% | 0.62 | 0.60 | 0.40 | +40 | NO | yes | -0.40 | -0.42 |
| 2026-08-04 | ZETA | Snowflake | 58% | 0.45 | 0.44 | 0.45 | +13 | YES | yes | +0.55 | +0.53 |
| 2026-08-05 | DASH | Autonomous | 35% | 0.75 | 0.73 | 0.27 | +38 | NO | yes | -0.27 | -0.29 |
| 2026-08-05 | DASH | DashMart | 64% | 0.51 | 0.50 | 0.51 | +13 | YES | yes | +0.49 | +0.47 |
| 2026-08-05 | DIS | Box Office | 78% | 0.95 | 0.94 | 0.06 | +16 | NO | yes | -0.06 | -0.07 |
| 2026-08-05 | DIS | International Visitation | 18% | 0.58 | 0.57 | 0.43 | +39 | NO | yes | -0.43 | -0.45 |
| 2026-08-05 | DIS | Moana | 28% | 0.68 | 0.67 | 0.33 | +39 | NO | yes | -0.33 | -0.35 |
| 2026-08-05 | DIS | Toy Story 5 | 6% | 0.85 | 0.84 | 0.16 | +78 | NO | yes | -0.16 | -0.17 |
| 2026-08-05 | DUOL | Chess | 37% | 0.69 | 0.68 | 0.32 | +31 | NO | yes | -0.32 | -0.34 |
| 2026-08-05 | DUOL | Free Trial | 15% | 0.35 | 0.33 | 0.67 | +18 | NO | yes | -0.67 | -0.69 |
| 2026-08-05 | DUOL | Tutor | 37% | 0.60 | 0.59 | 0.41 | +22 | NO | no | +0.59 | +0.57 |
| 2026-08-05 | EBAY | GameStop | 4% | 0.32 | 0.28 | 0.72 | +24 | NO | no | +0.28 | +0.26 |
| 2026-08-05 | EBAY | Klarna | 32% | 0.60 | 0.59 | 0.41 | +27 | NO | yes | -0.41 | -0.43 |
| 2026-08-05 | FIG | Gemini | 51% | 0.27 | 0.26 | 0.27 | +24 | YES | no | -0.27 | -0.29 |
| 2026-08-05 | FIG | Governance Plus | 34% | 0.46 | 0.44 | 0.56 | +10 | NO | no | +0.44 | +0.42 |
| 2026-08-05 | MELI | AI / Artificial Intelligence | 18% | 0.83 | 0.82 | 0.18 | +64 | NO | yes | -0.18 | -0.20 |
| 2026-08-05 | SHOP | Stablecoin | 9% | 0.39 | 0.36 | 0.64 | +27 | NO | no | +0.36 | +0.34 |
| 2026-08-05 | UBER | Drone | 5% | 0.17 | 0.16 | 0.84 | +11 | NO | yes | -0.84 | -0.85 |
| 2026-08-05 | UBER | Expansion | 70% | 0.84 | 0.82 | 0.18 | +12 | NO | no | +0.82 | +0.80 |
| 2026-08-05 | UBER | Market Share | 45% | 0.19 | 0.13 | 0.19 | +26 | YES | no | -0.19 | -0.21 |
| 2026-08-05 | UBER | Nvidia | 14% | 0.57 | 0.54 | 0.46 | +40 | NO | yes | -0.46 | -0.48 |
| 2026-08-05 | UBER | Waymo | 32% | 0.81 | 0.80 | 0.20 | +48 | NO | yes | -0.20 | -0.22 |
| 2026-08-06 | AAOI | Quantum | 21% | 0.45 | 0.44 | 0.56 | +23 | NO | yes | -0.56 | -0.58 |
| 2026-08-06 | ABNB | Boutique | 34% | 0.71 | 0.70 | 0.30 | +36 | NO | yes | -0.30 | -0.32 |
| 2026-08-06 | ABNB | Project Hawaii | 10% | 0.49 | 0.42 | 0.58 | +32 | NO | yes | -0.58 | -0.60 |
| 2026-08-06 | ABNB | World Cup | 26% | 0.86 | 0.85 | 0.15 | +59 | NO | yes | -0.15 | -0.16 |
| 2026-08-06 | LYFT | DoorDash | 23% | 0.70 | 0.69 | 0.31 | +46 | NO | yes | -0.31 | -0.33 |
| 2026-08-06 | LYFT | Revenue | 95% | 0.80 | 0.79 | 0.80 | +15 | YES | no | -0.80 | -0.82 |
| 2026-08-06 | NBIS | Hyperscaler | 53% | 0.80 | 0.79 | 0.21 | +26 | NO | yes | -0.21 | -0.23 |
| 2026-08-07 | DKNG | Feature | 73% | 0.46 | 0.45 | 0.46 | +27 | YES | yes | +0.54 | +0.52 |
| 2026-08-07 | DKNG | Super App | 9% | 0.78 | 0.69 | 0.31 | +60 | NO | yes | -0.31 | -0.33 |
| 2026-08-07 | WEN | Closure | 66% | 0.53 | 0.49 | 0.53 | +13 | YES | yes | +0.47 | +0.45 |
| 2026-08-07 | WEN | Minions | 9% | 0.66 | 0.64 | 0.36 | +55 | NO | yes | -0.36 | -0.38 |
| 2026-08-07 | WEN | Spicy Chicken | 23% | 0.51 | 0.49 | 0.51 | +26 | NO | no | +0.49 | +0.47 |
| 2026-08-10 | HIMS | Canada | 26% | 0.88 | 0.86 | 0.14 | +60 | NO | yes | -0.14 | -0.15 |
| 2026-08-10 | HIMS | Cancer | 22% | 0.43 | 0.42 | 0.58 | +20 | NO | no | +0.42 | +0.40 |
| 2026-08-10 | HIMS | Collaboration | 38% | 0.59 | 0.58 | 0.42 | +20 | NO | yes | -0.42 | -0.44 |
| 2026-08-10 | HIMS | Eucalyptus | 14% | 0.92 | 0.91 | 0.09 | +77 | NO | yes | -0.09 | -0.10 |
| 2026-08-10 | HIMS | Europe | 22% | 0.55 | 0.50 | 0.50 | +28 | NO | yes | -0.50 | -0.52 |
| 2026-08-10 | HIMS | FDA | 34% | 0.85 | 0.82 | 0.18 | +48 | NO | yes | -0.18 | -0.20 |
| 2026-08-10 | HIMS | Lab Testing | 34% | 0.79 | 0.77 | 0.23 | +43 | NO | yes | -0.23 | -0.25 |
| 2026-08-10 | HIMS | Longevity | 38% | 0.79 | 0.78 | 0.22 | +40 | NO | yes | -0.22 | -0.24 |
| 2026-08-10 | HIMS | Microdose / Microdosing | 10% | 0.28 | 0.22 | 0.78 | +12 | NO | no | +0.22 | +0.20 |
| 2026-08-10 | HIMS | Peptide | 30% | 0.96 | 0.95 | 0.05 | +65 | NO | yes | -0.05 | -0.06 |
| 2026-08-10 | HIMS | Testosterone | 38% | 0.97 | 0.96 | 0.04 | +58 | NO | yes | -0.04 | -0.05 |
| 2026-08-10 | HIMS | Vitamin | 30% | 0.57 | 0.53 | 0.47 | +23 | NO | no | +0.53 | +0.51 |
| 2026-08-10 | HIMS | Wearable | 26% | 0.76 | 0.73 | 0.27 | +47 | NO | yes | -0.27 | -0.29 |
| 2026-08-10 | HIMS | Wegovy | 22% | 0.89 | 0.88 | 0.12 | +66 | NO | yes | -0.12 | -0.13 |
| 2026-08-10 | HIMS | YourBio | 14% | 0.57 | 0.54 | 0.46 | +40 | NO | no | +0.54 | +0.52 |
| 2026-08-10 | HIMS | Zava | 22% | 0.72 | 0.70 | 0.30 | +48 | NO | no | +0.70 | +0.68 |
| 2026-08-11 | CAVA | AI / Artificial Intelligence | 62% | 0.85 | 0.84 | 0.16 | +22 | NO | yes | -0.16 | -0.17 |
| 2026-08-11 | CAVA | CavaCore | 10% | 0.71 | 0.70 | 0.30 | +60 | NO | yes | -0.30 | -0.32 |
| 2026-08-11 | CAVA | Cyclospora / Cyclosporiasis | 10% | 0.38 | 0.37 | 0.63 | +27 | NO | yes | -0.63 | -0.65 |
| 2026-08-11 | CAVA | Dining | 69% | 0.34 | 0.33 | 0.34 | +35 | YES | no | -0.34 | -0.36 |
| 2026-08-11 | CAVA | Salmon | 36% | 0.97 | 0.96 | 0.04 | +60 | NO | yes | -0.04 | -0.05 |
| 2026-08-11 | CAVA | Same Store | 23% | 0.08 | 0.07 | 0.08 | +15 | YES | no | -0.08 | -0.09 |
| 2026-08-11 | CAVA | Spice | 43% | 0.66 | 0.65 | 0.35 | +22 | NO | no | +0.65 | +0.63 |
| 2026-08-11 | CRWV | Nvidia (3+ times) | 19% | 0.84 | 0.59 | 0.41 | +40 | NO | yes | -0.41 | -0.43 |
| 2026-08-11 | CRWV | Storage | 78% | 0.95 | 0.93 | 0.07 | +15 | NO | yes | -0.07 | -0.08 |
| 2026-08-13 | AMAT | EPIC Center | 23% | 0.96 | 0.95 | 0.05 | +72 | NO | yes | -0.05 | -0.06 |
| 2026-08-13 | AMAT | Epitaxy | 17% | 0.50 | 0.47 | 0.53 | +30 | NO | yes | -0.53 | -0.55 |
| 2026-08-13 | AMAT | EssilorLuxottica | 3% | 0.50 | 0.45 | 0.55 | +42 | NO | no | +0.45 | +0.43 |
| 2026-08-13 | AMAT | SENZ | 3% | 0.57 | 0.56 | 0.44 | +53 | NO | no | +0.56 | +0.54 |
| 2026-08-13 | AMAT | Singapore | 25% | 0.81 | 0.77 | 0.23 | +52 | NO | yes | -0.23 | -0.25 |
| 2026-08-13 | AMAT | Smart Glasses | 3% | 0.55 | 0.44 | 0.56 | +41 | NO | no | +0.44 | +0.42 |
| 2026-08-13 | AMAT | Supply Chain | 74% | 0.89 | 0.88 | 0.12 | +14 | NO | yes | -0.12 | -0.13 |
| 2026-08-13 | LUNR | AI / Artificial Intelligence | 23% | 0.68 | 0.64 | 0.36 | +41 | NO | no | +0.64 | +0.62 |
| 2026-08-13 | LUNR | Artemis III | 23% | 0.40 | 0.37 | 0.63 | +14 | NO | no | +0.37 | +0.35 |
| 2026-08-13 | LUNR | China / Chinese | 56% | 0.14 | 0.03 | 0.14 | +42 | YES | no | -0.14 | -0.15 |
| 2026-08-13 | LUNR | Goonhilly Earth Station | 23% | 0.93 | 0.76 | 0.24 | +53 | NO | yes | -0.24 | -0.26 |
| 2026-08-13 | LUNR | Mars (3+ times) | 10% | 0.44 | 0.36 | 0.64 | +26 | NO | no | +0.36 | +0.34 |
| 2026-08-13 | LUNR | SpaceX | 49% | 0.18 | 0.08 | 0.18 | +31 | YES | yes | +0.82 | +0.80 |
| 2026-08-13 | YETI | China (3+ times) | 5% | 0.60 | 0.50 | 0.50 | +45 | NO | no | +0.50 | +0.48 |
| 2026-08-13 | YETI | NFL | 27% | 0.63 | 0.50 | 0.50 | +23 | NO | no | +0.50 | +0.48 |
| 2026-08-13 | YETI | Ranger | 17% | 0.69 | 0.68 | 0.32 | +51 | NO | yes | -0.32 | -0.34 |
| 2026-08-13 | YETI | TikTok | 20% | 0.38 | 0.34 | 0.66 | +14 | NO | no | +0.34 | +0.32 |
| 2026-08-18 | AS | Foot Locker | 27% | 0.86 | 0.72 | 0.28 | +45 | NO | yes | -0.28 | -0.30 |
| 2026-08-18 | AS | Oil | 20% | 0.34 | 0.31 | 0.69 | +11 | NO | no | +0.31 | +0.29 |
| 2026-08-18 | AS | Pickleball | 42% | 0.17 | 0.11 | 0.17 | +25 | YES | no | -0.17 | -0.18 |
| 2026-08-18 | AS | REI | 57% | 0.74 | 0.71 | 0.29 | +14 | NO | no | +0.71 | +0.69 |
| 2026-08-18 | AS | Supreme Court | 27% | 0.45 | 0.39 | 0.61 | +12 | NO | no | +0.39 | +0.37 |
| 2026-08-18 | AS | Tariff | 64% | 0.94 | 0.93 | 0.07 | +29 | NO | yes | -0.07 | -0.08 |
| 2026-08-18 | HD | Inflation | 83% | 0.61 | 0.59 | 0.61 | +22 | YES | no | -0.61 | -0.63 |
| 2026-08-18 | HD | Synergy | 8% | 0.39 | 0.35 | 0.65 | +27 | NO | no | +0.35 | +0.33 |
| 2026-08-18 | KLAR | AI / Artificial Intelligence | 58% | 0.74 | 0.72 | 0.28 | +14 | NO | no | +0.72 | +0.70 |
| 2026-08-18 | KLAR | JP Morgan Payment | 39% | 0.77 | 0.64 | 0.36 | +25 | NO | yes | -0.36 | -0.38 |
| 2026-08-18 | KLAR | Southwest Airlines | 22% | 0.46 | 0.45 | 0.55 | +23 | NO | no | +0.45 | +0.43 |
| 2026-08-18 | KLAR | Walmart | 75% | 0.59 | 0.57 | 0.59 | +16 | YES | yes | +0.41 | +0.39 |
| 2026-08-18 | TOL | California | 74% | 0.57 | 0.56 | 0.57 | +17 | YES | no | -0.57 | -0.59 |
| 2026-08-18 | TOL | Land Bank / Land Banking | 60% | 0.75 | 0.74 | 0.26 | +14 | NO | yes | -0.26 | -0.28 |
| 2026-08-18 | TOL | Tariff | 29% | 0.54 | 0.53 | 0.47 | +24 | NO | no | +0.53 | +0.51 |
| 2026-08-19 | TGT | Back to School | 63% | 0.90 | 0.89 | 0.11 | +26 | NO | yes | -0.11 | -0.12 |
| 2026-08-19 | TGT | Nintendo Switch | 17% | 0.71 | 0.70 | 0.30 | +53 | NO | no | +0.70 | +0.68 |
| 2026-08-19 | TGT | Target Plus | 26% | 0.94 | 0.91 | 0.09 | +65 | NO | yes | -0.09 | -0.10 |
| 2026-08-19 | TGT | Revenue | 51% | 0.70 | 0.68 | 0.32 | +17 | NO | yes | -0.32 | -0.34 |
| 2026-08-19 | TGT | Roundel | 33% | 0.88 | 0.87 | 0.13 | +54 | NO | yes | -0.13 | -0.14 |
| 2026-08-19 | TGT | Synthetic Color | 10% | 0.51 | 0.41 | 0.59 | +31 | NO | no | +0.41 | +0.39 |
| 2026-08-19 | TGT | Tariff | 24% | 0.79 | 0.78 | 0.22 | +54 | NO | yes | -0.22 | -0.24 |
| 2026-08-20 | AAP | Advance Reward | 5% | 0.80 | 0.79 | 0.21 | +74 | NO | yes | -0.21 | -0.23 |
| 2026-08-20 | AAP | LIFO | 42% | 0.72 | 0.71 | 0.29 | +29 | NO | yes | -0.29 | -0.31 |
| 2026-08-20 | AAP | Peak Driving | 4% | 0.35 | 0.34 | 0.66 | +30 | NO | no | +0.34 | +0.32 |
| 2026-08-20 | AAP | Tariff | 29% | 0.59 | 0.58 | 0.42 | +29 | NO | yes | -0.42 | -0.44 |
| 2026-08-20 | DE | Efficiency | 48% | 0.59 | 0.58 | 0.42 | +10 | NO | yes | -0.42 | -0.44 |
| 2026-08-20 | DE | Excavator | 26% | 0.51 | 0.50 | 0.50 | +24 | NO | yes | -0.50 | -0.52 |
| 2026-08-20 | DE | Tariff | 28% | 0.98 | 0.97 | 0.03 | +69 | NO | yes | -0.03 | -0.04 |
| 2026-08-20 | FUTU | Agentic | 5% | 0.52 | 0.36 | 0.64 | +31 | NO | no | +0.36 | +0.34 |
| 2026-08-20 | ROST | Flywheel | 14% | 0.47 | 0.42 | 0.58 | +28 | NO | yes | -0.58 | -0.60 |
| 2026-08-20 | ROST | New York | 27% | 0.84 | 0.77 | 0.23 | +50 | NO | no | +0.77 | +0.75 |
| 2026-08-20 | ROST | Self-Checkout | 35% | 0.60 | 0.53 | 0.47 | +18 | NO | no | +0.53 | +0.51 |
| 2026-08-20 | WMT | Competition / Competitor | 66% | 0.45 | 0.44 | 0.45 | +21 | YES | no | -0.45 | -0.47 |
| 2026-08-20 | WMT | Drone | 9% | 0.37 | 0.35 | 0.65 | +26 | NO | no | +0.35 | +0.33 |
| 2026-08-20 | WMT | Omnichannel | 43% | 0.92 | 0.91 | 0.09 | +48 | NO | yes | -0.09 | -0.10 |
| 2026-08-20 | WMT | Tariff | 56% | 0.95 | 0.94 | 0.06 | +38 | NO | yes | -0.06 | -0.07 |
| 2026-08-25 | DKS | Fast Break | 6% | 0.94 | 0.92 | 0.08 | +86 | NO | yes | -0.08 | -0.09 |
| 2026-08-25 | DKS | Going Going Gone | 3% | 0.25 | 0.23 | 0.77 | +20 | NO | no | +0.23 | +0.21 |
| 2026-08-25 | DKS | Sport and Culture | 13% | 0.80 | 0.76 | 0.24 | +63 | NO | yes | -0.24 | -0.26 |
| 2026-08-25 | DKS | World Cup | 23% | 0.89 | 0.88 | 0.12 | +65 | NO | yes | -0.12 | -0.13 |
| 2026-08-25 | INTU | Agentic | 12% | 0.50 | 0.48 | 0.52 | +36 | NO | yes | -0.52 | -0.54 |
| 2026-08-25 | INTU | ARPU | 40% | 0.66 | 0.60 | 0.40 | +20 | NO | no | +0.60 | +0.58 |
| 2026-08-25 | INTU | Investor Day | 80% | 0.92 | 0.91 | 0.09 | +11 | NO | yes | -0.09 | -0.10 |
| 2026-08-25 | INTU | Pro Tax | 27% | 0.88 | 0.86 | 0.14 | +59 | NO | no | +0.86 | +0.85 |
| 2026-08-25 | INTU | Restructuring | 14% | 0.81 | 0.80 | 0.20 | +66 | NO | no | +0.80 | +0.78 |
| 2026-08-25 | INTU | TurboTax Live | 64% | 0.88 | 0.83 | 0.17 | +19 | NO | yes | -0.17 | -0.18 |
| 2026-08-25 | ZM | Agentic | 23% | 0.90 | 0.84 | 0.16 | +61 | NO | yes | -0.16 | -0.17 |
| 2026-08-25 | ZM | Scribe | 8% | 0.32 | 0.31 | 0.69 | +23 | NO | no | +0.31 | +0.29 |
| 2026-08-25 | ZM | System of Action | 17% | 0.88 | 0.86 | 0.14 | +69 | NO | yes | -0.14 | -0.15 |
| 2026-08-26 | CRM | MuleSoft | 51% | 0.89 | 0.88 | 0.12 | +37 | NO | yes | -0.12 | -0.13 |
| 2026-08-26 | CRM | Slackbot | 7% | 0.84 | 0.83 | 0.17 | +76 | NO | yes | -0.17 | -0.18 |
| 2026-08-26 | CRM | Tableau | 44% | 0.90 | 0.89 | 0.11 | +45 | NO | no | +0.89 | +0.88 |
| 2026-08-26 | CRWD | AI Detection | 14% | 0.56 | 0.55 | 0.45 | +41 | NO | no | +0.55 | +0.53 |
| 2026-08-26 | NVDA | Cosmos | 10% | 0.71 | 0.70 | 0.30 | +60 | NO | yes | -0.30 | -0.32 |
| 2026-08-26 | NVDA | Dividend (2+ times) | 2% | 0.26 | 0.25 | 0.75 | +23 | NO | no | +0.25 | +0.23 |
| 2026-08-26 | NVDA | Gaming | 90% | 0.67 | 0.66 | 0.67 | +23 | YES | no | -0.67 | -0.69 |
| 2026-08-26 | NVDA | Hyperscaler | 43% | 0.99 | 0.98 | 0.02 | +55 | NO | yes | -0.02 | -0.03 |
| 2026-08-26 | NVDA | Omniverse | 34% | 0.63 | 0.60 | 0.40 | +26 | NO | yes | -0.40 | -0.42 |
| 2026-08-26 | NVDA | Talent | 10% | 0.27 | 0.26 | 0.74 | +16 | NO | no | +0.26 | +0.24 |
| 2026-08-26 | URBN | Back to School | 29% | 0.74 | 0.71 | 0.29 | +42 | NO | yes | -0.29 | -0.31 |
| 2026-08-26 | URBN | Claude | 4% | 0.18 | 0.14 | 0.86 | +10 | NO | no | +0.14 | +0.13 |
| 2026-08-26 | URBN | Gemini | 4% | 0.19 | 0.17 | 0.83 | +13 | NO | no | +0.17 | +0.16 |
| 2026-08-26 | URBN | Holiday | 76% | 0.62 | 0.61 | 0.62 | +14 | YES | yes | +0.38 | +0.36 |
| 2026-08-26 | URBN | International / Internationally | 71% | 0.58 | 0.57 | 0.58 | +13 | YES | yes | +0.42 | +0.40 |
| 2026-08-26 | URBN | Middle East | 12% | 0.36 | 0.35 | 0.65 | +23 | NO | yes | -0.65 | -0.67 |
| 2026-08-26 | URBN | Refund | 4% | 0.94 | 0.93 | 0.07 | +89 | NO | yes | -0.07 | -0.08 |
| 2026-08-26 | URBN | Store Opening | 46% | 0.63 | 0.62 | 0.38 | +16 | NO | no | +0.62 | +0.60 |
| 2026-08-26 | URBN | Supply Chain | 53% | 0.28 | 0.26 | 0.28 | +25 | YES | yes | +0.72 | +0.70 |
| 2026-08-27 | MRVL | Celestial | 7% | 0.85 | 0.84 | 0.16 | +77 | NO | yes | -0.16 | -0.17 |
| 2026-08-27 | MRVL | Inference | 25% | 0.75 | 0.73 | 0.27 | +48 | NO | yes | -0.27 | -0.29 |
| 2026-08-27 | MRVL | Nvidia | 21% | 0.82 | 0.79 | 0.21 | +58 | NO | yes | -0.21 | -0.23 |
| 2026-08-27 | MRVL | Photonic Fabric | 7% | 0.78 | 0.77 | 0.23 | +70 | NO | yes | -0.23 | -0.25 |
| 2026-08-27 | MRVL | Polariton | 5% | 0.39 | 0.38 | 0.62 | +33 | NO | no | +0.38 | +0.36 |
| 2026-08-27 | MRVL | Prepayment | 7% | 0.69 | 0.67 | 0.33 | +60 | NO | yes | -0.33 | -0.35 |
| 2026-08-27 | MRVL | Scale Across | 9% | 0.85 | 0.84 | 0.16 | +75 | NO | yes | -0.16 | -0.17 |
| 2026-08-27 | MRVL | Storage | 89% | 0.71 | 0.70 | 0.71 | +18 | YES | yes | +0.29 | +0.27 |
| 2026-08-27 | MRVL | Xconn | 7% | 0.70 | 0.68 | 0.32 | +61 | NO | no | +0.68 | +0.66 |
| 2026-08-27 | ULTA | AI / Artificial Intelligence | 35% | 0.91 | 0.90 | 0.10 | +55 | NO | yes | -0.10 | -0.11 |
| 2026-08-27 | ULTA | Diamond | 44% | 0.25 | 0.24 | 0.25 | +19 | YES | no | -0.25 | -0.27 |
| 2026-08-27 | ULTA | Google / Gemini | 18% | 0.37 | 0.36 | 0.64 | +18 | NO | yes | -0.64 | -0.66 |
| 2026-08-27 | ULTA | Headwind | 72% | 0.34 | 0.26 | 0.34 | +38 | YES | yes | +0.66 | +0.64 |
| 2026-08-27 | ULTA | Tailwind | 43% | 0.17 | 0.12 | 0.17 | +26 | YES | no | -0.17 | -0.18 |
| 2026-08-27 | ULTA | Tariff | 23% | 0.37 | 0.36 | 0.64 | +13 | NO | no | +0.36 | +0.34 |
| 2026-08-27 | ULTA | TikTok | 52% | 0.83 | 0.81 | 0.19 | +29 | NO | yes | -0.19 | -0.21 |
| 2026-08-27 | ULTA | Times Square | 10% | 0.34 | 0.29 | 0.71 | +19 | NO | no | +0.29 | +0.27 |
| 2026-08-27 | ULTA | Traffic | 80% | 0.62 | 0.59 | 0.62 | +18 | YES | yes | +0.38 | +0.36 |
| 2026-08-27 | ULTA | Uncertainty | 56% | 0.95 | 0.94 | 0.06 | +38 | NO | yes | -0.06 | -0.07 |
| 2026-09-01 | MDT | China | 75% | 0.62 | 0.61 | 0.62 | +13 | YES | no | -0.62 | -0.64 |
| 2026-09-01 | MDT | PulseSelect | 57% | 0.26 | 0.25 | 0.26 | +31 | YES | yes | +0.74 | +0.72 |
| 2026-09-01 | MDT | Tariff | 67% | 0.94 | 0.93 | 0.07 | +26 | NO | yes | -0.07 | -0.08 |
| 2026-09-01 | PANW | Cortex Cloud | 58% | 0.79 | 0.78 | 0.22 | +20 | NO | no | +0.78 | +0.76 |
| 2026-09-02 | AVGO | Ethernet | 53% | 0.79 | 0.77 | 0.23 | +24 | NO | yes | -0.23 | -0.25 |
| 2026-09-02 | AVGO | Jericho 4 | 7% | 0.46 | 0.45 | 0.55 | +38 | NO | no | +0.45 | +0.43 |
| 2026-09-02 | AVGO | Open Source | 7% | 0.27 | 0.25 | 0.75 | +18 | NO | no | +0.25 | +0.23 |
| 2026-09-02 | AVGO | OpenAI | 9% | 0.96 | 0.94 | 0.06 | +85 | NO | yes | -0.06 | -0.07 |
| 2026-09-02 | AVGO | Optic | 53% | 0.39 | 0.38 | 0.39 | +14 | YES | no | -0.39 | -0.41 |
| 2026-09-02 | AVGO | Tomahawk 6 | 20% | 0.76 | 0.75 | 0.25 | +55 | NO | yes | -0.25 | -0.27 |
| 2026-09-02 | HPE | Automation | 52% | 0.70 | 0.69 | 0.31 | +17 | NO | no | +0.69 | +0.67 |
| 2026-09-02 | HPE | Department of Energy | 39% | 0.17 | 0.16 | 0.17 | +22 | YES | no | -0.17 | -0.18 |
| 2026-09-02 | HPE | Government | 39% | 0.59 | 0.58 | 0.42 | +19 | NO | no | +0.58 | +0.56 |
| 2026-09-02 | HPE | Headwind | 85% | 0.54 | 0.53 | 0.54 | +31 | YES | no | -0.54 | -0.56 |
| 2026-09-02 | HPE | Self Driving | 6% | 0.90 | 0.89 | 0.11 | +83 | NO | yes | -0.11 | -0.12 |
| 2026-09-02 | HPE | Tailwind | 39% | 0.53 | 0.52 | 0.48 | +13 | NO | no | +0.52 | +0.50 |
| 2026-09-02 | SNOW | Europe | 59% | 0.43 | 0.42 | 0.43 | +16 | YES | no | -0.43 | -0.45 |
| 2026-09-02 | SNOW | OpenAI | 28% | 0.68 | 0.65 | 0.35 | +37 | NO | yes | -0.35 | -0.37 |
| 2026-09-02 | SNOW | Snowflake Intelligence | 28% | 0.59 | 0.58 | 0.42 | +30 | NO | no | +0.58 | +0.56 |
| 2026-09-03 | CIEN | Tariff | 66% | 0.33 | 0.32 | 0.33 | +33 | YES | yes | +0.67 | +0.65 |
| 2026-09-08 | ORCL | AMD | 10% | 0.49 | 0.42 | 0.58 | +32 | NO | no | +0.42 | +0.40 |
| 2026-09-08 | ORCL | Backlog | 31% | 0.49 | 0.42 | 0.58 | +11 | NO | no | +0.42 | +0.40 |
| 2026-09-08 | ORCL | OpenAI | 14% | 0.37 | 0.31 | 0.69 | +17 | NO | yes | -0.69 | -0.71 |
| 2026-09-09 | CHWY | Chewy+ / Chewy Plus | 37% | 0.76 | 0.69 | 0.31 | +32 | NO | yes | -0.31 | -0.33 |
| 2026-09-09 | CHWY | Loyalty | 66% | 0.41 | 0.37 | 0.41 | +25 | YES | yes | +0.59 | +0.57 |
| 2026-09-10 | ADBE | 3D | 51% | 0.69 | 0.67 | 0.33 | +16 | NO | yes | -0.33 | -0.35 |
| 2026-09-10 | ADBE | Anthropic | 5% | 0.67 | 0.66 | 0.34 | +61 | NO | no | +0.66 | +0.64 |
| 2026-09-10 | ADBE | Generative AI / Gen AI | 25% | 0.59 | 0.54 | 0.46 | +29 | NO | no | +0.54 | +0.52 |
| 2026-09-10 | ADBE | LLM Optimizer | 9% | 0.59 | 0.57 | 0.43 | +48 | NO | yes | -0.43 | -0.45 |
| 2026-09-10 | M | Amazon | 15% | 0.49 | 0.48 | 0.52 | +33 | NO | no | +0.48 | +0.46 |
| 2026-09-10 | M | Dividend | 84% | 0.98 | 0.97 | 0.03 | +13 | NO | yes | -0.03 | -0.04 |
| 2026-09-11 | KR | AI | 46% | 0.95 | 0.94 | 0.06 | +48 | NO | no | +0.94 | +0.93 |
| 2026-09-22 | AZO | 8000 / 8k | 3% | 0.82 | 0.81 | 0.19 | +78 | NO | yes | -0.19 | -0.21 |
| 2026-09-22 | AZO | Tariff | 43% | 0.85 | 0.84 | 0.16 | +41 | NO | yes | -0.16 | -0.17 |
| 2026-09-22 | AZO | Tax Refund | 59% | 0.21 | 0.20 | 0.21 | +38 | YES | no | -0.21 | -0.23 |

*The baseline is the raw transcript one from `generate_earnings_report.word_baseline`: the word's prior-call frequency blended with a transition prior on whether the most recent call said it. It is not recalibrated here.*
