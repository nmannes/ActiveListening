# Earnings Backtest

Generated 2026-08-13

## Strategy

For each finalized word market: baseline P from transcripts of calls before the event vs the executable price ~24h before the market resolved (the YES ask, or last trade without orderbook data). Bet the undervalued side: YES when baseline > YES price, NO when 1 − baseline > NO price; skip when neither side is undervalued; settle at the actual resolution. Gap = edge on the chosen side.

## Coverage

- 4663 finalized markets with history fetched
- 4363 with a price ~24h before resolution
- 492 with a transcript baseline (pre-event calls)
- 491 tradable (both price and baseline)

- fee: 3% on profit

## Threshold sweep (min |gap|)

Net if always YES / always NO shows the same candidates traded on one fixed side — the benchmark the side selection must beat.

| Min |gap| | Trades | Wins | Win rate | Gross | Net | YES (n/wins/net) | NO (n/wins/net) | Always YES | Always NO |
|---|---|---|---|---|---|---|---|---|---|---|
| 0.00 | 491 | 180 | 37% | +33.26 | +30.11 | 167 / 54 / -0.45 | 324 / 126 / +30.56 | -34.37 | +29.06 |
| 0.05 | 396 | 139 | 35% | +34.00 | +31.37 | 113 / 37 / +4.85 | 283 / 102 / +26.52 | -24.58 | +20.34 |
| 0.10 | 312 | 113 | 36% | +35.99 | +33.78 | 76 / 28 / +8.29 | 236 / 85 / +25.48 | -19.63 | +16.28 |
| 0.15 | 232 | 81 | 35% | +26.15 | +24.53 | 53 / 18 / +5.77 | 179 / 63 / +18.76 | -14.85 | +12.39 |
| 0.20 | 172 | 61 | 35% | +22.49 | +21.23 | 31 / 9 / +3.96 | 141 / 52 / +17.26 | -14.82 | +12.97 |
| 0.25 | 128 | 43 | 34% | +17.32 | +16.38 | 17 / 4 / +1.82 | 111 / 39 / +14.56 | -13.96 | +12.60 |
| 0.30 | 99 | 33 | 33% | +13.46 | +12.75 | 10 / 3 / +2.00 | 89 / 30 / +10.75 | -9.67 | +8.65 |

## Per company (min |gap| 0.10)

| Company | Trades | Wins | Net |
|---|---|---|---|
| AMD | 11 | 3 | +0.48 |
| CAVA | 14 | 3 | -0.55 |
| CELH | 6 | 4 | +1.73 |
| CRWD | 16 | 5 | +0.87 |
| DIS | 22 | 8 | +2.39 |
| DKNG | 7 | 2 | +0.36 |
| HD | 11 | 5 | +1.77 |
| HIMS | 10 | 3 | +0.69 |
| KLAR | 10 | 6 | +4.63 |
| MCD | 31 | 7 | -0.01 |
| NBIS | 18 | 7 | +2.16 |
| NVDA | 22 | 11 | +3.25 |
| PGR | 11 | 3 | +1.73 |
| SHOP | 6 | 1 | -0.04 |
| SPOT | 16 | 9 | +5.31 |
| TGT | 15 | 7 | +2.76 |
| TOL | 8 | 3 | +0.27 |
| TOST | 9 | 0 | -1.53 |
| UBER | 16 | 8 | +4.11 |
| ULTA | 15 | 2 | -1.17 |
| URBN | 8 | 3 | +0.66 |
| WMT | 20 | 10 | +4.08 |
| ZETA | 10 | 3 | -0.17 |

## Trades (min |gap| 0.10)

| Event | Company | Word | Baseline | Price | Gap | Side | Result | Gross | Net |
|---|---|---|---|---|---|---|---|---|---|
| 2025-11-05 | CELH | Alcohol | 19% | 0.59 | +22 | NO | no | +0.41 | +0.40 |
| 2025-11-05 | CELH | Amazon | 78% | 0.10 | +12 | NO | no | +0.90 | +0.87 |
| 2025-11-05 | CELH | Competition | 64% | 0.47 | +17 | YES | no | -0.47 | -0.47 |
| 2025-11-05 | CELH | Influencer | 45% | 0.40 | +15 | NO | no | +0.60 | +0.58 |
| 2025-11-05 | CELH | NFL | 33% | 0.49 | +18 | NO | no | +0.51 | +0.49 |
| 2025-11-05 | CELH | PepsiCo | 67% | 0.15 | +18 | NO | yes | -0.15 | -0.15 |
| 2025-11-06 | DKNG | CFTC | 30% | 0.43 | +27 | NO | no | +0.57 | +0.55 |
| 2025-11-06 | DKNG | iGaming | 78% | 0.05 | +17 | NO | yes | -0.05 | -0.05 |
| 2025-11-06 | DKNG | Marketing | 78% | 0.11 | +11 | NO | yes | -0.11 | -0.11 |
| 2025-11-06 | DKNG | Missouri | 56% | 0.11 | +33 | NO | yes | -0.11 | -0.11 |
| 2025-11-06 | DKNG | NBC | 19% | 0.35 | +46 | NO | no | +0.65 | +0.63 |
| 2025-11-06 | DKNG | Prediction | 67% | 0.02 | +31 | NO | yes | -0.02 | -0.02 |
| 2025-11-06 | DKNG | Regulation | 30% | 0.53 | +17 | NO | yes | -0.53 | -0.53 |
| 2025-11-11 | CAVA | Acceleration | 48% | 0.31 | +17 | YES | no | -0.31 | -0.31 |
| 2025-11-11 | CAVA | AUV | 80% | 0.05 | +15 | NO | yes | -0.05 | -0.05 |
| 2025-11-11 | CAVA | Digital | 80% | 0.08 | +12 | NO | yes | -0.08 | -0.08 |
| 2025-11-11 | CAVA | Dining | 80% | 0.66 | +14 | YES | yes | +0.34 | +0.33 |
| 2025-11-11 | CAVA | Hyphen | 27% | 0.37 | +36 | NO | no | +0.63 | +0.61 |
| 2025-11-11 | CAVA | Loyalty | 80% | 0.09 | +11 | NO | yes | -0.09 | -0.09 |
| 2025-11-11 | CAVA | Spice | 50% | 0.38 | +12 | YES | yes | +0.62 | +0.60 |
| 2025-11-11 | CAVA | Salmon | 40% | 0.29 | +31 | NO | yes | -0.29 | -0.29 |
| 2025-11-11 | NBIS | Aether | 19% | 0.25 | +56 | NO | yes | -0.25 | -0.25 |
| 2025-11-11 | NBIS | ClickHouse / Click House | 78% | 0.11 | +11 | NO | no | +0.89 | +0.86 |
| 2025-11-11 | NBIS | Hyperscaler | 56% | 0.33 | +11 | NO | no | +0.67 | +0.65 |
| 2025-11-11 | NBIS | Microsoft | 30% | 0.03 | +67 | NO | yes | -0.03 | -0.03 |
| 2025-11-11 | NBIS | Neocloud | 30% | 0.53 | +17 | NO | yes | -0.53 | -0.53 |
| 2025-11-11 | NBIS | Token | 30% | 0.20 | +50 | NO | yes | -0.20 | -0.20 |
| 2025-11-13 | DIS | Abu Dhabi | 45% | 0.28 | +27 | NO | yes | -0.28 | -0.28 |
| 2025-11-13 | DIS | Competition | 78% | 0.10 | +12 | NO | yes | -0.10 | -0.10 |
| 2025-11-13 | DIS | Cruise | 78% | 0.02 | +20 | NO | yes | -0.02 | -0.02 |
| 2025-11-13 | DIS | DraftKings | 19% | 0.21 | +60 | NO | no | +0.79 | +0.77 |
| 2025-11-13 | DIS | ESPN | 78% | 0.01 | +21 | NO | yes | -0.01 | -0.01 |
| 2025-11-13 | DIS | Margin | 67% | 0.11 | +22 | NO | yes | -0.11 | -0.11 |
| 2025-11-13 | DIS | Moana 2 | 41% | 0.13 | +28 | YES | no | -0.13 | -0.13 |
| 2025-11-13 | DIS | Subscriber | 78% | 0.06 | +16 | NO | yes | -0.06 | -0.06 |
| 2025-11-13 | DIS | YouTube TV | 19% | 0.44 | +37 | NO | no | +0.56 | +0.54 |
| 2025-11-13 | DIS | Zootopia | 67% | 0.08 | +25 | NO | yes | -0.08 | -0.08 |
| 2025-11-18 | HD | Black Friday | 53% | 0.09 | +38 | NO | yes | -0.09 | -0.09 |
| 2025-11-18 | HD | Revenue | 45% | 0.30 | +15 | YES | no | -0.30 | -0.30 |
| 2025-11-18 | HD | Synergy | 30% | 0.45 | +25 | NO | yes | -0.45 | -0.45 |
| 2025-11-18 | HD | Tariff | 67% | 0.14 | +19 | NO | yes | -0.14 | -0.14 |
| 2025-11-18 | HD | Volatility | 45% | 0.35 | +20 | NO | no | +0.65 | +0.63 |
| 2025-11-19 | TGT | Beauty | 78% | 0.04 | +18 | NO | yes | -0.04 | -0.04 |
| 2025-11-19 | TGT | Black Friday | 41% | 0.05 | +54 | NO | no | +0.95 | +0.92 |
| 2025-11-19 | TGT | Circle 360 | 78% | 0.08 | +14 | NO | yes | -0.08 | -0.08 |
| 2025-11-19 | TGT | Competition | 45% | 0.25 | +20 | YES | no | -0.25 | -0.25 |
| 2025-11-19 | TGT | Holiday | 78% | 0.07 | +15 | NO | yes | -0.07 | -0.07 |
| 2025-11-19 | TGT | Labor | 56% | 0.37 | +19 | YES | yes | +0.63 | +0.61 |
| 2025-11-19 | TGT | Netflix | 19% | 0.36 | +45 | NO | no | +0.64 | +0.62 |
| 2025-11-19 | TGT | Revenue | 53% | 0.37 | +16 | YES | no | -0.37 | -0.37 |
| 2025-12-02 | CRWD | Acquisition | 56% | 0.10 | +34 | NO | yes | -0.10 | -0.10 |
| 2025-12-02 | CRWD | Consolidation | 78% | 0.09 | +13 | NO | yes | -0.09 | -0.09 |
| 2025-12-02 | CRWD | Falcon Flex | 78% | 0.04 | +18 | NO | yes | -0.04 | -0.04 |
| 2025-12-02 | CRWD | Hack / Hacker | 19% | 0.06 | +13 | YES | yes | +0.94 | +0.91 |
| 2025-12-02 | CRWD | Microsoft | 53% | 0.30 | +23 | YES | no | -0.30 | -0.30 |
| 2025-12-02 | CRWD | Nvidia | 45% | 0.19 | +36 | NO | yes | -0.19 | -0.19 |
| 2025-12-04 | ULTA | Holiday | 78% | 0.04 | +18 | NO | yes | -0.04 | -0.04 |
| 2025-12-04 | ULTA | Luxury | 53% | 0.41 | +12 | YES | yes | +0.59 | +0.57 |
| 2025-12-04 | ULTA | Market Share | 78% | 0.09 | +13 | NO | yes | -0.09 | -0.09 |
| 2025-12-04 | ULTA | Space NK | 33% | 0.32 | +35 | NO | yes | -0.32 | -0.32 |
| 2025-12-04 | ULTA | Target | 67% | 0.12 | +21 | NO | yes | -0.12 | -0.12 |
| 2025-12-04 | ULTA | Uncertainty | 67% | 0.12 | +21 | NO | yes | -0.12 | -0.12 |
| 2025-12-04 | ULTA | Wicked | 30% | 0.30 | +40 | NO | no | +0.70 | +0.68 |
| 2026-03-31 | MCD | Buffalo | 17% | 0.02 | +15 | YES | no | -0.02 | -0.02 |
| 2026-03-31 | MCD | Competition | 70% | 0.01 | +69 | YES | no | -0.01 | -0.01 |
| 2026-03-31 | MCD | Delivery | 38% | 0.05 | +57 | NO | yes | -0.05 | -0.05 |
| 2026-03-31 | MCD | Dividend | 60% | 0.01 | +39 | NO | yes | -0.01 | -0.01 |
| 2026-03-31 | MCD | Happy Meal | 58% | 0.02 | +40 | NO | yes | -0.02 | -0.02 |
| 2026-03-31 | MCD | Loyalty | 70% | 0.01 | +29 | NO | yes | -0.01 | -0.01 |
| 2026-03-31 | MCD | McCrispy Chicken | 48% | 0.03 | +45 | YES | no | -0.03 | -0.03 |
| 2026-03-31 | MCD | Monopoly | 40% | 0.01 | +59 | NO | yes | -0.01 | -0.01 |
| 2026-03-31 | MCD | Revenue | 29% | 0.05 | +24 | YES | no | -0.05 | -0.05 |
| 2026-03-31 | MCD | Speedee Lab | 27% | 0.14 | +13 | YES | no | -0.14 | -0.14 |
| 2026-03-31 | MCD | Supply Chain | 60% | 0.01 | +39 | NO | yes | -0.01 | -0.01 |
| 2026-03-31 | MCD | Tariff | 58% | 0.01 | +41 | NO | yes | -0.01 | -0.01 |
| 2026-03-31 | NVDA | Arizona | 25% | 0.35 | +40 | NO | no | +0.65 | +0.63 |
| 2026-03-31 | NVDA | Automation | 34% | 0.44 | +22 | NO | yes | -0.44 | -0.44 |
| 2026-03-31 | NVDA | Domestic | 25% | 0.55 | +20 | NO | no | +0.45 | +0.44 |
| 2026-03-31 | NVDA | Gaming | 82% | 0.03 | +15 | NO | yes | -0.03 | -0.03 |
| 2026-03-31 | NVDA | H20 | 44% | 0.09 | +47 | NO | yes | -0.09 | -0.09 |
| 2026-03-31 | NVDA | Humanoid | 44% | 0.38 | +18 | NO | no | +0.62 | +0.60 |
| 2026-03-31 | NVDA | Hyperscaler | 64% | 0.17 | +19 | NO | yes | -0.17 | -0.17 |
| 2026-03-31 | NVDA | Omniverse | 73% | 0.15 | +12 | NO | yes | -0.15 | -0.15 |
| 2026-03-31 | NVDA | Self Driving | 15% | 0.39 | +46 | NO | yes | -0.39 | -0.39 |
| 2026-03-31 | NVDA | Trump | 25% | 0.59 | +16 | NO | no | +0.41 | +0.40 |
| 2026-03-31 | NVDA | TSMC | 53% | 0.29 | +18 | NO | yes | -0.29 | -0.29 |
| 2026-03-31 | WMT | Automotive | 53% | 0.33 | +14 | NO | yes | -0.33 | -0.33 |
| 2026-03-31 | WMT | Brick and Mortar | 34% | 0.44 | +22 | NO | no | +0.56 | +0.54 |
| 2026-03-31 | WMT | Omnichannel | 82% | 0.68 | +14 | YES | yes | +0.32 | +0.31 |
| 2026-03-31 | WMT | OnePay / One Pay | 45% | 0.23 | +32 | NO | yes | -0.23 | -0.23 |
| 2026-03-31 | WMT | OpenAI | 36% | 0.25 | +40 | NO | yes | -0.25 | -0.25 |
| 2026-03-31 | WMT | Prescription | 34% | 0.41 | +25 | NO | no | +0.59 | +0.57 |
| 2026-03-31 | WMT | Shutdown / Shut Down | 26% | 0.62 | +12 | NO | no | +0.38 | +0.37 |
| 2026-03-31 | WMT | SNAP | 25% | 0.44 | +31 | NO | no | +0.56 | +0.54 |
| 2026-03-31 | WMT | Tariff | 64% | 0.05 | +31 | NO | yes | -0.05 | -0.05 |
| 2026-03-31 | WMT | Upper Income | 25% | 0.42 | +33 | NO | no | +0.58 | +0.56 |
| 2026-04-15 | PGR | AI / Artificial Intelligence | 40% | 0.05 | +55 | NO | yes | -0.05 | -0.05 |
| 2026-04-15 | PGR | Buyback | 27% | 0.03 | +70 | NO | no | +0.97 | +0.94 |
| 2026-04-15 | PGR | Catastrophe | 60% | 0.21 | +19 | NO | no | +0.79 | +0.77 |
| 2026-04-15 | PGR | Headwind | 60% | 0.01 | +59 | YES | yes | +0.99 | +0.96 |
| 2026-04-15 | PGR | Inflation | 70% | 0.05 | +25 | NO | yes | -0.05 | -0.05 |
| 2026-04-15 | PGR | M&A / Acquisition | 80% | 0.04 | +16 | NO | yes | -0.04 | -0.04 |
| 2026-04-15 | PGR | Snapshot | 60% | 0.01 | +59 | YES | no | -0.01 | -0.01 |
| 2026-04-28 | SPOT | Bookshop / Bookshop.org | 29% | 0.32 | +39 | NO | no | +0.68 | +0.66 |
| 2026-04-28 | SPOT | Churn | 80% | 0.08 | +12 | NO | yes | -0.08 | -0.08 |
| 2026-04-28 | SPOT | Headwind | 60% | 0.22 | +18 | NO | no | +0.78 | +0.76 |
| 2026-04-28 | SPOT | Message | 38% | 0.52 | +10 | NO | no | +0.48 | +0.47 |
| 2026-04-28 | SPOT | Monetization | 80% | 0.06 | +14 | NO | yes | -0.06 | -0.06 |
| 2026-04-28 | SPOT | Physical | 29% | 0.45 | +26 | NO | no | +0.55 | +0.53 |
| 2026-04-28 | SPOT | Retain / Retention | 80% | 0.04 | +16 | NO | yes | -0.04 | -0.04 |
| 2026-05-05 | SHOP | Acquired / Acquisition | 73% | 0.12 | +15 | NO | yes | -0.12 | -0.12 |
| 2026-05-05 | SHOP | OpenAI | 64% | 0.26 | +10 | NO | yes | -0.26 | -0.26 |
| 2026-05-05 | SHOP | Repurchase / Buyback | 26% | 0.29 | +45 | NO | yes | -0.29 | -0.29 |
| 2026-05-05 | SHOP | Service | 82% | 0.06 | +12 | NO | yes | -0.06 | -0.06 |
| 2026-05-05 | SHOP | Shop Pay | 73% | 0.02 | +25 | NO | yes | -0.02 | -0.02 |
| 2026-05-05 | SHOP | Shopify Capital  | 45% | 0.27 | +28 | NO | no | +0.73 | +0.71 |
| 2026-05-06 | DIS | Abu Dhabi | 54% | 0.26 | +20 | NO | yes | -0.26 | -0.26 |
| 2026-05-06 | DIS | Buyback | 15% | 0.63 | +22 | NO | no | +0.37 | +0.36 |
| 2026-05-06 | DIS | Competition | 82% | 0.07 | +11 | NO | no | +0.93 | +0.90 |
| 2026-05-06 | DIS | Cruise | 82% | 0.04 | +14 | NO | yes | -0.04 | -0.04 |
| 2026-05-06 | DIS | Fortnite | 15% | 0.71 | +14 | NO | yes | -0.71 | -0.71 |
| 2026-05-06 | DIS | Grogu | 36% | 0.15 | +50 | NO | yes | -0.15 | -0.15 |
| 2026-05-06 | DIS | NFL | 73% | 0.11 | +16 | NO | yes | -0.11 | -0.11 |
| 2026-05-06 | DIS | OpenAI / Sora | 26% | 0.49 | +25 | NO | no | +0.51 | +0.49 |
| 2026-05-06 | DIS | Subscriber | 82% | 0.05 | +13 | NO | yes | -0.05 | -0.05 |
| 2026-05-06 | DIS | Warner Bros. / Warner Brothers | 36% | 0.46 | +18 | NO | no | +0.54 | +0.52 |
| 2026-05-06 | DIS | Weather | 15% | 0.74 | +11 | NO | no | +0.26 | +0.25 |
| 2026-05-06 | DIS | WWE | 25% | 0.32 | +43 | NO | no | +0.68 | +0.66 |
| 2026-05-06 | UBER | Avride | 45% | 0.42 | +13 | NO | no | +0.58 | +0.56 |
| 2026-05-06 | UBER | Delivery | 82% | 0.01 | +17 | NO | yes | -0.01 | -0.01 |
| 2026-05-06 | UBER | Elite | 25% | 0.31 | +44 | NO | no | +0.69 | +0.67 |
| 2026-05-06 | UBER | Expansion | 64% | 0.25 | +11 | NO | yes | -0.25 | -0.25 |
| 2026-05-06 | UBER | Freight | 36% | 0.22 | +43 | NO | yes | -0.22 | -0.22 |
| 2026-05-06 | UBER | Innovation | 53% | 0.16 | +31 | NO | yes | -0.16 | -0.16 |
| 2026-05-06 | UBER | Joby | 15% | 0.21 | +64 | NO | no | +0.79 | +0.77 |
| 2026-05-06 | UBER | Lucid | 36% | 0.28 | +36 | NO | yes | -0.28 | -0.28 |
| 2026-05-06 | UBER | Lyft | 44% | 0.28 | +16 | YES | yes | +0.72 | +0.70 |
| 2026-05-06 | UBER | Market Share | 26% | 0.12 | +62 | NO | no | +0.88 | +0.85 |
| 2026-05-06 | UBER | Nissan | 15% | 0.47 | +38 | NO | no | +0.53 | +0.51 |
| 2026-05-06 | UBER | Oil / Gas / Gasoline | 15% | 0.39 | +46 | NO | no | +0.61 | +0.59 |
| 2026-05-06 | UBER | Regulator / Regulatory / Regulation | 54% | 0.09 | +37 | NO | yes | -0.09 | -0.09 |
| 2026-05-06 | UBER | Safety | 64% | 0.14 | +22 | NO | yes | -0.14 | -0.14 |
| 2026-05-06 | UBER | Waabi | 45% | 0.34 | +21 | NO | no | +0.66 | +0.64 |
| 2026-05-06 | UBER | Waymo | 82% | 0.04 | +14 | NO | yes | -0.04 | -0.04 |
| 2026-05-07 | MCD | Big Arch | 80% | 0.09 | +11 | NO | yes | -0.09 | -0.09 |
| 2026-05-07 | MCD | Delivery | 38% | 0.44 | +18 | NO | yes | -0.44 | -0.44 |
| 2026-05-07 | MCD | Loyalty | 70% | 0.11 | +19 | NO | no | +0.89 | +0.86 |
| 2026-05-07 | MCD | McChicken | 27% | 0.44 | +29 | NO | yes | -0.44 | -0.44 |
| 2026-05-07 | MCD | Monopoly | 40% | 0.47 | +13 | NO | no | +0.53 | +0.51 |
| 2026-05-07 | MCD | Revenue | 29% | 0.40 | +31 | NO | no | +0.60 | +0.58 |
| 2026-05-07 | MCD | Supply Chain | 60% | 0.24 | +16 | NO | yes | -0.24 | -0.24 |
| 2026-05-07 | MCD | Tariff | 58% | 0.22 | +36 | YES | no | -0.22 | -0.22 |
| 2026-05-11 | HIMS | Amazon | 44% | 0.45 | +11 | NO | no | +0.55 | +0.53 |
| 2026-05-11 | HIMS | Canada | 45% | 0.17 | +38 | NO | yes | -0.17 | -0.17 |
| 2026-05-11 | HIMS | Cancer | 54% | 0.41 | +13 | YES | no | -0.41 | -0.41 |
| 2026-05-11 | HIMS | Collaboration | 53% | 0.21 | +26 | NO | yes | -0.21 | -0.21 |
| 2026-05-11 | HIMS | Europe | 45% | 0.19 | +36 | NO | no | +0.81 | +0.79 |
| 2026-05-11 | HIMS | FDA | 73% | 0.10 | +17 | NO | yes | -0.10 | -0.10 |
| 2026-05-11 | HIMS | Peptide | 64% | 0.06 | +30 | NO | yes | -0.06 | -0.06 |
| 2026-05-11 | HIMS | Regulation | 34% | 0.30 | +36 | NO | no | +0.70 | +0.68 |
| 2026-05-11 | HIMS | Tariff | 34% | 0.09 | +25 | YES | no | -0.09 | -0.09 |
| 2026-05-11 | HIMS | Zava | 45% | 0.27 | +28 | NO | yes | -0.27 | -0.27 |
| 2026-05-13 | NBIS | ClickHouse / Click House | 73% | 0.55 | +18 | YES | yes | +0.45 | +0.44 |
| 2026-05-13 | NBIS | Hyperscaler | 54% | 0.28 | +18 | NO | yes | -0.28 | -0.28 |
| 2026-05-13 | NBIS | Microsoft | 45% | 0.10 | +45 | NO | yes | -0.10 | -0.10 |
| 2026-05-13 | NBIS | Neocloud | 34% | 0.41 | +25 | NO | no | +0.59 | +0.57 |
| 2026-05-13 | NBIS | Token | 45% | 0.11 | +44 | NO | yes | -0.11 | -0.11 |
| 2026-05-13 | NBIS | TripleTen / Triple Ten | 44% | 0.02 | +42 | YES | yes | +0.98 | +0.95 |
| 2026-05-13 | NBIS | Uber | 62% | 0.46 | +16 | YES | no | -0.46 | -0.46 |
| 2026-05-14 | KLAR | AI / Artificial Intelligence | 71% | 0.16 | +13 | NO | no | +0.84 | +0.81 |
| 2026-05-14 | KLAR | Coinbase | 25% | 0.15 | +60 | NO | no | +0.85 | +0.82 |
| 2026-05-14 | KLAR | Credit Quality | 58% | 0.15 | +26 | NO | yes | -0.15 | -0.15 |
| 2026-05-14 | KLAR | Delinquency | 58% | 0.10 | +32 | NO | yes | -0.10 | -0.10 |
| 2026-05-14 | KLAR | Gemini | 25% | 0.15 | +60 | NO | yes | -0.15 | -0.15 |
| 2026-05-14 | KLAR | Inflation | 25% | 0.02 | +23 | YES | no | -0.02 | -0.02 |
| 2026-05-14 | KLAR | Investment | 58% | 0.15 | +26 | NO | no | +0.85 | +0.82 |
| 2026-05-14 | KLAR | Profitability | 71% | 0.15 | +14 | NO | no | +0.85 | +0.82 |
| 2026-05-14 | KLAR | Sweden | 58% | 0.16 | +26 | NO | no | +0.84 | +0.81 |
| 2026-05-14 | KLAR | Tailwind | 25% | 0.02 | +23 | YES | yes | +0.98 | +0.95 |
| 2026-05-19 | CAVA | Acceleration | 44% | 0.16 | +28 | YES | no | -0.16 | -0.16 |
| 2026-05-19 | CAVA | Digital | 82% | 0.07 | +11 | NO | yes | -0.07 | -0.07 |
| 2026-05-19 | CAVA | Expansion | 73% | 0.15 | +12 | NO | yes | -0.15 | -0.15 |
| 2026-05-19 | CAVA | Glazed Salmon | 26% | 0.14 | +60 | NO | yes | -0.14 | -0.14 |
| 2026-05-19 | CAVA | Headwind | 64% | 0.26 | +10 | NO | yes | -0.26 | -0.26 |
| 2026-05-19 | CAVA | Sweet Potato | 26% | 0.49 | +25 | NO | yes | -0.49 | -0.49 |
| 2026-05-19 | HD | Competition / Competitor | 44% | 0.28 | +16 | YES | yes | +0.72 | +0.70 |
| 2026-05-19 | HD | Headwind | 44% | 0.31 | +13 | YES | yes | +0.69 | +0.67 |
| 2026-05-19 | HD | Revenue | 54% | 0.37 | +17 | YES | no | -0.37 | -0.37 |
| 2026-05-19 | HD | Synergy | 34% | 0.46 | +20 | NO | no | +0.54 | +0.52 |
| 2026-05-19 | HD | Tailwind | 44% | 0.30 | +14 | YES | yes | +0.70 | +0.68 |
| 2026-05-19 | HD | Tariff | 73% | 0.08 | +19 | NO | yes | -0.08 | -0.08 |
| 2026-05-20 | NVDA | Arizona | 25% | 0.62 | +13 | NO | no | +0.38 | +0.37 |
| 2026-05-20 | NVDA | Automation | 34% | 0.32 | +34 | NO | no | +0.68 | +0.66 |
| 2026-05-20 | NVDA | Domestic | 25% | 0.60 | +15 | NO | no | +0.40 | +0.39 |
| 2026-05-20 | NVDA | Gaming | 82% | 0.05 | +13 | NO | yes | -0.05 | -0.05 |
| 2026-05-20 | NVDA | H20 | 44% | 0.45 | +11 | NO | no | +0.55 | +0.53 |
| 2026-05-20 | NVDA | Humanoid | 44% | 0.44 | +12 | NO | yes | -0.44 | -0.44 |
| 2026-05-20 | NVDA | Hyperscaler | 64% | 0.07 | +29 | NO | yes | -0.07 | -0.07 |
| 2026-05-20 | NVDA | Self Driving | 15% | 0.26 | +59 | NO | yes | -0.26 | -0.26 |
| 2026-05-20 | NVDA | Taiwan | 25% | 0.54 | +21 | NO | no | +0.46 | +0.45 |
| 2026-05-20 | NVDA | Trump | 25% | 0.59 | +16 | NO | no | +0.41 | +0.40 |
| 2026-05-20 | NVDA | TSMC | 53% | 0.21 | +26 | NO | no | +0.79 | +0.77 |
| 2026-05-20 | TGT | Circle 360 | 82% | 0.04 | +14 | NO | no | +0.96 | +0.93 |
| 2026-05-20 | TGT | Competition | 45% | 0.42 | +13 | NO | no | +0.58 | +0.56 |
| 2026-05-20 | TGT | Innovation | 73% | 0.49 | +24 | YES | no | -0.49 | -0.49 |
| 2026-05-20 | TGT | Labor | 64% | 0.24 | +12 | NO | yes | -0.24 | -0.24 |
| 2026-05-20 | TGT | SNAP / Food Stamp | 15% | 0.61 | +24 | NO | no | +0.39 | +0.38 |
| 2026-05-20 | TGT | Synthetic Color | 26% | 0.60 | +14 | NO | yes | -0.60 | -0.60 |
| 2026-05-20 | TGT | Tariff | 64% | 0.10 | +26 | NO | no | +0.90 | +0.87 |
| 2026-05-20 | TOL | Buffington / Arkansas | 15% | 0.19 | +66 | NO | yes | -0.19 | -0.19 |
| 2026-05-20 | TOL | Buyback | 44% | 0.35 | +21 | NO | no | +0.65 | +0.63 |
| 2026-05-20 | TOL | Dividend | 62% | 0.15 | +23 | NO | yes | -0.15 | -0.15 |
| 2026-05-20 | TOL | Headwind | 36% | 0.26 | +38 | NO | no | +0.74 | +0.72 |
| 2026-05-20 | TOL | Lumber | 26% | 0.35 | +39 | NO | yes | -0.35 | -0.35 |
| 2026-05-20 | TOL | Millennial | 73% | 0.51 | +22 | YES | no | -0.51 | -0.51 |
| 2026-05-20 | TOL | Tailwind | 54% | 0.39 | +15 | YES | no | -0.39 | -0.39 |
| 2026-05-20 | TOL | Tariff | 64% | 0.47 | +17 | YES | yes | +0.53 | +0.51 |
| 2026-05-20 | URBN | Beauty | 73% | 0.56 | +17 | YES | yes | +0.44 | +0.43 |
| 2026-05-20 | URBN | Headwind | 54% | 0.34 | +12 | NO | yes | -0.34 | -0.34 |
| 2026-05-20 | URBN | Holiday | 73% | 0.60 | +13 | YES | no | -0.60 | -0.60 |
| 2026-05-20 | URBN | Middle East | 15% | 0.05 | +10 | YES | yes | +0.95 | +0.92 |
| 2026-05-20 | URBN | Supply Chain | 25% | 0.45 | +30 | NO | no | +0.55 | +0.53 |
| 2026-05-20 | URBN | Sustained Performance | 36% | 0.15 | +20 | YES | no | -0.15 | -0.15 |
| 2026-05-20 | URBN | Tariff | 54% | 0.10 | +36 | NO | yes | -0.10 | -0.10 |
| 2026-05-20 | URBN | Thrift | 45% | 0.03 | +42 | YES | no | -0.03 | -0.03 |
| 2026-05-21 | WMT | Automotive | 53% | 0.41 | +12 | YES | no | -0.41 | -0.41 |
| 2026-05-21 | WMT | Automation | 82% | 0.07 | +11 | NO | yes | -0.07 | -0.07 |
| 2026-05-21 | WMT | Brick and Mortar | 34% | 0.12 | +22 | YES | no | -0.12 | -0.12 |
| 2026-05-21 | WMT | Dividend | 44% | 0.23 | +33 | NO | no | +0.77 | +0.75 |
| 2026-05-21 | WMT | OnePay / One Pay | 45% | 0.27 | +28 | NO | no | +0.73 | +0.71 |
| 2026-05-21 | WMT | OpenAI | 36% | 0.29 | +36 | NO | no | +0.71 | +0.69 |
| 2026-05-21 | WMT | Prescription | 34% | 0.13 | +21 | YES | yes | +0.87 | +0.84 |
| 2026-05-21 | WMT | Skip | 15% | 0.04 | +11 | YES | no | -0.04 | -0.04 |
| 2026-05-21 | WMT | SNAP / Food Stamp | 25% | 0.07 | +18 | YES | no | -0.07 | -0.07 |
| 2026-05-21 | WMT | Tariff | 64% | 0.24 | +12 | NO | yes | -0.24 | -0.24 |
| 2026-06-02 | ULTA | AI / Artificial Intelligence | 45% | 0.07 | +48 | NO | yes | -0.07 | -0.07 |
| 2026-06-02 | ULTA | Google / Gemini | 15% | 0.18 | +67 | NO | yes | -0.18 | -0.18 |
| 2026-06-02 | ULTA | Middle East | 54% | 0.27 | +19 | NO | yes | -0.27 | -0.27 |
| 2026-06-02 | ULTA | Rare Beauty | 26% | 0.37 | +37 | NO | yes | -0.37 | -0.37 |
| 2026-06-02 | ULTA | Space NK | 45% | 0.06 | +49 | NO | yes | -0.06 | -0.06 |
| 2026-06-02 | ULTA | Tailwind | 44% | 0.28 | +16 | YES | no | -0.28 | -0.28 |
| 2026-06-02 | ULTA | Tariff | 53% | 0.36 | +17 | YES | no | -0.36 | -0.36 |
| 2026-06-02 | ULTA | Uncertainty | 64% | 0.14 | +22 | NO | yes | -0.14 | -0.14 |
| 2026-06-03 | CRWD | Acquisition | 64% | 0.14 | +22 | NO | yes | -0.14 | -0.14 |
| 2026-06-03 | CRWD | Claude | 36% | 0.37 | +28 | NO | yes | -0.37 | -0.37 |
| 2026-06-03 | CRWD | Gen AI / Generative AI | 53% | 0.42 | +11 | YES | no | -0.42 | -0.42 |
| 2026-06-03 | CRWD | Germany | 15% | 0.36 | +49 | NO | no | +0.64 | +0.62 |
| 2026-06-03 | CRWD | Headwind | 34% | 0.51 | +15 | NO | no | +0.49 | +0.48 |
| 2026-06-03 | CRWD | Microsoft | 54% | 0.33 | +13 | NO | no | +0.67 | +0.65 |
| 2026-06-03 | CRWD | Nvidia | 54% | 0.28 | +18 | NO | yes | -0.28 | -0.28 |
| 2026-06-03 | CRWD | Outage | 72% | 0.24 | +48 | YES | no | -0.24 | -0.24 |
| 2026-06-03 | CRWD | SGNL / Signal | 36% | 0.19 | +46 | NO | yes | -0.19 | -0.19 |
| 2026-06-03 | CRWD | Tailwind | 54% | 0.41 | +13 | YES | yes | +0.59 | +0.57 |
| 2026-06-30 | NBIS | Aether | 31% | 0.32 | +37 | NO | yes | -0.32 | -0.32 |
| 2026-06-30 | NBIS | Meta | 49% | 0.20 | +31 | NO | yes | -0.20 | -0.20 |
| 2026-06-30 | NBIS | Nvidia | 67% | 0.07 | +26 | NO | no | +0.93 | +0.90 |
| 2026-06-30 | NBIS | Robotics | 40% | 0.46 | +14 | NO | no | +0.54 | +0.52 |
| 2026-06-30 | NBIS | Token | 49% | 0.26 | +25 | NO | yes | -0.26 | -0.26 |
| 2026-07-15 | PGR | AI / Artificial Intelligence | 45% | 0.25 | +30 | NO | yes | -0.25 | -0.25 |
| 2026-07-15 | PGR | Buyback | 36% | 0.10 | +26 | YES | no | -0.10 | -0.10 |
| 2026-07-15 | PGR | Catastrophe | 53% | 0.33 | +14 | NO | yes | -0.33 | -0.33 |
| 2026-07-15 | PGR | Pet Insurance | 25% | 0.11 | +14 | YES | no | -0.11 | -0.11 |
| 2026-08-04 | AMD | Agentic AI | 41% | 0.29 | +30 | NO | yes | -0.29 | -0.29 |
| 2026-08-04 | AMD | China | 67% | 0.20 | +13 | NO | yes | -0.20 | -0.20 |
| 2026-08-04 | AMD | Frontier | 57% | 0.36 | +21 | YES | yes | +0.64 | +0.62 |
| 2026-08-04 | AMD | Helios | 49% | 0.07 | +44 | NO | yes | -0.07 | -0.07 |
| 2026-08-04 | AMD | MI450 / MI455X | 41% | 0.07 | +52 | NO | yes | -0.07 | -0.07 |
| 2026-08-04 | AMD | Microsoft / Azure | 75% | 0.11 | +14 | NO | yes | -0.11 | -0.11 |
| 2026-08-04 | AMD | Oracle | 49% | 0.25 | +24 | YES | yes | +0.75 | +0.73 |
| 2026-08-04 | AMD | Supply Chain | 67% | 0.22 | +11 | NO | yes | -0.22 | -0.22 |
| 2026-08-04 | AMD | TSMC | 31% | 0.57 | +12 | NO | no | +0.43 | +0.42 |
| 2026-08-04 | AMD | Venice | 49% | 0.07 | +44 | NO | yes | -0.07 | -0.07 |
| 2026-08-04 | AMD | OpenAI | 58% | 0.26 | +16 | NO | yes | -0.26 | -0.26 |
| 2026-08-04 | MCD | Big Arch | 82% | 0.68 | +14 | YES | no | -0.68 | -0.68 |
| 2026-08-04 | MCD | Caesar | 15% | 0.60 | +25 | NO | no | +0.40 | +0.39 |
| 2026-08-04 | MCD | Competition | 73% | 0.58 | +15 | YES | yes | +0.42 | +0.41 |
| 2026-08-04 | MCD | Dividend | 53% | 0.17 | +36 | YES | no | -0.17 | -0.17 |
| 2026-08-04 | MCD | Hot Honey | 36% | 0.15 | +20 | YES | no | -0.15 | -0.15 |
| 2026-08-04 | MCD | McCafé | 15% | 0.30 | +55 | NO | no | +0.70 | +0.68 |
| 2026-08-04 | MCD | Monopoly | 34% | 0.07 | +27 | YES | no | -0.07 | -0.07 |
| 2026-08-04 | MCD | Red Bull | 36% | 0.42 | +23 | NO | yes | -0.42 | -0.42 |
| 2026-08-04 | MCD | Soccer / Football | 15% | 0.70 | +15 | NO | no | +0.30 | +0.29 |
| 2026-08-04 | MCD | Tariff | 53% | 0.25 | +28 | YES | no | -0.25 | -0.25 |
| 2026-08-04 | MCD | World Cup | 26% | 0.19 | +55 | NO | yes | -0.19 | -0.19 |
| 2026-08-04 | SPOT | Apple | 64% | 0.36 | +28 | YES | yes | +0.64 | +0.62 |
| 2026-08-04 | SPOT | Award | 25% | 0.07 | +18 | YES | no | -0.07 | -0.07 |
| 2026-08-04 | SPOT | Bookshop / Bookshop.org | 25% | 0.04 | +21 | YES | no | -0.04 | -0.04 |
| 2026-08-04 | SPOT | ChatGPT | 36% | 0.14 | +21 | YES | yes | +0.86 | +0.83 |
| 2026-08-04 | SPOT | Fitness | 26% | 0.45 | +29 | NO | yes | -0.45 | -0.45 |
| 2026-08-04 | SPOT | Headwind | 53% | 0.18 | +35 | YES | yes | +0.82 | +0.80 |
| 2026-08-04 | SPOT | Message / Messaging | 45% | 0.29 | +16 | YES | yes | +0.71 | +0.69 |
| 2026-08-04 | SPOT | Meta | 25% | 0.07 | +18 | YES | no | -0.07 | -0.07 |
| 2026-08-04 | SPOT | Netflix | 34% | 0.21 | +13 | YES | yes | +0.79 | +0.77 |
| 2026-08-04 | TOST | Agent / Agentic | 49% | 0.12 | +39 | NO | yes | -0.12 | -0.12 |
| 2026-08-04 | TOST | Fraud / Theft | 32% | 0.19 | +13 | YES | no | -0.19 | -0.19 |
| 2026-08-04 | TOST | Hungry Howie’s | 24% | 0.11 | +13 | YES | no | -0.11 | -0.11 |
| 2026-08-04 | TOST | Local | 67% | 0.16 | +17 | NO | yes | -0.16 | -0.16 |
| 2026-08-04 | TOST | London | 32% | 0.20 | +12 | YES | no | -0.20 | -0.20 |
| 2026-08-04 | TOST | Memory / Chip | 32% | 0.38 | +30 | NO | yes | -0.38 | -0.38 |
| 2026-08-04 | TOST | Share Repurchase / Buyback | 49% | 0.14 | +37 | NO | yes | -0.14 | -0.14 |
| 2026-08-04 | TOST | Tariff | 58% | 0.14 | +28 | NO | yes | -0.14 | -0.14 |
| 2026-08-04 | TOST | Toast IQ | 49% | 0.09 | +42 | NO | yes | -0.09 | -0.09 |
| 2026-08-04 | ZETA | AI Infrastructure | 14% | 0.50 | +36 | NO | yes | -0.50 | -0.50 |
| 2026-08-04 | ZETA | Cannes Lions | 31% | 0.16 | +15 | YES | yes | +0.84 | +0.81 |
| 2026-08-04 | ZETA | Connected TV | 41% | 0.48 | +11 | NO | no | +0.52 | +0.50 |
| 2026-08-04 | ZETA | Forrester | 41% | 0.37 | +22 | NO | yes | -0.37 | -0.37 |
| 2026-08-04 | ZETA | Foundry | 14% | 0.26 | +60 | NO | yes | -0.26 | -0.26 |
| 2026-08-04 | ZETA | Loyalty | 41% | 0.36 | +23 | NO | yes | -0.36 | -0.36 |
| 2026-08-04 | ZETA | OpenAI | 31% | 0.37 | +32 | NO | yes | -0.37 | -0.37 |
| 2026-08-04 | ZETA | Palantir | 14% | 0.07 | +79 | NO | yes | -0.07 | -0.07 |
| 2026-08-04 | ZETA | SuperGraph | 32% | 0.34 | +34 | NO | no | +0.66 | +0.64 |
| 2026-08-04 | ZETA | Trade Desk | 32% | 0.20 | +12 | YES | no | -0.20 | -0.20 |
