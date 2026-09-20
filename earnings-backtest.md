# Earnings Backtest

Generated 2026-09-19

## Strategy

For each finalized word market: a transcript baseline P is computed from calls before the event; an isotonic recalibration of P(word said) (fit on train markets only) is also evaluated as an experiment — see the Temporal holdout table for the verdict. The baseline is compared to the executable price at the 24h-before-close lead (the last traded hourly candle at or before close − 24h; the YES ask/bid where orderbook data exists). Bet the undervalued side: YES when baseline > YES price, NO when 1 − baseline > NO price; skip when neither side is undervalued; settle at the actual resolution. Gap = edge on the chosen side.

## Coverage

- 5598 finalized markets with history fetched
- 5282 with a price at the 24h lead (close − {lead}h)
- 5136 with a transcript baseline (pre-event calls)
- 5114 tradable (both price and baseline)
- fee: 3% on profit

- 330 trades use day-less event tickers (e.g. -25MAY) whose call date is approximated as the 1st of the month

- 3519 train markets with a baseline (train = closing before 2026-07-01)
- 1617 test markets with a baseline (test = closing on/after 2026-07-01)

## Threshold sweep (min |gap|, raw baseline)

Net if always YES / always NO shows the same candidates traded on one fixed side — the benchmark the side selection must beat. See Temporal holdout for the out-of-sample view.

| Min \|gap\| | Trades | Wins | Win rate | Gross | Net | YES (n/wins/net) | NO (n/wins/net) | Always YES | Always NO |
|---|---|---|---|---|---|---|---|---|---|
| 0.00 | 5114 | 2201 | 43% | +275.02 | +246.46 | 1234 / 521 / +8.89 | 3880 / 1680 / +237.56 | -264.99 | +216.12 |
| 0.05 | 4254 | 1783 | 42% | +271.72 | +246.51 | 879 / 344 / +12.08 | 3375 / 1439 / +234.43 | -255.05 | +212.78 |
| 0.10 | 3551 | 1424 | 40% | +242.01 | +220.37 | 652 / 241 / +18.74 | 2899 / 1183 / +201.63 | -211.77 | +175.75 |
| 0.15 | 2985 | 1103 | 37% | +192.16 | +174.05 | 489 / 171 / +18.92 | 2496 / 932 / +155.12 | -161.23 | +130.76 |
| 0.20 | 2529 | 868 | 34% | +162.60 | +147.30 | 345 / 112 / +14.86 | 2184 / 756 / +132.44 | -139.51 | +113.79 |
| 0.25 | 2156 | 693 | 32% | +142.13 | +129.28 | 252 / 76 / +12.01 | 1904 / 617 / +117.27 | -124.12 | +102.69 |
| 0.30 | 1814 | 535 | 29% | +112.84 | +102.42 | 170 / 44 / +7.25 | 1644 / 491 / +95.17 | -103.78 | +86.33 |

## Temporal holdout

Same strategy evaluated on each side of the cutoff (2026-07-01), with and without calibration. The calibration is always fit on train only, so the test rows are fully out-of-sample.

| Min \|gap\| | Split | Calibrated | Trades | Wins | Win rate | Net |
|---|---|---|---|---|---|---|
| 0.00 | train | no | 3511 | 1466 | 42% | +188.11 |
| 0.05 | train | no | 2919 | 1194 | 41% | +188.77 |
| 0.10 | train | no | 2451 | 974 | 40% | +176.97 |
| 0.15 | train | no | 2045 | 751 | 37% | +148.79 |
| 0.20 | train | no | 1746 | 599 | 34% | +128.77 |
| 0.25 | train | no | 1505 | 483 | 32% | +111.66 |
| 0.30 | train | no | 1275 | 372 | 29% | +85.71 |
| 0.00 | train | yes | 3511 | 1095 | 31% | +72.51 |
| 0.05 | train | yes | 2939 | 831 | 28% | +74.13 |
| 0.10 | train | yes | 2372 | 621 | 26% | +75.78 |
| 0.15 | train | yes | 1958 | 468 | 24% | +62.41 |
| 0.20 | train | yes | 1570 | 337 | 21% | +47.11 |
| 0.25 | train | yes | 1244 | 239 | 19% | +29.17 |
| 0.30 | train | yes | 913 | 159 | 17% | +21.98 |
| 0.00 | test | no | 1603 | 735 | 46% | +58.35 |
| 0.05 | test | no | 1335 | 589 | 44% | +57.74 |
| 0.10 | test | no | 1100 | 450 | 41% | +43.40 |
| 0.15 | test | no | 940 | 352 | 37% | +25.26 |
| 0.20 | test | no | 783 | 269 | 34% | +18.53 |
| 0.25 | test | no | 651 | 210 | 32% | +17.63 |
| 0.30 | test | no | 539 | 163 | 30% | +16.71 |
| 0.00 | test | yes | 1603 | 498 | 31% | -2.33 |
| 0.05 | test | yes | 1365 | 396 | 29% | +6.53 |
| 0.10 | test | yes | 1137 | 306 | 27% | +7.70 |
| 0.15 | test | yes | 936 | 237 | 25% | +8.38 |
| 0.20 | test | yes | 739 | 188 | 25% | +18.98 |
| 0.25 | test | yes | 572 | 143 | 25% | +19.42 |
| 0.30 | test | yes | 414 | 91 | 22% | +12.15 |

## Edge by entry time (raw baseline, min |gap| 0.10)

Same strategy entered at different horizons: at each lead the entry price is the last traded hourly candle at or before close − lead hours (markets that were not live or untraded that far out have no price and drop out — see With price). Train/test are the temporal split above (closing before/after 2026-07-01); test is out-of-sample. The headline rows are lead 24h.

| Lead (h) | With price | Tradable | Train trades | Train net | Test trades | Test wins | Win rate | Test net |
|---|---|---|---|---|---|---|---|---|
| 1 | 5569 | 5384 | 2824 | +12.50 | 1225 | 197 | 16% | +17.58 |
| 3 | 5563 | 5377 | 2724 | +90.59 | 1158 | 355 | 31% | +44.50 |
| 6 | 5561 | 5375 | 2665 | +116.93 | 1157 | 402 | 35% | +42.41 |
| 12 | 5541 | 5356 | 2677 | +125.01 | 1146 | 407 | 36% | +41.36 |
| 18 | 5456 | 5272 | 2610 | +148.64 | 1127 | 458 | 41% | +53.38 |
| **24** | 5282 | 5114 | 2451 | +176.97 | 1100 | 450 | 41% | +43.40 |
| 36 | 5068 | 4898 | 2337 | +170.61 | 1079 | 445 | 41% | +40.42 |
| 48 | 4833 | 4678 | 2212 | +184.03 | 1063 | 459 | 43% | +45.21 |
| 72 | 4394 | 4254 | 2004 | +145.72 | 1025 | 462 | 45% | +54.74 |
| 96 | 4162 | 4032 | 1863 | +145.03 | 1006 | 460 | 46% | +58.88 |

## Per company (min |gap| 0.10)

| Company | Trades | Wins | Net |
|---|---|---|---|
| AAL | 29 | 14 | +2.77 |
| AAOI | 10 | 1 | -2.81 |
| AAP | 11 | 4 | -0.84 |
| AAPL | 79 | 35 | +4.05 |
| ABNB | 26 | 10 | +2.08 |
| ACI | 8 | 3 | +0.06 |
| ADBE | 37 | 17 | +5.27 |
| ALK | 13 | 8 | +2.02 |
| ALLY | 12 | 7 | +1.68 |
| AMAT | 12 | 4 | -0.12 |
| AMC | 17 | 4 | +2.08 |
| AMD | 38 | 4 | -3.03 |
| AMZN | 103 | 33 | +2.36 |
| AS | 11 | 5 | +1.27 |
| ASTS | 6 | 3 | +0.04 |
| AVAV | 9 | 4 | -0.20 |
| AVGO | 38 | 11 | -0.18 |
| AXP | 23 | 8 | -0.48 |
| BA | 14 | 9 | +2.73 |
| BAC | 36 | 12 | +2.00 |
| BJ | 4 | 2 | +0.07 |
| BLK | 10 | 5 | +3.09 |
| BULL | 20 | 9 | +1.85 |
| C | 16 | 4 | -0.64 |
| CAR | 8 | 5 | +0.98 |
| CAVA | 28 | 6 | -3.06 |
| CBRL | 15 | 6 | -0.38 |
| CCL | 6 | 0 | -1.58 |
| CELH | 22 | 11 | +2.20 |
| CHWY | 22 | 9 | +3.23 |
| CIEN | 7 | 2 | +0.57 |
| CMG | 40 | 16 | +3.67 |
| COHR | 10 | 1 | -2.36 |
| COINBASE | 16 | 3 | -0.21 |
| COST | 39 | 9 | +0.05 |
| CRCL | 14 | 5 | +1.74 |
| CRM | 27 | 8 | +1.92 |
| CRWD | 36 | 12 | +1.56 |
| CRWV | 15 | 6 | +2.13 |
| CVNA | 22 | 14 | +2.59 |
| DAL | 23 | 9 | +1.94 |
| DASH | 15 | 9 | +2.03 |
| DE | 36 | 13 | +0.81 |
| DELL | 38 | 19 | +4.04 |
| DIS | 64 | 27 | +2.77 |
| DKNG | 28 | 13 | +1.16 |
| DKS | 9 | 2 | +0.45 |
| DPZ | 32 | 20 | +4.56 |
| DUOL | 6 | 4 | +0.48 |
| EA | 10 | 0 | -0.10 |
| EBAY | 12 | 3 | -1.80 |
| F | 20 | 9 | +0.35 |
| FDX | 25 | 9 | -0.08 |
| FIG | 8 | 2 | -0.28 |
| FUTU | 11 | 9 | +3.26 |
| GEV | 20 | 6 | +2.43 |
| GIS | 8 | 4 | +1.59 |
| GME | 2 | 0 | -0.56 |
| GOOGL | 73 | 30 | +6.75 |
| GRAB | 13 | 4 | -0.99 |
| GS | 27 | 12 | +2.65 |
| HD | 22 | 13 | +4.70 |
| HIMS | 53 | 18 | +2.72 |
| HLT | 9 | 6 | +1.88 |
| HOOD | 42 | 6 | -6.92 |
| HPE | 32 | 11 | -0.31 |
| INTC | 40 | 15 | +3.83 |
| INTU | 10 | 3 | +1.22 |
| JNJ | 30 | 10 | +0.88 |
| JPM | 42 | 13 | +3.03 |
| KLAR | 20 | 14 | +8.68 |
| KO | 20 | 11 | +4.15 |
| KR | 35 | 16 | +5.26 |
| KTOS | 5 | 2 | -0.19 |
| LEVI | 21 | 10 | +0.86 |
| LLY | 24 | 13 | +3.56 |
| LMT | 2 | 1 | +0.84 |
| LOW | 6 | 3 | +0.97 |
| LUCID | 8 | 3 | +0.29 |
| LULU | 17 | 8 | +1.84 |
| LUNR | 9 | 4 | +0.39 |
| LYFT | 32 | 14 | +1.98 |
| M | 18 | 7 | -0.26 |
| MCD | 50 | 24 | +5.79 |
| MDT | 7 | 1 | -0.49 |
| MELI | 10 | 7 | +2.14 |
| META | 76 | 36 | +11.12 |
| MRVL | 32 | 13 | +1.74 |
| MS | 19 | 11 | +2.51 |
| MSFT | 68 | 18 | -1.93 |
| MSTR | 10 | 0 | -1.47 |
| MTN | 11 | 6 | +1.32 |
| MU | 32 | 12 | +0.40 |
| NBIS | 32 | 13 | +4.63 |
| NFLX | 67 | 25 | +1.61 |
| NKE | 37 | 11 | -0.75 |
| NVDA | 87 | 36 | +7.69 |
| OKLO | 4 | 1 | +0.14 |
| ON | 13 | 7 | +1.31 |
| ORCL | 49 | 24 | +5.86 |
| PANW | 9 | 1 | -1.03 |
| PEP | 42 | 22 | +3.00 |
| PG | 18 | 8 | +1.17 |
| PGR | 16 | 9 | +3.65 |
| PLTR | 68 | 24 | +4.59 |
| PSKY | 8 | 1 | -0.84 |
| PYPL | 46 | 27 | +4.69 |
| RDDT | 24 | 9 | +1.86 |
| RIVN | 7 | 2 | -0.40 |
| RKLB | 15 | 5 | +0.19 |
| ROKU | 16 | 10 | +2.84 |
| ROST | 8 | 5 | +1.34 |
| SBUX | 45 | 23 | +3.75 |
| SFM | 3 | 2 | +0.99 |
| SHOP | 21 | 10 | +2.76 |
| SNAP | 26 | 8 | -0.06 |
| SNOW | 27 | 14 | +2.86 |
| SPOT | 28 | 20 | +6.62 |
| STZ | 27 | 16 | +4.26 |
| TFC | 8 | 5 | +1.76 |
| TGT | 29 | 14 | +4.09 |
| TLN | 9 | 3 | +1.26 |
| TOL | 17 | 3 | -3.06 |
| TOST | 7 | 2 | -0.22 |
| TSLA | 99 | 34 | +3.39 |
| TTWO | 10 | 5 | +0.73 |
| UAL | 44 | 14 | +0.43 |
| UBER | 79 | 28 | +5.74 |
| ULTA | 42 | 15 | +1.14 |
| URBN | 18 | 8 | +0.72 |
| V | 17 | 10 | +3.32 |
| VSCO | 22 | 5 | -2.05 |
| VST | 12 | 2 | -1.65 |
| VZ | 20 | 10 | -0.27 |
| WEN | 18 | 8 | +0.11 |
| WFC | 31 | 10 | +0.74 |
| WING | 19 | 10 | +2.44 |
| WMT | 56 | 20 | +4.96 |
| YETI | 8 | 5 | +2.18 |
| YOU | 12 | 7 | +1.56 |
| YUM | 12 | 5 | +0.13 |
| ZETA | 10 | 4 | -0.36 |
| ZM | 8 | 2 | +0.38 |

## Trades (min |gap| 0.10)

| Event | Company | Word | Prior | Last | Baseline | Price | Gap | Side | Result | Gross | Net |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2025-03-01 | FDX | Global trade | 24/49 | ❌ | 48% | 0.39 | +13 | NO | yes | -0.39 | -0.39 |
| 2025-03-01 | FDX | Inventory | 37/49 | ✅ | 74% | 0.15 | +11 | NO | yes | -0.15 | -0.15 |
| 2025-03-01 | FDX | Labor | 26/49 | ❌ | 52% | 0.37 | +15 | YES | no | -0.37 | -0.37 |
| 2025-03-01 | FDX | Last-mile / Last mile | 27/49 | ❌ | 54% | 0.26 | +20 | NO | no | +0.74 | +0.72 |
| 2025-03-01 | FDX | Tariff | 13/49 | ✅ | 29% | 0.11 | +60 | NO | yes | -0.11 | -0.11 |
| 2025-03-01 | FDX | TNT Express | 18/49 | ❌ | 37% | 0.06 | +31 | YES | no | -0.06 | -0.06 |
| 2025-03-01 | FDX | Trade war | 4/49 | ❌ | 10% | 0.76 | +14 | NO | no | +0.24 | +0.23 |
| 2025-03-01 | MU | AI / Artificial Intelligence | 30/58 | ✅ | 52% | 0.04 | +44 | NO | yes | -0.04 | -0.04 |
| 2025-03-01 | MU | China | 35/58 | ✅ | 60% | 0.09 | +31 | NO | yes | -0.09 | -0.09 |
| 2025-03-01 | MU | Cloud | 47/58 | ✅ | 80% | 0.68 | +12 | YES | no | -0.68 | -0.68 |
| 2025-03-01 | MU | Data Center | 49/58 | ✅ | 83% | 0.02 | +15 | NO | yes | -0.02 | -0.02 |
| 2025-03-01 | MU | DRAM Pricing | 24/58 | ❌ | 41% | 0.15 | +26 | YES | no | -0.15 | -0.15 |
| 2025-03-01 | MU | Memory cycle | 1/58 | ❌ | 4% | 0.82 | +14 | NO | no | +0.18 | +0.17 |
| 2025-03-01 | MU | NAND flash | 21/58 | ❌ | 36% | 0.18 | +18 | YES | no | -0.18 | -0.18 |
| 2025-03-01 | NKE | Athleisure | 4/58 | ❌ | 9% | 0.77 | +14 | NO | no | +0.23 | +0.22 |
| 2025-03-01 | NKE | Direct-to-consumer / Direct to consumer / DTC / D2C | 41/58 | ❌ | 68% | 0.40 | +28 | YES | no | -0.40 | -0.40 |
| 2025-03-01 | NKE | Jordan | 51/58 | ✅ | 86% | 0.02 | +12 | NO | yes | -0.02 | -0.02 |
| 2025-03-01 | NKE | SNKRS app | 24/58 | ❌ | 41% | 0.23 | +18 | YES | no | -0.23 | -0.23 |
| 2025-03-01 | NKE | Supply chain | 51/58 | ✅ | 86% | 0.03 | +11 | NO | yes | -0.03 | -0.03 |
| 2025-03-01 | NKE | Sustainability | 31/58 | ❌ | 52% | 0.26 | +26 | YES | no | -0.26 | -0.26 |
| 2025-05-01 | AAPL | Apple Intelligence | 2/55 | ✅ | 7% | 0.05 | +88 | NO | yes | -0.05 | -0.05 |
| 2025-05-01 | AAPL | Apple silicon | 12/55 | ✅ | 24% | 0.27 | +49 | NO | yes | -0.27 | -0.27 |
| 2025-05-01 | AAPL | App Store margin | 0/55 | ❌ | 3% | 0.85 | +12 | NO | no | +0.15 | +0.15 |
| 2025-05-01 | AAPL | Battery life | 17/55 | ✅ | 33% | 0.51 | +16 | NO | yes | -0.51 | -0.51 |
| 2025-05-01 | AAPL | China | 55/55 | ✅ | 97% | 0.85 | +12 | YES | yes | +0.15 | +0.15 |
| 2025-05-01 | AAPL | Chipset | 1/55 | ❌ | 4% | 0.78 | +18 | NO | no | +0.22 | +0.21 |
| 2025-05-01 | AAPL | Ecosystem | 52/55 | ❌ | 91% | 0.69 | +22 | YES | yes | +0.31 | +0.30 |
| 2025-05-01 | AAPL | India / Indian | 41/55 | ✅ | 73% | 0.14 | +13 | NO | yes | -0.14 | -0.14 |
| 2025-05-01 | AAPL | MacBook | 48/55 | ✅ | 85% | 0.03 | +12 | NO | yes | -0.03 | -0.03 |
| 2025-05-01 | AAPL | Regulation / Regulator / Regulatory | 15/55 | ✅ | 29% | 0.47 | +24 | NO | no | +0.53 | +0.51 |
| 2025-05-01 | AAPL | Retail footprint | 2/55 | ❌ | 6% | 0.84 | +10 | NO | no | +0.16 | +0.16 |
| 2025-05-01 | AAPL | Satellite | 7/55 | ❌ | 14% | 0.58 | +28 | NO | no | +0.42 | +0.41 |
| 2025-05-01 | AAPL | Supply chain | 38/55 | ✅ | 68% | 0.13 | +19 | NO | yes | -0.13 | -0.13 |
| 2025-05-01 | AAPL | Trump | 0/55 | ✅ | 4% | 0.71 | +25 | NO | no | +0.29 | +0.28 |
| 2025-05-01 | AAPL | Vision Pro | 6/55 | ✅ | 14% | 0.13 | +73 | NO | yes | -0.13 | -0.13 |
| 2025-05-01 | AAPL | Wearables | 31/55 | ✅ | 57% | 0.12 | +31 | NO | yes | -0.12 | -0.12 |
| 2025-05-01 | AMZN | Alexa | 23/58 | ✅ | 41% | 0.12 | +47 | NO | yes | -0.12 | -0.12 |
| 2025-05-01 | AMZN | Content | 49/58 | ❌ | 81% | 0.68 | +13 | YES | yes | +0.32 | +0.31 |
| 2025-05-01 | AMZN | Data center | 21/58 | ✅ | 38% | 0.08 | +54 | NO | yes | -0.08 | -0.08 |
| 2025-05-01 | AMZN | Fulfillment network | 28/58 | ✅ | 49% | 0.05 | +46 | NO | yes | -0.05 | -0.05 |
| 2025-05-01 | AMZN | Grocery delivery | 12/58 | ✅ | 23% | 0.28 | +49 | NO | no | +0.72 | +0.70 |
| 2025-05-01 | AMZN | Inflation | 15/58 | ✅ | 28% | 0.10 | +62 | NO | yes | -0.10 | -0.10 |
| 2025-05-01 | AMZN | Inventory management | 0/58 | ✅ | 4% | 0.77 | +19 | NO | no | +0.23 | +0.22 |
| 2025-05-01 | AMZN | Labor costs | 2/58 | ❌ | 6% | 0.78 | +16 | NO | no | +0.22 | +0.21 |
| 2025-05-01 | AMZN | Pharmaceutical / Pharma | 1/58 | ❌ | 4% | 0.76 | +20 | NO | no | +0.24 | +0.23 |
| 2025-05-01 | AMZN | Prime Day | 26/58 | ✅ | 46% | 0.38 | +16 | NO | yes | -0.38 | -0.38 |
| 2025-05-01 | AMZN | Prime Video | 36/58 | ✅ | 62% | 0.05 | +33 | NO | yes | -0.05 | -0.05 |
| 2025-05-01 | AMZN | Regulator / Regulation | 3/58 | ❌ | 7% | 0.50 | +43 | NO | no | +0.50 | +0.48 |
| 2025-05-01 | AMZN | Robotics | 12/58 | ✅ | 23% | 0.14 | +63 | NO | yes | -0.14 | -0.14 |
| 2025-05-01 | AMZN | Subscription | 26/58 | ❌ | 44% | 0.26 | +30 | NO | no | +0.74 | +0.72 |
| 2025-05-01 | AMZN | Trump | 1/58 | ❌ | 4% | 0.81 | +15 | NO | no | +0.19 | +0.18 |
| 2025-05-01 | GOOGL | AI compute / AI Computing | 2/57 | ❌ | 6% | 0.84 | +10 | NO | no | +0.16 | +0.16 |
| 2025-05-01 | GOOGL | AI Safety | 0/57 | ❌ | 2% | 0.87 | +11 | NO | no | +0.13 | +0.13 |
| 2025-05-01 | GOOGL | Data centers | 45/57 | ✅ | 78% | 0.10 | +12 | NO | yes | -0.10 | -0.10 |
| 2025-05-01 | GOOGL | DeepMind / Deep Mind | 19/57 | ✅ | 35% | 0.26 | +39 | NO | yes | -0.26 | -0.26 |
| 2025-05-01 | GOOGL | Generative AI / Gen-AI / Gen AI | 9/57 | ✅ | 19% | 0.10 | +71 | NO | no | +0.90 | +0.87 |
| 2025-05-01 | GOOGL | Pixel | 35/57 | ✅ | 61% | 0.06 | +33 | NO | yes | -0.06 | -0.06 |
| 2025-05-01 | GOOGL | Privacy | 26/57 | ❌ | 45% | 0.40 | +15 | NO | no | +0.60 | +0.58 |
| 2025-05-01 | GOOGL | Quantum | 5/57 | ❌ | 11% | 0.32 | +57 | NO | no | +0.68 | +0.66 |
| 2025-05-01 | GOOGL | Regulator / Regulation / Regulatory | 19/57 | ✅ | 35% | 0.47 | +18 | NO | yes | -0.47 | -0.47 |
| 2025-05-01 | GOOGL | Subscription | 40/57 | ✅ | 69% | 0.01 | +30 | NO | yes | -0.01 | -0.01 |
| 2025-05-01 | GOOGL | Waymo | 31/57 | ✅ | 55% | 0.04 | +41 | NO | yes | -0.04 | -0.04 |
| 2025-05-01 | GOOGL | Workspace | 20/57 | ✅ | 37% | 0.01 | +62 | NO | yes | -0.01 | -0.01 |
| 2025-05-01 | GOOGL | YouTube Premium | 11/57 | ❌ | 20% | 0.63 | +17 | NO | no | +0.37 | +0.36 |
| 2025-05-01 | GOOGL | YouTube Shorts | 15/57 | ✅ | 28% | 0.45 | +27 | NO | yes | -0.45 | -0.45 |
| 2025-05-01 | META | Ad targeting / Ad-targeting | 17/51 | ❌ | 34% | 0.21 | +13 | YES | no | -0.21 | -0.21 |
| 2025-05-01 | META | Efficiency | 22/51 | ✅ | 44% | 0.10 | +46 | NO | yes | -0.10 | -0.10 |
| 2025-05-01 | META | Election | 21/51 | ✅ | 42% | 0.08 | +34 | YES | yes | +0.92 | +0.89 |
| 2025-05-01 | META | Generative AI / Gen AI / Gen-AI | 9/51 | ✅ | 21% | 0.10 | +69 | NO | yes | -0.10 | -0.10 |
| 2025-05-01 | META | Metaverse | 14/51 | ✅ | 30% | 0.15 | +55 | NO | yes | -0.15 | -0.15 |
| 2025-05-01 | META | Moderation | 6/51 | ❌ | 14% | 0.69 | +17 | NO | no | +0.31 | +0.30 |
| 2025-05-01 | META | Quest 3 | 5/51 | ✅ | 13% | 0.70 | +17 | NO | no | +0.30 | +0.29 |
| 2025-05-01 | META | Reels | 19/51 | ✅ | 39% | 0.08 | +53 | NO | yes | -0.08 | -0.08 |
| 2025-05-01 | META | Regulator / Regulatory / Regulation | 28/51 | ✅ | 55% | 0.07 | +38 | NO | yes | -0.07 | -0.07 |
| 2025-05-01 | META | Threads | 12/51 | ✅ | 26% | 0.05 | +69 | NO | yes | -0.05 | -0.05 |
| 2025-05-01 | META | TikTok | 9/51 | ❌ | 19% | 0.51 | +30 | NO | no | +0.49 | +0.48 |
| 2025-05-01 | META | VR / Virtual reality | 38/51 | ✅ | 73% | 0.48 | +25 | YES | yes | +0.52 | +0.50 |
| 2025-05-01 | META | WhatsApp | 44/51 | ✅ | 84% | 0.04 | +12 | NO | yes | -0.04 | -0.04 |
| 2025-05-01 | MSFT | Activision-Blizzard / Activision Blizzard | 6/59 | ❌ | 12% | 0.65 | +23 | NO | no | +0.35 | +0.34 |
| 2025-05-01 | MSFT | ChatGPT | 8/59 | ✅ | 16% | 0.32 | +52 | NO | yes | -0.32 | -0.32 |
| 2025-05-01 | MSFT | Copilot | 14/59 | ✅ | 26% | 0.04 | +70 | NO | yes | -0.04 | -0.04 |
| 2025-05-01 | MSFT | Enterprise AI | 4/59 | ✅ | 10% | 0.61 | +29 | NO | no | +0.39 | +0.38 |
| 2025-05-01 | MSFT | Game Pass | 31/59 | ✅ | 53% | 0.06 | +41 | NO | yes | -0.06 | -0.06 |
| 2025-05-01 | MSFT | GitHub | 27/59 | ✅ | 47% | 0.04 | +49 | NO | yes | -0.04 | -0.04 |
| 2025-05-01 | MSFT | Intelligent cloud | 39/59 | ✅ | 66% | 0.04 | +30 | NO | yes | -0.04 | -0.04 |
| 2025-05-01 | MSFT | LinkedIn | 36/59 | ✅ | 61% | 0.04 | +35 | NO | yes | -0.04 | -0.04 |
| 2025-05-01 | MSFT | M365 | 8/59 | ✅ | 16% | 0.09 | +75 | NO | yes | -0.09 | -0.09 |
| 2025-05-01 | MSFT | OpenAI | 19/59 | ✅ | 34% | 0.02 | +64 | NO | yes | -0.02 | -0.02 |
| 2025-05-01 | MSFT | Surface | 46/59 | ❌ | 75% | 0.29 | +46 | YES | no | -0.29 | -0.29 |
| 2025-05-01 | MSFT | Teams | 42/59 | ✅ | 70% | 0.07 | +23 | NO | yes | -0.07 | -0.07 |
| 2025-05-01 | TSLA | 4680 battery cell | 1/58 | ❌ | 4% | 0.82 | +14 | NO | no | +0.18 | +0.17 |
| 2025-05-01 | TSLA | Autonomous | 30/58 | ✅ | 52% | 0.04 | +44 | NO | yes | -0.04 | -0.04 |
| 2025-05-01 | TSLA | Charging network | 3/58 | ❌ | 7% | 0.68 | +25 | NO | no | +0.32 | +0.31 |
| 2025-05-01 | TSLA | Cybertruck | 21/58 | ✅ | 38% | 0.12 | +50 | NO | yes | -0.12 | -0.12 |
| 2025-05-01 | TSLA | DOGE / Department of Government Efficiency | 1/58 | ✅ | 5% | 0.65 | +30 | NO | yes | -0.65 | -0.65 |
| 2025-05-01 | TSLA | Full Self-Driving / FSD | 29/58 | ✅ | 51% | 0.04 | +45 | NO | yes | -0.04 | -0.04 |
| 2025-05-01 | TSLA | Gigacast / Gigacasting | 3/58 | ❌ | 7% | 0.76 | +17 | NO | no | +0.24 | +0.23 |
| 2025-05-01 | TSLA | Gigafactory | 32/58 | ✅ | 55% | 0.34 | +11 | NO | yes | -0.34 | -0.34 |
| 2025-05-01 | TSLA | Megapack | 19/58 | ✅ | 34% | 0.10 | +56 | NO | yes | -0.10 | -0.10 |
| 2025-05-01 | TSLA | Protest | 0/58 | ✅ | 4% | 0.74 | +22 | NO | yes | -0.74 | -0.74 |
| 2025-05-01 | TSLA | Regulator / Regulatory / Regulation | 44/58 | ✅ | 75% | 0.15 | +10 | NO | yes | -0.15 | -0.15 |
| 2025-05-01 | TSLA | Robotaxi | 17/58 | ✅ | 31% | 0.04 | +65 | NO | yes | -0.04 | -0.04 |
| 2025-05-01 | TSLA | Solar | 34/58 | ❌ | 57% | 0.37 | +20 | YES | no | -0.37 | -0.37 |
| 2025-06-01 | AMC | Bankruptcy | 7/25 | ❌ | 29% | 0.17 | +12 | YES | no | -0.17 | -0.17 |
| 2025-06-01 | AMC | Box office recovery | 4/25 | ❌ | 19% | 0.46 | +35 | NO | no | +0.54 | +0.52 |
| 2025-06-01 | AMC | Innovation | 13/25 | ✅ | 53% | 0.14 | +33 | NO | yes | -0.14 | -0.14 |
| 2025-06-01 | AMC | Popcorn | 20/25 | ❌ | 74% | 0.12 | +14 | NO | no | +0.88 | +0.85 |
| 2025-06-01 | AMC | Premium format | 8/25 | ✅ | 36% | 0.12 | +24 | YES | yes | +0.88 | +0.85 |
| 2025-06-01 | AMC | Retail investor | 11/25 | ❌ | 43% | 0.10 | +33 | YES | no | -0.10 | -0.10 |
| 2025-06-01 | AMC | Theater attendance | 4/25 | ❌ | 19% | 0.63 | +18 | NO | no | +0.37 | +0.36 |
| 2025-06-01 | AMD | AI Chip | 0/59 | ❌ | 2% | 0.76 | +22 | NO | no | +0.24 | +0.23 |
| 2025-06-01 | AMD | Automotive / Automobile | 18/59 | ✅ | 32% | 0.51 | +17 | NO | yes | -0.51 | -0.51 |
| 2025-06-01 | AMD | Buyback | 1/59 | ❌ | 4% | 0.83 | +13 | NO | no | +0.17 | +0.16 |
| 2025-06-01 | AMD | China | 31/59 | ✅ | 53% | 0.20 | +27 | NO | yes | -0.20 | -0.20 |
| 2025-06-01 | AMD | Cloud | 50/59 | ✅ | 83% | 0.01 | +16 | NO | yes | -0.01 | -0.01 |
| 2025-06-01 | AMD | Custom silicon | 3/59 | ✅ | 9% | 0.55 | +36 | NO | no | +0.45 | +0.44 |
| 2025-06-01 | AMD | Data center | 51/59 | ✅ | 85% | 0.03 | +12 | NO | yes | -0.03 | -0.03 |
| 2025-06-01 | AMD | EPYC | 31/59 | ✅ | 53% | 0.10 | +37 | NO | yes | -0.10 | -0.10 |
| 2025-06-01 | AMD | HPC | 27/59 | ✅ | 47% | 0.21 | +32 | NO | yes | -0.21 | -0.21 |
| 2025-06-01 | AMD | Inference | 10/59 | ✅ | 20% | 0.07 | +73 | NO | yes | -0.07 | -0.07 |
| 2025-06-01 | AMD | MI300 | 10/59 | ✅ | 20% | 0.14 | +66 | NO | yes | -0.14 | -0.14 |
| 2025-06-01 | AMD | NVIDIA | 12/59 | ❌ | 21% | 0.03 | +18 | YES | no | -0.03 | -0.03 |
| 2025-06-01 | AMD | Xilinx | 16/59 | ✅ | 29% | 0.16 | +13 | YES | yes | +0.84 | +0.81 |
| 2025-06-01 | COINBASE | Bitcoin | 15/16 | ✅ | 86% | 0.03 | +11 | NO | yes | -0.03 | -0.03 |
| 2025-06-01 | COINBASE | Blockchain | 16/16 | ✅ | 91% | 0.74 | +17 | YES | yes | +0.26 | +0.25 |
| 2025-06-01 | COINBASE | Crypto winter | 7/16 | ❌ | 42% | 0.12 | +30 | YES | no | -0.12 | -0.12 |
| 2025-06-01 | COINBASE | Decentralized Exchange / DEX | 9/16 | ✅ | 57% | 0.42 | +15 | YES | yes | +0.58 | +0.56 |
| 2025-06-01 | COINBASE | Margin | 8/16 | ✅ | 52% | 0.22 | +26 | NO | yes | -0.22 | -0.22 |
| 2025-06-01 | COINBASE | Stablecoin | 11/16 | ✅ | 67% | 0.08 | +25 | NO | yes | -0.08 | -0.08 |
| 2025-06-01 | COINBASE | Web3 | 10/16 | ❌ | 57% | 0.34 | +23 | YES | no | -0.34 | -0.34 |
| 2025-06-01 | DIS | Attendance | 52/60 | ✅ | 85% | 0.71 | +14 | YES | yes | +0.29 | +0.28 |
| 2025-06-01 | DIS | Content investment | 4/60 | ❌ | 9% | 0.81 | +10 | NO | no | +0.19 | +0.18 |
| 2025-06-01 | DIS | Cruise line | 33/60 | ❌ | 54% | 0.20 | +26 | NO | no | +0.80 | +0.78 |
| 2025-06-01 | DIS | Disney+ | 26/60 | ✅ | 44% | 0.01 | +55 | NO | yes | -0.01 | -0.01 |
| 2025-06-01 | DIS | Hulu | 46/60 | ✅ | 76% | 0.05 | +19 | NO | yes | -0.05 | -0.05 |
| 2025-06-01 | DIS | IP / Intellectual property | 43/60 | ✅ | 71% | 0.13 | +16 | NO | yes | -0.13 | -0.13 |
| 2025-06-01 | DIS | Merchandise | 47/60 | ❌ | 76% | 0.30 | +46 | YES | no | -0.30 | -0.30 |
| 2025-06-01 | DIS | Netflix | 37/60 | ❌ | 60% | 0.37 | +23 | YES | no | -0.37 | -0.37 |
| 2025-06-01 | DIS | Pricing power | 9/60 | ❌ | 16% | 0.70 | +14 | NO | no | +0.30 | +0.29 |
| 2025-06-01 | DIS | Streaming | 38/60 | ✅ | 63% | 0.09 | +28 | NO | yes | -0.09 | -0.09 |
| 2025-06-01 | F | Autonomous | 24/27 | ❌ | 82% | 0.24 | +58 | YES | no | -0.24 | -0.24 |
| 2025-06-01 | F | Battery production | 1/27 | ❌ | 8% | 0.76 | +16 | NO | no | +0.24 | +0.23 |
| 2025-06-01 | F | BlueOval | 1/27 | ❌ | 8% | 0.81 | +11 | NO | no | +0.19 | +0.18 |
| 2025-06-01 | F | Charging | 3/27 | ✅ | 17% | 0.30 | +53 | NO | no | +0.70 | +0.68 |
| 2025-06-01 | F | Dealer | 21/27 | ✅ | 75% | 0.05 | +20 | NO | yes | -0.05 | -0.05 |
| 2025-06-01 | F | Electric vehicle / EV | 21/27 | ✅ | 75% | 0.01 | +24 | NO | yes | -0.01 | -0.01 |
| 2025-06-01 | F | F-150 Lightning | 2/27 | ✅ | 14% | 0.60 | +26 | NO | no | +0.40 | +0.39 |
| 2025-06-01 | F | Mach-E | 8/27 | ✅ | 34% | 0.32 | +34 | NO | yes | -0.32 | -0.32 |
| 2025-06-01 | F | Subsidy | 0/27 | ❌ | 5% | 0.72 | +23 | NO | no | +0.28 | +0.27 |
| 2025-06-01 | GME | Close / Closure | 39/51 | ✅ | 75% | 0.08 | +67 | YES | no | -0.08 | -0.08 |
| 2025-06-01 | GME | Inventory | 45/51 | ✅ | 86% | 0.48 | +38 | YES | no | -0.48 | -0.48 |
| 2025-06-01 | LUCID | Charging infrastructure | 1/14 | ❌ | 14% | 0.76 | +10 | NO | no | +0.24 | +0.23 |
| 2025-06-01 | LUCID | International | 9/14 | ❌ | 58% | 0.24 | +34 | YES | no | -0.24 | -0.24 |
| 2025-06-01 | LUCID | Luxury EV | 3/14 | ❌ | 25% | 0.03 | +22 | YES | no | -0.03 | -0.03 |
| 2025-06-01 | LUCID | OTA / Over-the-air | 12/14 | ❌ | 74% | 0.35 | +39 | YES | no | -0.35 | -0.35 |
| 2025-06-01 | LUCID | Saudi Public Investment Fund / PIF | 9/14 | ❌ | 58% | 0.13 | +29 | NO | no | +0.87 | +0.84 |
| 2025-06-01 | LUCID | Reservation backlog | 1/14 | ❌ | 14% | 0.02 | +12 | YES | no | -0.02 | -0.02 |
| 2025-06-01 | LUCID | Supply chain | 12/14 | ✅ | 79% | 0.66 | +13 | YES | yes | +0.34 | +0.33 |
| 2025-06-01 | LUCID | Tesla | 11/14 | ❌ | 69% | 0.48 | +21 | YES | no | -0.48 | -0.48 |
| 2025-06-01 | NFLX | Ad-supported | 13/59 | ❌ | 23% | 0.66 | +11 | NO | no | +0.34 | +0.33 |
| 2025-06-01 | NFLX | Churn | 46/59 | ✅ | 77% | 0.48 | +29 | YES | yes | +0.52 | +0.50 |
| 2025-06-01 | NFLX | Gaming | 17/59 | ✅ | 31% | 0.50 | +19 | NO | yes | -0.50 | -0.50 |
| 2025-06-01 | NFLX | Original content | 41/59 | ✅ | 69% | 0.27 | +42 | YES | yes | +0.73 | +0.71 |
| 2025-06-01 | NFLX | Oscar | 15/59 | ✅ | 28% | 0.35 | +37 | NO | yes | -0.35 | -0.35 |
| 2025-06-01 | NFLX | Slate | 34/59 | ✅ | 58% | 0.10 | +32 | NO | yes | -0.10 | -0.10 |
| 2025-06-01 | NFLX | Squid Game | 11/59 | ✅ | 21% | 0.27 | +52 | NO | yes | -0.27 | -0.27 |
| 2025-06-01 | NFLX | Subscriber growth | 33/59 | ✅ | 56% | 0.19 | +25 | NO | yes | -0.19 | -0.19 |
| 2025-06-01 | NVDA | A100 | 13/58 | ❌ | 23% | 0.13 | +10 | YES | no | -0.13 | -0.13 |
| 2025-06-01 | NVDA | AMD | 14/58 | ❌ | 25% | 0.13 | +12 | YES | no | -0.13 | -0.13 |
| 2025-06-01 | NVDA | Autonomous | 38/58 | ✅ | 65% | 0.09 | +26 | NO | yes | -0.09 | -0.09 |
| 2025-06-01 | NVDA | Cloud | 49/58 | ✅ | 83% | 0.02 | +15 | NO | yes | -0.02 | -0.02 |
| 2025-06-01 | NVDA | Crypto / Cryptocurrency | 17/58 | ❌ | 30% | 0.15 | +15 | YES | no | -0.15 | -0.15 |
| 2025-06-01 | NVDA | CUDA | 37/58 | ✅ | 63% | 0.07 | +30 | NO | yes | -0.07 | -0.07 |
| 2025-06-01 | NVDA | Data center | 49/58 | ✅ | 83% | 0.01 | +16 | NO | yes | -0.01 | -0.01 |
| 2025-06-01 | NVDA | Demand | 51/58 | ✅ | 86% | 0.02 | +12 | NO | yes | -0.02 | -0.02 |
| 2025-06-01 | NVDA | DGX Cloud | 5/58 | ❌ | 10% | 0.69 | +21 | NO | no | +0.31 | +0.30 |
| 2025-06-01 | NVDA | Export restriction | 1/58 | ✅ | 5% | 0.70 | +25 | NO | yes | -0.70 | -0.70 |
| 2025-06-01 | NVDA | Generative AI / Gen AI / Gen-AI | 10/58 | ✅ | 20% | 0.06 | +74 | NO | yes | -0.06 | -0.06 |
| 2025-06-01 | NVDA | H100 | 12/58 | ✅ | 23% | 0.31 | +46 | NO | yes | -0.31 | -0.31 |
| 2025-06-01 | NVDA | Hopper | 12/58 | ✅ | 23% | 0.09 | +68 | NO | yes | -0.09 | -0.09 |
| 2025-06-01 | NVDA | Inference | 37/58 | ✅ | 63% | 0.02 | +35 | NO | yes | -0.02 | -0.02 |
| 2025-06-01 | NVDA | Omniverse | 17/58 | ✅ | 31% | 0.15 | +54 | NO | yes | -0.15 | -0.15 |
| 2025-06-01 | NVDA | Quantum | 20/58 | ✅ | 36% | 0.16 | +48 | NO | yes | -0.16 | -0.16 |
| 2025-06-01 | NVDA | Star Wars | 9/58 | ❌ | 17% | 0.04 | +13 | YES | no | -0.04 | -0.04 |
| 2025-06-01 | PLTR | Apollo | 16/18 | ✅ | 83% | 0.59 | +24 | YES | yes | +0.41 | +0.40 |
| 2025-06-01 | PLTR | Civil liberties | 4/18 | ❌ | 25% | 0.53 | +22 | NO | no | +0.47 | +0.46 |
| 2025-06-01 | PLTR | Gotham | 12/18 | ❌ | 61% | 0.33 | +28 | YES | no | -0.33 | -0.33 |
| 2025-06-01 | PLTR | Kill | 7/18 | ❌ | 38% | 0.35 | +27 | NO | no | +0.65 | +0.63 |
| 2025-06-01 | PLTR | Lethal | 3/18 | ✅ | 25% | 0.37 | +38 | NO | yes | -0.37 | -0.37 |
| 2025-06-01 | PLTR | Privacy | 1/18 | ❌ | 11% | 0.76 | +13 | NO | no | +0.24 | +0.23 |
| 2025-06-01 | PLTR | Revolution | 7/18 | ✅ | 43% | 0.08 | +49 | NO | yes | -0.08 | -0.08 |
| 2025-06-01 | UBER | Autonomous | 8/24 | ❌ | 34% | 0.07 | +59 | NO | no | +0.93 | +0.90 |
| 2025-06-01 | UBER | Driver incentives | 10/24 | ❌ | 41% | 0.25 | +16 | YES | no | -0.25 | -0.25 |
| 2025-06-01 | UBER | India | 11/24 | ❌ | 44% | 0.23 | +21 | YES | no | -0.23 | -0.23 |
| 2025-06-01 | UBER | Lyft | 14/24 | ✅ | 58% | 0.20 | +38 | YES | yes | +0.80 | +0.78 |
| 2025-06-01 | UBER | Regulator / Regulatory / Regulation | 20/24 | ❌ | 76% | 0.10 | +14 | NO | no | +0.90 | +0.87 |
| 2025-06-01 | UBER | Waymo | 4/24 | ✅ | 23% | 0.15 | +62 | NO | yes | -0.15 | -0.15 |
| 2025-07-16 | NFLX | Ad-supported | 13/59 | ❌ | 23% | 0.39 | +38 | NO | yes | -0.39 | -0.39 |
| 2025-07-16 | NFLX | Churn | 46/59 | ✅ | 77% | 0.62 | +15 | YES | no | -0.62 | -0.62 |
| 2025-07-16 | NFLX | Engagement | 39/59 | ✅ | 66% | 0.01 | +33 | NO | yes | -0.01 | -0.01 |
| 2025-07-16 | NFLX | Gaming | 17/59 | ✅ | 31% | 0.35 | +34 | NO | yes | -0.35 | -0.35 |
| 2025-07-16 | NFLX | Live Event | 9/59 | ✅ | 18% | 0.09 | +73 | NO | yes | -0.09 | -0.09 |
| 2025-07-16 | NFLX | Password | 11/59 | ❌ | 20% | 0.62 | +18 | NO | no | +0.38 | +0.37 |
| 2025-07-16 | NFLX | Recession | 3/59 | ✅ | 9% | 0.81 | +10 | NO | no | +0.19 | +0.18 |
| 2025-07-16 | NFLX | Squid Game | 11/59 | ✅ | 21% | 0.05 | +74 | NO | yes | -0.05 | -0.05 |
| 2025-07-16 | NFLX | Tariff | 0/59 | ✅ | 4% | 0.65 | +31 | NO | no | +0.35 | +0.34 |
| 2025-07-16 | NFLX | Tier | 29/59 | ❌ | 48% | 0.28 | +24 | NO | yes | -0.28 | -0.28 |
| 2025-07-21 | TSLA | 4680 | 17/58 | ✅ | 31% | 0.39 | +30 | NO | no | +0.61 | +0.59 |
| 2025-07-21 | TSLA | Autonomous | 30/58 | ✅ | 52% | 0.03 | +45 | NO | yes | -0.03 | -0.03 |
| 2025-07-21 | TSLA | Big Beautiful Bill | 0/58 | ❌ | 2% | 0.59 | +39 | NO | no | +0.41 | +0.40 |
| 2025-07-21 | TSLA | Cluster | 6/58 | ❌ | 12% | 0.49 | +39 | NO | no | +0.51 | +0.49 |
| 2025-07-21 | TSLA | Cybertruck | 21/58 | ✅ | 38% | 0.11 | +51 | NO | no | +0.89 | +0.86 |
| 2025-07-21 | TSLA | DOGE / Department of Government Efficiency | 1/58 | ✅ | 5% | 0.72 | +23 | NO | no | +0.28 | +0.27 |
| 2025-07-21 | TSLA | Dojo | 13/58 | ❌ | 23% | 0.59 | +18 | NO | yes | -0.59 | -0.59 |
| 2025-07-21 | TSLA | Epstein | 0/58 | ❌ | 2% | 0.87 | +11 | NO | no | +0.13 | +0.13 |
| 2025-07-21 | TSLA | Full Self-Driving / FSD | 29/58 | ✅ | 51% | 0.04 | +45 | NO | yes | -0.04 | -0.04 |
| 2025-07-21 | TSLA | Gigafactory | 32/58 | ✅ | 55% | 0.28 | +17 | NO | no | +0.72 | +0.70 |
| 2025-07-21 | TSLA | Grok4 | 0/58 | ❌ | 2% | 0.39 | +59 | NO | yes | -0.39 | -0.39 |
| 2025-07-21 | TSLA | Optimus | 12/58 | ✅ | 23% | 0.10 | +67 | NO | yes | -0.10 | -0.10 |
| 2025-07-21 | TSLA | Powerwall | 28/58 | ✅ | 49% | 0.24 | +27 | NO | yes | -0.24 | -0.24 |
| 2025-07-21 | TSLA | Regulator / Regulatory / Regulation | 44/58 | ✅ | 75% | 0.03 | +22 | NO | yes | -0.03 | -0.03 |
| 2025-07-21 | TSLA | Robotaxi | 17/58 | ✅ | 31% | 0.04 | +65 | NO | yes | -0.04 | -0.04 |
| 2025-07-21 | TSLA | Supercharger / Super Charger / Super-charger | 30/58 | ❌ | 51% | 0.21 | +28 | NO | no | +0.79 | +0.77 |
| 2025-07-21 | TSLA | Spacex | 12/58 | ✅ | 23% | 0.40 | +37 | NO | no | +0.60 | +0.58 |
| 2025-07-21 | TSLA | Subscription | 10/58 | ❌ | 19% | 0.57 | +24 | NO | yes | -0.57 | -0.57 |
| 2025-07-21 | TSLA | Tariff | 9/58 | ✅ | 18% | 0.11 | +71 | NO | yes | -0.11 | -0.11 |
| 2025-07-21 | TSLA | Trump | 3/58 | ✅ | 9% | 0.49 | +42 | NO | no | +0.51 | +0.49 |
| 2025-07-21 | TSLA | Waymo | 4/58 | ✅ | 10% | 0.43 | +47 | NO | yes | -0.43 | -0.43 |
| 2025-07-21 | TSLA | xAI | 3/58 | ❌ | 7% | 0.28 | +65 | NO | yes | -0.28 | -0.28 |
| 2025-07-22 | GOOGL | AI / Artificial Inteligence | 37/57 | ✅ | 64% | 0.03 | +33 | NO | yes | -0.03 | -0.03 |
| 2025-07-22 | GOOGL | Antitrust | 1/57 | ❌ | 4% | 0.52 | +44 | NO | no | +0.48 | +0.47 |
| 2025-07-22 | GOOGL | Cloud | 51/57 | ✅ | 87% | 0.01 | +12 | NO | yes | -0.01 | -0.01 |
| 2025-07-22 | GOOGL | DeepMind / Deep Mind | 19/57 | ✅ | 35% | 0.01 | +34 | YES | no | -0.01 | -0.01 |
| 2025-07-22 | GOOGL | Family Link | 0/57 | ❌ | 2% | 0.87 | +11 | NO | no | +0.13 | +0.13 |
| 2025-07-22 | GOOGL | Gemini | 7/57 | ✅ | 15% | 0.05 | +80 | NO | yes | -0.05 | -0.05 |
| 2025-07-22 | GOOGL | Pixel | 35/57 | ✅ | 61% | 0.01 | +38 | NO | yes | -0.01 | -0.01 |
| 2025-07-22 | GOOGL | Privacy | 26/57 | ❌ | 45% | 0.01 | +44 | YES | no | -0.01 | -0.01 |
| 2025-07-22 | GOOGL | Regulator / Regulation / Regulatory | 19/57 | ✅ | 35% | 0.01 | +34 | YES | no | -0.01 | -0.01 |
| 2025-07-22 | GOOGL | Search Advertising | 15/57 | ❌ | 27% | 0.01 | +26 | YES | no | -0.01 | -0.01 |
| 2025-07-22 | GOOGL | Subscription | 40/57 | ✅ | 69% | 0.01 | +30 | NO | yes | -0.01 | -0.01 |
| 2025-07-22 | GOOGL | Waymo | 31/57 | ✅ | 55% | 0.01 | +44 | NO | yes | -0.01 | -0.01 |
| 2025-07-22 | GOOGL | Youtube Shorts | 15/57 | ✅ | 28% | 0.01 | +71 | NO | yes | -0.01 | -0.01 |
| 2025-07-29 | MSFT | Activision | 11/59 | ❌ | 20% | 0.36 | +44 | NO | no | +0.64 | +0.62 |
| 2025-07-29 | MSFT | AI / Artificial Intelligence | 36/59 | ✅ | 61% | 0.01 | +38 | NO | yes | -0.01 | -0.01 |
| 2025-07-29 | MSFT | Copilot | 14/59 | ✅ | 26% | 0.03 | +71 | NO | yes | -0.03 | -0.03 |
| 2025-07-29 | MSFT | Cybersecurity | 15/59 | ❌ | 26% | 0.61 | +13 | NO | no | +0.39 | +0.38 |
| 2025-07-29 | MSFT | DeepSeek | 1/59 | ✅ | 5% | 0.67 | +28 | NO | yes | -0.67 | -0.67 |
| 2025-07-29 | MSFT | Enterprise AI | 4/59 | ✅ | 10% | 0.79 | +11 | NO | no | +0.21 | +0.20 |
| 2025-07-29 | MSFT | Gaming | 51/59 | ✅ | 85% | 0.01 | +14 | NO | yes | -0.01 | -0.01 |
| 2025-07-29 | MSFT | LinkedIn | 36/59 | ✅ | 61% | 0.02 | +37 | NO | yes | -0.02 | -0.02 |
| 2025-07-29 | MSFT | M365 / Microsoft 365 | 31/59 | ✅ | 53% | 0.02 | +45 | NO | yes | -0.02 | -0.02 |
| 2025-07-29 | MSFT | OpenAI | 19/59 | ✅ | 34% | 0.11 | +55 | NO | yes | -0.11 | -0.11 |
| 2025-07-29 | MSFT | Phi | 4/59 | ❌ | 9% | 0.36 | +55 | NO | no | +0.64 | +0.62 |
| 2025-07-29 | MSFT | Stargate | 1/59 | ❌ | 4% | 0.68 | +28 | NO | no | +0.32 | +0.31 |
| 2025-07-29 | MSFT | Teams | 42/59 | ✅ | 70% | 0.03 | +27 | NO | yes | -0.03 | -0.03 |
| 2025-07-30 | META | Behemoth | 0/51 | ✅ | 4% | 0.43 | +53 | NO | no | +0.57 | +0.55 |
| 2025-07-30 | META | Channel | 25/51 | ❌ | 48% | 0.26 | +22 | YES | yes | +0.74 | +0.72 |
| 2025-07-30 | META | Llama | 8/51 | ✅ | 19% | 0.09 | +72 | NO | yes | -0.09 | -0.09 |
| 2025-07-30 | META | Maverick | 1/51 | ❌ | 5% | 0.73 | +22 | NO | no | +0.27 | +0.26 |
| 2025-07-30 | META | Meta AI | 6/51 | ✅ | 15% | 0.03 | +82 | NO | yes | -0.03 | -0.03 |
| 2025-07-30 | META | Orion | 2/51 | ❌ | 6% | 0.46 | +48 | NO | yes | -0.46 | -0.46 |
| 2025-07-30 | META | Ray-Ban | 9/51 | ✅ | 21% | 0.15 | +64 | NO | yes | -0.15 | -0.15 |
| 2025-07-30 | META | Reality | 41/51 | ✅ | 79% | 0.09 | +12 | NO | yes | -0.09 | -0.09 |
| 2025-07-30 | META | Scout | 0/51 | ❌ | 3% | 0.74 | +23 | NO | no | +0.26 | +0.25 |
| 2025-07-30 | META | Threads | 12/51 | ✅ | 26% | 0.07 | +67 | NO | yes | -0.07 | -0.07 |
| 2025-07-30 | META | WhatsApp | 44/51 | ✅ | 84% | 0.02 | +14 | NO | yes | -0.02 | -0.02 |
| 2025-07-31 | AAPL | Creator | 12/56 | ❌ | 22% | 0.61 | +17 | NO | no | +0.39 | +0.38 |
| 2025-07-31 | AAPL | Formula 1 / F1 | 1/56 | ✅ | 6% | 0.21 | +73 | NO | yes | -0.21 | -0.21 |
| 2025-07-31 | AAPL | Intelligence | 13/56 | ✅ | 26% | 0.03 | +71 | NO | yes | -0.03 | -0.03 |
| 2025-07-31 | AAPL | M3 | 4/56 | ✅ | 11% | 0.36 | +53 | NO | no | +0.64 | +0.62 |
| 2025-07-31 | AAPL | Manufacturing | 32/56 | ✅ | 57% | 0.29 | +14 | NO | yes | -0.29 | -0.29 |
| 2025-07-31 | AAPL | Modem | 4/56 | ✅ | 11% | 0.72 | +17 | NO | no | +0.28 | +0.27 |
| 2025-07-31 | AAPL | Regulation / regulator / regulatory | 16/56 | ❌ | 29% | 0.55 | +16 | NO | yes | -0.55 | -0.55 |
| 2025-07-31 | AAPL | Sleep apnea | 2/56 | ❌ | 6% | 0.75 | +19 | NO | no | +0.25 | +0.24 |
| 2025-07-31 | AAPL | Severance | 6/56 | ✅ | 14% | 0.41 | +45 | NO | yes | -0.41 | -0.41 |
| 2025-07-31 | AAPL | Siri | 28/56 | ✅ | 51% | 0.25 | +24 | NO | yes | -0.25 | -0.25 |
| 2025-07-31 | AAPL | Tariff | 7/56 | ✅ | 16% | 0.10 | +74 | NO | yes | -0.10 | -0.10 |
| 2025-07-31 | AAPL | Vision | 17/56 | ✅ | 32% | 0.16 | +52 | NO | yes | -0.16 | -0.16 |
| 2025-07-31 | AAPL | Wearable | 33/56 | ✅ | 59% | 0.05 | +36 | NO | yes | -0.05 | -0.05 |
| 2025-07-31 | AAPL | WWDC | 12/56 | ✅ | 24% | 0.29 | +47 | NO | yes | -0.29 | -0.29 |
| 2025-07-31 | AMZN | Advertising | 46/59 | ✅ | 77% | 0.05 | +18 | NO | yes | -0.05 | -0.05 |
| 2025-07-31 | AMZN | Alexa+ / Alexa Plus | 0/59 | ✅ | 4% | 0.08 | +88 | NO | yes | -0.08 | -0.08 |
| 2025-07-31 | AMZN | Delivery | 53/59 | ✅ | 88% | 0.02 | +10 | NO | yes | -0.02 | -0.02 |
| 2025-07-31 | AMZN | Gen-AI / Gen AI / Generative AI | 8/59 | ✅ | 16% | 0.01 | +83 | NO | yes | -0.01 | -0.01 |
| 2025-07-31 | AMZN | Grocery | 30/59 | ✅ | 51% | 0.10 | +39 | NO | no | +0.90 | +0.87 |
| 2025-07-31 | AMZN | Headcount | 25/59 | ❌ | 42% | 0.28 | +14 | YES | no | -0.28 | -0.28 |
| 2025-07-31 | AMZN | Project Kuiper | 4/59 | ✅ | 10% | 0.14 | +76 | NO | yes | -0.14 | -0.14 |
| 2025-07-31 | AMZN | Labor Market | 15/59 | ✅ | 28% | 0.12 | +60 | NO | yes | -0.12 | -0.12 |
| 2025-07-31 | AMZN | Machine Learning | 19/59 | ❌ | 33% | 0.38 | +29 | NO | no | +0.62 | +0.60 |
| 2025-07-31 | AMZN | Operating Margin | 43/59 | ✅ | 72% | 0.04 | +24 | NO | yes | -0.04 | -0.04 |
| 2025-07-31 | AMZN | Pharmaceutical | 1/59 | ❌ | 4% | 0.84 | +12 | NO | no | +0.16 | +0.16 |
| 2025-07-31 | AMZN | Prime Day | 27/59 | ✅ | 47% | 0.02 | +51 | NO | yes | -0.02 | -0.02 |
| 2025-07-31 | AMZN | Prime Video | 37/59 | ✅ | 62% | 0.09 | +29 | NO | yes | -0.09 | -0.09 |
| 2025-07-31 | AMZN | Robotics | 13/59 | ✅ | 24% | 0.10 | +66 | NO | yes | -0.10 | -0.10 |
| 2025-07-31 | AMZN | RxPass | 4/59 | ❌ | 9% | 0.72 | +19 | NO | no | +0.28 | +0.27 |
| 2025-07-31 | AMZN | Supply Chain | 15/59 | ✅ | 28% | 0.25 | +47 | NO | no | +0.75 | +0.73 |
| 2025-07-31 | AMZN | Tariff | 0/59 | ✅ | 4% | 0.03 | +93 | NO | yes | -0.03 | -0.03 |
| 2025-07-31 | AMZN | Thursday Night Football | 15/59 | ❌ | 26% | 0.60 | +14 | NO | no | +0.40 | +0.39 |
| 2025-07-31 | AMZN | Third-Party Sellers | 26/59 | ✅ | 45% | 0.17 | +38 | NO | no | +0.83 | +0.81 |
| 2025-07-31 | AMZN | Warehouse | 33/59 | ❌ | 55% | 0.30 | +25 | YES | no | -0.30 | -0.30 |
| 2025-07-31 | MSTR | Artificial Intelligence / AI | 12/24 | ✅ | 51% | 0.16 | +33 | NO | yes | -0.16 | -0.16 |
| 2025-07-31 | MSTR | Bitcoin | 20/24 | ✅ | 80% | 0.01 | +19 | NO | yes | -0.01 | -0.01 |
| 2025-07-31 | MSTR | Capital Gain | 5/24 | ✅ | 26% | 0.53 | +21 | NO | yes | -0.53 | -0.53 |
| 2025-07-31 | MSTR | Convertible | 17/24 | ✅ | 69% | 0.08 | +23 | NO | yes | -0.08 | -0.08 |
| 2025-07-31 | MSTR | Holdings | 18/24 | ✅ | 73% | 0.08 | +19 | NO | yes | -0.08 | -0.08 |
| 2025-07-31 | MSTR | Layer | 9/24 | ❌ | 37% | 0.16 | +21 | YES | no | -0.16 | -0.16 |
| 2025-07-31 | MSTR | Mobile | 16/24 | ❌ | 62% | 0.24 | +38 | YES | no | -0.24 | -0.24 |
| 2025-07-31 | MSTR | Strike | 2/24 | ❌ | 13% | 0.05 | +82 | NO | yes | -0.05 | -0.05 |
| 2025-07-31 | MSTR | Treasury | 18/24 | ✅ | 73% | 0.08 | +19 | NO | yes | -0.08 | -0.08 |
| 2025-07-31 | MSTR | Yield | 15/24 | ✅ | 62% | 0.08 | +30 | NO | yes | -0.08 | -0.08 |
| 2025-08-04 | PLTR | AI Agent | 2/18 | ✅ | 20% | 0.01 | +19 | YES | no | -0.01 | -0.01 |
| 2025-08-04 | PLTR | AI Platform | 5/18 | ❌ | 29% | 0.05 | +24 | YES | no | -0.05 | -0.05 |
| 2025-08-04 | PLTR | Apollo | 16/18 | ✅ | 83% | 0.01 | +82 | YES | no | -0.01 | -0.01 |
| 2025-08-04 | PLTR | Commercial growth | 2/18 | ❌ | 16% | 0.01 | +15 | YES | no | -0.01 | -0.01 |
| 2025-08-04 | PLTR | Government contract | 2/18 | ❌ | 16% | 0.01 | +15 | YES | no | -0.01 | -0.01 |
| 2025-08-04 | PLTR | International/Migration | 16/18 | ✅ | 83% | 0.01 | +16 | NO | yes | -0.01 | -0.01 |
| 2025-08-04 | PLTR | Israel | 4/18 | ❌ | 25% | 0.01 | +24 | YES | no | -0.01 | -0.01 |
| 2025-08-04 | PLTR | Kill | 7/18 | ❌ | 38% | 0.03 | +35 | YES | no | -0.03 | -0.03 |
| 2025-08-04 | PLTR | Lethal | 3/18 | ✅ | 25% | 0.01 | +74 | NO | yes | -0.01 | -0.01 |
| 2025-08-04 | PLTR | Margin expansion | 2/18 | ❌ | 16% | 0.02 | +14 | YES | no | -0.02 | -0.02 |
| 2025-08-04 | PLTR | Military | 13/18 | ✅ | 70% | 0.01 | +69 | YES | no | -0.01 | -0.01 |
| 2025-08-04 | PLTR | Missile | 3/18 | ❌ | 20% | 0.01 | +19 | YES | no | -0.01 | -0.01 |
| 2025-08-04 | PLTR | Partnership | 15/18 | ✅ | 79% | 0.01 | +20 | NO | yes | -0.01 | -0.01 |
| 2025-08-04 | PLTR | Regulatory / regulator / regulation | 7/18 | ❌ | 38% | 0.04 | +34 | YES | no | -0.04 | -0.04 |
| 2025-08-04 | PLTR | Revenue guidance | 12/18 | ✅ | 65% | 0.01 | +34 | NO | yes | -0.01 | -0.01 |
| 2025-08-04 | PLTR | Ukraine | 10/18 | ❌ | 52% | 0.01 | +51 | YES | no | -0.01 | -0.01 |
| 2025-08-04 | PLTR | Warp Speed | 0/18 | ❌ | 7% | 0.01 | +92 | NO | yes | -0.01 | -0.01 |
| 2025-08-05 | AMD | Automotive | 18/59 | ✅ | 32% | 0.01 | +67 | NO | yes | -0.01 | -0.01 |
| 2025-08-05 | AMD | Chiplet | 16/59 | ❌ | 28% | 0.01 | +27 | YES | no | -0.01 | -0.01 |
| 2025-08-05 | AMD | Export restriction | 0/59 | ❌ | 2% | 0.01 | +97 | NO | yes | -0.01 | -0.01 |
| 2025-08-05 | AMD | Frontier | 13/59 | ✅ | 24% | 0.01 | +75 | NO | yes | -0.01 | -0.01 |
| 2025-08-05 | AMD | healthcare | 11/59 | ✅ | 21% | 0.01 | +78 | NO | yes | -0.01 | -0.01 |
| 2025-08-05 | AMD | HPC | 27/59 | ✅ | 47% | 0.01 | +52 | NO | yes | -0.01 | -0.01 |
| 2025-08-05 | AMD | Meta | 7/59 | ✅ | 15% | 0.01 | +14 | YES | no | -0.01 | -0.01 |
| 2025-08-05 | AMD | MI300X | 7/59 | ✅ | 15% | 0.01 | +14 | YES | no | -0.01 | -0.01 |
| 2025-08-05 | AMD | NVIDIA | 12/59 | ❌ | 21% | 0.04 | +17 | YES | no | -0.04 | -0.04 |
| 2025-08-05 | AMD | ROCm | 13/59 | ✅ | 24% | 0.01 | +75 | NO | yes | -0.01 | -0.01 |
| 2025-08-05 | AMD | TSMC | 20/59 | ✅ | 35% | 0.01 | +34 | YES | no | -0.01 | -0.01 |
| 2025-08-06 | DIS | Abu Dhabi | 0/60 | ✅ | 4% | 0.35 | +61 | NO | yes | -0.35 | -0.35 |
| 2025-08-06 | DIS | Moana 2 | 4/60 | ❌ | 9% | 0.65 | +26 | NO | no | +0.35 | +0.34 |
| 2025-08-06 | UBER | Atlanta | 6/24 | ✅ | 30% | 0.13 | +17 | YES | yes | +0.87 | +0.84 |
| 2025-08-06 | UBER | Autonomous | 8/24 | ❌ | 34% | 0.03 | +63 | NO | yes | -0.03 | -0.03 |
| 2025-08-06 | UBER | Capital Allocation | 15/24 | ❌ | 59% | 0.01 | +40 | NO | yes | -0.01 | -0.01 |
| 2025-08-06 | UBER | Cost discipline | 3/24 | ❌ | 16% | 0.01 | +83 | NO | no | +0.99 | +0.96 |
| 2025-08-06 | UBER | Driver incentives | 10/24 | ❌ | 41% | 0.12 | +29 | YES | no | -0.12 | -0.12 |
| 2025-08-06 | UBER | Ecosystem | 10/24 | ❌ | 41% | 0.38 | +21 | NO | yes | -0.38 | -0.38 |
| 2025-08-06 | UBER | Freight | 16/24 | ❌ | 62% | 0.02 | +60 | YES | no | -0.02 | -0.02 |
| 2025-08-06 | UBER | Hailable | 12/24 | ❌ | 48% | 0.19 | +29 | YES | no | -0.19 | -0.19 |
| 2025-08-06 | UBER | India | 11/24 | ❌ | 44% | 0.11 | +33 | YES | no | -0.11 | -0.11 |
| 2025-08-06 | UBER | Lucid | 0/24 | ❌ | 5% | 0.01 | +94 | NO | yes | -0.01 | -0.01 |
| 2025-08-06 | UBER | Lyft | 14/24 | ✅ | 58% | 0.03 | +55 | YES | no | -0.03 | -0.03 |
| 2025-08-06 | UBER | Market share | 11/24 | ❌ | 44% | 0.13 | +31 | YES | no | -0.13 | -0.13 |
| 2025-08-06 | UBER | Machine Learning | 7/24 | ❌ | 30% | 0.13 | +17 | YES | no | -0.13 | -0.13 |
| 2025-08-06 | UBER | New York City | 12/24 | ❌ | 48% | 0.16 | +32 | YES | no | -0.16 | -0.16 |
| 2025-08-06 | UBER | Olympics | 1/24 | ❌ | 9% | 0.74 | +17 | NO | no | +0.26 | +0.25 |
| 2025-08-06 | UBER | Onboarding | 8/24 | ❌ | 34% | 0.19 | +15 | YES | no | -0.19 | -0.19 |
| 2025-08-06 | UBER | Regulator / Regulatory / Regulation | 20/24 | ❌ | 76% | 0.01 | +75 | YES | no | -0.01 | -0.01 |
| 2025-08-06 | UBER | Subscription | 12/24 | ❌ | 48% | 0.21 | +27 | YES | no | -0.21 | -0.21 |
| 2025-08-06 | UBER | Tesla | 3/24 | ❌ | 16% | 0.01 | +83 | NO | yes | -0.01 | -0.01 |
| 2025-08-06 | UBER | Waymo | 4/24 | ✅ | 23% | 0.09 | +68 | NO | yes | -0.09 | -0.09 |
| 2025-08-06 | UBER | Women Preference | 0/24 | ❌ | 5% | 0.79 | +16 | NO | no | +0.21 | +0.20 |
| 2025-08-11 | AMC | APE | 9/25 | ❌ | 36% | 0.01 | +35 | YES | no | -0.01 | -0.01 |
| 2025-08-11 | AMC | Bankruptcy | 7/25 | ❌ | 29% | 0.01 | +28 | YES | no | -0.01 | -0.01 |
| 2025-08-11 | AMC | Barbie | 4/25 | ❌ | 19% | 0.01 | +18 | YES | no | -0.01 | -0.01 |
| 2025-08-11 | AMC | Blockbuster | 15/25 | ✅ | 60% | 0.01 | +59 | YES | no | -0.01 | -0.01 |
| 2025-08-11 | AMC | Box office | 23/25 | ✅ | 87% | 0.01 | +12 | NO | yes | -0.01 | -0.01 |
| 2025-08-11 | AMC | IMAX | 18/25 | ✅ | 70% | 0.01 | +29 | NO | yes | -0.01 | -0.01 |
| 2025-08-11 | AMC | Popcorn | 20/25 | ❌ | 74% | 0.01 | +25 | NO | yes | -0.01 | -0.01 |
| 2025-08-11 | AMC | Streaming | 18/25 | ❌ | 67% | 0.01 | +32 | NO | yes | -0.01 | -0.01 |
| 2025-08-11 | AMC | Taylor Swift | 6/25 | ❌ | 26% | 0.01 | +73 | NO | yes | -0.01 | -0.01 |
| 2025-08-11 | AMC | Ticket price | 17/25 | ❌ | 64% | 0.01 | +35 | NO | yes | -0.01 | -0.01 |
| 2025-08-21 | WMT | Automation | 22/55 | ✅ | 41% | 0.01 | +58 | NO | yes | -0.01 | -0.01 |
| 2025-08-21 | WMT | Back-to-school | 23/55 | ✅ | 43% | 0.08 | +49 | NO | yes | -0.08 | -0.08 |
| 2025-08-21 | WMT | Bentonville | 17/55 | ✅ | 33% | 0.15 | +52 | NO | yes | -0.15 | -0.15 |
| 2025-08-21 | WMT | Brick-and-mortar | 3/55 | ❌ | 8% | 0.01 | +91 | NO | yes | -0.01 | -0.01 |
| 2025-08-21 | WMT | Capex | 17/55 | ✅ | 33% | 0.20 | +13 | YES | no | -0.20 | -0.20 |
| 2025-08-21 | WMT | Dividend | 37/55 | ✅ | 67% | 0.26 | +41 | YES | no | -0.26 | -0.26 |
| 2025-08-21 | WMT | Free cash flow | 33/55 | ❌ | 58% | 0.02 | +40 | NO | yes | -0.02 | -0.02 |
| 2025-08-21 | WMT | Omnichannel | 21/55 | ✅ | 40% | 0.21 | +39 | NO | yes | -0.21 | -0.21 |
| 2025-08-21 | WMT | Operating margin | 11/55 | ❌ | 21% | 0.01 | +78 | NO | yes | -0.01 | -0.01 |
| 2025-08-21 | WMT | Profit faster than sales | 9/55 | ✅ | 19% | 0.02 | +79 | NO | yes | -0.02 | -0.02 |
| 2025-08-21 | WMT | Q3 | 33/55 | ✅ | 60% | 0.13 | +27 | NO | yes | -0.13 | -0.13 |
| 2025-08-21 | WMT | Sustainability | 16/55 | ✅ | 31% | 0.17 | +14 | YES | no | -0.17 | -0.17 |
| 2025-08-27 | NVDA | Blackwell | 5/58 | ✅ | 12% | 0.02 | +86 | NO | yes | -0.02 | -0.02 |
| 2025-08-27 | NVDA | China | 45/58 | ✅ | 76% | 0.01 | +23 | NO | yes | -0.01 | -0.01 |
| 2025-08-27 | NVDA | Cosmos | 1/58 | ✅ | 5% | 0.25 | +70 | NO | yes | -0.25 | -0.25 |
| 2025-08-27 | NVDA | Datacenter | 0/58 | ❌ | 2% | 0.01 | +97 | NO | yes | -0.01 | -0.01 |
| 2025-08-27 | NVDA | Enterprise | 50/58 | ✅ | 84% | 0.02 | +14 | NO | yes | -0.02 | -0.02 |
| 2025-08-27 | NVDA | Hopper | 12/58 | ✅ | 23% | 0.10 | +67 | NO | yes | -0.10 | -0.10 |
| 2025-08-27 | NVDA | Inference | 37/58 | ✅ | 63% | 0.02 | +35 | NO | yes | -0.02 | -0.02 |
| 2025-08-27 | NVDA | Networking | 28/58 | ✅ | 49% | 0.05 | +46 | NO | yes | -0.05 | -0.05 |
| 2025-08-27 | NVDA | Omniverse | 17/58 | ✅ | 31% | 0.12 | +57 | NO | yes | -0.12 | -0.12 |
| 2025-08-27 | NVDA | Production | 49/58 | ✅ | 83% | 0.03 | +14 | NO | yes | -0.03 | -0.03 |
| 2025-08-27 | NVDA | Professional | 46/58 | ❌ | 77% | 0.64 | +13 | YES | yes | +0.36 | +0.35 |
| 2025-08-27 | NVDA | Robotic | 27/58 | ✅ | 47% | 0.06 | +47 | NO | yes | -0.06 | -0.06 |
| 2025-08-27 | NVDA | Sovereign | 7/58 | ✅ | 15% | 0.10 | +75 | NO | yes | -0.10 | -0.10 |
| 2025-09-10 | ORCL | Capital expenditure | 40/60 | ❌ | 65% | 0.01 | +64 | YES | no | -0.01 | -0.01 |
| 2025-09-10 | ORCL | Cloud infrastructure | 35/60 | ✅ | 58% | 0.10 | +32 | NO | yes | -0.10 | -0.10 |
| 2025-09-10 | ORCL | Healthcare AI | 0/60 | ❌ | 2% | 0.83 | +15 | NO | no | +0.17 | +0.16 |
| 2025-09-10 | ORCL | Multicloud | 1/60 | ❌ | 4% | 0.01 | +95 | NO | yes | -0.01 | -0.01 |
| 2025-09-10 | ORCL | RPO /  Remaining Performance Obligation | 20/60 | ✅ | 35% | 0.01 | +64 | NO | yes | -0.01 | -0.01 |
| 2025-09-10 | ORCL | SaaS momentum | 1/60 | ❌ | 4% | 0.83 | +13 | NO | no | +0.17 | +0.16 |
| 2025-09-17 | CBRL | Breakfast | 23/26 | ❌ | 81% | 0.71 | +10 | YES | yes | +0.29 | +0.28 |
| 2025-09-17 | CBRL | Location | 21/26 | ❌ | 75% | 0.30 | +45 | YES | yes | +0.70 | +0.68 |
| 2025-09-17 | CBRL | Logo | 0/26 | ❌ | 5% | 0.28 | +67 | NO | yes | -0.28 | -0.28 |
| 2025-09-17 | CBRL | Rebrand | 0/26 | ❌ | 5% | 0.70 | +25 | NO | no | +0.30 | +0.29 |
| 2025-09-17 | CBRL | Takeout | 0/26 | ❌ | 5% | 0.81 | +14 | NO | no | +0.19 | +0.18 |
| 2025-09-17 | CBRL | Tariff | 5/26 | ✅ | 25% | 0.16 | +59 | NO | yes | -0.16 | -0.16 |
| 2025-09-18 | FDX | Automation | 27/51 | ✅ | 53% | 0.26 | +21 | NO | no | +0.74 | +0.72 |
| 2025-09-18 | FDX | De Minimis | 2/51 | ✅ | 8% | 0.30 | +62 | NO | yes | -0.30 | -0.30 |
| 2025-09-18 | FDX | Labor | 26/51 | ❌ | 50% | 0.22 | +28 | YES | yes | +0.78 | +0.76 |
| 2025-09-18 | FDX | Smith | 42/51 | ✅ | 81% | 0.42 | +39 | YES | no | -0.42 | -0.42 |
| 2025-09-23 | MU | AI Application | 10/60 | ✅ | 19% | 0.10 | +71 | NO | yes | -0.10 | -0.10 |
| 2025-09-23 | MU | China | 37/60 | ❌ | 60% | 0.25 | +15 | NO | no | +0.75 | +0.73 |
| 2025-09-23 | MU | Cloud | 48/60 | ❌ | 77% | 0.45 | +32 | YES | yes | +0.55 | +0.53 |
| 2025-09-23 | MU | Expansion | 38/60 | ❌ | 62% | 0.21 | +17 | NO | yes | -0.21 | -0.21 |
| 2025-09-23 | MU | GPU | 11/60 | ✅ | 21% | 0.18 | +61 | NO | no | +0.82 | +0.80 |
| 2025-09-23 | MU | Idaho | 10/60 | ✅ | 19% | 0.19 | +62 | NO | yes | -0.19 | -0.19 |
| 2025-09-23 | MU | Nvidia | 16/60 | ✅ | 29% | 0.24 | +47 | NO | yes | -0.24 | -0.24 |
| 2025-09-23 | MU | Supply Chain | 29/60 | ✅ | 49% | 0.38 | +13 | NO | no | +0.62 | +0.60 |
| 2025-09-23 | MU | Trump | 0/60 | ✅ | 4% | 0.82 | +14 | NO | no | +0.18 | +0.17 |
| 2025-09-25 | COST | Expansion | 51/60 | ✅ | 83% | 0.73 | +10 | YES | yes | +0.27 | +0.26 |
| 2025-09-25 | COST | Hot Dog | 13/60 | ✅ | 24% | 0.60 | +16 | NO | yes | -0.60 | -0.60 |
| 2025-09-25 | COST | Inflation | 53/60 | ✅ | 86% | 0.01 | +13 | NO | yes | -0.01 | -0.01 |
| 2025-09-25 | COST | Inventory | 53/60 | ✅ | 86% | 0.02 | +12 | NO | yes | -0.02 | -0.02 |
| 2025-09-25 | COST | Kirkland | 42/60 | ✅ | 69% | 0.02 | +29 | NO | yes | -0.02 | -0.02 |
| 2025-09-25 | COST | Revenue | 26/60 | ❌ | 43% | 0.36 | +21 | NO | yes | -0.36 | -0.36 |
| 2025-09-25 | COST | Spending | 37/60 | ✅ | 61% | 0.16 | +23 | NO | yes | -0.16 | -0.16 |
| 2025-09-25 | COST | Tariff | 10/60 | ✅ | 19% | 0.08 | +73 | NO | yes | -0.08 | -0.08 |
| 2025-09-30 | NKE | Amazon | 8/60 | ✅ | 16% | 0.27 | +57 | NO | yes | -0.27 | -0.27 |
| 2025-09-30 | NKE | Consumer Demand | 43/60 | ❌ | 69% | 0.42 | +27 | YES | no | -0.42 | -0.42 |
| 2025-09-30 | NKE | Direct to Consumer / DTC | 36/60 | ❌ | 59% | 0.21 | +38 | YES | no | -0.21 | -0.21 |
| 2025-09-30 | NKE | Express Lane | 29/60 | ✅ | 49% | 0.27 | +24 | NO | yes | -0.27 | -0.27 |
| 2025-09-30 | NKE | Jordan | 53/60 | ✅ | 86% | 0.02 | +12 | NO | yes | -0.02 | -0.02 |
| 2025-09-30 | NKE | Nike Factory | 9/60 | ✅ | 18% | 0.27 | +55 | NO | yes | -0.27 | -0.27 |
| 2025-09-30 | NKE | Retailer | 34/60 | ❌ | 55% | 0.34 | +21 | YES | no | -0.34 | -0.34 |
| 2025-09-30 | NKE | Sabrina | 9/60 | ✅ | 18% | 0.40 | +42 | NO | yes | -0.40 | -0.40 |
| 2025-09-30 | NKE | Tariff | 6/60 | ✅ | 13% | 0.04 | +83 | NO | yes | -0.04 | -0.04 |
| 2025-09-30 | NKE | Tatum | 7/60 | ✅ | 15% | 0.48 | +37 | NO | no | +0.52 | +0.50 |
| 2025-10-09 | DAL | Fleet (3+ times) | 0/25 | ❌ | 5% | 0.27 | +68 | NO | yes | -0.27 | -0.27 |
| 2025-10-09 | DAL | Guidance | 22/25 | ✅ | 84% | 0.03 | +13 | NO | yes | -0.03 | -0.03 |
| 2025-10-09 | DAL | Holiday | 17/25 | ❌ | 64% | 0.06 | +30 | NO | no | +0.94 | +0.91 |
| 2025-10-09 | DAL | Nonstop / Non-Stop | 0/25 | ✅ | 8% | 0.55 | +37 | NO | no | +0.45 | +0.44 |
| 2025-10-09 | DAL | Partnership | 18/25 | ✅ | 70% | 0.11 | +19 | NO | yes | -0.11 | -0.11 |
| 2025-10-09 | DAL | Tariff | 6/25 | ✅ | 29% | 0.15 | +56 | NO | yes | -0.15 | -0.15 |
| 2025-10-09 | DAL | Weather | 13/25 | ✅ | 53% | 0.23 | +24 | NO | no | +0.77 | +0.75 |
| 2025-10-09 | DAL | YouTube | 1/25 | ❌ | 9% | 0.70 | +21 | NO | yes | -0.70 | -0.70 |
| 2025-10-09 | PEP | Artificial Color | 1/25 | ✅ | 12% | 0.46 | +42 | NO | no | +0.54 | +0.52 |
| 2025-10-09 | PEP | Away from Home | 14/25 | ✅ | 56% | 0.29 | +15 | NO | yes | -0.29 | -0.29 |
| 2025-10-09 | PEP | Celsius | 8/25 | ✅ | 36% | 0.30 | +34 | NO | no | +0.70 | +0.68 |
| 2025-10-09 | PEP | China | 16/25 | ✅ | 63% | 0.22 | +15 | NO | yes | -0.22 | -0.22 |
| 2025-10-09 | PEP | Food for Tomorrow | 0/25 | ❌ | 5% | 0.48 | +47 | NO | no | +0.52 | +0.50 |
| 2025-10-09 | PEP | Healthy | 19/25 | ✅ | 74% | 0.60 | +14 | YES | no | -0.60 | -0.60 |
| 2025-10-09 | PEP | Prebiotic | 0/25 | ❌ | 5% | 0.35 | +60 | NO | no | +0.65 | +0.63 |
| 2025-10-09 | PEP | Tariff | 1/25 | ✅ | 12% | 0.19 | +69 | NO | yes | -0.19 | -0.19 |
| 2025-10-10 | BLK | Digital asset | 8/20 | ✅ | 43% | 0.01 | +56 | NO | yes | -0.01 | -0.01 |
| 2025-10-10 | BLK | ETF inflow | 2/20 | ❌ | 15% | 0.01 | +84 | NO | yes | -0.01 | -0.01 |
| 2025-10-10 | BLK | HPS acquisition | 1/20 | ✅ | 14% | 0.26 | +60 | NO | no | +0.74 | +0.72 |
| 2025-10-10 | BLK | Record AUM | 5/20 | ✅ | 31% | 0.18 | +51 | NO | yes | -0.18 | -0.18 |
| 2025-10-10 | BLK | Revenue growth | 16/20 | ✅ | 76% | 0.01 | +75 | YES | no | -0.01 | -0.01 |
| 2025-10-14 | GS | Charge Off / Charge-Off | 20/25 | ✅ | 77% | 0.10 | +13 | NO | yes | -0.10 | -0.10 |
| 2025-10-14 | GS | Europe | 19/25 | ❌ | 70% | 0.33 | +37 | YES | no | -0.33 | -0.33 |
| 2025-10-14 | GS | Inflation | 19/25 | ❌ | 70% | 0.40 | +30 | YES | no | -0.40 | -0.40 |
| 2025-10-14 | GS | Marcus | 18/25 | ❌ | 67% | 0.17 | +50 | YES | no | -0.17 | -0.17 |
| 2025-10-14 | GS | Regulation | 6/25 | ❌ | 26% | 0.06 | +20 | YES | no | -0.06 | -0.06 |
| 2025-10-14 | GS | Tariff | 1/25 | ✅ | 12% | 0.34 | +54 | NO | no | +0.66 | +0.64 |
| 2025-10-14 | JPM | Blockchain | 5/41 | ❌ | 14% | 0.01 | +13 | YES | no | -0.01 | -0.01 |
| 2025-10-14 | JPM | Buyback | 26/41 | ✅ | 63% | 0.01 | +36 | NO | yes | -0.01 | -0.01 |
| 2025-10-14 | JPM | Fintech | 11/41 | ✅ | 30% | 0.01 | +29 | YES | no | -0.01 | -0.01 |
| 2025-10-14 | JPM | Geopolitical | 9/41 | ❌ | 23% | 0.01 | +22 | YES | no | -0.01 | -0.01 |
| 2025-10-14 | JPM | Hiring | 11/41 | ❌ | 28% | 0.01 | +71 | NO | yes | -0.01 | -0.01 |
| 2025-10-14 | JPM | Inflation | 19/41 | ❌ | 45% | 0.01 | +54 | NO | yes | -0.01 | -0.01 |
| 2025-10-14 | JPM | M&A | 34/41 | ✅ | 81% | 0.01 | +18 | NO | yes | -0.01 | -0.01 |
| 2025-10-14 | JPM | Private Credit | 10/41 | ✅ | 28% | 0.01 | +71 | NO | yes | -0.01 | -0.01 |
| 2025-10-14 | JPM | Recession | 22/41 | ❌ | 52% | 0.01 | +51 | YES | no | -0.01 | -0.01 |
| 2025-10-14 | JPM | Regulation | 17/41 | ✅ | 43% | 0.01 | +42 | YES | no | -0.01 | -0.01 |
| 2025-10-14 | JPM | Tariff | 2/41 | ✅ | 10% | 0.01 | +89 | NO | yes | -0.01 | -0.01 |
| 2025-10-14 | JPM | Trading | 36/41 | ✅ | 85% | 0.01 | +14 | NO | yes | -0.01 | -0.01 |
| 2025-10-15 | BAC | Buyback | 35/60 | ✅ | 58% | 0.20 | +22 | NO | no | +0.80 | +0.78 |
| 2025-10-15 | BAC | Commercial Real Estate | 41/60 | ✅ | 68% | 0.10 | +22 | NO | yes | -0.10 | -0.10 |
| 2025-10-15 | BAC | Consecutive | 42/60 | ✅ | 69% | 0.08 | +23 | NO | yes | -0.08 | -0.08 |
| 2025-10-15 | BAC | Digital | 41/60 | ✅ | 68% | 0.04 | +28 | NO | yes | -0.04 | -0.04 |
| 2025-10-15 | BAC | Efficiency | 42/60 | ✅ | 69% | 0.08 | +23 | NO | yes | -0.08 | -0.08 |
| 2025-10-15 | BAC | Momentum | 37/60 | ✅ | 61% | 0.13 | +26 | NO | yes | -0.13 | -0.13 |
| 2025-10-15 | BAC | Margin | 50/60 | ❌ | 80% | 0.57 | +23 | YES | yes | +0.43 | +0.42 |
| 2025-10-15 | BAC | Recession | 23/60 | ✅ | 40% | 0.31 | +29 | NO | no | +0.69 | +0.67 |
| 2025-10-15 | BAC | Tariff | 2/60 | ✅ | 7% | 0.21 | +72 | NO | yes | -0.21 | -0.21 |
| 2025-10-16 | UAL | ATC | 3/21 | ✅ | 22% | 0.29 | +49 | NO | yes | -0.29 | -0.29 |
| 2025-10-16 | UAL | Holiday | 8/21 | ❌ | 38% | 0.26 | +36 | NO | yes | -0.26 | -0.26 |
| 2025-10-16 | UAL | JetBlue | 3/21 | ✅ | 22% | 0.36 | +42 | NO | no | +0.64 | +0.62 |
| 2025-10-16 | UAL | Newark | 15/21 | ✅ | 69% | 0.08 | +23 | NO | yes | -0.08 | -0.08 |
| 2025-10-16 | UAL | On-Time / On Time | 11/21 | ✅ | 53% | 0.13 | +34 | NO | yes | -0.13 | -0.13 |
| 2025-10-16 | UAL | Record | 18/21 | ✅ | 81% | 0.06 | +13 | NO | no | +0.94 | +0.91 |
| 2025-10-16 | UAL | Shutdown / Shut Down | 5/21 | ❌ | 26% | 0.25 | +49 | NO | yes | -0.25 | -0.25 |
| 2025-10-16 | UAL | Starlink (3+ times) | 0/21 | ❌ | 6% | 0.38 | +56 | NO | yes | -0.38 | -0.38 |
| 2025-10-16 | UAL | Tariff | 2/21 | ✅ | 18% | 0.31 | +51 | NO | no | +0.69 | +0.67 |
| 2025-10-16 | UAL | Union | 10/21 | ✅ | 49% | 0.18 | +31 | YES | yes | +0.82 | +0.80 |
| 2025-10-17 | AXP | Coinbase | 0/55 | ✅ | 4% | 0.52 | +44 | NO | no | +0.48 | +0.47 |
| 2025-10-17 | AXP | Currency | 14/55 | ✅ | 28% | 0.50 | +22 | NO | no | +0.50 | +0.48 |
| 2025-10-17 | AXP | Dunkin | 1/55 | ❌ | 4% | 0.82 | +14 | NO | yes | -0.82 | -0.82 |
| 2025-10-17 | AXP | Lounge | 26/55 | ✅ | 48% | 0.35 | +17 | NO | yes | -0.35 | -0.35 |
| 2025-10-17 | AXP | Millennial | 24/55 | ✅ | 45% | 0.02 | +53 | NO | yes | -0.02 | -0.02 |
| 2025-10-17 | AXP | Regulation | 24/55 | ✅ | 45% | 0.29 | +16 | YES | no | -0.29 | -0.29 |
| 2025-10-17 | AXP | Stablecoin | 1/55 | ✅ | 6% | 0.52 | +42 | NO | no | +0.48 | +0.47 |
| 2025-10-21 | KO | Acquisition | 28/41 | ❌ | 65% | 0.01 | +64 | YES | no | -0.01 | -0.01 |
| 2025-10-21 | KO | Dividend | 32/41 | ❌ | 74% | 0.04 | +70 | YES | no | -0.04 | -0.04 |
| 2025-10-21 | KO | Influencer | 5/41 | ✅ | 16% | 0.01 | +15 | YES | no | -0.01 | -0.01 |
| 2025-10-21 | KO | International | 11/41 | ✅ | 30% | 0.01 | +69 | NO | yes | -0.01 | -0.01 |
| 2025-10-21 | KO | Retro | 0/41 | ❌ | 3% | 0.01 | +96 | NO | yes | -0.01 | -0.01 |
| 2025-10-21 | KO | Supply Chain | 34/41 | ❌ | 79% | 0.01 | +20 | NO | yes | -0.01 | -0.01 |
| 2025-10-21 | NFLX | Acquisition | 43/60 | ✅ | 71% | 0.15 | +14 | NO | yes | -0.15 | -0.15 |
| 2025-10-21 | NFLX | Ad Supported | 1/60 | ❌ | 4% | 0.47 | +49 | NO | no | +0.53 | +0.51 |
| 2025-10-21 | NFLX | Churn | 47/60 | ❌ | 76% | 0.34 | +42 | YES | no | -0.34 | -0.34 |
| 2025-10-21 | NFLX | Engagement | 40/60 | ✅ | 66% | 0.02 | +32 | NO | yes | -0.02 | -0.02 |
| 2025-10-21 | NFLX | Gaming | 18/60 | ✅ | 32% | 0.35 | +33 | NO | yes | -0.35 | -0.35 |
| 2025-10-21 | NFLX | Hollywood | 19/60 | ✅ | 33% | 0.49 | +18 | NO | yes | -0.49 | -0.49 |
| 2025-10-21 | NFLX | Live Event | 10/60 | ✅ | 19% | 0.08 | +73 | NO | yes | -0.08 | -0.08 |
| 2025-10-21 | NFLX | Partnership | 34/60 | ✅ | 57% | 0.30 | +13 | NO | yes | -0.30 | -0.30 |
| 2025-10-21 | NFLX | Profitable | 29/60 | ✅ | 49% | 0.23 | +28 | NO | yes | -0.23 | -0.23 |
| 2025-10-21 | NFLX | Subscriber | 56/60 | ❌ | 90% | 0.68 | +22 | YES | no | -0.68 | -0.68 |
| 2025-10-22 | TSLA | Autonomous | 31/59 | ✅ | 53% | 0.04 | +43 | NO | yes | -0.04 | -0.04 |
| 2025-10-22 | TSLA | Competition | 10/59 | ✅ | 20% | 0.54 | +26 | NO | yes | -0.54 | -0.54 |
| 2025-10-22 | TSLA | Cybertruck | 22/59 | ❌ | 37% | 0.17 | +46 | NO | no | +0.83 | +0.81 |
| 2025-10-22 | TSLA | Delivery | 45/59 | ✅ | 75% | 0.10 | +15 | NO | yes | -0.10 | -0.10 |
| 2025-10-22 | TSLA | Energy | 46/59 | ✅ | 77% | 0.03 | +20 | NO | yes | -0.03 | -0.03 |
| 2025-10-22 | TSLA | FSD / Full Self Driving | 24/59 | ✅ | 42% | 0.04 | +54 | NO | yes | -0.04 | -0.04 |
| 2025-10-22 | TSLA | Gigafactory | 33/59 | ❌ | 55% | 0.30 | +15 | NO | no | +0.70 | +0.68 |
| 2025-10-22 | TSLA | Grok4 | 0/59 | ❌ | 2% | 0.72 | +26 | NO | no | +0.28 | +0.27 |
| 2025-10-22 | TSLA | Optimus | 13/59 | ✅ | 24% | 0.05 | +71 | NO | yes | -0.05 | -0.05 |
| 2025-10-22 | TSLA | Regulator / Regulatory / Regulation | 45/59 | ✅ | 75% | 0.07 | +18 | NO | yes | -0.07 | -0.07 |
| 2025-10-22 | TSLA | Supercharger / Super Charger | 30/59 | ❌ | 50% | 0.30 | +20 | YES | yes | +0.70 | +0.68 |
| 2025-10-22 | TSLA | Robotaxi | 18/59 | ✅ | 32% | 0.03 | +65 | NO | yes | -0.03 | -0.03 |
| 2025-10-23 | AAL | AT&T | 2/21 | ❌ | 14% | 0.64 | +22 | NO | yes | -0.64 | -0.64 |
| 2025-10-23 | AAL | ATC | 3/21 | ✅ | 22% | 0.36 | +42 | NO | no | +0.64 | +0.62 |
| 2025-10-23 | AAL | Centennial | 0/21 | ❌ | 6% | 0.54 | +40 | NO | no | +0.46 | +0.45 |
| 2025-10-23 | AAL | Lavazza | 0/21 | ❌ | 6% | 0.48 | +46 | NO | yes | -0.48 | -0.48 |
| 2025-10-23 | AAL | Shutdown / Shut Down | 3/21 | ❌ | 18% | 0.27 | +55 | NO | yes | -0.27 | -0.27 |
| 2025-10-23 | AAL | Tariff | 1/21 | ✅ | 14% | 0.55 | +31 | NO | no | +0.45 | +0.44 |
| 2025-10-23 | AAL | Weather | 9/21 | ✅ | 46% | 0.19 | +35 | NO | no | +0.81 | +0.79 |
| 2025-10-23 | AAL | World Cup | 1/21 | ❌ | 10% | 0.46 | +44 | NO | no | +0.54 | +0.52 |
| 2025-10-24 | PG | Competition | 35/43 | ❌ | 78% | 0.44 | +34 | YES | no | -0.44 | -0.44 |
| 2025-10-24 | PG | E-commerce | 32/43 | ✅ | 73% | 0.39 | +34 | YES | no | -0.39 | -0.39 |
| 2025-10-24 | PG | Inflation | 27/43 | ✅ | 62% | 0.16 | +22 | NO | no | +0.84 | +0.81 |
| 2025-10-24 | PG | Mason Campus | 0/43 | ❌ | 3% | 0.72 | +25 | NO | no | +0.28 | +0.27 |
| 2025-10-24 | PG | Revenue | 20/43 | ✅ | 48% | 0.37 | +11 | YES | no | -0.37 | -0.37 |
| 2025-10-24 | PG | Tariff | 7/43 | ✅ | 20% | 0.16 | +64 | NO | yes | -0.16 | -0.16 |
| 2025-10-28 | EA | Acquisition | 31/40 | ❌ | 74% | 0.01 | +73 | YES | no | -0.01 | -0.01 |
| 2025-10-28 | EA | Apex Legends | 26/40 | ✅ | 64% | 0.01 | +63 | YES | no | -0.01 | -0.01 |
| 2025-10-28 | EA | Competition | 33/40 | ✅ | 80% | 0.01 | +79 | YES | no | -0.01 | -0.01 |
| 2025-10-28 | EA | Player Engagement | 26/40 | ✅ | 64% | 0.01 | +63 | YES | no | -0.01 | -0.01 |
| 2025-10-28 | EA | Live Service | 40/40 | ✅ | 96% | 0.01 | +95 | YES | no | -0.01 | -0.01 |
| 2025-10-28 | EA | Mobile | 40/40 | ✅ | 96% | 0.01 | +95 | YES | no | -0.01 | -0.01 |
| 2025-10-28 | EA | The Sims | 40/40 | ✅ | 96% | 0.01 | +95 | YES | no | -0.01 | -0.01 |
| 2025-10-28 | EA | Skate | 16/40 | ✅ | 42% | 0.01 | +41 | YES | no | -0.01 | -0.01 |
| 2025-10-28 | EA | EA Sports FC | 13/40 | ✅ | 35% | 0.01 | +34 | YES | no | -0.01 | -0.01 |
| 2025-10-28 | EA | Underperformance | 5/40 | ❌ | 15% | 0.01 | +14 | YES | no | -0.01 | -0.01 |
| 2025-10-28 | PYPL | Bank | 38/39 | ✅ | 94% | 0.78 | +16 | YES | no | -0.78 | -0.78 |
| 2025-10-28 | PYPL | Biometric | 4/39 | ✅ | 15% | 0.51 | +34 | NO | yes | -0.51 | -0.51 |
| 2025-10-28 | PYPL | Blockchain | 4/39 | ✅ | 15% | 0.61 | +24 | NO | no | +0.39 | +0.38 |
| 2025-10-28 | PYPL | Blue Owl | 0/39 | ❌ | 4% | 0.34 | +62 | NO | yes | -0.34 | -0.34 |
| 2025-10-28 | PYPL | Cash Back | 3/39 | ❌ | 10% | 0.39 | +51 | NO | yes | -0.39 | -0.39 |
| 2025-10-28 | PYPL | Charge Off / Charge-Off | 10/39 | ✅ | 29% | 0.56 | +15 | NO | no | +0.44 | +0.43 |
| 2025-10-28 | PYPL | College | 0/39 | ✅ | 6% | 0.68 | +26 | NO | yes | -0.68 | -0.68 |
| 2025-10-28 | PYPL | Fintech | 4/39 | ✅ | 15% | 0.69 | +16 | NO | no | +0.31 | +0.30 |
| 2025-10-28 | PYPL | Google | 17/39 | ❌ | 43% | 0.25 | +32 | NO | yes | -0.25 | -0.25 |
| 2025-10-28 | PYPL | Hyperwallet | 8/39 | ✅ | 24% | 0.65 | +11 | NO | no | +0.35 | +0.34 |
| 2025-10-28 | PYPL | Stablecoin / Stable Coin | 3/39 | ✅ | 13% | 0.14 | +73 | NO | yes | -0.14 | -0.14 |
| 2025-10-28 | PYPL | Unprofitable | 4/39 | ✅ | 15% | 0.48 | +37 | NO | yes | -0.48 | -0.48 |
| 2025-10-29 | CMG | Autocado | 7/61 | ✅ | 14% | 0.33 | +53 | NO | no | +0.67 | +0.65 |
| 2025-10-29 | CMG | Automation | 9/61 | ❌ | 16% | 0.68 | +16 | NO | no | +0.32 | +0.31 |
| 2025-10-29 | CMG | Carne Asada | 16/61 | ❌ | 27% | 0.15 | +58 | NO | yes | -0.15 | -0.15 |
| 2025-10-29 | CMG | Chipotle Lane / Chipotlane | 26/61 | ✅ | 44% | 0.15 | +41 | NO | yes | -0.15 | -0.15 |
| 2025-10-29 | CMG | Honey Chicken | 3/61 | ✅ | 8% | 0.20 | +72 | NO | no | +0.80 | +0.78 |
| 2025-10-29 | CMG | Share Purchase | 2/61 | ✅ | 7% | 0.12 | +81 | NO | yes | -0.12 | -0.12 |
| 2025-10-29 | CMG | Shutdown / Shut Down | 1/61 | ❌ | 4% | 0.84 | +12 | NO | no | +0.16 | +0.16 |
| 2025-10-29 | CMG | Supply Chain | 35/61 | ✅ | 57% | 0.07 | +36 | NO | yes | -0.07 | -0.07 |
| 2025-10-29 | CMG | Transaction Growth | 25/61 | ✅ | 42% | 0.18 | +40 | NO | yes | -0.18 | -0.18 |
| 2025-10-29 | CMG | Wage Inflation | 36/61 | ✅ | 59% | 0.18 | +23 | NO | yes | -0.18 | -0.18 |
| 2025-10-29 | COINBASE | Crypto Winter | 7/17 | ❌ | 40% | 0.04 | +36 | YES | no | -0.04 | -0.04 |
| 2025-10-29 | COINBASE | Margin | 9/17 | ✅ | 54% | 0.17 | +29 | NO | yes | -0.17 | -0.17 |
| 2025-10-29 | COINBASE | Prediction Market | 1/17 | ✅ | 16% | 0.26 | +58 | NO | yes | -0.26 | -0.26 |
| 2025-10-29 | COINBASE | Stablecoin | 12/17 | ✅ | 68% | 0.06 | +26 | NO | yes | -0.06 | -0.06 |
| 2025-10-29 | COINBASE | Web3 | 10/17 | ❌ | 54% | 0.11 | +43 | YES | yes | +0.89 | +0.86 |
| 2025-10-29 | HOOD | Acquisition | 10/16 | ✅ | 62% | 0.21 | +17 | NO | yes | -0.21 | -0.21 |
| 2025-10-29 | HOOD | Blockchain | 1/16 | ✅ | 17% | 0.29 | +54 | NO | yes | -0.29 | -0.29 |
| 2025-10-29 | HOOD | Football | 0/16 | ❌ | 8% | 0.31 | +61 | NO | no | +0.69 | +0.67 |
| 2025-10-29 | HOOD | Prediction Market | 2/16 | ✅ | 22% | 0.07 | +71 | NO | yes | -0.07 | -0.07 |
| 2025-10-29 | HOOD | Social | 5/16 | ❌ | 32% | 0.24 | +44 | NO | yes | -0.24 | -0.24 |
| 2025-10-29 | HOOD | Tokenization | 1/16 | ✅ | 17% | 0.15 | +68 | NO | yes | -0.15 | -0.15 |
| 2025-10-29 | HOOD | Trading Volume | 11/16 | ✅ | 67% | 0.05 | +28 | NO | yes | -0.05 | -0.05 |
| 2025-10-29 | META | Algorithm | 11/52 | ✅ | 24% | 0.44 | +32 | NO | no | +0.56 | +0.54 |
| 2025-10-29 | META | Behemoth | 1/52 | ✅ | 6% | 0.78 | +16 | NO | no | +0.22 | +0.21 |
| 2025-10-29 | META | China | 23/52 | ❌ | 44% | 0.32 | +12 | YES | no | -0.32 | -0.32 |
| 2025-10-29 | META | Channel | 25/52 | ✅ | 49% | 0.33 | +16 | YES | no | -0.33 | -0.33 |
| 2025-10-29 | META | Cloud | 7/52 | ✅ | 17% | 0.36 | +47 | NO | yes | -0.36 | -0.36 |
| 2025-10-29 | META | Dividend | 9/52 | ✅ | 20% | 0.06 | +74 | NO | yes | -0.06 | -0.06 |
| 2025-10-29 | META | Hiring | 36/52 | ✅ | 68% | 0.17 | +15 | NO | yes | -0.17 | -0.17 |
| 2025-10-29 | META | Hyperion | 0/52 | ✅ | 4% | 0.24 | +72 | NO | no | +0.76 | +0.74 |
| 2025-10-29 | META | Llama | 9/52 | ✅ | 20% | 0.07 | +73 | NO | yes | -0.07 | -0.07 |
| 2025-10-29 | META | Maverick | 1/52 | ❌ | 4% | 0.79 | +17 | NO | no | +0.21 | +0.20 |
| 2025-10-29 | META | Oakley | 1/52 | ✅ | 6% | 0.20 | +74 | NO | yes | -0.20 | -0.20 |
| 2025-10-29 | META | Orion | 2/52 | ✅ | 8% | 0.31 | +61 | NO | yes | -0.31 | -0.31 |
| 2025-10-29 | META | Ray-Ban | 10/52 | ✅ | 22% | 0.04 | +74 | NO | yes | -0.04 | -0.04 |
| 2025-10-29 | META | Scout | 0/52 | ❌ | 3% | 0.87 | +10 | NO | no | +0.13 | +0.13 |
| 2025-10-29 | META | Threads | 13/52 | ✅ | 27% | 0.07 | +66 | NO | yes | -0.07 | -0.07 |
| 2025-10-29 | META | TikTok | 9/52 | ❌ | 19% | 0.67 | +14 | NO | no | +0.33 | +0.32 |
| 2025-10-29 | META | VR / Virtual Reality | 39/52 | ❌ | 72% | 0.62 | +10 | YES | no | -0.62 | -0.62 |
| 2025-10-29 | META | WhatsApp | 45/52 | ✅ | 85% | 0.02 | +13 | NO | yes | -0.02 | -0.02 |
| 2025-10-29 | MSFT | Activision | 11/60 | ❌ | 20% | 0.62 | +18 | NO | no | +0.38 | +0.37 |
| 2025-10-29 | MSFT | AI / Artificial Intelligence | 37/60 | ✅ | 61% | 0.02 | +37 | NO | yes | -0.02 | -0.02 |
| 2025-10-29 | MSFT | CapEx | 37/60 | ✅ | 61% | 0.10 | +29 | NO | yes | -0.10 | -0.10 |
| 2025-10-29 | MSFT | Copilot | 15/60 | ✅ | 27% | 0.04 | +69 | NO | yes | -0.04 | -0.04 |
| 2025-10-29 | MSFT | LinkedIn | 37/60 | ✅ | 61% | 0.04 | +35 | NO | yes | -0.04 | -0.04 |
| 2025-10-29 | MSFT | M365 / Microsoft 365 | 32/60 | ✅ | 54% | 0.06 | +40 | NO | yes | -0.06 | -0.06 |
| 2025-10-29 | MSFT | OpenAI | 20/60 | ✅ | 35% | 0.03 | +62 | NO | yes | -0.03 | -0.03 |
| 2025-10-29 | MSFT | Phi | 4/60 | ❌ | 9% | 0.54 | +37 | NO | yes | -0.54 | -0.54 |
| 2025-10-29 | MSFT | Shutdown / Shut Down | 3/60 | ❌ | 7% | 0.79 | +14 | NO | no | +0.21 | +0.20 |
| 2025-10-29 | MSFT | Stargate | 1/60 | ❌ | 4% | 0.83 | +13 | NO | no | +0.17 | +0.16 |
| 2025-10-29 | MSFT | Teams | 43/60 | ✅ | 71% | 0.07 | +22 | NO | yes | -0.07 | -0.07 |
| 2025-10-29 | SBUX | Canada | 16/42 | ✅ | 40% | 0.32 | +28 | NO | yes | -0.32 | -0.32 |
| 2025-10-29 | SBUX | Comparable Sales | 11/42 | ✅ | 29% | 0.30 | +41 | NO | no | +0.70 | +0.68 |
| 2025-10-29 | SBUX | Condiment Bar | 3/42 | ✅ | 12% | 0.31 | +57 | NO | yes | -0.31 | -0.31 |
| 2025-10-29 | SBUX | Non Dairy | 0/42 | ❌ | 3% | 0.56 | +41 | NO | yes | -0.56 | -0.56 |
| 2025-10-29 | SBUX | Oatmilk / Oat Milk | 6/42 | ❌ | 16% | 0.70 | +14 | NO | no | +0.30 | +0.29 |
| 2025-10-29 | SBUX | Promotion | 24/42 | ✅ | 57% | 0.21 | +22 | NO | yes | -0.21 | -0.21 |
| 2025-10-29 | SBUX | Protein | 8/42 | ✅ | 23% | 0.22 | +55 | NO | yes | -0.22 | -0.22 |
| 2025-10-29 | SBUX | Pumpkin Spice | 8/42 | ✅ | 23% | 0.46 | +31 | NO | no | +0.54 | +0.52 |
| 2025-10-29 | SBUX | Shutdown / Shut Down | 3/42 | ❌ | 10% | 0.77 | +13 | NO | no | +0.23 | +0.22 |
| 2025-10-29 | SBUX | Smart Queue / SmartQ | 0/42 | ✅ | 5% | 0.25 | +70 | NO | yes | -0.25 | -0.25 |
| 2025-10-29 | SBUX | Union | 2/42 | ❌ | 8% | 0.77 | +15 | NO | no | +0.23 | +0.22 |
| 2025-10-30 | AAPL | Apple Intelligence | 4/57 | ✅ | 10% | 0.02 | +88 | NO | yes | -0.02 | -0.02 |
| 2025-10-30 | AAPL | Formula 1 / F1 | 2/57 | ✅ | 7% | 0.28 | +65 | NO | yes | -0.28 | -0.28 |
| 2025-10-30 | AAPL | M3 | 5/57 | ❌ | 11% | 0.67 | +22 | NO | no | +0.33 | +0.32 |
| 2025-10-30 | AAPL | Manufacturing | 33/57 | ✅ | 58% | 0.29 | +13 | NO | yes | -0.29 | -0.29 |
| 2025-10-30 | AAPL | Modem | 5/57 | ❌ | 11% | 0.71 | +18 | NO | no | +0.29 | +0.28 |
| 2025-10-30 | AAPL | Siri | 29/57 | ✅ | 51% | 0.17 | +32 | NO | yes | -0.17 | -0.17 |
| 2025-10-30 | AAPL | Streaming | 17/57 | ✅ | 32% | 0.52 | +16 | NO | no | +0.48 | +0.47 |
| 2025-10-30 | AAPL | The Studio | 2/57 | ✅ | 7% | 0.09 | +84 | NO | yes | -0.09 | -0.09 |
| 2025-10-30 | AAPL | Wearable | 34/57 | ✅ | 60% | 0.07 | +33 | NO | yes | -0.07 | -0.07 |
| 2025-10-30 | AAPL | Widget | 1/57 | ✅ | 6% | 0.62 | +32 | NO | no | +0.38 | +0.37 |
| 2025-10-30 | AMZN | Alexa+ / Alexa Plus | 1/60 | ✅ | 5% | 0.06 | +89 | NO | yes | -0.06 | -0.06 |
| 2025-10-30 | AMZN | Amazon Bedrock | 7/60 | ✅ | 15% | 0.25 | +60 | NO | yes | -0.25 | -0.25 |
| 2025-10-30 | AMZN | China | 25/60 | ✅ | 43% | 0.28 | +29 | NO | no | +0.72 | +0.70 |
| 2025-10-30 | AMZN | Gen-AI / Gen AI / Generative AI | 9/60 | ✅ | 18% | 0.05 | +77 | NO | yes | -0.05 | -0.05 |
| 2025-10-30 | AMZN | Live Sports | 12/60 | ✅ | 22% | 0.25 | +53 | NO | yes | -0.25 | -0.25 |
| 2025-10-30 | AMZN | Operating Margin | 44/60 | ✅ | 72% | 0.03 | +25 | NO | yes | -0.03 | -0.03 |
| 2025-10-30 | AMZN | Project Kuiper | 5/60 | ✅ | 12% | 0.23 | +65 | NO | yes | -0.23 | -0.23 |
| 2025-10-30 | AMZN | Prime Day | 28/60 | ✅ | 47% | 0.08 | +45 | NO | yes | -0.08 | -0.08 |
| 2025-10-30 | AMZN | Robotics | 14/60 | ✅ | 26% | 0.05 | +69 | NO | yes | -0.05 | -0.05 |
| 2025-10-30 | AMZN | RxPass | 4/60 | ❌ | 9% | 0.81 | +10 | NO | no | +0.19 | +0.18 |
| 2025-10-30 | AMZN | Sponsored Products | 13/60 | ✅ | 24% | 0.32 | +44 | NO | yes | -0.32 | -0.32 |
| 2025-10-30 | AMZN | Supply Chain | 16/60 | ❌ | 27% | 0.37 | +36 | NO | no | +0.63 | +0.61 |
| 2025-10-30 | AMZN | Tariff | 1/60 | ✅ | 5% | 0.07 | +88 | NO | yes | -0.07 | -0.07 |
| 2025-10-30 | AMZN | Third Party Sellers | 1/60 | ❌ | 4% | 0.38 | +58 | NO | yes | -0.38 | -0.38 |
| 2025-10-30 | INTC | AIPC | 0/61 | ❌ | 2% | 0.17 | +81 | NO | yes | -0.17 | -0.17 |
| 2025-10-30 | INTC | Department of Defense | 5/61 | ❌ | 10% | 0.62 | +28 | NO | no | +0.38 | +0.37 |
| 2025-10-30 | INTC | Intel Foundry | 14/61 | ✅ | 25% | 0.09 | +66 | NO | yes | -0.09 | -0.09 |
| 2025-10-30 | INTC | Nvidia | 6/61 | ✅ | 13% | 0.07 | +80 | NO | yes | -0.07 | -0.07 |
| 2025-10-30 | INTC | Panther Lake | 8/61 | ✅ | 16% | 0.05 | +79 | NO | yes | -0.05 | -0.05 |
| 2025-10-30 | INTC | Personal Computing | 2/61 | ❌ | 5% | 0.83 | +12 | NO | no | +0.17 | +0.16 |
| 2025-10-30 | INTC | Security | 33/61 | ✅ | 54% | 0.20 | +26 | NO | yes | -0.20 | -0.20 |
| 2025-10-30 | INTC | Smart Factory | 0/61 | ❌ | 2% | 0.80 | +18 | NO | no | +0.20 | +0.19 |
| 2025-10-30 | INTC | Tariff | 6/61 | ❌ | 12% | 0.28 | +60 | NO | no | +0.72 | +0.70 |
| 2025-10-30 | INTC | Trump | 1/61 | ✅ | 5% | 0.55 | +40 | NO | yes | -0.55 | -0.55 |
| 2025-10-30 | RDDT | Election | 3/5 | ❌ | 48% | 0.17 | +31 | YES | no | -0.17 | -0.17 |
| 2025-10-30 | RDDT | Game | 3/5 | ✅ | 60% | 0.46 | +14 | YES | yes | +0.54 | +0.52 |
| 2025-10-30 | RDDT | OpenAI / Open AI | 4/5 | ❌ | 58% | 0.27 | +31 | YES | no | -0.27 | -0.27 |
| 2025-10-30 | RDDT | Reddit Pro (3+ times) | 0/5 | ❌ | 17% | 0.24 | +59 | NO | yes | -0.24 | -0.24 |
| 2025-10-30 | RDDT | Traffic | 5/5 | ✅ | 80% | 0.01 | +19 | NO | yes | -0.01 | -0.01 |
| 2025-10-30 | ROKU | Bundle (3+ times) | 0/31 | ❌ | 4% | 0.69 | +27 | NO | no | +0.31 | +0.30 |
| 2025-10-30 | ROKU | FreeWheel / Free Wheel | 0/31 | ❌ | 4% | 0.67 | +29 | NO | no | +0.33 | +0.32 |
| 2025-10-30 | ROKU | Holiday | 17/31 | ✅ | 55% | 0.32 | +23 | YES | no | -0.32 | -0.32 |
| 2025-10-30 | ROKU | Hour | 29/31 | ✅ | 89% | 0.53 | +36 | YES | yes | +0.47 | +0.46 |
| 2025-10-30 | ROKU | Howdy | 0/31 | ❌ | 4% | 0.27 | +69 | NO | yes | -0.27 | -0.27 |
| 2025-10-30 | ROKU | Roku City | 8/31 | ❌ | 27% | 0.19 | +54 | NO | no | +0.81 | +0.79 |
| 2025-10-30 | ROKU | Tariff | 5/31 | ❌ | 19% | 0.71 | +10 | NO | no | +0.29 | +0.28 |
| 2025-10-30 | UBER | Autonomous | 8/25 | ✅ | 36% | 0.13 | +51 | NO | yes | -0.13 | -0.13 |
| 2025-10-30 | UBER | Uber Copter | 0/25 | ❌ | 5% | 0.83 | +12 | NO | no | +0.17 | +0.16 |
| 2025-10-30 | UBER | Driver Incentives | 10/25 | ❌ | 40% | 0.17 | +23 | YES | no | -0.17 | -0.17 |
| 2025-10-30 | UBER | Freight | 16/25 | ❌ | 60% | 0.31 | +29 | YES | no | -0.31 | -0.31 |
| 2025-10-30 | UBER | Innovation | 20/25 | ❌ | 74% | 0.61 | +13 | YES | yes | +0.39 | +0.38 |
| 2025-10-30 | UBER | Joby | 3/25 | ❌ | 16% | 0.56 | +28 | NO | no | +0.44 | +0.43 |
| 2025-10-30 | UBER | Lucid | 0/25 | ✅ | 8% | 0.11 | +81 | NO | no | +0.89 | +0.86 |
| 2025-10-30 | UBER | Lyft | 15/25 | ❌ | 57% | 0.36 | +21 | YES | no | -0.36 | -0.36 |
| 2025-10-30 | UBER | Market Share | 11/25 | ❌ | 43% | 0.18 | +25 | YES | no | -0.18 | -0.18 |
| 2025-10-30 | UBER | Regulator / Regulatory / Regulation | 20/25 | ❌ | 74% | 0.61 | +13 | YES | no | -0.61 | -0.61 |
| 2025-10-30 | UBER | Safety | 15/25 | ✅ | 60% | 0.27 | +13 | NO | no | +0.73 | +0.71 |
| 2025-10-30 | UBER | Waymo | 5/25 | ✅ | 26% | 0.04 | +70 | NO | yes | -0.04 | -0.04 |
| 2025-11-03 | HIMS | Canada | 1/18 | ✅ | 16% | 0.16 | +68 | NO | yes | -0.16 | -0.16 |
| 2025-11-03 | HIMS | Europe | 1/18 | ✅ | 16% | 0.40 | +44 | NO | yes | -0.40 | -0.40 |
| 2025-11-03 | HIMS | FDA | 3/18 | ✅ | 25% | 0.23 | +52 | NO | yes | -0.23 | -0.23 |
| 2025-11-03 | HIMS | Lab Testing | 3/18 | ✅ | 25% | 0.08 | +67 | NO | yes | -0.08 | -0.08 |
| 2025-11-03 | HIMS | Peptide | 2/18 | ✅ | 20% | 0.24 | +56 | NO | yes | -0.24 | -0.24 |
| 2025-11-03 | HIMS | Regulation | 3/18 | ❌ | 20% | 0.50 | +30 | NO | no | +0.50 | +0.48 |
| 2025-11-03 | HIMS | Shutdown / Shut Down | 0/18 | ❌ | 7% | 0.82 | +11 | NO | no | +0.18 | +0.17 |
| 2025-11-03 | HIMS | Tariff | 1/18 | ✅ | 16% | 0.46 | +38 | NO | no | +0.54 | +0.52 |
| 2025-11-03 | HIMS | Testosterone | 4/18 | ✅ | 29% | 0.09 | +62 | NO | yes | -0.09 | -0.09 |
| 2025-11-03 | HIMS | Vitamin | 3/18 | ✅ | 25% | 0.16 | +59 | NO | yes | -0.16 | -0.16 |
| 2025-11-03 | HIMS | Zava | 0/18 | ✅ | 11% | 0.09 | +80 | NO | yes | -0.09 | -0.09 |
| 2025-11-03 | PLTR | AI Growth | 0/19 | ❌ | 7% | 0.83 | +10 | NO | no | +0.17 | +0.16 |
| 2025-11-03 | PLTR | Gotham Platform | 1/19 | ❌ | 11% | 0.78 | +11 | NO | no | +0.22 | +0.21 |
| 2025-11-03 | PLTR | Hadean | 0/19 | ❌ | 7% | 0.38 | +55 | NO | no | +0.62 | +0.60 |
| 2025-11-03 | PLTR | International | 17/19 | ✅ | 84% | 0.05 | +11 | NO | yes | -0.05 | -0.05 |
| 2025-11-03 | PLTR | Lethal | 4/19 | ✅ | 28% | 0.36 | +36 | NO | yes | -0.36 | -0.36 |
| 2025-11-03 | PLTR | Nvidia | 0/19 | ❌ | 7% | 0.09 | +84 | NO | no | +0.91 | +0.88 |
| 2025-11-03 | PLTR | Revenue guidance | 13/19 | ✅ | 67% | 0.06 | +27 | NO | yes | -0.06 | -0.06 |
| 2025-11-03 | PLTR | Shutdown / Shut Down | 0/19 | ❌ | 7% | 0.26 | +67 | NO | no | +0.74 | +0.72 |
| 2025-11-03 | PLTR | Warp Speed | 0/19 | ❌ | 7% | 0.19 | +74 | NO | yes | -0.19 | -0.19 |
| 2025-11-04 | GOOGL | Acquisition | 58/59 | ✅ | 96% | 0.77 | +19 | YES | yes | +0.23 | +0.22 |
| 2025-11-04 | GOOGL | AI / Artificial Intelligence | 40/59 | ✅ | 67% | 0.03 | +30 | NO | yes | -0.03 | -0.03 |
| 2025-11-04 | GOOGL | Antitrust | 1/59 | ❌ | 4% | 0.86 | +10 | NO | no | +0.14 | +0.14 |
| 2025-11-04 | GOOGL | DeepMind / Deep Mind | 20/59 | ❌ | 34% | 0.33 | +33 | NO | no | +0.67 | +0.65 |
| 2025-11-04 | GOOGL | EU / European Union | 2/59 | ❌ | 6% | 0.83 | +11 | NO | no | +0.17 | +0.16 |
| 2025-11-04 | GOOGL | Gemini | 9/59 | ✅ | 18% | 0.03 | +79 | NO | yes | -0.03 | -0.03 |
| 2025-11-04 | GOOGL | Pixel | 37/59 | ✅ | 62% | 0.08 | +30 | NO | yes | -0.08 | -0.08 |
| 2025-11-04 | GOOGL | Privacy | 26/59 | ❌ | 44% | 0.33 | +11 | YES | no | -0.33 | -0.33 |
| 2025-11-04 | GOOGL | Waymo | 33/59 | ✅ | 56% | 0.07 | +37 | NO | yes | -0.07 | -0.07 |
| 2025-11-04 | GOOGL | Wiz | 1/59 | ❌ | 4% | 0.69 | +27 | NO | no | +0.31 | +0.30 |
| 2025-11-05 | CELH | Alcohol | 1/32 | ❌ | 7% | 0.59 | +34 | NO | no | +0.41 | +0.40 |
| 2025-11-05 | CELH | Amazon | 25/32 | ✅ | 76% | 0.10 | +14 | NO | no | +0.90 | +0.87 |
| 2025-11-05 | CELH | Essential | 11/32 | ❌ | 35% | 0.33 | +32 | NO | yes | -0.33 | -0.33 |
| 2025-11-05 | CELH | High Noon | 0/32 | ❌ | 4% | 0.81 | +15 | NO | no | +0.19 | +0.18 |
| 2025-11-05 | CELH | Input Cost | 3/32 | ✅ | 15% | 0.74 | +11 | NO | no | +0.26 | +0.25 |
| 2025-11-05 | CELH | NFL | 0/32 | ✅ | 7% | 0.49 | +44 | NO | no | +0.51 | +0.49 |
| 2025-11-05 | CELH | PepsiCo | 16/32 | ✅ | 51% | 0.15 | +34 | NO | yes | -0.15 | -0.15 |
| 2025-11-05 | CELH | Tariff | 3/32 | ✅ | 15% | 0.40 | +45 | NO | yes | -0.40 | -0.40 |
| 2025-11-05 | LYFT | Competition | 12/25 | ✅ | 50% | 0.37 | +13 | NO | no | +0.63 | +0.61 |
| 2025-11-05 | LYFT | Expansion | 13/25 | ✅ | 53% | 0.19 | +28 | NO | no | +0.81 | +0.79 |
| 2025-11-05 | LYFT | FreeNow / Free Now | 1/25 | ✅ | 12% | 0.11 | +77 | NO | yes | -0.11 | -0.11 |
| 2025-11-05 | LYFT | International | 6/25 | ❌ | 26% | 0.64 | +10 | NO | yes | -0.64 | -0.64 |
| 2025-11-05 | LYFT | Membership | 11/25 | ❌ | 43% | 0.30 | +13 | YES | no | -0.30 | -0.30 |
| 2025-11-05 | LYFT | Mobileye | 3/25 | ❌ | 16% | 0.56 | +28 | NO | no | +0.44 | +0.43 |
| 2025-11-05 | LYFT | Waymo | 8/25 | ❌ | 33% | 0.10 | +57 | NO | yes | -0.10 | -0.10 |
| 2025-11-06 | DKNG | Canada | 9/21 | ❌ | 42% | 0.28 | +14 | YES | no | -0.28 | -0.28 |
| 2025-11-06 | DKNG | CFTC | 1/21 | ❌ | 10% | 0.43 | +47 | NO | no | +0.57 | +0.55 |
| 2025-11-06 | DKNG | Competitor | 20/21 | ✅ | 89% | 0.76 | +13 | YES | no | -0.76 | -0.76 |
| 2025-11-06 | DKNG | Feature | 16/21 | ✅ | 73% | 0.63 | +10 | YES | yes | +0.37 | +0.36 |
| 2025-11-06 | DKNG | Missouri | 3/21 | ✅ | 22% | 0.11 | +67 | NO | yes | -0.11 | -0.11 |
| 2025-11-06 | DKNG | NBC | 0/21 | ❌ | 6% | 0.35 | +59 | NO | no | +0.65 | +0.63 |
| 2025-11-06 | DKNG | Prediction | 5/21 | ✅ | 30% | 0.02 | +68 | NO | yes | -0.02 | -0.02 |
| 2025-11-06 | DKNG | Retention | 20/21 | ❌ | 85% | 0.67 | +18 | YES | yes | +0.33 | +0.32 |
| 2025-11-10 | CRWV | CrowdStrike / Crowd Strike | 0/1 | ❌ | 27% | 0.18 | +55 | NO | yes | -0.18 | -0.18 |
| 2025-11-10 | CRWV | Government | 0/1 | ✅ | 56% | 0.28 | +16 | NO | yes | -0.28 | -0.28 |
| 2025-11-10 | CRWV | Healthcare | 0/1 | ✅ | 56% | 0.27 | +17 | NO | no | +0.73 | +0.71 |
| 2025-11-10 | CRWV | Marimo | 0/1 | ❌ | 27% | 0.05 | +68 | NO | yes | -0.05 | -0.05 |
| 2025-11-10 | CRWV | Meta | 0/1 | ✅ | 56% | 0.09 | +35 | NO | yes | -0.09 | -0.09 |
| 2025-11-10 | CRWV | Nvidia | 1/1 | ✅ | 67% | 0.03 | +30 | NO | yes | -0.03 | -0.03 |
| 2025-11-10 | CRWV | Shutdown / Shut Down | 0/1 | ❌ | 27% | 0.55 | +18 | NO | no | +0.45 | +0.44 |
| 2025-11-10 | CRWV | Storage | 1/1 | ✅ | 67% | 0.04 | +29 | NO | yes | -0.04 | -0.04 |
| 2025-11-10 | RKLB | Golden Dome | 1/16 | ✅ | 17% | 0.12 | +71 | NO | yes | -0.12 | -0.12 |
| 2025-11-10 | RKLB | Japan | 3/16 | ❌ | 22% | 0.30 | +48 | NO | yes | -0.30 | -0.30 |
| 2025-11-10 | RKLB | Lunar | 5/16 | ❌ | 32% | 0.50 | +18 | NO | no | +0.50 | +0.48 |
| 2025-11-10 | RKLB | Mars | 14/16 | ✅ | 82% | 0.07 | +11 | NO | yes | -0.07 | -0.07 |
| 2025-11-10 | RKLB | Reusable | 12/16 | ✅ | 72% | 0.17 | +11 | NO | yes | -0.17 | -0.17 |
| 2025-11-10 | RKLB | Shutdown / Shut Down | 2/16 | ❌ | 18% | 0.60 | +22 | NO | yes | -0.60 | -0.60 |
| 2025-11-11 | CAVA | Automation | 4/9 | ❌ | 42% | 0.48 | +10 | NO | no | +0.52 | +0.50 |
| 2025-11-11 | CAVA | Dining | 8/9 | ✅ | 79% | 0.66 | +13 | YES | yes | +0.34 | +0.33 |
| 2025-11-11 | CAVA | Hyphen | 1/9 | ❌ | 19% | 0.37 | +44 | NO | no | +0.63 | +0.61 |
| 2025-11-11 | CAVA | Salmon | 1/9 | ✅ | 27% | 0.29 | +44 | NO | yes | -0.29 | -0.29 |
| 2025-11-11 | CAVA | Tariff | 2/9 | ✅ | 34% | 0.52 | +14 | NO | yes | -0.52 | -0.52 |
| 2025-11-11 | NBIS | Aether | 0/7 | ❌ | 14% | 0.25 | +61 | NO | yes | -0.25 | -0.25 |
| 2025-11-11 | NBIS | ClickHouse / Click House | 4/7 | ✅ | 58% | 0.11 | +31 | NO | no | +0.89 | +0.86 |
| 2025-11-11 | NBIS | Hyperscaler | 3/7 | ✅ | 49% | 0.33 | +18 | NO | no | +0.67 | +0.65 |
| 2025-11-11 | NBIS | Microsoft | 1/7 | ❌ | 23% | 0.03 | +74 | NO | yes | -0.03 | -0.03 |
| 2025-11-11 | NBIS | Neocloud | 1/7 | ❌ | 23% | 0.53 | +24 | NO | yes | -0.53 | -0.53 |
| 2025-11-11 | NBIS | Token | 1/7 | ❌ | 23% | 0.20 | +57 | NO | yes | -0.20 | -0.20 |
| 2025-11-11 | NBIS | TripleTen / Triple Ten | 2/7 | ✅ | 41% | 0.46 | +13 | NO | no | +0.54 | +0.52 |
| 2025-11-11 | NBIS | Uber | 5/7 | ✅ | 67% | 0.13 | +20 | NO | no | +0.87 | +0.84 |
| 2025-11-13 | DIS | Abu Dhabi | 1/61 | ✅ | 5% | 0.28 | +67 | NO | yes | -0.28 | -0.28 |
| 2025-11-13 | DIS | Acquisition | 50/61 | ✅ | 81% | 0.54 | +27 | YES | yes | +0.46 | +0.45 |
| 2025-11-13 | DIS | Buyback | 19/61 | ❌ | 32% | 0.16 | +16 | YES | no | -0.16 | -0.16 |
| 2025-11-13 | DIS | Competition | 28/61 | ✅ | 47% | 0.10 | +43 | NO | yes | -0.10 | -0.10 |
| 2025-11-13 | DIS | Cruise | 46/61 | ✅ | 74% | 0.02 | +24 | NO | yes | -0.02 | -0.02 |
| 2025-11-13 | DIS | DraftKings | 1/61 | ❌ | 4% | 0.21 | +75 | NO | no | +0.79 | +0.77 |
| 2025-11-13 | DIS | NFL Deal | 4/61 | ✅ | 10% | 0.64 | +26 | NO | no | +0.36 | +0.35 |
| 2025-11-13 | DIS | Subscriber | 52/61 | ✅ | 84% | 0.06 | +10 | NO | yes | -0.06 | -0.06 |
| 2025-11-13 | DIS | YouTube TV | 1/61 | ❌ | 4% | 0.44 | +52 | NO | no | +0.56 | +0.54 |
| 2025-11-13 | DIS | Zootopia | 20/61 | ✅ | 34% | 0.08 | +58 | NO | yes | -0.08 | -0.08 |
| 2025-11-18 | HD | Black Friday | 36/60 | ❌ | 59% | 0.09 | +32 | NO | yes | -0.09 | -0.09 |
| 2025-11-18 | HD | Shutdown / Shut Down | 1/60 | ❌ | 4% | 0.83 | +13 | NO | no | +0.17 | +0.16 |
| 2025-11-18 | HD | Synergy | 3/60 | ❌ | 7% | 0.45 | +48 | NO | yes | -0.45 | -0.45 |
| 2025-11-18 | HD | Tariff | 12/60 | ✅ | 22% | 0.14 | +64 | NO | yes | -0.14 | -0.14 |
| 2025-11-18 | HD | Volatility | 9/60 | ✅ | 18% | 0.35 | +47 | NO | no | +0.65 | +0.63 |
| 2025-11-19 | TGT | Black Friday | 19/49 | ❌ | 39% | 0.05 | +56 | NO | no | +0.95 | +0.92 |
| 2025-11-19 | TGT | Circle 360 | 6/49 | ✅ | 16% | 0.08 | +76 | NO | yes | -0.08 | -0.08 |
| 2025-11-19 | TGT | Inflation | 21/49 | ✅ | 44% | 0.24 | +32 | NO | no | +0.76 | +0.74 |
| 2025-11-19 | TGT | Labor | 33/49 | ✅ | 67% | 0.37 | +30 | YES | yes | +0.63 | +0.61 |
| 2025-11-19 | TGT | Netflix | 0/49 | ❌ | 3% | 0.36 | +61 | NO | no | +0.64 | +0.62 |
| 2025-11-19 | TGT | Revenue | 25/49 | ❌ | 50% | 0.37 | +13 | YES | no | -0.37 | -0.37 |
| 2025-11-19 | TGT | Shutdown / Shut Down | 3/49 | ❌ | 8% | 0.72 | +20 | NO | no | +0.28 | +0.27 |
| 2025-11-26 | DE | AI / Artificial Intelligence | 3/61 | ✅ | 8% | 0.52 | +40 | NO | no | +0.48 | +0.47 |
| 2025-11-26 | DE | Automation | 18/61 | ✅ | 31% | 0.41 | +28 | NO | yes | -0.41 | -0.41 |
| 2025-11-26 | DE | Efficiency | 29/61 | ✅ | 48% | 0.38 | +14 | NO | no | +0.62 | +0.60 |
| 2025-11-26 | DE | Manufacturing | 26/61 | ❌ | 42% | 0.34 | +24 | NO | no | +0.66 | +0.64 |
| 2025-11-26 | DE | Precision Upgrade | 5/61 | ❌ | 10% | 0.73 | +17 | NO | no | +0.27 | +0.26 |
| 2025-11-26 | DE | Tariff | 14/61 | ✅ | 25% | 0.02 | +73 | NO | yes | -0.02 | -0.02 |
| 2025-11-26 | DE | Warranty | 17/61 | ✅ | 30% | 0.29 | +41 | NO | yes | -0.29 | -0.29 |
| 2025-12-02 | CRWD | Consolidation | 19/25 | ✅ | 74% | 0.09 | +17 | NO | yes | -0.09 | -0.09 |
| 2025-12-02 | CRWD | Falcon Flex | 7/25 | ✅ | 32% | 0.04 | +64 | NO | yes | -0.04 | -0.04 |
| 2025-12-02 | CRWD | Gen AI / Generative AI | 8/25 | ✅ | 36% | 0.38 | +26 | NO | no | +0.62 | +0.60 |
| 2025-12-02 | CRWD | Hyperscaler | 7/25 | ✅ | 32% | 0.19 | +49 | NO | yes | -0.19 | -0.19 |
| 2025-12-02 | CRWD | Microsoft | 18/25 | ❌ | 67% | 0.30 | +37 | YES | no | -0.30 | -0.30 |
| 2025-12-02 | CRWD | Nvidia | 2/25 | ✅ | 15% | 0.19 | +66 | NO | yes | -0.19 | -0.19 |
| 2025-12-02 | CRWD | Outage | 5/25 | ✅ | 26% | 0.13 | +61 | NO | no | +0.87 | +0.84 |
| 2025-12-02 | MRVL | AWS / Amazon | 8/43 | ❌ | 20% | 0.64 | +16 | NO | yes | -0.64 | -0.64 |
| 2025-12-02 | MRVL | Electro-Optic / Electro Optic | 16/43 | ✅ | 39% | 0.05 | +56 | NO | yes | -0.05 | -0.05 |
| 2025-12-02 | MRVL | Hyperscaler | 19/43 | ✅ | 45% | 0.12 | +43 | NO | yes | -0.12 | -0.12 |
| 2025-12-02 | MRVL | LPO | 2/43 | ✅ | 9% | 0.48 | +43 | NO | yes | -0.48 | -0.48 |
| 2025-12-02 | MRVL | Microsoft | 7/43 | ✅ | 20% | 0.45 | +35 | NO | no | +0.55 | +0.53 |
| 2025-12-02 | MRVL | Storage | 40/43 | ✅ | 90% | 0.65 | +25 | YES | yes | +0.35 | +0.34 |
| 2025-12-03 | CRM | AgentForce / Agent Force | 4/60 | ✅ | 10% | 0.02 | +88 | NO | yes | -0.02 | -0.02 |
| 2025-12-03 | CRM | Consumption | 7/60 | ✅ | 15% | 0.17 | +68 | NO | yes | -0.17 | -0.17 |
| 2025-12-03 | CRM | Flex Credit | 1/60 | ✅ | 5% | 0.47 | +48 | NO | no | +0.53 | +0.51 |
| 2025-12-03 | CRM | Reasoning | 1/60 | ✅ | 5% | 0.65 | +30 | NO | yes | -0.65 | -0.65 |
| 2025-12-03 | CRM | Trillion | 18/60 | ❌ | 30% | 0.11 | +59 | NO | yes | -0.11 | -0.11 |
| 2025-12-03 | SNOW | Azure | 13/19 | ✅ | 67% | 0.56 | +11 | YES | no | -0.56 | -0.56 |
| 2025-12-03 | SNOW | Europe | 12/19 | ✅ | 62% | 0.48 | +14 | YES | no | -0.48 | -0.48 |
| 2025-12-03 | SNOW | Hiring | 18/19 | ✅ | 88% | 0.74 | +14 | YES | yes | +0.26 | +0.25 |
| 2025-12-03 | SNOW | Iceberg | 10/19 | ✅ | 54% | 0.11 | +35 | NO | no | +0.89 | +0.86 |
| 2025-12-03 | SNOW | Open Source | 2/19 | ✅ | 19% | 0.40 | +41 | NO | no | +0.60 | +0.58 |
| 2025-12-03 | SNOW | Repurchase | 10/19 | ✅ | 54% | 0.10 | +36 | NO | yes | -0.10 | -0.10 |
| 2025-12-03 | SNOW | Retention | 17/19 | ✅ | 84% | 0.06 | +10 | NO | yes | -0.06 | -0.06 |
| 2025-12-04 | HPE | Morpheus | 3/17 | ✅ | 26% | 0.25 | +49 | NO | yes | -0.25 | -0.25 |
| 2025-12-04 | HPE | Nvidia | 9/17 | ✅ | 54% | 0.11 | +35 | NO | yes | -0.11 | -0.11 |
| 2025-12-04 | HPE | Quantum | 1/17 | ✅ | 16% | 0.56 | +28 | NO | yes | -0.56 | -0.56 |
| 2025-12-04 | HPE | Supercomputing / Super Computing | 13/17 | ❌ | 68% | 0.21 | +11 | NO | yes | -0.21 | -0.21 |
| 2025-12-04 | HPE | Synergy | 1/17 | ✅ | 16% | 0.26 | +58 | NO | yes | -0.26 | -0.26 |
| 2025-12-04 | HPE | Tariff | 2/17 | ✅ | 21% | 0.35 | +44 | NO | no | +0.65 | +0.63 |
| 2025-12-04 | KR | AI / Artificial Intelligence | 7/20 | ✅ | 39% | 0.19 | +42 | NO | yes | -0.19 | -0.19 |
| 2025-12-04 | KR | Albertsons | 9/20 | ❌ | 44% | 0.14 | +30 | YES | yes | +0.86 | +0.83 |
| 2025-12-04 | KR | GLP-1 | 7/20 | ✅ | 39% | 0.27 | +34 | NO | yes | -0.27 | -0.27 |
| 2025-12-04 | KR | Holiday | 9/20 | ❌ | 44% | 0.08 | +48 | NO | yes | -0.08 | -0.08 |
| 2025-12-04 | KR | Instacart | 5/20 | ✅ | 31% | 0.31 | +38 | NO | yes | -0.31 | -0.31 |
| 2025-12-04 | KR | Personalization | 18/20 | ✅ | 85% | 0.44 | +41 | YES | no | -0.44 | -0.44 |
| 2025-12-04 | KR | Tariff | 3/20 | ✅ | 23% | 0.14 | +63 | NO | no | +0.86 | +0.83 |
| 2025-12-04 | KR | Traffic | 18/20 | ❌ | 81% | 0.44 | +37 | YES | yes | +0.56 | +0.54 |
| 2025-12-04 | ULTA | Diamond | 8/17 | ❌ | 45% | 0.32 | +13 | YES | no | -0.32 | -0.32 |
| 2025-12-04 | ULTA | Holiday | 15/17 | ✅ | 82% | 0.04 | +14 | NO | yes | -0.04 | -0.04 |
| 2025-12-04 | ULTA | Luxury | 12/17 | ❌ | 64% | 0.41 | +23 | YES | yes | +0.59 | +0.57 |
| 2025-12-04 | ULTA | Reward | 12/17 | ❌ | 64% | 0.45 | +19 | YES | no | -0.45 | -0.45 |
| 2025-12-04 | ULTA | Space NK | 0/17 | ✅ | 12% | 0.32 | +56 | NO | yes | -0.32 | -0.32 |
| 2025-12-04 | ULTA | Store Opening | 7/17 | ✅ | 45% | 0.35 | +20 | NO | no | +0.65 | +0.63 |
| 2025-12-04 | ULTA | Tariff | 2/17 | ✅ | 21% | 0.52 | +27 | NO | yes | -0.52 | -0.52 |
| 2025-12-04 | ULTA | Traffic | 16/17 | ❌ | 83% | 0.72 | +11 | YES | yes | +0.28 | +0.27 |
| 2025-12-04 | ULTA | Uncertainty | 9/17 | ✅ | 54% | 0.12 | +34 | NO | yes | -0.12 | -0.12 |
| 2025-12-04 | ULTA | Wicked | 1/17 | ❌ | 12% | 0.30 | +58 | NO | no | +0.70 | +0.68 |
| 2025-12-10 | ADBE | 3D | 27/56 | ✅ | 49% | 0.25 | +26 | NO | yes | -0.25 | -0.25 |
| 2025-12-10 | ADBE | Black Friday | 9/56 | ❌ | 17% | 0.30 | +53 | NO | no | +0.70 | +0.68 |
| 2025-12-10 | ADBE | Firefly Video | 4/56 | ✅ | 11% | 0.29 | +60 | NO | no | +0.71 | +0.69 |
| 2025-12-10 | ADBE | Generative AI / Gen AI | 11/56 | ✅ | 22% | 0.04 | +74 | NO | yes | -0.04 | -0.04 |
| 2025-12-10 | ADBE | Google Cloud | 0/56 | ❌ | 3% | 0.54 | +43 | NO | no | +0.46 | +0.45 |
| 2025-12-10 | ADBE | Humain | 0/56 | ❌ | 3% | 0.44 | +53 | NO | yes | -0.44 | -0.44 |
| 2025-12-10 | ADBE | Inference | 4/56 | ✅ | 11% | 0.64 | +25 | NO | no | +0.36 | +0.35 |
| 2025-12-10 | ADBE | LLM Optimizer | 0/56 | ✅ | 4% | 0.17 | +79 | NO | yes | -0.17 | -0.17 |
| 2025-12-10 | ADBE | Qualcomm | 5/56 | ❌ | 11% | 0.44 | +45 | NO | no | +0.56 | +0.54 |
| 2025-12-10 | ADBE | Semrush | 0/56 | ❌ | 3% | 0.09 | +88 | NO | yes | -0.09 | -0.09 |
| 2025-12-10 | ADBE | YouTube | 8/56 | ❌ | 16% | 0.44 | +40 | NO | yes | -0.44 | -0.44 |
| 2025-12-10 | CHWY | App | 10/21 | ✅ | 49% | 0.16 | +35 | NO | yes | -0.16 | -0.16 |
| 2025-12-10 | CHWY | Holiday | 16/21 | ✅ | 73% | 0.05 | +22 | NO | yes | -0.05 | -0.05 |
| 2025-12-10 | CHWY | Humanization | 5/21 | ✅ | 30% | 0.43 | +27 | NO | no | +0.57 | +0.55 |
| 2025-12-10 | CHWY | Inflation / Inflationary | 17/21 | ✅ | 77% | 0.67 | +10 | YES | yes | +0.33 | +0.32 |
| 2025-12-10 | CHWY | Insurance | 14/21 | ❌ | 62% | 0.38 | +24 | YES | no | -0.38 | -0.38 |
| 2025-12-10 | CHWY | International / Internationally | 9/21 | ❌ | 42% | 0.22 | +20 | YES | no | -0.22 | -0.22 |
| 2025-12-10 | CHWY | SmartEquine | 0/21 | ❌ | 6% | 0.07 | +87 | NO | yes | -0.07 | -0.07 |
| 2025-12-10 | CHWY | Supplement | 4/21 | ✅ | 26% | 0.36 | +38 | NO | no | +0.64 | +0.62 |
| 2025-12-10 | CHWY | Tariff | 3/21 | ✅ | 22% | 0.43 | +35 | NO | no | +0.57 | +0.55 |
| 2025-12-10 | ORCL | Air Force | 0/60 | ❌ | 2% | 0.81 | +17 | NO | no | +0.19 | +0.18 |
| 2025-12-10 | ORCL | Automation | 28/60 | ❌ | 46% | 0.36 | +18 | NO | no | +0.64 | +0.62 |
| 2025-12-10 | ORCL | Backlog | 16/60 | ✅ | 29% | 0.28 | +43 | NO | yes | -0.28 | -0.28 |
| 2025-12-10 | ORCL | Health | 33/60 | ❌ | 54% | 0.31 | +15 | NO | yes | -0.31 | -0.31 |
| 2025-12-10 | ORCL | Hyperscaler | 12/60 | ✅ | 22% | 0.29 | +49 | NO | yes | -0.29 | -0.29 |
| 2025-12-10 | ORCL | Multicloud | 1/60 | ❌ | 4% | 0.06 | +90 | NO | yes | -0.06 | -0.06 |
| 2025-12-10 | ORCL | OpenAI | 6/60 | ✅ | 13% | 0.09 | +78 | NO | yes | -0.09 | -0.09 |
| 2025-12-10 | ORCL | Partner | 25/60 | ✅ | 43% | 0.15 | +42 | NO | yes | -0.15 | -0.15 |
| 2025-12-10 | ORCL | Sovereign | 8/60 | ❌ | 15% | 0.62 | +23 | NO | no | +0.38 | +0.37 |
| 2025-12-10 | ORCL | Stargate | 2/60 | ❌ | 5% | 0.47 | +48 | NO | no | +0.53 | +0.51 |
| 2025-12-10 | ORCL | Tariff | 1/60 | ✅ | 5% | 0.70 | +25 | NO | no | +0.30 | +0.29 |
| 2025-12-11 | AVGO | Acquisition | 37/41 | ❌ | 85% | 0.02 | +83 | YES | no | -0.02 | -0.02 |
| 2025-12-11 | AVGO | Competition | 14/41 | ✅ | 36% | 0.02 | +34 | YES | no | -0.02 | -0.02 |
| 2025-12-11 | AVGO | Hyperscaler | 15/41 | ✅ | 39% | 0.01 | +60 | NO | yes | -0.01 | -0.01 |
| 2025-12-11 | AVGO | OpenAI | 0/41 | ❌ | 3% | 0.01 | +96 | NO | yes | -0.01 | -0.01 |
| 2025-12-11 | AVGO | Optic | 22/41 | ❌ | 52% | 0.03 | +45 | NO | yes | -0.03 | -0.03 |
| 2025-12-11 | AVGO | Organic | 12/41 | ❌ | 30% | 0.01 | +69 | NO | yes | -0.01 | -0.01 |
| 2025-12-11 | AVGO | Tomahawk 6 | 4/41 | ✅ | 14% | 0.01 | +85 | NO | yes | -0.01 | -0.01 |
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
| 2025-12-18 | NKE | Amazon | 9/61 | ✅ | 17% | 0.48 | +35 | NO | no | +0.52 | +0.50 |
| 2025-12-18 | NKE | Black Friday | 7/61 | ❌ | 13% | 0.09 | +78 | NO | yes | -0.09 | -0.09 |
| 2025-12-18 | NKE | Consumer Demand | 43/61 | ✅ | 70% | 0.24 | +46 | YES | no | -0.24 | -0.24 |
| 2025-12-18 | NKE | Direct to Consumer / DTC | 36/61 | ❌ | 58% | 0.16 | +42 | YES | no | -0.16 | -0.16 |
| 2025-12-18 | NKE | Dividend | 18/61 | ✅ | 31% | 0.39 | +30 | NO | no | +0.61 | +0.59 |
| 2025-12-18 | NKE | Express Lane | 30/61 | ✅ | 50% | 0.23 | +27 | NO | no | +0.77 | +0.75 |
| 2025-12-18 | NKE | Nike Factory | 10/61 | ✅ | 19% | 0.24 | +57 | NO | no | +0.76 | +0.74 |
| 2025-12-18 | NKE | Retailer | 34/61 | ❌ | 55% | 0.40 | +15 | YES | no | -0.40 | -0.40 |
| 2025-12-18 | NKE | Sabrina | 10/61 | ✅ | 19% | 0.29 | +52 | NO | yes | -0.29 | -0.29 |
| 2025-12-18 | NKE | Skims / NikeSKIMS | 1/61 | ✅ | 5% | 0.35 | +60 | NO | yes | -0.35 | -0.35 |
| 2025-12-18 | NKE | Stranger Thing | 0/61 | ❌ | 2% | 0.74 | +24 | NO | no | +0.26 | +0.25 |
| 2025-12-18 | NKE | Tariff | 7/61 | ✅ | 14% | 0.08 | +78 | NO | yes | -0.08 | -0.08 |
| 2026-01-13 | JPM | Crypto / Bitcoin | 0/42 | ❌ | 3% | 0.86 | +11 | NO | yes | -0.86 | -0.86 |
| 2026-01-13 | JPM | Geopolitical | 9/42 | ❌ | 23% | 0.42 | +35 | NO | yes | -0.42 | -0.42 |
| 2026-01-13 | JPM | Inflation | 19/42 | ✅ | 46% | 0.22 | +32 | NO | yes | -0.22 | -0.22 |
| 2026-01-13 | JPM | Private Credit | 11/42 | ✅ | 29% | 0.28 | +43 | NO | yes | -0.28 | -0.28 |
| 2026-01-13 | JPM | Recession | 22/42 | ❌ | 51% | 0.33 | +18 | YES | yes | +0.67 | +0.65 |
| 2026-01-13 | JPM | Tariff | 3/42 | ✅ | 12% | 0.34 | +54 | NO | no | +0.66 | +0.64 |
| 2026-01-14 | BAC | CashPro | 20/61 | ❌ | 33% | 0.37 | +30 | NO | yes | -0.37 | -0.37 |
| 2026-01-14 | BAC | Delinquency | 30/61 | ✅ | 50% | 0.15 | +35 | NO | yes | -0.15 | -0.15 |
| 2026-01-14 | BAC | Inflation | 21/61 | ✅ | 36% | 0.26 | +38 | NO | yes | -0.26 | -0.26 |
| 2026-01-14 | BAC | M&A | 23/61 | ✅ | 39% | 0.48 | +13 | NO | no | +0.52 | +0.50 |
| 2026-01-14 | BAC | Rate Cut | 15/61 | ✅ | 27% | 0.07 | +66 | NO | yes | -0.07 | -0.07 |
| 2026-01-14 | BAC | Tariff | 3/61 | ✅ | 8% | 0.39 | +53 | NO | yes | -0.39 | -0.39 |
| 2026-01-14 | WFC | AI / Artificial Intelligence | 7/26 | ✅ | 31% | 0.01 | +68 | NO | yes | -0.01 | -0.01 |
| 2026-01-14 | WFC | Buyback | 20/26 | ✅ | 74% | 0.01 | +73 | YES | no | -0.01 | -0.01 |
| 2026-01-14 | WFC | Delinquency | 5/26 | ❌ | 22% | 0.01 | +77 | NO | yes | -0.01 | -0.01 |
| 2026-01-14 | WFC | Inflation | 15/26 | ✅ | 58% | 0.01 | +41 | NO | yes | -0.01 | -0.01 |
| 2026-01-14 | WFC | Middle Market | 23/26 | ✅ | 84% | 0.01 | +15 | NO | yes | -0.01 | -0.01 |
| 2026-01-14 | WFC | Private Equity | 17/26 | ✅ | 64% | 0.01 | +35 | NO | yes | -0.01 | -0.01 |
| 2026-01-14 | WFC | Recession | 5/26 | ❌ | 22% | 0.01 | +21 | YES | no | -0.01 | -0.01 |
| 2026-01-14 | WFC | Severance | 10/26 | ✅ | 41% | 0.01 | +58 | NO | yes | -0.01 | -0.01 |
| 2026-01-14 | WFC | Tariff | 2/26 | ✅ | 15% | 0.01 | +14 | YES | no | -0.01 | -0.01 |
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
| 2026-01-21 | JNJ | Administration | 14/42 | ✅ | 36% | 0.15 | +49 | NO | yes | -0.15 | -0.15 |
| 2026-01-21 | JNJ | Carvykti | 16/42 | ✅ | 40% | 0.05 | +55 | NO | yes | -0.05 | -0.05 |
| 2026-01-21 | JNJ | Darzalex Faspro | 7/42 | ✅ | 20% | 0.33 | +47 | NO | no | +0.67 | +0.65 |
| 2026-01-21 | JNJ | Halda Therapeutics | 0/42 | ❌ | 3% | 0.12 | +85 | NO | yes | -0.12 | -0.12 |
| 2026-01-21 | JNJ | Nipocalimab / Lupus | 17/42 | ❌ | 40% | 0.33 | +27 | NO | yes | -0.33 | -0.33 |
| 2026-01-21 | JNJ | Ottava | 16/42 | ✅ | 40% | 0.06 | +54 | NO | yes | -0.06 | -0.06 |
| 2026-01-21 | JNJ | Rybrevant | 14/42 | ✅ | 36% | 0.05 | +59 | NO | yes | -0.05 | -0.05 |
| 2026-01-21 | JNJ | Trufill | 0/42 | ❌ | 3% | 0.49 | +48 | NO | no | +0.51 | +0.49 |
| 2026-01-21 | JNJ | Vaccine | 22/42 | ❌ | 51% | 0.22 | +29 | YES | no | -0.22 | -0.22 |
| 2026-01-21 | UAL | ATC / Air Traffic Control | 9/22 | ✅ | 44% | 0.37 | +19 | NO | yes | -0.37 | -0.37 |
| 2026-01-21 | UAL | Holiday | 8/22 | ✅ | 40% | 0.06 | +54 | NO | yes | -0.06 | -0.06 |
| 2026-01-21 | UAL | JetBlue | 4/22 | ❌ | 21% | 0.48 | +31 | NO | no | +0.52 | +0.50 |
| 2026-01-21 | UAL | Newark | 16/22 | ✅ | 71% | 0.15 | +14 | NO | yes | -0.15 | -0.15 |
| 2026-01-21 | UAL | Nonstop / Non-Stop | 10/22 | ❌ | 44% | 0.29 | +15 | YES | no | -0.29 | -0.29 |
| 2026-01-21 | UAL | On-Time / On Time | 12/22 | ✅ | 55% | 0.04 | +41 | NO | yes | -0.04 | -0.04 |
| 2026-01-21 | UAL | Shutdown / Shut Down | 5/22 | ✅ | 28% | 0.22 | +50 | NO | yes | -0.22 | -0.22 |
| 2026-01-21 | UAL | Starlink | 4/22 | ✅ | 25% | 0.13 | +62 | NO | yes | -0.13 | -0.13 |
| 2026-01-21 | UAL | Tariff | 3/22 | ❌ | 17% | 0.71 | +12 | NO | no | +0.29 | +0.28 |
| 2026-01-28 | GEV | Administration | 2/6 | ❌ | 34% | 0.23 | +11 | YES | yes | +0.77 | +0.75 |
| 2026-01-28 | GEV | China | 2/6 | ✅ | 45% | 0.30 | +25 | NO | no | +0.70 | +0.68 |
| 2026-01-28 | GEV | Data Center | 6/6 | ✅ | 82% | 0.07 | +11 | NO | yes | -0.07 | -0.07 |
| 2026-01-28 | GEV | Electricity | 5/6 | ✅ | 73% | 0.11 | +16 | NO | yes | -0.11 | -0.11 |
| 2026-01-28 | GEV | Nuclear | 4/6 | ✅ | 64% | 0.08 | +28 | NO | yes | -0.08 | -0.08 |
| 2026-01-28 | GEV | Tariff | 2/6 | ✅ | 45% | 0.17 | +38 | NO | yes | -0.17 | -0.17 |
| 2026-03-02 | PSKY | Antitrust / FTC / DOJ | 1/19 | ❌ | 11% | 0.31 | +58 | NO | yes | -0.31 | -0.31 |
| 2026-03-02 | PSKY | CNN | 0/19 | ❌ | 7% | 0.28 | +65 | NO | yes | -0.28 | -0.28 |
| 2026-03-02 | PSKY | HBO | 2/19 | ✅ | 19% | 0.14 | +67 | NO | yes | -0.14 | -0.14 |
| 2026-03-02 | PSKY | Investment Grade | 1/19 | ✅ | 15% | 0.11 | +74 | NO | yes | -0.11 | -0.11 |
| 2026-03-02 | PSKY | RedBird | 2/19 | ❌ | 15% | 0.19 | +66 | NO | yes | -0.19 | -0.19 |
| 2026-03-02 | PSKY | Regulation / Regulatory | 5/19 | ❌ | 28% | 0.03 | +69 | NO | yes | -0.03 | -0.03 |
| 2026-03-02 | PSKY | Synergy | 1/19 | ❌ | 11% | 0.07 | +82 | NO | yes | -0.07 | -0.07 |
| 2026-03-02 | PSKY | Trump / Administration | 0/19 | ❌ | 7% | 0.70 | +23 | NO | no | +0.30 | +0.29 |
| 2026-03-31 | ABNB | Domestic | 14/20 | ✅ | 68% | 0.10 | +22 | NO | yes | -0.10 | -0.10 |
| 2026-03-31 | ABNB | Holiday | 5/20 | ❌ | 27% | 0.62 | +11 | NO | no | +0.38 | +0.37 |
| 2026-03-31 | ABNB | Home Sharing | 3/20 | ❌ | 19% | 0.66 | +15 | NO | no | +0.34 | +0.33 |
| 2026-03-31 | ABNB | Service Agent | 7/20 | ✅ | 39% | 0.14 | +47 | NO | yes | -0.14 | -0.14 |
| 2026-03-31 | ABNB | Social Media | 10/20 | ❌ | 48% | 0.12 | +40 | NO | yes | -0.12 | -0.12 |
| 2026-03-31 | DELL | AI Factory | 3/19 | ✅ | 24% | 0.10 | +66 | NO | yes | -0.10 | -0.10 |
| 2026-03-31 | DELL | China | 6/19 | ❌ | 32% | 0.22 | +10 | YES | no | -0.22 | -0.22 |
| 2026-03-31 | DELL | Dell Pro Max | 1/19 | ❌ | 11% | 0.65 | +24 | NO | no | +0.35 | +0.34 |
| 2026-03-31 | DELL | Dividend (3+ times) | 0/19 | ❌ | 7% | 0.50 | +43 | NO | no | +0.50 | +0.48 |
| 2026-03-31 | DELL | EPS Growth | 10/19 | ✅ | 54% | 0.16 | +30 | NO | yes | -0.16 | -0.16 |
| 2026-03-31 | DELL | New Product | 6/19 | ❌ | 32% | 0.36 | +32 | NO | no | +0.64 | +0.62 |
| 2026-03-31 | DELL | Nvidia (5+ times) | 0/19 | ❌ | 7% | 0.50 | +43 | NO | no | +0.50 | +0.48 |
| 2026-03-31 | DELL | RTX Pro 6000 | 2/19 | ❌ | 15% | 0.41 | +44 | NO | no | +0.59 | +0.57 |
| 2026-03-31 | DELL | Windows 10 | 8/19 | ❌ | 41% | 0.15 | +44 | NO | no | +0.85 | +0.82 |
| 2026-03-31 | DELL | Zoho | 0/19 | ❌ | 7% | 0.69 | +24 | NO | no | +0.31 | +0.30 |
| 2026-03-31 | MCD | Competition | 35/62 | ✅ | 57% | 0.01 | +56 | YES | no | -0.01 | -0.01 |
| 2026-03-31 | MCD | Delivery | 46/62 | ❌ | 72% | 0.05 | +23 | NO | yes | -0.05 | -0.05 |
| 2026-03-31 | MCD | Dividend | 41/62 | ✅ | 66% | 0.01 | +33 | NO | yes | -0.01 | -0.01 |
| 2026-03-31 | MCD | Happy Meal | 17/62 | ❌ | 28% | 0.02 | +70 | NO | yes | -0.02 | -0.02 |
| 2026-03-31 | MCD | Loyalty | 35/62 | ✅ | 57% | 0.01 | +42 | NO | yes | -0.01 | -0.01 |
| 2026-03-31 | MCD | McCrispy Chicken | 9/62 | ❌ | 16% | 0.03 | +13 | YES | no | -0.03 | -0.03 |
| 2026-03-31 | MCD | Monopoly | 16/62 | ✅ | 28% | 0.01 | +71 | NO | yes | -0.01 | -0.01 |
| 2026-03-31 | MCD | Revenue | 29/62 | ✅ | 48% | 0.05 | +43 | YES | no | -0.05 | -0.05 |
| 2026-03-31 | MCD | Speedee Lab | 1/62 | ❌ | 4% | 0.86 | +10 | NO | no | +0.14 | +0.14 |
| 2026-03-31 | MCD | Supply Chain | 34/62 | ✅ | 55% | 0.01 | +44 | NO | yes | -0.01 | -0.01 |
| 2026-03-31 | MCD | Tariff | 4/62 | ❌ | 8% | 0.01 | +91 | NO | yes | -0.01 | -0.01 |
| 2026-03-31 | MU | Automation | 22/63 | ❌ | 35% | 0.19 | +16 | YES | no | -0.19 | -0.19 |
| 2026-03-31 | MU | Gaming | 27/63 | ❌ | 42% | 0.15 | +27 | YES | no | -0.15 | -0.15 |
| 2026-03-31 | MU | Hyperscaler | 7/63 | ❌ | 13% | 0.61 | +26 | NO | no | +0.39 | +0.38 |
| 2026-03-31 | MU | Layoff | 0/63 | ❌ | 2% | 0.87 | +11 | NO | no | +0.13 | +0.13 |
| 2026-03-31 | MU | New York | 10/63 | ✅ | 18% | 0.61 | +21 | NO | no | +0.39 | +0.38 |
| 2026-03-31 | MU | Nvidia | 18/63 | ✅ | 30% | 0.58 | +12 | NO | no | +0.42 | +0.41 |
| 2026-03-31 | MU | Taiwan | 33/63 | ❌ | 51% | 0.38 | +13 | YES | no | -0.38 | -0.38 |
| 2026-03-31 | MU | Tariff | 13/63 | ❌ | 22% | 0.37 | +41 | NO | no | +0.63 | +0.61 |
| 2026-03-31 | NVDA | Arizona | 2/61 | ❌ | 5% | 0.35 | +60 | NO | no | +0.65 | +0.63 |
| 2026-03-31 | NVDA | Automation | 14/61 | ❌ | 24% | 0.44 | +32 | NO | yes | -0.44 | -0.44 |
| 2026-03-31 | NVDA | Cosmos | 4/61 | ✅ | 10% | 0.36 | +54 | NO | yes | -0.36 | -0.36 |
| 2026-03-31 | NVDA | Domestic | 10/61 | ❌ | 18% | 0.55 | +27 | NO | no | +0.45 | +0.44 |
| 2026-03-31 | NVDA | GM / General Motors | 4/61 | ❌ | 8% | 0.78 | +14 | NO | no | +0.22 | +0.21 |
| 2026-03-31 | NVDA | H20 | 4/61 | ❌ | 8% | 0.09 | +83 | NO | yes | -0.09 | -0.09 |
| 2026-03-31 | NVDA | Humanoid | 4/61 | ❌ | 8% | 0.38 | +54 | NO | no | +0.62 | +0.60 |
| 2026-03-31 | NVDA | Hyperscaler | 25/61 | ✅ | 42% | 0.17 | +41 | NO | yes | -0.17 | -0.17 |
| 2026-03-31 | NVDA | Omniverse | 20/61 | ✅ | 34% | 0.15 | +51 | NO | yes | -0.15 | -0.15 |
| 2026-03-31 | NVDA | Self Driving | 0/61 | ❌ | 2% | 0.39 | +59 | NO | yes | -0.39 | -0.39 |
| 2026-03-31 | NVDA | Talent | 4/61 | ✅ | 10% | 0.49 | +41 | NO | no | +0.51 | +0.49 |
| 2026-03-31 | NVDA | Tariff | 3/61 | ❌ | 7% | 0.59 | +34 | NO | no | +0.41 | +0.40 |
| 2026-03-31 | NVDA | Trump | 1/61 | ❌ | 4% | 0.59 | +37 | NO | no | +0.41 | +0.40 |
| 2026-03-31 | NVDA | TSMC | 21/61 | ❌ | 35% | 0.29 | +36 | NO | yes | -0.29 | -0.29 |
| 2026-03-31 | NVDA | VR / Virtual Reality | 23/61 | ❌ | 38% | 0.15 | +23 | YES | no | -0.15 | -0.15 |
| 2026-03-31 | SNAP | China | 2/19 | ❌ | 15% | 0.69 | +16 | NO | no | +0.31 | +0.30 |
| 2026-03-31 | SNAP | Game | 10/19 | ✅ | 54% | 0.14 | +32 | NO | yes | -0.14 | -0.14 |
| 2026-03-31 | SNAP | Glasses | 9/19 | ✅ | 49% | 0.23 | +28 | NO | yes | -0.23 | -0.23 |
| 2026-03-31 | SNAP | Lens | 17/19 | ✅ | 84% | 0.05 | +11 | NO | yes | -0.05 | -0.05 |
| 2026-03-31 | SNAP | Platinum | 1/19 | ❌ | 11% | 0.66 | +23 | NO | yes | -0.66 | -0.66 |
| 2026-03-31 | SNAP | Retention | 13/19 | ✅ | 67% | 0.13 | +20 | NO | yes | -0.13 | -0.13 |
| 2026-03-31 | SNAP | Shutdown / Shut Down | 0/19 | ❌ | 7% | 0.79 | +14 | NO | no | +0.21 | +0.20 |
| 2026-03-31 | SNAP | Spectacles | 11/19 | ✅ | 58% | 0.14 | +28 | NO | yes | -0.14 | -0.14 |
| 2026-03-31 | SNAP | Storage | 1/19 | ✅ | 15% | 0.32 | +53 | NO | yes | -0.32 | -0.32 |
| 2026-03-31 | SNAP | Tariff | 1/19 | ❌ | 11% | 0.71 | +18 | NO | no | +0.29 | +0.28 |
| 2026-03-31 | SNAP | Xbox | 0/19 | ❌ | 7% | 0.28 | +65 | NO | no | +0.72 | +0.70 |
| 2026-03-31 | WMT | Automotive | 15/58 | ❌ | 27% | 0.33 | +40 | NO | yes | -0.33 | -0.33 |
| 2026-03-31 | WMT | Automation | 25/58 | ✅ | 44% | 0.12 | +44 | NO | yes | -0.12 | -0.12 |
| 2026-03-31 | WMT | Brick and Mortar | 2/58 | ❌ | 6% | 0.44 | +50 | NO | no | +0.56 | +0.54 |
| 2026-03-31 | WMT | Dividend | 39/58 | ❌ | 65% | 0.36 | +29 | YES | yes | +0.64 | +0.62 |
| 2026-03-31 | WMT | Omnichannel | 24/58 | ✅ | 43% | 0.32 | +25 | NO | yes | -0.32 | -0.32 |
| 2026-03-31 | WMT | OnePay / One Pay | 2/58 | ✅ | 7% | 0.23 | +70 | NO | yes | -0.23 | -0.23 |
| 2026-03-31 | WMT | OpenAI | 1/58 | ✅ | 5% | 0.25 | +70 | NO | yes | -0.25 | -0.25 |
| 2026-03-31 | WMT | Prescription | 23/58 | ❌ | 39% | 0.41 | +20 | NO | no | +0.59 | +0.57 |
| 2026-03-31 | WMT | Shutdown / Shut Down | 4/58 | ✅ | 10% | 0.62 | +28 | NO | no | +0.38 | +0.37 |
| 2026-03-31 | WMT | Skip | 5/58 | ❌ | 10% | 0.79 | +11 | NO | no | +0.21 | +0.20 |
| 2026-03-31 | WMT | SNAP | 12/58 | ❌ | 22% | 0.44 | +34 | NO | no | +0.56 | +0.54 |
| 2026-03-31 | WMT | Tariff | 32/58 | ✅ | 55% | 0.05 | +40 | NO | yes | -0.05 | -0.05 |
| 2026-03-31 | WMT | Upper Income | 1/58 | ❌ | 4% | 0.42 | +54 | NO | no | +0.58 | +0.56 |
| 2026-04-07 | LEVI | AI / Artificial Intelligence | 15/58 | ✅ | 28% | 0.24 | +48 | NO | yes | -0.24 | -0.24 |
| 2026-04-07 | LEVI | Beyoncé | 0/58 | ❌ | 2% | 0.67 | +31 | NO | no | +0.33 | +0.32 |
| 2026-04-07 | LEVI | Beyond Yoga | 17/58 | ✅ | 31% | 0.05 | +64 | NO | yes | -0.05 | -0.05 |
| 2026-04-07 | LEVI | China | 56/58 | ❌ | 93% | 0.75 | +18 | YES | yes | +0.25 | +0.24 |
| 2026-04-07 | LEVI | Dockers | 51/58 | ❌ | 85% | 0.70 | +15 | YES | yes | +0.30 | +0.29 |
| 2026-04-07 | LEVI | Jordan | 25/58 | ❌ | 43% | 0.32 | +25 | NO | yes | -0.32 | -0.32 |
| 2026-04-07 | LEVI | Nike | 7/58 | ✅ | 15% | 0.47 | +38 | NO | yes | -0.47 | -0.47 |
| 2026-04-07 | LEVI | Super Bowl | 7/58 | ✅ | 15% | 0.33 | +52 | NO | yes | -0.33 | -0.33 |
| 2026-04-07 | LEVI | Tariff | 10/58 | ✅ | 20% | 0.04 | +76 | NO | yes | -0.04 | -0.04 |
| 2026-04-07 | LEVI | World Cup | 0/58 | ✅ | 4% | 0.34 | +62 | NO | yes | -0.34 | -0.34 |
| 2026-04-07 | LEVI | Zalando | 3/58 | ❌ | 7% | 0.74 | +19 | NO | no | +0.26 | +0.25 |
| 2026-04-09 | STZ | Aluminum | 11/42 | ✅ | 29% | 0.25 | +46 | NO | yes | -0.25 | -0.25 |
| 2026-04-09 | STZ | Cannabis | 23/42 | ✅ | 55% | 0.19 | +36 | YES | no | -0.19 | -0.19 |
| 2026-04-09 | STZ | Dividend | 36/42 | ❌ | 81% | 0.58 | +23 | YES | yes | +0.42 | +0.41 |
| 2026-04-09 | STZ | Especial | 40/42 | ❌ | 90% | 0.50 | +40 | YES | yes | +0.50 | +0.48 |
| 2026-04-09 | STZ | Holiday | 33/42 | ✅ | 77% | 0.10 | +67 | YES | no | -0.10 | -0.10 |
| 2026-04-09 | STZ | ICE | 1/42 | ❌ | 5% | 0.81 | +14 | NO | no | +0.19 | +0.18 |
| 2026-04-09 | STZ | Inflation | 25/42 | ❌ | 58% | 0.32 | +10 | NO | no | +0.68 | +0.66 |
| 2026-04-09 | STZ | Inventory | 37/42 | ✅ | 85% | 0.72 | +13 | YES | yes | +0.28 | +0.27 |
| 2026-04-09 | STZ | Tariff | 8/42 | ✅ | 23% | 0.07 | +70 | NO | yes | -0.07 | -0.07 |
| 2026-04-09 | STZ | Wine | 41/42 | ❌ | 92% | 0.75 | +17 | YES | yes | +0.25 | +0.24 |
| 2026-04-13 | GS | Geopolitical | 16/27 | ✅ | 59% | 0.25 | +16 | NO | yes | -0.25 | -0.25 |
| 2026-04-13 | GS | IPO | 21/27 | ✅ | 75% | 0.06 | +19 | NO | yes | -0.06 | -0.06 |
| 2026-04-13 | GS | Marcus | 18/27 | ✅ | 66% | 0.38 | +28 | YES | yes | +0.62 | +0.60 |
| 2026-04-13 | GS | Pipeline | 14/27 | ❌ | 50% | 0.31 | +19 | YES | yes | +0.69 | +0.67 |
| 2026-04-13 | GS | Tariff | 2/27 | ❌ | 11% | 0.64 | +25 | NO | no | +0.36 | +0.35 |
| 2026-04-14 | C | Banamex | 6/16 | ✅ | 42% | 0.13 | +45 | NO | yes | -0.13 | -0.13 |
| 2026-04-14 | C | Basel 3 | 0/16 | ❌ | 8% | 0.31 | +61 | NO | yes | -0.31 | -0.31 |
| 2026-04-14 | C | Credit Card | 9/16 | ✅ | 57% | 0.22 | +21 | NO | yes | -0.22 | -0.22 |
| 2026-04-14 | C | Headcount | 6/16 | ✅ | 42% | 0.43 | +15 | NO | yes | -0.43 | -0.43 |
| 2026-04-14 | C | Inflation | 7/16 | ✅ | 47% | 0.30 | +23 | NO | yes | -0.30 | -0.30 |
| 2026-04-14 | C | Iran | 0/16 | ❌ | 8% | 0.69 | +23 | NO | no | +0.31 | +0.30 |
| 2026-04-14 | C | Oil | 4/16 | ❌ | 27% | 0.42 | +31 | NO | no | +0.58 | +0.56 |
| 2026-04-14 | C | Tariff | 4/16 | ❌ | 27% | 0.36 | +37 | NO | no | +0.64 | +0.62 |
| 2026-04-14 | JNJ | Administration | 15/43 | ✅ | 37% | 0.34 | +29 | NO | no | +0.66 | +0.64 |
| 2026-04-14 | JNJ | AI / Artificial Intelligence | 7/43 | ❌ | 18% | 0.45 | +37 | NO | no | +0.55 | +0.53 |
| 2026-04-14 | JNJ | Carvykti | 17/43 | ✅ | 41% | 0.07 | +52 | NO | yes | -0.07 | -0.07 |
| 2026-04-14 | JNJ | Darzalex Faspro | 8/43 | ❌ | 20% | 0.44 | +36 | NO | yes | -0.44 | -0.44 |
| 2026-04-14 | JNJ | Halda Therapeutics | 0/43 | ✅ | 5% | 0.33 | +62 | NO | yes | -0.33 | -0.33 |
| 2026-04-14 | JNJ | Nipocalimab / Lupus | 17/43 | ✅ | 41% | 0.35 | +24 | NO | no | +0.65 | +0.63 |
| 2026-04-14 | JNJ | Ottava | 17/43 | ✅ | 41% | 0.07 | +52 | NO | yes | -0.07 | -0.07 |
| 2026-04-14 | JNJ | Rybrevant | 15/43 | ✅ | 37% | 0.05 | +58 | NO | yes | -0.05 | -0.05 |
| 2026-04-14 | JNJ | Tariff | 5/43 | ✅ | 16% | 0.05 | +79 | NO | yes | -0.05 | -0.05 |
| 2026-04-14 | JNJ | Trufill | 0/43 | ❌ | 3% | 0.82 | +15 | NO | no | +0.18 | +0.17 |
| 2026-04-14 | JNJ | Vaccine | 22/43 | ❌ | 50% | 0.20 | +30 | YES | no | -0.20 | -0.20 |
| 2026-04-14 | JPM | Basel 3 | 0/43 | ❌ | 3% | 0.21 | +76 | NO | yes | -0.21 | -0.21 |
| 2026-04-14 | JPM | Blockchain | 5/43 | ✅ | 16% | 0.52 | +32 | NO | no | +0.48 | +0.47 |
| 2026-04-14 | JPM | Buyback | 28/43 | ❌ | 63% | 0.19 | +18 | NO | yes | -0.19 | -0.19 |
| 2026-04-14 | JPM | Crypto / Bitcoin | 0/43 | ✅ | 5% | 0.59 | +36 | NO | no | +0.41 | +0.40 |
| 2026-04-14 | JPM | Fintech | 12/43 | ✅ | 31% | 0.55 | +14 | NO | no | +0.45 | +0.44 |
| 2026-04-14 | JPM | Geopolitical | 9/43 | ✅ | 24% | 0.31 | +45 | NO | yes | -0.31 | -0.31 |
| 2026-04-14 | JPM | Hiring | 12/43 | ✅ | 31% | 0.30 | +39 | NO | no | +0.70 | +0.68 |
| 2026-04-14 | JPM | Inflation | 20/43 | ✅ | 48% | 0.13 | +39 | NO | no | +0.87 | +0.84 |
| 2026-04-14 | JPM | Private Credit | 12/43 | ✅ | 31% | 0.11 | +58 | NO | yes | -0.11 | -0.11 |
| 2026-04-14 | JPM | Recession | 22/43 | ✅ | 52% | 0.34 | +14 | NO | yes | -0.34 | -0.34 |
| 2026-04-14 | JPM | Regulation | 18/43 | ✅ | 43% | 0.26 | +31 | NO | yes | -0.26 | -0.26 |
| 2026-04-14 | JPM | Tariff | 4/43 | ❌ | 12% | 0.43 | +45 | NO | no | +0.57 | +0.55 |
| 2026-04-14 | WFC | AI / Artificial Intelligence | 8/27 | ✅ | 34% | 0.26 | +40 | NO | yes | -0.26 | -0.26 |
| 2026-04-14 | WFC | Basel 3 | 0/27 | ❌ | 5% | 0.34 | +61 | NO | yes | -0.34 | -0.34 |
| 2026-04-14 | WFC | Buyback | 21/27 | ✅ | 75% | 0.47 | +28 | YES | no | -0.47 | -0.47 |
| 2026-04-14 | WFC | Delinquency | 5/27 | ❌ | 21% | 0.39 | +40 | NO | yes | -0.39 | -0.39 |
| 2026-04-14 | WFC | Inflation | 16/27 | ✅ | 59% | 0.20 | +21 | NO | no | +0.80 | +0.78 |
| 2026-04-14 | WFC | Iran | 0/27 | ❌ | 5% | 0.75 | +20 | NO | no | +0.25 | +0.24 |
| 2026-04-14 | WFC | Oil | 6/27 | ❌ | 24% | 0.62 | +14 | NO | yes | -0.62 | -0.62 |
| 2026-04-14 | WFC | Private Equity | 18/27 | ✅ | 66% | 0.49 | +17 | YES | yes | +0.51 | +0.49 |
| 2026-04-14 | WFC | Recession | 5/27 | ❌ | 21% | 0.57 | +22 | NO | no | +0.43 | +0.42 |
| 2026-04-14 | WFC | Severance | 11/27 | ✅ | 43% | 0.29 | +28 | NO | yes | -0.29 | -0.29 |
| 2026-04-14 | WFC | Tariff | 3/27 | ❌ | 15% | 0.50 | +35 | NO | no | +0.50 | +0.48 |
| 2026-04-15 | BAC | Basel 3 | 0/62 | ❌ | 2% | 0.27 | +71 | NO | yes | -0.27 | -0.27 |
| 2026-04-15 | BAC | CashPro | 20/62 | ✅ | 34% | 0.21 | +45 | NO | no | +0.79 | +0.77 |
| 2026-04-15 | BAC | Delinquency | 31/62 | ✅ | 51% | 0.18 | +31 | NO | yes | -0.18 | -0.18 |
| 2026-04-15 | BAC | Erica | 27/62 | ✅ | 44% | 0.05 | +51 | NO | yes | -0.05 | -0.05 |
| 2026-04-15 | BAC | Inflation | 22/62 | ✅ | 37% | 0.28 | +35 | NO | yes | -0.28 | -0.28 |
| 2026-04-15 | BAC | Iran | 0/62 | ❌ | 2% | 0.75 | +23 | NO | no | +0.25 | +0.24 |
| 2026-04-15 | BAC | Oil | 12/62 | ❌ | 20% | 0.28 | +52 | NO | no | +0.72 | +0.70 |
| 2026-04-15 | BAC | Pipeline | 36/62 | ✅ | 58% | 0.31 | +11 | NO | yes | -0.31 | -0.31 |
| 2026-04-15 | BAC | Rate Cut | 16/62 | ✅ | 28% | 0.15 | +57 | NO | yes | -0.15 | -0.15 |
| 2026-04-15 | BAC | Tariff | 4/62 | ✅ | 10% | 0.52 | +38 | NO | yes | -0.52 | -0.52 |
| 2026-04-15 | MS | Basel | 12/27 | ✅ | 46% | 0.27 | +27 | NO | yes | -0.27 | -0.27 |
| 2026-04-15 | MS | Investment Grade | 13/27 | ❌ | 47% | 0.19 | +34 | NO | yes | -0.19 | -0.19 |
| 2026-04-15 | MS | Iran | 0/27 | ❌ | 5% | 0.67 | +28 | NO | no | +0.33 | +0.32 |
| 2026-04-15 | MS | Oil | 3/27 | ❌ | 15% | 0.44 | +41 | NO | no | +0.56 | +0.54 |
| 2026-04-15 | MS | Private Credit | 14/27 | ✅ | 53% | 0.10 | +37 | NO | yes | -0.10 | -0.10 |
| 2026-04-15 | MS | Recession | 8/27 | ❌ | 31% | 0.55 | +14 | NO | no | +0.45 | +0.44 |
| 2026-04-15 | MS | Tailwind | 13/27 | ✅ | 50% | 0.28 | +22 | NO | no | +0.72 | +0.70 |
| 2026-04-15 | MS | Tariff | 2/27 | ❌ | 11% | 0.77 | +12 | NO | no | +0.23 | +0.22 |
| 2026-04-15 | MS | Tokenized / Tokenization | 1/27 | ✅ | 11% | 0.51 | +38 | NO | yes | -0.51 | -0.51 |
| 2026-04-15 | MS | Zero Hash | 1/27 | ✅ | 11% | 0.50 | +39 | NO | yes | -0.50 | -0.50 |
| 2026-04-15 | PGR | AI / Artificial Intelligence | 6/49 | ✅ | 16% | 0.05 | +79 | NO | yes | -0.05 | -0.05 |
| 2026-04-15 | PGR | Buyback | 4/49 | ❌ | 10% | 0.03 | +87 | NO | no | +0.97 | +0.94 |
| 2026-04-15 | PGR | Catastrophe | 19/49 | ✅ | 40% | 0.21 | +39 | NO | no | +0.79 | +0.77 |
| 2026-04-15 | PGR | Headwind | 9/49 | ✅ | 21% | 0.01 | +20 | YES | yes | +0.99 | +0.96 |
| 2026-04-15 | PGR | Hippo | 0/49 | ❌ | 3% | 0.81 | +16 | NO | no | +0.19 | +0.18 |
| 2026-04-15 | PGR | Inflation | 27/49 | ✅ | 55% | 0.05 | +40 | NO | yes | -0.05 | -0.05 |
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
| 2026-04-16 | NFLX | Warner Bros. / Warner Brothers | 5/62 | ✅ | 11% | 0.21 | +68 | NO | yes | -0.21 | -0.21 |
| 2026-04-16 | NFLX | WWE | 9/62 | ❌ | 16% | 0.63 | +21 | NO | no | +0.37 | +0.36 |
| 2026-04-16 | PEP | Acquisition | 14/27 | ✅ | 53% | 0.10 | +37 | NO | no | +0.90 | +0.87 |
| 2026-04-16 | PEP | Artificial Color | 2/27 | ❌ | 11% | 0.69 | +20 | NO | yes | -0.69 | -0.69 |
| 2026-04-16 | PEP | Away from Home | 16/27 | ✅ | 59% | 0.28 | +13 | NO | yes | -0.28 | -0.28 |
| 2026-04-16 | PEP | Celsius | 9/27 | ✅ | 37% | 0.36 | +27 | NO | yes | -0.36 | -0.36 |
| 2026-04-16 | PEP | China | 18/27 | ✅ | 66% | 0.15 | +19 | NO | no | +0.85 | +0.82 |
| 2026-04-16 | PEP | Food for Tomorrow | 0/27 | ❌ | 5% | 0.85 | +10 | NO | no | +0.15 | +0.15 |
| 2026-04-16 | PEP | GLP-1 | 4/27 | ✅ | 21% | 0.28 | +51 | NO | no | +0.72 | +0.70 |
| 2026-04-16 | PEP | Nvidia | 0/27 | ❌ | 5% | 0.84 | +11 | NO | no | +0.16 | +0.16 |
| 2026-04-16 | PEP | Pickle | 0/27 | ❌ | 5% | 0.84 | +11 | NO | no | +0.16 | +0.16 |
| 2026-04-16 | PEP | Prebiotic | 1/27 | ✅ | 11% | 0.34 | +55 | NO | no | +0.66 | +0.64 |
| 2026-04-16 | PEP | Tariff | 3/27 | ❌ | 15% | 0.34 | +51 | NO | no | +0.66 | +0.64 |
| 2026-04-17 | ALLY | AI / Artificial Intelligence | 2/19 | ✅ | 19% | 0.03 | +78 | NO | no | +0.97 | +0.94 |
| 2026-04-17 | ALLY | EV / Electric | 10/19 | ✅ | 54% | 0.25 | +21 | NO | no | +0.75 | +0.73 |
| 2026-04-17 | ALLY | Oil | 0/19 | ❌ | 7% | 0.74 | +19 | NO | yes | -0.74 | -0.74 |
| 2026-04-17 | ALLY | Rate Cut | 11/19 | ✅ | 58% | 0.26 | +16 | NO | no | +0.74 | +0.72 |
| 2026-04-17 | ALLY | Tariff | 3/19 | ✅ | 24% | 0.34 | +42 | NO | no | +0.66 | +0.64 |
| 2026-04-17 | TFC | AI / Artificial Intelligence | 9/30 | ✅ | 33% | 0.06 | +61 | NO | yes | -0.06 | -0.06 |
| 2026-04-17 | TFC | Credit Card | 7/30 | ✅ | 28% | 0.45 | +27 | NO | no | +0.55 | +0.53 |
| 2026-04-17 | TFC | Headcount | 4/30 | ✅ | 19% | 0.67 | +14 | NO | no | +0.33 | +0.32 |
| 2026-04-17 | TFC | Middle Market | 10/30 | ✅ | 36% | 0.15 | +49 | NO | yes | -0.15 | -0.15 |
| 2026-04-17 | TFC | Orioles | 0/30 | ❌ | 4% | 0.69 | +27 | NO | no | +0.31 | +0.30 |
| 2026-04-17 | TFC | Real Estate | 23/30 | ❌ | 72% | 0.43 | +29 | YES | yes | +0.57 | +0.55 |
| 2026-04-17 | TFC | Recession | 14/30 | ❌ | 45% | 0.29 | +16 | YES | no | -0.29 | -0.29 |
| 2026-04-17 | TFC | Tailwind | 12/30 | ✅ | 42% | 0.43 | +15 | NO | no | +0.57 | +0.55 |
| 2026-04-21 | ALK | AI / Artificial Intelligence | 2/17 | ❌ | 17% | 0.42 | +41 | NO | no | +0.58 | +0.56 |
| 2026-04-21 | ALK | Coachella | 0/17 | ❌ | 7% | 0.78 | +15 | NO | no | +0.22 | +0.21 |
| 2026-04-21 | ALK | Iceland | 0/17 | ✅ | 12% | 0.59 | +29 | NO | no | +0.41 | +0.40 |
| 2026-04-21 | ALK | Iran | 0/17 | ❌ | 7% | 0.75 | +18 | NO | no | +0.25 | +0.24 |
| 2026-04-21 | ALK | Oil | 7/17 | ❌ | 40% | 0.20 | +40 | NO | yes | -0.20 | -0.20 |
| 2026-04-21 | ALK | Oneworld | 14/17 | ✅ | 78% | 0.66 | +12 | YES | yes | +0.34 | +0.33 |
| 2026-04-21 | ALK | Shutdown / Shut Down | 0/17 | ✅ | 12% | 0.50 | +38 | NO | no | +0.50 | +0.48 |
| 2026-04-21 | ALK | Starlink | 0/17 | ✅ | 12% | 0.11 | +77 | NO | yes | -0.11 | -0.11 |
| 2026-04-22 | BA | Airbus | 23/45 | ✅ | 52% | 0.18 | +34 | YES | no | -0.18 | -0.18 |
| 2026-04-22 | BA | Dividend | 28/45 | ✅ | 62% | 0.26 | +36 | YES | no | -0.26 | -0.26 |
| 2026-04-22 | BA | Moon | 3/45 | ❌ | 9% | 0.34 | +57 | NO | no | +0.66 | +0.64 |
| 2026-04-22 | BA | NASA | 25/45 | ✅ | 56% | 0.23 | +21 | NO | yes | -0.23 | -0.23 |
| 2026-04-22 | BA | Tariff | 4/45 | ✅ | 13% | 0.69 | +18 | NO | no | +0.31 | +0.30 |
| 2026-04-22 | GEV | China | 3/7 | ❌ | 40% | 0.50 | +10 | NO | yes | -0.50 | -0.50 |
| 2026-04-22 | GEV | Nuclear | 5/7 | ✅ | 67% | 0.07 | +26 | NO | yes | -0.07 | -0.07 |
| 2026-04-22 | GEV | Robotic / Robotics | 3/7 | ✅ | 49% | 0.20 | +31 | NO | yes | -0.20 | -0.20 |
| 2026-04-22 | GEV | Tariff | 3/7 | ✅ | 49% | 0.16 | +35 | NO | yes | -0.16 | -0.16 |
| 2026-04-22 | GEV | Vietnam / India | 3/7 | ✅ | 49% | 0.22 | +29 | NO | yes | -0.22 | -0.22 |
| 2026-04-22 | TSLA | Competition | 12/61 | ✅ | 22% | 0.39 | +39 | NO | yes | -0.39 | -0.39 |
| 2026-04-22 | TSLA | Cybertruck | 22/61 | ✅ | 37% | 0.48 | +15 | NO | no | +0.52 | +0.50 |
| 2026-04-22 | TSLA | Delivery | 47/61 | ✅ | 76% | 0.07 | +17 | NO | yes | -0.07 | -0.07 |
| 2026-04-22 | TSLA | Dojo / Dojo3 | 14/61 | ❌ | 24% | 0.51 | +25 | NO | yes | -0.51 | -0.51 |
| 2026-04-22 | TSLA | FSD / Full Self Driving | 26/61 | ✅ | 44% | 0.02 | +54 | NO | yes | -0.02 | -0.02 |
| 2026-04-22 | TSLA | Gigafactory | 33/61 | ❌ | 53% | 0.37 | +16 | YES | no | -0.37 | -0.37 |
| 2026-04-22 | TSLA | Grok 5 | 1/61 | ❌ | 4% | 0.82 | +14 | NO | no | +0.18 | +0.17 |
| 2026-04-22 | TSLA | Iran | 0/61 | ❌ | 2% | 0.80 | +18 | NO | no | +0.20 | +0.19 |
| 2026-04-22 | TSLA | Leader / Leadership | 21/61 | ✅ | 36% | 0.52 | +12 | NO | no | +0.48 | +0.47 |
| 2026-04-22 | TSLA | Optimus | 15/61 | ✅ | 27% | 0.01 | +72 | NO | yes | -0.01 | -0.01 |
| 2026-04-22 | TSLA | Regulator / Regulatory / Regulation | 47/61 | ✅ | 76% | 0.11 | +13 | NO | yes | -0.11 | -0.11 |
| 2026-04-22 | TSLA | Roadster | 29/61 | ✅ | 48% | 0.24 | +28 | NO | yes | -0.24 | -0.24 |
| 2026-04-22 | TSLA | Supercharger / Super Charger | 30/61 | ❌ | 48% | 0.34 | +14 | YES | yes | +0.66 | +0.64 |
| 2026-04-22 | TSLA | Semi | 31/61 | ✅ | 51% | 0.10 | +39 | NO | yes | -0.10 | -0.10 |
| 2026-04-22 | TSLA | SpaceX / xAI | 17/61 | ✅ | 30% | 0.13 | +57 | NO | yes | -0.13 | -0.13 |
| 2026-04-22 | TSLA | Tariff | 12/61 | ✅ | 22% | 0.18 | +60 | NO | yes | -0.18 | -0.18 |
| 2026-04-22 | TSLA | Terafab | 0/61 | ✅ | 4% | 0.10 | +86 | NO | yes | -0.10 | -0.10 |
| 2026-04-22 | TSLA | Trump | 4/61 | ❌ | 8% | 0.79 | +13 | NO | no | +0.21 | +0.20 |
| 2026-04-22 | UAL | American Airlines | 2/23 | ✅ | 16% | 0.66 | +18 | NO | no | +0.34 | +0.33 |
| 2026-04-22 | UAL | ATC / Air Traffic Control | 10/23 | ✅ | 46% | 0.33 | +21 | NO | no | +0.67 | +0.65 |
| 2026-04-22 | UAL | Holiday | 9/23 | ✅ | 42% | 0.15 | +27 | YES | no | -0.15 | -0.15 |
| 2026-04-22 | UAL | JetBlue | 4/23 | ❌ | 20% | 0.63 | +17 | NO | no | +0.37 | +0.36 |
| 2026-04-22 | UAL | Middle East | 7/23 | ❌ | 31% | 0.16 | +53 | NO | yes | -0.16 | -0.16 |
| 2026-04-22 | UAL | Newark | 17/23 | ✅ | 72% | 0.11 | +17 | NO | yes | -0.11 | -0.11 |
| 2026-04-22 | UAL | Nonstop / Non-Stop | 10/23 | ❌ | 42% | 0.23 | +19 | YES | no | -0.23 | -0.23 |
| 2026-04-22 | UAL | Oil  | 3/23 | ❌ | 17% | 0.27 | +56 | NO | yes | -0.27 | -0.27 |
| 2026-04-22 | UAL | On-Time / On Time | 13/23 | ✅ | 57% | 0.07 | +36 | NO | yes | -0.07 | -0.07 |
| 2026-04-22 | UAL | Relax Row | 0/23 | ❌ | 6% | 0.59 | +35 | NO | yes | -0.59 | -0.59 |
| 2026-04-22 | UAL | Shutdown / Shut Down | 6/23 | ✅ | 31% | 0.33 | +36 | NO | yes | -0.33 | -0.33 |
| 2026-04-22 | UAL | Starlink | 5/23 | ✅ | 27% | 0.14 | +59 | NO | yes | -0.14 | -0.14 |
| 2026-04-22 | UAL | Tariff | 3/23 | ❌ | 17% | 0.66 | +17 | NO | no | +0.34 | +0.33 |
| 2026-04-22 | UAL | Union | 12/23 | ✅ | 53% | 0.34 | +13 | NO | no | +0.66 | +0.64 |
| 2026-04-22 | UAL | Weather | 15/23 | ❌ | 61% | 0.21 | +18 | NO | yes | -0.21 | -0.21 |
| 2026-04-22 | UAL | World Cup | 0/23 | ✅ | 9% | 0.56 | +35 | NO | no | +0.44 | +0.43 |
| 2026-04-23 | AXP | Currency | 15/57 | ❌ | 27% | 0.61 | +12 | NO | no | +0.39 | +0.38 |
| 2026-04-23 | AXP | Lounge | 28/57 | ✅ | 50% | 0.31 | +19 | NO | yes | -0.31 | -0.31 |
| 2026-04-23 | AXP | Regulation / Regulatory | 42/57 | ✅ | 73% | 0.56 | +17 | YES | yes | +0.44 | +0.43 |
| 2026-04-23 | INTC | Arizona | 16/62 | ✅ | 28% | 0.26 | +46 | NO | no | +0.74 | +0.72 |
| 2026-04-23 | INTC | Dividend | 49/62 | ❌ | 76% | 0.20 | +56 | YES | no | -0.20 | -0.20 |
| 2026-04-23 | INTC | Mobileye | 34/62 | ✅ | 55% | 0.16 | +29 | NO | yes | -0.16 | -0.16 |
| 2026-04-23 | INTC | Nvidia | 7/62 | ✅ | 14% | 0.18 | +68 | NO | yes | -0.18 | -0.18 |
| 2026-04-23 | INTC | Panther Lake | 9/62 | ✅ | 17% | 0.08 | +75 | NO | yes | -0.08 | -0.08 |
| 2026-04-23 | INTC | Personal Computing | 2/62 | ❌ | 5% | 0.82 | +13 | NO | no | +0.18 | +0.17 |
| 2026-04-23 | INTC | Security | 34/62 | ❌ | 54% | 0.24 | +22 | NO | yes | -0.24 | -0.24 |
| 2026-04-23 | INTC | Tariff | 6/62 | ✅ | 13% | 0.54 | +33 | NO | no | +0.46 | +0.45 |
| 2026-04-23 | INTC | Trump | 2/62 | ❌ | 5% | 0.75 | +20 | NO | no | +0.25 | +0.24 |
| 2026-04-23 | INTC | Ultra 3 / Ultra Series 3 | 0/62 | ✅ | 4% | 0.11 | +85 | NO | yes | -0.11 | -0.11 |
| 2026-04-23 | INTC | Xeon | 49/62 | ✅ | 78% | 0.03 | +19 | NO | yes | -0.03 | -0.03 |
| 2026-04-24 | PG | AI / Artificial Intelligence | 5/45 | ✅ | 15% | 0.19 | +66 | NO | yes | -0.19 | -0.19 |
| 2026-04-24 | PG | Beauty | 38/45 | ✅ | 82% | 0.68 | +14 | YES | yes | +0.32 | +0.31 |
| 2026-04-24 | PG | Competition | 35/45 | ✅ | 76% | 0.55 | +21 | YES | no | -0.55 | -0.55 |
| 2026-04-24 | PG | Inflation | 28/45 | ✅ | 62% | 0.12 | +26 | NO | yes | -0.12 | -0.12 |
| 2026-04-24 | PG | Old Spice | 9/45 | ✅ | 23% | 0.57 | +20 | NO | no | +0.43 | +0.42 |
| 2026-04-24 | PG | Tariff | 9/45 | ✅ | 23% | 0.07 | +70 | NO | yes | -0.07 | -0.07 |
| 2026-04-24 | PG | WNBA | 0/45 | ❌ | 3% | 0.55 | +42 | NO | no | +0.45 | +0.44 |
| 2026-04-27 | DPZ | AI / Artificial Intelligence | 7/61 | ❌ | 13% | 0.24 | +63 | NO | yes | -0.24 | -0.24 |
| 2026-04-27 | DPZ | Automation | 3/61 | ❌ | 7% | 0.81 | +12 | NO | no | +0.19 | +0.18 |
| 2026-04-27 | DPZ | Closure | 53/61 | ✅ | 85% | 0.71 | +14 | YES | yes | +0.29 | +0.28 |
| 2026-04-27 | DPZ | Craveable | 1/61 | ❌ | 4% | 0.82 | +14 | NO | no | +0.18 | +0.17 |
| 2026-04-27 | DPZ | DoorDash (5+ times) | 0/61 | ❌ | 2% | 0.51 | +47 | NO | no | +0.49 | +0.48 |
| 2026-04-27 | DPZ | Emergency Pizza | 7/61 | ❌ | 13% | 0.53 | +34 | NO | no | +0.47 | +0.46 |
| 2026-04-27 | DPZ | Insurance | 23/61 | ✅ | 39% | 0.48 | +13 | NO | yes | -0.48 | -0.48 |
| 2026-04-27 | DPZ | Parmesan | 11/61 | ✅ | 21% | 0.16 | +63 | NO | no | +0.84 | +0.81 |
| 2026-04-27 | DPZ | Same Store | 6/61 | ❌ | 12% | 0.04 | +84 | NO | yes | -0.04 | -0.04 |
| 2026-04-27 | DPZ | Spicy | 1/61 | ❌ | 4% | 0.80 | +16 | NO | no | +0.20 | +0.19 |
| 2026-04-27 | DPZ | Tailwind | 24/61 | ✅ | 41% | 0.19 | +40 | NO | yes | -0.19 | -0.19 |
| 2026-04-27 | DPZ | Tariff | 2/61 | ❌ | 5% | 0.77 | +18 | NO | no | +0.23 | +0.22 |
| 2026-04-27 | VZ | C-Band | 22/27 | ✅ | 78% | 0.10 | +12 | NO | no | +0.90 | +0.87 |
| 2026-04-27 | VZ | Home / MyHome | 26/27 | ❌ | 88% | 0.75 | +13 | YES | yes | +0.25 | +0.24 |
| 2026-04-27 | VZ | Spectrum | 27/27 | ❌ | 92% | 0.72 | +20 | YES | no | -0.72 | -0.72 |
| 2026-04-27 | VZ | Starry | 1/27 | ✅ | 11% | 0.41 | +48 | NO | yes | -0.41 | -0.41 |
| 2026-04-27 | VZ | Synergy | 2/27 | ✅ | 14% | 0.13 | +73 | NO | yes | -0.13 | -0.13 |
| 2026-04-28 | HOOD | Acquisition | 12/18 | ✅ | 65% | 0.14 | +21 | NO | yes | -0.14 | -0.14 |
| 2026-04-28 | HOOD | Bitcoin | 5/18 | ✅ | 34% | 0.55 | +11 | NO | yes | -0.55 | -0.55 |
| 2026-04-28 | HOOD | Blockchain | 3/18 | ✅ | 25% | 0.43 | +32 | NO | no | +0.57 | +0.55 |
| 2026-04-28 | HOOD | Credit Card | 12/18 | ✅ | 65% | 0.18 | +17 | NO | yes | -0.18 | -0.18 |
| 2026-04-28 | HOOD | Indonesia | 0/18 | ✅ | 11% | 0.77 | +12 | NO | yes | -0.77 | -0.77 |
| 2026-04-28 | HOOD | International | 14/18 | ✅ | 74% | 0.03 | +23 | NO | yes | -0.03 | -0.03 |
| 2026-04-28 | HOOD | Kalshi | 1/18 | ❌ | 11% | 0.68 | +21 | NO | no | +0.32 | +0.31 |
| 2026-04-28 | HOOD | Perp / Perpetual | 1/18 | ✅ | 16% | 0.35 | +49 | NO | yes | -0.35 | -0.35 |
| 2026-04-28 | HOOD | SIG / Susquehanna | 0/18 | ✅ | 11% | 0.49 | +40 | NO | yes | -0.49 | -0.49 |
| 2026-04-28 | HOOD | Social | 6/18 | ✅ | 38% | 0.05 | +57 | NO | yes | -0.05 | -0.05 |
| 2026-04-28 | HOOD | Tokenization | 3/18 | ✅ | 25% | 0.08 | +67 | NO | yes | -0.08 | -0.08 |
| 2026-04-28 | HOOD | Trump | 1/18 | ✅ | 16% | 0.34 | +50 | NO | yes | -0.34 | -0.34 |
| 2026-04-28 | KO | Alcohol / Alcoholic | 29/43 | ❌ | 65% | 0.39 | +26 | YES | no | -0.39 | -0.39 |
| 2026-04-28 | KO | Cane Sugar | 1/43 | ❌ | 5% | 0.71 | +24 | NO | no | +0.29 | +0.28 |
| 2026-04-28 | KO | Dividend | 32/43 | ✅ | 73% | 0.16 | +11 | NO | no | +0.84 | +0.81 |
| 2026-04-28 | KO | Fairlife | 24/43 | ✅ | 56% | 0.04 | +40 | NO | yes | -0.04 | -0.04 |
| 2026-04-28 | KO | International | 13/43 | ❌ | 31% | 0.47 | +22 | NO | no | +0.53 | +0.51 |
| 2026-04-28 | KO | Tariff | 3/43 | ❌ | 10% | 0.70 | +20 | NO | no | +0.30 | +0.29 |
| 2026-04-28 | SBUX | Boyu | 0/44 | ✅ | 5% | 0.09 | +86 | NO | yes | -0.09 | -0.09 |
| 2026-04-28 | SBUX | Canada | 18/44 | ❌ | 41% | 0.46 | +13 | NO | no | +0.54 | +0.52 |
| 2026-04-28 | SBUX | Comparable Sales | 12/44 | ❌ | 28% | 0.56 | +16 | NO | yes | -0.56 | -0.56 |
| 2026-04-28 | SBUX | Condiment Bar | 5/44 | ❌ | 14% | 0.70 | +16 | NO | no | +0.30 | +0.29 |
| 2026-04-28 | SBUX | Non Dairy | 0/44 | ❌ | 3% | 0.75 | +22 | NO | no | +0.25 | +0.24 |
| 2026-04-28 | SBUX | Protein | 10/44 | ✅ | 26% | 0.04 | +70 | NO | yes | -0.04 | -0.04 |
| 2026-04-28 | SBUX | Recycle / Recyclable | 3/44 | ❌ | 9% | 0.79 | +12 | NO | no | +0.21 | +0.20 |
| 2026-04-28 | SBUX | Smart Queue / SmartQ | 2/44 | ✅ | 9% | 0.20 | +71 | NO | yes | -0.20 | -0.20 |
| 2026-04-28 | SBUX | Tariff | 3/44 | ✅ | 11% | 0.04 | +85 | NO | yes | -0.04 | -0.04 |
| 2026-04-28 | SPOT | Anna's Archive | 0/31 | ❌ | 4% | 0.80 | +16 | NO | no | +0.20 | +0.19 |
| 2026-04-28 | SPOT | Award | 0/31 | ✅ | 7% | 0.71 | +22 | NO | no | +0.29 | +0.28 |
| 2026-04-28 | SPOT | Bookshop / Bookshop.org | 0/31 | ✅ | 7% | 0.32 | +61 | NO | no | +0.68 | +0.66 |
| 2026-04-28 | SPOT | ChatGPT | 1/31 | ❌ | 7% | 0.68 | +25 | NO | yes | -0.68 | -0.68 |
| 2026-04-28 | SPOT | Headwind | 15/31 | ✅ | 50% | 0.22 | +28 | NO | no | +0.78 | +0.76 |
| 2026-04-28 | SPOT | Message | 8/31 | ❌ | 27% | 0.52 | +21 | NO | no | +0.48 | +0.47 |
| 2026-04-28 | SPOT | Meta | 1/31 | ❌ | 7% | 0.77 | +16 | NO | no | +0.23 | +0.22 |
| 2026-04-28 | SPOT | Monetization | 24/31 | ✅ | 75% | 0.06 | +19 | NO | yes | -0.06 | -0.06 |
| 2026-04-28 | SPOT | Netflix | 8/31 | ❌ | 27% | 0.55 | +18 | NO | no | +0.45 | +0.44 |
| 2026-04-28 | SPOT | Physical | 8/31 | ✅ | 30% | 0.45 | +25 | NO | no | +0.55 | +0.53 |
| 2026-04-28 | SPOT | Retain / Retention | 27/31 | ✅ | 84% | 0.04 | +12 | NO | yes | -0.04 | -0.04 |
| 2026-04-28 | V | Blockchain | 11/63 | ✅ | 20% | 0.14 | +66 | NO | yes | -0.14 | -0.14 |
| 2026-04-28 | V | Cybersecurity | 11/63 | ❌ | 19% | 0.68 | +13 | NO | no | +0.32 | +0.31 |
| 2026-04-28 | V | Holiday | 22/63 | ✅ | 36% | 0.17 | +19 | YES | no | -0.17 | -0.17 |
| 2026-04-28 | V | Hyperscaler | 2/63 | ✅ | 7% | 0.28 | +65 | NO | yes | -0.28 | -0.28 |
| 2026-04-28 | V | Inflation | 12/63 | ❌ | 20% | 0.58 | +22 | NO | no | +0.42 | +0.41 |
| 2026-04-28 | V | Loyalty | 20/63 | ❌ | 32% | 0.22 | +10 | YES | yes | +0.78 | +0.76 |
| 2026-04-28 | V | Regulation / Regulatory | 44/63 | ✅ | 69% | 0.58 | +11 | YES | yes | +0.42 | +0.41 |
| 2026-04-28 | V | Southwest | 5/63 | ❌ | 10% | 0.78 | +12 | NO | no | +0.22 | +0.21 |
| 2026-04-28 | V | Tokenization | 35/63 | ✅ | 56% | 0.04 | +40 | NO | yes | -0.04 | -0.04 |
| 2026-04-28 | V | World Cup | 15/63 | ✅ | 26% | 0.29 | +45 | NO | yes | -0.29 | -0.29 |
| 2026-04-29 | AMZN | Alexa+ / Alexa Plus | 3/62 | ✅ | 8% | 0.05 | +87 | NO | yes | -0.05 | -0.05 |
| 2026-04-29 | AMZN | China | 26/62 | ❌ | 42% | 0.29 | +13 | YES | no | -0.29 | -0.29 |
| 2026-04-29 | AMZN | Data Center | 25/62 | ✅ | 41% | 0.11 | +48 | NO | yes | -0.11 | -0.11 |
| 2026-04-29 | AMZN | Drone | 4/62 | ❌ | 8% | 0.62 | +30 | NO | no | +0.38 | +0.37 |
| 2026-04-29 | AMZN | Gen-AI / Generative AI | 11/62 | ✅ | 20% | 0.15 | +65 | NO | yes | -0.15 | -0.15 |
| 2026-04-29 | AMZN | Live Sports | 14/62 | ✅ | 25% | 0.06 | +69 | NO | yes | -0.06 | -0.06 |
| 2026-04-29 | AMZN | OpenAI | 1/62 | ✅ | 5% | 0.10 | +85 | NO | yes | -0.10 | -0.10 |
| 2026-04-29 | AMZN | Prime Day | 30/62 | ❌ | 48% | 0.26 | +26 | NO | yes | -0.26 | -0.26 |
| 2026-04-29 | AMZN | Project Kuiper | 7/62 | ❌ | 13% | 0.77 | +10 | NO | no | +0.23 | +0.22 |
| 2026-04-29 | AMZN | Robotic / Robotics | 16/62 | ✅ | 28% | 0.10 | +62 | NO | yes | -0.10 | -0.10 |
| 2026-04-29 | AMZN | RxPass | 4/62 | ❌ | 8% | 0.65 | +27 | NO | no | +0.35 | +0.34 |
| 2026-04-29 | AMZN | Silicon | 10/62 | ✅ | 19% | 0.10 | +71 | NO | yes | -0.10 | -0.10 |
| 2026-04-29 | AMZN | Sponsored Products | 15/62 | ✅ | 26% | 0.32 | +42 | NO | no | +0.68 | +0.66 |
| 2026-04-29 | AMZN | Supply Chain | 16/62 | ❌ | 26% | 0.51 | +23 | NO | yes | -0.51 | -0.51 |
| 2026-04-29 | AMZN | Tariff | 3/62 | ✅ | 8% | 0.02 | +90 | NO | yes | -0.02 | -0.02 |
| 2026-04-29 | AMZN | Third Party Sellers | 1/62 | ❌ | 4% | 0.28 | +68 | NO | yes | -0.28 | -0.28 |
| 2026-04-29 | CAR | AI / Artificial Intelligence | 1/19 | ❌ | 11% | 0.58 | +31 | NO | no | +0.42 | +0.41 |
| 2026-04-29 | CAR | Squeeze / Squeezed | 1/19 | ✅ | 15% | 0.72 | +13 | NO | yes | -0.72 | -0.72 |
| 2026-04-29 | CAR | Tariff | 4/19 | ✅ | 28% | 0.18 | +54 | NO | no | +0.82 | +0.80 |
| 2026-04-29 | CAR | Upgrade | 2/19 | ❌ | 15% | 0.72 | +13 | NO | no | +0.28 | +0.27 |
| 2026-04-29 | CAR | Waymo | 1/19 | ✅ | 15% | 0.18 | +67 | NO | yes | -0.18 | -0.18 |
| 2026-04-29 | CAR | World Cup | 1/19 | ❌ | 11% | 0.55 | +34 | NO | yes | -0.55 | -0.55 |
| 2026-04-29 | CMG | Al Pastor | 11/63 | ✅ | 20% | 0.10 | +70 | NO | yes | -0.10 | -0.10 |
| 2026-04-29 | CMG | Autocado | 8/63 | ❌ | 14% | 0.66 | +20 | NO | no | +0.34 | +0.33 |
| 2026-04-29 | CMG | Automation | 9/63 | ❌ | 16% | 0.72 | +12 | NO | no | +0.28 | +0.27 |
| 2026-04-29 | CMG | Carne Asada | 17/63 | ✅ | 29% | 0.47 | +24 | NO | no | +0.53 | +0.51 |
| 2026-04-29 | CMG | Chipotle Lane / Chipotlane | 28/63 | ❌ | 44% | 0.09 | +47 | NO | yes | -0.09 | -0.09 |
| 2026-04-29 | CMG | Headwind | 25/63 | ✅ | 41% | 0.37 | +22 | NO | no | +0.63 | +0.61 |
| 2026-04-29 | CMG | Honey Chicken | 4/63 | ❌ | 8% | 0.10 | +82 | NO | yes | -0.10 | -0.10 |
| 2026-04-29 | CMG | Promotion | 50/63 | ✅ | 78% | 0.10 | +12 | NO | yes | -0.10 | -0.10 |
| 2026-04-29 | CMG | Share Purchase | 4/63 | ✅ | 10% | 0.39 | +51 | NO | no | +0.61 | +0.59 |
| 2026-04-29 | CMG | Supply Chain | 37/63 | ✅ | 59% | 0.21 | +20 | NO | no | +0.79 | +0.77 |
| 2026-04-29 | CMG | Tailwind | 8/63 | ✅ | 15% | 0.57 | +28 | NO | no | +0.43 | +0.42 |
| 2026-04-29 | CMG | Tariff | 4/63 | ✅ | 10% | 0.22 | +68 | NO | no | +0.78 | +0.76 |
| 2026-04-29 | CMG | Transaction Growth | 27/63 | ✅ | 44% | 0.23 | +33 | NO | yes | -0.23 | -0.23 |
| 2026-04-29 | CVNA | AI / Artificial Intelligence | 6/34 | ✅ | 22% | 0.10 | +68 | NO | yes | -0.10 | -0.10 |
| 2026-04-29 | CVNA | Bridgecrest | 0/34 | ❌ | 4% | 0.61 | +35 | NO | no | +0.39 | +0.38 |
| 2026-04-29 | CVNA | DriveTime | 2/34 | ❌ | 9% | 0.74 | +17 | NO | no | +0.26 | +0.25 |
| 2026-04-29 | CVNA | Headwind | 19/34 | ✅ | 56% | 0.39 | +17 | YES | no | -0.39 | -0.39 |
| 2026-04-29 | CVNA | Insurance | 6/34 | ❌ | 20% | 0.65 | +15 | NO | no | +0.35 | +0.34 |
| 2026-04-29 | CVNA | Same Day | 2/34 | ❌ | 9% | 0.40 | +51 | NO | no | +0.60 | +0.58 |
| 2026-04-29 | CVNA | Stadium | 0/34 | ❌ | 4% | 0.70 | +26 | NO | no | +0.30 | +0.29 |
| 2026-04-29 | CVNA | Tariff | 4/34 | ❌ | 14% | 0.51 | +35 | NO | yes | -0.51 | -0.51 |
| 2026-04-29 | GOOGL | Autonomous | 24/60 | ✅ | 41% | 0.27 | +32 | NO | yes | -0.27 | -0.27 |
| 2026-04-29 | GOOGL | Circle to Search | 7/60 | ✅ | 15% | 0.30 | +55 | NO | yes | -0.30 | -0.30 |
| 2026-04-29 | GOOGL | DeepMind / Deep Mind | 20/60 | ✅ | 35% | 0.15 | +50 | NO | no | +0.85 | +0.82 |
| 2026-04-29 | GOOGL | European Commission | 5/60 | ❌ | 10% | 0.77 | +13 | NO | no | +0.23 | +0.22 |
| 2026-04-29 | GOOGL | Gemini 3 | 1/60 | ✅ | 5% | 0.10 | +85 | NO | yes | -0.10 | -0.10 |
| 2026-04-29 | GOOGL | Ironwood | 2/60 | ✅ | 7% | 0.40 | +53 | NO | yes | -0.40 | -0.40 |
| 2026-04-29 | GOOGL | Nano Banana | 1/60 | ✅ | 5% | 0.31 | +64 | NO | yes | -0.31 | -0.31 |
| 2026-04-29 | GOOGL | Privacy | 26/60 | ❌ | 43% | 0.25 | +18 | YES | no | -0.25 | -0.25 |
| 2026-04-29 | GOOGL | Quantum | 6/60 | ❌ | 12% | 0.56 | +32 | NO | no | +0.44 | +0.43 |
| 2026-04-29 | GOOGL | Regulator / Regulation / Regulatory | 20/60 | ❌ | 34% | 0.22 | +12 | YES | no | -0.22 | -0.22 |
| 2026-04-29 | GOOGL | Search Advertising / Search Ad | 40/60 | ✅ | 66% | 0.22 | +12 | NO | no | +0.78 | +0.76 |
| 2026-04-29 | GOOGL | Tailwind | 18/60 | ✅ | 32% | 0.30 | +38 | NO | yes | -0.30 | -0.30 |
| 2026-04-29 | GOOGL | Wiz | 1/60 | ❌ | 4% | 0.11 | +85 | NO | yes | -0.11 | -0.11 |
| 2026-04-29 | GOOGL | Youtube Shorts | 18/60 | ❌ | 30% | 0.45 | +25 | NO | no | +0.55 | +0.53 |
| 2026-04-29 | META | Algorithm | 12/54 | ✅ | 25% | 0.40 | +35 | NO | yes | -0.40 | -0.40 |
| 2026-04-29 | META | Cloud | 9/54 | ✅ | 20% | 0.08 | +72 | NO | yes | -0.08 | -0.08 |
| 2026-04-29 | META | Dividend | 11/54 | ✅ | 23% | 0.14 | +63 | NO | no | +0.86 | +0.83 |
| 2026-04-29 | META | Hyperion | 1/54 | ❌ | 4% | 0.64 | +32 | NO | no | +0.36 | +0.35 |
| 2026-04-29 | META | Llama | 11/54 | ❌ | 22% | 0.38 | +40 | NO | no | +0.62 | +0.60 |
| 2026-04-29 | META | Muse | 0/54 | ❌ | 3% | 0.03 | +94 | NO | yes | -0.03 | -0.03 |
| 2026-04-29 | META | Oakley | 3/54 | ❌ | 8% | 0.38 | +54 | NO | yes | -0.38 | -0.38 |
| 2026-04-29 | META | Orion | 4/54 | ❌ | 9% | 0.51 | +40 | NO | no | +0.49 | +0.48 |
| 2026-04-29 | META | Ray-Ban | 12/54 | ❌ | 23% | 0.19 | +58 | NO | yes | -0.19 | -0.19 |
| 2026-04-29 | META | Reels (3+ times) | 0/54 | ❌ | 3% | 0.23 | +74 | NO | no | +0.77 | +0.75 |
| 2026-04-29 | META | SAM | 1/54 | ❌ | 4% | 0.72 | +24 | NO | no | +0.28 | +0.27 |
| 2026-04-29 | META | Thread / Threads | 25/54 | ✅ | 47% | 0.05 | +48 | NO | yes | -0.05 | -0.05 |
| 2026-04-29 | META | VR / Virtual Reality | 39/54 | ✅ | 71% | 0.53 | +18 | YES | yes | +0.47 | +0.46 |
| 2026-04-29 | MSFT | Anthropic | 1/62 | ✅ | 5% | 0.23 | +72 | NO | yes | -0.23 | -0.23 |
| 2026-04-29 | MSFT | Fairwater | 1/62 | ✅ | 5% | 0.19 | +76 | NO | yes | -0.19 | -0.19 |
| 2026-04-29 | MSFT | Frontier | 12/62 | ✅ | 22% | 0.57 | +21 | NO | yes | -0.57 | -0.57 |
| 2026-04-29 | MSFT | Gaming | 54/62 | ✅ | 85% | 0.04 | +11 | NO | yes | -0.04 | -0.04 |
| 2026-04-29 | MSFT | LinkedIn | 39/62 | ✅ | 63% | 0.04 | +33 | NO | yes | -0.04 | -0.04 |
| 2026-04-29 | MSFT | OpenAI | 22/62 | ✅ | 37% | 0.03 | +60 | NO | yes | -0.03 | -0.03 |
| 2026-04-29 | MSFT | Phi | 5/62 | ❌ | 10% | 0.80 | +10 | NO | no | +0.20 | +0.19 |
| 2026-04-29 | MSFT | Teams | 45/62 | ✅ | 72% | 0.04 | +24 | NO | yes | -0.04 | -0.04 |
| 2026-04-29 | MSFT | Windows 11 | 18/62 | ✅ | 31% | 0.11 | +58 | NO | no | +0.89 | +0.86 |
| 2026-04-29 | WING | Chicken | 30/31 | ✅ | 92% | 0.81 | +11 | YES | yes | +0.19 | +0.18 |
| 2026-04-29 | WING | Citrus Mojo | 0/31 | ❌ | 4% | 0.39 | +57 | NO | yes | -0.39 | -0.39 |
| 2026-04-29 | WING | Hot Box | 0/31 | ❌ | 4% | 0.72 | +24 | NO | no | +0.28 | +0.27 |
| 2026-04-29 | WING | Lemon Pepper | 1/31 | ❌ | 7% | 0.70 | +23 | NO | yes | -0.70 | -0.70 |
| 2026-04-29 | WING | NFL / NBA | 14/31 | ❌ | 44% | 0.34 | +22 | NO | no | +0.66 | +0.64 |
| 2026-04-29 | WING | Share Repurchase | 9/31 | ✅ | 33% | 0.04 | +63 | NO | yes | -0.04 | -0.04 |
| 2026-04-29 | WING | Tender | 13/31 | ✅ | 44% | 0.28 | +28 | NO | yes | -0.28 | -0.28 |
| 2026-04-30 | AAPL | Apple Pay | 36/59 | ✅ | 61% | 0.17 | +22 | NO | no | +0.83 | +0.81 |
| 2026-04-30 | AAPL | Creator Studio | 0/59 | ✅ | 4% | 0.42 | +54 | NO | no | +0.58 | +0.56 |
| 2026-04-30 | AAPL | Formula 1 / F1 | 4/59 | ✅ | 10% | 0.23 | +67 | NO | yes | -0.23 | -0.23 |
| 2026-04-30 | AAPL | Fold / Folding / Foldable | 2/59 | ❌ | 6% | 0.73 | +21 | NO | no | +0.27 | +0.26 |
| 2026-04-30 | AAPL | Gemini | 0/59 | ✅ | 4% | 0.54 | +42 | NO | no | +0.46 | +0.45 |
| 2026-04-30 | AAPL | Glasses | 1/59 | ❌ | 4% | 0.76 | +20 | NO | no | +0.24 | +0.23 |
| 2026-04-30 | AAPL | Liquid Glass | 2/59 | ❌ | 6% | 0.66 | +28 | NO | no | +0.34 | +0.33 |
| 2026-04-30 | AAPL | Manufacturing | 35/59 | ✅ | 59% | 0.05 | +36 | NO | yes | -0.05 | -0.05 |
| 2026-04-30 | AAPL | Modem | 5/59 | ✅ | 12% | 0.73 | +15 | NO | yes | -0.73 | -0.73 |
| 2026-04-30 | AAPL | Privacy | 34/59 | ✅ | 58% | 0.18 | +24 | NO | yes | -0.18 | -0.18 |
| 2026-04-30 | AAPL | Siri | 31/59 | ✅ | 53% | 0.05 | +42 | NO | yes | -0.05 | -0.05 |
| 2026-04-30 | AAPL | Streaming | 18/59 | ❌ | 31% | 0.51 | +18 | NO | no | +0.49 | +0.48 |
| 2026-04-30 | AAPL | Tariff | 10/59 | ✅ | 20% | 0.05 | +75 | NO | yes | -0.05 | -0.05 |
| 2026-04-30 | AAPL | Wearable | 36/59 | ✅ | 61% | 0.04 | +35 | NO | yes | -0.04 | -0.04 |
| 2026-04-30 | AAPL | Widget | 2/59 | ❌ | 6% | 0.81 | +13 | NO | no | +0.19 | +0.18 |
| 2026-04-30 | LLY | AI / Artificial Intelligence | 1/43 | ✅ | 7% | 0.20 | +73 | NO | no | +0.80 | +0.78 |
| 2026-04-30 | LLY | China | 37/43 | ✅ | 84% | 0.05 | +11 | NO | yes | -0.05 | -0.05 |
| 2026-04-30 | LLY | Foundayo | 0/43 | ❌ | 3% | 0.02 | +95 | NO | yes | -0.02 | -0.02 |
| 2026-04-30 | LLY | Headwind | 38/43 | ❌ | 84% | 0.50 | +34 | YES | yes | +0.50 | +0.48 |
| 2026-04-30 | LLY | Inluriyo | 0/43 | ✅ | 5% | 0.37 | +58 | NO | yes | -0.37 | -0.37 |
| 2026-04-30 | LLY | LillyDirect | 3/43 | ✅ | 11% | 0.05 | +84 | NO | yes | -0.05 | -0.05 |
| 2026-04-30 | LLY | Nvidia | 0/43 | ✅ | 5% | 0.49 | +46 | NO | no | +0.51 | +0.49 |
| 2026-04-30 | LLY | Pennsylvania | 0/43 | ❌ | 3% | 0.62 | +35 | NO | no | +0.38 | +0.37 |
| 2026-04-30 | LLY | Tariff | 2/43 | ❌ | 7% | 0.57 | +36 | NO | no | +0.43 | +0.42 |
| 2026-04-30 | LLY | Ventyx | 0/43 | ✅ | 5% | 0.35 | +60 | NO | yes | -0.35 | -0.35 |
| 2026-04-30 | LLY | Vial | 14/43 | ✅ | 35% | 0.11 | +54 | NO | yes | -0.11 | -0.11 |
| 2026-04-30 | LLY | Walmart | 1/43 | ❌ | 5% | 0.56 | +39 | NO | no | +0.44 | +0.43 |
| 2026-04-30 | RDDT | Game | 5/7 | ❌ | 57% | 0.41 | +16 | YES | no | -0.41 | -0.41 |
| 2026-04-30 | RDDT | Headwind | 3/7 | ❌ | 40% | 0.27 | +13 | YES | no | -0.27 | -0.27 |
| 2026-04-30 | RDDT | Reddit Pro | 6/7 | ✅ | 75% | 0.04 | +21 | NO | yes | -0.04 | -0.04 |
| 2026-04-30 | RDDT | Shopify | 0/7 | ❌ | 14% | 0.04 | +82 | NO | yes | -0.04 | -0.04 |
| 2026-04-30 | RIVN | Cox | 0/17 | ❌ | 7% | 0.58 | +35 | NO | no | +0.42 | +0.41 |
| 2026-04-30 | RIVN | Headwind | 6/17 | ❌ | 36% | 0.52 | +12 | NO | no | +0.48 | +0.47 |
| 2026-04-30 | RIVN | Robot / Robotic / Robotics | 6/17 | ✅ | 40% | 0.29 | +31 | NO | yes | -0.29 | -0.29 |
| 2026-04-30 | RIVN | Robotaxi | 1/17 | ❌ | 12% | 0.11 | +77 | NO | yes | -0.11 | -0.11 |
| 2026-04-30 | RIVN | Tailwind | 10/17 | ❌ | 54% | 0.37 | +17 | YES | no | -0.37 | -0.37 |
| 2026-04-30 | RIVN | Tornado | 0/17 | ❌ | 7% | 0.43 | +50 | NO | yes | -0.43 | -0.43 |
| 2026-04-30 | RIVN | Uber | 0/17 | ❌ | 7% | 0.07 | +86 | NO | yes | -0.07 | -0.07 |
| 2026-05-04 | ON | Autonomous / Automation | 29/43 | ✅ | 67% | 0.14 | +19 | NO | yes | -0.14 | -0.14 |
| 2026-05-04 | ON | Backlog | 36/43 | ✅ | 82% | 0.50 | +32 | YES | yes | +0.50 | +0.48 |
| 2026-05-04 | ON | Market Share | 23/43 | ❌ | 52% | 0.32 | +16 | NO | yes | -0.32 | -0.32 |
| 2026-05-04 | ON | NIO | 2/43 | ❌ | 7% | 0.23 | +70 | NO | yes | -0.23 | -0.23 |
| 2026-05-04 | ON | Nvidia | 6/43 | ❌ | 16% | 0.54 | +30 | NO | no | +0.46 | +0.45 |
| 2026-05-04 | ON | Sineng Electric | 0/43 | ❌ | 3% | 0.61 | +36 | NO | yes | -0.61 | -0.61 |
| 2026-05-04 | ON | Tariff | 8/43 | ❌ | 20% | 0.65 | +15 | NO | no | +0.35 | +0.34 |
| 2026-05-04 | PLTR | Commercial Growth | 3/21 | ❌ | 18% | 0.60 | +22 | NO | yes | -0.60 | -0.60 |
| 2026-05-04 | PLTR | Government Contract | 2/21 | ❌ | 14% | 0.75 | +11 | NO | no | +0.25 | +0.24 |
| 2026-05-04 | PLTR | Healthcare | 17/21 | ✅ | 77% | 0.56 | +21 | YES | no | -0.56 | -0.56 |
| 2026-05-04 | PLTR | International | 19/21 | ✅ | 85% | 0.02 | +13 | NO | yes | -0.02 | -0.02 |
| 2026-05-04 | PLTR | Iran / Iranian | 2/21 | ❌ | 14% | 0.28 | +58 | NO | no | +0.72 | +0.70 |
| 2026-05-04 | PLTR | Lethal | 6/21 | ✅ | 34% | 0.24 | +42 | NO | no | +0.76 | +0.74 |
| 2026-05-04 | PLTR | Nvidia | 0/21 | ❌ | 6% | 0.57 | +37 | NO | no | +0.43 | +0.42 |
| 2026-05-04 | PLTR | Revenue guidance | 15/21 | ❌ | 66% | 0.13 | +21 | NO | yes | -0.13 | -0.13 |
| 2026-05-04 | PLTR | Stellantis | 0/21 | ❌ | 6% | 0.72 | +22 | NO | no | +0.28 | +0.27 |
| 2026-05-04 | PLTR | USDA | 0/21 | ❌ | 6% | 0.20 | +74 | NO | yes | -0.20 | -0.20 |
| 2026-05-04 | PLTR | Warp Speed | 8/21 | ✅ | 42% | 0.08 | +50 | NO | yes | -0.08 | -0.08 |
| 2026-05-05 | PYPL | Ads ID | 0/41 | ❌ | 3% | 0.31 | +66 | NO | no | +0.69 | +0.67 |
| 2026-05-05 | PYPL | Bank | 39/41 | ❌ | 90% | 0.43 | +47 | YES | no | -0.43 | -0.43 |
| 2026-05-05 | PYPL | Biometric | 6/41 | ✅ | 19% | 0.09 | +72 | NO | yes | -0.09 | -0.09 |
| 2026-05-05 | PYPL | Bitcoin | 2/41 | ❌ | 8% | 0.75 | +17 | NO | no | +0.25 | +0.24 |
| 2026-05-05 | PYPL | Blockchain | 5/41 | ❌ | 14% | 0.60 | +26 | NO | no | +0.40 | +0.39 |
| 2026-05-05 | PYPL | Blue Owl | 1/41 | ❌ | 6% | 0.79 | +15 | NO | no | +0.21 | +0.20 |
| 2026-05-05 | PYPL | Cash Back / Cashback | 16/41 | ❌ | 39% | 0.33 | +28 | NO | no | +0.67 | +0.65 |
| 2026-05-05 | PYPL | College | 2/41 | ❌ | 8% | 0.66 | +26 | NO | no | +0.34 | +0.33 |
| 2026-05-05 | PYPL | Perplexity | 2/41 | ✅ | 10% | 0.45 | +45 | NO | no | +0.55 | +0.53 |
| 2026-05-05 | PYPL | Regulation / Regulator / Regulatory | 22/41 | ❌ | 52% | 0.37 | +15 | YES | no | -0.37 | -0.37 |
| 2026-05-05 | PYPL | Stablecoin / Stable Coin | 5/41 | ❌ | 14% | 0.43 | +43 | NO | yes | -0.43 | -0.43 |
| 2026-05-05 | PYPL | Stash | 0/41 | ✅ | 5% | 0.52 | +43 | NO | no | +0.48 | +0.47 |
| 2026-05-05 | SHOP | Amazon | 26/42 | ❌ | 60% | 0.41 | +19 | YES | yes | +0.59 | +0.57 |
| 2026-05-05 | SHOP | Headwind | 23/42 | ✅ | 55% | 0.11 | +34 | NO | yes | -0.11 | -0.11 |
| 2026-05-05 | SHOP | Klarna | 4/42 | ❌ | 12% | 0.49 | +39 | NO | no | +0.51 | +0.49 |
| 2026-05-05 | SHOP | OpenAI | 4/42 | ✅ | 14% | 0.26 | +60 | NO | yes | -0.26 | -0.26 |
| 2026-05-05 | SHOP | Repurchase / Buyback | 2/42 | ✅ | 10% | 0.29 | +61 | NO | yes | -0.29 | -0.29 |
| 2026-05-05 | SHOP | Shop Pay | 24/42 | ✅ | 57% | 0.02 | +41 | NO | yes | -0.02 | -0.02 |
| 2026-05-05 | SHOP | Tariff | 5/42 | ✅ | 16% | 0.21 | +63 | NO | no | +0.79 | +0.77 |
| 2026-05-06 | DIS | Abu Dhabi | 3/63 | ✅ | 8% | 0.26 | +66 | NO | yes | -0.26 | -0.26 |
| 2026-05-06 | DIS | Acquisition | 52/63 | ❌ | 80% | 0.52 | +28 | YES | yes | +0.48 | +0.47 |
| 2026-05-06 | DIS | Competition | 30/63 | ✅ | 48% | 0.07 | +45 | NO | no | +0.93 | +0.90 |
| 2026-05-06 | DIS | Cruise | 48/63 | ✅ | 75% | 0.04 | +21 | NO | yes | -0.04 | -0.04 |
| 2026-05-06 | DIS | Fortnite | 1/63 | ❌ | 4% | 0.71 | +25 | NO | yes | -0.71 | -0.71 |
| 2026-05-06 | DIS | Grogu | 2/63 | ✅ | 7% | 0.15 | +78 | NO | yes | -0.15 | -0.15 |
| 2026-05-06 | DIS | Kimmel | 0/63 | ❌ | 2% | 0.86 | +12 | NO | no | +0.14 | +0.14 |
| 2026-05-06 | DIS | NFL | 48/63 | ✅ | 75% | 0.11 | +14 | NO | yes | -0.11 | -0.11 |
| 2026-05-06 | DIS | OpenAI / Sora | 0/63 | ✅ | 4% | 0.49 | +47 | NO | no | +0.51 | +0.49 |
| 2026-05-06 | DIS | Subscriber | 54/63 | ✅ | 84% | 0.05 | +11 | NO | yes | -0.05 | -0.05 |
| 2026-05-06 | DIS | Trump | 1/63 | ❌ | 4% | 0.85 | +11 | NO | no | +0.15 | +0.15 |
| 2026-05-06 | DIS | Warner Bros. / Warner Brothers | 3/63 | ✅ | 8% | 0.46 | +46 | NO | no | +0.54 | +0.52 |
| 2026-05-06 | DIS | Weather | 4/63 | ❌ | 8% | 0.74 | +18 | NO | no | +0.26 | +0.25 |
| 2026-05-06 | DIS | WWE | 1/63 | ❌ | 4% | 0.32 | +64 | NO | no | +0.68 | +0.66 |
| 2026-05-06 | DIS | YouTube TV | 2/63 | ❌ | 5% | 0.80 | +15 | NO | no | +0.20 | +0.19 |
| 2026-05-06 | UBER | Avride | 2/27 | ✅ | 14% | 0.42 | +44 | NO | no | +0.58 | +0.56 |
| 2026-05-06 | UBER | Driver Incentives | 10/27 | ❌ | 37% | 0.09 | +28 | YES | no | -0.09 | -0.09 |
| 2026-05-06 | UBER | Elite | 1/27 | ❌ | 8% | 0.31 | +61 | NO | no | +0.69 | +0.67 |
| 2026-05-06 | UBER | Freight | 16/27 | ✅ | 59% | 0.22 | +19 | NO | yes | -0.22 | -0.22 |
| 2026-05-06 | UBER | Innovation | 21/27 | ❌ | 72% | 0.16 | +12 | NO | yes | -0.16 | -0.16 |
| 2026-05-06 | UBER | Joby | 3/27 | ❌ | 15% | 0.21 | +64 | NO | no | +0.79 | +0.77 |
| 2026-05-06 | UBER | Lucid | 1/27 | ✅ | 11% | 0.28 | +61 | NO | yes | -0.28 | -0.28 |
| 2026-05-06 | UBER | Lyft | 15/27 | ❌ | 53% | 0.28 | +25 | YES | yes | +0.72 | +0.70 |
| 2026-05-06 | UBER | Market Share | 11/27 | ✅ | 43% | 0.12 | +45 | NO | no | +0.88 | +0.85 |
| 2026-05-06 | UBER | Nissan | 0/27 | ❌ | 5% | 0.47 | +48 | NO | no | +0.53 | +0.51 |
| 2026-05-06 | UBER | Oil / Gas / Gasoline | 5/27 | ❌ | 21% | 0.39 | +40 | NO | no | +0.61 | +0.59 |
| 2026-05-06 | UBER | Regulator / Regulatory / Regulation | 20/27 | ✅ | 72% | 0.09 | +19 | NO | yes | -0.09 | -0.09 |
| 2026-05-06 | UBER | Safety | 16/27 | ✅ | 59% | 0.14 | +27 | NO | yes | -0.14 | -0.14 |
| 2026-05-06 | UBER | Uber Copter | 0/27 | ❌ | 5% | 0.85 | +10 | NO | no | +0.15 | +0.15 |
| 2026-05-06 | UBER | Waabi | 3/27 | ✅ | 17% | 0.34 | +49 | NO | no | +0.66 | +0.64 |
| 2026-05-06 | UBER | Waymo | 7/27 | ✅ | 30% | 0.04 | +66 | NO | yes | -0.04 | -0.04 |
| 2026-05-07 | ABNB | Acquisition | 9/20 | ❌ | 44% | 0.27 | +17 | YES | yes | +0.73 | +0.71 |
| 2026-05-07 | ABNB | Boutique | 5/20 | ✅ | 31% | 0.17 | +52 | NO | yes | -0.17 | -0.17 |
| 2026-05-07 | ABNB | Domestic | 14/20 | ✅ | 68% | 0.13 | +19 | NO | no | +0.87 | +0.84 |
| 2026-05-07 | ABNB | International | 14/20 | ✅ | 68% | 0.12 | +20 | NO | yes | -0.12 | -0.12 |
| 2026-05-07 | ABNB | Service Agent | 7/20 | ✅ | 39% | 0.19 | +42 | NO | no | +0.81 | +0.79 |
| 2026-05-07 | ABNB | Tailwind | 12/20 | ✅ | 60% | 0.21 | +19 | NO | yes | -0.21 | -0.21 |
| 2026-05-07 | ABNB | World Cup | 3/20 | ✅ | 23% | 0.04 | +73 | NO | yes | -0.04 | -0.04 |
| 2026-05-07 | LYFT | Expansion | 14/27 | ✅ | 53% | 0.26 | +21 | NO | yes | -0.26 | -0.26 |
| 2026-05-07 | LYFT | FreeNow / Free Now | 3/27 | ✅ | 17% | 0.04 | +79 | NO | yes | -0.04 | -0.04 |
| 2026-05-07 | LYFT | International | 7/27 | ❌ | 27% | 0.36 | +37 | NO | no | +0.64 | +0.62 |
| 2026-05-07 | LYFT | Membership | 11/27 | ❌ | 40% | 0.26 | +14 | YES | no | -0.26 | -0.26 |
| 2026-05-07 | LYFT | Mobileye | 3/27 | ✅ | 17% | 0.53 | +30 | NO | no | +0.47 | +0.46 |
| 2026-05-07 | LYFT | Nvidia | 1/27 | ✅ | 11% | 0.46 | +43 | NO | no | +0.54 | +0.52 |
| 2026-05-07 | LYFT | Waymo | 9/27 | ✅ | 37% | 0.07 | +56 | NO | yes | -0.07 | -0.07 |
| 2026-05-07 | MCD | Big Arch | 6/62 | ✅ | 13% | 0.09 | +78 | NO | yes | -0.09 | -0.09 |
| 2026-05-07 | MCD | Buffalo | 0/62 | ❌ | 2% | 0.83 | +15 | NO | no | +0.17 | +0.16 |
| 2026-05-07 | MCD | Delivery | 46/62 | ❌ | 72% | 0.56 | +16 | YES | yes | +0.44 | +0.43 |
| 2026-05-07 | MCD | DoorDash | 5/62 | ❌ | 10% | 0.80 | +10 | NO | no | +0.20 | +0.19 |
| 2026-05-07 | MCD | Happy Meal | 17/62 | ❌ | 28% | 0.38 | +34 | NO | yes | -0.38 | -0.38 |
| 2026-05-07 | MCD | Hot Honey | 1/62 | ❌ | 4% | 0.75 | +21 | NO | yes | -0.75 | -0.75 |
| 2026-05-07 | MCD | Loyalty | 35/62 | ✅ | 57% | 0.11 | +32 | NO | no | +0.89 | +0.86 |
| 2026-05-07 | MCD | McChicken | 12/62 | ❌ | 20% | 0.44 | +36 | NO | yes | -0.44 | -0.44 |
| 2026-05-07 | MCD | Monopoly | 16/62 | ✅ | 28% | 0.47 | +25 | NO | no | +0.53 | +0.51 |
| 2026-05-07 | MCD | Revenue | 29/62 | ✅ | 48% | 0.40 | +12 | NO | no | +0.60 | +0.58 |
| 2026-05-07 | MCD | Supply Chain | 34/62 | ✅ | 55% | 0.24 | +21 | NO | yes | -0.24 | -0.24 |
| 2026-05-07 | MCD | Tariff | 4/62 | ❌ | 8% | 0.78 | +14 | NO | no | +0.22 | +0.21 |
| 2026-05-11 | CRCL | Acceleration | 1/2 | ✅ | 58% | 0.30 | +12 | NO | yes | -0.30 | -0.30 |
| 2026-05-11 | CRCL | Fintech | 2/2 | ❌ | 50% | 0.24 | +26 | NO | yes | -0.24 | -0.24 |
| 2026-05-11 | CRCL | Intuit | 0/2 | ✅ | 46% | 0.27 | +27 | NO | no | +0.73 | +0.71 |
| 2026-05-11 | CRCL | Kraken | 1/2 | ✅ | 58% | 0.31 | +11 | NO | no | +0.69 | +0.67 |
| 2026-05-11 | CRCL | M&A / Merger | 2/2 | ❌ | 50% | 0.33 | +17 | NO | no | +0.67 | +0.65 |
| 2026-05-11 | CRCL | Polymarket | 0/2 | ✅ | 46% | 0.16 | +38 | NO | yes | -0.16 | -0.16 |
| 2026-05-11 | CRCL | Testnet | 2/2 | ✅ | 71% | 0.12 | +17 | NO | yes | -0.12 | -0.12 |
| 2026-05-11 | CRCL | Traffic | 2/2 | ✅ | 71% | 0.13 | +16 | NO | yes | -0.13 | -0.13 |
| 2026-05-11 | CRCL | Treasury | 2/2 | ❌ | 50% | 0.15 | +35 | NO | yes | -0.15 | -0.15 |
| 2026-05-11 | HIMS | Amazon | 5/20 | ❌ | 27% | 0.45 | +28 | NO | no | +0.55 | +0.53 |
| 2026-05-11 | HIMS | Canada | 3/20 | ✅ | 23% | 0.17 | +60 | NO | yes | -0.17 | -0.17 |
| 2026-05-11 | HIMS | Cancer | 3/20 | ✅ | 23% | 0.59 | +18 | NO | no | +0.41 | +0.40 |
| 2026-05-11 | HIMS | Collaboration | 7/20 | ❌ | 35% | 0.21 | +44 | NO | yes | -0.21 | -0.21 |
| 2026-05-11 | HIMS | Europe | 3/20 | ✅ | 23% | 0.19 | +58 | NO | no | +0.81 | +0.79 |
| 2026-05-11 | HIMS | FDA | 5/20 | ✅ | 31% | 0.10 | +59 | NO | yes | -0.10 | -0.10 |
| 2026-05-11 | HIMS | Lab Testing | 5/20 | ✅ | 31% | 0.27 | +42 | NO | yes | -0.27 | -0.27 |
| 2026-05-11 | HIMS | Peptide | 4/20 | ✅ | 27% | 0.06 | +67 | NO | yes | -0.06 | -0.06 |
| 2026-05-11 | HIMS | Regulation | 3/20 | ❌ | 19% | 0.30 | +51 | NO | no | +0.70 | +0.68 |
| 2026-05-11 | HIMS | Testosterone | 6/20 | ✅ | 35% | 0.32 | +33 | NO | yes | -0.32 | -0.32 |
| 2026-05-11 | HIMS | Vitamin | 5/20 | ✅ | 31% | 0.35 | +34 | NO | no | +0.65 | +0.63 |
| 2026-05-11 | HIMS | Zava | 2/20 | ✅ | 18% | 0.27 | +55 | NO | yes | -0.27 | -0.27 |
| 2026-05-12 | OKLO | AI / Artificial Intelligence | 6/6 | ❌ | 72% | 0.50 | +22 | YES | yes | +0.50 | +0.48 |
| 2026-05-12 | OKLO | Meta | 0/6 | ✅ | 26% | 0.10 | +64 | NO | yes | -0.10 | -0.10 |
| 2026-05-12 | OKLO | Ohio | 2/6 | ✅ | 45% | 0.15 | +40 | NO | yes | -0.15 | -0.15 |
| 2026-05-12 | OKLO | Tennessee | 1/6 | ✅ | 36% | 0.10 | +55 | NO | yes | -0.10 | -0.10 |
| 2026-05-13 | NBIS | Hyperscaler | 4/9 | ✅ | 49% | 0.28 | +23 | NO | yes | -0.28 | -0.28 |
| 2026-05-13 | NBIS | Microsoft | 2/9 | ✅ | 34% | 0.10 | +56 | NO | yes | -0.10 | -0.10 |
| 2026-05-13 | NBIS | Neocloud | 2/9 | ❌ | 27% | 0.41 | +32 | NO | no | +0.59 | +0.57 |
| 2026-05-13 | NBIS | Token | 2/9 | ✅ | 34% | 0.11 | +55 | NO | yes | -0.11 | -0.11 |
| 2026-05-13 | NBIS | TripleTen / Triple Ten | 3/9 | ❌ | 34% | 0.02 | +32 | YES | yes | +0.98 | +0.95 |
| 2026-05-13 | NBIS | Uber | 6/9 | ❌ | 56% | 0.46 | +10 | YES | no | -0.46 | -0.46 |
| 2026-05-14 | KLAR | AI / Artificial Intelligence | 2/2 | ✅ | 71% | 0.16 | +13 | NO | no | +0.84 | +0.81 |
| 2026-05-14 | KLAR | Coinbase | 0/2 | ❌ | 25% | 0.15 | +60 | NO | no | +0.85 | +0.82 |
| 2026-05-14 | KLAR | Credit Quality | 1/2 | ✅ | 58% | 0.15 | +26 | NO | yes | -0.15 | -0.15 |
| 2026-05-14 | KLAR | Delinquency | 1/2 | ✅ | 58% | 0.10 | +32 | NO | yes | -0.10 | -0.10 |
| 2026-05-14 | KLAR | Gemini | 0/2 | ❌ | 25% | 0.15 | +60 | NO | yes | -0.15 | -0.15 |
| 2026-05-14 | KLAR | Inflation | 0/2 | ❌ | 25% | 0.02 | +23 | YES | no | -0.02 | -0.02 |
| 2026-05-14 | KLAR | Investment | 1/2 | ✅ | 58% | 0.15 | +26 | NO | no | +0.85 | +0.82 |
| 2026-05-14 | KLAR | Profitability | 2/2 | ✅ | 71% | 0.15 | +14 | NO | no | +0.85 | +0.82 |
| 2026-05-14 | KLAR | Sweden | 1/2 | ✅ | 58% | 0.16 | +26 | NO | no | +0.84 | +0.81 |
| 2026-05-14 | KLAR | Tailwind | 0/2 | ❌ | 25% | 0.02 | +23 | YES | yes | +0.98 | +0.95 |
| 2026-05-19 | CAVA | Acceleration | 3/10 | ❌ | 32% | 0.16 | +16 | YES | no | -0.16 | -0.16 |
| 2026-05-19 | CAVA | Dining | 9/10 | ❌ | 73% | 0.63 | +10 | YES | no | -0.63 | -0.63 |
| 2026-05-19 | CAVA | Glazed Salmon | 0/10 | ✅ | 18% | 0.14 | +68 | NO | yes | -0.14 | -0.14 |
| 2026-05-19 | CAVA | Spice | 3/10 | ✅ | 39% | 0.40 | +21 | NO | yes | -0.40 | -0.40 |
| 2026-05-19 | CAVA | Sweet Potato | 1/10 | ✅ | 25% | 0.49 | +26 | NO | yes | -0.49 | -0.49 |
| 2026-05-19 | CAVA | Tariff | 3/10 | ✅ | 39% | 0.37 | +24 | NO | no | +0.63 | +0.61 |
| 2026-05-19 | HD | Competition / Competitor | 30/62 | ❌ | 48% | 0.28 | +20 | YES | yes | +0.72 | +0.70 |
| 2026-05-19 | HD | Headwind | 35/62 | ❌ | 55% | 0.31 | +24 | YES | yes | +0.69 | +0.67 |
| 2026-05-19 | HD | Lumber | 58/62 | ✅ | 91% | 0.71 | +20 | YES | no | -0.71 | -0.71 |
| 2026-05-19 | HD | Synergy | 4/62 | ❌ | 8% | 0.46 | +46 | NO | no | +0.54 | +0.52 |
| 2026-05-19 | HD | Tariff | 14/62 | ✅ | 25% | 0.08 | +67 | NO | yes | -0.08 | -0.08 |
| 2026-05-19 | HD | Volatility | 11/62 | ✅ | 20% | 0.50 | +30 | NO | no | +0.50 | +0.48 |
| 2026-05-20 | LOW | Competition / Competitor | 39/62 | ✅ | 63% | 0.17 | +20 | NO | no | +0.83 | +0.81 |
| 2026-05-20 | LOW | Hurricane | 29/62 | ✅ | 48% | 0.37 | +15 | NO | no | +0.63 | +0.61 |
| 2026-05-20 | LOW | Inflation | 42/62 | ✅ | 67% | 0.18 | +15 | NO | yes | -0.18 | -0.18 |
| 2026-05-20 | LOW | Subscription | 1/62 | ❌ | 4% | 0.24 | +72 | NO | yes | -0.24 | -0.24 |
| 2026-05-20 | LOW | Tariff | 7/62 | ✅ | 14% | 0.34 | +52 | NO | yes | -0.34 | -0.34 |
| 2026-05-20 | LOW | Volatility | 9/62 | ✅ | 17% | 0.68 | +15 | NO | no | +0.32 | +0.31 |
| 2026-05-20 | NVDA | Arizona | 2/61 | ❌ | 5% | 0.62 | +33 | NO | no | +0.38 | +0.37 |
| 2026-05-20 | NVDA | Automation | 14/61 | ❌ | 24% | 0.32 | +44 | NO | no | +0.68 | +0.66 |
| 2026-05-20 | NVDA | Cosmos | 4/61 | ✅ | 10% | 0.29 | +61 | NO | no | +0.71 | +0.69 |
| 2026-05-20 | NVDA | Domestic | 10/61 | ❌ | 18% | 0.60 | +22 | NO | no | +0.40 | +0.39 |
| 2026-05-20 | NVDA | GM / General Motors | 4/61 | ❌ | 8% | 0.72 | +20 | NO | no | +0.28 | +0.27 |
| 2026-05-20 | NVDA | H20 | 4/61 | ❌ | 8% | 0.45 | +47 | NO | no | +0.55 | +0.53 |
| 2026-05-20 | NVDA | Humanoid | 4/61 | ❌ | 8% | 0.44 | +48 | NO | yes | -0.44 | -0.44 |
| 2026-05-20 | NVDA | Hyperscaler | 25/61 | ✅ | 42% | 0.07 | +51 | NO | yes | -0.07 | -0.07 |
| 2026-05-20 | NVDA | Omniverse | 20/61 | ✅ | 34% | 0.22 | +44 | NO | no | +0.78 | +0.76 |
| 2026-05-20 | NVDA | Self Driving | 0/61 | ❌ | 2% | 0.26 | +72 | NO | yes | -0.26 | -0.26 |
| 2026-05-20 | NVDA | Taiwan | 10/61 | ❌ | 18% | 0.54 | +28 | NO | no | +0.46 | +0.45 |
| 2026-05-20 | NVDA | Talent | 4/61 | ✅ | 10% | 0.61 | +29 | NO | no | +0.39 | +0.38 |
| 2026-05-20 | NVDA | Tariff | 3/61 | ❌ | 7% | 0.52 | +41 | NO | no | +0.48 | +0.47 |
| 2026-05-20 | NVDA | Trump | 1/61 | ❌ | 4% | 0.59 | +37 | NO | no | +0.41 | +0.40 |
| 2026-05-20 | NVDA | TSMC | 21/61 | ❌ | 35% | 0.21 | +44 | NO | no | +0.79 | +0.77 |
| 2026-05-20 | NVDA | VR / Virtual Reality | 23/61 | ❌ | 38% | 0.20 | +18 | YES | no | -0.20 | -0.20 |
| 2026-05-20 | TGT | Circle 360 | 8/51 | ✅ | 19% | 0.04 | +77 | NO | no | +0.96 | +0.93 |
| 2026-05-20 | TGT | Competition | 15/51 | ✅ | 32% | 0.42 | +26 | NO | no | +0.58 | +0.56 |
| 2026-05-20 | TGT | Holiday | 49/51 | ❌ | 92% | 0.66 | +26 | YES | no | -0.66 | -0.66 |
| 2026-05-20 | TGT | Inflation | 22/51 | ❌ | 43% | 0.47 | +10 | NO | no | +0.53 | +0.51 |
| 2026-05-20 | TGT | Innovation | 38/51 | ✅ | 73% | 0.49 | +24 | YES | no | -0.49 | -0.49 |
| 2026-05-20 | TGT | SNAP / Food Stamp | 5/51 | ❌ | 12% | 0.61 | +27 | NO | no | +0.39 | +0.38 |
| 2026-05-20 | TGT | Synthetic Color | 2/51 | ✅ | 8% | 0.60 | +32 | NO | yes | -0.60 | -0.60 |
| 2026-05-20 | TGT | Tariff | 10/51 | ✅ | 22% | 0.10 | +68 | NO | no | +0.90 | +0.87 |
| 2026-05-20 | TOL | Apartment | 21/24 | ✅ | 83% | 0.72 | +11 | YES | yes | +0.28 | +0.27 |
| 2026-05-20 | TOL | Buffington / Arkansas | 0/24 | ❌ | 5% | 0.19 | +76 | NO | yes | -0.19 | -0.19 |
| 2026-05-20 | TOL | Customize / Customization | 8/24 | ✅ | 37% | 0.50 | +13 | NO | yes | -0.50 | -0.50 |
| 2026-05-20 | TOL | Headwind | 6/24 | ✅ | 30% | 0.26 | +44 | NO | no | +0.74 | +0.72 |
| 2026-05-20 | TOL | Lumber | 12/24 | ✅ | 51% | 0.35 | +14 | NO | yes | -0.35 | -0.35 |
| 2026-05-20 | TOL | Millennial | 18/24 | ✅ | 73% | 0.51 | +22 | YES | no | -0.51 | -0.51 |
| 2026-05-20 | TOL | Tailwind | 14/24 | ✅ | 58% | 0.39 | +19 | YES | no | -0.39 | -0.39 |
| 2026-05-20 | TOL | Tariff | 5/24 | ✅ | 26% | 0.53 | +21 | NO | yes | -0.53 | -0.53 |
| 2026-05-20 | URBN | Headwind | 21/56 | ✅ | 39% | 0.34 | +27 | NO | yes | -0.34 | -0.34 |
| 2026-05-20 | URBN | Holiday | 44/56 | ✅ | 77% | 0.60 | +17 | YES | no | -0.60 | -0.60 |
| 2026-05-20 | URBN | International / Internationally | 40/56 | ✅ | 71% | 0.29 | +42 | YES | yes | +0.71 | +0.69 |
| 2026-05-20 | URBN | Store Opening | 25/56 | ✅ | 46% | 0.40 | +14 | NO | yes | -0.40 | -0.40 |
| 2026-05-20 | URBN | Tariff | 8/56 | ✅ | 17% | 0.10 | +73 | NO | yes | -0.10 | -0.10 |
| 2026-05-21 | BULL | Advisor | 1/3 | ✅ | 51% | 0.40 | +11 | YES | yes | +0.60 | +0.58 |
| 2026-05-21 | BULL | BlackRock | 2/3 | ✅ | 63% | 0.51 | +12 | YES | no | -0.51 | -0.51 |
| 2026-05-21 | BULL | Buyback / Repurchase | 0/3 | ❌ | 22% | 0.23 | +55 | NO | yes | -0.23 | -0.23 |
| 2026-05-21 | BULL | Canada | 2/3 | ✅ | 63% | 0.26 | +11 | NO | yes | -0.26 | -0.26 |
| 2026-05-21 | BULL | Kalshi | 3/3 | ❌ | 58% | 0.29 | +29 | YES | no | -0.29 | -0.29 |
| 2026-05-21 | BULL | Kiwoom | 0/3 | ❌ | 22% | 0.36 | +42 | NO | no | +0.64 | +0.62 |
| 2026-05-21 | BULL | Korea / Korean | 1/3 | ✅ | 51% | 0.18 | +31 | NO | yes | -0.18 | -0.18 |
| 2026-05-21 | BULL | Token / Tokenized | 2/3 | ❌ | 46% | 0.40 | +14 | NO | no | +0.60 | +0.58 |
| 2026-05-21 | BULL | Vega (5+ times) | 0/3 | ❌ | 22% | 0.30 | +48 | NO | yes | -0.30 | -0.30 |
| 2026-05-21 | DE | AI / Artificial Intelligence | 4/63 | ✅ | 10% | 0.33 | +57 | NO | no | +0.67 | +0.65 |
| 2026-05-21 | DE | Automation | 20/63 | ✅ | 33% | 0.15 | +52 | NO | yes | -0.15 | -0.15 |
| 2026-05-21 | DE | Dividend | 38/63 | ✅ | 60% | 0.25 | +15 | NO | yes | -0.25 | -0.25 |
| 2026-05-21 | DE | Efficiency | 30/63 | ✅ | 48% | 0.18 | +34 | NO | no | +0.82 | +0.80 |
| 2026-05-21 | DE | Manufacturing | 26/63 | ❌ | 41% | 0.44 | +15 | NO | yes | -0.44 | -0.44 |
| 2026-05-21 | DE | Oil / Gas / Gasoline | 39/63 | ❌ | 60% | 0.21 | +19 | NO | yes | -0.21 | -0.21 |
| 2026-05-21 | DE | Precision Upgrade | 5/63 | ❌ | 10% | 0.62 | +28 | NO | no | +0.38 | +0.37 |
| 2026-05-21 | DE | Tariff | 16/63 | ✅ | 27% | 0.11 | +62 | NO | yes | -0.11 | -0.11 |
| 2026-05-21 | DE | Warranty | 19/63 | ✅ | 32% | 0.29 | +39 | NO | no | +0.71 | +0.69 |
| 2026-05-21 | DE | Weather | 44/63 | ❌ | 68% | 0.40 | +28 | YES | no | -0.40 | -0.40 |
| 2026-05-21 | WMT | Automotive | 15/58 | ❌ | 27% | 0.59 | +14 | NO | no | +0.41 | +0.40 |
| 2026-05-21 | WMT | Automation | 25/58 | ✅ | 44% | 0.07 | +49 | NO | yes | -0.07 | -0.07 |
| 2026-05-21 | WMT | Dividend | 39/58 | ❌ | 65% | 0.23 | +12 | NO | no | +0.77 | +0.75 |
| 2026-05-21 | WMT | Omnichannel | 24/58 | ✅ | 43% | 0.24 | +33 | NO | yes | -0.24 | -0.24 |
| 2026-05-21 | WMT | OnePay / One Pay | 2/58 | ✅ | 7% | 0.27 | +66 | NO | no | +0.73 | +0.71 |
| 2026-05-21 | WMT | OpenAI | 1/58 | ✅ | 5% | 0.29 | +66 | NO | no | +0.71 | +0.69 |
| 2026-05-21 | WMT | Prescription | 23/58 | ❌ | 39% | 0.13 | +26 | YES | yes | +0.87 | +0.84 |
| 2026-05-21 | WMT | SNAP / Food Stamp | 12/58 | ❌ | 22% | 0.07 | +15 | YES | no | -0.07 | -0.07 |
| 2026-05-21 | WMT | Tariff | 32/58 | ✅ | 55% | 0.24 | +21 | NO | yes | -0.24 | -0.24 |
| 2026-05-21 | WMT | Upper Income | 1/58 | ❌ | 4% | 0.70 | +26 | NO | no | +0.30 | +0.29 |
| 2026-05-27 | MRVL | AWS / Amazon | 8/44 | ❌ | 20% | 0.60 | +20 | NO | no | +0.40 | +0.39 |
| 2026-05-27 | MRVL | Celestial | 0/44 | ✅ | 5% | 0.17 | +78 | NO | yes | -0.17 | -0.17 |
| 2026-05-27 | MRVL | Electro-Optic / Electro Optic | 17/44 | ✅ | 40% | 0.15 | +45 | NO | no | +0.85 | +0.82 |
| 2026-05-27 | MRVL | Hyperscaler | 20/44 | ✅ | 47% | 0.17 | +36 | NO | yes | -0.17 | -0.17 |
| 2026-05-27 | MRVL | Inference | 9/44 | ✅ | 24% | 0.28 | +48 | NO | yes | -0.28 | -0.28 |
| 2026-05-27 | MRVL | LPO | 3/44 | ❌ | 9% | 0.41 | +50 | NO | no | +0.59 | +0.57 |
| 2026-05-27 | MRVL | Nvidia | 8/44 | ❌ | 20% | 0.41 | +39 | NO | yes | -0.41 | -0.41 |
| 2026-05-27 | MRVL | Trainium | 1/44 | ❌ | 5% | 0.84 | +11 | NO | no | +0.16 | +0.16 |
| 2026-05-27 | MRVL | Xconn | 0/44 | ✅ | 5% | 0.24 | +71 | NO | yes | -0.24 | -0.24 |
| 2026-05-27 | SNOW | AWS | 18/21 | ❌ | 78% | 0.60 | +18 | YES | yes | +0.40 | +0.39 |
| 2026-05-27 | SNOW | Claude | 1/21 | ✅ | 14% | 0.75 | +11 | NO | no | +0.25 | +0.24 |
| 2026-05-27 | SNOW | Compute | 15/21 | ✅ | 69% | 0.55 | +14 | YES | yes | +0.45 | +0.44 |
| 2026-05-27 | SNOW | Europe | 13/21 | ✅ | 61% | 0.38 | +23 | YES | no | -0.38 | -0.38 |
| 2026-05-27 | SNOW | Hiring | 20/21 | ✅ | 89% | 0.70 | +19 | YES | yes | +0.30 | +0.29 |
| 2026-05-27 | SNOW | Iceberg | 11/21 | ✅ | 53% | 0.28 | +19 | NO | no | +0.72 | +0.70 |
| 2026-05-27 | SNOW | Open Source | 3/21 | ❌ | 18% | 0.62 | +20 | NO | yes | -0.62 | -0.62 |
| 2026-05-27 | SNOW | Repurchase | 12/21 | ✅ | 57% | 0.10 | +33 | NO | yes | -0.10 | -0.10 |
| 2026-05-28 | COST | Automation | 4/63 | ❌ | 8% | 0.75 | +17 | NO | no | +0.25 | +0.24 |
| 2026-05-28 | COST | Cannibalization | 32/63 | ✅ | 51% | 0.29 | +22 | YES | no | -0.29 | -0.29 |
| 2026-05-28 | COST | Dividend | 45/63 | ✅ | 71% | 0.51 | +20 | YES | yes | +0.49 | +0.48 |
| 2026-05-28 | COST | Gold Bar | 2/63 | ✅ | 7% | 0.83 | +10 | NO | no | +0.17 | +0.16 |
| 2026-05-28 | COST | Holiday | 46/63 | ❌ | 71% | 0.17 | +54 | YES | no | -0.17 | -0.17 |
| 2026-05-28 | COST | Hot Dog | 15/63 | ❌ | 25% | 0.49 | +26 | NO | yes | -0.49 | -0.49 |
| 2026-05-28 | COST | Instacart | 39/63 | ✅ | 62% | 0.26 | +12 | NO | yes | -0.26 | -0.26 |
| 2026-05-28 | COST | Kirkland | 45/63 | ✅ | 71% | 0.09 | +20 | NO | yes | -0.09 | -0.09 |
| 2026-05-28 | COST | Revenue | 28/63 | ✅ | 45% | 0.32 | +23 | NO | yes | -0.32 | -0.32 |
| 2026-05-28 | COST | Tariff | 13/63 | ✅ | 23% | 0.08 | +69 | NO | yes | -0.08 | -0.08 |
| 2026-05-28 | CRM | AgentForce / Agent Force | 7/63 | ✅ | 14% | 0.07 | +79 | NO | yes | -0.07 | -0.07 |
| 2026-05-28 | CRM | AWS / Amazon | 30/63 | ✅ | 48% | 0.20 | +32 | NO | yes | -0.20 | -0.20 |
| 2026-05-28 | CRM | Consumption | 10/63 | ✅ | 18% | 0.16 | +66 | NO | yes | -0.16 | -0.16 |
| 2026-05-28 | CRM | Einstein | 35/63 | ❌ | 54% | 0.35 | +11 | NO | no | +0.65 | +0.63 |
| 2026-05-28 | CRM | Flex Credit | 3/63 | ✅ | 8% | 0.51 | +41 | NO | yes | -0.51 | -0.51 |
| 2026-05-28 | CRM | Reasoning | 3/63 | ❌ | 7% | 0.56 | +37 | NO | no | +0.44 | +0.43 |
| 2026-05-28 | CRM | Trillion | 20/63 | ✅ | 33% | 0.20 | +47 | NO | yes | -0.20 | -0.20 |
| 2026-05-28 | CRM | Zero Copy | 7/63 | ❌ | 13% | 0.25 | +62 | NO | no | +0.75 | +0.73 |
| 2026-05-28 | DELL | AI Factory | 3/19 | ✅ | 24% | 0.36 | +40 | NO | yes | -0.36 | -0.36 |
| 2026-05-28 | DELL | Confidence | 13/19 | ✅ | 67% | 0.22 | +11 | NO | yes | -0.22 | -0.22 |
| 2026-05-28 | DELL | Dividend (3+ times) | 0/19 | ❌ | 7% | 0.61 | +32 | NO | no | +0.39 | +0.38 |
| 2026-05-28 | DELL | EPS Growth | 10/19 | ✅ | 54% | 0.18 | +28 | NO | no | +0.82 | +0.80 |
| 2026-05-28 | DELL | Mistral | 1/19 | ❌ | 11% | 0.58 | +31 | NO | yes | -0.58 | -0.58 |
| 2026-05-28 | DELL | Nvidia | 9/19 | ❌ | 45% | 0.31 | +24 | NO | yes | -0.31 | -0.31 |
| 2026-05-28 | DELL | Texas | 1/19 | ❌ | 11% | 0.66 | +23 | NO | no | +0.34 | +0.33 |
| 2026-05-28 | DELL | Trump | 0/19 | ❌ | 7% | 0.71 | +22 | NO | no | +0.29 | +0.28 |
| 2026-05-28 | DELL | Windows 10 | 8/19 | ❌ | 41% | 0.31 | +10 | YES | no | -0.31 | -0.31 |
| 2026-06-01 | HPE | Government | 6/19 | ✅ | 37% | 0.48 | +15 | NO | yes | -0.48 | -0.48 |
| 2026-06-01 | HPE | Headwind | 18/19 | ✅ | 88% | 0.74 | +14 | YES | no | -0.74 | -0.74 |
| 2026-06-01 | HPE | Morpheus | 5/19 | ❌ | 28% | 0.51 | +21 | NO | yes | -0.51 | -0.51 |
| 2026-06-01 | HPE | Nvidia | 11/19 | ❌ | 54% | 0.32 | +14 | NO | yes | -0.32 | -0.32 |
| 2026-06-01 | HPE | Quantum | 3/19 | ❌ | 20% | 0.68 | +12 | NO | no | +0.32 | +0.31 |
| 2026-06-01 | HPE | Self Driving | 0/19 | ❌ | 7% | 0.21 | +72 | NO | yes | -0.21 | -0.21 |
| 2026-06-01 | HPE | Supercomputing / Super Computing | 13/19 | ❌ | 63% | 0.45 | +18 | YES | no | -0.45 | -0.45 |
| 2026-06-01 | HPE | Synergy | 3/19 | ✅ | 24% | 0.09 | +67 | NO | yes | -0.09 | -0.09 |
| 2026-06-01 | HPE | Tariff | 3/19 | ✅ | 24% | 0.60 | +16 | NO | no | +0.40 | +0.39 |
| 2026-06-02 | ULTA | AI / Artificial Intelligence | 5/19 | ✅ | 32% | 0.07 | +61 | NO | yes | -0.07 | -0.07 |
| 2026-06-02 | ULTA | Google / Gemini | 2/19 | ❌ | 15% | 0.18 | +67 | NO | yes | -0.18 | -0.18 |
| 2026-06-02 | ULTA | Headwind | 15/19 | ✅ | 75% | 0.55 | +20 | YES | no | -0.55 | -0.55 |
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
| 2026-06-02 | VSCO | Dream | 2/5 | ✅ | 50% | 0.30 | +20 | YES | no | -0.30 | -0.30 |
| 2026-06-02 | VSCO | Fragrance | 3/5 | ✅ | 60% | 0.09 | +31 | NO | yes | -0.09 | -0.09 |
| 2026-06-02 | VSCO | Hailey Bieber | 1/5 | ❌ | 27% | 0.62 | +11 | NO | yes | -0.62 | -0.62 |
| 2026-06-02 | VSCO | Headwind | 2/5 | ❌ | 38% | 0.43 | +19 | NO | yes | -0.43 | -0.43 |
| 2026-06-02 | VSCO | Loyalty Program | 4/5 | ✅ | 70% | 0.38 | +32 | YES | no | -0.38 | -0.38 |
| 2026-06-02 | VSCO | Sport Bra / Sports Bra | 3/5 | ✅ | 60% | 0.25 | +15 | NO | yes | -0.25 | -0.25 |
| 2026-06-02 | VSCO | Tailwind | 2/5 | ❌ | 38% | 0.45 | +17 | NO | yes | -0.45 | -0.45 |
| 2026-06-02 | VSCO | Tariff | 0/5 | ✅ | 29% | 0.05 | +66 | NO | yes | -0.05 | -0.05 |
| 2026-06-02 | VSCO | Ticker | 0/5 | ❌ | 17% | 0.26 | +57 | NO | yes | -0.26 | -0.26 |
| 2026-06-02 | VSCO | Valentine | 1/5 | ❌ | 27% | 0.45 | +28 | NO | yes | -0.45 | -0.45 |
| 2026-06-03 | AVGO | Acquisition | 37/43 | ❌ | 82% | 0.50 | +32 | YES | no | -0.50 | -0.50 |
| 2026-06-03 | AVGO | Anthropic | 1/43 | ✅ | 7% | 0.18 | +75 | NO | yes | -0.18 | -0.18 |
| 2026-06-03 | AVGO | Competition | 15/43 | ✅ | 37% | 0.40 | +23 | NO | no | +0.60 | +0.58 |
| 2026-06-03 | AVGO | Hyperscaler | 17/43 | ✅ | 41% | 0.07 | +52 | NO | yes | -0.07 | -0.07 |
| 2026-06-03 | AVGO | Meta | 1/43 | ✅ | 7% | 0.21 | +72 | NO | yes | -0.21 | -0.21 |
| 2026-06-03 | AVGO | NVLink | 2/43 | ❌ | 7% | 0.69 | +24 | NO | no | +0.31 | +0.30 |
| 2026-06-03 | AVGO | Open Source | 2/43 | ❌ | 7% | 0.77 | +16 | NO | no | +0.23 | +0.22 |
| 2026-06-03 | AVGO | OpenAI | 1/43 | ✅ | 7% | 0.29 | +64 | NO | yes | -0.29 | -0.29 |
| 2026-06-03 | AVGO | Optic | 23/43 | ❌ | 52% | 0.29 | +23 | YES | yes | +0.71 | +0.69 |
| 2026-06-03 | AVGO | Quantum | 0/43 | ❌ | 3% | 0.86 | +11 | NO | no | +0.14 | +0.14 |
| 2026-06-03 | AVGO | Tomahawk 6 | 6/43 | ✅ | 18% | 0.16 | +66 | NO | yes | -0.16 | -0.16 |
| 2026-06-03 | CRWD | China | 3/27 | ❌ | 15% | 0.64 | +21 | NO | no | +0.36 | +0.35 |
| 2026-06-03 | CRWD | Claude | 1/27 | ✅ | 11% | 0.37 | +52 | NO | yes | -0.37 | -0.37 |
| 2026-06-03 | CRWD | Consolidation | 21/27 | ✅ | 75% | 0.09 | +16 | NO | yes | -0.09 | -0.09 |
| 2026-06-03 | CRWD | Falcon Flex | 9/27 | ✅ | 37% | 0.09 | +54 | NO | yes | -0.09 | -0.09 |
| 2026-06-03 | CRWD | Germany | 0/27 | ❌ | 5% | 0.36 | +59 | NO | no | +0.64 | +0.62 |
| 2026-06-03 | CRWD | Headwind | 6/27 | ❌ | 24% | 0.51 | +25 | NO | no | +0.49 | +0.48 |
| 2026-06-03 | CRWD | Hyperscaler | 9/27 | ✅ | 37% | 0.21 | +42 | NO | yes | -0.21 | -0.21 |
| 2026-06-03 | CRWD | Nvidia | 4/27 | ✅ | 21% | 0.28 | +51 | NO | yes | -0.28 | -0.28 |
| 2026-06-03 | CRWD | SGNL / Signal | 5/27 | ✅ | 24% | 0.19 | +57 | NO | yes | -0.19 | -0.19 |
| 2026-06-03 | CRWD | Shadow | 3/27 | ❌ | 15% | 0.66 | +19 | NO | yes | -0.66 | -0.66 |
| 2026-06-03 | M | AI / Artificial Intelligence | 6/31 | ✅ | 24% | 0.13 | +63 | NO | yes | -0.13 | -0.13 |
| 2026-06-03 | M | Backstage | 26/31 | ✅ | 81% | 0.64 | +17 | YES | yes | +0.36 | +0.35 |
| 2026-06-03 | M | China | 11/31 | ✅ | 38% | 0.29 | +33 | NO | yes | -0.29 | -0.29 |
| 2026-06-03 | M | Headwind | 23/31 | ✅ | 72% | 0.54 | +18 | YES | yes | +0.46 | +0.45 |
| 2026-06-03 | M | Holiday | 31/31 | ✅ | 95% | 0.80 | +15 | YES | yes | +0.20 | +0.19 |
| 2026-06-03 | M | Hospitality | 4/31 | ✅ | 18% | 0.66 | +16 | NO | no | +0.34 | +0.33 |
| 2026-06-03 | M | Marketplace | 22/31 | ✅ | 70% | 0.08 | +22 | NO | yes | -0.08 | -0.08 |
| 2026-06-03 | M | Tariff | 8/31 | ✅ | 30% | 0.10 | +60 | NO | yes | -0.10 | -0.10 |
| 2026-06-04 | LULU | AI / Artificial Intelligence | 2/55 | ✅ | 7% | 0.32 | +61 | NO | yes | -0.32 | -0.32 |
| 2026-06-04 | LULU | Amex | 1/55 | ❌ | 4% | 0.83 | +13 | NO | no | +0.17 | +0.16 |
| 2026-06-04 | LULU | Chip / Wilson | 7/55 | ✅ | 16% | 0.50 | +34 | NO | no | +0.50 | +0.48 |
| 2026-06-04 | LULU | Headwind | 29/55 | ✅ | 53% | 0.26 | +21 | NO | yes | -0.26 | -0.26 |
| 2026-06-04 | LULU | Holiday | 44/55 | ❌ | 77% | 0.11 | +66 | YES | no | -0.11 | -0.11 |
| 2026-06-04 | LULU | Membership | 26/55 | ❌ | 47% | 0.36 | +17 | NO | no | +0.64 | +0.62 |
| 2026-06-04 | LULU | PowerLu | 0/55 | ✅ | 4% | 0.62 | +34 | NO | no | +0.38 | +0.37 |
| 2026-06-04 | LULU | ShowZero | 2/55 | ✅ | 7% | 0.24 | +69 | NO | no | +0.76 | +0.74 |
| 2026-06-04 | LULU | Tariff | 9/55 | ✅ | 19% | 0.05 | +76 | NO | yes | -0.05 | -0.05 |
| 2026-06-04 | LULU | Unrestricted Power | 0/55 | ✅ | 4% | 0.32 | +64 | NO | no | +0.68 | +0.66 |
| 2026-06-08 | MTN | Canada / Canadian | 24/25 | ❌ | 88% | 0.50 | +38 | YES | no | -0.50 | -0.50 |
| 2026-06-08 | MTN | Gen Z | 0/25 | ✅ | 8% | 0.36 | +56 | NO | no | +0.64 | +0.62 |
| 2026-06-08 | MTN | Renewal | 20/25 | ✅ | 77% | 0.44 | +33 | YES | yes | +0.56 | +0.54 |
| 2026-06-08 | MTN | Snowpack | 2/25 | ✅ | 15% | 0.47 | +38 | NO | no | +0.53 | +0.51 |
| 2026-06-09 | CBRL | 250 | 1/29 | ❌ | 8% | 0.52 | +40 | NO | yes | -0.52 | -0.52 |
| 2026-06-09 | CBRL | AI / Artificial Intelligence | 3/29 | ❌ | 14% | 0.37 | +49 | NO | yes | -0.37 | -0.37 |
| 2026-06-09 | CBRL | Campfire | 4/29 | ✅ | 19% | 0.15 | +66 | NO | yes | -0.15 | -0.15 |
| 2026-06-09 | CBRL | Catfish | 0/29 | ❌ | 5% | 0.81 | +14 | NO | no | +0.19 | +0.18 |
| 2026-06-09 | CBRL | Cracker Barrel 400 | 2/29 | ✅ | 13% | 0.17 | +70 | NO | yes | -0.17 | -0.17 |
| 2026-06-09 | CBRL | Location | 22/29 | ❌ | 71% | 0.30 | +41 | YES | no | -0.30 | -0.30 |
| 2026-06-09 | CBRL | Meals for Two | 1/29 | ✅ | 10% | 0.69 | +21 | NO | no | +0.31 | +0.30 |
| 2026-06-09 | CBRL | Road Trip | 2/29 | ❌ | 11% | 0.15 | +74 | NO | yes | -0.15 | -0.15 |
| 2026-06-09 | CBRL | Tariff | 8/29 | ✅ | 31% | 0.20 | +49 | NO | yes | -0.20 | -0.20 |
| 2026-06-10 | CHWY | App | 12/23 | ✅ | 53% | 0.08 | +39 | NO | yes | -0.08 | -0.08 |
| 2026-06-10 | CHWY | Holiday | 18/23 | ❌ | 72% | 0.15 | +57 | YES | no | -0.15 | -0.15 |
| 2026-06-10 | CHWY | Humanization | 6/23 | ✅ | 31% | 0.40 | +29 | NO | no | +0.60 | +0.58 |
| 2026-06-10 | CHWY | Insurance | 14/23 | ❌ | 57% | 0.32 | +25 | YES | no | -0.32 | -0.32 |
| 2026-06-10 | CHWY | International / Internationally | 9/23 | ❌ | 39% | 0.19 | +20 | YES | no | -0.19 | -0.19 |
| 2026-06-10 | CHWY | Modern Animal | 0/23 | ❌ | 6% | 0.04 | +90 | NO | yes | -0.04 | -0.04 |
| 2026-06-10 | CHWY | SmartEquine | 0/23 | ✅ | 9% | 0.29 | +62 | NO | no | +0.71 | +0.69 |
| 2026-06-10 | CHWY | Supplement | 5/23 | ✅ | 27% | 0.29 | +44 | NO | no | +0.71 | +0.69 |
| 2026-06-10 | ORCL | Air Force | 0/62 | ❌ | 2% | 0.74 | +24 | NO | no | +0.26 | +0.25 |
| 2026-06-10 | ORCL | Automation | 28/62 | ✅ | 46% | 0.41 | +13 | NO | no | +0.59 | +0.57 |
| 2026-06-10 | ORCL | Backlog | 18/62 | ✅ | 31% | 0.25 | +44 | NO | no | +0.75 | +0.73 |
| 2026-06-10 | ORCL | Health | 34/62 | ✅ | 55% | 0.34 | +11 | NO | yes | -0.34 | -0.34 |
| 2026-06-10 | ORCL | Hyperscaler | 14/62 | ❌ | 23% | 0.40 | +37 | NO | no | +0.60 | +0.58 |
| 2026-06-10 | ORCL | Java | 27/62 | ❌ | 43% | 0.26 | +17 | YES | no | -0.26 | -0.26 |
| 2026-06-10 | ORCL | Multicloud | 1/62 | ❌ | 4% | 0.08 | +88 | NO | yes | -0.08 | -0.08 |
| 2026-06-10 | ORCL | OpenAI | 8/62 | ❌ | 14% | 0.34 | +52 | NO | no | +0.66 | +0.64 |
| 2026-06-10 | ORCL | Partner | 27/62 | ✅ | 44% | 0.07 | +49 | NO | yes | -0.07 | -0.07 |
| 2026-06-10 | ORCL | Sovereign | 8/62 | ✅ | 16% | 0.35 | +49 | NO | no | +0.65 | +0.63 |
| 2026-06-10 | ORCL | Stargate | 2/62 | ❌ | 5% | 0.55 | +40 | NO | no | +0.45 | +0.44 |
| 2026-06-11 | ADBE | 3D | 29/58 | ✅ | 51% | 0.17 | +32 | NO | yes | -0.17 | -0.17 |
| 2026-06-11 | ADBE | Firefly Video | 5/58 | ❌ | 10% | 0.53 | +37 | NO | no | +0.47 | +0.46 |
| 2026-06-11 | ADBE | Generative AI / Gen AI | 13/58 | ✅ | 25% | 0.09 | +66 | NO | no | +0.91 | +0.88 |
| 2026-06-11 | ADBE | Headwind | 22/58 | ❌ | 38% | 0.18 | +44 | NO | no | +0.82 | +0.80 |
| 2026-06-11 | ADBE | LLM Optimizer | 2/58 | ✅ | 7% | 0.10 | +83 | NO | yes | -0.10 | -0.10 |
| 2026-06-11 | ADBE | Nvidia | 3/58 | ✅ | 9% | 0.15 | +76 | NO | yes | -0.15 | -0.15 |
| 2026-06-11 | ADBE | Semrush | 1/58 | ✅ | 5% | 0.05 | +90 | NO | yes | -0.05 | -0.05 |
| 2026-06-18 | KR | AI / Artificial Intelligence | 9/22 | ✅ | 44% | 0.06 | +50 | NO | yes | -0.06 | -0.06 |
| 2026-06-18 | KR | Albertsons | 10/22 | ❌ | 44% | 0.24 | +20 | YES | no | -0.24 | -0.24 |
| 2026-06-18 | KR | Dividend | 20/22 | ❌ | 82% | 0.56 | +26 | YES | no | -0.56 | -0.56 |
| 2026-06-18 | KR | GLP-1 | 9/22 | ✅ | 44% | 0.16 | +40 | NO | yes | -0.16 | -0.16 |
| 2026-06-18 | KR | Instacart | 7/22 | ✅ | 36% | 0.24 | +40 | NO | no | +0.76 | +0.74 |
| 2026-06-18 | KR | Ocado | 15/22 | ✅ | 67% | 0.48 | +19 | YES | yes | +0.52 | +0.50 |
| 2026-06-18 | KR | SNAP / Food Stamp | 10/22 | ❌ | 44% | 0.25 | +19 | YES | yes | +0.75 | +0.73 |
| 2026-06-18 | KR | Vitacost | 1/22 | ✅ | 13% | 0.75 | +12 | NO | no | +0.25 | +0.24 |
| 2026-06-23 | CCL | AI / Artificial Intelligence | 1/27 | ✅ | 11% | 0.30 | +59 | NO | yes | -0.30 | -0.30 |
| 2026-06-23 | CCL | Celebration Key | 10/27 | ✅ | 40% | 0.04 | +56 | NO | yes | -0.04 | -0.04 |
| 2026-06-23 | CCL | Dividend | 11/27 | ✅ | 43% | 0.25 | +32 | NO | yes | -0.25 | -0.25 |
| 2026-06-23 | CCL | Headwind | 15/27 | ✅ | 56% | 0.29 | +15 | NO | yes | -0.29 | -0.29 |
| 2026-06-23 | CCL | Middle East | 3/27 | ✅ | 17% | 0.36 | +47 | NO | yes | -0.36 | -0.36 |
| 2026-06-23 | CCL | Tailwind | 14/27 | ❌ | 50% | 0.34 | +16 | NO | yes | -0.34 | -0.34 |
| 2026-06-23 | FDX | Automation | 28/54 | ❌ | 51% | 0.26 | +25 | YES | no | -0.26 | -0.26 |
| 2026-06-23 | FDX | De Minimis | 5/54 | ✅ | 13% | 0.25 | +62 | NO | yes | -0.25 | -0.25 |
| 2026-06-23 | FDX | Dividend | 33/54 | ✅ | 61% | 0.20 | +19 | NO | yes | -0.20 | -0.20 |
| 2026-06-23 | FDX | E-commerce / Ecommerce | 52/54 | ✅ | 94% | 0.77 | +17 | YES | no | -0.77 | -0.77 |
| 2026-06-23 | FDX | Inventory | 39/54 | ✅ | 71% | 0.23 | +48 | YES | yes | +0.77 | +0.75 |
| 2026-06-23 | FDX | ServiceNow | 1/54 | ❌ | 4% | 0.71 | +25 | NO | no | +0.29 | +0.28 |
| 2026-06-23 | FDX | Smith | 44/54 | ✅ | 80% | 0.40 | +40 | YES | yes | +0.60 | +0.58 |
| 2026-06-24 | MU | Anthropic | 0/63 | ❌ | 2% | 0.24 | +74 | NO | no | +0.76 | +0.74 |
| 2026-06-24 | MU | Automation | 22/63 | ❌ | 35% | 0.14 | +21 | YES | no | -0.14 | -0.14 |
| 2026-06-24 | MU | Gaming | 27/63 | ❌ | 42% | 0.11 | +31 | YES | no | -0.11 | -0.11 |
| 2026-06-24 | MU | Hyperscaler | 7/63 | ❌ | 13% | 0.77 | +10 | NO | yes | -0.77 | -0.77 |
| 2026-06-24 | MU | Inventory | 57/63 | ✅ | 89% | 0.50 | +39 | YES | no | -0.50 | -0.50 |
| 2026-06-24 | MU | Nvidia | 18/63 | ✅ | 30% | 0.58 | +12 | NO | yes | -0.58 | -0.58 |
| 2026-06-24 | MU | Smartphone | 55/63 | ✅ | 86% | 0.30 | +56 | YES | no | -0.30 | -0.30 |
| 2026-06-24 | MU | Taiwan | 33/63 | ❌ | 51% | 0.23 | +28 | YES | no | -0.23 | -0.23 |
| 2026-06-29 | AVAV | AV Halo | 1/26 | ✅ | 11% | 0.26 | +63 | NO | yes | -0.26 | -0.26 |
| 2026-06-29 | AVAV | Backpackable | 1/26 | ❌ | 8% | 0.64 | +28 | NO | no | +0.36 | +0.35 |
| 2026-06-29 | AVAV | Golden Dome | 2/26 | ✅ | 15% | 0.25 | +60 | NO | yes | -0.25 | -0.25 |
| 2026-06-29 | AVAV | Headwind | 11/26 | ✅ | 45% | 0.41 | +14 | NO | no | +0.59 | +0.57 |
| 2026-06-29 | AVAV | Iran | 0/26 | ✅ | 8% | 0.35 | +57 | NO | no | +0.65 | +0.63 |
| 2026-06-29 | AVAV | Orbit | 2/26 | ❌ | 12% | 0.63 | +25 | NO | yes | -0.63 | -0.63 |
| 2026-06-29 | AVAV | Robot / Robotic / Robotics | 20/26 | ❌ | 71% | 0.60 | +11 | YES | no | -0.60 | -0.60 |
| 2026-06-29 | AVAV | Tailwind | 1/26 | ❌ | 8% | 0.60 | +32 | NO | yes | -0.60 | -0.60 |
| 2026-06-29 | AVAV | Taiwan | 5/26 | ✅ | 25% | 0.39 | +36 | NO | no | +0.61 | +0.59 |
| 2026-06-29 | PEP | Artificial Color | 2/28 | ✅ | 14% | 0.63 | +23 | NO | no | +0.37 | +0.36 |
| 2026-06-29 | PEP | Autonomous | 0/28 | ❌ | 5% | 0.83 | +12 | NO | no | +0.17 | +0.16 |
| 2026-06-29 | PEP | Away from Home | 17/28 | ✅ | 60% | 0.24 | +16 | NO | yes | -0.24 | -0.24 |
| 2026-06-29 | PEP | Bubly | 9/28 | ❌ | 33% | 0.19 | +14 | YES | no | -0.19 | -0.19 |
| 2026-06-29 | PEP | Celsius | 10/28 | ✅ | 39% | 0.33 | +28 | NO | yes | -0.33 | -0.33 |
| 2026-06-29 | PEP | China | 19/28 | ❌ | 64% | 0.46 | +18 | YES | yes | +0.54 | +0.52 |
| 2026-06-29 | PEP | Gatik | 0/28 | ❌ | 5% | 0.71 | +24 | NO | no | +0.29 | +0.28 |
| 2026-06-29 | PEP | GLP-1 | 5/28 | ✅ | 23% | 0.63 | +14 | NO | no | +0.37 | +0.36 |
| 2026-06-29 | PEP | Healthy | 20/28 | ✅ | 70% | 0.44 | +26 | YES | no | -0.44 | -0.44 |
| 2026-06-29 | PEP | Starbucks | 19/28 | ✅ | 67% | 0.44 | +23 | YES | no | -0.44 | -0.44 |
| 2026-06-29 | PEP | Tariff | 3/28 | ❌ | 14% | 0.58 | +28 | NO | yes | -0.58 | -0.58 |
| 2026-06-29 | PEP | World Cup | 0/28 | ✅ | 8% | 0.22 | +70 | NO | yes | -0.22 | -0.22 |
| 2026-06-30 | AAL | AT&T | 4/24 | ✅ | 23% | 0.09 | +68 | NO | yes | -0.09 | -0.09 |
| 2026-06-30 | AAL | ATC | 4/24 | ❌ | 20% | 0.52 | +28 | NO | no | +0.48 | +0.47 |
| 2026-06-30 | AAL | Centennial | 1/24 | ✅ | 12% | 0.30 | +58 | NO | yes | -0.30 | -0.30 |
| 2026-06-30 | AAL | Chicago / O’Hare | 17/24 | ✅ | 69% | 0.05 | +26 | NO | yes | -0.05 | -0.05 |
| 2026-06-30 | AAL | Lavazza | 1/24 | ❌ | 9% | 0.64 | +27 | NO | no | +0.36 | +0.35 |
| 2026-06-30 | AAL | Norfolk / Virginia | 0/24 | ❌ | 5% | 0.82 | +13 | NO | no | +0.18 | +0.17 |
| 2026-06-30 | AAL | Record | 18/24 | ✅ | 73% | 0.16 | +11 | NO | yes | -0.16 | -0.16 |
| 2026-06-30 | AAL | Shutdown / Shut Down | 5/24 | ❌ | 23% | 0.10 | +67 | NO | yes | -0.10 | -0.10 |
| 2026-06-30 | AAL | Tariff | 2/24 | ❌ | 13% | 0.71 | +16 | NO | no | +0.29 | +0.28 |
| 2026-06-30 | AAL | Weather | 11/24 | ✅ | 48% | 0.33 | +19 | NO | yes | -0.33 | -0.33 |
| 2026-06-30 | AAL | World Cup | 1/24 | ✅ | 12% | 0.61 | +27 | NO | no | +0.39 | +0.38 |
| 2026-06-30 | AAPL | Apple Pay | 37/60 | ❌ | 60% | 0.19 | +21 | NO | yes | -0.19 | -0.19 |
| 2026-06-30 | AAPL | Creator Studio | 1/60 | ❌ | 4% | 0.49 | +47 | NO | yes | -0.49 | -0.49 |
| 2026-06-30 | AAPL | Formula 1 / F1 | 5/60 | ❌ | 10% | 0.24 | +66 | NO | yes | -0.24 | -0.24 |
| 2026-06-30 | AAPL | Fold / Folding / Foldable | 2/60 | ❌ | 5% | 0.68 | +27 | NO | no | +0.32 | +0.31 |
| 2026-06-30 | AAPL | Gemini | 1/60 | ❌ | 4% | 0.22 | +74 | NO | no | +0.78 | +0.76 |
| 2026-06-30 | AAPL | Liquid Glass | 2/60 | ❌ | 5% | 0.48 | +47 | NO | no | +0.52 | +0.50 |
| 2026-06-30 | AAPL | M3 | 6/60 | ❌ | 12% | 0.73 | +15 | NO | no | +0.27 | +0.26 |
| 2026-06-30 | AAPL | Manufacturing | 36/60 | ✅ | 60% | 0.13 | +27 | NO | yes | -0.13 | -0.13 |
| 2026-06-30 | AAPL | Severance | 9/60 | ❌ | 16% | 0.37 | +47 | NO | no | +0.63 | +0.61 |
| 2026-06-30 | AAPL | Siri | 32/60 | ✅ | 54% | 0.14 | +32 | NO | yes | -0.14 | -0.14 |
| 2026-06-30 | AAPL | Streaming | 18/60 | ❌ | 30% | 0.51 | +19 | NO | no | +0.49 | +0.48 |
| 2026-06-30 | AAPL | Tariff | 11/60 | ✅ | 21% | 0.19 | +60 | NO | yes | -0.19 | -0.19 |
| 2026-06-30 | AAPL | Wearable | 37/60 | ✅ | 61% | 0.04 | +35 | NO | yes | -0.04 | -0.04 |
| 2026-06-30 | AAPL | Widget | 2/60 | ❌ | 5% | 0.74 | +21 | NO | no | +0.26 | +0.25 |
| 2026-06-30 | ABNB | Acquisition | 9/21 | ✅ | 46% | 0.35 | +11 | YES | no | -0.35 | -0.35 |
| 2026-06-30 | ABNB | Boutique | 6/21 | ✅ | 34% | 0.35 | +31 | NO | yes | -0.35 | -0.35 |
| 2026-06-30 | ABNB | China | 11/21 | ❌ | 50% | 0.32 | +18 | YES | no | -0.32 | -0.32 |
| 2026-06-30 | ABNB | Domestic | 15/21 | ❌ | 66% | 0.22 | +12 | NO | yes | -0.22 | -0.22 |
| 2026-06-30 | ABNB | Service Agent | 8/21 | ❌ | 38% | 0.20 | +42 | NO | yes | -0.20 | -0.20 |
| 2026-06-30 | ABNB | Social Media | 10/21 | ❌ | 46% | 0.17 | +37 | NO | no | +0.83 | +0.81 |
| 2026-06-30 | ACI | AI / Artificial Intelligence | 6/14 | ✅ | 47% | 0.06 | +47 | NO | yes | -0.06 | -0.06 |
| 2026-06-30 | ACI | Dividend | 13/14 | ✅ | 85% | 0.72 | +13 | YES | yes | +0.28 | +0.27 |
| 2026-06-30 | ACI | GLP-1 | 4/14 | ✅ | 36% | 0.13 | +51 | NO | yes | -0.13 | -0.13 |
| 2026-06-30 | ACI | Holiday | 8/14 | ❌ | 52% | 0.33 | +15 | NO | yes | -0.33 | -0.33 |
| 2026-06-30 | ACI | Personalization | 2/14 | ✅ | 25% | 0.35 | +40 | NO | yes | -0.35 | -0.35 |
| 2026-06-30 | ACI | Produce | 7/14 | ❌ | 47% | 0.37 | +16 | NO | no | +0.63 | +0.61 |
| 2026-06-30 | ACI | Tariff | 2/14 | ❌ | 19% | 0.55 | +26 | NO | no | +0.45 | +0.44 |
| 2026-06-30 | ACI | Uber | 1/14 | ❌ | 14% | 0.39 | +47 | NO | yes | -0.39 | -0.39 |
| 2026-06-30 | ADBE | 3D | 30/59 | ✅ | 51% | 0.30 | +19 | NO | yes | -0.30 | -0.30 |
| 2026-06-30 | ADBE | Firefly Video | 5/59 | ❌ | 10% | 0.44 | +46 | NO | no | +0.56 | +0.54 |
| 2026-06-30 | ADBE | Generative AI / Gen AI | 14/59 | ❌ | 25% | 0.04 | +71 | NO | yes | -0.04 | -0.04 |
| 2026-06-30 | ADBE | Google Cloud | 0/59 | ❌ | 2% | 0.84 | +14 | NO | no | +0.16 | +0.16 |
| 2026-06-30 | ADBE | Humain | 0/59 | ❌ | 2% | 0.80 | +18 | NO | no | +0.20 | +0.19 |
| 2026-06-30 | ADBE | Inference | 5/59 | ❌ | 10% | 0.69 | +21 | NO | no | +0.31 | +0.30 |
| 2026-06-30 | ADBE | LLM Optimizer | 3/59 | ✅ | 9% | 0.18 | +73 | NO | yes | -0.18 | -0.18 |
| 2026-06-30 | ADBE | Semrush | 2/59 | ✅ | 7% | 0.12 | +81 | NO | yes | -0.12 | -0.12 |
| 2026-06-30 | ADBE | YouTube | 9/59 | ❌ | 17% | 0.53 | +30 | NO | no | +0.47 | +0.46 |
| 2026-06-30 | AMZN | Alexa+ / Alexa Plus | 4/63 | ✅ | 10% | 0.11 | +79 | NO | yes | -0.11 | -0.11 |
| 2026-06-30 | AMZN | China | 26/63 | ❌ | 41% | 0.39 | +20 | NO | no | +0.61 | +0.59 |
| 2026-06-30 | AMZN | Drone | 4/63 | ❌ | 8% | 0.76 | +16 | NO | no | +0.24 | +0.23 |
| 2026-06-30 | AMZN | Gen-AI / Generative AI | 12/63 | ✅ | 21% | 0.12 | +67 | NO | yes | -0.12 | -0.12 |
| 2026-06-30 | AMZN | Live Sports | 15/63 | ✅ | 26% | 0.07 | +67 | NO | yes | -0.07 | -0.07 |
| 2026-06-30 | AMZN | OpenAI | 2/63 | ✅ | 7% | 0.50 | +43 | NO | yes | -0.50 | -0.50 |
| 2026-06-30 | AMZN | Prime Day | 30/63 | ✅ | 48% | 0.35 | +17 | NO | no | +0.65 | +0.63 |
| 2026-06-30 | AMZN | Project Kuiper | 7/63 | ❌ | 13% | 0.39 | +48 | NO | no | +0.61 | +0.59 |
| 2026-06-30 | AMZN | Robotic / Robotics | 17/63 | ✅ | 29% | 0.13 | +58 | NO | yes | -0.13 | -0.13 |
| 2026-06-30 | AMZN | Rufus | 6/63 | ✅ | 12% | 0.20 | +68 | NO | yes | -0.20 | -0.20 |
| 2026-06-30 | AMZN | RxPass | 4/63 | ❌ | 8% | 0.81 | +11 | NO | no | +0.19 | +0.18 |
| 2026-06-30 | AMZN | Silicon | 11/63 | ✅ | 20% | 0.10 | +70 | NO | yes | -0.10 | -0.10 |
| 2026-06-30 | AMZN | Sponsored Products | 16/63 | ❌ | 26% | 0.17 | +57 | NO | yes | -0.17 | -0.17 |
| 2026-06-30 | AMZN | Supply Chain | 16/63 | ✅ | 27% | 0.43 | +30 | NO | no | +0.57 | +0.55 |
| 2026-06-30 | AMZN | Tariff | 4/63 | ✅ | 10% | 0.13 | +77 | NO | yes | -0.13 | -0.13 |
| 2026-06-30 | AMZN | Third Party Sellers | 1/63 | ❌ | 4% | 0.24 | +72 | NO | yes | -0.24 | -0.24 |
| 2026-06-30 | ASTS | BlackSky | 0/19 | ❌ | 7% | 0.72 | +21 | NO | no | +0.28 | +0.27 |
| 2026-06-30 | ASTS | Golden Dome | 2/19 | ✅ | 19% | 0.56 | +25 | NO | yes | -0.56 | -0.56 |
| 2026-06-30 | ASTS | Israel | 1/19 | ❌ | 11% | 0.62 | +27 | NO | no | +0.38 | +0.37 |
| 2026-06-30 | ASTS | New Glenn | 6/19 | ✅ | 37% | 0.24 | +39 | NO | yes | -0.24 | -0.24 |
| 2026-06-30 | ASTS | Unmodified | 16/19 | ✅ | 80% | 0.04 | +16 | NO | yes | -0.04 | -0.04 |
| 2026-06-30 | ASTS | Vodafone | 18/19 | ✅ | 88% | 0.75 | +13 | YES | yes | +0.25 | +0.24 |
| 2026-06-30 | AVGO | Acquisition | 37/44 | ❌ | 80% | 0.38 | +42 | YES | no | -0.38 | -0.38 |
| 2026-06-30 | AVGO | Hyperscaler | 18/44 | ✅ | 42% | 0.08 | +50 | NO | yes | -0.08 | -0.08 |
| 2026-06-30 | AVGO | NVLink | 2/44 | ❌ | 7% | 0.56 | +37 | NO | no | +0.44 | +0.43 |
| 2026-06-30 | AVGO | Open Source | 2/44 | ❌ | 7% | 0.66 | +27 | NO | no | +0.34 | +0.33 |
| 2026-06-30 | AVGO | OpenAI | 2/44 | ✅ | 9% | 0.39 | +52 | NO | yes | -0.39 | -0.39 |
| 2026-06-30 | AVGO | Organic | 13/44 | ❌ | 30% | 0.53 | +17 | NO | no | +0.47 | +0.46 |
| 2026-06-30 | AVGO | Quantum | 0/44 | ❌ | 3% | 0.81 | +16 | NO | no | +0.19 | +0.18 |
| 2026-06-30 | AVGO | Tomahawk 6 | 7/44 | ✅ | 20% | 0.06 | +74 | NO | yes | -0.06 | -0.06 |
| 2026-06-30 | AXP | Blockchain | 4/58 | ❌ | 9% | 0.15 | +76 | NO | no | +0.85 | +0.82 |
| 2026-06-30 | AXP | Millennial | 27/58 | ✅ | 47% | 0.17 | +36 | NO | yes | -0.17 | -0.17 |
| 2026-06-30 | AXP | Rate Cap / 10% Cap | 0/58 | ❌ | 2% | 0.79 | +19 | NO | no | +0.21 | +0.20 |
| 2026-06-30 | AXP | Regulation / Regulatory | 43/58 | ✅ | 73% | 0.11 | +16 | NO | yes | -0.11 | -0.11 |
| 2026-06-30 | AXP | Stablecoin | 2/58 | ❌ | 6% | 0.15 | +79 | NO | no | +0.85 | +0.82 |
| 2026-06-30 | BLK | Crypto / Bitcoin | 8/23 | ❌ | 35% | 0.22 | +43 | NO | no | +0.78 | +0.76 |
| 2026-06-30 | BLK | Digital Asset | 10/23 | ✅ | 46% | 0.01 | +53 | NO | yes | -0.01 | -0.01 |
| 2026-06-30 | BLK | ETF Inflow | 2/23 | ❌ | 13% | 0.73 | +14 | NO | no | +0.27 | +0.26 |
| 2026-06-30 | BLK | Record AUM | 6/23 | ❌ | 28% | 0.22 | +50 | NO | no | +0.78 | +0.76 |
| 2026-06-30 | BLK | Stablecoin | 3/23 | ❌ | 17% | 0.16 | +67 | NO | no | +0.84 | +0.81 |
| 2026-06-30 | CAR | AI / Artificial Intelligence | 1/20 | ❌ | 10% | 0.60 | +30 | NO | no | +0.40 | +0.39 |
| 2026-06-30 | CAR | EV / Electric | 13/20 | ❌ | 60% | 0.42 | +18 | YES | yes | +0.58 | +0.56 |
| 2026-06-30 | CAVA | Salmon | 3/11 | ✅ | 36% | 0.22 | +42 | NO | yes | -0.22 | -0.22 |
| 2026-06-30 | CAVA | Same Store | 1/11 | ✅ | 23% | 0.06 | +17 | YES | no | -0.06 | -0.06 |
| 2026-06-30 | CAVA | Sweet Potato | 2/11 | ✅ | 30% | 0.19 | +51 | NO | yes | -0.19 | -0.19 |
| 2026-06-30 | CAVA | Tariff | 4/11 | ❌ | 36% | 0.32 | +32 | NO | yes | -0.32 | -0.32 |
| 2026-06-30 | CELH | Competition | 14/35 | ❌ | 40% | 0.47 | +13 | NO | no | +0.53 | +0.51 |
| 2026-06-30 | CELH | Electrolyte | 1/35 | ❌ | 6% | 0.75 | +19 | NO | no | +0.25 | +0.24 |
| 2026-06-30 | CELH | Essential | 12/35 | ❌ | 35% | 0.22 | +43 | NO | no | +0.78 | +0.76 |
| 2026-06-30 | CELH | NFL | 1/35 | ❌ | 6% | 0.76 | +18 | NO | no | +0.24 | +0.23 |
| 2026-06-30 | CELH | PepsiCo | 19/35 | ✅ | 55% | 0.17 | +28 | NO | yes | -0.17 | -0.17 |
| 2026-06-30 | CELH | Recall | 9/35 | ❌ | 27% | 0.60 | +13 | NO | no | +0.40 | +0.39 |
| 2026-06-30 | CELH | Tariff | 6/35 | ❌ | 19% | 0.16 | +65 | NO | yes | -0.16 | -0.16 |
| 2026-06-30 | CELH | Vitamin | 18/35 | ✅ | 52% | 0.19 | +33 | YES | no | -0.19 | -0.19 |
| 2026-06-30 | CMG | Al Pastor | 12/64 | ✅ | 21% | 0.16 | +63 | NO | yes | -0.16 | -0.16 |
| 2026-06-30 | CMG | Autocado | 8/64 | ❌ | 14% | 0.67 | +19 | NO | no | +0.33 | +0.32 |
| 2026-06-30 | CMG | Carne Asada | 18/64 | ❌ | 29% | 0.16 | +55 | NO | yes | -0.16 | -0.16 |
| 2026-06-30 | CMG | Chipotle Lane / Chipotlane | 28/64 | ❌ | 43% | 0.04 | +53 | NO | yes | -0.04 | -0.04 |
| 2026-06-30 | CMG | Honey Chicken | 4/64 | ✅ | 9% | 0.46 | +45 | NO | no | +0.54 | +0.52 |
| 2026-06-30 | CMG | Promotion | 51/64 | ✅ | 78% | 0.10 | +12 | NO | yes | -0.10 | -0.10 |
| 2026-06-30 | CMG | Share Purchase | 5/64 | ❌ | 10% | 0.46 | +44 | NO | yes | -0.46 | -0.46 |
| 2026-06-30 | CMG | Supply Chain | 38/64 | ❌ | 58% | 0.05 | +37 | NO | yes | -0.05 | -0.05 |
| 2026-06-30 | CMG | Tariff | 5/64 | ❌ | 10% | 0.09 | +81 | NO | yes | -0.09 | -0.09 |
| 2026-06-30 | CMG | Transaction Growth | 28/64 | ✅ | 45% | 0.10 | +45 | NO | yes | -0.10 | -0.10 |
| 2026-06-30 | COINBASE | Decentralized Exchange / DEX | 13/20 | ✅ | 64% | 0.15 | +21 | NO | yes | -0.15 | -0.15 |
| 2026-06-30 | COINBASE | Margin | 12/20 | ❌ | 56% | 0.06 | +38 | NO | yes | -0.06 | -0.06 |
| 2026-06-30 | COINBASE | Stablecoin | 15/20 | ✅ | 72% | 0.02 | +26 | NO | yes | -0.02 | -0.02 |
| 2026-06-30 | COINBASE | Web3 | 11/20 | ❌ | 52% | 0.34 | +18 | YES | no | -0.34 | -0.34 |
| 2026-06-30 | COST | Automation | 4/64 | ✅ | 9% | 0.78 | +13 | NO | no | +0.22 | +0.21 |
| 2026-06-30 | COST | Dividend | 46/64 | ✅ | 71% | 0.60 | +11 | YES | yes | +0.40 | +0.39 |
| 2026-06-30 | COST | Holiday | 46/64 | ❌ | 70% | 0.17 | +13 | NO | no | +0.83 | +0.81 |
| 2026-06-30 | COST | Hot Dog | 15/64 | ✅ | 26% | 0.54 | +20 | NO | no | +0.46 | +0.45 |
| 2026-06-30 | COST | Kirkland | 46/64 | ✅ | 71% | 0.05 | +24 | NO | yes | -0.05 | -0.05 |
| 2026-06-30 | COST | Labor | 47/64 | ❌ | 71% | 0.18 | +11 | NO | no | +0.82 | +0.80 |
| 2026-06-30 | COST | Revenue | 29/64 | ✅ | 46% | 0.13 | +41 | NO | yes | -0.13 | -0.13 |
| 2026-06-30 | COST | Spending | 40/64 | ✅ | 62% | 0.23 | +15 | NO | yes | -0.23 | -0.23 |
| 2026-06-30 | COST | Tariff | 14/64 | ✅ | 24% | 0.06 | +70 | NO | yes | -0.06 | -0.06 |
| 2026-06-30 | CRCL | Intuit | 1/3 | ❌ | 34% | 0.14 | +52 | NO | yes | -0.14 | -0.14 |
| 2026-06-30 | CRCL | Polymarket | 1/3 | ✅ | 51% | 0.14 | +35 | NO | yes | -0.14 | -0.14 |
| 2026-06-30 | CRCL | Testnet | 3/3 | ❌ | 58% | 0.07 | +35 | NO | yes | -0.07 | -0.07 |
| 2026-06-30 | CRCL | Traffic | 3/3 | ✅ | 75% | 0.59 | +16 | YES | yes | +0.41 | +0.40 |
| 2026-06-30 | CRCL | Treasury | 2/3 | ✅ | 63% | 0.21 | +16 | NO | no | +0.79 | +0.77 |
| 2026-06-30 | CRWD | China | 3/28 | ❌ | 14% | 0.50 | +36 | NO | no | +0.50 | +0.48 |
| 2026-06-30 | CRWD | Consolidation | 22/28 | ✅ | 76% | 0.07 | +17 | NO | yes | -0.07 | -0.07 |
| 2026-06-30 | CRWD | Falcon Flex | 10/28 | ✅ | 39% | 0.04 | +57 | NO | yes | -0.04 | -0.04 |
| 2026-06-30 | CRWD | Gen AI / Generative AI | 9/28 | ❌ | 33% | 0.37 | +30 | NO | no | +0.63 | +0.61 |
| 2026-06-30 | CRWD | Hyperscaler | 10/28 | ✅ | 39% | 0.13 | +48 | NO | yes | -0.13 | -0.13 |
| 2026-06-30 | CRWD | Nvidia | 5/28 | ✅ | 23% | 0.26 | +51 | NO | yes | -0.26 | -0.26 |
| 2026-06-30 | CRWD | SGNL / Signal | 6/28 | ✅ | 26% | 0.12 | +62 | NO | yes | -0.12 | -0.12 |
| 2026-06-30 | CRWD | Shadow | 3/28 | ✅ | 17% | 0.53 | +30 | NO | no | +0.47 | +0.46 |
| 2026-06-30 | CVNA | AI / Artificial Intelligence | 7/35 | ✅ | 24% | 0.12 | +64 | NO | yes | -0.12 | -0.12 |
| 2026-06-30 | CVNA | Automation | 3/35 | ✅ | 14% | 0.56 | +30 | NO | no | +0.44 | +0.43 |
| 2026-06-30 | CVNA | Bridgecrest | 0/35 | ❌ | 4% | 0.71 | +25 | NO | no | +0.29 | +0.28 |
| 2026-06-30 | CVNA | DriveTime | 2/35 | ❌ | 9% | 0.78 | +13 | NO | no | +0.22 | +0.21 |
| 2026-06-30 | CVNA | Same Day | 2/35 | ❌ | 9% | 0.34 | +57 | NO | no | +0.66 | +0.64 |
| 2026-06-30 | CVNA | Tariff | 4/35 | ✅ | 16% | 0.40 | +44 | NO | no | +0.60 | +0.58 |
| 2026-06-30 | DAL | Holiday | 18/28 | ❌ | 61% | 0.10 | +29 | NO | yes | -0.10 | -0.10 |
| 2026-06-30 | DAL | Nonstop / Non-Stop | 1/28 | ❌ | 8% | 0.76 | +16 | NO | no | +0.24 | +0.23 |
| 2026-06-30 | DAL | Partnership | 21/28 | ✅ | 73% | 0.09 | +18 | NO | yes | -0.09 | -0.09 |
| 2026-06-30 | DAL | Weather | 15/28 | ✅ | 54% | 0.30 | +16 | NO | yes | -0.30 | -0.30 |
| 2026-06-30 | DAL | YouTube | 3/28 | ✅ | 17% | 0.63 | +20 | NO | yes | -0.63 | -0.63 |
| 2026-06-30 | DASH | Autonomous | 6/20 | ✅ | 35% | 0.07 | +58 | NO | yes | -0.07 | -0.07 |
| 2026-06-30 | DASH | Physical Retailer | 5/20 | ❌ | 27% | 0.59 | +14 | NO | no | +0.41 | +0.40 |
| 2026-06-30 | DASH | Robot / Robotic / Robotics | 3/20 | ❌ | 19% | 0.64 | +17 | NO | no | +0.36 | +0.35 |
| 2026-06-30 | DASH | Waymo | 0/20 | ❌ | 6% | 0.70 | +24 | NO | no | +0.30 | +0.29 |
| 2026-06-30 | DE | AI / Artificial Intelligence | 5/64 | ❌ | 10% | 0.44 | +46 | NO | yes | -0.44 | -0.44 |
| 2026-06-30 | DE | Automation | 21/64 | ✅ | 34% | 0.15 | +51 | NO | yes | -0.15 | -0.15 |
| 2026-06-30 | DE | Dividend | 39/64 | ✅ | 61% | 0.19 | +20 | NO | yes | -0.19 | -0.19 |
| 2026-06-30 | DE | Efficiency | 31/64 | ❌ | 48% | 0.40 | +12 | NO | yes | -0.40 | -0.40 |
| 2026-06-30 | DE | EPA | 1/64 | ❌ | 4% | 0.52 | +44 | NO | no | +0.48 | +0.47 |
| 2026-06-30 | DE | Manufacturing | 26/64 | ✅ | 42% | 0.34 | +24 | NO | no | +0.66 | +0.64 |
| 2026-06-30 | DE | Tariff | 17/64 | ✅ | 28% | 0.08 | +64 | NO | yes | -0.08 | -0.08 |
| 2026-06-30 | DE | Tenna | 1/64 | ✅ | 5% | 0.27 | +68 | NO | yes | -0.27 | -0.27 |
| 2026-06-30 | DE | Warranty | 20/64 | ❌ | 32% | 0.20 | +48 | NO | yes | -0.20 | -0.20 |
| 2026-06-30 | DELL | AI Factory | 4/20 | ✅ | 27% | 0.17 | +56 | NO | no | +0.83 | +0.81 |
| 2026-06-30 | DELL | China | 6/20 | ❌ | 31% | 0.19 | +12 | YES | no | -0.19 | -0.19 |
| 2026-06-30 | DELL | Dell Pro Max | 1/20 | ✅ | 14% | 0.73 | +13 | NO | no | +0.27 | +0.26 |
| 2026-06-30 | DELL | Dividend (3+ times) | 0/20 | ❌ | 6% | 0.44 | +50 | NO | yes | -0.44 | -0.44 |
| 2026-06-30 | DELL | EPS Growth | 11/20 | ❌ | 52% | 0.12 | +36 | NO | yes | -0.12 | -0.12 |
| 2026-06-30 | DELL | McLaren | 0/20 | ❌ | 6% | 0.77 | +17 | NO | no | +0.23 | +0.22 |
| 2026-06-30 | DELL | New Product | 6/20 | ❌ | 31% | 0.37 | +32 | NO | no | +0.63 | +0.61 |
| 2026-06-30 | DELL | Nvidia | 9/20 | ✅ | 47% | 0.27 | +26 | NO | no | +0.73 | +0.71 |
| 2026-06-30 | DELL | PowerEdge / Power Edge | 9/20 | ✅ | 47% | 0.31 | +22 | NO | no | +0.69 | +0.67 |
| 2026-06-30 | DELL | Windows 10 | 8/20 | ❌ | 39% | 0.28 | +11 | YES | no | -0.28 | -0.28 |
| 2026-06-30 | DIS | Abu Dhabi | 4/64 | ✅ | 9% | 0.24 | +67 | NO | yes | -0.24 | -0.24 |
| 2026-06-30 | DIS | Avatar | 35/64 | ❌ | 54% | 0.09 | +37 | NO | yes | -0.09 | -0.09 |
| 2026-06-30 | DIS | Buyback | 19/64 | ❌ | 30% | 0.13 | +17 | YES | no | -0.13 | -0.13 |
| 2026-06-30 | DIS | Competition | 31/64 | ❌ | 48% | 0.06 | +46 | NO | yes | -0.06 | -0.06 |
| 2026-06-30 | DIS | Cruise | 49/64 | ✅ | 75% | 0.05 | +20 | NO | yes | -0.05 | -0.05 |
| 2026-06-30 | DIS | Doomsday | 2/64 | ✅ | 6% | 0.33 | +61 | NO | yes | -0.33 | -0.33 |
| 2026-06-30 | DIS | DraftKings | 1/64 | ❌ | 4% | 0.77 | +19 | NO | no | +0.23 | +0.22 |
| 2026-06-30 | DIS | Fortnite | 1/64 | ✅ | 5% | 0.76 | +19 | NO | no | +0.24 | +0.23 |
| 2026-06-30 | DIS | Moana | 17/64 | ✅ | 28% | 0.17 | +55 | NO | yes | -0.17 | -0.17 |
| 2026-06-30 | DIS | NFL | 49/64 | ✅ | 75% | 0.62 | +13 | YES | yes | +0.38 | +0.37 |
| 2026-06-30 | DIS | WWE | 1/64 | ❌ | 4% | 0.71 | +25 | NO | no | +0.29 | +0.28 |
| 2026-06-30 | DIS | YouTube TV | 2/64 | ❌ | 5% | 0.82 | +13 | NO | no | +0.18 | +0.17 |
| 2026-06-30 | DIS | Zootopia | 23/64 | ✅ | 37% | 0.11 | +52 | NO | yes | -0.11 | -0.11 |
| 2026-06-30 | DKNG | Canada | 9/24 | ❌ | 37% | 0.27 | +10 | YES | no | -0.27 | -0.27 |
| 2026-06-30 | DKNG | Competitor / Competition | 24/24 | ✅ | 94% | 0.71 | +23 | YES | yes | +0.29 | +0.28 |
| 2026-06-30 | DKNG | NBC / NBCUniversal | 2/24 | ✅ | 16% | 0.36 | +48 | NO | yes | -0.36 | -0.36 |
| 2026-06-30 | DKNG | Olympic / Olympics | 1/24 | ❌ | 9% | 0.35 | +56 | NO | no | +0.65 | +0.63 |
| 2026-06-30 | DKNG | Prediction | 8/24 | ✅ | 37% | 0.01 | +62 | NO | yes | -0.01 | -0.01 |
| 2026-06-30 | DKNG | Regulation | 12/24 | ✅ | 51% | 0.34 | +15 | NO | yes | -0.34 | -0.34 |
| 2026-06-30 | DKNG | Retention / Retain | 23/24 | ✅ | 90% | 0.78 | +12 | YES | yes | +0.22 | +0.21 |
| 2026-06-30 | DKNG | Super Bowl | 15/24 | ❌ | 59% | 0.06 | +35 | NO | yes | -0.06 | -0.06 |
| 2026-06-30 | DPZ | AI / Artificial Intelligence | 7/62 | ✅ | 14% | 0.58 | +28 | NO | no | +0.42 | +0.41 |
| 2026-06-30 | DPZ | Automation | 3/62 | ❌ | 7% | 0.81 | +12 | NO | no | +0.19 | +0.18 |
| 2026-06-30 | DPZ | Craveable | 1/62 | ❌ | 4% | 0.77 | +19 | NO | no | +0.23 | +0.22 |
| 2026-06-30 | DPZ | DoorDash (5+ times) | 0/62 | ❌ | 2% | 0.34 | +64 | NO | yes | -0.34 | -0.34 |
| 2026-06-30 | DPZ | Emergency Pizza | 7/62 | ❌ | 13% | 0.40 | +47 | NO | no | +0.60 | +0.58 |
| 2026-06-30 | DPZ | Parmesan | 12/62 | ❌ | 20% | 0.22 | +58 | NO | yes | -0.22 | -0.22 |
| 2026-06-30 | DPZ | Same Store | 6/62 | ✅ | 13% | 0.04 | +83 | NO | yes | -0.04 | -0.04 |
| 2026-06-30 | DPZ | Spicy | 1/62 | ❌ | 4% | 0.34 | +62 | NO | no | +0.66 | +0.64 |
| 2026-06-30 | DPZ | Tariff | 2/62 | ❌ | 5% | 0.78 | +17 | NO | no | +0.22 | +0.21 |
| 2026-06-30 | GOOGL | Autonomous | 25/61 | ✅ | 42% | 0.35 | +23 | NO | yes | -0.35 | -0.35 |
| 2026-06-30 | GOOGL | DeepMind / Deep Mind | 21/61 | ❌ | 35% | 0.40 | +25 | NO | yes | -0.40 | -0.40 |
| 2026-06-30 | GOOGL | European Commission | 5/61 | ❌ | 10% | 0.72 | +18 | NO | no | +0.28 | +0.27 |
| 2026-06-30 | GOOGL | Gemini 3 | 2/61 | ✅ | 7% | 0.01 | +92 | NO | yes | -0.01 | -0.01 |
| 2026-06-30 | GOOGL | Ironwood | 3/61 | ✅ | 8% | 0.24 | +68 | NO | yes | -0.24 | -0.24 |
| 2026-06-30 | GOOGL | Nano Banana | 2/61 | ✅ | 7% | 0.32 | +61 | NO | yes | -0.32 | -0.32 |
| 2026-06-30 | GOOGL | Quantum | 6/61 | ❌ | 12% | 0.40 | +48 | NO | no | +0.60 | +0.58 |
| 2026-06-30 | GOOGL | Search Advertising / Search Ad | 41/61 | ❌ | 65% | 0.55 | +10 | YES | yes | +0.45 | +0.44 |
| 2026-06-30 | GOOGL | Wiz | 1/61 | ✅ | 5% | 0.42 | +53 | NO | no | +0.58 | +0.56 |
| 2026-06-30 | GOOGL | Youtube Shorts | 18/61 | ❌ | 30% | 0.23 | +47 | NO | no | +0.77 | +0.75 |
| 2026-06-30 | HD | Competition / Competitor | 30/63 | ✅ | 48% | 0.10 | +42 | NO | no | +0.90 | +0.87 |
| 2026-06-30 | HD | E-commerce / Ecommerce | 17/63 | ❌ | 28% | 0.10 | +62 | NO | no | +0.90 | +0.87 |
| 2026-06-30 | HD | Holiday | 38/63 | ❌ | 59% | 0.04 | +37 | NO | no | +0.96 | +0.93 |
| 2026-06-30 | HD | Weather | 53/63 | ✅ | 83% | 0.07 | +10 | NO | no | +0.93 | +0.90 |
| 2026-06-30 | HIMS | Canada | 4/21 | ✅ | 26% | 0.06 | +68 | NO | yes | -0.06 | -0.06 |
| 2026-06-30 | HIMS | Cancer | 4/21 | ❌ | 22% | 0.12 | +66 | NO | yes | -0.12 | -0.12 |
| 2026-06-30 | HIMS | Collaboration | 7/21 | ✅ | 38% | 0.29 | +33 | NO | no | +0.71 | +0.69 |
| 2026-06-30 | HIMS | Europe | 4/21 | ❌ | 22% | 0.23 | +55 | NO | yes | -0.23 | -0.23 |
| 2026-06-30 | HIMS | FDA | 6/21 | ✅ | 34% | 0.15 | +51 | NO | yes | -0.15 | -0.15 |
| 2026-06-30 | HIMS | Lab Testing | 6/21 | ✅ | 34% | 0.08 | +58 | NO | yes | -0.08 | -0.08 |
| 2026-06-30 | HIMS | Microdose / Microdosing | 1/21 | ❌ | 10% | 0.70 | +20 | NO | no | +0.30 | +0.29 |
| 2026-06-30 | HIMS | Peptide | 5/21 | ✅ | 30% | 0.07 | +63 | NO | yes | -0.07 | -0.07 |
| 2026-06-30 | HIMS | Regulation | 3/21 | ❌ | 18% | 0.39 | +43 | NO | no | +0.61 | +0.59 |
| 2026-06-30 | HIMS | Tariff | 2/21 | ❌ | 14% | 0.60 | +26 | NO | no | +0.40 | +0.39 |
| 2026-06-30 | HIMS | Testosterone | 7/21 | ✅ | 38% | 0.07 | +55 | NO | yes | -0.07 | -0.07 |
| 2026-06-30 | HIMS | Vitamin | 6/21 | ❌ | 30% | 0.19 | +51 | NO | yes | -0.19 | -0.19 |
| 2026-06-30 | HIMS | Zava | 3/21 | ✅ | 22% | 0.24 | +54 | NO | yes | -0.24 | -0.24 |
| 2026-06-30 | HLT | AI / Artificial Intelligence | 4/28 | ✅ | 20% | 0.11 | +69 | NO | yes | -0.11 | -0.11 |
| 2026-06-30 | HLT | Competition | 14/28 | ✅ | 51% | 0.33 | +16 | NO | yes | -0.33 | -0.33 |
| 2026-06-30 | HLT | Honor / Honors | 26/28 | ✅ | 88% | 0.76 | +12 | YES | yes | +0.24 | +0.23 |
| 2026-06-30 | HLT | India | 8/28 | ✅ | 32% | 0.33 | +35 | NO | no | +0.67 | +0.65 |
| 2026-06-30 | HLT | LivSmart | 4/28 | ❌ | 17% | 0.68 | +15 | NO | no | +0.32 | +0.31 |
| 2026-06-30 | HLT | Minnesota / Minneapolis | 0/28 | ❌ | 5% | 0.65 | +30 | NO | no | +0.35 | +0.34 |
| 2026-06-30 | HLT | Spark | 12/28 | ✅ | 45% | 0.13 | +42 | NO | no | +0.87 | +0.84 |
| 2026-06-30 | HLT | Tariff | 5/28 | ✅ | 23% | 0.37 | +40 | NO | no | +0.63 | +0.61 |
| 2026-06-30 | HLT | World Cup | 5/28 | ❌ | 20% | 0.67 | +13 | NO | yes | -0.67 | -0.67 |
| 2026-06-30 | HOOD | Acquisition | 13/19 | ✅ | 67% | 0.12 | +21 | NO | yes | -0.12 | -0.12 |
| 2026-06-30 | HOOD | Bitcoin | 6/19 | ✅ | 37% | 0.39 | +24 | NO | yes | -0.39 | -0.39 |
| 2026-06-30 | HOOD | Blockchain | 4/19 | ❌ | 24% | 0.42 | +34 | NO | yes | -0.42 | -0.42 |
| 2026-06-30 | HOOD | Indonesia | 1/19 | ✅ | 15% | 0.48 | +37 | NO | no | +0.52 | +0.50 |
| 2026-06-30 | HOOD | International | 15/19 | ✅ | 75% | 0.09 | +16 | NO | yes | -0.09 | -0.09 |
| 2026-06-30 | HOOD | Perp / Perpetual | 2/19 | ✅ | 19% | 0.60 | +21 | NO | yes | -0.60 | -0.60 |
| 2026-06-30 | HOOD | Prediction Market | 5/19 | ✅ | 32% | 0.05 | +63 | NO | yes | -0.05 | -0.05 |
| 2026-06-30 | HOOD | SIG / Susquehanna | 1/19 | ✅ | 15% | 0.41 | +44 | NO | yes | -0.41 | -0.41 |
| 2026-06-30 | HOOD | Social | 7/19 | ✅ | 41% | 0.20 | +39 | NO | yes | -0.20 | -0.20 |
| 2026-06-30 | HOOD | Tokenization | 4/19 | ✅ | 28% | 0.12 | +60 | NO | yes | -0.12 | -0.12 |
| 2026-06-30 | HPE | Government | 7/20 | ✅ | 39% | 0.43 | +18 | NO | yes | -0.43 | -0.43 |
| 2026-06-30 | HPE | Morpheus | 5/20 | ✅ | 31% | 0.15 | +54 | NO | no | +0.85 | +0.82 |
| 2026-06-30 | HPE | Nvidia | 11/20 | ✅ | 56% | 0.05 | +39 | NO | no | +0.95 | +0.92 |
| 2026-06-30 | HPE | Quantum | 3/20 | ❌ | 19% | 0.50 | +31 | NO | no | +0.50 | +0.48 |
| 2026-06-30 | HPE | Self Driving | 0/20 | ❌ | 6% | 0.64 | +30 | NO | yes | -0.64 | -0.64 |
| 2026-06-30 | HPE | Synergy | 4/20 | ✅ | 27% | 0.17 | +56 | NO | yes | -0.17 | -0.17 |
| 2026-06-30 | HPE | Tariff | 4/20 | ❌ | 23% | 0.45 | +32 | NO | yes | -0.45 | -0.45 |
| 2026-06-30 | INTC | Arizona | 17/63 | ❌ | 28% | 0.17 | +55 | NO | yes | -0.17 | -0.17 |
| 2026-06-30 | INTC | Nvidia | 8/63 | ✅ | 15% | 0.09 | +76 | NO | yes | -0.09 | -0.09 |
| 2026-06-30 | INTC | Panther Lake | 10/63 | ✅ | 18% | 0.11 | +71 | NO | yes | -0.11 | -0.11 |
| 2026-06-30 | INTC | Security | 34/63 | ✅ | 54% | 0.21 | +25 | NO | yes | -0.21 | -0.21 |
| 2026-06-30 | INTC | Tariff | 7/63 | ❌ | 13% | 0.44 | +43 | NO | yes | -0.44 | -0.44 |
| 2026-06-30 | INTC | Trump | 2/63 | ❌ | 5% | 0.37 | +58 | NO | no | +0.63 | +0.61 |
| 2026-06-30 | INTC | Ultra 3 / Ultra Series 3 | 1/63 | ✅ | 5% | 0.16 | +79 | NO | yes | -0.16 | -0.16 |
| 2026-06-30 | INTC | Xeon | 50/63 | ✅ | 78% | 0.10 | +12 | NO | yes | -0.10 | -0.10 |
| 2026-06-30 | KO | Acquisition | 29/44 | ✅ | 65% | 0.36 | +29 | YES | yes | +0.64 | +0.62 |
| 2026-06-30 | KO | Cane Sugar | 1/44 | ❌ | 5% | 0.49 | +46 | NO | no | +0.51 | +0.49 |
| 2026-06-30 | KO | Dividend | 33/44 | ❌ | 72% | 0.08 | +20 | NO | yes | -0.08 | -0.08 |
| 2026-06-30 | KO | Influencer | 6/44 | ❌ | 16% | 0.72 | +12 | NO | no | +0.28 | +0.27 |
| 2026-06-30 | KO | International | 13/44 | ❌ | 30% | 0.37 | +33 | NO | no | +0.63 | +0.61 |
| 2026-06-30 | KO | Prebiotic | 2/44 | ✅ | 9% | 0.75 | +16 | NO | no | +0.25 | +0.24 |
| 2026-06-30 | KO | Retro | 1/44 | ❌ | 5% | 0.70 | +25 | NO | no | +0.30 | +0.29 |
| 2026-06-30 | KO | Tariff | 3/44 | ❌ | 9% | 0.67 | +24 | NO | no | +0.33 | +0.32 |
| 2026-06-30 | KR | AI / Artificial Intelligence | 10/23 | ✅ | 46% | 0.09 | +45 | NO | yes | -0.09 | -0.09 |
| 2026-06-30 | KR | Albertsons | 10/23 | ❌ | 42% | 0.32 | +10 | YES | no | -0.32 | -0.32 |
| 2026-06-30 | KR | Economy | 9/23 | ❌ | 39% | 0.32 | +29 | NO | no | +0.68 | +0.66 |
| 2026-06-30 | KR | GLP-1 | 10/23 | ✅ | 46% | 0.25 | +29 | NO | yes | -0.25 | -0.25 |
| 2026-06-30 | KR | Instacart | 8/23 | ❌ | 35% | 0.18 | +47 | NO | yes | -0.18 | -0.18 |
| 2026-06-30 | KR | Ocado | 16/23 | ✅ | 68% | 0.39 | +29 | YES | yes | +0.61 | +0.59 |
| 2026-06-30 | KR | Personalization | 19/23 | ✅ | 79% | 0.33 | +46 | YES | no | -0.33 | -0.33 |
| 2026-06-30 | KR | SNAP / Food Stamp | 10/23 | ✅ | 46% | 0.23 | +31 | NO | no | +0.77 | +0.75 |
| 2026-06-30 | KR | Tariff | 4/23 | ❌ | 20% | 0.43 | +37 | NO | no | +0.57 | +0.55 |
| 2026-06-30 | KTOS | Autonomous | 16/28 | ✅ | 57% | 0.41 | +16 | YES | no | -0.41 | -0.41 |
| 2026-06-30 | KTOS | Backlog | 28/28 | ✅ | 95% | 0.84 | +11 | YES | yes | +0.16 | +0.16 |
| 2026-06-30 | KTOS | Orbit | 19/28 | ✅ | 67% | 0.08 | +25 | NO | yes | -0.08 | -0.08 |
| 2026-06-30 | KTOS | Venezuela | 0/28 | ❌ | 5% | 0.81 | +14 | NO | no | +0.19 | +0.18 |
| 2026-06-30 | KTOS | Zeus | 15/28 | ❌ | 51% | 0.04 | +45 | NO | yes | -0.04 | -0.04 |
| 2026-06-30 | LYFT | Expansion | 15/28 | ✅ | 54% | 0.19 | +27 | NO | yes | -0.19 | -0.19 |
| 2026-06-30 | LYFT | FreeNow / Free Now | 4/28 | ✅ | 20% | 0.16 | +64 | NO | yes | -0.16 | -0.16 |
| 2026-06-30 | LYFT | International | 7/28 | ✅ | 29% | 0.38 | +33 | NO | no | +0.62 | +0.60 |
| 2026-06-30 | LYFT | Membership | 11/28 | ❌ | 39% | 0.23 | +16 | YES | no | -0.23 | -0.23 |
| 2026-06-30 | LYFT | Mobileye | 4/28 | ❌ | 17% | 0.60 | +23 | NO | yes | -0.60 | -0.60 |
| 2026-06-30 | LYFT | Revenue | 28/28 | ✅ | 95% | 0.83 | +12 | YES | yes | +0.17 | +0.16 |
| 2026-06-30 | LYFT | Waymo | 10/28 | ✅ | 39% | 0.10 | +51 | NO | yes | -0.10 | -0.10 |
| 2026-06-30 | MCD | Buffalo | 0/63 | ❌ | 2% | 0.71 | +27 | NO | no | +0.29 | +0.28 |
| 2026-06-30 | MCD | Caviar | 0/63 | ❌ | 2% | 0.64 | +34 | NO | no | +0.36 | +0.35 |
| 2026-06-30 | MCD | Dividend | 42/63 | ❌ | 65% | 0.07 | +28 | NO | yes | -0.07 | -0.07 |
| 2026-06-30 | MCD | DoorDash | 5/63 | ❌ | 10% | 0.78 | +12 | NO | no | +0.22 | +0.21 |
| 2026-06-30 | MCD | Grinch | 3/63 | ❌ | 7% | 0.37 | +56 | NO | yes | -0.37 | -0.37 |
| 2026-06-30 | MCD | Happy Meal | 17/63 | ✅ | 29% | 0.33 | +38 | NO | no | +0.67 | +0.65 |
| 2026-06-30 | MCD | Loyalty | 36/63 | ✅ | 57% | 0.15 | +28 | NO | yes | -0.15 | -0.15 |
| 2026-06-30 | MCD | McCrispy Chicken | 9/63 | ❌ | 16% | 0.71 | +13 | NO | no | +0.29 | +0.28 |
| 2026-06-30 | MCD | Monopoly | 17/63 | ❌ | 28% | 0.23 | +49 | NO | yes | -0.23 | -0.23 |
| 2026-06-30 | MCD | Revenue | 30/63 | ❌ | 47% | 0.25 | +22 | YES | yes | +0.75 | +0.73 |
| 2026-06-30 | MCD | Tariff | 4/63 | ❌ | 8% | 0.25 | +67 | NO | no | +0.75 | +0.73 |
| 2026-06-30 | META | Cloud | 10/55 | ✅ | 21% | 0.20 | +59 | NO | yes | -0.20 | -0.20 |
| 2026-06-30 | META | Dividend | 12/55 | ❌ | 23% | 0.05 | +72 | NO | yes | -0.05 | -0.05 |
| 2026-06-30 | META | Hiring | 39/55 | ✅ | 70% | 0.10 | +20 | NO | yes | -0.10 | -0.10 |
| 2026-06-30 | META | Hyperion | 1/55 | ❌ | 4% | 0.67 | +29 | NO | no | +0.33 | +0.32 |
| 2026-06-30 | META | Llama | 11/55 | ❌ | 21% | 0.17 | +62 | NO | no | +0.83 | +0.81 |
| 2026-06-30 | META | Oakley | 3/55 | ✅ | 9% | 0.08 | +83 | NO | no | +0.92 | +0.89 |
| 2026-06-30 | META | Orion | 4/55 | ❌ | 9% | 0.42 | +49 | NO | no | +0.58 | +0.56 |
| 2026-06-30 | META | Ray-Ban | 12/55 | ✅ | 24% | 0.09 | +67 | NO | no | +0.91 | +0.88 |
| 2026-06-30 | META | SAM | 1/55 | ❌ | 4% | 0.48 | +48 | NO | no | +0.52 | +0.50 |
| 2026-06-30 | META | Thread / Threads | 26/55 | ✅ | 48% | 0.02 | +50 | NO | yes | -0.02 | -0.02 |
| 2026-06-30 | META | VR / Virtual Reality | 40/55 | ✅ | 72% | 0.34 | +38 | YES | yes | +0.66 | +0.64 |
| 2026-06-30 | MRVL | AWS / Amazon | 8/45 | ❌ | 19% | 0.40 | +41 | NO | no | +0.60 | +0.58 |
| 2026-06-30 | MRVL | Celestial | 1/45 | ✅ | 7% | 0.06 | +87 | NO | yes | -0.06 | -0.06 |
| 2026-06-30 | MRVL | Electro-Optic / Electro Optic | 18/45 | ❌ | 40% | 0.05 | +55 | NO | yes | -0.05 | -0.05 |
| 2026-06-30 | MRVL | Hyperscaler | 21/45 | ✅ | 48% | 0.04 | +48 | NO | yes | -0.04 | -0.04 |
| 2026-06-30 | MRVL | LPO | 3/45 | ❌ | 9% | 0.18 | +73 | NO | no | +0.82 | +0.80 |
| 2026-06-30 | MRVL | Microsoft | 8/45 | ❌ | 19% | 0.55 | +26 | NO | no | +0.45 | +0.44 |
| 2026-06-30 | MRVL | Tariff | 7/45 | ❌ | 17% | 0.50 | +33 | NO | no | +0.50 | +0.48 |
| 2026-06-30 | MSFT | Anthropic | 2/63 | ✅ | 7% | 0.24 | +69 | NO | yes | -0.24 | -0.24 |
| 2026-06-30 | MSFT | College | 1/63 | ❌ | 4% | 0.82 | +14 | NO | no | +0.18 | +0.17 |
| 2026-06-30 | MSFT | Gaming | 55/63 | ✅ | 86% | 0.02 | +12 | NO | yes | -0.02 | -0.02 |
| 2026-06-30 | MSFT | LinkedIn | 40/63 | ✅ | 63% | 0.02 | +35 | NO | yes | -0.02 | -0.02 |
| 2026-06-30 | MSFT | Nvidia | 8/63 | ✅ | 15% | 0.23 | +62 | NO | yes | -0.23 | -0.23 |
| 2026-06-30 | MSFT | OpenAI | 23/63 | ✅ | 38% | 0.07 | +55 | NO | yes | -0.07 | -0.07 |
| 2026-06-30 | MSFT | Phi | 5/63 | ❌ | 10% | 0.54 | +36 | NO | no | +0.46 | +0.45 |
| 2026-06-30 | MSFT | R&D / Research and Development | 23/63 | ✅ | 38% | 0.51 | +11 | NO | yes | -0.51 | -0.51 |
| 2026-06-30 | MSFT | Teams | 46/63 | ✅ | 72% | 0.03 | +25 | NO | yes | -0.03 | -0.03 |
| 2026-06-30 | MSFT | Windows 11 | 19/63 | ❌ | 31% | 0.13 | +56 | NO | yes | -0.13 | -0.13 |
| 2026-06-30 | MTN | Acquire / Acquired / Acquisition | 24/26 | ✅ | 88% | 0.76 | +12 | YES | yes | +0.24 | +0.23 |
| 2026-06-30 | MTN | Canada / Canadian | 24/26 | ❌ | 85% | 0.73 | +12 | YES | no | -0.73 | -0.73 |
| 2026-06-30 | MTN | Dining | 20/26 | ✅ | 74% | 0.12 | +14 | NO | no | +0.88 | +0.85 |
| 2026-06-30 | MTN | Gen Z | 1/26 | ❌ | 8% | 0.26 | +66 | NO | yes | -0.26 | -0.26 |
| 2026-06-30 | MTN | Northeast | 15/26 | ✅ | 58% | 0.38 | +20 | YES | yes | +0.62 | +0.60 |
| 2026-06-30 | MTN | Rental | 20/26 | ❌ | 71% | 0.14 | +15 | NO | yes | -0.14 | -0.14 |
| 2026-06-30 | MTN | Snowpack | 3/26 | ❌ | 15% | 0.42 | +43 | NO | yes | -0.42 | -0.42 |
| 2026-06-30 | NBIS | Aether | 2/10 | ❌ | 25% | 0.32 | +43 | NO | yes | -0.32 | -0.32 |
| 2026-06-30 | NBIS | ClickHouse / Click House | 6/10 | ✅ | 60% | 0.29 | +11 | NO | yes | -0.29 | -0.29 |
| 2026-06-30 | NBIS | Meta | 3/10 | ✅ | 39% | 0.20 | +41 | NO | yes | -0.20 | -0.20 |
| 2026-06-30 | NBIS | Neocloud | 2/10 | ❌ | 25% | 0.60 | +15 | NO | no | +0.40 | +0.39 |
| 2026-06-30 | NBIS | Nvidia | 5/10 | ✅ | 53% | 0.07 | +40 | NO | no | +0.93 | +0.90 |
| 2026-06-30 | NBIS | Robotics | 3/10 | ❌ | 32% | 0.46 | +22 | NO | no | +0.54 | +0.52 |
| 2026-06-30 | NBIS | Token | 3/10 | ✅ | 39% | 0.26 | +35 | NO | yes | -0.26 | -0.26 |
| 2026-06-30 | NKE | Amazon | 10/63 | ❌ | 17% | 0.70 | +13 | NO | no | +0.30 | +0.29 |
| 2026-06-30 | NKE | Beaverton | 4/63 | ✅ | 10% | 0.72 | +18 | NO | no | +0.28 | +0.27 |
| 2026-06-30 | NKE | Consumer Demand | 44/63 | ❌ | 68% | 0.19 | +49 | YES | no | -0.19 | -0.19 |
| 2026-06-30 | NKE | Dividend | 19/63 | ✅ | 32% | 0.40 | +28 | NO | yes | -0.40 | -0.40 |
| 2026-06-30 | NKE | Express Lane | 31/63 | ❌ | 48% | 0.14 | +34 | YES | no | -0.14 | -0.14 |
| 2026-06-30 | NKE | Olympic / Olympics | 47/63 | ✅ | 74% | 0.35 | +39 | YES | no | -0.35 | -0.35 |
| 2026-06-30 | NKE | Sabrina | 12/63 | ❌ | 20% | 0.54 | +26 | NO | no | +0.46 | +0.45 |
| 2026-06-30 | NKE | Skims / NikeSKIMS | 3/63 | ✅ | 8% | 0.29 | +63 | NO | no | +0.71 | +0.69 |
| 2026-06-30 | NKE | Tariff | 9/63 | ✅ | 17% | 0.14 | +69 | NO | yes | -0.14 | -0.14 |
| 2026-06-30 | NVDA | Arizona | 2/62 | ❌ | 5% | 0.60 | +35 | NO | no | +0.40 | +0.39 |
| 2026-06-30 | NVDA | Automation | 14/62 | ❌ | 23% | 0.22 | +55 | NO | no | +0.78 | +0.76 |
| 2026-06-30 | NVDA | Cosmos | 5/62 | ❌ | 10% | 0.15 | +75 | NO | yes | -0.15 | -0.15 |
| 2026-06-30 | NVDA | Domestic | 10/62 | ❌ | 17% | 0.65 | +18 | NO | no | +0.35 | +0.34 |
| 2026-06-30 | NVDA | GM / General Motors | 4/62 | ❌ | 8% | 0.79 | +13 | NO | no | +0.21 | +0.20 |
| 2026-06-30 | NVDA | H20 | 4/62 | ❌ | 8% | 0.26 | +66 | NO | no | +0.74 | +0.72 |
| 2026-06-30 | NVDA | Humanoid | 4/62 | ✅ | 10% | 0.45 | +45 | NO | no | +0.55 | +0.53 |
| 2026-06-30 | NVDA | Hyperscaler | 26/62 | ✅ | 43% | 0.10 | +47 | NO | yes | -0.10 | -0.10 |
| 2026-06-30 | NVDA | Omniverse | 21/62 | ❌ | 34% | 0.05 | +61 | NO | yes | -0.05 | -0.05 |
| 2026-06-30 | NVDA | Self Driving | 0/62 | ❌ | 2% | 0.23 | +75 | NO | yes | -0.23 | -0.23 |
| 2026-06-30 | NVDA | Taiwan | 10/62 | ❌ | 17% | 0.54 | +29 | NO | no | +0.46 | +0.45 |
| 2026-06-30 | NVDA | Talent | 5/62 | ❌ | 10% | 0.65 | +25 | NO | yes | -0.65 | -0.65 |
| 2026-06-30 | NVDA | Tariff | 3/62 | ❌ | 7% | 0.33 | +60 | NO | no | +0.67 | +0.65 |
| 2026-06-30 | NVDA | Trump | 1/62 | ❌ | 4% | 0.75 | +21 | NO | no | +0.25 | +0.24 |
| 2026-06-30 | NVDA | TSMC | 21/62 | ❌ | 34% | 0.21 | +45 | NO | no | +0.79 | +0.77 |
| 2026-06-30 | NVDA | VR / Virtual Reality | 23/62 | ❌ | 37% | 0.14 | +23 | YES | no | -0.14 | -0.14 |
| 2026-06-30 | ON | Backlog | 37/44 | ✅ | 82% | 0.69 | +13 | YES | no | -0.69 | -0.69 |
| 2026-06-30 | ON | EV / Electric Vehicle | 37/44 | ✅ | 82% | 0.03 | +15 | NO | yes | -0.03 | -0.03 |
| 2026-06-30 | ON | Headwind | 34/44 | ✅ | 76% | 0.54 | +22 | YES | yes | +0.46 | +0.45 |
| 2026-06-30 | ON | NIO | 2/44 | ✅ | 9% | 0.74 | +17 | NO | no | +0.26 | +0.25 |
| 2026-06-30 | ON | Nvidia | 6/44 | ❌ | 16% | 0.42 | +42 | NO | no | +0.58 | +0.56 |
| 2026-06-30 | ON | Tariff | 8/44 | ❌ | 20% | 0.18 | +62 | NO | no | +0.82 | +0.80 |
| 2026-06-30 | ORCL | Air Force | 0/63 | ❌ | 2% | 0.82 | +16 | NO | no | +0.18 | +0.17 |
| 2026-06-30 | ORCL | Backlog | 19/63 | ❌ | 31% | 0.18 | +51 | NO | yes | -0.18 | -0.18 |
| 2026-06-30 | ORCL | Health | 35/63 | ✅ | 56% | 0.25 | +19 | NO | yes | -0.25 | -0.25 |
| 2026-06-30 | ORCL | Hyperscaler | 14/63 | ❌ | 23% | 0.24 | +53 | NO | no | +0.76 | +0.74 |
| 2026-06-30 | ORCL | Multicloud | 1/63 | ❌ | 4% | 0.04 | +92 | NO | yes | -0.04 | -0.04 |
| 2026-06-30 | ORCL | OpenAI | 8/63 | ❌ | 14% | 0.12 | +74 | NO | no | +0.88 | +0.85 |
| 2026-06-30 | ORCL | Partner | 28/63 | ✅ | 45% | 0.11 | +44 | NO | yes | -0.11 | -0.11 |
| 2026-06-30 | ORCL | Red Bull | 0/63 | ❌ | 2% | 0.81 | +17 | NO | no | +0.19 | +0.18 |
| 2026-06-30 | ORCL | Sovereign | 9/63 | ❌ | 16% | 0.61 | +23 | NO | yes | -0.61 | -0.61 |
| 2026-06-30 | ORCL | Stargate | 2/63 | ❌ | 5% | 0.50 | +45 | NO | no | +0.50 | +0.48 |
| 2026-06-30 | ORCL | Tariff | 2/63 | ❌ | 5% | 0.70 | +25 | NO | no | +0.30 | +0.29 |
| 2026-06-30 | PEP | Acquisition | 15/28 | ❌ | 51% | 0.23 | +26 | NO | yes | -0.23 | -0.23 |
| 2026-06-30 | PEP | Artificial Color | 2/28 | ✅ | 14% | 0.54 | +32 | NO | no | +0.46 | +0.45 |
| 2026-06-30 | PEP | Away from Home | 17/28 | ✅ | 60% | 0.20 | +20 | NO | yes | -0.20 | -0.20 |
| 2026-06-30 | PEP | Celsius | 10/28 | ✅ | 39% | 0.44 | +17 | NO | yes | -0.44 | -0.44 |
| 2026-06-30 | PEP | China | 19/28 | ❌ | 64% | 0.15 | +21 | NO | yes | -0.15 | -0.15 |
| 2026-06-30 | PEP | Food for Tomorrow | 0/28 | ❌ | 5% | 0.75 | +20 | NO | no | +0.25 | +0.24 |
| 2026-06-30 | PEP | GLP-1 | 5/28 | ✅ | 23% | 0.65 | +12 | NO | yes | -0.65 | -0.65 |
| 2026-06-30 | PEP | Healthy | 20/28 | ✅ | 70% | 0.50 | +20 | YES | no | -0.50 | -0.50 |
| 2026-06-30 | PEP | Nvidia | 0/28 | ❌ | 5% | 0.56 | +39 | NO | no | +0.44 | +0.43 |
| 2026-06-30 | PEP | Prebiotic | 2/28 | ❌ | 11% | 0.75 | +14 | NO | no | +0.25 | +0.24 |
| 2026-06-30 | PEP | Tariff | 3/28 | ❌ | 14% | 0.25 | +61 | NO | no | +0.75 | +0.73 |
| 2026-06-30 | PG | Advertising | 35/46 | ❌ | 73% | 0.62 | +11 | YES | yes | +0.38 | +0.37 |
| 2026-06-30 | PG | Beauty | 39/46 | ✅ | 83% | 0.59 | +24 | YES | yes | +0.41 | +0.40 |
| 2026-06-30 | PG | Competition | 36/46 | ✅ | 77% | 0.26 | +51 | YES | yes | +0.74 | +0.72 |
| 2026-06-30 | PG | Revenue | 21/46 | ❌ | 45% | 0.25 | +20 | YES | no | -0.25 | -0.25 |
| 2026-06-30 | PG | Tariff | 10/46 | ✅ | 25% | 0.02 | +73 | NO | yes | -0.02 | -0.02 |
| 2026-06-30 | PLTR | Automotive | 10/22 | ❌ | 44% | 0.28 | +16 | YES | no | -0.28 | -0.28 |
| 2026-06-30 | PLTR | Commercial Growth | 3/22 | ✅ | 21% | 0.62 | +17 | NO | no | +0.38 | +0.37 |
| 2026-06-30 | PLTR | Hadean | 0/22 | ❌ | 6% | 0.64 | +30 | NO | no | +0.36 | +0.35 |
| 2026-06-30 | PLTR | International | 20/22 | ✅ | 86% | 0.04 | +10 | NO | yes | -0.04 | -0.04 |
| 2026-06-30 | PLTR | Lethal | 7/22 | ❌ | 33% | 0.11 | +56 | NO | yes | -0.11 | -0.11 |
| 2026-06-30 | PLTR | Nvidia | 0/22 | ❌ | 6% | 0.47 | +47 | NO | no | +0.53 | +0.51 |
| 2026-06-30 | PLTR | Partnership | 18/22 | ✅ | 78% | 0.07 | +15 | NO | no | +0.93 | +0.90 |
| 2026-06-30 | PLTR | Revenue guidance | 15/22 | ✅ | 67% | 0.28 | +39 | YES | no | -0.28 | -0.28 |
| 2026-06-30 | PLTR | Warp Speed | 0/22 | ❌ | 6% | 0.10 | +84 | NO | yes | -0.10 | -0.10 |
| 2026-06-30 | PYPL | Bank | 39/42 | ❌ | 88% | 0.74 | +14 | YES | no | -0.74 | -0.74 |
| 2026-06-30 | PYPL | Biometric | 7/42 | ✅ | 20% | 0.27 | +53 | NO | yes | -0.27 | -0.27 |
| 2026-06-30 | PYPL | Bitcoin | 2/42 | ❌ | 8% | 0.81 | +11 | NO | no | +0.19 | +0.18 |
| 2026-06-30 | PYPL | Blue Owl | 1/42 | ❌ | 5% | 0.40 | +55 | NO | no | +0.60 | +0.58 |
| 2026-06-30 | PYPL | Cash Back / Cashback | 16/42 | ❌ | 38% | 0.21 | +41 | NO | no | +0.79 | +0.77 |
| 2026-06-30 | PYPL | College | 2/42 | ❌ | 8% | 0.32 | +60 | NO | no | +0.68 | +0.66 |
| 2026-06-30 | PYPL | Google | 18/42 | ❌ | 42% | 0.28 | +30 | NO | no | +0.72 | +0.70 |
| 2026-06-30 | PYPL | Perplexity | 3/42 | ❌ | 10% | 0.20 | +70 | NO | yes | -0.20 | -0.20 |
| 2026-06-30 | PYPL | Regulation / Regulator / Regulatory | 22/42 | ❌ | 51% | 0.24 | +27 | YES | no | -0.24 | -0.24 |
| 2026-06-30 | PYPL | Stablecoin / Stable Coin | 5/42 | ✅ | 16% | 0.29 | +55 | NO | no | +0.71 | +0.69 |
| 2026-06-30 | PYPL | Unprofitable | 6/42 | ❌ | 16% | 0.46 | +38 | NO | no | +0.54 | +0.52 |
| 2026-06-30 | RDDT | Algorithm | 6/8 | ✅ | 69% | 0.58 | +11 | YES | yes | +0.42 | +0.41 |
| 2026-06-30 | RDDT | Emplifi | 0/8 | ❌ | 13% | 0.43 | +44 | NO | no | +0.57 | +0.55 |
| 2026-06-30 | RDDT | Game | 5/8 | ❌ | 53% | 0.30 | +17 | NO | no | +0.70 | +0.68 |
| 2026-06-30 | RDDT | Holiday | 3/8 | ❌ | 37% | 0.46 | +17 | NO | yes | -0.46 | -0.46 |
| 2026-06-30 | RDDT | OpenAI / Open AI | 5/8 | ✅ | 61% | 0.28 | +33 | YES | yes | +0.72 | +0.70 |
| 2026-06-30 | RDDT | Reddit Pro | 7/8 | ✅ | 77% | 0.06 | +17 | NO | yes | -0.06 | -0.06 |
| 2026-06-30 | RDDT | Traffic | 8/8 | ✅ | 85% | 0.02 | +13 | NO | yes | -0.02 | -0.02 |
| 2026-06-30 | RKLB | Cryogenic | 8/19 | ❌ | 41% | 0.17 | +24 | YES | yes | +0.83 | +0.81 |
| 2026-06-30 | RKLB | Golden Dome | 4/19 | ✅ | 28% | 0.18 | +54 | NO | yes | -0.18 | -0.18 |
| 2026-06-30 | RKLB | Human | 9/19 | ❌ | 45% | 0.18 | +37 | NO | yes | -0.18 | -0.18 |
| 2026-06-30 | RKLB | Japan | 4/19 | ❌ | 24% | 0.30 | +46 | NO | no | +0.70 | +0.68 |
| 2026-06-30 | RKLB | Momentum | 8/19 | ✅ | 45% | 0.43 | +12 | NO | yes | -0.43 | -0.43 |
| 2026-06-30 | RKLB | Reusable | 15/19 | ✅ | 75% | 0.10 | +15 | NO | yes | -0.10 | -0.10 |
| 2026-06-30 | RKLB | Shutdown / Shut Down | 4/19 | ❌ | 24% | 0.54 | +22 | NO | yes | -0.54 | -0.54 |
| 2026-06-30 | RKLB | SpaceX | 8/19 | ❌ | 41% | 0.36 | +23 | NO | no | +0.64 | +0.62 |
| 2026-06-30 | RKLB | Tariff | 2/19 | ✅ | 19% | 0.70 | +11 | NO | no | +0.30 | +0.29 |
| 2026-06-30 | ROKU | Acquisition | 25/34 | ✅ | 72% | 0.43 | +29 | YES | yes | +0.57 | +0.55 |
| 2026-06-30 | ROKU | Brazil | 17/34 | ❌ | 49% | 0.22 | +27 | YES | yes | +0.78 | +0.76 |
| 2026-06-30 | ROKU | FreeWheel / Free Wheel | 0/34 | ✅ | 6% | 0.83 | +11 | NO | no | +0.17 | +0.16 |
| 2026-06-30 | ROKU | Hour | 31/34 | ❌ | 85% | 0.69 | +16 | YES | no | -0.69 | -0.69 |
| 2026-06-30 | ROKU | Howdy | 2/34 | ✅ | 12% | 0.24 | +64 | NO | yes | -0.24 | -0.24 |
| 2026-06-30 | ROKU | Live | 22/34 | ✅ | 64% | 0.25 | +11 | NO | no | +0.75 | +0.73 |
| 2026-06-30 | ROKU | Olympic / Olympics | 6/34 | ✅ | 22% | 0.28 | +50 | NO | yes | -0.28 | -0.28 |
| 2026-06-30 | ROKU | Retain / Retention | 19/34 | ❌ | 54% | 0.35 | +11 | NO | no | +0.65 | +0.63 |
| 2026-06-30 | ROKU | Roku City | 9/34 | ✅ | 30% | 0.34 | +36 | NO | yes | -0.34 | -0.34 |
| 2026-06-30 | SBUX | Canada | 18/45 | ❌ | 40% | 0.24 | +36 | NO | no | +0.76 | +0.74 |
| 2026-06-30 | SBUX | Comparable Sales | 12/45 | ✅ | 29% | 0.60 | +11 | NO | no | +0.40 | +0.39 |
| 2026-06-30 | SBUX | Condiment Bar | 5/45 | ❌ | 13% | 0.34 | +53 | NO | no | +0.66 | +0.64 |
| 2026-06-30 | SBUX | Holiday | 37/45 | ❌ | 78% | 0.11 | +11 | NO | yes | -0.11 | -0.11 |
| 2026-06-30 | SBUX | Loyalty | 36/45 | ✅ | 78% | 0.57 | +21 | YES | no | -0.57 | -0.57 |
| 2026-06-30 | SBUX | Non Dairy | 0/45 | ❌ | 3% | 0.39 | +58 | NO | no | +0.61 | +0.59 |
| 2026-06-30 | SBUX | Peppermint | 6/45 | ❌ | 15% | 0.69 | +16 | NO | no | +0.31 | +0.30 |
| 2026-06-30 | SBUX | Promotion | 26/45 | ❌ | 56% | 0.16 | +28 | NO | no | +0.84 | +0.81 |
| 2026-06-30 | SBUX | Protein | 11/45 | ✅ | 27% | 0.03 | +70 | NO | yes | -0.03 | -0.03 |
| 2026-06-30 | SBUX | Smart Queue / SmartQ | 3/45 | ✅ | 11% | 0.35 | +54 | NO | yes | -0.35 | -0.35 |
| 2026-06-30 | SBUX | Tariff | 4/45 | ✅ | 13% | 0.29 | +58 | NO | yes | -0.29 | -0.29 |
| 2026-06-30 | SBUX | Union | 2/45 | ❌ | 7% | 0.82 | +11 | NO | no | +0.18 | +0.17 |
| 2026-06-30 | SFM | Inflation | 19/24 | ✅ | 76% | 0.50 | +26 | YES | yes | +0.50 | +0.48 |
| 2026-06-30 | SFM | Personalization | 13/24 | ✅ | 55% | 0.10 | +35 | NO | yes | -0.10 | -0.10 |
| 2026-06-30 | SFM | Revenue | 5/24 | ❌ | 23% | 0.38 | +39 | NO | no | +0.62 | +0.60 |
| 2026-06-30 | SHOP | Black Friday | 23/43 | ❌ | 52% | 0.08 | +40 | NO | no | +0.92 | +0.89 |
| 2026-06-30 | SHOP | Klarna | 4/43 | ❌ | 12% | 0.69 | +19 | NO | no | +0.31 | +0.30 |
| 2026-06-30 | SHOP | OpenAI | 5/43 | ✅ | 16% | 0.26 | +58 | NO | yes | -0.26 | -0.26 |
| 2026-06-30 | SHOP | Shop Pay | 25/43 | ✅ | 58% | 0.13 | +29 | NO | yes | -0.13 | -0.13 |
| 2026-06-30 | SHOP | Tariff | 6/43 | ❌ | 16% | 0.15 | +69 | NO | yes | -0.15 | -0.15 |
| 2026-06-30 | SNAP | Family Center | 1/20 | ❌ | 10% | 0.63 | +27 | NO | no | +0.37 | +0.36 |
| 2026-06-30 | SNAP | Game | 11/20 | ✅ | 56% | 0.05 | +39 | NO | yes | -0.05 | -0.05 |
| 2026-06-30 | SNAP | Glasses | 10/20 | ✅ | 52% | 0.06 | +42 | NO | yes | -0.06 | -0.06 |
| 2026-06-30 | SNAP | Lens | 18/20 | ✅ | 85% | 0.02 | +13 | NO | yes | -0.02 | -0.02 |
| 2026-06-30 | SNAP | Platinum | 1/20 | ❌ | 10% | 0.41 | +49 | NO | no | +0.59 | +0.57 |
| 2026-06-30 | SNAP | Retention | 14/20 | ✅ | 68% | 0.10 | +22 | NO | yes | -0.10 | -0.10 |
| 2026-06-30 | SNAP | Spectacles | 12/20 | ❌ | 56% | 0.16 | +28 | NO | yes | -0.16 | -0.16 |
| 2026-06-30 | SNAP | Storage | 2/20 | ✅ | 18% | 0.23 | +59 | NO | yes | -0.23 | -0.23 |
| 2026-06-30 | SNOW | Europe | 14/22 | ❌ | 59% | 0.27 | +32 | YES | yes | +0.73 | +0.71 |
| 2026-06-30 | SNOW | Hiring | 21/22 | ✅ | 90% | 0.73 | +17 | YES | yes | +0.27 | +0.26 |
| 2026-06-30 | SNOW | Open Source | 3/22 | ✅ | 21% | 0.61 | +18 | NO | no | +0.39 | +0.38 |
| 2026-06-30 | SNOW | Partnership | 20/22 | ✅ | 86% | 0.03 | +11 | NO | yes | -0.03 | -0.03 |
| 2026-06-30 | SNOW | Repurchase | 13/22 | ✅ | 59% | 0.11 | +30 | NO | yes | -0.11 | -0.11 |
| 2026-06-30 | SPOT | Apple TV | 2/32 | ✅ | 12% | 0.67 | +21 | NO | no | +0.33 | +0.32 |
| 2026-06-30 | SPOT | Bookshop / Bookshop.org | 1/32 | ❌ | 7% | 0.35 | +58 | NO | yes | -0.35 | -0.35 |
| 2026-06-30 | SPOT | ChatGPT | 1/32 | ✅ | 9% | 0.66 | +25 | NO | no | +0.34 | +0.33 |
| 2026-06-30 | SPOT | Churn | 31/32 | ✅ | 93% | 0.82 | +11 | YES | yes | +0.18 | +0.17 |
| 2026-06-30 | SPOT | Game / Gaming | 14/32 | ❌ | 43% | 0.32 | +11 | YES | yes | +0.68 | +0.66 |
| 2026-06-30 | SPOT | Lyric | 2/32 | ❌ | 10% | 0.73 | +17 | NO | no | +0.27 | +0.26 |
| 2026-06-30 | SPOT | Message | 8/32 | ❌ | 26% | 0.55 | +19 | NO | no | +0.45 | +0.44 |
| 2026-06-30 | SPOT | Meta | 1/32 | ❌ | 7% | 0.67 | +26 | NO | no | +0.33 | +0.32 |
| 2026-06-30 | SPOT | Monetization | 25/32 | ✅ | 76% | 0.05 | +19 | NO | yes | -0.05 | -0.05 |
| 2026-06-30 | SPOT | Netflix | 8/32 | ❌ | 26% | 0.34 | +40 | NO | no | +0.66 | +0.64 |
| 2026-06-30 | SPOT | Wrapped | 10/32 | ❌ | 32% | 0.14 | +54 | NO | yes | -0.14 | -0.14 |
| 2026-06-30 | STZ | Depletion / Depletions | 43/43 | ✅ | 96% | 0.81 | +15 | YES | yes | +0.19 | +0.18 |
| 2026-06-30 | STZ | Dividend | 36/43 | ✅ | 82% | 0.48 | +34 | YES | no | -0.48 | -0.48 |
| 2026-06-30 | STZ | Especial | 40/43 | ✅ | 90% | 0.48 | +42 | YES | no | -0.48 | -0.48 |
| 2026-06-30 | STZ | Holiday | 34/43 | ❌ | 75% | 0.31 | +44 | YES | yes | +0.69 | +0.67 |
| 2026-06-30 | STZ | Inflation | 25/43 | ❌ | 56% | 0.24 | +20 | NO | no | +0.76 | +0.74 |
| 2026-06-30 | STZ | Inventory | 38/43 | ✅ | 86% | 0.71 | +15 | YES | yes | +0.29 | +0.28 |
| 2026-06-30 | STZ | Tariff | 9/43 | ✅ | 24% | 0.25 | +51 | NO | yes | -0.25 | -0.25 |
| 2026-06-30 | TGT | Circle 360 | 9/52 | ❌ | 19% | 0.07 | +74 | NO | yes | -0.07 | -0.07 |
| 2026-06-30 | TGT | Inflation | 22/52 | ❌ | 42% | 0.40 | +18 | NO | no | +0.60 | +0.58 |
| 2026-06-30 | TGT | Labor | 36/52 | ✅ | 68% | 0.57 | +11 | YES | yes | +0.43 | +0.42 |
| 2026-06-30 | TGT | Synthetic Color | 3/52 | ✅ | 10% | 0.77 | +13 | NO | yes | -0.77 | -0.77 |
| 2026-06-30 | TSLA | Autonomous | 34/62 | ✅ | 55% | 0.04 | +41 | NO | yes | -0.04 | -0.04 |
| 2026-06-30 | TSLA | China | 51/62 | ✅ | 81% | 0.05 | +14 | NO | yes | -0.05 | -0.05 |
| 2026-06-30 | TSLA | Competition | 13/62 | ✅ | 23% | 0.34 | +43 | NO | yes | -0.34 | -0.34 |
| 2026-06-30 | TSLA | Cybertruck | 23/62 | ❌ | 37% | 0.36 | +27 | NO | yes | -0.36 | -0.36 |
| 2026-06-30 | TSLA | Delivery | 48/62 | ✅ | 76% | 0.13 | +11 | NO | yes | -0.13 | -0.13 |
| 2026-06-30 | TSLA | Energy | 49/62 | ✅ | 78% | 0.02 | +20 | NO | yes | -0.02 | -0.02 |
| 2026-06-30 | TSLA | FSD / Full Self Driving | 27/62 | ✅ | 44% | 0.01 | +55 | NO | yes | -0.01 | -0.01 |
| 2026-06-30 | TSLA | Grok 5 | 1/62 | ❌ | 4% | 0.72 | +24 | NO | no | +0.28 | +0.27 |
| 2026-06-30 | TSLA | Optimus | 16/62 | ✅ | 28% | 0.03 | +69 | NO | yes | -0.03 | -0.03 |
| 2026-06-30 | TSLA | Regulator / Regulatory / Regulation | 48/62 | ✅ | 76% | 0.07 | +17 | NO | yes | -0.07 | -0.07 |
| 2026-06-30 | TSLA | Tariff | 13/62 | ✅ | 23% | 0.24 | +53 | NO | yes | -0.24 | -0.24 |
| 2026-06-30 | TSLA | Robotaxi | 21/62 | ✅ | 35% | 0.01 | +64 | NO | yes | -0.01 | -0.01 |
| 2026-06-30 | TSLA | Trump | 4/62 | ❌ | 8% | 0.71 | +21 | NO | no | +0.29 | +0.28 |
| 2026-06-30 | UBER | Autonomous | 11/28 | ✅ | 42% | 0.08 | +50 | NO | yes | -0.08 | -0.08 |
| 2026-06-30 | UBER | Avride | 3/28 | ❌ | 14% | 0.56 | +30 | NO | yes | -0.56 | -0.56 |
| 2026-06-30 | UBER | Driver Incentives | 10/28 | ❌ | 36% | 0.19 | +17 | YES | no | -0.19 | -0.19 |
| 2026-06-30 | UBER | Expansion | 20/28 | ✅ | 70% | 0.17 | +13 | NO | yes | -0.17 | -0.17 |
| 2026-06-30 | UBER | Freight | 17/28 | ✅ | 60% | 0.20 | +40 | YES | yes | +0.80 | +0.78 |
| 2026-06-30 | UBER | Joby | 3/28 | ❌ | 14% | 0.74 | +12 | NO | no | +0.26 | +0.25 |
| 2026-06-30 | UBER | Lucid | 2/28 | ✅ | 14% | 0.28 | +58 | NO | yes | -0.28 | -0.28 |
| 2026-06-30 | UBER | Market Share | 12/28 | ✅ | 45% | 0.15 | +30 | YES | no | -0.15 | -0.15 |
| 2026-06-30 | UBER | Regulator / Regulatory / Regulation | 21/28 | ✅ | 73% | 0.36 | +37 | YES | yes | +0.64 | +0.62 |
| 2026-06-30 | UBER | Safety | 17/28 | ✅ | 60% | 0.27 | +13 | NO | yes | -0.27 | -0.27 |
| 2026-06-30 | UBER | Waabi | 4/28 | ❌ | 17% | 0.19 | +64 | NO | yes | -0.19 | -0.19 |
| 2026-06-30 | UBER | Waymo | 8/28 | ✅ | 32% | 0.14 | +54 | NO | yes | -0.14 | -0.14 |
| 2026-06-30 | ULTA | Diamond | 9/20 | ❌ | 44% | 0.27 | +17 | YES | yes | +0.73 | +0.71 |
| 2026-06-30 | ULTA | Holiday | 18/20 | ❌ | 81% | 0.06 | +13 | NO | yes | -0.06 | -0.06 |
| 2026-06-30 | ULTA | Middle East | 4/20 | ✅ | 27% | 0.33 | +40 | NO | yes | -0.33 | -0.33 |
| 2026-06-30 | ULTA | Reward | 13/20 | ✅ | 64% | 0.32 | +32 | YES | yes | +0.68 | +0.66 |
| 2026-06-30 | ULTA | Space NK | 3/20 | ✅ | 23% | 0.09 | +68 | NO | yes | -0.09 | -0.09 |
| 2026-06-30 | ULTA | Tariff | 4/20 | ❌ | 23% | 0.21 | +56 | NO | no | +0.79 | +0.77 |
| 2026-06-30 | ULTA | Uncertainty | 11/20 | ✅ | 56% | 0.10 | +34 | NO | yes | -0.10 | -0.10 |
| 2026-06-30 | V | Blockchain | 12/64 | ✅ | 21% | 0.14 | +65 | NO | yes | -0.14 | -0.14 |
| 2026-06-30 | V | Holiday | 23/64 | ❌ | 36% | 0.16 | +48 | NO | yes | -0.16 | -0.16 |
| 2026-06-30 | V | Inflation | 12/64 | ❌ | 20% | 0.50 | +30 | NO | no | +0.50 | +0.48 |
| 2026-06-30 | V | Loyalty | 20/64 | ✅ | 33% | 0.45 | +22 | NO | no | +0.55 | +0.53 |
| 2026-06-30 | V | Mercuryo | 0/64 | ❌ | 2% | 0.21 | +77 | NO | no | +0.79 | +0.77 |
| 2026-06-30 | V | Rate Cap / 10% Cap | 0/64 | ❌ | 2% | 0.73 | +25 | NO | no | +0.27 | +0.26 |
| 2026-06-30 | V | Trump | 1/64 | ❌ | 4% | 0.59 | +37 | NO | no | +0.41 | +0.40 |
| 2026-06-30 | VSCO | AI / Artificial Intelligence | 2/6 | ❌ | 34% | 0.45 | +21 | NO | no | +0.55 | +0.53 |
| 2026-06-30 | VSCO | Conversion | 5/6 | ❌ | 62% | 0.47 | +15 | YES | yes | +0.53 | +0.51 |
| 2026-06-30 | VSCO | Dream | 3/6 | ❌ | 44% | 0.29 | +27 | NO | no | +0.71 | +0.69 |
| 2026-06-30 | VSCO | Fashion Show | 5/6 | ✅ | 73% | 0.10 | +17 | NO | yes | -0.10 | -0.10 |
| 2026-06-30 | VSCO | FlexFactor | 0/6 | ❌ | 15% | 0.44 | +41 | NO | no | +0.56 | +0.54 |
| 2026-06-30 | VSCO | Fragrance | 4/6 | ✅ | 64% | 0.16 | +20 | NO | yes | -0.16 | -0.16 |
| 2026-06-30 | VSCO | Loyalty Program | 5/6 | ❌ | 62% | 0.45 | +17 | YES | yes | +0.55 | +0.53 |
| 2026-06-30 | VSCO | Sport Bra / Sports Bra | 4/6 | ✅ | 64% | 0.22 | +14 | NO | yes | -0.22 | -0.22 |
| 2026-06-30 | VSCO | Tariff | 1/6 | ✅ | 36% | 0.08 | +57 | NO | yes | -0.08 | -0.08 |
| 2026-06-30 | VSCO | Valentine | 1/6 | ✅ | 36% | 0.20 | +44 | NO | yes | -0.20 | -0.20 |
| 2026-06-30 | VZ | Outage | 1/28 | ✅ | 11% | 0.62 | +27 | NO | yes | -0.62 | -0.62 |
| 2026-06-30 | VZ | Rural | 10/28 | ❌ | 36% | 0.54 | +10 | NO | no | +0.46 | +0.45 |
| 2026-06-30 | VZ | Satellite | 8/28 | ❌ | 30% | 0.58 | +12 | NO | no | +0.42 | +0.41 |
| 2026-06-30 | VZ | Spectrum | 27/28 | ✅ | 92% | 0.81 | +11 | YES | no | -0.81 | -0.81 |
| 2026-06-30 | VZ | Starry | 2/28 | ✅ | 14% | 0.44 | +42 | NO | yes | -0.44 | -0.44 |
| 2026-06-30 | VZ | Synergy | 3/28 | ❌ | 14% | 0.11 | +75 | NO | yes | -0.11 | -0.11 |
| 2026-06-30 | VZ | Tariff | 1/28 | ❌ | 8% | 0.79 | +13 | NO | no | +0.21 | +0.20 |
| 2026-06-30 | WEN | Baconator | 2/24 | ❌ | 13% | 0.68 | +19 | NO | yes | -0.68 | -0.68 |
| 2026-06-30 | WEN | Closure | 16/24 | ✅ | 66% | 0.13 | +21 | NO | yes | -0.13 | -0.13 |
| 2026-06-30 | WEN | FreshAI | 5/24 | ❌ | 23% | 0.10 | +67 | NO | yes | -0.10 | -0.10 |
| 2026-06-30 | WEN | Frosty | 15/24 | ✅ | 62% | 0.27 | +11 | NO | yes | -0.27 | -0.27 |
| 2026-06-30 | WEN | Project Fresh | 2/24 | ✅ | 16% | 0.03 | +81 | NO | yes | -0.03 | -0.03 |
| 2026-06-30 | WEN | Ranch | 4/24 | ✅ | 23% | 0.15 | +62 | NO | yes | -0.15 | -0.15 |
| 2026-06-30 | WEN | Tariff | 2/24 | ❌ | 13% | 0.67 | +20 | NO | no | +0.33 | +0.32 |
| 2026-06-30 | WING | Lemon Pepper | 1/32 | ✅ | 9% | 0.76 | +15 | NO | no | +0.24 | +0.23 |
| 2026-06-30 | WING | NFL / NBA | 14/32 | ❌ | 43% | 0.18 | +39 | NO | no | +0.82 | +0.80 |
| 2026-06-30 | WING | Packaging | 14/32 | ✅ | 45% | 0.32 | +23 | NO | no | +0.68 | +0.66 |
| 2026-06-30 | WING | Share Repurchase | 10/32 | ✅ | 34% | 0.05 | +61 | NO | yes | -0.05 | -0.05 |
| 2026-06-30 | WING | Tender | 14/32 | ✅ | 45% | 0.28 | +27 | NO | yes | -0.28 | -0.28 |
| 2026-06-30 | WMT | Automotive | 15/59 | ❌ | 26% | 0.31 | +43 | NO | no | +0.69 | +0.67 |
| 2026-06-30 | WMT | Automation | 26/59 | ✅ | 45% | 0.09 | +46 | NO | yes | -0.09 | -0.09 |
| 2026-06-30 | WMT | Brick and Mortar | 2/59 | ❌ | 6% | 0.66 | +28 | NO | no | +0.34 | +0.33 |
| 2026-06-30 | WMT | Competition | 25/59 | ❌ | 42% | 0.25 | +17 | YES | no | -0.25 | -0.25 |
| 2026-06-30 | WMT | Dividend | 39/59 | ❌ | 64% | 0.05 | +31 | NO | no | +0.95 | +0.92 |
| 2026-06-30 | WMT | Omnichannel | 25/59 | ✅ | 43% | 0.15 | +42 | NO | yes | -0.15 | -0.15 |
| 2026-06-30 | WMT | OnePay / One Pay | 3/59 | ❌ | 7% | 0.22 | +71 | NO | yes | -0.22 | -0.22 |
| 2026-06-30 | WMT | OpenAi | 2/59 | ❌ | 6% | 0.43 | +51 | NO | yes | -0.43 | -0.43 |
| 2026-06-30 | WMT | Tariff | 33/59 | ✅ | 56% | 0.06 | +38 | NO | yes | -0.06 | -0.06 |
| 2026-06-30 | WMT | Upper Income | 1/59 | ❌ | 4% | 0.38 | +58 | NO | no | +0.62 | +0.60 |
| 2026-07-01 | GIS | Divestiture | 9/10 | ✅ | 81% | 0.22 | +59 | YES | yes | +0.78 | +0.76 |
| 2026-07-01 | GIS | GLP-1 / Ozempic | 0/10 | ❌ | 11% | 0.48 | +41 | NO | no | +0.52 | +0.50 |
| 2026-07-01 | GIS | Iran / Middle East | 8/10 | ✅ | 74% | 0.15 | +59 | YES | no | -0.15 | -0.15 |
| 2026-07-01 | GIS | Supply Chain | 7/10 | ✅ | 67% | 0.19 | +14 | NO | yes | -0.19 | -0.19 |
| 2026-07-01 | GIS | Tariff | 1/10 | ❌ | 18% | 0.20 | +62 | NO | yes | -0.20 | -0.20 |
| 2026-07-01 | GIS | Totino | 7/10 | ❌ | 60% | 0.15 | +25 | NO | yes | -0.15 | -0.15 |
| 2026-07-01 | GIS | Wilderness | 5/10 | ✅ | 53% | 0.36 | +17 | YES | yes | +0.64 | +0.62 |
| 2026-07-01 | GIS | World Cup | 1/10 | ❌ | 18% | 0.59 | +23 | NO | no | +0.41 | +0.40 |
| 2026-07-01 | STZ | Aluminum | 12/43 | ✅ | 31% | 0.29 | +40 | NO | no | +0.71 | +0.69 |
| 2026-07-01 | STZ | Cannabis | 24/43 | ❌ | 54% | 0.07 | +47 | YES | no | -0.07 | -0.07 |
| 2026-07-01 | STZ | Depletion / Depletions | 43/43 | ✅ | 96% | 0.83 | +13 | YES | yes | +0.17 | +0.16 |
| 2026-07-01 | STZ | Dividend | 36/43 | ✅ | 82% | 0.55 | +27 | YES | no | -0.55 | -0.55 |
| 2026-07-01 | STZ | Especial | 40/43 | ✅ | 90% | 0.67 | +23 | YES | yes | +0.33 | +0.32 |
| 2026-07-01 | STZ | Inflation | 25/43 | ❌ | 56% | 0.33 | +23 | YES | yes | +0.67 | +0.65 |
| 2026-07-01 | STZ | Mi Campo | 8/43 | ✅ | 22% | 0.59 | +19 | NO | yes | -0.59 | -0.59 |
| 2026-07-01 | STZ | Sunbrew | 7/43 | ✅ | 20% | 0.19 | +61 | NO | no | +0.81 | +0.79 |
| 2026-07-01 | STZ | Tariff | 9/43 | ✅ | 24% | 0.20 | +56 | NO | no | +0.80 | +0.78 |
| 2026-07-01 | STZ | World Cup | 2/43 | ✅ | 9% | 0.22 | +69 | NO | yes | -0.22 | -0.22 |
| 2026-07-02 | NFLX | Acquisition | 46/63 | ✅ | 72% | 0.14 | +14 | NO | yes | -0.14 | -0.14 |
| 2026-07-02 | NFLX | Ad-Supported | 15/63 | ❌ | 25% | 0.61 | +14 | NO | no | +0.39 | +0.38 |
| 2026-07-02 | NFLX | Gaming | 21/63 | ✅ | 35% | 0.10 | +55 | NO | no | +0.90 | +0.87 |
| 2026-07-02 | NFLX | Hollywood | 21/63 | ✅ | 35% | 0.52 | +13 | NO | no | +0.48 | +0.47 |
| 2026-07-02 | NFLX | KPop Demon Hunters | 0/63 | ❌ | 2% | 0.71 | +27 | NO | yes | -0.71 | -0.71 |
| 2026-07-02 | NFLX | Live Event | 13/63 | ✅ | 23% | 0.16 | +61 | NO | yes | -0.16 | -0.16 |
| 2026-07-02 | NFLX | NFL | 11/63 | ✅ | 20% | 0.16 | +64 | NO | no | +0.84 | +0.81 |
| 2026-07-02 | NFLX | One Piece | 9/63 | ✅ | 17% | 0.59 | +24 | NO | no | +0.41 | +0.40 |
| 2026-07-02 | NFLX | Paramount | 9/63 | ✅ | 17% | 0.71 | +12 | NO | no | +0.29 | +0.28 |
| 2026-07-02 | NFLX | Partnership | 37/63 | ✅ | 59% | 0.25 | +16 | NO | yes | -0.25 | -0.25 |
| 2026-07-02 | NFLX | Subscriber | 56/63 | ✅ | 87% | 0.59 | +28 | YES | yes | +0.41 | +0.40 |
| 2026-07-02 | NFLX | Warner Bros. / Warner Brothers | 6/63 | ✅ | 12% | 0.61 | +27 | NO | no | +0.39 | +0.38 |
| 2026-07-02 | NFLX | World Cup | 4/63 | ✅ | 10% | 0.46 | +44 | NO | no | +0.54 | +0.52 |
| 2026-07-08 | LEVI | AI / Artificial Intelligence | 16/59 | ✅ | 29% | 0.27 | +44 | NO | yes | -0.27 | -0.27 |
| 2026-07-08 | LEVI | Beyoncé | 0/59 | ❌ | 2% | 0.38 | +60 | NO | no | +0.62 | +0.60 |
| 2026-07-08 | LEVI | Beyond Yoga | 18/59 | ✅ | 32% | 0.07 | +61 | NO | yes | -0.07 | -0.07 |
| 2026-07-08 | LEVI | China | 56/59 | ✅ | 93% | 0.79 | +14 | YES | yes | +0.21 | +0.20 |
| 2026-07-08 | LEVI | Disney | 1/59 | ❌ | 4% | 0.85 | +11 | NO | no | +0.15 | +0.15 |
| 2026-07-08 | LEVI | Dockers | 51/59 | ✅ | 85% | 0.57 | +28 | YES | yes | +0.43 | +0.42 |
| 2026-07-08 | LEVI | Jordan | 25/59 | ✅ | 43% | 0.40 | +17 | NO | no | +0.60 | +0.58 |
| 2026-07-08 | LEVI | Nike | 8/59 | ✅ | 16% | 0.55 | +29 | NO | no | +0.45 | +0.44 |
| 2026-07-08 | LEVI | Tariff | 11/59 | ✅ | 21% | 0.13 | +66 | NO | yes | -0.13 | -0.13 |
| 2026-07-08 | LEVI | World Cup | 1/59 | ✅ | 5% | 0.37 | +58 | NO | yes | -0.37 | -0.37 |
| 2026-07-10 | DAL | Dividend | 14/28 | ❌ | 48% | 0.07 | +45 | NO | yes | -0.07 | -0.07 |
| 2026-07-10 | DAL | Headwind | 17/28 | ✅ | 60% | 0.26 | +14 | NO | yes | -0.26 | -0.26 |
| 2026-07-10 | DAL | Nonstop / Non-Stop | 1/28 | ❌ | 8% | 0.80 | +12 | NO | no | +0.20 | +0.19 |
| 2026-07-10 | DAL | Oil | 3/28 | ✅ | 17% | 0.31 | +52 | NO | no | +0.69 | +0.67 |
| 2026-07-10 | DAL | Partnership | 21/28 | ✅ | 73% | 0.07 | +20 | NO | yes | -0.07 | -0.07 |
| 2026-07-10 | DAL | Shutdown / Shut Down | 6/28 | ❌ | 23% | 0.13 | +10 | YES | no | -0.13 | -0.13 |
| 2026-07-10 | DAL | Tailwind | 18/28 | ❌ | 61% | 0.35 | +26 | YES | no | -0.35 | -0.35 |
| 2026-07-10 | DAL | Tariff | 9/28 | ✅ | 36% | 0.29 | +35 | NO | no | +0.71 | +0.69 |
| 2026-07-10 | DAL | Weather | 15/28 | ✅ | 54% | 0.26 | +20 | NO | no | +0.74 | +0.72 |
| 2026-07-10 | DAL | YouTube | 3/28 | ✅ | 17% | 0.38 | +45 | NO | no | +0.62 | +0.60 |
| 2026-07-14 | BAC | Basel 3 | 0/63 | ❌ | 2% | 0.35 | +63 | NO | no | +0.65 | +0.63 |
| 2026-07-14 | BAC | CashPro | 21/63 | ✅ | 35% | 0.45 | +20 | NO | no | +0.55 | +0.53 |
| 2026-07-14 | BAC | Delinquency | 32/63 | ❌ | 50% | 0.12 | +38 | NO | yes | -0.12 | -0.12 |
| 2026-07-14 | BAC | Inflation | 23/63 | ✅ | 38% | 0.10 | +52 | NO | yes | -0.10 | -0.10 |
| 2026-07-14 | BAC | M&A / Merger | 38/63 | ✅ | 60% | 0.22 | +18 | NO | no | +0.78 | +0.76 |
| 2026-07-14 | BAC | Pipeline | 37/63 | ✅ | 59% | 0.21 | +20 | NO | yes | -0.21 | -0.21 |
| 2026-07-14 | BAC | Rate Cut / Cut Rate | 18/63 | ✅ | 30% | 0.13 | +57 | NO | yes | -0.13 | -0.13 |
| 2026-07-14 | BAC | Recession | 24/63 | ❌ | 38% | 0.20 | +18 | YES | no | -0.20 | -0.20 |
| 2026-07-14 | BAC | Tariff | 5/63 | ✅ | 11% | 0.45 | +44 | NO | no | +0.55 | +0.53 |
| 2026-07-14 | BAC | Trump / President | 9/63 | ✅ | 17% | 0.64 | +19 | NO | no | +0.36 | +0.35 |
| 2026-07-14 | BAC | World Cup | 1/63 | ❌ | 4% | 0.48 | +48 | NO | yes | -0.48 | -0.48 |
| 2026-07-14 | C | Banamex | 6/16 | ✅ | 42% | 0.15 | +43 | NO | yes | -0.15 | -0.15 |
| 2026-07-14 | C | Basel 3 | 0/16 | ❌ | 8% | 0.31 | +61 | NO | yes | -0.31 | -0.31 |
| 2026-07-14 | C | Credit Card | 9/16 | ✅ | 57% | 0.21 | +22 | NO | yes | -0.21 | -0.21 |
| 2026-07-14 | C | FICO | 4/16 | ✅ | 32% | 0.15 | +53 | NO | yes | -0.15 | -0.15 |
| 2026-07-14 | C | Headwind | 15/16 | ❌ | 82% | 0.57 | +25 | YES | yes | +0.43 | +0.42 |
| 2026-07-14 | C | Inflation | 7/16 | ✅ | 47% | 0.16 | +37 | NO | yes | -0.16 | -0.16 |
| 2026-07-14 | C | Oil | 4/16 | ❌ | 27% | 0.13 | +14 | YES | no | -0.13 | -0.13 |
| 2026-07-14 | C | Recession | 4/16 | ❌ | 27% | 0.04 | +23 | YES | no | -0.04 | -0.04 |
| 2026-07-14 | GS | Geopolitical | 17/28 | ✅ | 60% | 0.27 | +13 | NO | no | +0.73 | +0.71 |
| 2026-07-14 | GS | Industry Ventures | 2/28 | ✅ | 14% | 0.61 | +25 | NO | yes | -0.61 | -0.61 |
| 2026-07-14 | GS | Marcus | 19/28 | ✅ | 67% | 0.48 | +19 | YES | no | -0.48 | -0.48 |
| 2026-07-14 | GS | Private Credit | 12/28 | ✅ | 45% | 0.31 | +24 | NO | yes | -0.31 | -0.31 |
| 2026-07-14 | GS | Recession | 7/28 | ✅ | 29% | 0.26 | +45 | NO | no | +0.74 | +0.72 |
| 2026-07-14 | GS | Regulation | 8/28 | ✅ | 32% | 0.37 | +31 | NO | yes | -0.37 | -0.37 |
| 2026-07-14 | GS | SpaceX | 0/28 | ❌ | 5% | 0.15 | +80 | NO | yes | -0.15 | -0.15 |
| 2026-07-14 | GS | Tailwind | 15/28 | ✅ | 54% | 0.11 | +35 | NO | yes | -0.11 | -0.11 |
| 2026-07-14 | GS | Tariff | 2/28 | ❌ | 11% | 0.65 | +24 | NO | no | +0.35 | +0.34 |
| 2026-07-14 | JPM | Basel 3 | 0/44 | ❌ | 3% | 0.17 | +80 | NO | no | +0.83 | +0.81 |
| 2026-07-14 | JPM | Buyback | 28/44 | ✅ | 63% | 0.26 | +11 | NO | no | +0.74 | +0.72 |
| 2026-07-14 | JPM | Credit Card | 30/44 | ❌ | 66% | 0.22 | +12 | NO | yes | -0.22 | -0.22 |
| 2026-07-14 | JPM | Fintech | 13/44 | ❌ | 30% | 0.20 | +10 | YES | yes | +0.80 | +0.78 |
| 2026-07-14 | JPM | Fraud | 13/44 | ✅ | 32% | 0.28 | +40 | NO | yes | -0.28 | -0.28 |
| 2026-07-14 | JPM | Geopolitical | 10/44 | ✅ | 26% | 0.23 | +51 | NO | no | +0.77 | +0.75 |
| 2026-07-14 | JPM | Hike | 23/44 | ❌ | 51% | 0.31 | +20 | YES | no | -0.31 | -0.31 |
| 2026-07-14 | JPM | Hiring | 13/44 | ❌ | 30% | 0.24 | +46 | NO | yes | -0.24 | -0.24 |
| 2026-07-14 | JPM | Inflation | 21/44 | ❌ | 47% | 0.33 | +20 | NO | yes | -0.33 | -0.33 |
| 2026-07-14 | JPM | Private Credit | 13/44 | ✅ | 32% | 0.25 | +43 | NO | no | +0.75 | +0.73 |
| 2026-07-14 | JPM | Recession | 23/44 | ✅ | 53% | 0.37 | +16 | YES | no | -0.37 | -0.37 |
| 2026-07-14 | JPM | Regulation | 19/44 | ✅ | 45% | 0.34 | +21 | NO | yes | -0.34 | -0.34 |
| 2026-07-14 | WFC | AI / Artificial Intelligence | 9/28 | ✅ | 36% | 0.16 | +48 | NO | yes | -0.16 | -0.16 |
| 2026-07-14 | WFC | Basel 3 | 0/28 | ❌ | 5% | 0.36 | +59 | NO | no | +0.64 | +0.62 |
| 2026-07-14 | WFC | Delinquency | 5/28 | ❌ | 20% | 0.34 | +46 | NO | yes | -0.34 | -0.34 |
| 2026-07-14 | WFC | Headwind | 17/28 | ❌ | 58% | 0.10 | +48 | YES | no | -0.10 | -0.10 |
| 2026-07-14 | WFC | Inflation | 17/28 | ❌ | 58% | 0.17 | +25 | NO | yes | -0.17 | -0.17 |
| 2026-07-14 | WFC | Iran | 0/28 | ❌ | 5% | 0.73 | +22 | NO | no | +0.27 | +0.26 |
| 2026-07-14 | WFC | Oil | 6/28 | ✅ | 26% | 0.45 | +29 | NO | no | +0.55 | +0.53 |
| 2026-07-14 | WFC | Premier | 12/28 | ✅ | 45% | 0.25 | +30 | NO | yes | -0.25 | -0.25 |
| 2026-07-14 | WFC | Severance | 12/28 | ✅ | 45% | 0.45 | +10 | NO | no | +0.55 | +0.53 |
| 2026-07-14 | WFC | Tariff | 3/28 | ❌ | 14% | 0.63 | +23 | NO | yes | -0.63 | -0.63 |
| 2026-07-14 | WFC | Zelle | 5/28 | ✅ | 23% | 0.50 | +27 | NO | no | +0.50 | +0.48 |
| 2026-07-15 | JNJ | Administration | 16/44 | ❌ | 36% | 0.50 | +14 | NO | no | +0.50 | +0.48 |
| 2026-07-15 | JNJ | Darzalex Faspro | 8/44 | ✅ | 22% | 0.47 | +31 | NO | yes | -0.47 | -0.47 |
| 2026-07-15 | JNJ | Halda Therapeutics | 1/44 | ✅ | 7% | 0.65 | +28 | NO | yes | -0.65 | -0.65 |
| 2026-07-15 | JNJ | Litigation | 40/44 | ❌ | 86% | 0.61 | +25 | YES | yes | +0.39 | +0.38 |
| 2026-07-15 | JNJ | Nipocalimab / Lupus | 18/44 | ❌ | 41% | 0.40 | +19 | NO | no | +0.60 | +0.58 |
| 2026-07-15 | JNJ | Ottava | 18/44 | ✅ | 42% | 0.15 | +43 | NO | yes | -0.15 | -0.15 |
| 2026-07-15 | JNJ | Rybrevant | 16/44 | ✅ | 38% | 0.07 | +55 | NO | yes | -0.07 | -0.07 |
| 2026-07-15 | JNJ | Tariff | 6/44 | ✅ | 17% | 0.23 | +60 | NO | yes | -0.23 | -0.23 |
| 2026-07-15 | JNJ | Trufill | 0/44 | ❌ | 3% | 0.82 | +15 | NO | no | +0.18 | +0.17 |
| 2026-07-15 | JNJ | Vaccine | 22/44 | ❌ | 49% | 0.10 | +39 | YES | no | -0.10 | -0.10 |
| 2026-07-15 | MS | Basel | 13/28 | ✅ | 48% | 0.27 | +25 | NO | no | +0.73 | +0.71 |
| 2026-07-15 | MS | Buyback | 21/28 | ❌ | 70% | 0.44 | +26 | YES | no | -0.44 | -0.44 |
| 2026-07-15 | MS | Investment Grade | 13/28 | ❌ | 45% | 0.42 | +13 | NO | yes | -0.42 | -0.42 |
| 2026-07-15 | MS | Middle East / Iran | 3/28 | ✅ | 17% | 0.64 | +19 | NO | no | +0.36 | +0.35 |
| 2026-07-15 | MS | Oil | 3/28 | ❌ | 14% | 0.67 | +19 | NO | no | +0.33 | +0.32 |
| 2026-07-15 | MS | Private Credit | 15/28 | ✅ | 54% | 0.34 | +12 | NO | no | +0.66 | +0.64 |
| 2026-07-15 | MS | Tailwind | 14/28 | ❌ | 48% | 0.40 | +12 | NO | yes | -0.40 | -0.40 |
| 2026-07-15 | MS | Tokenized / Tokenization | 2/28 | ✅ | 14% | 0.47 | +39 | NO | no | +0.53 | +0.51 |
| 2026-07-15 | MS | Zero Hash | 2/28 | ❌ | 11% | 0.39 | +50 | NO | no | +0.61 | +0.59 |
| 2026-07-15 | PGR | AI / Artificial Intelligence | 7/50 | ✅ | 17% | 0.25 | +58 | NO | yes | -0.25 | -0.25 |
| 2026-07-15 | PGR | Catastrophe | 20/50 | ❌ | 40% | 0.33 | +27 | NO | yes | -0.33 | -0.33 |
| 2026-07-15 | PGR | Headwind | 10/50 | ✅ | 23% | 0.37 | +40 | NO | no | +0.63 | +0.61 |
| 2026-07-15 | PGR | Inflation | 28/50 | ✅ | 56% | 0.22 | +22 | NO | yes | -0.22 | -0.22 |
| 2026-07-15 | PGR | Iran / Middle East | 0/50 | ✅ | 4% | 0.83 | +13 | NO | no | +0.17 | +0.16 |
| 2026-07-15 | PGR | Snapshot | 43/50 | ❌ | 82% | 0.46 | +36 | YES | yes | +0.54 | +0.52 |
| 2026-07-16 | UAL | Holiday | 10/24 | ❌ | 41% | 0.13 | +28 | YES | no | -0.13 | -0.13 |
| 2026-07-16 | UAL | Middle East | 7/24 | ✅ | 34% | 0.53 | +13 | NO | yes | -0.53 | -0.53 |
| 2026-07-16 | UAL | Oil | 3/24 | ✅ | 19% | 0.35 | +46 | NO | yes | -0.35 | -0.35 |
| 2026-07-16 | UAL | Red Eye | 1/24 | ✅ | 12% | 0.60 | +28 | NO | no | +0.40 | +0.39 |
| 2026-07-16 | UAL | Relax Row | 0/24 | ✅ | 9% | 0.66 | +25 | NO | yes | -0.66 | -0.66 |
| 2026-07-16 | UAL | Shutdown / Shut Down | 7/24 | ✅ | 34% | 0.19 | +15 | YES | no | -0.19 | -0.19 |
| 2026-07-16 | UAL | Starlink | 6/24 | ✅ | 30% | 0.07 | +63 | NO | yes | -0.07 | -0.07 |
| 2026-07-16 | UAL | Union | 13/24 | ❌ | 52% | 0.31 | +21 | YES | no | -0.31 | -0.31 |
| 2026-07-16 | UAL | World Cup | 1/24 | ❌ | 9% | 0.31 | +60 | NO | no | +0.69 | +0.67 |
| 2026-07-17 | HOOD | Acquisition | 13/19 | ✅ | 67% | 0.12 | +21 | NO | yes | -0.12 | -0.12 |
| 2026-07-17 | HOOD | Blockchain | 4/19 | ❌ | 24% | 0.51 | +25 | NO | yes | -0.51 | -0.51 |
| 2026-07-17 | HOOD | Concierge | 0/19 | ✅ | 11% | 0.68 | +21 | NO | no | +0.32 | +0.31 |
| 2026-07-17 | HOOD | Convertible | 1/19 | ❌ | 11% | 0.51 | +38 | NO | no | +0.49 | +0.48 |
| 2026-07-17 | HOOD | Credit Card | 13/19 | ✅ | 67% | 0.05 | +28 | NO | yes | -0.05 | -0.05 |
| 2026-07-17 | HOOD | Indonesia | 1/19 | ✅ | 15% | 0.74 | +11 | NO | yes | -0.74 | -0.74 |
| 2026-07-17 | HOOD | Perp / Perpetual | 2/19 | ✅ | 19% | 0.24 | +57 | NO | yes | -0.24 | -0.24 |
| 2026-07-17 | HOOD | Robinhood Chain | 2/19 | ✅ | 19% | 0.11 | +70 | NO | yes | -0.11 | -0.11 |
| 2026-07-17 | HOOD | SIG / Susquehanna | 1/19 | ✅ | 15% | 0.29 | +56 | NO | yes | -0.29 | -0.29 |
| 2026-07-17 | HOOD | Social | 7/19 | ✅ | 41% | 0.08 | +51 | NO | yes | -0.08 | -0.08 |
| 2026-07-17 | HOOD | SpaceX | 3/19 | ❌ | 20% | 0.66 | +14 | NO | yes | -0.66 | -0.66 |
| 2026-07-17 | HOOD | Tokenization | 4/19 | ✅ | 28% | 0.15 | +57 | NO | yes | -0.15 | -0.15 |
| 2026-07-17 | HOOD | UK / United Kingdom | 2/19 | ✅ | 19% | 0.40 | +41 | NO | yes | -0.40 | -0.40 |
| 2026-07-20 | DPZ | AI / Artificial Intelligence | 7/62 | ✅ | 14% | 0.64 | +22 | NO | no | +0.36 | +0.35 |
| 2026-07-20 | DPZ | Best Deal Ever | 4/62 | ✅ | 10% | 0.28 | +62 | NO | yes | -0.28 | -0.28 |
| 2026-07-20 | DPZ | DomOS | 2/62 | ✅ | 7% | 0.46 | +47 | NO | no | +0.54 | +0.52 |
| 2026-07-20 | DPZ | DoorDash (5+ times) | 0/62 | ❌ | 2% | 0.81 | +17 | NO | no | +0.19 | +0.18 |
| 2026-07-20 | DPZ | Emergency Pizza | 7/62 | ❌ | 13% | 0.73 | +14 | NO | no | +0.27 | +0.26 |
| 2026-07-20 | DPZ | Insurance | 24/62 | ✅ | 40% | 0.47 | +13 | NO | no | +0.53 | +0.51 |
| 2026-07-20 | DPZ | Joe Jordan | 1/62 | ❌ | 4% | 0.06 | +90 | NO | yes | -0.06 | -0.06 |
| 2026-07-20 | DPZ | Parmesan | 12/62 | ❌ | 20% | 0.44 | +36 | NO | yes | -0.44 | -0.44 |
| 2026-07-20 | DPZ | Same Store | 6/62 | ✅ | 13% | 0.04 | +83 | NO | yes | -0.04 | -0.04 |
| 2026-07-20 | DPZ | Soccer / World Cup | 4/62 | ❌ | 8% | 0.73 | +19 | NO | yes | -0.73 | -0.73 |
| 2026-07-20 | DPZ | Tailwind | 25/62 | ✅ | 41% | 0.20 | +39 | NO | no | +0.80 | +0.78 |
| 2026-07-21 | ALLY | AI / Artificial Intelligence | 3/20 | ❌ | 19% | 0.36 | +45 | NO | no | +0.64 | +0.62 |
| 2026-07-21 | ALLY | Basel | 3/20 | ✅ | 23% | 0.61 | +16 | NO | no | +0.39 | +0.38 |
| 2026-07-21 | ALLY | EV / Electric | 11/20 | ❌ | 52% | 0.31 | +21 | YES | yes | +0.69 | +0.67 |
| 2026-07-21 | ALLY | Oil | 0/20 | ✅ | 10% | 0.45 | +45 | NO | yes | -0.45 | -0.45 |
| 2026-07-21 | ALLY | Rate Cut / Cut Rate | 12/20 | ❌ | 56% | 0.36 | +20 | YES | no | -0.36 | -0.36 |
| 2026-07-21 | ALLY | Tailwind | 20/20 | ✅ | 93% | 0.79 | +14 | YES | no | -0.79 | -0.79 |
| 2026-07-21 | ALLY | Tariff | 4/20 | ❌ | 23% | 0.67 | +10 | NO | yes | -0.67 | -0.67 |
| 2026-07-22 | ALK | Amazon | 5/18 | ✅ | 34% | 0.39 | +27 | NO | yes | -0.39 | -0.39 |
| 2026-07-22 | ALK | Cargo | 6/18 | ✅ | 38% | 0.17 | +45 | NO | yes | -0.17 | -0.17 |
| 2026-07-22 | ALK | Iran / Middle East | 0/18 | ❌ | 7% | 0.81 | +12 | NO | no | +0.19 | +0.18 |
| 2026-07-22 | ALK | Starlink | 1/18 | ✅ | 16% | 0.12 | +72 | NO | yes | -0.12 | -0.12 |
| 2026-07-22 | ALK | Tailwind | 15/18 | ❌ | 74% | 0.39 | +35 | YES | yes | +0.61 | +0.59 |
| 2026-07-22 | GEV | Administration | 3/8 | ❌ | 37% | 0.18 | +19 | YES | yes | +0.82 | +0.80 |
| 2026-07-22 | GEV | Blade | 7/8 | ❌ | 69% | 0.21 | +48 | YES | no | -0.21 | -0.21 |
| 2026-07-22 | GEV | China | 3/8 | ✅ | 45% | 0.21 | +24 | YES | yes | +0.79 | +0.77 |
| 2026-07-22 | GEV | Iran / Middle East | 5/8 | ✅ | 61% | 0.23 | +16 | NO | no | +0.77 | +0.75 |
| 2026-07-22 | GEV | Nuclear | 6/8 | ✅ | 69% | 0.06 | +25 | NO | yes | -0.06 | -0.06 |
| 2026-07-22 | GEV | Oil | 1/8 | ❌ | 21% | 0.05 | +16 | YES | no | -0.05 | -0.05 |
| 2026-07-22 | GEV | Robotic / Robotics | 4/8 | ✅ | 53% | 0.09 | +38 | NO | yes | -0.09 | -0.09 |
| 2026-07-22 | GEV | Tariff | 4/8 | ✅ | 53% | 0.12 | +35 | NO | yes | -0.12 | -0.12 |
| 2026-07-22 | GEV | Vietnam / India | 4/8 | ✅ | 53% | 0.17 | +30 | NO | no | +0.83 | +0.81 |
| 2026-07-22 | GOOGL | Autonomous | 25/61 | ✅ | 42% | 0.24 | +34 | NO | no | +0.76 | +0.74 |
| 2026-07-22 | GOOGL | Gemini 3 | 2/61 | ✅ | 7% | 0.25 | +68 | NO | no | +0.75 | +0.73 |
| 2026-07-22 | GOOGL | Ironwood | 3/61 | ✅ | 8% | 0.75 | +17 | NO | no | +0.25 | +0.24 |
| 2026-07-22 | GOOGL | Nano Banana | 2/61 | ✅ | 7% | 0.45 | +48 | NO | no | +0.55 | +0.53 |
| 2026-07-22 | GOOGL | Nvidia | 12/61 | ✅ | 22% | 0.32 | +46 | NO | yes | -0.32 | -0.32 |
| 2026-07-22 | GOOGL | Privacy | 26/61 | ❌ | 42% | 0.18 | +24 | YES | no | -0.18 | -0.18 |
| 2026-07-22 | GOOGL | Regulator / Regulation / Regulatory | 20/61 | ❌ | 33% | 0.16 | +17 | YES | no | -0.16 | -0.16 |
| 2026-07-22 | GOOGL | Search Advertising / Search Ad | 41/61 | ❌ | 65% | 0.30 | +35 | YES | yes | +0.70 | +0.68 |
| 2026-07-22 | GOOGL | SpaceX | 0/61 | ❌ | 2% | 0.79 | +19 | NO | no | +0.21 | +0.20 |
| 2026-07-22 | GOOGL | Tailwind | 19/61 | ✅ | 33% | 0.29 | +38 | NO | yes | -0.29 | -0.29 |
| 2026-07-22 | GOOGL | Wiz | 1/61 | ✅ | 5% | 0.32 | +63 | NO | yes | -0.32 | -0.32 |
| 2026-07-22 | GOOGL | Youtube Shorts | 18/61 | ❌ | 30% | 0.59 | +11 | NO | no | +0.41 | +0.40 |
| 2026-07-22 | TSLA | Affordable | 37/62 | ✅ | 60% | 0.29 | +11 | NO | yes | -0.29 | -0.29 |
| 2026-07-22 | TSLA | Berlin | 20/62 | ✅ | 34% | 0.20 | +46 | NO | no | +0.80 | +0.78 |
| 2026-07-22 | TSLA | China | 51/62 | ✅ | 81% | 0.08 | +11 | NO | no | +0.92 | +0.89 |
| 2026-07-22 | TSLA | Competition | 13/62 | ✅ | 23% | 0.30 | +47 | NO | yes | -0.30 | -0.30 |
| 2026-07-22 | TSLA | Cybercab | 6/62 | ✅ | 13% | 0.03 | +84 | NO | yes | -0.03 | -0.03 |
| 2026-07-22 | TSLA | Gigafactory | 33/62 | ❌ | 52% | 0.29 | +23 | YES | no | -0.29 | -0.29 |
| 2026-07-22 | TSLA | Grok (3+ times) | 0/62 | ❌ | 2% | 0.42 | +56 | NO | yes | -0.42 | -0.42 |
| 2026-07-22 | TSLA | Intel | 5/62 | ✅ | 11% | 0.69 | +20 | NO | no | +0.31 | +0.30 |
| 2026-07-22 | TSLA | Iran / Middle East | 0/62 | ❌ | 2% | 0.86 | +12 | NO | no | +0.14 | +0.14 |
| 2026-07-22 | TSLA | Megapack 3 | 2/62 | ✅ | 7% | 0.22 | +71 | NO | yes | -0.22 | -0.22 |
| 2026-07-22 | TSLA | Merge / Merger | 1/62 | ❌ | 4% | 0.67 | +29 | NO | no | +0.33 | +0.32 |
| 2026-07-22 | TSLA | Miami | 1/62 | ❌ | 4% | 0.15 | +81 | NO | no | +0.85 | +0.82 |
| 2026-07-22 | TSLA | Powerwall | 32/62 | ❌ | 51% | 0.39 | +10 | NO | no | +0.61 | +0.59 |
| 2026-07-22 | TSLA | Robotaxi | 21/62 | ✅ | 35% | 0.01 | +64 | NO | yes | -0.01 | -0.01 |
| 2026-07-22 | TSLA | Safety Monitor | 1/62 | ❌ | 4% | 0.80 | +16 | NO | yes | -0.80 | -0.80 |
| 2026-07-22 | TSLA | Supercharger / Super Charger | 30/62 | ✅ | 49% | 0.34 | +15 | YES | yes | +0.66 | +0.64 |
| 2026-07-22 | TSLA | Semi | 32/62 | ✅ | 52% | 0.08 | +40 | NO | yes | -0.08 | -0.08 |
| 2026-07-22 | TSLA | Six-Seater / Six-Seat | 0/62 | ❌ | 2% | 0.64 | +34 | NO | no | +0.36 | +0.35 |
| 2026-07-22 | TSLA | SpaceX / xAI | 18/62 | ✅ | 31% | 0.06 | +63 | NO | yes | -0.06 | -0.06 |
| 2026-07-22 | TSLA | Terafab | 1/62 | ✅ | 5% | 0.10 | +85 | NO | yes | -0.10 | -0.10 |
| 2026-07-22 | TSLA | Tariff | 13/62 | ✅ | 23% | 0.15 | +62 | NO | yes | -0.15 | -0.15 |
| 2026-07-23 | AAL | AT&T | 4/24 | ✅ | 23% | 0.35 | +42 | NO | no | +0.65 | +0.63 |
| 2026-07-23 | AAL | ATC | 4/24 | ❌ | 20% | 0.07 | +13 | YES | no | -0.07 | -0.07 |
| 2026-07-23 | AAL | Basic Economy | 4/24 | ✅ | 23% | 0.42 | +35 | NO | yes | -0.42 | -0.42 |
| 2026-07-23 | AAL | Centennial | 1/24 | ✅ | 12% | 0.35 | +53 | NO | no | +0.65 | +0.63 |
| 2026-07-23 | AAL | Chicago / O’Hare | 17/24 | ✅ | 69% | 0.13 | +18 | NO | yes | -0.13 | -0.13 |
| 2026-07-23 | AAL | Holiday | 16/24 | ❌ | 62% | 0.28 | +34 | YES | no | -0.28 | -0.28 |
| 2026-07-23 | AAL | Shutdown / Shut Down | 5/24 | ❌ | 23% | 0.07 | +16 | YES | no | -0.07 | -0.07 |
| 2026-07-23 | AAL | Tariff | 2/24 | ❌ | 13% | 0.72 | +15 | NO | no | +0.28 | +0.27 |
| 2026-07-23 | AAL | Weather | 11/24 | ✅ | 48% | 0.41 | +11 | NO | yes | -0.41 | -0.41 |
| 2026-07-23 | AAL | World Cup | 1/24 | ✅ | 12% | 0.41 | +47 | NO | no | +0.59 | +0.57 |
| 2026-07-23 | INTC | Arizona | 17/63 | ❌ | 28% | 0.44 | +28 | NO | no | +0.56 | +0.54 |
| 2026-07-23 | INTC | Client Computing | 23/63 | ❌ | 37% | 0.20 | +17 | YES | yes | +0.80 | +0.78 |
| 2026-07-23 | INTC | Desktop | 46/63 | ❌ | 71% | 0.39 | +32 | YES | no | -0.39 | -0.39 |
| 2026-07-23 | INTC | Dividend | 49/63 | ❌ | 75% | 0.09 | +66 | YES | no | -0.09 | -0.09 |
| 2026-07-23 | INTC | Foundry | 37/63 | ✅ | 59% | 0.01 | +40 | NO | yes | -0.01 | -0.01 |
| 2026-07-23 | INTC | Government | 31/63 | ❌ | 48% | 0.21 | +31 | NO | no | +0.79 | +0.77 |
| 2026-07-23 | INTC | Mobileye | 35/63 | ✅ | 56% | 0.09 | +35 | NO | no | +0.91 | +0.88 |
| 2026-07-23 | INTC | Nvidia | 8/63 | ✅ | 15% | 0.20 | +65 | NO | no | +0.80 | +0.78 |
| 2026-07-23 | INTC | Panther Lake / 18A | 18/63 | ✅ | 30% | 0.02 | +68 | NO | yes | -0.02 | -0.02 |
| 2026-07-23 | INTC | Security | 34/63 | ✅ | 54% | 0.17 | +29 | NO | yes | -0.17 | -0.17 |
| 2026-07-23 | INTC | Ultra 3 / Ultra Series 3 | 1/63 | ✅ | 5% | 0.43 | +52 | NO | no | +0.57 | +0.55 |
| 2026-07-23 | LMT | NASA | 28/64 | ✅ | 45% | 0.03 | +42 | YES | yes | +0.97 | +0.94 |
| 2026-07-23 | LMT | Sikorsky | 42/64 | ✅ | 65% | 0.10 | +25 | NO | yes | -0.10 | -0.10 |
| 2026-07-24 | AXP | Basel | 8/58 | ✅ | 17% | 0.06 | +11 | YES | no | -0.06 | -0.06 |
| 2026-07-24 | AXP | Currency | 15/58 | ❌ | 27% | 0.14 | +13 | YES | no | -0.14 | -0.14 |
| 2026-07-24 | AXP | Lounge | 29/58 | ✅ | 51% | 0.23 | +26 | NO | yes | -0.23 | -0.23 |
| 2026-07-24 | AXP | Millennial | 27/58 | ✅ | 47% | 0.12 | +41 | NO | yes | -0.12 | -0.12 |
| 2026-07-24 | AXP | NFL | 0/58 | ✅ | 4% | 0.69 | +27 | NO | yes | -0.69 | -0.69 |
| 2026-07-24 | AXP | OpenAI / ChatGPT | 0/58 | ✅ | 4% | 0.81 | +15 | NO | yes | -0.81 | -0.81 |
| 2026-07-24 | AXP | Regulation / Regulatory | 43/58 | ✅ | 73% | 0.28 | +45 | YES | no | -0.28 | -0.28 |
| 2026-07-24 | AXP | Spending Trend | 24/58 | ❌ | 41% | 0.15 | +26 | YES | no | -0.15 | -0.15 |
| 2026-07-24 | BULL | BlackRock | 3/4 | ❌ | 53% | 0.31 | +22 | YES | no | -0.31 | -0.31 |
| 2026-07-24 | BULL | Kalshi | 3/4 | ❌ | 53% | 0.28 | +25 | YES | yes | +0.72 | +0.70 |
| 2026-07-24 | BULL | MCP | 0/4 | ✅ | 33% | 0.27 | +40 | NO | yes | -0.27 | -0.27 |
| 2026-07-24 | BULL | MiCAR | 0/4 | ❌ | 19% | 0.52 | +29 | NO | no | +0.48 | +0.47 |
| 2026-07-24 | BULL | PDT / Pattern Day Trader | 0/4 | ✅ | 33% | 0.29 | +38 | NO | yes | -0.29 | -0.29 |
| 2026-07-24 | BULL | Self Clearing | 0/4 | ❌ | 19% | 0.55 | +26 | NO | no | +0.45 | +0.44 |
| 2026-07-24 | BULL | Tailwind | 2/4 | ✅ | 56% | 0.39 | +17 | YES | yes | +0.61 | +0.59 |
| 2026-07-24 | BULL | Tampa Bay | 0/4 | ✅ | 33% | 0.21 | +12 | YES | yes | +0.79 | +0.77 |
| 2026-07-24 | BULL | Thailand | 1/4 | ❌ | 30% | 0.39 | +31 | NO | yes | -0.39 | -0.39 |
| 2026-07-24 | BULL | Token / Tokenized | 2/4 | ❌ | 41% | 0.24 | +17 | YES | yes | +0.76 | +0.74 |
| 2026-07-24 | BULL | Vega (5+ times) | 0/4 | ❌ | 19% | 0.60 | +21 | NO | yes | -0.60 | -0.60 |
| 2026-07-24 | VZ | 5G | 27/28 | ✅ | 92% | 0.71 | +21 | YES | no | -0.71 | -0.71 |
| 2026-07-24 | VZ | C-Band | 23/28 | ❌ | 76% | 0.60 | +16 | YES | no | -0.60 | -0.60 |
| 2026-07-24 | VZ | Home / MyHome | 26/28 | ✅ | 88% | 0.62 | +26 | YES | yes | +0.38 | +0.37 |
| 2026-07-24 | VZ | Rural | 10/28 | ❌ | 36% | 0.19 | +17 | YES | yes | +0.81 | +0.79 |
| 2026-07-24 | VZ | Spectrum | 27/28 | ✅ | 92% | 0.78 | +14 | YES | yes | +0.22 | +0.21 |
| 2026-07-24 | VZ | Starry | 2/28 | ✅ | 14% | 0.59 | +27 | NO | no | +0.41 | +0.40 |
| 2026-07-24 | VZ | Synergy | 3/28 | ❌ | 14% | 0.26 | +60 | NO | yes | -0.26 | -0.26 |
| 2026-07-24 | VZ | Tailwind | 13/28 | ✅ | 48% | 0.38 | +10 | YES | yes | +0.62 | +0.60 |
| 2026-07-28 | BA | Airbus | 24/46 | ❌ | 51% | 0.18 | +33 | YES | no | -0.18 | -0.18 |
| 2026-07-28 | BA | Dividend | 29/46 | ❌ | 61% | 0.17 | +44 | YES | no | -0.17 | -0.17 |
| 2026-07-28 | BA | F-47 | 2/46 | ✅ | 9% | 0.40 | +51 | NO | no | +0.60 | +0.58 |
| 2026-07-28 | BA | Iran | 5/46 | ✅ | 15% | 0.71 | +14 | NO | no | +0.29 | +0.28 |
| 2026-07-28 | BA | Moon | 3/46 | ❌ | 9% | 0.78 | +13 | NO | no | +0.22 | +0.21 |
| 2026-07-28 | BA | NASA | 26/46 | ✅ | 57% | 0.29 | +28 | YES | yes | +0.71 | +0.69 |
| 2026-07-28 | BA | Philippine Airlines | 0/46 | ❌ | 3% | 0.58 | +39 | NO | no | +0.42 | +0.41 |
| 2026-07-28 | BA | Space | 44/46 | ✅ | 93% | 0.76 | +17 | YES | yes | +0.24 | +0.23 |
| 2026-07-28 | BA | Tariff | 5/46 | ❌ | 13% | 0.58 | +29 | NO | no | +0.42 | +0.41 |
| 2026-07-28 | F | AI / Artificial Intelligence | 15/29 | ✅ | 53% | 0.37 | +10 | NO | no | +0.63 | +0.61 |
| 2026-07-28 | F | Apple | 6/29 | ❌ | 23% | 0.42 | +35 | NO | yes | -0.42 | -0.42 |
| 2026-07-28 | F | Autonomy / Autonomous | 24/29 | ✅ | 80% | 0.22 | +58 | YES | no | -0.22 | -0.22 |
| 2026-07-28 | F | China | 27/29 | ✅ | 89% | 0.62 | +27 | YES | no | -0.62 | -0.62 |
| 2026-07-28 | F | Electric vehicle / EV | 23/29 | ✅ | 77% | 0.05 | +18 | NO | yes | -0.05 | -0.05 |
| 2026-07-28 | F | Geely | 0/29 | ❌ | 5% | 0.60 | +35 | NO | yes | -0.60 | -0.60 |
| 2026-07-28 | F | Oakville | 3/29 | ✅ | 16% | 0.56 | +28 | NO | yes | -0.56 | -0.56 |
| 2026-07-28 | F | Skunk Works | 0/29 | ✅ | 7% | 0.65 | +28 | NO | no | +0.35 | +0.34 |
| 2026-07-28 | F | Subsidy / Subsidized | 0/29 | ❌ | 5% | 0.79 | +16 | NO | no | +0.21 | +0.20 |
| 2026-07-28 | F | Tailwind | 12/29 | ❌ | 41% | 0.24 | +17 | YES | yes | +0.76 | +0.74 |
| 2026-07-28 | F | Tariff | 11/29 | ✅ | 41% | 0.21 | +38 | NO | yes | -0.21 | -0.21 |
| 2026-07-28 | PYPL | Ads ID | 0/42 | ❌ | 3% | 0.85 | +12 | NO | no | +0.15 | +0.15 |
| 2026-07-28 | PYPL | Agentic Commerce | 4/42 | ❌ | 12% | 0.48 | +40 | NO | yes | -0.48 | -0.48 |
| 2026-07-28 | PYPL | Anthropic / Claude | 1/42 | ❌ | 5% | 0.77 | +18 | NO | no | +0.23 | +0.22 |
| 2026-07-28 | PYPL | Biometric | 7/42 | ✅ | 20% | 0.34 | +46 | NO | no | +0.66 | +0.64 |
| 2026-07-28 | PYPL | Braintree | 35/42 | ✅ | 81% | 0.66 | +15 | YES | yes | +0.34 | +0.33 |
| 2026-07-28 | PYPL | E-Commerce | 36/42 | ✅ | 83% | 0.41 | +42 | YES | yes | +0.59 | +0.57 |
| 2026-07-28 | PYPL | European Payments Council / EPC | 0/42 | ❌ | 3% | 0.86 | +11 | NO | no | +0.14 | +0.14 |
| 2026-07-28 | PYPL | Google | 18/42 | ❌ | 42% | 0.22 | +20 | YES | no | -0.22 | -0.22 |
| 2026-07-28 | PYPL | Regulation / Regulator / Regulatory | 22/42 | ❌ | 51% | 0.25 | +26 | YES | no | -0.25 | -0.25 |
| 2026-07-28 | PYPL | Stablecoin / Stable Coin | 5/42 | ✅ | 16% | 0.35 | +49 | NO | no | +0.65 | +0.63 |
| 2026-07-28 | PYPL | Stripe | 2/42 | ❌ | 8% | 0.72 | +20 | NO | no | +0.28 | +0.27 |
| 2026-07-29 | CMG | Al Pastor | 12/64 | ✅ | 21% | 0.28 | +51 | NO | yes | -0.28 | -0.28 |
| 2026-07-29 | CMG | Chipotle Kitchen | 2/64 | ✅ | 6% | 0.27 | +67 | NO | yes | -0.27 | -0.27 |
| 2026-07-29 | CMG | Chipotle Lane / Chipotlane | 28/64 | ❌ | 43% | 0.10 | +47 | NO | yes | -0.10 | -0.10 |
| 2026-07-29 | CMG | Cilantro Lime | 2/64 | ✅ | 6% | 0.29 | +65 | NO | yes | -0.29 | -0.29 |
| 2026-07-29 | CMG | Honey Chicken | 4/64 | ✅ | 9% | 0.22 | +69 | NO | yes | -0.22 | -0.22 |
| 2026-07-29 | CMG | Iran | 0/64 | ✅ | 3% | 0.83 | +14 | NO | no | +0.17 | +0.16 |
| 2026-07-29 | CMG | Tariff | 5/64 | ❌ | 10% | 0.69 | +21 | NO | no | +0.31 | +0.30 |
| 2026-07-29 | CVNA | AI / Artificial Intelligence | 7/35 | ✅ | 24% | 0.35 | +41 | NO | yes | -0.35 | -0.35 |
| 2026-07-29 | CVNA | Ally | 17/35 | ❌ | 47% | 0.31 | +16 | YES | no | -0.31 | -0.31 |
| 2026-07-29 | CVNA | Auction | 29/35 | ✅ | 80% | 0.61 | +19 | YES | no | -0.61 | -0.61 |
| 2026-07-29 | CVNA | Iran / Middle East | 0/35 | ✅ | 6% | 0.76 | +18 | NO | no | +0.24 | +0.23 |
| 2026-07-29 | CVNA | Market Share | 31/35 | ✅ | 85% | 0.69 | +16 | YES | yes | +0.31 | +0.30 |
| 2026-07-29 | CVNA | Same Day | 2/35 | ❌ | 9% | 0.77 | +14 | NO | no | +0.23 | +0.22 |
| 2026-07-29 | CVNA | Sebastian | 16/35 | ❌ | 45% | 0.23 | +22 | YES | yes | +0.77 | +0.75 |
| 2026-07-29 | CVNA | Tariff | 4/35 | ✅ | 16% | 0.51 | +33 | NO | yes | -0.51 | -0.51 |
| 2026-07-29 | META | Advertising | 55/55 | ❌ | 96% | 0.80 | +16 | YES | no | -0.80 | -0.80 |
| 2026-07-29 | META | Age Verification | 0/55 | ❌ | 3% | 0.85 | +12 | NO | no | +0.15 | +0.15 |
| 2026-07-29 | META | Algorithm | 13/55 | ✅ | 26% | 0.52 | +22 | NO | no | +0.48 | +0.47 |
| 2026-07-29 | META | Cloud | 10/55 | ✅ | 21% | 0.11 | +68 | NO | yes | -0.11 | -0.11 |
| 2026-07-29 | META | Dividend | 12/55 | ❌ | 23% | 0.66 | +11 | NO | no | +0.34 | +0.33 |
| 2026-07-29 | META | Hiring | 39/55 | ✅ | 70% | 0.15 | +15 | NO | no | +0.85 | +0.82 |
| 2026-07-29 | META | Hyperion | 1/55 | ❌ | 4% | 0.61 | +35 | NO | no | +0.39 | +0.38 |
| 2026-07-29 | META | Oakley | 3/55 | ✅ | 9% | 0.38 | +53 | NO | no | +0.62 | +0.60 |
| 2026-07-29 | META | Ray-Ban | 12/55 | ✅ | 24% | 0.26 | +50 | NO | no | +0.74 | +0.72 |
| 2026-07-29 | META | Silicon | 6/55 | ✅ | 14% | 0.39 | +47 | NO | yes | -0.39 | -0.39 |
| 2026-07-29 | MSFT | AMD / Advanced Micro Devices | 9/63 | ✅ | 17% | 0.38 | +45 | NO | yes | -0.38 | -0.38 |
| 2026-07-29 | MSFT | Anthropic | 2/63 | ✅ | 7% | 0.49 | +44 | NO | yes | -0.49 | -0.49 |
| 2026-07-29 | MSFT | Cybersecurity | 15/63 | ✅ | 26% | 0.62 | +12 | NO | no | +0.38 | +0.37 |
| 2026-07-29 | MSFT | Foundry | 5/63 | ✅ | 11% | 0.17 | +72 | NO | yes | -0.17 | -0.17 |
| 2026-07-29 | MSFT | Frontier | 13/63 | ✅ | 23% | 0.51 | +26 | NO | yes | -0.51 | -0.51 |
| 2026-07-29 | MSFT | GitHub | 31/63 | ✅ | 50% | 0.07 | +43 | NO | yes | -0.07 | -0.07 |
| 2026-07-29 | MSFT | Helios | 0/63 | ❌ | 2% | 0.66 | +32 | NO | yes | -0.66 | -0.66 |
| 2026-07-29 | MSFT | Layoff / Job Cuts | 0/63 | ❌ | 2% | 0.86 | +12 | NO | no | +0.14 | +0.14 |
| 2026-07-29 | MSFT | Maia | 5/63 | ✅ | 11% | 0.46 | +43 | NO | yes | -0.46 | -0.46 |
| 2026-07-29 | MSFT | Memory | 13/63 | ✅ | 23% | 0.34 | +43 | NO | yes | -0.34 | -0.34 |
| 2026-07-29 | MSFT | OpenAI | 23/63 | ✅ | 38% | 0.06 | +56 | NO | yes | -0.06 | -0.06 |
| 2026-07-29 | MSFT | Phi | 5/63 | ❌ | 10% | 0.76 | +14 | NO | no | +0.24 | +0.23 |
| 2026-07-29 | MSFT | Windows 11 | 19/63 | ❌ | 31% | 0.58 | +11 | NO | no | +0.42 | +0.41 |
| 2026-07-29 | SBUX | Boyu | 1/45 | ✅ | 7% | 0.38 | +55 | NO | no | +0.62 | +0.60 |
| 2026-07-29 | SBUX | Canada | 18/45 | ❌ | 40% | 0.14 | +26 | YES | yes | +0.86 | +0.83 |
| 2026-07-29 | SBUX | Comparable Sales | 12/45 | ✅ | 29% | 0.52 | +19 | NO | yes | -0.52 | -0.52 |
| 2026-07-29 | SBUX | Frappuccino | 23/45 | ❌ | 50% | 0.28 | +22 | YES | yes | +0.72 | +0.70 |
| 2026-07-29 | SBUX | Horchata | 1/45 | ❌ | 5% | 0.83 | +12 | NO | no | +0.17 | +0.16 |
| 2026-07-29 | SBUX | Loyalty | 36/45 | ✅ | 78% | 0.60 | +18 | YES | yes | +0.40 | +0.39 |
| 2026-07-29 | SBUX | Matcha | 5/45 | ✅ | 15% | 0.61 | +24 | NO | yes | -0.61 | -0.61 |
| 2026-07-29 | SBUX | Non Dairy | 0/45 | ❌ | 3% | 0.76 | +21 | NO | no | +0.24 | +0.23 |
| 2026-07-29 | SBUX | Promotion | 26/45 | ❌ | 56% | 0.40 | +16 | YES | no | -0.40 | -0.40 |
| 2026-07-29 | SBUX | Protein | 11/45 | ✅ | 27% | 0.13 | +60 | NO | no | +0.87 | +0.84 |
| 2026-07-29 | SBUX | Smart Queue / SmartQ | 3/45 | ✅ | 11% | 0.36 | +53 | NO | yes | -0.36 | -0.36 |
| 2026-07-29 | SBUX | S'more | 1/45 | ❌ | 5% | 0.73 | +22 | NO | yes | -0.73 | -0.73 |
| 2026-07-29 | SBUX | Tariff | 4/45 | ✅ | 13% | 0.09 | +78 | NO | yes | -0.09 | -0.09 |
| 2026-07-29 | WING | AI / Artificial Intelligence | 11/32 | ✅ | 37% | 0.46 | +17 | NO | yes | -0.46 | -0.46 |
| 2026-07-29 | WING | India (2+ times) | 0/32 | ❌ | 4% | 0.42 | +54 | NO | no | +0.58 | +0.56 |
| 2026-07-29 | WING | NFL / NBA | 14/32 | ❌ | 43% | 0.31 | +12 | YES | yes | +0.69 | +0.67 |
| 2026-07-29 | WING | Share Repurchase | 10/32 | ✅ | 34% | 0.09 | +57 | NO | yes | -0.09 | -0.09 |
| 2026-07-29 | WING | Tajín | 0/32 | ❌ | 4% | 0.47 | +49 | NO | no | +0.53 | +0.51 |
| 2026-07-29 | WING | Tender | 14/32 | ✅ | 45% | 0.27 | +28 | NO | no | +0.73 | +0.71 |
| 2026-07-29 | WING | World Cup | 2/32 | ❌ | 10% | 0.51 | +39 | NO | yes | -0.51 | -0.51 |
| 2026-07-30 | AAPL | Broadcom | 0/60 | ❌ | 2% | 0.37 | +61 | NO | yes | -0.37 | -0.37 |
| 2026-07-30 | AAPL | Formula 1 / F1 | 5/60 | ❌ | 10% | 0.31 | +59 | NO | yes | -0.31 | -0.31 |
| 2026-07-30 | AAPL | Gemini | 1/60 | ❌ | 4% | 0.62 | +34 | NO | no | +0.38 | +0.37 |
| 2026-07-30 | AAPL | Liquid Glass | 2/60 | ❌ | 5% | 0.84 | +11 | NO | no | +0.16 | +0.16 |
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
| 2026-07-30 | AMZN | Live Sports | 15/63 | ✅ | 26% | 0.28 | +46 | NO | yes | -0.28 | -0.28 |
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
| 2026-07-30 | AMZN | Third Party Seller | 1/63 | ❌ | 4% | 0.26 | +70 | NO | no | +0.74 | +0.72 |
| 2026-07-30 | AMZN | Trainium | 12/63 | ✅ | 21% | 0.04 | +75 | NO | yes | -0.04 | -0.04 |
| 2026-07-30 | AMZN | World Cup | 0/63 | ❌ | 2% | 0.66 | +32 | NO | no | +0.34 | +0.33 |
| 2026-07-30 | AMZN | Zoox / Robotaxi | 3/63 | ✅ | 8% | 0.52 | +40 | NO | no | +0.48 | +0.47 |
| 2026-07-30 | RDDT | Developer | 6/8 | ✅ | 69% | 0.43 | +26 | YES | yes | +0.57 | +0.55 |
| 2026-07-30 | RDDT | Game / Gaming | 6/8 | ❌ | 61% | 0.43 | +18 | YES | yes | +0.57 | +0.55 |
| 2026-07-30 | RDDT | Google (3+ times) | 0/8 | ❌ | 13% | 0.56 | +31 | NO | no | +0.44 | +0.43 |
| 2026-07-30 | RDDT | Headwind | 3/8 | ❌ | 37% | 0.30 | +33 | NO | yes | -0.30 | -0.30 |
| 2026-07-30 | RDDT | OpenAI / Open AI | 5/8 | ✅ | 61% | 0.43 | +18 | YES | no | -0.43 | -0.43 |
| 2026-07-30 | RDDT | Shopify | 0/8 | ✅ | 21% | 0.24 | +55 | NO | yes | -0.24 | -0.24 |
| 2026-07-30 | RDDT | Smartly | 3/8 | ❌ | 37% | 0.24 | +13 | YES | no | -0.24 | -0.24 |
| 2026-07-30 | RDDT | Tailwind | 5/8 | ✅ | 61% | 0.31 | +30 | YES | yes | +0.69 | +0.67 |
| 2026-07-30 | YUM | AI / Artificial Intelligence | 17/24 | ✅ | 69% | 0.09 | +22 | NO | yes | -0.09 | -0.09 |
| 2026-07-30 | YUM | Beef | 6/24 | ✅ | 30% | 0.37 | +33 | NO | no | +0.63 | +0.61 |
| 2026-07-30 | YUM | Byte | 4/24 | ✅ | 23% | 0.13 | +64 | NO | yes | -0.13 | -0.13 |
| 2026-07-30 | YUM | Cyclospora / Cyclosporiasis | 0/24 | ❌ | 5% | 0.53 | +42 | NO | no | +0.47 | +0.46 |
| 2026-07-30 | YUM | Food Safety | 4/24 | ❌ | 20% | 0.47 | +33 | NO | yes | -0.47 | -0.47 |
| 2026-07-30 | YUM | Lettuce | 0/24 | ❌ | 5% | 0.59 | +36 | NO | no | +0.41 | +0.40 |
| 2026-07-30 | YUM | LongRange Capital | 0/24 | ❌ | 5% | 0.49 | +46 | NO | yes | -0.49 | -0.49 |
| 2026-07-30 | YUM | Luxe / Luxe Value Menu | 6/24 | ✅ | 30% | 0.45 | +25 | NO | yes | -0.45 | -0.45 |
| 2026-07-30 | YUM | Outbreak / Illness | 4/24 | ❌ | 20% | 0.57 | +23 | NO | no | +0.43 | +0.42 |
| 2026-07-30 | YUM | Recall / Recalled | 9/24 | ✅ | 41% | 0.10 | +31 | YES | no | -0.10 | -0.10 |
| 2026-07-30 | YUM | Saucy / Sauce | 6/24 | ✅ | 30% | 0.28 | +42 | NO | yes | -0.28 | -0.28 |
| 2026-07-30 | YUM | Taylor Farms | 0/24 | ❌ | 5% | 0.73 | +22 | NO | no | +0.27 | +0.26 |
| 2026-08-03 | GRAB | Buyback / Buy Back | 6/20 | ✅ | 35% | 0.30 | +35 | NO | yes | -0.30 | -0.30 |
| 2026-08-03 | GRAB | Commission | 9/20 | ✅ | 47% | 0.31 | +22 | NO | yes | -0.31 | -0.31 |
| 2026-08-03 | GRAB | Delivery Hero | 1/20 | ❌ | 10% | 0.77 | +13 | NO | yes | -0.77 | -0.77 |
| 2026-08-03 | GRAB | Foodpanda | 3/20 | ✅ | 23% | 0.35 | +42 | NO | yes | -0.35 | -0.35 |
| 2026-08-03 | GRAB | GrabMart | 10/20 | ✅ | 52% | 0.20 | +28 | NO | yes | -0.20 | -0.20 |
| 2026-08-03 | GRAB | Headwind | 8/20 | ✅ | 43% | 0.39 | +18 | NO | yes | -0.39 | -0.39 |
| 2026-08-03 | GRAB | Iran / Middle East | 0/20 | ✅ | 10% | 0.56 | +34 | NO | no | +0.44 | +0.43 |
| 2026-08-03 | GRAB | MAI | 1/20 | ✅ | 14% | 0.44 | +42 | NO | no | +0.56 | +0.54 |
| 2026-08-03 | GRAB | Robot / Robotic / Robotics | 2/20 | ❌ | 15% | 0.68 | +17 | NO | no | +0.32 | +0.31 |
| 2026-08-03 | GRAB | Stash | 1/20 | ❌ | 10% | 0.38 | +52 | NO | yes | -0.38 | -0.38 |
| 2026-08-03 | GRAB | Superbank | 4/20 | ❌ | 23% | 0.06 | +71 | NO | yes | -0.06 | -0.06 |
| 2026-08-03 | GRAB | Tailwind | 6/20 | ❌ | 31% | 0.14 | +17 | YES | no | -0.14 | -0.14 |
| 2026-08-03 | GRAB | WeRide | 2/20 | ✅ | 18% | 0.35 | +47 | NO | no | +0.65 | +0.63 |
| 2026-08-03 | PLTR | Anthropic / Claude | 0/22 | ✅ | 9% | 0.76 | +15 | NO | no | +0.24 | +0.23 |
| 2026-08-03 | PLTR | Automotive | 10/22 | ❌ | 44% | 0.17 | +27 | YES | no | -0.17 | -0.17 |
| 2026-08-03 | PLTR | Healthcare | 18/22 | ❌ | 75% | 0.50 | +25 | YES | no | -0.50 | -0.50 |
| 2026-08-03 | PLTR | ICE / Immigration and Customs Enforcement | 1/22 | ❌ | 10% | 0.77 | +13 | NO | no | +0.23 | +0.22 |
| 2026-08-03 | PLTR | International | 20/22 | ✅ | 86% | 0.04 | +10 | NO | yes | -0.04 | -0.04 |
| 2026-08-03 | PLTR | Iran / Iranian | 2/22 | ❌ | 13% | 0.74 | +13 | NO | no | +0.26 | +0.25 |
| 2026-08-03 | PLTR | Israel | 6/22 | ✅ | 32% | 0.57 | +11 | NO | no | +0.43 | +0.42 |
| 2026-08-03 | PLTR | Lethal | 7/22 | ❌ | 33% | 0.50 | +17 | NO | no | +0.50 | +0.48 |
| 2026-08-03 | PLTR | Maven | 8/22 | ✅ | 40% | 0.13 | +47 | NO | yes | -0.13 | -0.13 |
| 2026-08-03 | PLTR | NHS / National Health Service | 10/22 | ❌ | 44% | 0.17 | +27 | YES | no | -0.17 | -0.17 |
| 2026-08-03 | PLTR | Nvidia | 0/22 | ❌ | 6% | 0.59 | +35 | NO | yes | -0.59 | -0.59 |
| 2026-08-03 | PLTR | Revenue Guidance | 15/22 | ✅ | 67% | 0.10 | +23 | NO | yes | -0.10 | -0.10 |
| 2026-08-03 | PLTR | Slop / AI Slop | 0/22 | ✅ | 9% | 0.39 | +52 | NO | yes | -0.39 | -0.39 |
| 2026-08-03 | PLTR | Sovereign AI | 0/22 | ❌ | 6% | 0.36 | +58 | NO | yes | -0.36 | -0.36 |
| 2026-08-03 | PLTR | Warp Speed | 9/22 | ✅ | 44% | 0.24 | +32 | NO | no | +0.76 | +0.74 |
| 2026-08-03 | SNAP | Game | 11/20 | ✅ | 56% | 0.19 | +25 | NO | no | +0.81 | +0.79 |
| 2026-08-03 | SNAP | Glasses | 10/20 | ✅ | 52% | 0.14 | +34 | NO | yes | -0.14 | -0.14 |
| 2026-08-03 | SNAP | Memories Storage | 1/20 | ✅ | 14% | 0.29 | +57 | NO | yes | -0.29 | -0.29 |
| 2026-08-03 | SNAP | Restructuring | 7/20 | ✅ | 39% | 0.23 | +38 | NO | yes | -0.23 | -0.23 |
| 2026-08-03 | SNAP | Spectacles | 12/20 | ❌ | 56% | 0.33 | +23 | YES | no | -0.33 | -0.33 |
| 2026-08-03 | SNAP | Storage | 2/20 | ✅ | 18% | 0.25 | +57 | NO | yes | -0.25 | -0.25 |
| 2026-08-03 | SNAP | UK / United Kingdom | 1/20 | ❌ | 10% | 0.72 | +18 | NO | no | +0.28 | +0.27 |
| 2026-08-04 | AMD | Agentic AI | 2/63 | ✅ | 7% | 0.29 | +64 | NO | yes | -0.29 | -0.29 |
| 2026-08-04 | AMD | China | 35/63 | ✅ | 56% | 0.20 | +24 | NO | yes | -0.20 | -0.20 |
| 2026-08-04 | AMD | Export Restriction / Export Control | 2/63 | ❌ | 5% | 0.69 | +26 | NO | yes | -0.69 | -0.69 |
| 2026-08-04 | AMD | Frontier | 15/63 | ❌ | 25% | 0.64 | +11 | NO | yes | -0.64 | -0.64 |
| 2026-08-04 | AMD | Helios | 3/63 | ✅ | 8% | 0.07 | +85 | NO | yes | -0.07 | -0.07 |
| 2026-08-04 | AMD | Inference / Inferencing | 14/63 | ✅ | 24% | 0.10 | +66 | NO | yes | -0.10 | -0.10 |
| 2026-08-04 | AMD | Memory / HBM | 26/63 | ✅ | 42% | 0.06 | +52 | NO | yes | -0.06 | -0.06 |
| 2026-08-04 | AMD | Meta | 9/63 | ✅ | 17% | 0.35 | +48 | NO | yes | -0.35 | -0.35 |
| 2026-08-04 | AMD | MI450 / MI455X | 2/63 | ✅ | 7% | 0.07 | +86 | NO | yes | -0.07 | -0.07 |
| 2026-08-04 | AMD | Microsoft / Azure | 49/63 | ❌ | 75% | 0.11 | +14 | NO | yes | -0.11 | -0.11 |
| 2026-08-04 | AMD | OpenAI | 7/63 | ✅ | 14% | 0.26 | +60 | NO | yes | -0.26 | -0.26 |
| 2026-08-04 | AMD | ROCm | 17/63 | ✅ | 29% | 0.11 | +60 | NO | yes | -0.11 | -0.11 |
| 2026-08-04 | AMD | Supply Chain | 35/63 | ✅ | 56% | 0.22 | +22 | NO | yes | -0.22 | -0.22 |
| 2026-08-04 | AMD | Venice | 3/63 | ✅ | 8% | 0.07 | +85 | NO | yes | -0.07 | -0.07 |
| 2026-08-04 | MCD | Big Arch | 7/63 | ✅ | 14% | 0.32 | +54 | NO | no | +0.68 | +0.66 |
| 2026-08-04 | MCD | Caesar | 0/63 | ❌ | 2% | 0.60 | +38 | NO | no | +0.40 | +0.39 |
| 2026-08-04 | MCD | Delivery | 46/63 | ✅ | 72% | 0.54 | +18 | YES | yes | +0.46 | +0.45 |
| 2026-08-04 | MCD | Dividend | 42/63 | ❌ | 65% | 0.17 | +48 | YES | no | -0.17 | -0.17 |
| 2026-08-04 | MCD | Happy Meal | 17/63 | ✅ | 29% | 0.36 | +35 | NO | yes | -0.36 | -0.36 |
| 2026-08-04 | MCD | Iran / Middle East | 28/63 | ✅ | 45% | 0.41 | +14 | NO | no | +0.59 | +0.57 |
| 2026-08-04 | MCD | Loyalty | 36/63 | ✅ | 57% | 0.27 | +16 | NO | yes | -0.27 | -0.27 |
| 2026-08-04 | MCD | McCafé | 0/63 | ❌ | 2% | 0.30 | +68 | NO | no | +0.70 | +0.68 |
| 2026-08-04 | MCD | McChicken | 12/63 | ✅ | 21% | 0.65 | +14 | NO | no | +0.35 | +0.34 |
| 2026-08-04 | MCD | Monopoly | 17/63 | ❌ | 28% | 0.07 | +21 | YES | no | -0.07 | -0.07 |
| 2026-08-04 | MCD | Red Bull | 1/63 | ✅ | 5% | 0.42 | +53 | NO | yes | -0.42 | -0.42 |
| 2026-08-04 | MCD | Revenue | 30/63 | ❌ | 47% | 0.30 | +17 | YES | no | -0.30 | -0.30 |
| 2026-08-04 | MCD | Snack Wrap | 9/63 | ❌ | 16% | 0.43 | +41 | NO | no | +0.57 | +0.55 |
| 2026-08-04 | MCD | Soccer / Football | 2/63 | ❌ | 5% | 0.70 | +25 | NO | no | +0.30 | +0.29 |
| 2026-08-04 | MCD | Tariff | 4/63 | ❌ | 8% | 0.75 | +17 | NO | no | +0.25 | +0.24 |
| 2026-08-04 | MCD | World Cup | 5/63 | ✅ | 11% | 0.19 | +70 | NO | yes | -0.19 | -0.19 |
| 2026-08-04 | SPOT | Apple | 21/32 | ✅ | 65% | 0.36 | +29 | YES | yes | +0.64 | +0.62 |
| 2026-08-04 | SPOT | Claude | 1/32 | ✅ | 9% | 0.68 | +23 | NO | yes | -0.68 | -0.68 |
| 2026-08-04 | SPOT | Fitness | 0/32 | ✅ | 7% | 0.45 | +48 | NO | yes | -0.45 | -0.45 |
| 2026-08-04 | SPOT | Game / Gaming | 14/32 | ❌ | 43% | 0.26 | +17 | YES | yes | +0.74 | +0.72 |
| 2026-08-04 | SPOT | Headwind | 16/32 | ❌ | 48% | 0.18 | +30 | YES | yes | +0.82 | +0.80 |
| 2026-08-04 | SPOT | Peloton | 0/32 | ✅ | 7% | 0.75 | +18 | NO | no | +0.25 | +0.24 |
| 2026-08-04 | TOST | Agent / Agentic | 3/18 | ✅ | 25% | 0.12 | +63 | NO | yes | -0.12 | -0.12 |
| 2026-08-04 | TOST | Instacart | 1/18 | ❌ | 11% | 0.76 | +13 | NO | no | +0.24 | +0.23 |
| 2026-08-04 | TOST | Memory / Chip | 2/18 | ✅ | 20% | 0.38 | +42 | NO | yes | -0.38 | -0.38 |
| 2026-08-04 | TOST | Resy | 2/18 | ✅ | 20% | 0.57 | +23 | NO | no | +0.43 | +0.42 |
| 2026-08-04 | TOST | Share Repurchase / Buyback | 5/18 | ✅ | 34% | 0.14 | +52 | NO | yes | -0.14 | -0.14 |
| 2026-08-04 | TOST | Tariff | 4/18 | ✅ | 29% | 0.14 | +57 | NO | yes | -0.14 | -0.14 |
| 2026-08-04 | TOST | Toast IQ | 3/18 | ✅ | 25% | 0.09 | +66 | NO | yes | -0.09 | -0.09 |
| 2026-08-04 | ZETA | Agentic Commerce | 0/19 | ❌ | 7% | 0.80 | +13 | NO | no | +0.20 | +0.19 |
| 2026-08-04 | ZETA | AI Infrastructure | 0/19 | ❌ | 7% | 0.50 | +43 | NO | yes | -0.50 | -0.50 |
| 2026-08-04 | ZETA | Connected TV | 6/19 | ✅ | 37% | 0.48 | +15 | NO | no | +0.52 | +0.50 |
| 2026-08-04 | ZETA | Foundry | 0/19 | ❌ | 7% | 0.26 | +67 | NO | yes | -0.26 | -0.26 |
| 2026-08-04 | ZETA | Inference | 0/19 | ✅ | 11% | 0.68 | +21 | NO | yes | -0.68 | -0.68 |
| 2026-08-04 | ZETA | Loyalty | 4/19 | ✅ | 28% | 0.36 | +36 | NO | yes | -0.36 | -0.36 |
| 2026-08-04 | ZETA | OpenAI | 3/19 | ❌ | 20% | 0.37 | +43 | NO | yes | -0.37 | -0.37 |
| 2026-08-04 | ZETA | Palantir | 0/19 | ❌ | 7% | 0.07 | +86 | NO | yes | -0.07 | -0.07 |
| 2026-08-04 | ZETA | Snowflake | 12/19 | ❌ | 58% | 0.44 | +14 | YES | yes | +0.56 | +0.54 |
| 2026-08-04 | ZETA | SuperGraph | 1/19 | ✅ | 15% | 0.34 | +51 | NO | no | +0.66 | +0.64 |
| 2026-08-05 | DASH | Afford / Affordable / Affordability | 20/20 | ✅ | 93% | 0.76 | +17 | YES | yes | +0.24 | +0.23 |
| 2026-08-05 | DASH | Autonomous | 6/20 | ✅ | 35% | 0.25 | +40 | NO | yes | -0.25 | -0.25 |
| 2026-08-05 | DASH | DashMart | 13/20 | ✅ | 64% | 0.51 | +13 | YES | yes | +0.49 | +0.48 |
| 2026-08-05 | DASH | Drone | 3/20 | ❌ | 19% | 0.21 | +60 | NO | no | +0.79 | +0.77 |
| 2026-08-05 | DASH | Headwind | 12/20 | ❌ | 56% | 0.26 | +30 | YES | no | -0.26 | -0.26 |
| 2026-08-05 | DASH | Local Commerce | 19/20 | ✅ | 89% | 0.61 | +28 | YES | yes | +0.39 | +0.38 |
| 2026-08-05 | DASH | New York | 9/20 | ❌ | 44% | 0.21 | +23 | YES | no | -0.21 | -0.21 |
| 2026-08-05 | DASH | Robot / Robotic / Robotics | 3/20 | ❌ | 19% | 0.30 | +51 | NO | no | +0.70 | +0.68 |
| 2026-08-05 | DASH | Shopify | 1/20 | ❌ | 10% | 0.76 | +14 | NO | no | +0.24 | +0.23 |
| 2026-08-05 | DASH | Tailwind | 7/20 | ❌ | 35% | 0.18 | +17 | YES | no | -0.18 | -0.18 |
| 2026-08-05 | DASH | Waymo | 0/20 | ❌ | 6% | 0.80 | +14 | NO | yes | -0.80 | -0.80 |
| 2026-08-05 | DIS | Abu Dhabi | 4/64 | ✅ | 9% | 0.25 | +66 | NO | yes | -0.25 | -0.25 |
| 2026-08-05 | DIS | AI / Artificial Intelligence | 6/64 | ✅ | 12% | 0.23 | +65 | NO | yes | -0.23 | -0.23 |
| 2026-08-05 | DIS | Box Office | 51/64 | ✅ | 78% | 0.06 | +16 | NO | yes | -0.06 | -0.06 |
| 2026-08-05 | DIS | Churn | 25/64 | ✅ | 40% | 0.19 | +41 | NO | yes | -0.19 | -0.19 |
| 2026-08-05 | DIS | Digital Centerpiece | 0/64 | ✅ | 3% | 0.66 | +31 | NO | yes | -0.66 | -0.66 |
| 2026-08-05 | DIS | Epic Universe | 1/64 | ✅ | 5% | 0.69 | +26 | NO | no | +0.31 | +0.30 |
| 2026-08-05 | DIS | Fortnite | 1/64 | ✅ | 5% | 0.59 | +36 | NO | no | +0.41 | +0.40 |
| 2026-08-05 | DIS | Grogu / Baby Yoda | 4/64 | ✅ | 9% | 0.35 | +56 | NO | yes | -0.35 | -0.35 |
| 2026-08-05 | DIS | International Visitation | 10/64 | ✅ | 18% | 0.42 | +40 | NO | yes | -0.42 | -0.42 |
| 2026-08-05 | DIS | Moana | 17/64 | ✅ | 28% | 0.33 | +39 | NO | yes | -0.33 | -0.33 |
| 2026-08-05 | DIS | NFL Network / RedZone | 2/64 | ✅ | 6% | 0.34 | +60 | NO | no | +0.66 | +0.64 |
| 2026-08-05 | DIS | Streamline / Streamlining | 2/64 | ✅ | 6% | 0.78 | +16 | NO | no | +0.22 | +0.21 |
| 2026-08-05 | DIS | Toy Story 5 | 2/64 | ✅ | 6% | 0.17 | +77 | NO | yes | -0.17 | -0.17 |
| 2026-08-05 | DIS | Vertical Video / Vert | 2/64 | ✅ | 6% | 0.65 | +29 | NO | yes | -0.65 | -0.65 |
| 2026-08-05 | DUOL | Chess | 6/19 | ✅ | 37% | 0.31 | +32 | NO | yes | -0.31 | -0.31 |
| 2026-08-05 | DUOL | Flashcard | 0/19 | ✅ | 11% | 0.68 | +21 | NO | no | +0.32 | +0.31 |
| 2026-08-05 | DUOL | Free Trial | 1/19 | ✅ | 15% | 0.66 | +19 | NO | yes | -0.66 | -0.66 |
| 2026-08-05 | DUOL | Luckin Coffee | 1/19 | ✅ | 15% | 0.66 | +19 | NO | no | +0.34 | +0.33 |
| 2026-08-05 | DUOL | McDonald's | 0/19 | ✅ | 11% | 0.77 | +12 | NO | no | +0.23 | +0.22 |
| 2026-08-05 | DUOL | Tutor | 6/19 | ✅ | 37% | 0.40 | +23 | NO | no | +0.60 | +0.58 |
| 2026-08-05 | EBAY | AI / Artificial Intelligence | 25/32 | ✅ | 76% | 0.05 | +19 | NO | yes | -0.05 | -0.05 |
| 2026-08-05 | EBAY | Bullion | 2/32 | ✅ | 12% | 0.57 | +31 | NO | yes | -0.57 | -0.57 |
| 2026-08-05 | EBAY | Circular Economy | 7/32 | ✅ | 26% | 0.31 | +43 | NO | no | +0.69 | +0.67 |
| 2026-08-05 | EBAY | Depop | 1/32 | ✅ | 9% | 0.12 | +79 | NO | yes | -0.12 | -0.12 |
| 2026-08-05 | EBAY | Etsy | 2/32 | ❌ | 10% | 0.73 | +17 | NO | yes | -0.73 | -0.73 |
| 2026-08-05 | EBAY | GameStop | 0/32 | ❌ | 4% | 0.68 | +28 | NO | no | +0.32 | +0.31 |
| 2026-08-05 | EBAY | Goldin | 8/32 | ✅ | 29% | 0.10 | +61 | NO | yes | -0.10 | -0.10 |
| 2026-08-05 | EBAY | Guaranteed Fit | 7/32 | ✅ | 26% | 0.27 | +47 | NO | yes | -0.27 | -0.27 |
| 2026-08-05 | EBAY | Klarna | 9/32 | ✅ | 32% | 0.40 | +28 | NO | yes | -0.40 | -0.40 |
| 2026-08-05 | EBAY | One Piece | 1/32 | ✅ | 9% | 0.73 | +18 | NO | yes | -0.73 | -0.73 |
| 2026-08-05 | EBAY | OpenAI / ChatGPT | 7/32 | ✅ | 26% | 0.54 | +20 | NO | no | +0.46 | +0.45 |
| 2026-08-05 | EBAY | Pokemon | 0/32 | ❌ | 4% | 0.26 | +70 | NO | yes | -0.26 | -0.26 |
| 2026-08-05 | FIG | AI / Artificial Intelligence | 3/3 | ✅ | 75% | 0.03 | +22 | NO | yes | -0.03 | -0.03 |
| 2026-08-05 | FIG | Anthropic | 1/3 | ✅ | 51% | 0.23 | +28 | YES | no | -0.23 | -0.23 |
| 2026-08-05 | FIG | Code Connect | 2/3 | ✅ | 63% | 0.39 | +24 | YES | yes | +0.61 | +0.59 |
| 2026-08-05 | FIG | Colors | 2/3 | ❌ | 46% | 0.13 | +33 | YES | no | -0.13 | -0.13 |
| 2026-08-05 | FIG | Gemini | 1/3 | ✅ | 51% | 0.24 | +27 | YES | no | -0.24 | -0.24 |
| 2026-08-05 | FIG | Governance Plus | 1/3 | ❌ | 34% | 0.56 | +10 | NO | no | +0.44 | +0.43 |
| 2026-08-05 | FIG | Hyperscaler | 1/3 | ✅ | 51% | 0.33 | +18 | YES | no | -0.33 | -0.33 |
| 2026-08-05 | FIG | OpenAI / ChatGPT | 2/3 | ❌ | 46% | 0.34 | +12 | YES | no | -0.34 | -0.34 |
| 2026-08-05 | MELI | AI / Artificial Intelligence | 9/59 | ✅ | 18% | 0.17 | +65 | NO | yes | -0.17 | -0.17 |
| 2026-08-05 | MELI | Amazon | 12/59 | ✅ | 23% | 0.11 | +12 | YES | no | -0.11 | -0.11 |
| 2026-08-05 | MELI | Automated / Automation | 11/59 | ❌ | 20% | 0.69 | +11 | NO | no | +0.31 | +0.30 |
| 2026-08-05 | MELI | Chile | 38/59 | ✅ | 64% | 0.22 | +14 | NO | no | +0.78 | +0.76 |
| 2026-08-05 | MELI | Competition | 27/59 | ✅ | 47% | 0.42 | +11 | NO | no | +0.58 | +0.56 |
| 2026-08-05 | MELI | Digital Bank | 5/59 | ✅ | 12% | 0.69 | +19 | NO | yes | -0.69 | -0.69 |
| 2026-08-05 | MELI | Headwind | 37/59 | ✅ | 62% | 0.39 | +23 | YES | yes | +0.61 | +0.59 |
| 2026-08-05 | MELI | Oil / Gas / Gasoline | 6/59 | ✅ | 13% | 0.75 | +12 | NO | no | +0.25 | +0.24 |
| 2026-08-05 | MELI | Payroll Loan | 1/59 | ✅ | 5% | 0.68 | +27 | NO | no | +0.32 | +0.31 |
| 2026-08-05 | MELI | Pharmacy | 0/59 | ❌ | 2% | 0.64 | +34 | NO | no | +0.36 | +0.35 |
| 2026-08-05 | SHOP | Amazon | 26/43 | ✅ | 60% | 0.39 | +21 | YES | no | -0.39 | -0.39 |
| 2026-08-05 | SHOP | Headwind | 24/43 | ✅ | 56% | 0.32 | +12 | NO | no | +0.68 | +0.66 |
| 2026-08-05 | SHOP | Microsoft (2+ times) | 0/43 | ❌ | 3% | 0.54 | +43 | NO | no | +0.46 | +0.45 |
| 2026-08-05 | SHOP | Offline | 31/43 | ✅ | 71% | 0.19 | +10 | NO | yes | -0.19 | -0.19 |
| 2026-08-05 | SHOP | OpenAI | 5/43 | ✅ | 16% | 0.61 | +23 | NO | yes | -0.61 | -0.61 |
| 2026-08-05 | SHOP | Repurchase / Buyback | 3/43 | ✅ | 11% | 0.36 | +53 | NO | no | +0.64 | +0.62 |
| 2026-08-05 | SHOP | Shopify Capital | 34/43 | ❌ | 75% | 0.29 | +46 | YES | no | -0.29 | -0.29 |
| 2026-08-05 | SHOP | Stablecoin | 2/43 | ✅ | 9% | 0.61 | +30 | NO | no | +0.39 | +0.38 |
| 2026-08-05 | SHOP | Tariff | 6/43 | ❌ | 16% | 0.66 | +18 | NO | no | +0.34 | +0.33 |
| 2026-08-05 | TLN | Afford / Affordable / Affordability | 2/11 | ✅ | 30% | 0.42 | +28 | NO | no | +0.58 | +0.56 |
| 2026-08-05 | TLN | Amazon | 7/11 | ✅ | 62% | 0.23 | +15 | NO | no | +0.77 | +0.75 |
| 2026-08-05 | TLN | Anthropic / Claude | 1/11 | ❌ | 17% | 0.05 | +12 | YES | no | -0.05 | -0.05 |
| 2026-08-05 | TLN | Bitcoin | 3/11 | ❌ | 30% | 0.09 | +21 | YES | no | -0.09 | -0.09 |
| 2026-08-05 | TLN | Fossil | 6/11 | ❌ | 49% | 0.38 | +11 | YES | yes | +0.62 | +0.60 |
| 2026-08-05 | TLN | Shapiro | 3/11 | ❌ | 30% | 0.11 | +19 | YES | no | -0.11 | -0.11 |
| 2026-08-05 | TLN | SMR | 3/11 | ❌ | 30% | 0.13 | +17 | YES | no | -0.13 | -0.13 |
| 2026-08-05 | TLN | Solar | 2/11 | ❌ | 23% | 0.11 | +12 | YES | no | -0.11 | -0.11 |
| 2026-08-05 | TLN | Tariff | 5/11 | ❌ | 43% | 0.16 | +27 | YES | no | -0.16 | -0.16 |
| 2026-08-05 | UBER | Avride | 3/28 | ❌ | 14% | 0.74 | +12 | NO | no | +0.26 | +0.25 |
| 2026-08-05 | UBER | Delivery Hero | 0/28 | ❌ | 5% | 0.15 | +80 | NO | yes | -0.15 | -0.15 |
| 2026-08-05 | UBER | Drone | 0/28 | ❌ | 5% | 0.84 | +11 | NO | yes | -0.84 | -0.84 |
| 2026-08-05 | UBER | Expansion | 20/28 | ✅ | 70% | 0.18 | +12 | NO | no | +0.82 | +0.80 |
| 2026-08-05 | UBER | Innovation | 21/28 | ✅ | 73% | 0.58 | +15 | YES | yes | +0.42 | +0.41 |
| 2026-08-05 | UBER | Lucid | 2/28 | ✅ | 14% | 0.41 | +45 | NO | yes | -0.41 | -0.41 |
| 2026-08-05 | UBER | Lyft | 15/28 | ✅ | 54% | 0.24 | +30 | YES | no | -0.24 | -0.24 |
| 2026-08-05 | UBER | Market Share | 12/28 | ✅ | 45% | 0.15 | +30 | YES | no | -0.15 | -0.15 |
| 2026-08-05 | UBER | Nvidia | 2/28 | ✅ | 14% | 0.45 | +41 | NO | yes | -0.45 | -0.45 |
| 2026-08-05 | UBER | Waabi | 4/28 | ❌ | 17% | 0.72 | +11 | NO | no | +0.28 | +0.27 |
| 2026-08-05 | UBER | Waymo | 8/28 | ✅ | 32% | 0.20 | +48 | NO | yes | -0.20 | -0.20 |
| 2026-08-05 | UBER | Zoox | 0/28 | ✅ | 8% | 0.68 | +24 | NO | yes | -0.68 | -0.68 |
| 2026-08-05 | YOU | Agent / Agentic | 2/19 | ✅ | 19% | 0.42 | +39 | NO | yes | -0.42 | -0.42 |
| 2026-08-05 | YOU | AMEX / American Express | 15/19 | ❌ | 71% | 0.50 | +21 | YES | no | -0.50 | -0.50 |
| 2026-08-05 | YOU | Epic | 5/19 | ✅ | 32% | 0.45 | +23 | NO | no | +0.55 | +0.53 |
| 2026-08-05 | YOU | FedRAMP | 0/19 | ✅ | 11% | 0.53 | +36 | NO | no | +0.47 | +0.46 |
| 2026-08-05 | YOU | GovTech | 1/19 | ✅ | 15% | 0.38 | +47 | NO | yes | -0.38 | -0.38 |
| 2026-08-05 | YOU | Medicare / Medicaid | 2/19 | ✅ | 19% | 0.25 | +56 | NO | yes | -0.25 | -0.25 |
| 2026-08-05 | YOU | REAL ID | 2/19 | ✅ | 19% | 0.58 | +23 | NO | no | +0.42 | +0.41 |
| 2026-08-05 | YOU | Samsung | 0/19 | ❌ | 7% | 0.29 | +64 | NO | no | +0.71 | +0.69 |
| 2026-08-05 | YOU | Shutdown / Shut Down | 2/19 | ✅ | 19% | 0.56 | +25 | NO | no | +0.44 | +0.43 |
| 2026-08-05 | YOU | Social Security | 0/19 | ✅ | 11% | 0.50 | +39 | NO | no | +0.50 | +0.48 |
| 2026-08-05 | YOU | TSA PreCheck | 19/19 | ❌ | 88% | 0.68 | +20 | YES | no | -0.68 | -0.68 |
| 2026-08-05 | YOU | World Cup | 5/19 | ✅ | 32% | 0.18 | +50 | NO | no | +0.82 | +0.80 |
| 2026-08-06 | AAOI | CPO / Co-Packaged Optics | 2/32 | ✅ | 12% | 0.39 | +49 | NO | yes | -0.39 | -0.39 |
| 2026-08-06 | AAOI | DOCSIS 4.0 / DOCSIS 4 | 12/32 | ❌ | 37% | 0.41 | +22 | NO | yes | -0.41 | -0.41 |
| 2026-08-06 | AAOI | Firmware | 1/32 | ❌ | 7% | 0.76 | +17 | NO | no | +0.24 | +0.23 |
| 2026-08-06 | AAOI | Indium Phosphide | 1/32 | ✅ | 9% | 0.29 | +62 | NO | yes | -0.29 | -0.29 |
| 2026-08-06 | AAOI | Mediacom | 0/32 | ❌ | 4% | 0.45 | +51 | NO | yes | -0.45 | -0.45 |
| 2026-08-06 | AAOI | Pearland | 0/32 | ✅ | 7% | 0.34 | +59 | NO | yes | -0.34 | -0.34 |
| 2026-08-06 | AAOI | Qualification | 23/32 | ✅ | 70% | 0.13 | +17 | NO | yes | -0.13 | -0.13 |
| 2026-08-06 | AAOI | Quantum | 6/32 | ❌ | 21% | 0.28 | +51 | NO | yes | -0.28 | -0.28 |
| 2026-08-06 | AAOI | Refund | 0/32 | ✅ | 7% | 0.54 | +39 | NO | yes | -0.54 | -0.54 |
| 2026-08-06 | AAOI | Tariff | 9/32 | ✅ | 32% | 0.21 | +47 | NO | yes | -0.21 | -0.21 |
| 2026-08-06 | ABNB | Acquisition | 9/21 | ✅ | 46% | 0.31 | +15 | YES | yes | +0.69 | +0.67 |
| 2026-08-06 | ABNB | Boutique | 6/21 | ✅ | 34% | 0.30 | +36 | NO | yes | -0.30 | -0.30 |
| 2026-08-06 | ABNB | Code / Coding | 0/21 | ✅ | 10% | 0.60 | +30 | NO | no | +0.40 | +0.39 |
| 2026-08-06 | ABNB | Project Hawaii | 0/21 | ✅ | 10% | 0.46 | +44 | NO | yes | -0.46 | -0.46 |
| 2026-08-06 | ABNB | Social Media | 10/21 | ❌ | 46% | 0.35 | +11 | YES | no | -0.35 | -0.35 |
| 2026-08-06 | ABNB | Take Rate | 16/21 | ✅ | 73% | 0.61 | +12 | YES | yes | +0.39 | +0.38 |
| 2026-08-06 | ABNB | Third Party | 1/21 | ✅ | 14% | 0.59 | +27 | NO | no | +0.41 | +0.40 |
| 2026-08-06 | ABNB | World Cup | 4/21 | ✅ | 26% | 0.14 | +60 | NO | yes | -0.14 | -0.14 |
| 2026-08-06 | CELH | Electric Vibe | 0/35 | ✅ | 6% | 0.40 | +54 | NO | yes | -0.40 | -0.40 |
| 2026-08-06 | CELH | PepsiCo | 19/35 | ✅ | 55% | 0.15 | +30 | NO | yes | -0.15 | -0.15 |
| 2026-08-06 | CELH | Recall | 9/35 | ❌ | 27% | 0.16 | +11 | YES | no | -0.16 | -0.16 |
| 2026-08-06 | CELH | Vibe | 18/35 | ✅ | 52% | 0.20 | +28 | NO | yes | -0.20 | -0.20 |
| 2026-08-06 | CELH | Vitamin | 18/35 | ✅ | 52% | 0.14 | +38 | YES | no | -0.14 | -0.14 |
| 2026-08-06 | CELH | World Cup | 0/35 | ❌ | 4% | 0.68 | +28 | NO | no | +0.32 | +0.31 |
| 2026-08-06 | LYFT | Anthropic / Claude | 0/28 | ✅ | 8% | 0.74 | +18 | NO | no | +0.26 | +0.25 |
| 2026-08-06 | LYFT | Baidu | 2/28 | ✅ | 14% | 0.65 | +21 | NO | yes | -0.65 | -0.65 |
| 2026-08-06 | LYFT | Competition | 15/28 | ✅ | 54% | 0.37 | +17 | YES | yes | +0.63 | +0.61 |
| 2026-08-06 | LYFT | DoorDash | 5/28 | ✅ | 23% | 0.29 | +48 | NO | yes | -0.29 | -0.29 |
| 2026-08-06 | LYFT | Innovation | 27/28 | ❌ | 89% | 0.34 | +55 | YES | yes | +0.66 | +0.64 |
| 2026-08-06 | LYFT | Membership | 11/28 | ❌ | 39% | 0.18 | +21 | YES | yes | +0.82 | +0.80 |
| 2026-08-06 | LYFT | Nashville | 3/28 | ✅ | 17% | 0.32 | +51 | NO | yes | -0.32 | -0.32 |
| 2026-08-06 | LYFT | Nvidia | 2/28 | ❌ | 11% | 0.74 | +15 | NO | no | +0.26 | +0.25 |
| 2026-08-06 | LYFT | NYC / New York | 20/28 | ✅ | 70% | 0.38 | +32 | YES | yes | +0.62 | +0.60 |
| 2026-08-06 | LYFT | Revenue | 28/28 | ✅ | 95% | 0.80 | +15 | YES | no | -0.80 | -0.80 |
| 2026-08-06 | LYFT | Waymo | 10/28 | ✅ | 39% | 0.24 | +37 | NO | yes | -0.24 | -0.24 |
| 2026-08-06 | NBIS | Aether | 2/10 | ❌ | 25% | 0.43 | +32 | NO | no | +0.57 | +0.55 |
| 2026-08-06 | NBIS | Gigawatt | 5/10 | ✅ | 53% | 0.10 | +37 | NO | yes | -0.10 | -0.10 |
| 2026-08-06 | NBIS | Hyperscaler | 5/10 | ✅ | 53% | 0.21 | +26 | NO | yes | -0.21 | -0.21 |
| 2026-08-06 | NBIS | Meta | 3/10 | ✅ | 39% | 0.15 | +46 | NO | no | +0.85 | +0.82 |
| 2026-08-06 | NBIS | Nvidia | 5/10 | ✅ | 53% | 0.12 | +35 | NO | no | +0.88 | +0.85 |
| 2026-08-06 | NBIS | Pennsylvania | 0/10 | ✅ | 18% | 0.35 | +47 | NO | no | +0.65 | +0.63 |
| 2026-08-06 | NBIS | Robotic | 3/10 | ❌ | 32% | 0.20 | +12 | YES | no | -0.20 | -0.20 |
| 2026-08-06 | NBIS | Token | 3/10 | ✅ | 39% | 0.05 | +56 | NO | yes | -0.05 | -0.05 |
| 2026-08-06 | NBIS | TripleTen / Triple Ten | 3/10 | ✅ | 39% | 0.46 | +15 | NO | yes | -0.46 | -0.46 |
| 2026-08-06 | NBIS | Uber | 6/10 | ❌ | 53% | 0.15 | +38 | YES | no | -0.15 | -0.15 |
| 2026-08-06 | NBIS | Vera Rubin | 0/10 | ✅ | 18% | 0.25 | +57 | NO | yes | -0.25 | -0.25 |
| 2026-08-07 | DKNG | Alberta | 2/24 | ✅ | 16% | 0.14 | +70 | NO | no | +0.86 | +0.83 |
| 2026-08-07 | DKNG | Combo | 1/24 | ✅ | 12% | 0.34 | +54 | NO | yes | -0.34 | -0.34 |
| 2026-08-07 | DKNG | Competitor / Competition | 24/24 | ✅ | 94% | 0.68 | +26 | YES | yes | +0.32 | +0.31 |
| 2026-08-07 | DKNG | Feature | 18/24 | ✅ | 73% | 0.46 | +27 | YES | yes | +0.54 | +0.52 |
| 2026-08-07 | DKNG | Moonshot | 0/24 | ❌ | 5% | 0.37 | +58 | NO | yes | -0.37 | -0.37 |
| 2026-08-07 | DKNG | NBC / NBCUniversal | 2/24 | ✅ | 16% | 0.52 | +32 | NO | yes | -0.52 | -0.52 |
| 2026-08-07 | DKNG | Railbird | 2/24 | ❌ | 13% | 0.68 | +19 | NO | no | +0.32 | +0.31 |
| 2026-08-07 | DKNG | Retention / Retain | 23/24 | ✅ | 90% | 0.76 | +14 | YES | yes | +0.24 | +0.23 |
| 2026-08-07 | DKNG | Spain | 0/24 | ❌ | 5% | 0.79 | +16 | NO | no | +0.21 | +0.20 |
| 2026-08-07 | DKNG | Spanish | 3/24 | ✅ | 19% | 0.56 | +25 | NO | yes | -0.56 | -0.56 |
| 2026-08-07 | DKNG | Super App | 0/24 | ✅ | 9% | 0.20 | +71 | NO | yes | -0.20 | -0.20 |
| 2026-08-07 | DKNG | World Cup | 4/24 | ✅ | 23% | 0.04 | +73 | NO | yes | -0.04 | -0.04 |
| 2026-08-07 | LLY | AI / Artificial Intelligence | 2/45 | ❌ | 7% | 0.44 | +49 | NO | no | +0.56 | +0.54 |
| 2026-08-07 | LLY | Alzheimer | 42/45 | ✅ | 90% | 0.76 | +14 | YES | yes | +0.24 | +0.23 |
| 2026-08-07 | LLY | Foundayo | 1/45 | ✅ | 7% | 0.03 | +90 | NO | yes | -0.03 | -0.03 |
| 2026-08-07 | LLY | Headwind | 39/45 | ❌ | 83% | 0.45 | +38 | YES | no | -0.45 | -0.45 |
| 2026-08-07 | LLY | Inluriyo | 2/45 | ✅ | 9% | 0.08 | +83 | NO | yes | -0.08 | -0.08 |
| 2026-08-07 | LLY | LillyDirect | 5/45 | ✅ | 15% | 0.31 | +54 | NO | yes | -0.31 | -0.31 |
| 2026-08-07 | LLY | Novo Nordisk | 8/45 | ✅ | 21% | 0.09 | +12 | YES | no | -0.09 | -0.09 |
| 2026-08-07 | LLY | Nvidia | 1/45 | ❌ | 5% | 0.74 | +21 | NO | no | +0.26 | +0.25 |
| 2026-08-07 | LLY | Pennsylvania | 0/45 | ❌ | 3% | 0.79 | +18 | NO | no | +0.21 | +0.20 |
| 2026-08-07 | LLY | Tariff | 2/45 | ❌ | 7% | 0.74 | +19 | NO | no | +0.26 | +0.25 |
| 2026-08-07 | LLY | Ventyx | 2/45 | ❌ | 7% | 0.73 | +20 | NO | no | +0.27 | +0.26 |
| 2026-08-07 | LLY | Vial | 16/45 | ❌ | 36% | 0.22 | +42 | NO | no | +0.78 | +0.76 |
| 2026-08-07 | TTWO | Borderlands | 55/63 | ❌ | 84% | 0.63 | +21 | YES | yes | +0.37 | +0.36 |
| 2026-08-07 | TTWO | GTA+ / GTA plus | 14/63 | ✅ | 24% | 0.20 | +56 | NO | yes | -0.20 | -0.20 |
| 2026-08-07 | TTWO | Mafia | 24/63 | ✅ | 39% | 0.35 | +26 | NO | yes | -0.35 | -0.35 |
| 2026-08-07 | TTWO | PlayStation 5 | 18/63 | ❌ | 29% | 0.60 | +11 | NO | no | +0.40 | +0.39 |
| 2026-08-07 | TTWO | Pre Order | 0/63 | ❌ | 2% | 0.30 | +68 | NO | yes | -0.30 | -0.30 |
| 2026-08-07 | TTWO | Switch 2 | 5/63 | ✅ | 11% | 0.38 | +51 | NO | no | +0.62 | +0.60 |
| 2026-08-07 | TTWO | Tailwind | 12/63 | ❌ | 20% | 0.36 | +44 | NO | no | +0.64 | +0.62 |
| 2026-08-07 | TTWO | Vice City | 3/63 | ❌ | 7% | 0.79 | +14 | NO | no | +0.21 | +0.20 |
| 2026-08-07 | TTWO | Wembanyama | 0/63 | ❌ | 2% | 0.49 | +49 | NO | yes | -0.49 | -0.49 |
| 2026-08-07 | TTWO | Zynga | 21/63 | ✅ | 35% | 0.10 | +55 | NO | yes | -0.10 | -0.10 |
| 2026-08-07 | VST | Buyback | 16/23 | ❌ | 65% | 0.26 | +39 | YES | no | -0.26 | -0.26 |
| 2026-08-07 | VST | Capacity Auction | 9/23 | ❌ | 39% | 0.33 | +28 | NO | no | +0.67 | +0.65 |
| 2026-08-07 | VST | Cogentrix | 1/23 | ✅ | 13% | 0.18 | +69 | NO | yes | -0.18 | -0.18 |
| 2026-08-07 | VST | Co-Location | 7/23 | ✅ | 35% | 0.37 | +28 | NO | yes | -0.37 | -0.37 |
| 2026-08-07 | VST | Hyperscaler | 9/23 | ✅ | 42% | 0.31 | +27 | NO | yes | -0.31 | -0.31 |
| 2026-08-07 | VST | Investment Grade | 6/23 | ✅ | 31% | 0.34 | +35 | NO | yes | -0.34 | -0.34 |
| 2026-08-07 | VST | Martin Lake | 7/23 | ✅ | 35% | 0.42 | +23 | NO | yes | -0.42 | -0.42 |
| 2026-08-07 | VST | Meta | 1/23 | ✅ | 13% | 0.20 | +67 | NO | yes | -0.20 | -0.20 |
| 2026-08-07 | VST | Oak Hill | 5/23 | ✅ | 27% | 0.30 | +43 | NO | yes | -0.30 | -0.30 |
| 2026-08-07 | VST | Permian | 8/23 | ✅ | 38% | 0.27 | +35 | NO | yes | -0.27 | -0.27 |
| 2026-08-07 | VST | Production Tax Credit / PTC | 13/23 | ✅ | 57% | 0.25 | +18 | NO | yes | -0.25 | -0.25 |
| 2026-08-07 | VST | Uprate / Up Rate | 4/23 | ✅ | 24% | 0.38 | +38 | NO | no | +0.62 | +0.60 |
| 2026-08-07 | WEN | Baconator | 2/24 | ❌ | 13% | 0.70 | +17 | NO | yes | -0.70 | -0.70 |
| 2026-08-07 | WEN | Closure | 16/24 | ✅ | 66% | 0.49 | +17 | YES | yes | +0.51 | +0.49 |
| 2026-08-07 | WEN | Delivery | 24/24 | ✅ | 94% | 0.67 | +27 | YES | no | -0.67 | -0.67 |
| 2026-08-07 | WEN | FreshAI | 5/24 | ❌ | 23% | 0.35 | +42 | NO | no | +0.65 | +0.63 |
| 2026-08-07 | WEN | Loyalty | 23/24 | ❌ | 87% | 0.45 | +42 | YES | yes | +0.55 | +0.53 |
| 2026-08-07 | WEN | Minions | 0/24 | ✅ | 9% | 0.36 | +55 | NO | yes | -0.36 | -0.36 |
| 2026-08-07 | WEN | Pickle | 2/24 | ❌ | 13% | 0.75 | +12 | NO | no | +0.25 | +0.24 |
| 2026-08-07 | WEN | Project Fresh | 2/24 | ✅ | 16% | 0.17 | +67 | NO | yes | -0.17 | -0.17 |
| 2026-08-07 | WEN | Ranch | 4/24 | ✅ | 23% | 0.63 | +14 | NO | no | +0.37 | +0.36 |
| 2026-08-07 | WEN | Sonic | 0/24 | ❌ | 5% | 0.70 | +25 | NO | no | +0.30 | +0.29 |
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
| 2026-08-10 | HIMS | Regulation | 3/21 | ❌ | 18% | 0.70 | +12 | NO | no | +0.30 | +0.29 |
| 2026-08-10 | HIMS | Testosterone | 7/21 | ✅ | 38% | 0.03 | +59 | NO | yes | -0.03 | -0.03 |
| 2026-08-10 | HIMS | Vitamin | 6/21 | ❌ | 30% | 0.44 | +26 | NO | no | +0.56 | +0.54 |
| 2026-08-10 | HIMS | Wearable | 4/21 | ✅ | 26% | 0.24 | +50 | NO | yes | -0.24 | -0.24 |
| 2026-08-10 | HIMS | Wegovy | 3/21 | ✅ | 22% | 0.11 | +67 | NO | yes | -0.11 | -0.11 |
| 2026-08-10 | HIMS | YourBio | 1/21 | ✅ | 14% | 0.43 | +43 | NO | no | +0.57 | +0.55 |
| 2026-08-10 | HIMS | Zava | 3/21 | ✅ | 22% | 0.30 | +48 | NO | no | +0.70 | +0.68 |
| 2026-08-11 | CAVA | Acceleration | 3/11 | ✅ | 36% | 0.17 | +19 | YES | no | -0.17 | -0.17 |
| 2026-08-11 | CAVA | AI / Artificial Intelligence | 7/11 | ✅ | 62% | 0.15 | +23 | NO | yes | -0.15 | -0.15 |
| 2026-08-11 | CAVA | Automation | 4/11 | ❌ | 36% | 0.17 | +19 | YES | no | -0.17 | -0.17 |
| 2026-08-11 | CAVA | CavaCore | 0/11 | ❌ | 10% | 0.30 | +60 | NO | yes | -0.30 | -0.30 |
| 2026-08-11 | CAVA | Cyclospora / Cyclosporiasis | 0/11 | ❌ | 10% | 0.63 | +27 | NO | yes | -0.63 | -0.63 |
| 2026-08-11 | CAVA | Dining | 9/11 | ❌ | 69% | 0.35 | +34 | YES | no | -0.35 | -0.35 |
| 2026-08-11 | CAVA | Pita Chips | 7/11 | ❌ | 56% | 0.15 | +29 | NO | yes | -0.15 | -0.15 |
| 2026-08-11 | CAVA | Salmon | 3/11 | ✅ | 36% | 0.03 | +61 | NO | yes | -0.03 | -0.03 |
| 2026-08-11 | CAVA | Same Store | 1/11 | ✅ | 23% | 0.08 | +15 | YES | no | -0.08 | -0.08 |
| 2026-08-11 | CAVA | Shrimp | 1/11 | ✅ | 23% | 0.44 | +33 | NO | yes | -0.44 | -0.44 |
| 2026-08-11 | CAVA | Spice | 4/11 | ✅ | 43% | 0.35 | +22 | NO | no | +0.65 | +0.63 |
| 2026-08-11 | CAVA | Sweet Potato | 2/11 | ✅ | 30% | 0.60 | +10 | NO | no | +0.40 | +0.39 |
| 2026-08-11 | CAVA | Tariff | 4/11 | ❌ | 36% | 0.24 | +12 | YES | no | -0.24 | -0.24 |
| 2026-08-11 | CRWV | Anthropic | 0/4 | ✅ | 33% | 0.26 | +41 | NO | no | +0.74 | +0.72 |
| 2026-08-11 | CRWV | China / Chinese | 0/4 | ✅ | 33% | 0.52 | +15 | NO | no | +0.48 | +0.47 |
| 2026-08-11 | CRWV | Healthcare | 1/4 | ❌ | 30% | 0.49 | +21 | NO | no | +0.51 | +0.49 |
| 2026-08-11 | CRWV | Nvidia (3+ times) | 0/4 | ❌ | 19% | 0.17 | +64 | NO | yes | -0.17 | -0.17 |
| 2026-08-11 | CRWV | Quantum | 0/4 | ❌ | 19% | 0.60 | +21 | NO | no | +0.40 | +0.39 |
| 2026-08-11 | CRWV | Solidigm | 0/4 | ❌ | 19% | 0.17 | +64 | NO | yes | -0.17 | -0.17 |
| 2026-08-11 | CRWV | Storage | 4/4 | ✅ | 78% | 0.07 | +15 | NO | yes | -0.07 | -0.07 |
| 2026-08-12 | COHR | China / Chinese | 3/7 | ❌ | 40% | 0.28 | +12 | YES | no | -0.28 | -0.28 |
| 2026-08-12 | COHR | CHIPS Act | 1/7 | ❌ | 23% | 0.61 | +16 | NO | no | +0.39 | +0.38 |
| 2026-08-12 | COHR | Indium Phosphide | 6/7 | ✅ | 75% | 0.05 | +20 | NO | yes | -0.05 | -0.05 |
| 2026-08-12 | COHR | Liquid Crystal | 6/7 | ❌ | 66% | 0.42 | +24 | YES | no | -0.42 | -0.42 |
| 2026-08-12 | COHR | Multi-Rail | 1/7 | ✅ | 32% | 0.25 | +43 | NO | yes | -0.25 | -0.25 |
| 2026-08-12 | COHR | Nvidia | 2/7 | ✅ | 41% | 0.10 | +49 | NO | yes | -0.10 | -0.10 |
| 2026-08-12 | COHR | Optical Circuit Switch | 6/7 | ❌ | 66% | 0.48 | +18 | YES | no | -0.48 | -0.48 |
| 2026-08-12 | COHR | Sherman | 4/7 | ✅ | 58% | 0.11 | +31 | NO | yes | -0.11 | -0.11 |
| 2026-08-12 | COHR | Thermadite | 0/7 | ✅ | 24% | 0.51 | +25 | NO | yes | -0.51 | -0.51 |
| 2026-08-12 | COHR | Zurich | 0/7 | ✅ | 24% | 0.54 | +22 | NO | yes | -0.54 | -0.54 |
| 2026-08-13 | AMAT | Agent / Agentic | 0/45 | ✅ | 5% | 0.32 | +63 | NO | yes | -0.32 | -0.32 |
| 2026-08-13 | AMAT | Broadcom | 1/45 | ❌ | 5% | 0.36 | +59 | NO | yes | -0.36 | -0.36 |
| 2026-08-13 | AMAT | Chiplet | 11/45 | ✅ | 27% | 0.55 | +18 | NO | yes | -0.55 | -0.55 |
| 2026-08-13 | AMAT | EPIC Center | 9/45 | ✅ | 23% | 0.04 | +73 | NO | yes | -0.04 | -0.04 |
| 2026-08-13 | AMAT | Epitaxy | 6/45 | ✅ | 17% | 0.50 | +33 | NO | yes | -0.50 | -0.50 |
| 2026-08-13 | AMAT | EssilorLuxottica | 0/45 | ❌ | 3% | 0.51 | +46 | NO | no | +0.49 | +0.48 |
| 2026-08-13 | AMAT | Hybrid Bonding | 14/45 | ✅ | 33% | 0.24 | +43 | NO | yes | -0.24 | -0.24 |
| 2026-08-13 | AMAT | SCREEN | 25/45 | ❌ | 54% | 0.37 | +17 | YES | yes | +0.63 | +0.61 |
| 2026-08-13 | AMAT | SENZ | 0/45 | ❌ | 3% | 0.43 | +54 | NO | no | +0.57 | +0.55 |
| 2026-08-13 | AMAT | Singapore | 10/45 | ✅ | 25% | 0.23 | +52 | NO | yes | -0.23 | -0.23 |
| 2026-08-13 | AMAT | Smart Glasses | 0/45 | ❌ | 3% | 0.46 | +51 | NO | no | +0.54 | +0.52 |
| 2026-08-13 | AMAT | Supply Chain | 34/45 | ✅ | 74% | 0.04 | +22 | NO | yes | -0.04 | -0.04 |
| 2026-08-13 | LUNR | AI / Artificial Intelligence | 2/11 | ❌ | 23% | 0.32 | +45 | NO | no | +0.68 | +0.66 |
| 2026-08-13 | LUNR | Artemis III | 1/11 | ✅ | 23% | 0.63 | +14 | NO | no | +0.37 | +0.36 |
| 2026-08-13 | LUNR | Artemis IV | 0/11 | ✅ | 17% | 0.64 | +19 | NO | yes | -0.64 | -0.64 |
| 2026-08-13 | LUNR | China / Chinese | 7/11 | ❌ | 56% | 0.26 | +30 | YES | no | -0.26 | -0.26 |
| 2026-08-13 | LUNR | Golden Dome | 2/11 | ✅ | 30% | 0.28 | +42 | NO | yes | -0.28 | -0.28 |
| 2026-08-13 | LUNR | Goonhilly Earth Station | 1/11 | ✅ | 23% | 0.05 | +72 | NO | yes | -0.05 | -0.05 |
| 2026-08-13 | LUNR | Mars (3+ times) | 0/11 | ❌ | 10% | 0.64 | +26 | NO | no | +0.36 | +0.35 |
| 2026-08-13 | LUNR | Moon Base | 0/11 | ✅ | 17% | 0.37 | +46 | NO | yes | -0.37 | -0.37 |
| 2026-08-13 | LUNR | SpaceX | 6/11 | ❌ | 49% | 0.36 | +13 | YES | yes | +0.64 | +0.62 |
| 2026-08-13 | YETI | AI / Artificial Intelligence | 2/28 | ✅ | 14% | 0.28 | +58 | NO | yes | -0.28 | -0.28 |
| 2026-08-13 | YETI | Ceramic | 3/28 | ✅ | 17% | 0.19 | +64 | NO | no | +0.81 | +0.79 |
| 2026-08-13 | YETI | China (3+ times) | 0/28 | ❌ | 5% | 0.55 | +40 | NO | no | +0.45 | +0.44 |
| 2026-08-13 | YETI | GoBox | 13/28 | ✅ | 48% | 0.30 | +22 | NO | yes | -0.30 | -0.30 |
| 2026-08-13 | YETI | NFL | 7/28 | ❌ | 27% | 0.37 | +36 | NO | no | +0.63 | +0.61 |
| 2026-08-13 | YETI | Ranger | 3/28 | ✅ | 17% | 0.32 | +51 | NO | yes | -0.32 | -0.32 |
| 2026-08-13 | YETI | Tailwind | 10/28 | ✅ | 39% | 0.15 | +24 | YES | yes | +0.85 | +0.82 |
| 2026-08-13 | YETI | TikTok | 4/28 | ✅ | 20% | 0.56 | +24 | NO | no | +0.44 | +0.43 |
| 2026-08-18 | AS | Foot Locker | 1/9 | ✅ | 27% | 0.16 | +57 | NO | yes | -0.16 | -0.16 |
| 2026-08-18 | AS | Norvan | 3/9 | ✅ | 42% | 0.24 | +34 | NO | yes | -0.24 | -0.24 |
| 2026-08-18 | AS | Oil | 0/9 | ✅ | 20% | 0.66 | +14 | NO | no | +0.34 | +0.33 |
| 2026-08-18 | AS | Olympic / Olympics | 7/9 | ❌ | 64% | 0.12 | +52 | YES | yes | +0.88 | +0.85 |
| 2026-08-18 | AS | Pickleball | 4/9 | ❌ | 42% | 0.17 | +25 | YES | no | -0.17 | -0.17 |
| 2026-08-18 | AS | REI | 5/9 | ✅ | 57% | 0.27 | +16 | NO | no | +0.73 | +0.71 |
| 2026-08-18 | AS | Section 122 | 0/9 | ✅ | 20% | 0.55 | +25 | NO | no | +0.45 | +0.44 |
| 2026-08-18 | AS | Supreme Court | 1/9 | ✅ | 27% | 0.55 | +18 | NO | no | +0.45 | +0.44 |
| 2026-08-18 | AS | Tariff | 6/9 | ✅ | 64% | 0.06 | +30 | NO | yes | -0.06 | -0.06 |
| 2026-08-18 | AS | Waterproof | 3/9 | ❌ | 34% | 0.17 | +17 | YES | no | -0.17 | -0.17 |
| 2026-08-18 | AS | Wimbledon | 0/9 | ❌ | 12% | 0.69 | +19 | NO | yes | -0.69 | -0.69 |
| 2026-08-18 | HD | Competition | 13/63 | ✅ | 23% | 0.65 | +12 | NO | no | +0.35 | +0.34 |
| 2026-08-18 | HD | Inflation | 54/63 | ❌ | 83% | 0.61 | +22 | YES | no | -0.61 | -0.61 |
| 2026-08-18 | HD | Lumber | 59/63 | ❌ | 90% | 0.69 | +21 | YES | yes | +0.31 | +0.30 |
| 2026-08-18 | HD | Storm | 38/63 | ✅ | 60% | 0.25 | +15 | NO | yes | -0.25 | -0.25 |
| 2026-08-18 | HD | Synergy | 4/63 | ❌ | 8% | 0.64 | +28 | NO | no | +0.36 | +0.35 |
| 2026-08-18 | HD | Tariff | 15/63 | ✅ | 26% | 0.11 | +63 | NO | yes | -0.11 | -0.11 |
| 2026-08-18 | HD | Volatility | 12/63 | ❌ | 20% | 0.60 | +20 | NO | yes | -0.60 | -0.60 |
| 2026-08-18 | KLAR | AI / Artificial Intelligence | 3/3 | ❌ | 58% | 0.28 | +14 | NO | no | +0.72 | +0.70 |
| 2026-08-18 | KLAR | Banking License | 0/3 | ❌ | 22% | 0.28 | +50 | NO | no | +0.72 | +0.70 |
| 2026-08-18 | KLAR | Delinquency | 2/3 | ✅ | 63% | 0.20 | +17 | NO | yes | -0.20 | -0.20 |
| 2026-08-18 | KLAR | Gemini | 0/3 | ✅ | 39% | 0.44 | +17 | NO | no | +0.56 | +0.54 |
| 2026-08-18 | KLAR | Headwind | 1/3 | ✅ | 51% | 0.25 | +26 | YES | yes | +0.75 | +0.73 |
| 2026-08-18 | KLAR | Inflation | 0/3 | ❌ | 22% | 0.55 | +23 | NO | no | +0.45 | +0.44 |
| 2026-08-18 | KLAR | JP Morgan Payment | 0/3 | ✅ | 39% | 0.37 | +24 | NO | yes | -0.37 | -0.37 |
| 2026-08-18 | KLAR | PriceRunner | 0/3 | ❌ | 22% | 0.30 | +48 | NO | no | +0.70 | +0.68 |
| 2026-08-18 | KLAR | Southwest Airlines | 0/3 | ❌ | 22% | 0.54 | +24 | NO | no | +0.46 | +0.45 |
| 2026-08-18 | KLAR | Walmart | 3/3 | ✅ | 75% | 0.60 | +15 | YES | yes | +0.40 | +0.39 |
| 2026-08-18 | TOL | Buffington / Arkansas | 0/25 | ✅ | 8% | 0.24 | +68 | NO | yes | -0.24 | -0.24 |
| 2026-08-18 | TOL | Buyback | 15/25 | ❌ | 57% | 0.25 | +32 | YES | no | -0.25 | -0.25 |
| 2026-08-18 | TOL | California | 20/25 | ❌ | 74% | 0.57 | +17 | YES | no | -0.57 | -0.57 |
| 2026-08-18 | TOL | Cash Buyer / All Cash | 20/25 | ✅ | 77% | 0.08 | +15 | NO | yes | -0.08 | -0.08 |
| 2026-08-18 | TOL | Customize / Customization | 9/25 | ✅ | 39% | 0.34 | +27 | NO | yes | -0.34 | -0.34 |
| 2026-08-18 | TOL | Incentive | 20/25 | ✅ | 77% | 0.01 | +22 | NO | yes | -0.01 | -0.01 |
| 2026-08-18 | TOL | Land Bank / Land Banking | 15/25 | ✅ | 60% | 0.26 | +14 | NO | yes | -0.26 | -0.26 |
| 2026-08-18 | TOL | Lumber | 13/25 | ✅ | 53% | 0.35 | +12 | NO | yes | -0.35 | -0.35 |
| 2026-08-18 | TOL | Tariff | 6/25 | ✅ | 29% | 0.46 | +25 | NO | no | +0.54 | +0.52 |
| 2026-08-19 | TGT | Autonomous / Automation | 16/52 | ❌ | 31% | 0.14 | +17 | YES | no | -0.14 | -0.14 |
| 2026-08-19 | TGT | Back to School | 33/52 | ✅ | 63% | 0.10 | +27 | NO | yes | -0.10 | -0.10 |
| 2026-08-19 | TGT | Circle 360 | 9/52 | ❌ | 19% | 0.27 | +54 | NO | yes | -0.27 | -0.27 |
| 2026-08-19 | TGT | Competition | 16/52 | ❌ | 31% | 0.20 | +11 | YES | no | -0.20 | -0.20 |
| 2026-08-19 | TGT | Nintendo Switch | 7/52 | ✅ | 17% | 0.30 | +53 | NO | no | +0.70 | +0.68 |
| 2026-08-19 | TGT | Target Plus | 12/52 | ✅ | 26% | 0.03 | +71 | NO | yes | -0.03 | -0.03 |
| 2026-08-19 | TGT | Revenue | 26/52 | ✅ | 51% | 0.30 | +19 | NO | yes | -0.30 | -0.30 |
| 2026-08-19 | TGT | Roundel | 16/52 | ✅ | 33% | 0.12 | +55 | NO | yes | -0.12 | -0.12 |
| 2026-08-19 | TGT | Synthetic Color | 3/52 | ✅ | 10% | 0.59 | +31 | NO | no | +0.41 | +0.40 |
| 2026-08-19 | TGT | Tariff | 11/52 | ✅ | 24% | 0.21 | +55 | NO | yes | -0.21 | -0.21 |
| 2026-08-20 | AAP | Advance Reward | 1/63 | ✅ | 5% | 0.20 | +75 | NO | yes | -0.20 | -0.20 |
| 2026-08-20 | AAP | ARGOS | 1/63 | ✅ | 5% | 0.20 | +75 | NO | yes | -0.20 | -0.20 |
| 2026-08-20 | AAP | Good Part | 3/63 | ✅ | 8% | 0.26 | +66 | NO | yes | -0.26 | -0.26 |
| 2026-08-20 | AAP | LIFO | 26/63 | ✅ | 42% | 0.39 | +19 | NO | yes | -0.39 | -0.39 |
| 2026-08-20 | AAP | Net Promoter | 10/63 | ✅ | 18% | 0.42 | +40 | NO | yes | -0.42 | -0.42 |
| 2026-08-20 | AAP | Palantir | 1/63 | ❌ | 4% | 0.81 | +15 | NO | no | +0.19 | +0.18 |
| 2026-08-20 | AAP | Peak Driving | 0/63 | ✅ | 4% | 0.65 | +31 | NO | no | +0.35 | +0.34 |
| 2026-08-20 | AAP | Ron | 1/63 | ✅ | 5% | 0.21 | +74 | NO | yes | -0.21 | -0.21 |
| 2026-08-20 | AAP | Same Store | 4/63 | ❌ | 8% | 0.81 | +11 | NO | no | +0.19 | +0.18 |
| 2026-08-20 | AAP | Tariff | 17/63 | ✅ | 29% | 0.35 | +36 | NO | yes | -0.35 | -0.35 |
| 2026-08-20 | AAP | Zebra | 2/63 | ✅ | 7% | 0.50 | +43 | NO | no | +0.50 | +0.48 |
| 2026-08-20 | DE | AI / Artificial Intelligence | 5/64 | ❌ | 10% | 0.51 | +39 | NO | yes | -0.51 | -0.51 |
| 2026-08-20 | DE | Automation | 21/64 | ✅ | 34% | 0.19 | +47 | NO | no | +0.81 | +0.79 |
| 2026-08-20 | DE | Efficiency | 31/64 | ❌ | 48% | 0.41 | +11 | NO | yes | -0.41 | -0.41 |
| 2026-08-20 | DE | Excavator | 15/64 | ✅ | 26% | 0.49 | +25 | NO | yes | -0.49 | -0.49 |
| 2026-08-20 | DE | Fertilizer | 14/64 | ✅ | 24% | 0.35 | +41 | NO | yes | -0.35 | -0.35 |
| 2026-08-20 | DE | Manufacturing | 26/64 | ✅ | 42% | 0.35 | +23 | NO | no | +0.65 | +0.63 |
| 2026-08-20 | DE | Repair | 5/64 | ❌ | 10% | 0.78 | +12 | NO | yes | -0.78 | -0.78 |
| 2026-08-20 | DE | Tailwind | 36/64 | ✅ | 56% | 0.24 | +20 | NO | yes | -0.24 | -0.24 |
| 2026-08-20 | DE | Tariff | 17/64 | ✅ | 28% | 0.03 | +69 | NO | yes | -0.03 | -0.03 |
| 2026-08-20 | DE | Warranty | 20/64 | ❌ | 32% | 0.34 | +34 | NO | no | +0.66 | +0.64 |
| 2026-08-20 | FUTU | Agentic | 0/24 | ❌ | 5% | 0.46 | +49 | NO | no | +0.54 | +0.52 |
| 2026-08-20 | FUTU | Australia | 13/24 | ✅ | 55% | 0.23 | +22 | NO | yes | -0.23 | -0.23 |
| 2026-08-20 | FUTU | CFTC | 0/24 | ❌ | 5% | 0.71 | +24 | NO | yes | -0.71 | -0.71 |
| 2026-08-20 | FUTU | Expert | 0/24 | ❌ | 5% | 0.59 | +36 | NO | no | +0.41 | +0.40 |
| 2026-08-20 | FUTU | Fraud | 1/24 | ✅ | 12% | 0.68 | +20 | NO | no | +0.32 | +0.31 |
| 2026-08-20 | FUTU | Headwind | 1/24 | ❌ | 9% | 0.70 | +21 | NO | no | +0.30 | +0.29 |
| 2026-08-20 | FUTU | Kalshi | 0/24 | ✅ | 9% | 0.51 | +40 | NO | no | +0.49 | +0.48 |
| 2026-08-20 | FUTU | PantherTrade | 0/24 | ✅ | 9% | 0.25 | +66 | NO | no | +0.75 | +0.73 |
| 2026-08-20 | FUTU | Perp / Perpetual | 0/24 | ✅ | 9% | 0.58 | +33 | NO | no | +0.42 | +0.41 |
| 2026-08-20 | FUTU | Staking | 3/24 | ✅ | 19% | 0.36 | +45 | NO | no | +0.64 | +0.62 |
| 2026-08-20 | FUTU | Tokenized / Tokenization | 2/24 | ✅ | 16% | 0.54 | +30 | NO | no | +0.46 | +0.45 |
| 2026-08-20 | ROST | Bankruptcy | 2/20 | ✅ | 18% | 0.66 | +16 | NO | no | +0.34 | +0.33 |
| 2026-08-20 | ROST | Dress for Less | 5/20 | ❌ | 27% | 0.47 | +26 | NO | no | +0.53 | +0.51 |
| 2026-08-20 | ROST | Flywheel | 1/20 | ✅ | 14% | 0.53 | +33 | NO | yes | -0.53 | -0.53 |
| 2026-08-20 | ROST | Home | 18/20 | ✅ | 85% | 0.68 | +17 | YES | yes | +0.32 | +0.31 |
| 2026-08-20 | ROST | New York | 4/20 | ✅ | 27% | 0.23 | +50 | NO | no | +0.77 | +0.75 |
| 2026-08-20 | ROST | Northeast | 6/20 | ✅ | 35% | 0.22 | +43 | NO | yes | -0.22 | -0.22 |
| 2026-08-20 | ROST | Self-Checkout | 7/20 | ❌ | 35% | 0.40 | +25 | NO | no | +0.60 | +0.58 |
| 2026-08-20 | ROST | Texas | 16/20 | ❌ | 72% | 0.39 | +33 | YES | no | -0.39 | -0.39 |
| 2026-08-20 | WMT | Automation | 26/59 | ✅ | 45% | 0.10 | +45 | NO | yes | -0.10 | -0.10 |
| 2026-08-20 | WMT | Brick and Mortar | 2/59 | ❌ | 6% | 0.79 | +15 | NO | no | +0.21 | +0.20 |
| 2026-08-20 | WMT | Competition / Competitor | 39/59 | ✅ | 66% | 0.45 | +21 | YES | no | -0.45 | -0.45 |
| 2026-08-20 | WMT | Drone | 3/59 | ✅ | 9% | 0.63 | +28 | NO | no | +0.37 | +0.36 |
| 2026-08-20 | WMT | Marketplace / Market Place | 43/59 | ✅ | 72% | 0.02 | +26 | NO | yes | -0.02 | -0.02 |
| 2026-08-20 | WMT | Omnichannel | 25/59 | ✅ | 43% | 0.09 | +48 | NO | yes | -0.09 | -0.09 |
| 2026-08-20 | WMT | Rollback / Roll Back | 24/59 | ✅ | 42% | 0.11 | +47 | NO | yes | -0.11 | -0.11 |
| 2026-08-20 | WMT | SNAP / Food Stamp | 12/59 | ❌ | 21% | 0.10 | +11 | YES | no | -0.10 | -0.10 |
| 2026-08-20 | WMT | Sparky | 3/59 | ✅ | 9% | 0.11 | +80 | NO | yes | -0.11 | -0.11 |
| 2026-08-20 | WMT | Tariff | 33/59 | ✅ | 56% | 0.06 | +38 | NO | yes | -0.06 | -0.06 |
| 2026-08-20 | WMT | Upper Income | 1/59 | ❌ | 4% | 0.78 | +18 | NO | no | +0.22 | +0.21 |
| 2026-08-21 | BJ | Ask Bev | 1/30 | ❌ | 7% | 0.73 | +20 | NO | no | +0.27 | +0.26 |
| 2026-08-21 | BJ | ExpressPay | 8/30 | ✅ | 31% | 0.17 | +52 | NO | yes | -0.17 | -0.17 |
| 2026-08-21 | BJ | Rotterdam | 2/30 | ✅ | 13% | 0.26 | +61 | NO | yes | -0.26 | -0.26 |
| 2026-08-21 | BJ | Tally | 1/30 | ❌ | 7% | 0.75 | +18 | NO | no | +0.25 | +0.24 |
| 2026-08-25 | DKS | Fast Break | 1/55 | ✅ | 6% | 0.08 | +86 | NO | yes | -0.08 | -0.08 |
| 2026-08-25 | DKS | Foot Locker | 5/55 | ✅ | 13% | 0.03 | +84 | NO | yes | -0.03 | -0.03 |
| 2026-08-25 | DKS | Going Going Gone | 0/55 | ❌ | 3% | 0.75 | +22 | NO | no | +0.25 | +0.24 |
| 2026-08-25 | DKS | House of Sport | 21/55 | ✅ | 40% | 0.04 | +56 | NO | yes | -0.04 | -0.04 |
| 2026-08-25 | DKS | Omnichannel | 30/55 | ✅ | 55% | 0.12 | +33 | NO | yes | -0.12 | -0.12 |
| 2026-08-25 | DKS | Public Land | 15/55 | ❌ | 28% | 0.16 | +12 | YES | no | -0.16 | -0.16 |
| 2026-08-25 | DKS | Sport and Culture | 5/55 | ✅ | 13% | 0.20 | +67 | NO | yes | -0.20 | -0.20 |
| 2026-08-25 | DKS | Vertical Brand | 22/55 | ✅ | 41% | 0.09 | +50 | NO | no | +0.91 | +0.88 |
| 2026-08-25 | DKS | World Cup | 11/55 | ✅ | 23% | 0.05 | +72 | NO | yes | -0.05 | -0.05 |
| 2026-08-25 | INTU | Agentic | 5/50 | ❌ | 12% | 0.50 | +38 | NO | yes | -0.50 | -0.50 |
| 2026-08-25 | INTU | ARPU | 19/50 | ✅ | 40% | 0.34 | +26 | NO | no | +0.66 | +0.64 |
| 2026-08-25 | INTU | DIY | 36/50 | ✅ | 71% | 0.17 | +12 | NO | yes | -0.17 | -0.17 |
| 2026-08-25 | INTU | Intuit Enterprise Suite | 6/50 | ✅ | 16% | 0.07 | +77 | NO | yes | -0.07 | -0.07 |
| 2026-08-25 | INTU | Investor Day | 42/50 | ❌ | 80% | 0.09 | +11 | NO | yes | -0.09 | -0.09 |
| 2026-08-25 | INTU | Mailchimp | 18/50 | ✅ | 38% | 0.02 | +60 | NO | yes | -0.02 | -0.02 |
| 2026-08-25 | INTU | Online Payment | 29/50 | ✅ | 58% | 0.08 | +34 | NO | yes | -0.08 | -0.08 |
| 2026-08-25 | INTU | Pro Tax | 12/50 | ✅ | 27% | 0.13 | +60 | NO | no | +0.87 | +0.84 |
| 2026-08-25 | INTU | Restructuring | 5/50 | ✅ | 14% | 0.19 | +67 | NO | no | +0.81 | +0.79 |
| 2026-08-25 | INTU | TurboTax Live | 32/50 | ✅ | 64% | 0.12 | +24 | NO | yes | -0.12 | -0.12 |
| 2026-08-25 | ZM | Agentic | 5/28 | ✅ | 23% | 0.11 | +66 | NO | yes | -0.11 | -0.11 |
| 2026-08-25 | ZM | AI Companion | 10/28 | ✅ | 39% | 0.07 | +54 | NO | no | +0.93 | +0.90 |
| 2026-08-25 | ZM | Contact Center | 24/28 | ✅ | 82% | 0.04 | +14 | NO | yes | -0.04 | -0.04 |
| 2026-08-25 | ZM | Federal | 13/28 | ❌ | 45% | 0.20 | +25 | YES | no | -0.20 | -0.20 |
| 2026-08-25 | ZM | My Note | 0/28 | ✅ | 8% | 0.21 | +71 | NO | yes | -0.21 | -0.21 |
| 2026-08-25 | ZM | Scribe | 0/28 | ✅ | 8% | 0.68 | +24 | NO | no | +0.32 | +0.31 |
| 2026-08-25 | ZM | System of Action | 3/28 | ✅ | 17% | 0.14 | +69 | NO | yes | -0.14 | -0.14 |
| 2026-08-25 | ZM | Workvivo | 12/28 | ✅ | 45% | 0.13 | +42 | NO | yes | -0.13 | -0.13 |
| 2026-08-26 | CRM | Agentic Enterprise | 3/63 | ✅ | 8% | 0.08 | +84 | NO | no | +0.92 | +0.89 |
| 2026-08-26 | CRM | Anthropic | 9/63 | ✅ | 17% | 0.16 | +67 | NO | yes | -0.16 | -0.16 |
| 2026-08-26 | CRM | Commerce | 43/63 | ✅ | 68% | 0.07 | +25 | NO | yes | -0.07 | -0.07 |
| 2026-08-26 | CRM | Coworker | 0/63 | ✅ | 4% | 0.21 | +75 | NO | yes | -0.21 | -0.21 |
| 2026-08-26 | CRM | Customer Zero | 7/63 | ✅ | 14% | 0.24 | +62 | NO | yes | -0.24 | -0.24 |
| 2026-08-26 | CRM | Data 360 | 2/63 | ✅ | 7% | 0.10 | +83 | NO | yes | -0.10 | -0.10 |
| 2026-08-26 | CRM | Headless 360 | 0/63 | ✅ | 4% | 0.18 | +78 | NO | no | +0.82 | +0.80 |
| 2026-08-26 | CRM | Informatica | 4/63 | ✅ | 10% | 0.11 | +79 | NO | yes | -0.11 | -0.11 |
| 2026-08-26 | CRM | MCP | 1/63 | ✅ | 5% | 0.15 | +80 | NO | yes | -0.15 | -0.15 |
| 2026-08-26 | CRM | MuleSoft | 32/63 | ✅ | 51% | 0.11 | +38 | NO | yes | -0.11 | -0.11 |
| 2026-08-26 | CRM | OpenAI | 8/63 | ✅ | 15% | 0.30 | +55 | NO | yes | -0.30 | -0.30 |
| 2026-08-26 | CRM | Slackbot | 2/63 | ✅ | 7% | 0.16 | +77 | NO | yes | -0.16 | -0.16 |
| 2026-08-26 | CRM | Tableau | 27/63 | ✅ | 44% | 0.11 | +45 | NO | no | +0.89 | +0.86 |
| 2026-08-26 | CRM | Token | 2/63 | ✅ | 7% | 0.21 | +72 | NO | no | +0.79 | +0.77 |
| 2026-08-26 | CRWD | AI Detection | 2/28 | ✅ | 14% | 0.44 | +42 | NO | no | +0.56 | +0.54 |
| 2026-08-26 | CRWD | Cerebras | 0/28 | ❌ | 5% | 0.48 | +47 | NO | no | +0.52 | +0.50 |
| 2026-08-26 | CRWD | Claude | 2/28 | ✅ | 14% | 0.35 | +51 | NO | yes | -0.35 | -0.35 |
| 2026-08-26 | CRWD | Continuous Identity | 0/28 | ❌ | 5% | 0.50 | +45 | NO | no | +0.50 | +0.48 |
| 2026-08-26 | CRWD | Falcon Flex | 10/28 | ✅ | 39% | 0.02 | +59 | NO | yes | -0.02 | -0.02 |
| 2026-08-26 | CRWD | Mythos | 0/28 | ✅ | 8% | 0.22 | +70 | NO | yes | -0.22 | -0.22 |
| 2026-08-26 | CRWD | Nvidia | 5/28 | ✅ | 23% | 0.29 | +48 | NO | yes | -0.29 | -0.29 |
| 2026-08-26 | CRWD | OpenAI | 1/28 | ✅ | 11% | 0.23 | +66 | NO | no | +0.77 | +0.75 |
| 2026-08-26 | CRWD | Shadow | 3/28 | ✅ | 17% | 0.33 | +50 | NO | yes | -0.33 | -0.33 |
| 2026-08-26 | CRWD | Tailwind | 12/28 | ✅ | 45% | 0.26 | +29 | NO | yes | -0.26 | -0.26 |
| 2026-08-26 | CRWD | XM Cyber | 0/28 | ❌ | 5% | 0.37 | +58 | NO | yes | -0.37 | -0.37 |
| 2026-08-26 | NVDA | Automation | 14/62 | ❌ | 23% | 0.66 | +11 | NO | no | +0.34 | +0.33 |
| 2026-08-26 | NVDA | Cosmos | 5/62 | ❌ | 10% | 0.30 | +60 | NO | yes | -0.30 | -0.30 |
| 2026-08-26 | NVDA | Dividend (2+ times) | 0/62 | ❌ | 2% | 0.74 | +24 | NO | no | +0.26 | +0.25 |
| 2026-08-26 | NVDA | Gaming | 57/62 | ✅ | 90% | 0.67 | +23 | YES | no | -0.67 | -0.67 |
| 2026-08-26 | NVDA | Humanoid | 4/62 | ✅ | 10% | 0.37 | +53 | NO | no | +0.63 | +0.61 |
| 2026-08-26 | NVDA | Hyperscaler | 26/62 | ✅ | 43% | 0.01 | +56 | NO | yes | -0.01 | -0.01 |
| 2026-08-26 | NVDA | Omniverse | 21/62 | ❌ | 34% | 0.37 | +29 | NO | yes | -0.37 | -0.37 |
| 2026-08-26 | NVDA | Rent | 4/62 | ✅ | 10% | 0.77 | +13 | NO | yes | -0.77 | -0.77 |
| 2026-08-26 | NVDA | Self Driving | 0/62 | ❌ | 2% | 0.33 | +65 | NO | no | +0.67 | +0.65 |
| 2026-08-26 | NVDA | Talent | 5/62 | ❌ | 10% | 0.74 | +16 | NO | no | +0.26 | +0.25 |
| 2026-08-26 | URBN | Back to School | 16/57 | ❌ | 29% | 0.26 | +45 | NO | yes | -0.26 | -0.26 |
| 2026-08-26 | URBN | Beauty | 32/57 | ✅ | 56% | 0.37 | +19 | YES | yes | +0.63 | +0.61 |
| 2026-08-26 | URBN | Claude | 0/57 | ✅ | 4% | 0.82 | +14 | NO | no | +0.18 | +0.17 |
| 2026-08-26 | URBN | Gemini | 0/57 | ✅ | 4% | 0.81 | +15 | NO | no | +0.19 | +0.18 |
| 2026-08-26 | URBN | Headwind | 22/57 | ✅ | 40% | 0.35 | +25 | NO | yes | -0.35 | -0.35 |
| 2026-08-26 | URBN | Holiday | 45/57 | ❌ | 76% | 0.62 | +14 | YES | yes | +0.38 | +0.37 |
| 2026-08-26 | URBN | IEEPA | 0/57 | ❌ | 2% | 0.19 | +79 | NO | yes | -0.19 | -0.19 |
| 2026-08-26 | URBN | International / Internationally | 41/57 | ✅ | 71% | 0.59 | +12 | YES | yes | +0.41 | +0.40 |
| 2026-08-26 | URBN | Middle East | 5/57 | ✅ | 12% | 0.64 | +24 | NO | yes | -0.64 | -0.64 |
| 2026-08-26 | URBN | Refund | 0/57 | ✅ | 4% | 0.06 | +90 | NO | yes | -0.06 | -0.06 |
| 2026-08-26 | URBN | Store Opening | 26/57 | ✅ | 46% | 0.36 | +18 | NO | no | +0.64 | +0.62 |
| 2026-08-26 | URBN | Supply Chain | 31/57 | ❌ | 53% | 0.29 | +24 | YES | yes | +0.71 | +0.69 |
| 2026-08-26 | URBN | Tariff | 9/57 | ✅ | 19% | 0.07 | +74 | NO | yes | -0.07 | -0.07 |
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
| 2026-08-27 | ULTA | Iran / Middle East | 4/20 | ✅ | 27% | 0.22 | +51 | NO | yes | -0.22 | -0.22 |
| 2026-08-27 | ULTA | Rare Beauty | 1/20 | ✅ | 14% | 0.24 | +62 | NO | yes | -0.24 | -0.24 |
| 2026-08-27 | ULTA | Store Opening | 8/20 | ❌ | 39% | 0.27 | +12 | YES | yes | +0.73 | +0.71 |
| 2026-08-27 | ULTA | Tailwind | 8/20 | ✅ | 43% | 0.12 | +31 | YES | no | -0.12 | -0.12 |
| 2026-08-27 | ULTA | Tariff | 4/20 | ❌ | 23% | 0.63 | +14 | NO | no | +0.37 | +0.36 |
| 2026-08-27 | ULTA | TikTok | 10/20 | ✅ | 52% | 0.20 | +28 | NO | yes | -0.20 | -0.20 |
| 2026-08-27 | ULTA | Times Square | 0/20 | ✅ | 10% | 0.72 | +18 | NO | no | +0.28 | +0.27 |
| 2026-08-27 | ULTA | Traffic | 17/20 | ✅ | 80% | 0.62 | +18 | YES | yes | +0.38 | +0.37 |
| 2026-08-27 | ULTA | Uncertainty | 11/20 | ✅ | 56% | 0.06 | +38 | NO | yes | -0.06 | -0.06 |
| 2026-09-01 | MDT | Abbott | 5/7 | ❌ | 57% | 0.13 | +44 | YES | no | -0.13 | -0.13 |
| 2026-09-01 | MDT | China | 6/7 | ✅ | 75% | 0.62 | +13 | YES | no | -0.62 | -0.62 |
| 2026-09-01 | MDT | MiniMed | 6/7 | ✅ | 75% | 0.09 | +16 | NO | yes | -0.09 | -0.09 |
| 2026-09-01 | MDT | PulseSelect | 5/7 | ❌ | 57% | 0.26 | +31 | YES | yes | +0.74 | +0.72 |
| 2026-09-01 | MDT | Simplera | 7/7 | ❌ | 75% | 0.23 | +52 | YES | no | -0.23 | -0.23 |
| 2026-09-01 | MDT | Sphere-9 | 6/7 | ✅ | 75% | 0.08 | +17 | NO | yes | -0.08 | -0.08 |
| 2026-09-01 | MDT | Tariff | 5/7 | ✅ | 67% | 0.06 | +27 | NO | yes | -0.06 | -0.06 |
| 2026-09-01 | PANW | Cortex Cloud | 4/7 | ✅ | 58% | 0.21 | +21 | NO | no | +0.79 | +0.77 |
| 2026-09-01 | PANW | Frontier | 2/7 | ✅ | 41% | 0.05 | +54 | NO | yes | -0.05 | -0.05 |
| 2026-09-01 | PANW | Mythos | 0/7 | ✅ | 24% | 0.38 | +38 | NO | yes | -0.38 | -0.38 |
| 2026-09-01 | PANW | Open Source | 2/7 | ✅ | 41% | 0.44 | +15 | NO | yes | -0.44 | -0.44 |
| 2026-09-01 | PANW | Protect AI | 4/7 | ❌ | 49% | 0.25 | +24 | YES | no | -0.25 | -0.25 |
| 2026-09-01 | PANW | QRadar | 5/7 | ❌ | 57% | 0.15 | +42 | YES | no | -0.15 | -0.15 |
| 2026-09-01 | PANW | Tailwind | 2/7 | ✅ | 41% | 0.38 | +21 | NO | yes | -0.38 | -0.38 |
| 2026-09-01 | PANW | Tariff | 3/7 | ❌ | 40% | 0.13 | +27 | YES | no | -0.13 | -0.13 |
| 2026-09-01 | PANW | XSIAM | 6/7 | ✅ | 75% | 0.02 | +23 | NO | yes | -0.02 | -0.02 |
| 2026-09-02 | AVGO | Acquisition | 37/44 | ❌ | 80% | 0.16 | +64 | YES | no | -0.16 | -0.16 |
| 2026-09-02 | AVGO | Anthropic | 2/44 | ✅ | 9% | 0.08 | +83 | NO | yes | -0.08 | -0.08 |
| 2026-09-02 | AVGO | Ethernet | 23/44 | ✅ | 53% | 0.21 | +26 | NO | yes | -0.21 | -0.21 |
| 2026-09-02 | AVGO | Google | 6/44 | ✅ | 17% | 0.17 | +66 | NO | yes | -0.17 | -0.17 |
| 2026-09-02 | AVGO | Hyperscaler | 18/44 | ✅ | 42% | 0.16 | +42 | NO | yes | -0.16 | -0.16 |
| 2026-09-02 | AVGO | Jericho 4 | 1/44 | ✅ | 7% | 0.55 | +38 | NO | no | +0.45 | +0.44 |
| 2026-09-02 | AVGO | Meta | 2/44 | ✅ | 9% | 0.22 | +69 | NO | yes | -0.22 | -0.22 |
| 2026-09-02 | AVGO | Open Source | 2/44 | ❌ | 7% | 0.75 | +18 | NO | no | +0.25 | +0.24 |
| 2026-09-02 | AVGO | OpenAI | 2/44 | ✅ | 9% | 0.05 | +86 | NO | yes | -0.05 | -0.05 |
| 2026-09-02 | AVGO | Optic | 23/44 | ✅ | 53% | 0.39 | +14 | YES | no | -0.39 | -0.39 |
| 2026-09-02 | AVGO | Tomahawk 6 | 7/44 | ✅ | 20% | 0.25 | +55 | NO | yes | -0.25 | -0.25 |
| 2026-09-02 | AVGO | VMware | 16/44 | ✅ | 38% | 0.07 | +55 | NO | yes | -0.07 | -0.07 |
| 2026-09-02 | HPE | Alletra | 17/20 | ✅ | 80% | 0.04 | +16 | NO | yes | -0.04 | -0.04 |
| 2026-09-02 | HPE | Automation | 10/20 | ✅ | 52% | 0.30 | +18 | NO | no | +0.70 | +0.68 |
| 2026-09-02 | HPE | Department of Energy | 8/20 | ❌ | 39% | 0.16 | +23 | YES | no | -0.16 | -0.16 |
| 2026-09-02 | HPE | Government | 7/20 | ✅ | 39% | 0.41 | +20 | NO | no | +0.59 | +0.57 |
| 2026-09-02 | HPE | Headwind | 19/20 | ❌ | 85% | 0.53 | +32 | YES | no | -0.53 | -0.53 |
| 2026-09-02 | HPE | Morpheus | 5/20 | ✅ | 31% | 0.22 | +47 | NO | no | +0.78 | +0.76 |
| 2026-09-02 | HPE | Private Cloud AI | 7/20 | ✅ | 39% | 0.11 | +50 | NO | yes | -0.11 | -0.11 |
| 2026-09-02 | HPE | Quantum | 3/20 | ❌ | 19% | 0.55 | +26 | NO | no | +0.45 | +0.44 |
| 2026-09-02 | HPE | Self Driving | 0/20 | ❌ | 6% | 0.11 | +83 | NO | yes | -0.11 | -0.11 |
| 2026-09-02 | HPE | Tailwind | 7/20 | ✅ | 39% | 0.47 | +14 | NO | no | +0.53 | +0.51 |
| 2026-09-02 | SNOW | Azure | 14/22 | ✅ | 63% | 0.33 | +30 | YES | yes | +0.67 | +0.65 |
| 2026-09-02 | SNOW | Claude | 2/22 | ✅ | 17% | 0.62 | +21 | NO | no | +0.38 | +0.37 |
| 2026-09-02 | SNOW | Competition | 6/22 | ✅ | 32% | 0.20 | +12 | YES | no | -0.20 | -0.20 |
| 2026-09-02 | SNOW | Europe | 14/22 | ❌ | 59% | 0.43 | +16 | YES | no | -0.43 | -0.43 |
| 2026-09-02 | SNOW | OpenAI | 5/22 | ✅ | 28% | 0.20 | +52 | NO | yes | -0.20 | -0.20 |
| 2026-09-02 | SNOW | Open Source | 3/22 | ✅ | 21% | 0.56 | +23 | NO | yes | -0.56 | -0.56 |
| 2026-09-02 | SNOW | Snowflake Intelligence | 5/22 | ✅ | 28% | 0.41 | +31 | NO | no | +0.59 | +0.57 |
| 2026-09-03 | CIEN | Headwind | 5/7 | ❌ | 57% | 0.47 | +10 | YES | no | -0.47 | -0.47 |
| 2026-09-03 | CIEN | Hyperscaler | 5/7 | ✅ | 67% | 0.09 | +24 | NO | yes | -0.09 | -0.09 |
| 2026-09-03 | CIEN | Multi-Rail / Hyper Rail | 1/7 | ✅ | 32% | 0.04 | +64 | NO | yes | -0.04 | -0.04 |
| 2026-09-03 | CIEN | Neoscaler | 3/7 | ✅ | 49% | 0.16 | +35 | NO | yes | -0.16 | -0.16 |
| 2026-09-03 | CIEN | RLS | 7/7 | ✅ | 84% | 0.02 | +14 | NO | yes | -0.02 | -0.02 |
| 2026-09-03 | CIEN | Subsea | 5/7 | ❌ | 57% | 0.28 | +29 | YES | yes | +0.72 | +0.70 |
| 2026-09-03 | CIEN | Tariff | 6/7 | ❌ | 66% | 0.33 | +33 | YES | yes | +0.67 | +0.65 |
| 2026-09-03 | DELL | Agentic | 4/21 | ✅ | 26% | 0.16 | +58 | NO | yes | -0.16 | -0.16 |
| 2026-09-03 | DELL | AI Factory | 5/21 | ✅ | 30% | 0.19 | +51 | NO | yes | -0.19 | -0.19 |
| 2026-09-03 | DELL | China | 6/21 | ❌ | 30% | 0.15 | +15 | YES | no | -0.15 | -0.15 |
| 2026-09-03 | DELL | Dividend (3+ times) | 0/21 | ❌ | 6% | 0.72 | +22 | NO | yes | -0.72 | -0.72 |
| 2026-09-03 | DELL | Headwind | 16/21 | ❌ | 70% | 0.24 | +46 | YES | no | -0.24 | -0.24 |
| 2026-09-03 | DELL | Lightning | 6/21 | ✅ | 34% | 0.45 | +21 | NO | yes | -0.45 | -0.45 |
| 2026-09-03 | DELL | Nvidia | 10/21 | ✅ | 49% | 0.20 | +31 | NO | yes | -0.20 | -0.20 |
| 2026-09-03 | DELL | Secure AI Alliance | 0/21 | ❌ | 6% | 0.76 | +18 | NO | no | +0.24 | +0.23 |
| 2026-09-03 | DELL | Tailwind | 13/21 | ✅ | 61% | 0.47 | +14 | YES | yes | +0.53 | +0.51 |
| 2026-09-03 | LULU | Daydrift | 4/56 | ✅ | 11% | 0.43 | +46 | NO | no | +0.57 | +0.55 |
| 2026-09-03 | LULU | Headwind | 30/56 | ✅ | 54% | 0.22 | +24 | NO | yes | -0.22 | -0.22 |
| 2026-09-03 | LULU | Holiday | 44/56 | ❌ | 76% | 0.21 | +55 | YES | no | -0.21 | -0.21 |
| 2026-09-03 | LULU | Iran / Middle East | 5/56 | ✅ | 12% | 0.58 | +30 | NO | yes | -0.58 | -0.58 |
| 2026-09-03 | LULU | Marathon | 14/56 | ✅ | 27% | 0.24 | +49 | NO | yes | -0.24 | -0.24 |
| 2026-09-03 | LULU | ShowZero | 3/56 | ❌ | 7% | 0.71 | +22 | NO | no | +0.29 | +0.28 |
| 2026-09-03 | LULU | Tariff | 10/56 | ✅ | 21% | 0.04 | +75 | NO | yes | -0.04 | -0.04 |
| 2026-09-08 | ORCL | AMD | 5/63 | ❌ | 10% | 0.52 | +38 | NO | no | +0.48 | +0.47 |
| 2026-09-08 | ORCL | Automation | 29/63 | ❌ | 45% | 0.21 | +24 | YES | yes | +0.79 | +0.77 |
| 2026-09-08 | ORCL | Backlog | 19/63 | ❌ | 31% | 0.51 | +18 | NO | no | +0.49 | +0.48 |
| 2026-09-08 | ORCL | Java | 27/63 | ❌ | 42% | 0.03 | +39 | YES | no | -0.03 | -0.03 |
| 2026-09-08 | ORCL | Multicloud | 1/63 | ❌ | 4% | 0.05 | +91 | NO | yes | -0.05 | -0.05 |
| 2026-09-08 | ORCL | Nvidia | 15/63 | ❌ | 25% | 0.50 | +25 | NO | yes | -0.50 | -0.50 |
| 2026-09-08 | ORCL | OpenAI | 8/63 | ❌ | 14% | 0.63 | +23 | NO | yes | -0.63 | -0.63 |
| 2026-09-08 | ORCL | Sovereign | 9/63 | ❌ | 16% | 0.66 | +18 | NO | yes | -0.66 | -0.66 |
| 2026-09-08 | ORCL | Stargate | 2/63 | ❌ | 5% | 0.58 | +37 | NO | no | +0.42 | +0.41 |
| 2026-09-08 | ORCL | TikTok | 6/63 | ❌ | 11% | 0.01 | +10 | YES | no | -0.01 | -0.01 |
| 2026-09-09 | CHWY | Chewy+ / Chewy Plus | 8/24 | ✅ | 37% | 0.24 | +39 | NO | yes | -0.24 | -0.24 |
| 2026-09-09 | CHWY | Holiday | 18/24 | ❌ | 69% | 0.24 | +45 | YES | yes | +0.76 | +0.74 |
| 2026-09-09 | CHWY | Loyalty | 17/24 | ❌ | 66% | 0.42 | +24 | YES | yes | +0.58 | +0.56 |
| 2026-09-09 | CHWY | Modern Animal | 0/24 | ✅ | 9% | 0.13 | +78 | NO | yes | -0.13 | -0.13 |
| 2026-09-09 | CHWY | Vet Care / Veterinary | 14/24 | ✅ | 58% | 0.05 | +37 | NO | yes | -0.05 | -0.05 |
| 2026-09-10 | ADBE | 3D | 30/59 | ✅ | 51% | 0.32 | +17 | NO | yes | -0.32 | -0.32 |
| 2026-09-10 | ADBE | Anthropic | 1/59 | ✅ | 5% | 0.44 | +51 | NO | no | +0.56 | +0.54 |
| 2026-09-10 | ADBE | Generative AI / Gen AI | 14/59 | ❌ | 25% | 0.41 | +34 | NO | no | +0.59 | +0.57 |
| 2026-09-10 | ADBE | GenStudio | 10/59 | ✅ | 20% | 0.07 | +73 | NO | yes | -0.07 | -0.07 |
| 2026-09-10 | ADBE | LLM Optimizer | 3/59 | ✅ | 9% | 0.42 | +49 | NO | yes | -0.42 | -0.42 |
| 2026-09-10 | ADBE | Nvidia | 4/59 | ✅ | 10% | 0.43 | +47 | NO | no | +0.57 | +0.55 |
| 2026-09-10 | ADBE | OpenAI | 5/59 | ✅ | 12% | 0.12 | +76 | NO | no | +0.88 | +0.85 |
| 2026-09-10 | ADBE | Semrush | 2/59 | ✅ | 7% | 0.06 | +87 | NO | yes | -0.06 | -0.06 |
| 2026-09-10 | ADBE | Tailwind | 37/59 | ✅ | 62% | 0.26 | +12 | NO | yes | -0.26 | -0.26 |
| 2026-09-10 | ADBE | Topaz Labs | 1/59 | ❌ | 4% | 0.07 | +89 | NO | yes | -0.07 | -0.07 |
| 2026-09-10 | M | AI | 7/32 | ✅ | 26% | 0.13 | +61 | NO | yes | -0.13 | -0.13 |
| 2026-09-10 | M | Amazon | 3/32 | ✅ | 15% | 0.51 | +34 | NO | no | +0.49 | +0.48 |
| 2026-09-10 | M | Asset Sale | 29/32 | ❌ | 84% | 0.27 | +57 | YES | no | -0.27 | -0.27 |
| 2026-09-10 | M | Automation | 12/32 | ✅ | 40% | 0.46 | +14 | NO | yes | -0.46 | -0.46 |
| 2026-09-10 | M | Backstage | 27/32 | ✅ | 81% | 0.62 | +19 | YES | no | -0.62 | -0.62 |
| 2026-09-10 | M | China | 12/32 | ✅ | 40% | 0.34 | +26 | NO | yes | -0.34 | -0.34 |
| 2026-09-10 | M | Dividend | 28/32 | ✅ | 84% | 0.03 | +13 | NO | yes | -0.03 | -0.03 |
| 2026-09-10 | M | Headwind | 24/32 | ✅ | 73% | 0.56 | +17 | YES | yes | +0.44 | +0.43 |
| 2026-09-10 | M | Private Brand | 31/32 | ✅ | 93% | 0.72 | +21 | YES | yes | +0.28 | +0.27 |
| 2026-09-10 | M | Real Estate | 20/32 | ❌ | 60% | 0.30 | +30 | YES | no | -0.30 | -0.30 |
| 2026-09-11 | KR | AI | 10/23 | ✅ | 46% | 0.06 | +48 | NO | no | +0.94 | +0.91 |
| 2026-09-11 | KR | Albertsons | 10/23 | ❌ | 42% | 0.14 | +28 | YES | no | -0.14 | -0.14 |
| 2026-09-11 | KR | Aldi | 1/23 | ✅ | 13% | 0.77 | +10 | NO | no | +0.23 | +0.22 |
| 2026-09-11 | KR | Deflation | 6/23 | ✅ | 31% | 0.45 | +24 | NO | yes | -0.45 | -0.45 |
| 2026-09-11 | KR | Dividend | 20/23 | ❌ | 79% | 0.07 | +14 | NO | no | +0.93 | +0.90 |
| 2026-09-11 | KR | Economy | 9/23 | ❌ | 39% | 0.22 | +17 | YES | no | -0.22 | -0.22 |
| 2026-09-11 | KR | Giant Eagle | 0/23 | ❌ | 6% | 0.04 | +90 | NO | yes | -0.04 | -0.04 |
| 2026-09-11 | KR | GLP-1 | 10/23 | ✅ | 46% | 0.14 | +40 | NO | yes | -0.14 | -0.14 |
| 2026-09-11 | KR | Iran / Middle East | 0/23 | ✅ | 9% | 0.78 | +13 | NO | no | +0.22 | +0.21 |
| 2026-09-11 | KR | Produce | 16/23 | ✅ | 68% | 0.48 | +20 | YES | yes | +0.52 | +0.50 |

*Prior = calls that said the word / prior calls on record. Last = the most recent pre-event call said the word (✅) or not (❌) — it drives the baseline's transition prior (0.67 vs 0.243).*
