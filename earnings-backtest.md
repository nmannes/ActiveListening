# Earnings Backtest

Generated 2026-08-13

## Strategy

For each finalized word market: baseline P from transcripts of calls before the event vs the executable price ~24h before the market resolved (the YES ask, or last trade without orderbook data). Bet the undervalued side: YES when baseline > YES price, NO when 1 − baseline > NO price; skip when neither side is undervalued; settle at the actual resolution. Gap = edge on the chosen side.

## Coverage

- 5089 finalized markets with history fetched
- 4768 with a price ~24h before resolution
- 2409 with a transcript baseline (pre-event calls)
- 2395 tradable (both price and baseline)

- fee: 3% on profit

## Threshold sweep (min |gap|)

Net if always YES / always NO shows the same candidates traded on one fixed side — the benchmark the side selection must beat.

| Min |gap| | Trades | Wins | Win rate | Gross | Net | YES (n/wins/net) | NO (n/wins/net) | Always YES | Always NO |
|---|---|---|---|---|---|---|---|---|---|---|
| 0.00 | 2395 | 1112 | 46% | +140.35 | +125.60 | 586 / 260 / +12.55 | 1809 / 852 / +113.05 | -119.35 | +94.06 |
| 0.05 | 1994 | 918 | 46% | +144.64 | +131.57 | 410 / 181 / +15.45 | 1584 / 737 / +116.12 | -117.67 | +95.87 |
| 0.10 | 1669 | 724 | 43% | +117.66 | +106.61 | 307 / 125 / +11.76 | 1362 / 599 / +94.85 | -97.98 | +79.40 |
| 0.15 | 1400 | 552 | 39% | +85.26 | +76.16 | 238 / 92 / +8.64 | 1162 / 460 / +67.52 | -71.61 | +55.97 |
| 0.20 | 1176 | 434 | 37% | +70.67 | +63.04 | 157 / 55 / +4.39 | 1019 / 379 / +58.64 | -65.49 | +52.34 |
| 0.25 | 990 | 342 | 35% | +59.23 | +52.91 | 110 / 37 / +3.31 | 880 / 305 / +49.60 | -55.89 | +45.03 |
| 0.30 | 829 | 266 | 32% | +50.01 | +44.86 | 64 / 21 / +4.49 | 765 / 245 / +40.37 | -43.99 | +35.19 |

## Per company (min |gap| 0.10)

| Company | Trades | Wins | Net |
|---|---|---|---|
| AAL | 10 | 4 | +0.72 |
| AAOI | 10 | 1 | -2.81 |
| AAPL | 25 | 12 | +1.83 |
| ABNB | 15 | 7 | +2.38 |
| ACI | 8 | 3 | +0.06 |
| ADBE | 7 | 3 | +1.66 |
| ALK | 13 | 8 | +2.02 |
| ALLY | 12 | 7 | +1.68 |
| AMD | 14 | 0 | -3.24 |
| AMZN | 38 | 9 | -3.06 |
| AVAV | 9 | 4 | -0.20 |
| AVGO | 10 | 5 | +0.68 |
| AXP | 11 | 2 | -1.98 |
| BA | 14 | 9 | +2.73 |
| BAC | 27 | 9 | +0.77 |
| BLK | 5 | 4 | +2.58 |
| BULL | 9 | 3 | +0.01 |
| C | 16 | 4 | -0.64 |
| CAR | 6 | 3 | +0.02 |
| CAVA | 19 | 3 | -2.90 |
| CBRL | 9 | 2 | -1.37 |
| CCL | 6 | 0 | -1.58 |
| CELH | 6 | 1 | -0.74 |
| CHWY | 8 | 3 | +1.18 |
| CMG | 20 | 10 | +2.94 |
| COHR | 10 | 1 | -2.36 |
| COST | 10 | 3 | -0.82 |
| CRCL | 9 | 3 | +0.93 |
| CRM | 8 | 3 | +0.64 |
| CRWD | 10 | 3 | -0.44 |
| CRWV | 7 | 4 | +1.66 |
| CVNA | 16 | 9 | +0.57 |
| DAL | 15 | 6 | +1.10 |
| DASH | 11 | 6 | +1.06 |
| DE | 10 | 4 | +0.94 |
| DELL | 9 | 4 | +0.00 |
| DIS | 29 | 13 | +0.70 |
| DKNG | 12 | 6 | +0.39 |
| DPZ | 23 | 14 | +2.91 |
| DUOL | 6 | 4 | +0.48 |
| EBAY | 12 | 3 | -1.80 |
| F | 11 | 4 | -0.79 |
| FDX | 7 | 3 | +0.13 |
| FIG | 8 | 2 | -0.28 |
| GEV | 20 | 6 | +2.43 |
| GIS | 8 | 4 | +1.59 |
| GOOGL | 36 | 17 | +4.04 |
| GRAB | 13 | 4 | -0.99 |
| GS | 21 | 11 | +3.07 |
| HD | 6 | 4 | +1.59 |
| HIMS | 29 | 11 | +2.24 |
| HOOD | 25 | 4 | -4.68 |
| HPE | 9 | 2 | -2.10 |
| INTC | 22 | 10 | +4.20 |
| JNJ | 30 | 10 | +0.88 |
| JPM | 30 | 13 | +3.15 |
| KLAR | 10 | 6 | +4.63 |
| KO | 6 | 4 | +1.47 |
| KR | 8 | 4 | +1.19 |
| LEVI | 21 | 10 | +0.86 |
| LLY | 24 | 13 | +3.56 |
| LMT | 2 | 1 | +0.84 |
| LOW | 6 | 3 | +0.97 |
| LULU | 10 | 6 | +2.30 |
| LYFT | 18 | 9 | +1.82 |
| M | 8 | 4 | +0.72 |
| MCD | 28 | 16 | +3.45 |
| MELI | 10 | 7 | +2.14 |
| META | 23 | 14 | +4.77 |
| MRVL | 9 | 4 | +0.67 |
| MS | 19 | 11 | +2.51 |
| MSFT | 22 | 6 | -2.08 |
| MTN | 4 | 3 | +1.18 |
| MU | 8 | 1 | -1.89 |
| NBIS | 24 | 9 | +2.76 |
| NFLX | 39 | 18 | +4.50 |
| NKE | 9 | 4 | +0.48 |
| NVDA | 16 | 12 | +5.15 |
| OKLO | 4 | 1 | +0.14 |
| ON | 7 | 3 | -0.03 |
| ORCL | 17 | 9 | +3.29 |
| PEP | 23 | 13 | +2.05 |
| PG | 7 | 3 | +0.23 |
| PGR | 16 | 9 | +3.65 |
| PLTR | 26 | 11 | +0.67 |
| PYPL | 34 | 23 | +6.81 |
| RDDT | 12 | 4 | +0.23 |
| RIVN | 7 | 2 | -0.40 |
| SBUX | 22 | 11 | +1.38 |
| SHOP | 16 | 8 | +2.11 |
| SNAP | 7 | 2 | -0.18 |
| SNOW | 8 | 5 | +0.96 |
| SPOT | 17 | 12 | +4.02 |
| STZ | 20 | 12 | +3.60 |
| TFC | 8 | 5 | +1.76 |
| TGT | 8 | 5 | +1.51 |
| TLN | 9 | 3 | +1.26 |
| TOL | 8 | 2 | -1.48 |
| TOST | 7 | 2 | -0.22 |
| TSLA | 39 | 15 | +2.03 |
| TTWO | 10 | 5 | +0.73 |
| UAL | 34 | 10 | -1.18 |
| UBER | 28 | 13 | +3.03 |
| ULTA | 12 | 3 | -1.34 |
| URBN | 5 | 1 | -0.75 |
| V | 10 | 5 | +1.18 |
| VST | 12 | 2 | -1.65 |
| VZ | 13 | 7 | +0.65 |
| WEN | 11 | 7 | +1.15 |
| WFC | 31 | 10 | +0.74 |
| WING | 14 | 7 | +1.08 |
| WMT | 10 | 6 | +3.06 |
| YOU | 12 | 7 | +1.56 |
| YUM | 12 | 5 | +0.13 |
| ZETA | 10 | 4 | -0.36 |

## Trades (min |gap| 0.10)

| Event | Company | Word | Baseline | Price | Gap | Side | Result | Gross | Net |
|---|---|---|---|---|---|---|---|---|---|
| 2025-09-10 | ORCL | Capital expenditure | 65% | 0.01 | +64 | YES | no | -0.01 | -0.01 |
| 2025-09-10 | ORCL | Cloud infrastructure | 58% | 0.10 | +32 | NO | yes | -0.10 | -0.10 |
| 2025-09-10 | ORCL | Healthcare AI | 2% | 0.83 | +15 | NO | no | +0.17 | +0.16 |
| 2025-09-10 | ORCL | Multicloud | 4% | 0.01 | +95 | NO | yes | -0.01 | -0.01 |
| 2025-09-10 | ORCL | RPO /  Remaining Performance Obligation | 35% | 0.01 | +64 | NO | yes | -0.01 | -0.01 |
| 2025-09-10 | ORCL | SaaS momentum | 4% | 0.83 | +13 | NO | no | +0.17 | +0.16 |
| 2026-01-13 | JPM | Crypto / Bitcoin | 3% | 0.86 | +11 | NO | yes | -0.86 | -0.86 |
| 2026-01-13 | JPM | Geopolitical | 23% | 0.42 | +35 | NO | yes | -0.42 | -0.42 |
| 2026-01-13 | JPM | Inflation | 46% | 0.22 | +32 | NO | yes | -0.22 | -0.22 |
| 2026-01-13 | JPM | Private Credit | 29% | 0.28 | +43 | NO | yes | -0.28 | -0.28 |
| 2026-01-13 | JPM | Recession | 51% | 0.33 | +18 | YES | yes | +0.67 | +0.65 |
| 2026-01-13 | JPM | Tariff | 12% | 0.34 | +54 | NO | no | +0.66 | +0.64 |
| 2026-01-14 | BAC | CashPro | 33% | 0.37 | +30 | NO | yes | -0.37 | -0.37 |
| 2026-01-14 | BAC | Inflation | 36% | 0.26 | +38 | NO | yes | -0.26 | -0.26 |
| 2026-01-14 | BAC | M&A | 39% | 0.48 | +13 | NO | no | +0.52 | +0.50 |
| 2026-01-14 | BAC | Rate Cut | 27% | 0.07 | +66 | NO | yes | -0.07 | -0.07 |
| 2026-01-14 | BAC | Tariff | 8% | 0.39 | +53 | NO | yes | -0.39 | -0.39 |
| 2026-01-14 | BAC | Delinquency | 50% | 0.15 | +35 | NO | yes | -0.15 | -0.15 |
| 2026-01-14 | WFC | AI / Artificial Intelligence | 31% | 0.01 | +68 | NO | yes | -0.01 | -0.01 |
| 2026-01-14 | WFC | Buyback | 74% | 0.01 | +73 | YES | no | -0.01 | -0.01 |
| 2026-01-14 | WFC | Delinquency | 22% | 0.01 | +77 | NO | yes | -0.01 | -0.01 |
| 2026-01-14 | WFC | Inflation | 58% | 0.01 | +41 | NO | yes | -0.01 | -0.01 |
| 2026-01-14 | WFC | Middle Market | 84% | 0.01 | +15 | NO | yes | -0.01 | -0.01 |
| 2026-01-14 | WFC | Private Equity | 64% | 0.01 | +35 | NO | yes | -0.01 | -0.01 |
| 2026-01-14 | WFC | Recession | 22% | 0.01 | +21 | YES | no | -0.01 | -0.01 |
| 2026-01-14 | WFC | Severance | 41% | 0.01 | +58 | NO | yes | -0.01 | -0.01 |
| 2026-01-14 | WFC | Tariff | 15% | 0.01 | +14 | YES | no | -0.01 | -0.01 |
| 2026-01-15 | GS | Buyback | 65% | 0.51 | +14 | YES | yes | +0.49 | +0.48 |
| 2026-01-15 | GS | Charge Off / Charge-Off | 78% | 0.07 | +15 | NO | yes | -0.07 | -0.07 |
| 2026-01-15 | GS | Inflation | 68% | 0.52 | +16 | YES | yes | +0.48 | +0.47 |
| 2026-01-15 | GS | Marcus | 65% | 0.18 | +47 | YES | yes | +0.82 | +0.80 |
| 2026-01-15 | GS | Recession | 28% | 0.16 | +12 | YES | no | -0.16 | -0.16 |
| 2026-01-15 | GS | Tariff | 12% | 0.70 | +18 | NO | no | +0.30 | +0.29 |
| 2026-01-15 | GS | Trading | 91% | 0.77 | +14 | YES | yes | +0.23 | +0.22 |
| 2026-01-20 | NFLX | Acquisition | 71% | 0.08 | +21 | NO | yes | -0.08 | -0.08 |
| 2026-01-20 | NFLX | Ad-Supported | 24% | 0.63 | +13 | NO | yes | -0.63 | -0.63 |
| 2026-01-20 | NFLX | Gaming | 33% | 0.31 | +36 | NO | yes | -0.31 | -0.31 |
| 2026-01-20 | NFLX | Hollywood | 34% | 0.34 | +32 | NO | no | +0.66 | +0.64 |
| 2026-01-20 | NFLX | Jake Paul | 8% | 0.45 | +47 | NO | yes | -0.45 | -0.45 |
| 2026-01-20 | NFLX | Live Event | 21% | 0.06 | +73 | NO | yes | -0.06 | -0.06 |
| 2026-01-20 | NFLX | Paramount | 14% | 0.30 | +56 | NO | yes | -0.30 | -0.30 |
| 2026-01-20 | NFLX | Partnership | 57% | 0.23 | +20 | NO | yes | -0.23 | -0.23 |
| 2026-01-20 | NFLX | Profitable | 50% | 0.24 | +26 | NO | no | +0.76 | +0.74 |
| 2026-01-20 | NFLX | Stranger Things | 39% | 0.05 | +56 | NO | yes | -0.05 | -0.05 |
| 2026-01-20 | NFLX | Subscriber | 88% | 0.61 | +27 | YES | no | -0.61 | -0.61 |
| 2026-01-20 | NFLX | Warner Bros | 10% | 0.30 | +60 | NO | no | +0.70 | +0.68 |
| 2026-01-21 | JNJ | Administration | 36% | 0.15 | +49 | NO | yes | -0.15 | -0.15 |
| 2026-01-21 | JNJ | Carvykti | 40% | 0.05 | +55 | NO | yes | -0.05 | -0.05 |
| 2026-01-21 | JNJ | Darzalex Faspro | 20% | 0.33 | +47 | NO | no | +0.67 | +0.65 |
| 2026-01-21 | JNJ | Halda Therapeutics | 3% | 0.12 | +85 | NO | yes | -0.12 | -0.12 |
| 2026-01-21 | JNJ | Nipocalimab / Lupus | 40% | 0.33 | +27 | NO | yes | -0.33 | -0.33 |
| 2026-01-21 | JNJ | Ottava | 40% | 0.06 | +54 | NO | yes | -0.06 | -0.06 |
| 2026-01-21 | JNJ | Rybrevant | 36% | 0.05 | +59 | NO | yes | -0.05 | -0.05 |
| 2026-01-21 | JNJ | Trufill | 3% | 0.49 | +48 | NO | no | +0.51 | +0.49 |
| 2026-01-21 | JNJ | Vaccine | 51% | 0.22 | +29 | YES | no | -0.22 | -0.22 |
| 2026-01-21 | UAL | ATC / Air Traffic Control | 44% | 0.37 | +19 | NO | yes | -0.37 | -0.37 |
| 2026-01-21 | UAL | Holiday | 40% | 0.06 | +54 | NO | yes | -0.06 | -0.06 |
| 2026-01-21 | UAL | JetBlue | 21% | 0.48 | +31 | NO | no | +0.52 | +0.50 |
| 2026-01-21 | UAL | Newark | 71% | 0.15 | +14 | NO | yes | -0.15 | -0.15 |
| 2026-01-21 | UAL | Nonstop / Non-Stop | 44% | 0.29 | +15 | YES | no | -0.29 | -0.29 |
| 2026-01-21 | UAL | On-Time / On Time | 55% | 0.04 | +41 | NO | yes | -0.04 | -0.04 |
| 2026-01-21 | UAL | Shutdown / Shut Down | 28% | 0.22 | +50 | NO | yes | -0.22 | -0.22 |
| 2026-01-21 | UAL | Starlink | 25% | 0.13 | +62 | NO | yes | -0.13 | -0.13 |
| 2026-01-21 | UAL | Tariff | 17% | 0.71 | +12 | NO | no | +0.29 | +0.28 |
| 2026-01-28 | GEV | Administration | 34% | 0.23 | +11 | YES | yes | +0.77 | +0.75 |
| 2026-01-28 | GEV | China | 45% | 0.30 | +25 | NO | no | +0.70 | +0.68 |
| 2026-01-28 | GEV | Data Center | 82% | 0.07 | +11 | NO | yes | -0.07 | -0.07 |
| 2026-01-28 | GEV | Electricity | 73% | 0.11 | +16 | NO | yes | -0.11 | -0.11 |
| 2026-01-28 | GEV | Nuclear | 64% | 0.08 | +28 | NO | yes | -0.08 | -0.08 |
| 2026-01-28 | GEV | Tariff | 45% | 0.17 | +38 | NO | yes | -0.17 | -0.17 |
| 2026-04-07 | LEVI | AI / Artificial Intelligence | 28% | 0.24 | +48 | NO | yes | -0.24 | -0.24 |
| 2026-04-07 | LEVI | Beyoncé | 2% | 0.67 | +31 | NO | no | +0.33 | +0.32 |
| 2026-04-07 | LEVI | Beyond Yoga | 31% | 0.05 | +64 | NO | yes | -0.05 | -0.05 |
| 2026-04-07 | LEVI | China | 93% | 0.75 | +18 | YES | yes | +0.25 | +0.24 |
| 2026-04-07 | LEVI | Dockers | 85% | 0.70 | +15 | YES | yes | +0.30 | +0.29 |
| 2026-04-07 | LEVI | Jordan | 43% | 0.32 | +25 | NO | yes | -0.32 | -0.32 |
| 2026-04-07 | LEVI | Nike | 15% | 0.47 | +38 | NO | yes | -0.47 | -0.47 |
| 2026-04-07 | LEVI | Super Bowl | 15% | 0.33 | +52 | NO | yes | -0.33 | -0.33 |
| 2026-04-07 | LEVI | Tariff | 20% | 0.04 | +76 | NO | yes | -0.04 | -0.04 |
| 2026-04-07 | LEVI | World Cup | 4% | 0.34 | +62 | NO | yes | -0.34 | -0.34 |
| 2026-04-07 | LEVI | Zalando | 7% | 0.74 | +19 | NO | no | +0.26 | +0.25 |
| 2026-04-09 | STZ | Aluminum | 29% | 0.25 | +46 | NO | yes | -0.25 | -0.25 |
| 2026-04-09 | STZ | Cannabis | 55% | 0.19 | +36 | YES | no | -0.19 | -0.19 |
| 2026-04-09 | STZ | Dividend | 81% | 0.58 | +23 | YES | yes | +0.42 | +0.41 |
| 2026-04-09 | STZ | Especial | 90% | 0.50 | +40 | YES | yes | +0.50 | +0.48 |
| 2026-04-09 | STZ | Holiday | 77% | 0.10 | +67 | YES | no | -0.10 | -0.10 |
| 2026-04-09 | STZ | ICE | 5% | 0.81 | +14 | NO | no | +0.19 | +0.18 |
| 2026-04-09 | STZ | Inflation | 58% | 0.32 | +10 | NO | no | +0.68 | +0.66 |
| 2026-04-09 | STZ | Inventory | 85% | 0.72 | +13 | YES | yes | +0.28 | +0.27 |
| 2026-04-09 | STZ | Tariff | 23% | 0.07 | +70 | NO | yes | -0.07 | -0.07 |
| 2026-04-09 | STZ | Wine | 92% | 0.75 | +17 | YES | yes | +0.25 | +0.24 |
| 2026-04-13 | GS | Geopolitical | 59% | 0.25 | +16 | NO | yes | -0.25 | -0.25 |
| 2026-04-13 | GS | IPO | 75% | 0.06 | +19 | NO | yes | -0.06 | -0.06 |
| 2026-04-13 | GS | Marcus | 66% | 0.38 | +28 | YES | yes | +0.62 | +0.60 |
| 2026-04-13 | GS | Pipeline | 50% | 0.31 | +19 | YES | yes | +0.69 | +0.67 |
| 2026-04-13 | GS | Tariff | 11% | 0.64 | +25 | NO | no | +0.36 | +0.35 |
| 2026-04-14 | C | Banamex | 42% | 0.13 | +45 | NO | yes | -0.13 | -0.13 |
| 2026-04-14 | C | Basel 3 | 8% | 0.31 | +61 | NO | yes | -0.31 | -0.31 |
| 2026-04-14 | C | Credit Card | 57% | 0.22 | +21 | NO | yes | -0.22 | -0.22 |
| 2026-04-14 | C | Headcount | 42% | 0.43 | +15 | NO | yes | -0.43 | -0.43 |
| 2026-04-14 | C | Inflation | 47% | 0.30 | +23 | NO | yes | -0.30 | -0.30 |
| 2026-04-14 | C | Iran | 8% | 0.69 | +23 | NO | no | +0.31 | +0.30 |
| 2026-04-14 | C | Tariff | 27% | 0.36 | +37 | NO | no | +0.64 | +0.62 |
| 2026-04-14 | C | Oil | 27% | 0.42 | +31 | NO | no | +0.58 | +0.56 |
| 2026-04-14 | JNJ | Administration | 37% | 0.34 | +29 | NO | no | +0.66 | +0.64 |
| 2026-04-14 | JNJ | AI / Artificial Intelligence | 18% | 0.45 | +37 | NO | no | +0.55 | +0.53 |
| 2026-04-14 | JNJ | Carvykti | 41% | 0.07 | +52 | NO | yes | -0.07 | -0.07 |
| 2026-04-14 | JNJ | Darzalex Faspro | 20% | 0.44 | +36 | NO | yes | -0.44 | -0.44 |
| 2026-04-14 | JNJ | Halda Therapeutics | 5% | 0.33 | +62 | NO | yes | -0.33 | -0.33 |
| 2026-04-14 | JNJ | Nipocalimab / Lupus | 41% | 0.35 | +24 | NO | no | +0.65 | +0.63 |
| 2026-04-14 | JNJ | Ottava | 41% | 0.07 | +52 | NO | yes | -0.07 | -0.07 |
| 2026-04-14 | JNJ | Rybrevant | 37% | 0.05 | +58 | NO | yes | -0.05 | -0.05 |
| 2026-04-14 | JNJ | Tariff | 16% | 0.05 | +79 | NO | yes | -0.05 | -0.05 |
| 2026-04-14 | JNJ | Trufill | 3% | 0.82 | +15 | NO | no | +0.18 | +0.17 |
| 2026-04-14 | JNJ | Vaccine | 50% | 0.20 | +30 | YES | no | -0.20 | -0.20 |
| 2026-04-14 | JPM | Basel 3 | 3% | 0.21 | +76 | NO | yes | -0.21 | -0.21 |
| 2026-04-14 | JPM | Blockchain | 16% | 0.52 | +32 | NO | no | +0.48 | +0.47 |
| 2026-04-14 | JPM | Buyback | 63% | 0.19 | +18 | NO | yes | -0.19 | -0.19 |
| 2026-04-14 | JPM | Crypto / Bitcoin | 5% | 0.59 | +36 | NO | no | +0.41 | +0.40 |
| 2026-04-14 | JPM | Fintech | 31% | 0.55 | +14 | NO | no | +0.45 | +0.44 |
| 2026-04-14 | JPM | Geopolitical | 24% | 0.31 | +45 | NO | yes | -0.31 | -0.31 |
| 2026-04-14 | JPM | Hiring | 31% | 0.30 | +39 | NO | no | +0.70 | +0.68 |
| 2026-04-14 | JPM | Inflation | 48% | 0.13 | +39 | NO | no | +0.87 | +0.84 |
| 2026-04-14 | JPM | Private Credit | 31% | 0.11 | +58 | NO | yes | -0.11 | -0.11 |
| 2026-04-14 | JPM | Recession | 52% | 0.34 | +14 | NO | yes | -0.34 | -0.34 |
| 2026-04-14 | JPM | Regulation | 43% | 0.26 | +31 | NO | yes | -0.26 | -0.26 |
| 2026-04-14 | JPM | Tariff | 12% | 0.43 | +45 | NO | no | +0.57 | +0.55 |
| 2026-04-14 | WFC | AI / Artificial Intelligence | 34% | 0.26 | +40 | NO | yes | -0.26 | -0.26 |
| 2026-04-14 | WFC | Basel 3 | 5% | 0.34 | +61 | NO | yes | -0.34 | -0.34 |
| 2026-04-14 | WFC | Buyback | 75% | 0.47 | +28 | YES | no | -0.47 | -0.47 |
| 2026-04-14 | WFC | Delinquency | 21% | 0.39 | +40 | NO | yes | -0.39 | -0.39 |
| 2026-04-14 | WFC | Inflation | 59% | 0.20 | +21 | NO | no | +0.80 | +0.78 |
| 2026-04-14 | WFC | Iran | 5% | 0.75 | +20 | NO | no | +0.25 | +0.24 |
| 2026-04-14 | WFC | Oil | 24% | 0.62 | +14 | NO | yes | -0.62 | -0.62 |
| 2026-04-14 | WFC | Private Equity | 66% | 0.49 | +17 | YES | yes | +0.51 | +0.49 |
| 2026-04-14 | WFC | Recession | 21% | 0.57 | +22 | NO | no | +0.43 | +0.42 |
| 2026-04-14 | WFC | Severance | 43% | 0.29 | +28 | NO | yes | -0.29 | -0.29 |
| 2026-04-14 | WFC | Tariff | 15% | 0.50 | +35 | NO | no | +0.50 | +0.48 |
| 2026-04-15 | BAC | Basel 3 | 2% | 0.27 | +71 | NO | yes | -0.27 | -0.27 |
| 2026-04-15 | BAC | CashPro | 34% | 0.21 | +45 | NO | no | +0.79 | +0.77 |
| 2026-04-15 | BAC | Delinquency | 51% | 0.18 | +31 | NO | yes | -0.18 | -0.18 |
| 2026-04-15 | BAC | Erica | 44% | 0.05 | +51 | NO | yes | -0.05 | -0.05 |
| 2026-04-15 | BAC | Inflation | 37% | 0.28 | +35 | NO | yes | -0.28 | -0.28 |
| 2026-04-15 | BAC | Oil | 20% | 0.28 | +52 | NO | no | +0.72 | +0.70 |
| 2026-04-15 | BAC | Rate Cut | 28% | 0.15 | +57 | NO | yes | -0.15 | -0.15 |
| 2026-04-15 | BAC | Tariff | 10% | 0.52 | +38 | NO | yes | -0.52 | -0.52 |
| 2026-04-15 | BAC | Iran | 2% | 0.75 | +23 | NO | no | +0.25 | +0.24 |
| 2026-04-15 | BAC | Pipeline | 58% | 0.31 | +11 | NO | yes | -0.31 | -0.31 |
| 2026-04-15 | MS | Basel | 46% | 0.27 | +27 | NO | yes | -0.27 | -0.27 |
| 2026-04-15 | MS | Investment Grade | 47% | 0.19 | +34 | NO | yes | -0.19 | -0.19 |
| 2026-04-15 | MS | Iran | 5% | 0.67 | +28 | NO | no | +0.33 | +0.32 |
| 2026-04-15 | MS | Oil | 15% | 0.44 | +41 | NO | no | +0.56 | +0.54 |
| 2026-04-15 | MS | Private Credit | 53% | 0.10 | +37 | NO | yes | -0.10 | -0.10 |
| 2026-04-15 | MS | Recession | 31% | 0.55 | +14 | NO | no | +0.45 | +0.44 |
| 2026-04-15 | MS | Tailwind | 50% | 0.28 | +22 | NO | no | +0.72 | +0.70 |
| 2026-04-15 | MS | Tariff | 11% | 0.77 | +12 | NO | no | +0.23 | +0.22 |
| 2026-04-15 | MS | Tokenized / Tokenization | 11% | 0.51 | +38 | NO | yes | -0.51 | -0.51 |
| 2026-04-15 | MS | Zero Hash | 11% | 0.50 | +39 | NO | yes | -0.50 | -0.50 |
| 2026-04-15 | PGR | AI / Artificial Intelligence | 16% | 0.05 | +79 | NO | yes | -0.05 | -0.05 |
| 2026-04-15 | PGR | Buyback | 10% | 0.03 | +87 | NO | no | +0.97 | +0.94 |
| 2026-04-15 | PGR | Catastrophe | 40% | 0.21 | +39 | NO | no | +0.79 | +0.77 |
| 2026-04-15 | PGR | Headwind | 21% | 0.01 | +20 | YES | yes | +0.99 | +0.96 |
| 2026-04-15 | PGR | Hippo | 3% | 0.81 | +16 | NO | no | +0.19 | +0.18 |
| 2026-04-15 | PGR | Inflation | 55% | 0.05 | +40 | NO | yes | -0.05 | -0.05 |
| 2026-04-15 | PGR | M&A / Acquisition | 82% | 0.04 | +14 | NO | yes | -0.04 | -0.04 |
| 2026-04-15 | PGR | Pet Insurance | 5% | 0.69 | +26 | NO | no | +0.31 | +0.30 |
| 2026-04-15 | PGR | Rosella | 3% | 0.85 | +12 | NO | no | +0.15 | +0.15 |
| 2026-04-15 | PGR | Snapshot | 84% | 0.01 | +83 | YES | no | -0.01 | -0.01 |
| 2026-04-16 | NFLX | Acquisition | 72% | 0.10 | +18 | NO | yes | -0.10 | -0.10 |
| 2026-04-16 | NFLX | Ad-Supported | 25% | 0.19 | +56 | NO | no | +0.81 | +0.79 |
| 2026-04-16 | NFLX | Competition | 79% | 0.10 | +11 | NO | yes | -0.10 | -0.10 |
| 2026-04-16 | NFLX | Gaming | 34% | 0.23 | +43 | NO | yes | -0.23 | -0.23 |
| 2026-04-16 | NFLX | Hollywood | 34% | 0.23 | +11 | YES | yes | +0.77 | +0.75 |
| 2026-04-16 | NFLX | Live Event | 22% | 0.08 | +70 | NO | yes | -0.08 | -0.08 |
| 2026-04-16 | NFLX | MLB | 5% | 0.23 | +72 | NO | yes | -0.23 | -0.23 |
| 2026-04-16 | NFLX | Paramount | 16% | 0.41 | +43 | NO | yes | -0.41 | -0.41 |
| 2026-04-16 | NFLX | Profitable | 49% | 0.26 | +25 | NO | no | +0.74 | +0.72 |
| 2026-04-16 | NFLX | Skyscraper | 5% | 0.49 | +46 | NO | yes | -0.49 | -0.49 |
| 2026-04-16 | NFLX | Stranger Things | 40% | 0.48 | +12 | NO | no | +0.52 | +0.50 |
| 2026-04-16 | NFLX | Subscriber | 87% | 0.33 | +54 | YES | yes | +0.67 | +0.65 |
| 2026-04-16 | NFLX | Warner Bros. / Warner Brothers | 11% | 0.21 | +68 | NO | yes | -0.21 | -0.21 |
| 2026-04-16 | NFLX | WWE | 16% | 0.63 | +21 | NO | no | +0.37 | +0.36 |
| 2026-04-16 | PEP | Acquisition | 53% | 0.10 | +37 | NO | no | +0.90 | +0.87 |
| 2026-04-16 | PEP | Artificial Color | 11% | 0.69 | +20 | NO | yes | -0.69 | -0.69 |
| 2026-04-16 | PEP | Away from Home | 59% | 0.28 | +13 | NO | yes | -0.28 | -0.28 |
| 2026-04-16 | PEP | Celsius | 37% | 0.36 | +27 | NO | yes | -0.36 | -0.36 |
| 2026-04-16 | PEP | China | 66% | 0.15 | +19 | NO | no | +0.85 | +0.82 |
| 2026-04-16 | PEP | Food for Tomorrow | 5% | 0.85 | +10 | NO | no | +0.15 | +0.15 |
| 2026-04-16 | PEP | GLP-1 | 21% | 0.28 | +51 | NO | no | +0.72 | +0.70 |
| 2026-04-16 | PEP | Nvidia | 5% | 0.84 | +11 | NO | no | +0.16 | +0.16 |
| 2026-04-16 | PEP | Pickle | 5% | 0.84 | +11 | NO | no | +0.16 | +0.16 |
| 2026-04-16 | PEP | Prebiotic | 11% | 0.34 | +55 | NO | no | +0.66 | +0.64 |
| 2026-04-16 | PEP | Tariff | 15% | 0.34 | +51 | NO | no | +0.66 | +0.64 |
| 2026-04-17 | ALLY | AI / Artificial Intelligence | 19% | 0.03 | +78 | NO | no | +0.97 | +0.94 |
| 2026-04-17 | ALLY | EV / Electric | 54% | 0.25 | +21 | NO | no | +0.75 | +0.73 |
| 2026-04-17 | ALLY | Oil | 7% | 0.74 | +19 | NO | yes | -0.74 | -0.74 |
| 2026-04-17 | ALLY | Rate Cut | 58% | 0.26 | +16 | NO | no | +0.74 | +0.72 |
| 2026-04-17 | ALLY | Tariff | 24% | 0.34 | +42 | NO | no | +0.66 | +0.64 |
| 2026-04-17 | TFC | AI / Artificial Intelligence | 33% | 0.06 | +61 | NO | yes | -0.06 | -0.06 |
| 2026-04-17 | TFC | Credit Card | 28% | 0.45 | +27 | NO | no | +0.55 | +0.53 |
| 2026-04-17 | TFC | Headcount | 19% | 0.67 | +14 | NO | no | +0.33 | +0.32 |
| 2026-04-17 | TFC | Middle Market | 36% | 0.15 | +49 | NO | yes | -0.15 | -0.15 |
| 2026-04-17 | TFC | Orioles | 4% | 0.69 | +27 | NO | no | +0.31 | +0.30 |
| 2026-04-17 | TFC | Real Estate | 72% | 0.43 | +29 | YES | yes | +0.57 | +0.55 |
| 2026-04-17 | TFC | Recession | 45% | 0.29 | +16 | YES | no | -0.29 | -0.29 |
| 2026-04-17 | TFC | Tailwind | 42% | 0.43 | +15 | NO | no | +0.57 | +0.55 |
| 2026-04-21 | ALK | AI / Artificial Intelligence | 17% | 0.42 | +41 | NO | no | +0.58 | +0.56 |
| 2026-04-21 | ALK | Coachella | 7% | 0.78 | +15 | NO | no | +0.22 | +0.21 |
| 2026-04-21 | ALK | Iceland | 12% | 0.59 | +29 | NO | no | +0.41 | +0.40 |
| 2026-04-21 | ALK | Iran | 7% | 0.75 | +18 | NO | no | +0.25 | +0.24 |
| 2026-04-21 | ALK | Oil | 40% | 0.20 | +40 | NO | yes | -0.20 | -0.20 |
| 2026-04-21 | ALK | Oneworld | 78% | 0.66 | +12 | YES | yes | +0.34 | +0.33 |
| 2026-04-21 | ALK | Shutdown / Shut Down | 12% | 0.50 | +38 | NO | no | +0.50 | +0.48 |
| 2026-04-21 | ALK | Starlink | 12% | 0.11 | +77 | NO | yes | -0.11 | -0.11 |
| 2026-04-22 | BA | Airbus | 52% | 0.18 | +34 | YES | no | -0.18 | -0.18 |
| 2026-04-22 | BA | Dividend | 62% | 0.26 | +36 | YES | no | -0.26 | -0.26 |
| 2026-04-22 | BA | Moon | 9% | 0.34 | +57 | NO | no | +0.66 | +0.64 |
| 2026-04-22 | BA | NASA | 56% | 0.23 | +21 | NO | yes | -0.23 | -0.23 |
| 2026-04-22 | BA | Tariff | 13% | 0.69 | +18 | NO | no | +0.31 | +0.30 |
| 2026-04-22 | GEV | China | 40% | 0.50 | +10 | NO | yes | -0.50 | -0.50 |
| 2026-04-22 | GEV | Nuclear | 67% | 0.07 | +26 | NO | yes | -0.07 | -0.07 |
| 2026-04-22 | GEV | Robotic / Robotics | 49% | 0.20 | +31 | NO | yes | -0.20 | -0.20 |
| 2026-04-22 | GEV | Tariff | 49% | 0.16 | +35 | NO | yes | -0.16 | -0.16 |
| 2026-04-22 | GEV | Vietnam / India | 49% | 0.22 | +29 | NO | yes | -0.22 | -0.22 |
| 2026-04-22 | TSLA | Competition | 22% | 0.39 | +39 | NO | yes | -0.39 | -0.39 |
| 2026-04-22 | TSLA | Cybertruck | 37% | 0.48 | +15 | NO | no | +0.52 | +0.50 |
| 2026-04-22 | TSLA | Delivery | 76% | 0.07 | +17 | NO | yes | -0.07 | -0.07 |
| 2026-04-22 | TSLA | Dojo / Dojo3 | 24% | 0.51 | +25 | NO | yes | -0.51 | -0.51 |
| 2026-04-22 | TSLA | FSD / Full Self Driving | 44% | 0.02 | +54 | NO | yes | -0.02 | -0.02 |
| 2026-04-22 | TSLA | Gigafactory | 53% | 0.37 | +16 | YES | no | -0.37 | -0.37 |
| 2026-04-22 | TSLA | Grok 5 | 4% | 0.82 | +14 | NO | no | +0.18 | +0.17 |
| 2026-04-22 | TSLA | Iran | 2% | 0.80 | +18 | NO | no | +0.20 | +0.19 |
| 2026-04-22 | TSLA | Leader / Leadership | 36% | 0.52 | +12 | NO | no | +0.48 | +0.47 |
| 2026-04-22 | TSLA | Optimus | 27% | 0.01 | +72 | NO | yes | -0.01 | -0.01 |
| 2026-04-22 | TSLA | Regulator / Regulatory / Regulation | 76% | 0.11 | +13 | NO | yes | -0.11 | -0.11 |
| 2026-04-22 | TSLA | Roadster | 48% | 0.24 | +28 | NO | yes | -0.24 | -0.24 |
| 2026-04-22 | TSLA | Supercharger / Super Charger | 48% | 0.34 | +14 | YES | yes | +0.66 | +0.64 |
| 2026-04-22 | TSLA | Semi | 51% | 0.10 | +39 | NO | yes | -0.10 | -0.10 |
| 2026-04-22 | TSLA | SpaceX / xAI | 30% | 0.13 | +57 | NO | yes | -0.13 | -0.13 |
| 2026-04-22 | TSLA | Tariff | 22% | 0.18 | +60 | NO | yes | -0.18 | -0.18 |
| 2026-04-22 | TSLA | Terafab | 4% | 0.10 | +86 | NO | yes | -0.10 | -0.10 |
| 2026-04-22 | TSLA | Trump | 8% | 0.79 | +13 | NO | no | +0.21 | +0.20 |
| 2026-04-22 | UAL | American Airlines | 16% | 0.66 | +18 | NO | no | +0.34 | +0.33 |
| 2026-04-22 | UAL | ATC / Air Traffic Control | 46% | 0.33 | +21 | NO | no | +0.67 | +0.65 |
| 2026-04-22 | UAL | Holiday | 42% | 0.15 | +27 | YES | no | -0.15 | -0.15 |
| 2026-04-22 | UAL | JetBlue | 20% | 0.63 | +17 | NO | no | +0.37 | +0.36 |
| 2026-04-22 | UAL | Middle East | 31% | 0.16 | +53 | NO | yes | -0.16 | -0.16 |
| 2026-04-22 | UAL | Newark | 72% | 0.11 | +17 | NO | yes | -0.11 | -0.11 |
| 2026-04-22 | UAL | Nonstop / Non-Stop | 42% | 0.23 | +19 | YES | no | -0.23 | -0.23 |
| 2026-04-22 | UAL | Oil  | 17% | 0.27 | +56 | NO | yes | -0.27 | -0.27 |
| 2026-04-22 | UAL | On-Time / On Time | 57% | 0.07 | +36 | NO | yes | -0.07 | -0.07 |
| 2026-04-22 | UAL | Relax Row | 6% | 0.59 | +35 | NO | yes | -0.59 | -0.59 |
| 2026-04-22 | UAL | Shutdown / Shut Down | 31% | 0.33 | +36 | NO | yes | -0.33 | -0.33 |
| 2026-04-22 | UAL | Starlink | 27% | 0.14 | +59 | NO | yes | -0.14 | -0.14 |
| 2026-04-22 | UAL | Tariff | 17% | 0.66 | +17 | NO | no | +0.34 | +0.33 |
| 2026-04-22 | UAL | Union | 53% | 0.34 | +13 | NO | no | +0.66 | +0.64 |
| 2026-04-22 | UAL | Weather | 61% | 0.21 | +18 | NO | yes | -0.21 | -0.21 |
| 2026-04-22 | UAL | World Cup | 9% | 0.56 | +35 | NO | no | +0.44 | +0.43 |
| 2026-04-23 | AXP | Currency | 27% | 0.61 | +12 | NO | no | +0.39 | +0.38 |
| 2026-04-23 | AXP | Lounge | 50% | 0.31 | +19 | NO | yes | -0.31 | -0.31 |
| 2026-04-23 | AXP | Regulation / Regulatory | 73% | 0.56 | +17 | YES | yes | +0.44 | +0.43 |
| 2026-04-23 | INTC | Arizona | 28% | 0.26 | +46 | NO | no | +0.74 | +0.72 |
| 2026-04-23 | INTC | Dividend | 76% | 0.20 | +56 | YES | no | -0.20 | -0.20 |
| 2026-04-23 | INTC | Mobileye | 55% | 0.16 | +29 | NO | yes | -0.16 | -0.16 |
| 2026-04-23 | INTC | Nvidia | 14% | 0.18 | +68 | NO | yes | -0.18 | -0.18 |
| 2026-04-23 | INTC | Panther Lake | 17% | 0.08 | +75 | NO | yes | -0.08 | -0.08 |
| 2026-04-23 | INTC | Personal Computing | 5% | 0.82 | +13 | NO | no | +0.18 | +0.17 |
| 2026-04-23 | INTC | Security | 54% | 0.24 | +22 | NO | yes | -0.24 | -0.24 |
| 2026-04-23 | INTC | Tariff | 13% | 0.54 | +33 | NO | no | +0.46 | +0.45 |
| 2026-04-23 | INTC | Trump | 5% | 0.75 | +20 | NO | no | +0.25 | +0.24 |
| 2026-04-23 | INTC | Ultra 3 / Ultra Series 3 | 4% | 0.11 | +85 | NO | yes | -0.11 | -0.11 |
| 2026-04-23 | INTC | Xeon | 78% | 0.03 | +19 | NO | yes | -0.03 | -0.03 |
| 2026-04-24 | PG | AI / Artificial Intelligence | 15% | 0.19 | +66 | NO | yes | -0.19 | -0.19 |
| 2026-04-24 | PG | Beauty | 82% | 0.68 | +14 | YES | yes | +0.32 | +0.31 |
| 2026-04-24 | PG | Competition | 76% | 0.55 | +21 | YES | no | -0.55 | -0.55 |
| 2026-04-24 | PG | Inflation | 62% | 0.12 | +26 | NO | yes | -0.12 | -0.12 |
| 2026-04-24 | PG | Old Spice | 23% | 0.57 | +20 | NO | no | +0.43 | +0.42 |
| 2026-04-24 | PG | Tariff | 23% | 0.07 | +70 | NO | yes | -0.07 | -0.07 |
| 2026-04-24 | PG | WNBA | 3% | 0.55 | +42 | NO | no | +0.45 | +0.44 |
| 2026-04-27 | DPZ | AI / Artificial Intelligence | 13% | 0.24 | +63 | NO | yes | -0.24 | -0.24 |
| 2026-04-27 | DPZ | Automation | 7% | 0.81 | +12 | NO | no | +0.19 | +0.18 |
| 2026-04-27 | DPZ | Closure | 85% | 0.71 | +14 | YES | yes | +0.29 | +0.28 |
| 2026-04-27 | DPZ | Craveable | 4% | 0.82 | +14 | NO | no | +0.18 | +0.17 |
| 2026-04-27 | DPZ | DoorDash (5+ times) | 2% | 0.51 | +47 | NO | no | +0.49 | +0.48 |
| 2026-04-27 | DPZ | Emergency Pizza | 13% | 0.53 | +34 | NO | no | +0.47 | +0.46 |
| 2026-04-27 | DPZ | Insurance | 39% | 0.48 | +13 | NO | yes | -0.48 | -0.48 |
| 2026-04-27 | DPZ | Parmesan | 21% | 0.16 | +63 | NO | no | +0.84 | +0.81 |
| 2026-04-27 | DPZ | Same Store | 12% | 0.04 | +84 | NO | yes | -0.04 | -0.04 |
| 2026-04-27 | DPZ | Spicy | 4% | 0.80 | +16 | NO | no | +0.20 | +0.19 |
| 2026-04-27 | DPZ | Tailwind | 41% | 0.19 | +40 | NO | yes | -0.19 | -0.19 |
| 2026-04-27 | DPZ | Tariff | 5% | 0.77 | +18 | NO | no | +0.23 | +0.22 |
| 2026-04-27 | VZ | C-Band | 78% | 0.10 | +12 | NO | no | +0.90 | +0.87 |
| 2026-04-27 | VZ | Home / MyHome | 88% | 0.75 | +13 | YES | yes | +0.25 | +0.24 |
| 2026-04-27 | VZ | Spectrum | 92% | 0.72 | +20 | YES | no | -0.72 | -0.72 |
| 2026-04-27 | VZ | Starry | 11% | 0.41 | +48 | NO | yes | -0.41 | -0.41 |
| 2026-04-27 | VZ | Synergy | 14% | 0.13 | +73 | NO | yes | -0.13 | -0.13 |
| 2026-04-28 | HOOD | Acquisition | 65% | 0.14 | +21 | NO | yes | -0.14 | -0.14 |
| 2026-04-28 | HOOD | Bitcoin | 34% | 0.55 | +11 | NO | yes | -0.55 | -0.55 |
| 2026-04-28 | HOOD | Blockchain | 25% | 0.43 | +32 | NO | no | +0.57 | +0.55 |
| 2026-04-28 | HOOD | Credit Card | 65% | 0.18 | +17 | NO | yes | -0.18 | -0.18 |
| 2026-04-28 | HOOD | Indonesia | 11% | 0.77 | +12 | NO | yes | -0.77 | -0.77 |
| 2026-04-28 | HOOD | International | 74% | 0.03 | +23 | NO | yes | -0.03 | -0.03 |
| 2026-04-28 | HOOD | Kalshi | 11% | 0.68 | +21 | NO | no | +0.32 | +0.31 |
| 2026-04-28 | HOOD | Perp / Perpetual | 16% | 0.35 | +49 | NO | yes | -0.35 | -0.35 |
| 2026-04-28 | HOOD | SIG / Susquehanna | 11% | 0.49 | +40 | NO | yes | -0.49 | -0.49 |
| 2026-04-28 | HOOD | Social | 38% | 0.05 | +57 | NO | yes | -0.05 | -0.05 |
| 2026-04-28 | HOOD | Tokenization | 25% | 0.08 | +67 | NO | yes | -0.08 | -0.08 |
| 2026-04-28 | HOOD | Trump | 16% | 0.34 | +50 | NO | yes | -0.34 | -0.34 |
| 2026-04-28 | KO | Alcohol / Alcoholic | 65% | 0.39 | +26 | YES | no | -0.39 | -0.39 |
| 2026-04-28 | KO | Cane Sugar | 5% | 0.71 | +24 | NO | no | +0.29 | +0.28 |
| 2026-04-28 | KO | Dividend | 73% | 0.16 | +11 | NO | no | +0.84 | +0.81 |
| 2026-04-28 | KO | Fairlife | 56% | 0.04 | +40 | NO | yes | -0.04 | -0.04 |
| 2026-04-28 | KO | International | 31% | 0.47 | +22 | NO | no | +0.53 | +0.51 |
| 2026-04-28 | KO | Tariff | 10% | 0.70 | +20 | NO | no | +0.30 | +0.29 |
| 2026-04-28 | SBUX | Boyu | 5% | 0.09 | +86 | NO | yes | -0.09 | -0.09 |
| 2026-04-28 | SBUX | Canada | 41% | 0.46 | +13 | NO | no | +0.54 | +0.52 |
| 2026-04-28 | SBUX | Comparable Sales | 28% | 0.56 | +16 | NO | yes | -0.56 | -0.56 |
| 2026-04-28 | SBUX | Condiment Bar | 14% | 0.70 | +16 | NO | no | +0.30 | +0.29 |
| 2026-04-28 | SBUX | Non Dairy | 3% | 0.75 | +22 | NO | no | +0.25 | +0.24 |
| 2026-04-28 | SBUX | Protein | 26% | 0.04 | +70 | NO | yes | -0.04 | -0.04 |
| 2026-04-28 | SBUX | Recycle / Recyclable | 9% | 0.79 | +12 | NO | no | +0.21 | +0.20 |
| 2026-04-28 | SBUX | Smart Queue / SmartQ | 9% | 0.20 | +71 | NO | yes | -0.20 | -0.20 |
| 2026-04-28 | SBUX | Tariff | 11% | 0.04 | +85 | NO | yes | -0.04 | -0.04 |
| 2026-04-28 | SPOT | Anna's Archive | 4% | 0.80 | +16 | NO | no | +0.20 | +0.19 |
| 2026-04-28 | SPOT | Award | 7% | 0.71 | +22 | NO | no | +0.29 | +0.28 |
| 2026-04-28 | SPOT | Bookshop / Bookshop.org | 7% | 0.32 | +61 | NO | no | +0.68 | +0.66 |
| 2026-04-28 | SPOT | ChatGPT | 7% | 0.68 | +25 | NO | yes | -0.68 | -0.68 |
| 2026-04-28 | SPOT | Headwind | 50% | 0.22 | +28 | NO | no | +0.78 | +0.76 |
| 2026-04-28 | SPOT | Message | 27% | 0.52 | +21 | NO | no | +0.48 | +0.47 |
| 2026-04-28 | SPOT | Meta | 7% | 0.77 | +16 | NO | no | +0.23 | +0.22 |
| 2026-04-28 | SPOT | Monetization | 75% | 0.06 | +19 | NO | yes | -0.06 | -0.06 |
| 2026-04-28 | SPOT | Netflix | 27% | 0.55 | +18 | NO | no | +0.45 | +0.44 |
| 2026-04-28 | SPOT | Physical | 30% | 0.45 | +25 | NO | no | +0.55 | +0.53 |
| 2026-04-28 | SPOT | Retain / Retention | 84% | 0.04 | +12 | NO | yes | -0.04 | -0.04 |
| 2026-04-28 | V | Blockchain | 20% | 0.14 | +66 | NO | yes | -0.14 | -0.14 |
| 2026-04-28 | V | Cybersecurity | 19% | 0.68 | +13 | NO | no | +0.32 | +0.31 |
| 2026-04-28 | V | Holiday | 36% | 0.17 | +19 | YES | no | -0.17 | -0.17 |
| 2026-04-28 | V | Hyperscaler | 7% | 0.28 | +65 | NO | yes | -0.28 | -0.28 |
| 2026-04-28 | V | Inflation | 20% | 0.58 | +22 | NO | no | +0.42 | +0.41 |
| 2026-04-28 | V | Loyalty | 32% | 0.22 | +10 | YES | yes | +0.78 | +0.76 |
| 2026-04-28 | V | Regulation / Regulatory | 69% | 0.58 | +11 | YES | yes | +0.42 | +0.41 |
| 2026-04-28 | V | Southwest | 10% | 0.78 | +12 | NO | no | +0.22 | +0.21 |
| 2026-04-28 | V | Tokenization | 56% | 0.04 | +40 | NO | yes | -0.04 | -0.04 |
| 2026-04-28 | V | World Cup | 26% | 0.29 | +45 | NO | yes | -0.29 | -0.29 |
| 2026-04-29 | AMZN | Alexa+ / Alexa Plus | 8% | 0.05 | +87 | NO | yes | -0.05 | -0.05 |
| 2026-04-29 | AMZN | China | 42% | 0.29 | +13 | YES | no | -0.29 | -0.29 |
| 2026-04-29 | AMZN | Data Center | 41% | 0.11 | +48 | NO | yes | -0.11 | -0.11 |
| 2026-04-29 | AMZN | Drone | 8% | 0.62 | +30 | NO | no | +0.38 | +0.37 |
| 2026-04-29 | AMZN | Gen-AI / Generative AI | 20% | 0.15 | +65 | NO | yes | -0.15 | -0.15 |
| 2026-04-29 | AMZN | Live Sports | 25% | 0.06 | +69 | NO | yes | -0.06 | -0.06 |
| 2026-04-29 | AMZN | OpenAI | 5% | 0.10 | +85 | NO | yes | -0.10 | -0.10 |
| 2026-04-29 | AMZN | Prime Day | 48% | 0.26 | +26 | NO | yes | -0.26 | -0.26 |
| 2026-04-29 | AMZN | Project Kuiper | 13% | 0.77 | +10 | NO | no | +0.23 | +0.22 |
| 2026-04-29 | AMZN | Robotic / Robotics | 28% | 0.10 | +62 | NO | yes | -0.10 | -0.10 |
| 2026-04-29 | AMZN | RxPass | 8% | 0.65 | +27 | NO | no | +0.35 | +0.34 |
| 2026-04-29 | AMZN | Silicon | 19% | 0.10 | +71 | NO | yes | -0.10 | -0.10 |
| 2026-04-29 | AMZN | Sponsored Products | 26% | 0.32 | +42 | NO | no | +0.68 | +0.66 |
| 2026-04-29 | AMZN | Supply Chain | 26% | 0.51 | +23 | NO | yes | -0.51 | -0.51 |
| 2026-04-29 | AMZN | Tariff | 8% | 0.02 | +90 | NO | yes | -0.02 | -0.02 |
| 2026-04-29 | AMZN | Third Party Sellers | 4% | 0.28 | +68 | NO | yes | -0.28 | -0.28 |
| 2026-04-29 | CAR | AI / Artificial Intelligence | 11% | 0.58 | +31 | NO | no | +0.42 | +0.41 |
| 2026-04-29 | CAR | Squeeze / Squeezed | 15% | 0.72 | +13 | NO | yes | -0.72 | -0.72 |
| 2026-04-29 | CAR | Tariff | 28% | 0.18 | +54 | NO | no | +0.82 | +0.80 |
| 2026-04-29 | CAR | Upgrade | 15% | 0.72 | +13 | NO | no | +0.28 | +0.27 |
| 2026-04-29 | CAR | Waymo | 15% | 0.18 | +67 | NO | yes | -0.18 | -0.18 |
| 2026-04-29 | CAR | World Cup | 11% | 0.55 | +34 | NO | yes | -0.55 | -0.55 |
| 2026-04-29 | CMG | Al Pastor | 20% | 0.10 | +70 | NO | yes | -0.10 | -0.10 |
| 2026-04-29 | CMG | Autocado | 14% | 0.66 | +20 | NO | no | +0.34 | +0.33 |
| 2026-04-29 | CMG | Automation | 16% | 0.72 | +12 | NO | no | +0.28 | +0.27 |
| 2026-04-29 | CMG | Carne Asada | 29% | 0.47 | +24 | NO | no | +0.53 | +0.51 |
| 2026-04-29 | CMG | Chipotle Lane / Chipotlane | 44% | 0.09 | +47 | NO | yes | -0.09 | -0.09 |
| 2026-04-29 | CMG | Headwind | 41% | 0.37 | +22 | NO | no | +0.63 | +0.61 |
| 2026-04-29 | CMG | Honey Chicken | 8% | 0.10 | +82 | NO | yes | -0.10 | -0.10 |
| 2026-04-29 | CMG | Share Purchase | 10% | 0.39 | +51 | NO | no | +0.61 | +0.59 |
| 2026-04-29 | CMG | Supply Chain | 59% | 0.21 | +20 | NO | no | +0.79 | +0.77 |
| 2026-04-29 | CMG | Tailwind | 15% | 0.57 | +28 | NO | no | +0.43 | +0.42 |
| 2026-04-29 | CMG | Transaction Growth | 44% | 0.23 | +33 | NO | yes | -0.23 | -0.23 |
| 2026-04-29 | CMG | Promotion | 78% | 0.10 | +12 | NO | yes | -0.10 | -0.10 |
| 2026-04-29 | CMG | Tariff | 10% | 0.22 | +68 | NO | no | +0.78 | +0.76 |
| 2026-04-29 | CVNA | AI / Artificial Intelligence | 22% | 0.10 | +68 | NO | yes | -0.10 | -0.10 |
| 2026-04-29 | CVNA | Bridgecrest | 4% | 0.61 | +35 | NO | no | +0.39 | +0.38 |
| 2026-04-29 | CVNA | DriveTime | 9% | 0.74 | +17 | NO | no | +0.26 | +0.25 |
| 2026-04-29 | CVNA | Headwind | 56% | 0.39 | +17 | YES | no | -0.39 | -0.39 |
| 2026-04-29 | CVNA | Insurance | 20% | 0.65 | +15 | NO | no | +0.35 | +0.34 |
| 2026-04-29 | CVNA | Same Day | 9% | 0.40 | +51 | NO | no | +0.60 | +0.58 |
| 2026-04-29 | CVNA | Stadium | 4% | 0.70 | +26 | NO | no | +0.30 | +0.29 |
| 2026-04-29 | CVNA | Tariff | 14% | 0.51 | +35 | NO | yes | -0.51 | -0.51 |
| 2026-04-29 | GOOGL | Autonomous | 41% | 0.27 | +32 | NO | yes | -0.27 | -0.27 |
| 2026-04-29 | GOOGL | Circle to Search | 15% | 0.30 | +55 | NO | yes | -0.30 | -0.30 |
| 2026-04-29 | GOOGL | DeepMind / Deep Mind | 35% | 0.15 | +50 | NO | no | +0.85 | +0.82 |
| 2026-04-29 | GOOGL | European Commission | 10% | 0.77 | +13 | NO | no | +0.23 | +0.22 |
| 2026-04-29 | GOOGL | Gemini 3 | 5% | 0.10 | +85 | NO | yes | -0.10 | -0.10 |
| 2026-04-29 | GOOGL | Ironwood | 7% | 0.40 | +53 | NO | yes | -0.40 | -0.40 |
| 2026-04-29 | GOOGL | Nano Banana | 5% | 0.31 | +64 | NO | yes | -0.31 | -0.31 |
| 2026-04-29 | GOOGL | Privacy | 43% | 0.25 | +18 | YES | no | -0.25 | -0.25 |
| 2026-04-29 | GOOGL | Quantum | 12% | 0.56 | +32 | NO | no | +0.44 | +0.43 |
| 2026-04-29 | GOOGL | Regulator / Regulation / Regulatory | 34% | 0.22 | +12 | YES | no | -0.22 | -0.22 |
| 2026-04-29 | GOOGL | Search Advertising / Search Ad | 66% | 0.22 | +12 | NO | no | +0.78 | +0.76 |
| 2026-04-29 | GOOGL | Tailwind | 32% | 0.30 | +38 | NO | yes | -0.30 | -0.30 |
| 2026-04-29 | GOOGL | Wiz | 4% | 0.11 | +85 | NO | yes | -0.11 | -0.11 |
| 2026-04-29 | GOOGL | Youtube Shorts | 30% | 0.45 | +25 | NO | no | +0.55 | +0.53 |
| 2026-04-29 | META | Algorithm | 25% | 0.40 | +35 | NO | yes | -0.40 | -0.40 |
| 2026-04-29 | META | Cloud | 20% | 0.08 | +72 | NO | yes | -0.08 | -0.08 |
| 2026-04-29 | META | Dividend | 23% | 0.14 | +63 | NO | no | +0.86 | +0.83 |
| 2026-04-29 | META | Hyperion | 4% | 0.64 | +32 | NO | no | +0.36 | +0.35 |
| 2026-04-29 | META | Llama | 22% | 0.38 | +40 | NO | no | +0.62 | +0.60 |
| 2026-04-29 | META | Muse | 3% | 0.03 | +94 | NO | yes | -0.03 | -0.03 |
| 2026-04-29 | META | Oakley | 8% | 0.38 | +54 | NO | yes | -0.38 | -0.38 |
| 2026-04-29 | META | Orion | 9% | 0.51 | +40 | NO | no | +0.49 | +0.48 |
| 2026-04-29 | META | Ray-Ban | 23% | 0.19 | +58 | NO | yes | -0.19 | -0.19 |
| 2026-04-29 | META | Reels (3+ times) | 3% | 0.23 | +74 | NO | no | +0.77 | +0.75 |
| 2026-04-29 | META | SAM | 4% | 0.72 | +24 | NO | no | +0.28 | +0.27 |
| 2026-04-29 | META | Thread / Threads | 47% | 0.05 | +48 | NO | yes | -0.05 | -0.05 |
| 2026-04-29 | META | VR / Virtual Reality | 71% | 0.53 | +18 | YES | yes | +0.47 | +0.46 |
| 2026-04-29 | MSFT | Anthropic | 5% | 0.23 | +72 | NO | yes | -0.23 | -0.23 |
| 2026-04-29 | MSFT | Fairwater | 5% | 0.19 | +76 | NO | yes | -0.19 | -0.19 |
| 2026-04-29 | MSFT | Frontier | 22% | 0.57 | +21 | NO | yes | -0.57 | -0.57 |
| 2026-04-29 | MSFT | Gaming | 85% | 0.04 | +11 | NO | yes | -0.04 | -0.04 |
| 2026-04-29 | MSFT | LinkedIn | 63% | 0.04 | +33 | NO | yes | -0.04 | -0.04 |
| 2026-04-29 | MSFT | OpenAI | 37% | 0.03 | +60 | NO | yes | -0.03 | -0.03 |
| 2026-04-29 | MSFT | Phi | 10% | 0.80 | +10 | NO | no | +0.20 | +0.19 |
| 2026-04-29 | MSFT | Teams | 72% | 0.04 | +24 | NO | yes | -0.04 | -0.04 |
| 2026-04-29 | MSFT | Windows 11 | 31% | 0.11 | +58 | NO | no | +0.89 | +0.86 |
| 2026-04-29 | WING | Chicken | 92% | 0.81 | +11 | YES | yes | +0.19 | +0.18 |
| 2026-04-29 | WING | Citrus Mojo | 4% | 0.39 | +57 | NO | yes | -0.39 | -0.39 |
| 2026-04-29 | WING | Hot Box | 4% | 0.72 | +24 | NO | no | +0.28 | +0.27 |
| 2026-04-29 | WING | Lemon Pepper | 7% | 0.70 | +23 | NO | yes | -0.70 | -0.70 |
| 2026-04-29 | WING | NFL / NBA | 44% | 0.34 | +22 | NO | no | +0.66 | +0.64 |
| 2026-04-29 | WING | Share Repurchase | 33% | 0.04 | +63 | NO | yes | -0.04 | -0.04 |
| 2026-04-29 | WING | Tender | 44% | 0.28 | +28 | NO | yes | -0.28 | -0.28 |
| 2026-04-30 | AAPL | Apple Pay | 61% | 0.17 | +22 | NO | no | +0.83 | +0.81 |
| 2026-04-30 | AAPL | Creator Studio | 4% | 0.42 | +54 | NO | no | +0.58 | +0.56 |
| 2026-04-30 | AAPL | Formula 1 / F1 | 10% | 0.23 | +67 | NO | yes | -0.23 | -0.23 |
| 2026-04-30 | AAPL | Fold / Folding / Foldable | 6% | 0.73 | +21 | NO | no | +0.27 | +0.26 |
| 2026-04-30 | AAPL | Gemini | 4% | 0.54 | +42 | NO | no | +0.46 | +0.45 |
| 2026-04-30 | AAPL | Glasses | 4% | 0.76 | +20 | NO | no | +0.24 | +0.23 |
| 2026-04-30 | AAPL | Liquid Glass | 6% | 0.66 | +28 | NO | no | +0.34 | +0.33 |
| 2026-04-30 | AAPL | Manufacturing | 59% | 0.05 | +36 | NO | yes | -0.05 | -0.05 |
| 2026-04-30 | AAPL | Modem | 12% | 0.73 | +15 | NO | yes | -0.73 | -0.73 |
| 2026-04-30 | AAPL | Privacy | 58% | 0.18 | +24 | NO | yes | -0.18 | -0.18 |
| 2026-04-30 | AAPL | Siri | 53% | 0.05 | +42 | NO | yes | -0.05 | -0.05 |
| 2026-04-30 | AAPL | Streaming | 31% | 0.51 | +18 | NO | no | +0.49 | +0.48 |
| 2026-04-30 | AAPL | Tariff | 20% | 0.05 | +75 | NO | yes | -0.05 | -0.05 |
| 2026-04-30 | AAPL | Wearable | 61% | 0.04 | +35 | NO | yes | -0.04 | -0.04 |
| 2026-04-30 | AAPL | Widget | 6% | 0.81 | +13 | NO | no | +0.19 | +0.18 |
| 2026-04-30 | LLY | AI / Artificial Intelligence | 7% | 0.20 | +73 | NO | no | +0.80 | +0.78 |
| 2026-04-30 | LLY | China | 84% | 0.05 | +11 | NO | yes | -0.05 | -0.05 |
| 2026-04-30 | LLY | Foundayo | 3% | 0.02 | +95 | NO | yes | -0.02 | -0.02 |
| 2026-04-30 | LLY | Headwind | 84% | 0.50 | +34 | YES | yes | +0.50 | +0.48 |
| 2026-04-30 | LLY | Inluriyo | 5% | 0.37 | +58 | NO | yes | -0.37 | -0.37 |
| 2026-04-30 | LLY | LillyDirect | 11% | 0.05 | +84 | NO | yes | -0.05 | -0.05 |
| 2026-04-30 | LLY | Nvidia | 5% | 0.49 | +46 | NO | no | +0.51 | +0.49 |
| 2026-04-30 | LLY | Pennsylvania | 3% | 0.62 | +35 | NO | no | +0.38 | +0.37 |
| 2026-04-30 | LLY | Tariff | 7% | 0.57 | +36 | NO | no | +0.43 | +0.42 |
| 2026-04-30 | LLY | Ventyx | 5% | 0.35 | +60 | NO | yes | -0.35 | -0.35 |
| 2026-04-30 | LLY | Vial | 35% | 0.11 | +54 | NO | yes | -0.11 | -0.11 |
| 2026-04-30 | LLY | Walmart | 5% | 0.56 | +39 | NO | no | +0.44 | +0.43 |
| 2026-04-30 | RDDT | Game | 57% | 0.41 | +16 | YES | no | -0.41 | -0.41 |
| 2026-04-30 | RDDT | Headwind | 40% | 0.27 | +13 | YES | no | -0.27 | -0.27 |
| 2026-04-30 | RDDT | Reddit Pro | 75% | 0.04 | +21 | NO | yes | -0.04 | -0.04 |
| 2026-04-30 | RDDT | Shopify | 14% | 0.04 | +82 | NO | yes | -0.04 | -0.04 |
| 2026-04-30 | RIVN | Cox | 7% | 0.58 | +35 | NO | no | +0.42 | +0.41 |
| 2026-04-30 | RIVN | Headwind | 36% | 0.52 | +12 | NO | no | +0.48 | +0.47 |
| 2026-04-30 | RIVN | Robot / Robotic / Robotics | 40% | 0.29 | +31 | NO | yes | -0.29 | -0.29 |
| 2026-04-30 | RIVN | Robotaxi | 12% | 0.11 | +77 | NO | yes | -0.11 | -0.11 |
| 2026-04-30 | RIVN | Tailwind | 54% | 0.37 | +17 | YES | no | -0.37 | -0.37 |
| 2026-04-30 | RIVN | Tornado | 7% | 0.43 | +50 | NO | yes | -0.43 | -0.43 |
| 2026-04-30 | RIVN | Uber | 7% | 0.07 | +86 | NO | yes | -0.07 | -0.07 |
| 2026-05-04 | ON | Autonomous / Automation | 67% | 0.14 | +19 | NO | yes | -0.14 | -0.14 |
| 2026-05-04 | ON | Backlog | 82% | 0.50 | +32 | YES | yes | +0.50 | +0.48 |
| 2026-05-04 | ON | Market Share | 52% | 0.32 | +16 | NO | yes | -0.32 | -0.32 |
| 2026-05-04 | ON | NIO | 7% | 0.23 | +70 | NO | yes | -0.23 | -0.23 |
| 2026-05-04 | ON | Nvidia | 16% | 0.54 | +30 | NO | no | +0.46 | +0.45 |
| 2026-05-04 | ON | Sineng Electric | 3% | 0.61 | +36 | NO | yes | -0.61 | -0.61 |
| 2026-05-04 | ON | Tariff | 20% | 0.65 | +15 | NO | no | +0.35 | +0.34 |
| 2026-05-04 | PLTR | Commercial Growth | 18% | 0.60 | +22 | NO | yes | -0.60 | -0.60 |
| 2026-05-04 | PLTR | Government Contract | 14% | 0.75 | +11 | NO | no | +0.25 | +0.24 |
| 2026-05-04 | PLTR | Healthcare | 77% | 0.56 | +21 | YES | no | -0.56 | -0.56 |
| 2026-05-04 | PLTR | International | 85% | 0.02 | +13 | NO | yes | -0.02 | -0.02 |
| 2026-05-04 | PLTR | Iran / Iranian | 14% | 0.28 | +58 | NO | no | +0.72 | +0.70 |
| 2026-05-04 | PLTR | Lethal | 34% | 0.24 | +42 | NO | no | +0.76 | +0.74 |
| 2026-05-04 | PLTR | Nvidia | 6% | 0.57 | +37 | NO | no | +0.43 | +0.42 |
| 2026-05-04 | PLTR | Revenue guidance | 66% | 0.13 | +21 | NO | yes | -0.13 | -0.13 |
| 2026-05-04 | PLTR | Stellantis | 6% | 0.72 | +22 | NO | no | +0.28 | +0.27 |
| 2026-05-04 | PLTR | USDA | 6% | 0.20 | +74 | NO | yes | -0.20 | -0.20 |
| 2026-05-04 | PLTR | Warp Speed | 42% | 0.08 | +50 | NO | yes | -0.08 | -0.08 |
| 2026-05-05 | PYPL | Ads ID | 3% | 0.31 | +66 | NO | no | +0.69 | +0.67 |
| 2026-05-05 | PYPL | Bank | 90% | 0.43 | +47 | YES | no | -0.43 | -0.43 |
| 2026-05-05 | PYPL | Biometric | 19% | 0.09 | +72 | NO | yes | -0.09 | -0.09 |
| 2026-05-05 | PYPL | Bitcoin | 8% | 0.75 | +17 | NO | no | +0.25 | +0.24 |
| 2026-05-05 | PYPL | Blockchain | 14% | 0.60 | +26 | NO | no | +0.40 | +0.39 |
| 2026-05-05 | PYPL | Blue Owl | 6% | 0.79 | +15 | NO | no | +0.21 | +0.20 |
| 2026-05-05 | PYPL | Cash Back / Cashback | 39% | 0.33 | +28 | NO | no | +0.67 | +0.65 |
| 2026-05-05 | PYPL | College | 8% | 0.66 | +26 | NO | no | +0.34 | +0.33 |
| 2026-05-05 | PYPL | Perplexity | 10% | 0.45 | +45 | NO | no | +0.55 | +0.53 |
| 2026-05-05 | PYPL | Regulation / Regulator / Regulatory | 52% | 0.37 | +15 | YES | no | -0.37 | -0.37 |
| 2026-05-05 | PYPL | Stablecoin / Stable Coin | 14% | 0.43 | +43 | NO | yes | -0.43 | -0.43 |
| 2026-05-05 | PYPL | Stash | 5% | 0.52 | +43 | NO | no | +0.48 | +0.47 |
| 2026-05-05 | SHOP | Amazon | 60% | 0.41 | +19 | YES | yes | +0.59 | +0.57 |
| 2026-05-05 | SHOP | Headwind | 55% | 0.11 | +34 | NO | yes | -0.11 | -0.11 |
| 2026-05-05 | SHOP | Klarna | 12% | 0.49 | +39 | NO | no | +0.51 | +0.49 |
| 2026-05-05 | SHOP | OpenAI | 14% | 0.26 | +60 | NO | yes | -0.26 | -0.26 |
| 2026-05-05 | SHOP | Repurchase / Buyback | 10% | 0.29 | +61 | NO | yes | -0.29 | -0.29 |
| 2026-05-05 | SHOP | Shop Pay | 57% | 0.02 | +41 | NO | yes | -0.02 | -0.02 |
| 2026-05-05 | SHOP | Tariff | 16% | 0.21 | +63 | NO | no | +0.79 | +0.77 |
| 2026-05-06 | DIS | Abu Dhabi | 8% | 0.26 | +66 | NO | yes | -0.26 | -0.26 |
| 2026-05-06 | DIS | Acquisition | 80% | 0.52 | +28 | YES | yes | +0.48 | +0.47 |
| 2026-05-06 | DIS | Competition | 48% | 0.07 | +45 | NO | no | +0.93 | +0.90 |
| 2026-05-06 | DIS | Cruise | 75% | 0.04 | +21 | NO | yes | -0.04 | -0.04 |
| 2026-05-06 | DIS | Fortnite | 4% | 0.71 | +25 | NO | yes | -0.71 | -0.71 |
| 2026-05-06 | DIS | Grogu | 7% | 0.15 | +78 | NO | yes | -0.15 | -0.15 |
| 2026-05-06 | DIS | Kimmel | 2% | 0.86 | +12 | NO | no | +0.14 | +0.14 |
| 2026-05-06 | DIS | NFL | 75% | 0.11 | +14 | NO | yes | -0.11 | -0.11 |
| 2026-05-06 | DIS | OpenAI / Sora | 4% | 0.49 | +47 | NO | no | +0.51 | +0.49 |
| 2026-05-06 | DIS | Subscriber | 84% | 0.05 | +11 | NO | yes | -0.05 | -0.05 |
| 2026-05-06 | DIS | Trump | 4% | 0.85 | +11 | NO | no | +0.15 | +0.15 |
| 2026-05-06 | DIS | Warner Bros. / Warner Brothers | 8% | 0.46 | +46 | NO | no | +0.54 | +0.52 |
| 2026-05-06 | DIS | Weather | 8% | 0.74 | +18 | NO | no | +0.26 | +0.25 |
| 2026-05-06 | DIS | WWE | 4% | 0.32 | +64 | NO | no | +0.68 | +0.66 |
| 2026-05-06 | DIS | YouTube TV | 5% | 0.80 | +15 | NO | no | +0.20 | +0.19 |
| 2026-05-06 | UBER | Avride | 14% | 0.42 | +44 | NO | no | +0.58 | +0.56 |
| 2026-05-06 | UBER | Driver Incentives | 37% | 0.09 | +28 | YES | no | -0.09 | -0.09 |
| 2026-05-06 | UBER | Elite | 8% | 0.31 | +61 | NO | no | +0.69 | +0.67 |
| 2026-05-06 | UBER | Freight | 59% | 0.22 | +19 | NO | yes | -0.22 | -0.22 |
| 2026-05-06 | UBER | Innovation | 72% | 0.16 | +12 | NO | yes | -0.16 | -0.16 |
| 2026-05-06 | UBER | Joby | 15% | 0.21 | +64 | NO | no | +0.79 | +0.77 |
| 2026-05-06 | UBER | Lucid | 11% | 0.28 | +61 | NO | yes | -0.28 | -0.28 |
| 2026-05-06 | UBER | Lyft | 53% | 0.28 | +25 | YES | yes | +0.72 | +0.70 |
| 2026-05-06 | UBER | Market Share | 43% | 0.12 | +45 | NO | no | +0.88 | +0.85 |
| 2026-05-06 | UBER | Nissan | 5% | 0.47 | +48 | NO | no | +0.53 | +0.51 |
| 2026-05-06 | UBER | Oil / Gas / Gasoline | 21% | 0.39 | +40 | NO | no | +0.61 | +0.59 |
| 2026-05-06 | UBER | Regulator / Regulatory / Regulation | 72% | 0.09 | +19 | NO | yes | -0.09 | -0.09 |
| 2026-05-06 | UBER | Safety | 59% | 0.14 | +27 | NO | yes | -0.14 | -0.14 |
| 2026-05-06 | UBER | Uber Copter | 5% | 0.85 | +10 | NO | no | +0.15 | +0.15 |
| 2026-05-06 | UBER | Waabi | 17% | 0.34 | +49 | NO | no | +0.66 | +0.64 |
| 2026-05-06 | UBER | Waymo | 30% | 0.04 | +66 | NO | yes | -0.04 | -0.04 |
| 2026-05-07 | ABNB | Acquisition | 44% | 0.27 | +17 | YES | yes | +0.73 | +0.71 |
| 2026-05-07 | ABNB | Boutique | 31% | 0.17 | +52 | NO | yes | -0.17 | -0.17 |
| 2026-05-07 | ABNB | Domestic | 68% | 0.13 | +19 | NO | no | +0.87 | +0.84 |
| 2026-05-07 | ABNB | International | 68% | 0.12 | +20 | NO | yes | -0.12 | -0.12 |
| 2026-05-07 | ABNB | Service Agent | 39% | 0.19 | +42 | NO | no | +0.81 | +0.79 |
| 2026-05-07 | ABNB | Tailwind | 60% | 0.21 | +19 | NO | yes | -0.21 | -0.21 |
| 2026-05-07 | ABNB | World Cup | 23% | 0.04 | +73 | NO | yes | -0.04 | -0.04 |
| 2026-05-07 | LYFT | Expansion | 53% | 0.26 | +21 | NO | yes | -0.26 | -0.26 |
| 2026-05-07 | LYFT | FreeNow / Free Now | 17% | 0.04 | +79 | NO | yes | -0.04 | -0.04 |
| 2026-05-07 | LYFT | International | 27% | 0.36 | +37 | NO | no | +0.64 | +0.62 |
| 2026-05-07 | LYFT | Membership | 40% | 0.26 | +14 | YES | no | -0.26 | -0.26 |
| 2026-05-07 | LYFT | Mobileye | 17% | 0.53 | +30 | NO | no | +0.47 | +0.46 |
| 2026-05-07 | LYFT | Nvidia | 11% | 0.46 | +43 | NO | no | +0.54 | +0.52 |
| 2026-05-07 | LYFT | Waymo | 37% | 0.07 | +56 | NO | yes | -0.07 | -0.07 |
| 2026-05-07 | MCD | Big Arch | 13% | 0.09 | +78 | NO | yes | -0.09 | -0.09 |
| 2026-05-07 | MCD | Buffalo | 2% | 0.83 | +15 | NO | no | +0.17 | +0.16 |
| 2026-05-07 | MCD | Delivery | 72% | 0.56 | +16 | YES | yes | +0.44 | +0.43 |
| 2026-05-07 | MCD | DoorDash | 10% | 0.80 | +10 | NO | no | +0.20 | +0.19 |
| 2026-05-07 | MCD | Happy Meal | 28% | 0.38 | +34 | NO | yes | -0.38 | -0.38 |
| 2026-05-07 | MCD | Hot Honey | 4% | 0.75 | +21 | NO | yes | -0.75 | -0.75 |
| 2026-05-07 | MCD | Loyalty | 57% | 0.11 | +32 | NO | no | +0.89 | +0.86 |
| 2026-05-07 | MCD | McChicken | 20% | 0.44 | +36 | NO | yes | -0.44 | -0.44 |
| 2026-05-07 | MCD | Monopoly | 28% | 0.47 | +25 | NO | no | +0.53 | +0.51 |
| 2026-05-07 | MCD | Revenue | 48% | 0.40 | +12 | NO | no | +0.60 | +0.58 |
| 2026-05-07 | MCD | Supply Chain | 55% | 0.24 | +21 | NO | yes | -0.24 | -0.24 |
| 2026-05-07 | MCD | Tariff | 8% | 0.78 | +14 | NO | no | +0.22 | +0.21 |
| 2026-05-11 | CRCL | Acceleration | 58% | 0.30 | +12 | NO | yes | -0.30 | -0.30 |
| 2026-05-11 | CRCL | Fintech | 50% | 0.24 | +26 | NO | yes | -0.24 | -0.24 |
| 2026-05-11 | CRCL | Intuit | 46% | 0.27 | +27 | NO | no | +0.73 | +0.71 |
| 2026-05-11 | CRCL | Kraken | 58% | 0.31 | +11 | NO | no | +0.69 | +0.67 |
| 2026-05-11 | CRCL | M&A / Merger | 50% | 0.33 | +17 | NO | no | +0.67 | +0.65 |
| 2026-05-11 | CRCL | Polymarket | 46% | 0.16 | +38 | NO | yes | -0.16 | -0.16 |
| 2026-05-11 | CRCL | Testnet | 71% | 0.12 | +17 | NO | yes | -0.12 | -0.12 |
| 2026-05-11 | CRCL | Traffic | 71% | 0.13 | +16 | NO | yes | -0.13 | -0.13 |
| 2026-05-11 | CRCL | Treasury | 50% | 0.15 | +35 | NO | yes | -0.15 | -0.15 |
| 2026-05-11 | HIMS | Amazon | 27% | 0.45 | +28 | NO | no | +0.55 | +0.53 |
| 2026-05-11 | HIMS | Canada | 23% | 0.17 | +60 | NO | yes | -0.17 | -0.17 |
| 2026-05-11 | HIMS | Cancer | 23% | 0.59 | +18 | NO | no | +0.41 | +0.40 |
| 2026-05-11 | HIMS | Collaboration | 35% | 0.21 | +44 | NO | yes | -0.21 | -0.21 |
| 2026-05-11 | HIMS | Europe | 23% | 0.19 | +58 | NO | no | +0.81 | +0.79 |
| 2026-05-11 | HIMS | FDA | 31% | 0.10 | +59 | NO | yes | -0.10 | -0.10 |
| 2026-05-11 | HIMS | Lab Testing | 31% | 0.27 | +42 | NO | yes | -0.27 | -0.27 |
| 2026-05-11 | HIMS | Peptide | 27% | 0.06 | +67 | NO | yes | -0.06 | -0.06 |
| 2026-05-11 | HIMS | Regulation | 19% | 0.30 | +51 | NO | no | +0.70 | +0.68 |
| 2026-05-11 | HIMS | Testosterone | 35% | 0.32 | +33 | NO | yes | -0.32 | -0.32 |
| 2026-05-11 | HIMS | Vitamin | 31% | 0.35 | +34 | NO | no | +0.65 | +0.63 |
| 2026-05-11 | HIMS | Zava | 18% | 0.27 | +55 | NO | yes | -0.27 | -0.27 |
| 2026-05-12 | OKLO | AI / Artificial Intelligence | 72% | 0.50 | +22 | YES | yes | +0.50 | +0.48 |
| 2026-05-12 | OKLO | Meta | 26% | 0.10 | +64 | NO | yes | -0.10 | -0.10 |
| 2026-05-12 | OKLO | Ohio | 45% | 0.15 | +40 | NO | yes | -0.15 | -0.15 |
| 2026-05-12 | OKLO | Tennessee | 36% | 0.10 | +55 | NO | yes | -0.10 | -0.10 |
| 2026-05-13 | NBIS | Hyperscaler | 49% | 0.28 | +23 | NO | yes | -0.28 | -0.28 |
| 2026-05-13 | NBIS | Microsoft | 34% | 0.10 | +56 | NO | yes | -0.10 | -0.10 |
| 2026-05-13 | NBIS | Neocloud | 27% | 0.41 | +32 | NO | no | +0.59 | +0.57 |
| 2026-05-13 | NBIS | Token | 34% | 0.11 | +55 | NO | yes | -0.11 | -0.11 |
| 2026-05-13 | NBIS | TripleTen / Triple Ten | 34% | 0.02 | +32 | YES | yes | +0.98 | +0.95 |
| 2026-05-13 | NBIS | Uber | 56% | 0.46 | +10 | YES | no | -0.46 | -0.46 |
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
| 2026-05-19 | CAVA | Acceleration | 32% | 0.16 | +16 | YES | no | -0.16 | -0.16 |
| 2026-05-19 | CAVA | Dining | 73% | 0.63 | +10 | YES | no | -0.63 | -0.63 |
| 2026-05-19 | CAVA | Glazed Salmon | 18% | 0.14 | +68 | NO | yes | -0.14 | -0.14 |
| 2026-05-19 | CAVA | Spice | 39% | 0.40 | +21 | NO | yes | -0.40 | -0.40 |
| 2026-05-19 | CAVA | Sweet Potato | 25% | 0.49 | +26 | NO | yes | -0.49 | -0.49 |
| 2026-05-19 | CAVA | Tariff | 39% | 0.37 | +24 | NO | no | +0.63 | +0.61 |
| 2026-05-19 | HD | Competition / Competitor | 48% | 0.28 | +20 | YES | yes | +0.72 | +0.70 |
| 2026-05-19 | HD | Headwind | 55% | 0.31 | +24 | YES | yes | +0.69 | +0.67 |
| 2026-05-19 | HD | Lumber | 91% | 0.71 | +20 | YES | no | -0.71 | -0.71 |
| 2026-05-19 | HD | Synergy | 8% | 0.46 | +46 | NO | no | +0.54 | +0.52 |
| 2026-05-19 | HD | Tariff | 25% | 0.08 | +67 | NO | yes | -0.08 | -0.08 |
| 2026-05-19 | HD | Volatility | 20% | 0.50 | +30 | NO | no | +0.50 | +0.48 |
| 2026-05-20 | LOW | Competition / Competitor | 63% | 0.17 | +20 | NO | no | +0.83 | +0.81 |
| 2026-05-20 | LOW | Hurricane | 48% | 0.37 | +15 | NO | no | +0.63 | +0.61 |
| 2026-05-20 | LOW | Inflation | 67% | 0.18 | +15 | NO | yes | -0.18 | -0.18 |
| 2026-05-20 | LOW | Subscription | 4% | 0.24 | +72 | NO | yes | -0.24 | -0.24 |
| 2026-05-20 | LOW | Tariff | 14% | 0.34 | +52 | NO | yes | -0.34 | -0.34 |
| 2026-05-20 | LOW | Volatility | 17% | 0.68 | +15 | NO | no | +0.32 | +0.31 |
| 2026-05-20 | NVDA | Arizona | 5% | 0.62 | +33 | NO | no | +0.38 | +0.37 |
| 2026-05-20 | NVDA | Automation | 24% | 0.32 | +44 | NO | no | +0.68 | +0.66 |
| 2026-05-20 | NVDA | Cosmos | 10% | 0.29 | +61 | NO | no | +0.71 | +0.69 |
| 2026-05-20 | NVDA | Domestic | 18% | 0.60 | +22 | NO | no | +0.40 | +0.39 |
| 2026-05-20 | NVDA | GM / General Motors | 8% | 0.72 | +20 | NO | no | +0.28 | +0.27 |
| 2026-05-20 | NVDA | H20 | 8% | 0.45 | +47 | NO | no | +0.55 | +0.53 |
| 2026-05-20 | NVDA | Humanoid | 8% | 0.44 | +48 | NO | yes | -0.44 | -0.44 |
| 2026-05-20 | NVDA | Hyperscaler | 42% | 0.07 | +51 | NO | yes | -0.07 | -0.07 |
| 2026-05-20 | NVDA | Omniverse | 34% | 0.22 | +44 | NO | no | +0.78 | +0.76 |
| 2026-05-20 | NVDA | Self Driving | 2% | 0.26 | +72 | NO | yes | -0.26 | -0.26 |
| 2026-05-20 | NVDA | Taiwan | 18% | 0.54 | +28 | NO | no | +0.46 | +0.45 |
| 2026-05-20 | NVDA | Talent | 10% | 0.61 | +29 | NO | no | +0.39 | +0.38 |
| 2026-05-20 | NVDA | Tariff | 7% | 0.52 | +41 | NO | no | +0.48 | +0.47 |
| 2026-05-20 | NVDA | Trump | 4% | 0.59 | +37 | NO | no | +0.41 | +0.40 |
| 2026-05-20 | NVDA | TSMC | 35% | 0.21 | +44 | NO | no | +0.79 | +0.77 |
| 2026-05-20 | NVDA | VR / Virtual Reality | 38% | 0.20 | +18 | YES | no | -0.20 | -0.20 |
| 2026-05-20 | TGT | Circle 360 | 19% | 0.04 | +77 | NO | no | +0.96 | +0.93 |
| 2026-05-20 | TGT | Competition | 32% | 0.42 | +26 | NO | no | +0.58 | +0.56 |
| 2026-05-20 | TGT | Holiday | 92% | 0.66 | +26 | YES | no | -0.66 | -0.66 |
| 2026-05-20 | TGT | Inflation | 43% | 0.47 | +10 | NO | no | +0.53 | +0.51 |
| 2026-05-20 | TGT | Innovation | 73% | 0.49 | +24 | YES | no | -0.49 | -0.49 |
| 2026-05-20 | TGT | SNAP / Food Stamp | 12% | 0.61 | +27 | NO | no | +0.39 | +0.38 |
| 2026-05-20 | TGT | Synthetic Color | 8% | 0.60 | +32 | NO | yes | -0.60 | -0.60 |
| 2026-05-20 | TGT | Tariff | 22% | 0.10 | +68 | NO | no | +0.90 | +0.87 |
| 2026-05-20 | TOL | Apartment | 83% | 0.72 | +11 | YES | yes | +0.28 | +0.27 |
| 2026-05-20 | TOL | Buffington / Arkansas | 5% | 0.19 | +76 | NO | yes | -0.19 | -0.19 |
| 2026-05-20 | TOL | Customize / Customization | 37% | 0.50 | +13 | NO | yes | -0.50 | -0.50 |
| 2026-05-20 | TOL | Headwind | 30% | 0.26 | +44 | NO | no | +0.74 | +0.72 |
| 2026-05-20 | TOL | Lumber | 51% | 0.35 | +14 | NO | yes | -0.35 | -0.35 |
| 2026-05-20 | TOL | Millennial | 73% | 0.51 | +22 | YES | no | -0.51 | -0.51 |
| 2026-05-20 | TOL | Tailwind | 58% | 0.39 | +19 | YES | no | -0.39 | -0.39 |
| 2026-05-20 | TOL | Tariff | 26% | 0.53 | +21 | NO | yes | -0.53 | -0.53 |
| 2026-05-20 | URBN | Headwind | 39% | 0.34 | +27 | NO | yes | -0.34 | -0.34 |
| 2026-05-20 | URBN | Holiday | 77% | 0.60 | +17 | YES | no | -0.60 | -0.60 |
| 2026-05-20 | URBN | International / Internationally | 71% | 0.29 | +42 | YES | yes | +0.71 | +0.69 |
| 2026-05-20 | URBN | Store Opening | 46% | 0.40 | +14 | NO | yes | -0.40 | -0.40 |
| 2026-05-20 | URBN | Tariff | 17% | 0.10 | +73 | NO | yes | -0.10 | -0.10 |
| 2026-05-21 | BULL | Advisor | 51% | 0.40 | +11 | YES | yes | +0.60 | +0.58 |
| 2026-05-21 | BULL | BlackRock | 63% | 0.51 | +12 | YES | no | -0.51 | -0.51 |
| 2026-05-21 | BULL | Buyback / Repurchase | 22% | 0.23 | +55 | NO | yes | -0.23 | -0.23 |
| 2026-05-21 | BULL | Canada | 63% | 0.26 | +11 | NO | yes | -0.26 | -0.26 |
| 2026-05-21 | BULL | Kalshi | 58% | 0.29 | +29 | YES | no | -0.29 | -0.29 |
| 2026-05-21 | BULL | Kiwoom | 22% | 0.36 | +42 | NO | no | +0.64 | +0.62 |
| 2026-05-21 | BULL | Korea / Korean | 51% | 0.18 | +31 | NO | yes | -0.18 | -0.18 |
| 2026-05-21 | BULL | Token / Tokenized | 46% | 0.40 | +14 | NO | no | +0.60 | +0.58 |
| 2026-05-21 | BULL | Vega (5+ times) | 22% | 0.30 | +48 | NO | yes | -0.30 | -0.30 |
| 2026-05-21 | DE | AI / Artificial Intelligence | 10% | 0.33 | +57 | NO | no | +0.67 | +0.65 |
| 2026-05-21 | DE | Automation | 33% | 0.15 | +52 | NO | yes | -0.15 | -0.15 |
| 2026-05-21 | DE | Dividend | 60% | 0.25 | +15 | NO | yes | -0.25 | -0.25 |
| 2026-05-21 | DE | Efficiency | 48% | 0.18 | +34 | NO | no | +0.82 | +0.80 |
| 2026-05-21 | DE | Manufacturing | 41% | 0.44 | +15 | NO | yes | -0.44 | -0.44 |
| 2026-05-21 | DE | Oil / Gas / Gasoline | 60% | 0.21 | +19 | NO | yes | -0.21 | -0.21 |
| 2026-05-21 | DE | Precision Upgrade | 10% | 0.62 | +28 | NO | no | +0.38 | +0.37 |
| 2026-05-21 | DE | Tariff | 27% | 0.11 | +62 | NO | yes | -0.11 | -0.11 |
| 2026-05-21 | DE | Warranty | 32% | 0.29 | +39 | NO | no | +0.71 | +0.69 |
| 2026-05-21 | DE | Weather | 68% | 0.40 | +28 | YES | no | -0.40 | -0.40 |
| 2026-05-21 | WMT | Automotive | 27% | 0.59 | +14 | NO | no | +0.41 | +0.40 |
| 2026-05-21 | WMT | Automation | 44% | 0.07 | +49 | NO | yes | -0.07 | -0.07 |
| 2026-05-21 | WMT | Dividend | 65% | 0.23 | +12 | NO | no | +0.77 | +0.75 |
| 2026-05-21 | WMT | Omnichannel | 43% | 0.24 | +33 | NO | yes | -0.24 | -0.24 |
| 2026-05-21 | WMT | OnePay / One Pay | 7% | 0.27 | +66 | NO | no | +0.73 | +0.71 |
| 2026-05-21 | WMT | OpenAI | 5% | 0.29 | +66 | NO | no | +0.71 | +0.69 |
| 2026-05-21 | WMT | Prescription | 39% | 0.13 | +26 | YES | yes | +0.87 | +0.84 |
| 2026-05-21 | WMT | SNAP / Food Stamp | 22% | 0.07 | +15 | YES | no | -0.07 | -0.07 |
| 2026-05-21 | WMT | Tariff | 55% | 0.24 | +21 | NO | yes | -0.24 | -0.24 |
| 2026-05-21 | WMT | Upper Income | 4% | 0.70 | +26 | NO | no | +0.30 | +0.29 |
| 2026-05-27 | MRVL | AWS / Amazon | 20% | 0.60 | +20 | NO | no | +0.40 | +0.39 |
| 2026-05-27 | MRVL | Celestial | 5% | 0.17 | +78 | NO | yes | -0.17 | -0.17 |
| 2026-05-27 | MRVL | Electro-Optic / Electro Optic | 40% | 0.15 | +45 | NO | no | +0.85 | +0.82 |
| 2026-05-27 | MRVL | Hyperscaler | 47% | 0.17 | +36 | NO | yes | -0.17 | -0.17 |
| 2026-05-27 | MRVL | Inference | 24% | 0.28 | +48 | NO | yes | -0.28 | -0.28 |
| 2026-05-27 | MRVL | LPO | 9% | 0.41 | +50 | NO | no | +0.59 | +0.57 |
| 2026-05-27 | MRVL | Nvidia | 20% | 0.41 | +39 | NO | yes | -0.41 | -0.41 |
| 2026-05-27 | MRVL | Trainium | 5% | 0.84 | +11 | NO | no | +0.16 | +0.16 |
| 2026-05-27 | MRVL | Xconn | 5% | 0.24 | +71 | NO | yes | -0.24 | -0.24 |
| 2026-05-27 | SNOW | AWS | 78% | 0.60 | +18 | YES | yes | +0.40 | +0.39 |
| 2026-05-27 | SNOW | Claude | 14% | 0.75 | +11 | NO | no | +0.25 | +0.24 |
| 2026-05-27 | SNOW | Compute | 69% | 0.55 | +14 | YES | yes | +0.45 | +0.44 |
| 2026-05-27 | SNOW | Europe | 61% | 0.38 | +23 | YES | no | -0.38 | -0.38 |
| 2026-05-27 | SNOW | Hiring | 89% | 0.70 | +19 | YES | yes | +0.30 | +0.29 |
| 2026-05-27 | SNOW | Iceberg | 53% | 0.28 | +19 | NO | no | +0.72 | +0.70 |
| 2026-05-27 | SNOW | Open Source | 18% | 0.62 | +20 | NO | yes | -0.62 | -0.62 |
| 2026-05-27 | SNOW | Repurchase | 57% | 0.10 | +33 | NO | yes | -0.10 | -0.10 |
| 2026-05-28 | COST | Automation | 8% | 0.75 | +17 | NO | no | +0.25 | +0.24 |
| 2026-05-28 | COST | Cannibalization | 51% | 0.29 | +22 | YES | no | -0.29 | -0.29 |
| 2026-05-28 | COST | Dividend | 71% | 0.51 | +20 | YES | yes | +0.49 | +0.48 |
| 2026-05-28 | COST | Gold Bar | 7% | 0.83 | +10 | NO | no | +0.17 | +0.16 |
| 2026-05-28 | COST | Holiday | 71% | 0.17 | +54 | YES | no | -0.17 | -0.17 |
| 2026-05-28 | COST | Hot Dog | 25% | 0.49 | +26 | NO | yes | -0.49 | -0.49 |
| 2026-05-28 | COST | Kirkland | 71% | 0.09 | +20 | NO | yes | -0.09 | -0.09 |
| 2026-05-28 | COST | Revenue | 45% | 0.32 | +23 | NO | yes | -0.32 | -0.32 |
| 2026-05-28 | COST | Tariff | 23% | 0.08 | +69 | NO | yes | -0.08 | -0.08 |
| 2026-05-28 | COST | Instacart | 62% | 0.26 | +12 | NO | yes | -0.26 | -0.26 |
| 2026-05-28 | CRM | AgentForce / Agent Force | 14% | 0.07 | +79 | NO | yes | -0.07 | -0.07 |
| 2026-05-28 | CRM | AWS / Amazon | 48% | 0.20 | +32 | NO | yes | -0.20 | -0.20 |
| 2026-05-28 | CRM | Consumption | 18% | 0.16 | +66 | NO | yes | -0.16 | -0.16 |
| 2026-05-28 | CRM | Einstein | 54% | 0.35 | +11 | NO | no | +0.65 | +0.63 |
| 2026-05-28 | CRM | Flex Credit | 8% | 0.51 | +41 | NO | yes | -0.51 | -0.51 |
| 2026-05-28 | CRM | Reasoning | 7% | 0.56 | +37 | NO | no | +0.44 | +0.43 |
| 2026-05-28 | CRM | Trillion | 33% | 0.20 | +47 | NO | yes | -0.20 | -0.20 |
| 2026-05-28 | CRM | Zero Copy | 13% | 0.25 | +62 | NO | no | +0.75 | +0.73 |
| 2026-05-28 | DELL | AI Factory | 24% | 0.36 | +40 | NO | yes | -0.36 | -0.36 |
| 2026-05-28 | DELL | Confidence | 67% | 0.22 | +11 | NO | yes | -0.22 | -0.22 |
| 2026-05-28 | DELL | Dividend (3+ times) | 7% | 0.61 | +32 | NO | no | +0.39 | +0.38 |
| 2026-05-28 | DELL | EPS Growth | 54% | 0.18 | +28 | NO | no | +0.82 | +0.80 |
| 2026-05-28 | DELL | Mistral | 11% | 0.58 | +31 | NO | yes | -0.58 | -0.58 |
| 2026-05-28 | DELL | Nvidia | 45% | 0.31 | +24 | NO | yes | -0.31 | -0.31 |
| 2026-05-28 | DELL | Texas | 11% | 0.66 | +23 | NO | no | +0.34 | +0.33 |
| 2026-05-28 | DELL | Trump | 7% | 0.71 | +22 | NO | no | +0.29 | +0.28 |
| 2026-05-28 | DELL | Windows 10 | 41% | 0.31 | +10 | YES | no | -0.31 | -0.31 |
| 2026-06-01 | HPE | Government | 37% | 0.48 | +15 | NO | yes | -0.48 | -0.48 |
| 2026-06-01 | HPE | Headwind | 88% | 0.74 | +14 | YES | no | -0.74 | -0.74 |
| 2026-06-01 | HPE | Morpheus | 28% | 0.51 | +21 | NO | yes | -0.51 | -0.51 |
| 2026-06-01 | HPE | Nvidia | 54% | 0.32 | +14 | NO | yes | -0.32 | -0.32 |
| 2026-06-01 | HPE | Quantum | 20% | 0.68 | +12 | NO | no | +0.32 | +0.31 |
| 2026-06-01 | HPE | Self Driving | 7% | 0.21 | +72 | NO | yes | -0.21 | -0.21 |
| 2026-06-01 | HPE | Supercomputing / Super Computing | 63% | 0.45 | +18 | YES | no | -0.45 | -0.45 |
| 2026-06-01 | HPE | Synergy | 24% | 0.09 | +67 | NO | yes | -0.09 | -0.09 |
| 2026-06-01 | HPE | Tariff | 24% | 0.60 | +16 | NO | no | +0.40 | +0.39 |
| 2026-06-02 | ULTA | AI / Artificial Intelligence | 32% | 0.07 | +61 | NO | yes | -0.07 | -0.07 |
| 2026-06-02 | ULTA | Google / Gemini | 15% | 0.18 | +67 | NO | yes | -0.18 | -0.18 |
| 2026-06-02 | ULTA | Headwind | 75% | 0.55 | +20 | YES | no | -0.55 | -0.55 |
| 2026-06-02 | ULTA | Holiday | 84% | 0.73 | +11 | YES | no | -0.73 | -0.73 |
| 2026-06-02 | ULTA | Middle East | 24% | 0.27 | +49 | NO | yes | -0.27 | -0.27 |
| 2026-06-02 | ULTA | Rare Beauty | 11% | 0.37 | +52 | NO | yes | -0.37 | -0.37 |
| 2026-06-02 | ULTA | Space NK | 19% | 0.06 | +75 | NO | yes | -0.06 | -0.06 |
| 2026-06-02 | ULTA | Store Opening | 41% | 0.43 | +16 | NO | no | +0.57 | +0.55 |
| 2026-06-02 | ULTA | Tailwind | 41% | 0.28 | +13 | YES | no | -0.28 | -0.28 |
| 2026-06-02 | ULTA | Tariff | 24% | 0.64 | +12 | NO | no | +0.36 | +0.35 |
| 2026-06-02 | ULTA | Traffic | 80% | 0.58 | +22 | YES | yes | +0.42 | +0.41 |
| 2026-06-02 | ULTA | Uncertainty | 54% | 0.14 | +32 | NO | yes | -0.14 | -0.14 |
| 2026-06-03 | AVGO | Acquisition | 82% | 0.50 | +32 | YES | no | -0.50 | -0.50 |
| 2026-06-03 | AVGO | Hyperscaler | 41% | 0.07 | +52 | NO | yes | -0.07 | -0.07 |
| 2026-06-03 | AVGO | Meta | 7% | 0.21 | +72 | NO | yes | -0.21 | -0.21 |
| 2026-06-03 | AVGO | OpenAI | 7% | 0.29 | +64 | NO | yes | -0.29 | -0.29 |
| 2026-06-03 | AVGO | Optic | 52% | 0.29 | +23 | YES | yes | +0.71 | +0.69 |
| 2026-06-03 | AVGO | Anthropic | 7% | 0.18 | +75 | NO | yes | -0.18 | -0.18 |
| 2026-06-03 | AVGO | NVLink | 7% | 0.69 | +24 | NO | no | +0.31 | +0.30 |
| 2026-06-03 | AVGO | Open Source | 7% | 0.77 | +16 | NO | no | +0.23 | +0.22 |
| 2026-06-03 | AVGO | Quantum | 3% | 0.86 | +11 | NO | no | +0.14 | +0.14 |
| 2026-06-03 | AVGO | Competition | 37% | 0.40 | +23 | NO | no | +0.60 | +0.58 |
| 2026-06-03 | CRWD | China | 15% | 0.64 | +21 | NO | no | +0.36 | +0.35 |
| 2026-06-03 | CRWD | Claude | 11% | 0.37 | +52 | NO | yes | -0.37 | -0.37 |
| 2026-06-03 | CRWD | Consolidation | 75% | 0.09 | +16 | NO | yes | -0.09 | -0.09 |
| 2026-06-03 | CRWD | Falcon Flex | 37% | 0.09 | +54 | NO | yes | -0.09 | -0.09 |
| 2026-06-03 | CRWD | Germany | 5% | 0.36 | +59 | NO | no | +0.64 | +0.62 |
| 2026-06-03 | CRWD | Headwind | 24% | 0.51 | +25 | NO | no | +0.49 | +0.48 |
| 2026-06-03 | CRWD | Hyperscaler | 37% | 0.21 | +42 | NO | yes | -0.21 | -0.21 |
| 2026-06-03 | CRWD | Nvidia | 21% | 0.28 | +51 | NO | yes | -0.28 | -0.28 |
| 2026-06-03 | CRWD | SGNL / Signal | 24% | 0.19 | +57 | NO | yes | -0.19 | -0.19 |
| 2026-06-03 | CRWD | Shadow | 15% | 0.66 | +19 | NO | yes | -0.66 | -0.66 |
| 2026-06-03 | M | AI / Artificial Intelligence | 24% | 0.13 | +63 | NO | yes | -0.13 | -0.13 |
| 2026-06-03 | M | Backstage | 81% | 0.64 | +17 | YES | yes | +0.36 | +0.35 |
| 2026-06-03 | M | China | 38% | 0.29 | +33 | NO | yes | -0.29 | -0.29 |
| 2026-06-03 | M | Headwind | 72% | 0.54 | +18 | YES | yes | +0.46 | +0.45 |
| 2026-06-03 | M | Holiday | 95% | 0.80 | +15 | YES | yes | +0.20 | +0.19 |
| 2026-06-03 | M | Hospitality | 18% | 0.66 | +16 | NO | no | +0.34 | +0.33 |
| 2026-06-03 | M | Marketplace | 70% | 0.08 | +22 | NO | yes | -0.08 | -0.08 |
| 2026-06-03 | M | Tariff | 30% | 0.10 | +60 | NO | yes | -0.10 | -0.10 |
| 2026-06-04 | LULU | AI / Artificial Intelligence | 7% | 0.32 | +61 | NO | yes | -0.32 | -0.32 |
| 2026-06-04 | LULU | Amex | 4% | 0.83 | +13 | NO | no | +0.17 | +0.16 |
| 2026-06-04 | LULU | Chip / Wilson | 16% | 0.50 | +34 | NO | no | +0.50 | +0.48 |
| 2026-06-04 | LULU | Headwind | 53% | 0.26 | +21 | NO | yes | -0.26 | -0.26 |
| 2026-06-04 | LULU | Holiday | 77% | 0.11 | +66 | YES | no | -0.11 | -0.11 |
| 2026-06-04 | LULU | Membership | 47% | 0.36 | +17 | NO | no | +0.64 | +0.62 |
| 2026-06-04 | LULU | PowerLu | 4% | 0.62 | +34 | NO | no | +0.38 | +0.37 |
| 2026-06-04 | LULU | ShowZero | 7% | 0.24 | +69 | NO | no | +0.76 | +0.74 |
| 2026-06-04 | LULU | Tariff | 19% | 0.05 | +76 | NO | yes | -0.05 | -0.05 |
| 2026-06-04 | LULU | Unrestricted Power | 4% | 0.32 | +64 | NO | no | +0.68 | +0.66 |
| 2026-06-08 | MTN | Canada / Canadian | 88% | 0.50 | +38 | YES | no | -0.50 | -0.50 |
| 2026-06-08 | MTN | Gen Z | 8% | 0.36 | +56 | NO | no | +0.64 | +0.62 |
| 2026-06-08 | MTN | Renewal | 77% | 0.44 | +33 | YES | yes | +0.56 | +0.54 |
| 2026-06-08 | MTN | Snowpack | 15% | 0.47 | +38 | NO | no | +0.53 | +0.51 |
| 2026-06-09 | CBRL | 250 | 8% | 0.52 | +40 | NO | yes | -0.52 | -0.52 |
| 2026-06-09 | CBRL | AI / Artificial Intelligence | 14% | 0.37 | +49 | NO | yes | -0.37 | -0.37 |
| 2026-06-09 | CBRL | Campfire | 19% | 0.15 | +66 | NO | yes | -0.15 | -0.15 |
| 2026-06-09 | CBRL | Catfish | 5% | 0.81 | +14 | NO | no | +0.19 | +0.18 |
| 2026-06-09 | CBRL | Cracker Barrel 400 | 13% | 0.17 | +70 | NO | yes | -0.17 | -0.17 |
| 2026-06-09 | CBRL | Location | 71% | 0.30 | +41 | YES | no | -0.30 | -0.30 |
| 2026-06-09 | CBRL | Meals for Two | 10% | 0.69 | +21 | NO | no | +0.31 | +0.30 |
| 2026-06-09 | CBRL | Road Trip | 11% | 0.15 | +74 | NO | yes | -0.15 | -0.15 |
| 2026-06-09 | CBRL | Tariff | 31% | 0.20 | +49 | NO | yes | -0.20 | -0.20 |
| 2026-06-10 | CHWY | App | 53% | 0.08 | +39 | NO | yes | -0.08 | -0.08 |
| 2026-06-10 | CHWY | Holiday | 72% | 0.15 | +57 | YES | no | -0.15 | -0.15 |
| 2026-06-10 | CHWY | Humanization | 31% | 0.40 | +29 | NO | no | +0.60 | +0.58 |
| 2026-06-10 | CHWY | Insurance | 57% | 0.32 | +25 | YES | no | -0.32 | -0.32 |
| 2026-06-10 | CHWY | International / Internationally | 39% | 0.19 | +20 | YES | no | -0.19 | -0.19 |
| 2026-06-10 | CHWY | Modern Animal | 6% | 0.04 | +90 | NO | yes | -0.04 | -0.04 |
| 2026-06-10 | CHWY | SmartEquine | 9% | 0.29 | +62 | NO | no | +0.71 | +0.69 |
| 2026-06-10 | CHWY | Supplement | 27% | 0.29 | +44 | NO | no | +0.71 | +0.69 |
| 2026-06-10 | ORCL | Air Force | 2% | 0.74 | +24 | NO | no | +0.26 | +0.25 |
| 2026-06-10 | ORCL | Automation | 46% | 0.41 | +13 | NO | no | +0.59 | +0.57 |
| 2026-06-10 | ORCL | Backlog | 31% | 0.25 | +44 | NO | no | +0.75 | +0.73 |
| 2026-06-10 | ORCL | Health | 55% | 0.34 | +11 | NO | yes | -0.34 | -0.34 |
| 2026-06-10 | ORCL | Hyperscaler | 23% | 0.40 | +37 | NO | no | +0.60 | +0.58 |
| 2026-06-10 | ORCL | Java | 43% | 0.26 | +17 | YES | no | -0.26 | -0.26 |
| 2026-06-10 | ORCL | Multicloud | 4% | 0.08 | +88 | NO | yes | -0.08 | -0.08 |
| 2026-06-10 | ORCL | OpenAI | 14% | 0.34 | +52 | NO | no | +0.66 | +0.64 |
| 2026-06-10 | ORCL | Partner | 44% | 0.07 | +49 | NO | yes | -0.07 | -0.07 |
| 2026-06-10 | ORCL | Sovereign | 16% | 0.35 | +49 | NO | no | +0.65 | +0.63 |
| 2026-06-10 | ORCL | Stargate | 5% | 0.55 | +40 | NO | no | +0.45 | +0.44 |
| 2026-06-11 | ADBE | 3D | 51% | 0.17 | +32 | NO | yes | -0.17 | -0.17 |
| 2026-06-11 | ADBE | Firefly Video | 10% | 0.53 | +37 | NO | no | +0.47 | +0.46 |
| 2026-06-11 | ADBE | Generative AI / Gen AI | 25% | 0.09 | +66 | NO | no | +0.91 | +0.88 |
| 2026-06-11 | ADBE | Headwind | 38% | 0.18 | +44 | NO | no | +0.82 | +0.80 |
| 2026-06-11 | ADBE | LLM Optimizer | 7% | 0.10 | +83 | NO | yes | -0.10 | -0.10 |
| 2026-06-11 | ADBE | Nvidia | 9% | 0.15 | +76 | NO | yes | -0.15 | -0.15 |
| 2026-06-11 | ADBE | Semrush | 5% | 0.05 | +90 | NO | yes | -0.05 | -0.05 |
| 2026-06-18 | KR | AI / Artificial Intelligence | 44% | 0.06 | +50 | NO | yes | -0.06 | -0.06 |
| 2026-06-18 | KR | Albertsons | 44% | 0.24 | +20 | YES | no | -0.24 | -0.24 |
| 2026-06-18 | KR | Dividend | 82% | 0.56 | +26 | YES | no | -0.56 | -0.56 |
| 2026-06-18 | KR | GLP-1 | 44% | 0.16 | +40 | NO | yes | -0.16 | -0.16 |
| 2026-06-18 | KR | Instacart | 36% | 0.24 | +40 | NO | no | +0.76 | +0.74 |
| 2026-06-18 | KR | Ocado | 67% | 0.48 | +19 | YES | yes | +0.52 | +0.50 |
| 2026-06-18 | KR | SNAP / Food Stamp | 44% | 0.25 | +19 | YES | yes | +0.75 | +0.73 |
| 2026-06-18 | KR | Vitacost | 13% | 0.75 | +12 | NO | no | +0.25 | +0.24 |
| 2026-06-23 | CCL | AI / Artificial Intelligence | 11% | 0.30 | +59 | NO | yes | -0.30 | -0.30 |
| 2026-06-23 | CCL | Celebration Key | 40% | 0.04 | +56 | NO | yes | -0.04 | -0.04 |
| 2026-06-23 | CCL | Dividend | 43% | 0.25 | +32 | NO | yes | -0.25 | -0.25 |
| 2026-06-23 | CCL | Headwind | 56% | 0.29 | +15 | NO | yes | -0.29 | -0.29 |
| 2026-06-23 | CCL | Middle East | 17% | 0.36 | +47 | NO | yes | -0.36 | -0.36 |
| 2026-06-23 | CCL | Tailwind | 50% | 0.34 | +16 | NO | yes | -0.34 | -0.34 |
| 2026-06-23 | FDX | Automation | 51% | 0.26 | +25 | YES | no | -0.26 | -0.26 |
| 2026-06-23 | FDX | De Minimis | 13% | 0.25 | +62 | NO | yes | -0.25 | -0.25 |
| 2026-06-23 | FDX | Dividend | 61% | 0.20 | +19 | NO | yes | -0.20 | -0.20 |
| 2026-06-23 | FDX | E-commerce / Ecommerce | 94% | 0.77 | +17 | YES | no | -0.77 | -0.77 |
| 2026-06-23 | FDX | Inventory | 71% | 0.23 | +48 | YES | yes | +0.77 | +0.75 |
| 2026-06-23 | FDX | ServiceNow | 4% | 0.71 | +25 | NO | no | +0.29 | +0.28 |
| 2026-06-23 | FDX | Smith | 80% | 0.40 | +40 | YES | yes | +0.60 | +0.58 |
| 2026-06-24 | MU | Anthropic | 2% | 0.24 | +74 | NO | no | +0.76 | +0.74 |
| 2026-06-24 | MU | Automation | 35% | 0.14 | +21 | YES | no | -0.14 | -0.14 |
| 2026-06-24 | MU | Gaming | 42% | 0.11 | +31 | YES | no | -0.11 | -0.11 |
| 2026-06-24 | MU | Hyperscaler | 13% | 0.77 | +10 | NO | yes | -0.77 | -0.77 |
| 2026-06-24 | MU | Inventory | 89% | 0.50 | +39 | YES | no | -0.50 | -0.50 |
| 2026-06-24 | MU | Nvidia | 30% | 0.58 | +12 | NO | yes | -0.58 | -0.58 |
| 2026-06-24 | MU | Smartphone | 86% | 0.30 | +56 | YES | no | -0.30 | -0.30 |
| 2026-06-24 | MU | Taiwan | 51% | 0.23 | +28 | YES | no | -0.23 | -0.23 |
| 2026-06-29 | AVAV | Backpackable | 8% | 0.64 | +28 | NO | no | +0.36 | +0.35 |
| 2026-06-29 | AVAV | Golden Dome | 15% | 0.25 | +60 | NO | yes | -0.25 | -0.25 |
| 2026-06-29 | AVAV | Headwind | 45% | 0.41 | +14 | NO | no | +0.59 | +0.57 |
| 2026-06-29 | AVAV | Iran | 8% | 0.35 | +57 | NO | no | +0.65 | +0.63 |
| 2026-06-29 | AVAV | Orbit | 12% | 0.63 | +25 | NO | yes | -0.63 | -0.63 |
| 2026-06-29 | AVAV | Robot / Robotic / Robotics | 71% | 0.60 | +11 | YES | no | -0.60 | -0.60 |
| 2026-06-29 | AVAV | Tailwind | 8% | 0.60 | +32 | NO | yes | -0.60 | -0.60 |
| 2026-06-29 | AVAV | Taiwan | 25% | 0.39 | +36 | NO | no | +0.61 | +0.59 |
| 2026-06-29 | AVAV | AV Halo | 11% | 0.26 | +63 | NO | yes | -0.26 | -0.26 |
| 2026-06-29 | PEP | Artificial Color | 14% | 0.63 | +23 | NO | no | +0.37 | +0.36 |
| 2026-06-29 | PEP | Autonomous | 5% | 0.83 | +12 | NO | no | +0.17 | +0.16 |
| 2026-06-29 | PEP | Away from Home | 60% | 0.24 | +16 | NO | yes | -0.24 | -0.24 |
| 2026-06-29 | PEP | Bubly | 33% | 0.19 | +14 | YES | no | -0.19 | -0.19 |
| 2026-06-29 | PEP | Celsius | 39% | 0.33 | +28 | NO | yes | -0.33 | -0.33 |
| 2026-06-29 | PEP | China | 64% | 0.46 | +18 | YES | yes | +0.54 | +0.52 |
| 2026-06-29 | PEP | Gatik | 5% | 0.71 | +24 | NO | no | +0.29 | +0.28 |
| 2026-06-29 | PEP | GLP-1 | 23% | 0.63 | +14 | NO | no | +0.37 | +0.36 |
| 2026-06-29 | PEP | Healthy | 70% | 0.44 | +26 | YES | no | -0.44 | -0.44 |
| 2026-06-29 | PEP | Starbucks | 67% | 0.44 | +23 | YES | no | -0.44 | -0.44 |
| 2026-06-29 | PEP | Tariff | 14% | 0.58 | +28 | NO | yes | -0.58 | -0.58 |
| 2026-06-29 | PEP | World Cup | 8% | 0.22 | +70 | NO | yes | -0.22 | -0.22 |
| 2026-06-30 | ACI | AI / Artificial Intelligence | 47% | 0.06 | +47 | NO | yes | -0.06 | -0.06 |
| 2026-06-30 | ACI | Dividend | 85% | 0.72 | +13 | YES | yes | +0.28 | +0.27 |
| 2026-06-30 | ACI | GLP-1 | 36% | 0.13 | +51 | NO | yes | -0.13 | -0.13 |
| 2026-06-30 | ACI | Holiday | 52% | 0.33 | +15 | NO | yes | -0.33 | -0.33 |
| 2026-06-30 | ACI | Personalization | 25% | 0.35 | +40 | NO | yes | -0.35 | -0.35 |
| 2026-06-30 | ACI | Produce | 47% | 0.37 | +16 | NO | no | +0.63 | +0.61 |
| 2026-06-30 | ACI | Tariff | 19% | 0.55 | +26 | NO | no | +0.45 | +0.44 |
| 2026-06-30 | ACI | Uber | 14% | 0.39 | +47 | NO | yes | -0.39 | -0.39 |
| 2026-06-30 | BLK | Crypto / Bitcoin | 35% | 0.22 | +43 | NO | no | +0.78 | +0.76 |
| 2026-06-30 | BLK | Digital Asset | 46% | 0.01 | +53 | NO | yes | -0.01 | -0.01 |
| 2026-06-30 | BLK | Record AUM | 28% | 0.22 | +50 | NO | no | +0.78 | +0.76 |
| 2026-06-30 | BLK | Stablecoin | 17% | 0.16 | +67 | NO | no | +0.84 | +0.81 |
| 2026-06-30 | BLK | ETF Inflow | 13% | 0.73 | +14 | NO | no | +0.27 | +0.26 |
| 2026-06-30 | DAL | Holiday | 61% | 0.10 | +29 | NO | yes | -0.10 | -0.10 |
| 2026-06-30 | DAL | Nonstop / Non-Stop | 8% | 0.76 | +16 | NO | no | +0.24 | +0.23 |
| 2026-06-30 | DAL | Partnership | 73% | 0.09 | +18 | NO | yes | -0.09 | -0.09 |
| 2026-06-30 | DAL | Weather | 54% | 0.30 | +16 | NO | yes | -0.30 | -0.30 |
| 2026-06-30 | DAL | YouTube | 17% | 0.63 | +20 | NO | yes | -0.63 | -0.63 |
| 2026-06-30 | GOOGL | Autonomous | 42% | 0.35 | +23 | NO | yes | -0.35 | -0.35 |
| 2026-06-30 | GOOGL | DeepMind / Deep Mind | 35% | 0.40 | +25 | NO | yes | -0.40 | -0.40 |
| 2026-06-30 | GOOGL | European Commission | 10% | 0.72 | +18 | NO | no | +0.28 | +0.27 |
| 2026-06-30 | GOOGL | Gemini 3 | 7% | 0.01 | +92 | NO | yes | -0.01 | -0.01 |
| 2026-06-30 | GOOGL | Ironwood | 8% | 0.24 | +68 | NO | yes | -0.24 | -0.24 |
| 2026-06-30 | GOOGL | Nano Banana | 7% | 0.32 | +61 | NO | yes | -0.32 | -0.32 |
| 2026-06-30 | GOOGL | Quantum | 12% | 0.40 | +48 | NO | no | +0.60 | +0.58 |
| 2026-06-30 | GOOGL | Search Advertising / Search Ad | 65% | 0.55 | +10 | YES | yes | +0.45 | +0.44 |
| 2026-06-30 | GOOGL | Wiz | 5% | 0.42 | +53 | NO | no | +0.58 | +0.56 |
| 2026-06-30 | GOOGL | Youtube Shorts | 30% | 0.23 | +47 | NO | no | +0.77 | +0.75 |
| 2026-06-30 | NBIS | Aether | 25% | 0.32 | +43 | NO | yes | -0.32 | -0.32 |
| 2026-06-30 | NBIS | ClickHouse / Click House | 60% | 0.29 | +11 | NO | yes | -0.29 | -0.29 |
| 2026-06-30 | NBIS | Meta | 39% | 0.20 | +41 | NO | yes | -0.20 | -0.20 |
| 2026-06-30 | NBIS | Neocloud | 25% | 0.60 | +15 | NO | no | +0.40 | +0.39 |
| 2026-06-30 | NBIS | Nvidia | 53% | 0.07 | +40 | NO | no | +0.93 | +0.90 |
| 2026-06-30 | NBIS | Robotics | 32% | 0.46 | +22 | NO | no | +0.54 | +0.52 |
| 2026-06-30 | NBIS | Token | 39% | 0.26 | +35 | NO | yes | -0.26 | -0.26 |
| 2026-06-30 | NKE | Amazon | 17% | 0.70 | +13 | NO | no | +0.30 | +0.29 |
| 2026-06-30 | NKE | Beaverton | 10% | 0.72 | +18 | NO | no | +0.28 | +0.27 |
| 2026-06-30 | NKE | Consumer Demand | 68% | 0.19 | +49 | YES | no | -0.19 | -0.19 |
| 2026-06-30 | NKE | Dividend | 32% | 0.40 | +28 | NO | yes | -0.40 | -0.40 |
| 2026-06-30 | NKE | Express Lane | 48% | 0.14 | +34 | YES | no | -0.14 | -0.14 |
| 2026-06-30 | NKE | Olympic / Olympics | 74% | 0.35 | +39 | YES | no | -0.35 | -0.35 |
| 2026-06-30 | NKE | Sabrina | 20% | 0.54 | +26 | NO | no | +0.46 | +0.45 |
| 2026-06-30 | NKE | Skims / NikeSKIMS | 8% | 0.29 | +63 | NO | no | +0.71 | +0.69 |
| 2026-06-30 | NKE | Tariff | 17% | 0.14 | +69 | NO | yes | -0.14 | -0.14 |
| 2026-06-30 | PYPL | Bank | 88% | 0.74 | +14 | YES | no | -0.74 | -0.74 |
| 2026-06-30 | PYPL | Biometric | 20% | 0.27 | +53 | NO | yes | -0.27 | -0.27 |
| 2026-06-30 | PYPL | Bitcoin | 8% | 0.81 | +11 | NO | no | +0.19 | +0.18 |
| 2026-06-30 | PYPL | Blue Owl | 5% | 0.40 | +55 | NO | no | +0.60 | +0.58 |
| 2026-06-30 | PYPL | Cash Back / Cashback | 38% | 0.21 | +41 | NO | no | +0.79 | +0.77 |
| 2026-06-30 | PYPL | College | 8% | 0.32 | +60 | NO | no | +0.68 | +0.66 |
| 2026-06-30 | PYPL | Google | 42% | 0.28 | +30 | NO | no | +0.72 | +0.70 |
| 2026-06-30 | PYPL | Perplexity | 10% | 0.20 | +70 | NO | yes | -0.20 | -0.20 |
| 2026-06-30 | PYPL | Regulation / Regulator / Regulatory | 51% | 0.24 | +27 | YES | no | -0.24 | -0.24 |
| 2026-06-30 | PYPL | Stablecoin / Stable Coin | 16% | 0.29 | +55 | NO | no | +0.71 | +0.69 |
| 2026-06-30 | PYPL | Unprofitable | 16% | 0.46 | +38 | NO | no | +0.54 | +0.52 |
| 2026-07-01 | GIS | Divestiture | 81% | 0.22 | +59 | YES | yes | +0.78 | +0.76 |
| 2026-07-01 | GIS | GLP-1 / Ozempic | 11% | 0.48 | +41 | NO | no | +0.52 | +0.50 |
| 2026-07-01 | GIS | Iran / Middle East | 74% | 0.15 | +59 | YES | no | -0.15 | -0.15 |
| 2026-07-01 | GIS | Supply Chain | 67% | 0.19 | +14 | NO | yes | -0.19 | -0.19 |
| 2026-07-01 | GIS | Tariff | 18% | 0.20 | +62 | NO | yes | -0.20 | -0.20 |
| 2026-07-01 | GIS | Totino | 60% | 0.15 | +25 | NO | yes | -0.15 | -0.15 |
| 2026-07-01 | GIS | Wilderness | 53% | 0.36 | +17 | YES | yes | +0.64 | +0.62 |
| 2026-07-01 | GIS | World Cup | 18% | 0.59 | +23 | NO | no | +0.41 | +0.40 |
| 2026-07-01 | STZ | Aluminum | 31% | 0.29 | +40 | NO | no | +0.71 | +0.69 |
| 2026-07-01 | STZ | Cannabis | 54% | 0.07 | +47 | YES | no | -0.07 | -0.07 |
| 2026-07-01 | STZ | Depletion / Depletions | 96% | 0.83 | +13 | YES | yes | +0.17 | +0.16 |
| 2026-07-01 | STZ | Dividend | 82% | 0.55 | +27 | YES | no | -0.55 | -0.55 |
| 2026-07-01 | STZ | Especial | 90% | 0.67 | +23 | YES | yes | +0.33 | +0.32 |
| 2026-07-01 | STZ | Inflation | 56% | 0.33 | +23 | YES | yes | +0.67 | +0.65 |
| 2026-07-01 | STZ | Mi Campo | 22% | 0.59 | +19 | NO | yes | -0.59 | -0.59 |
| 2026-07-01 | STZ | Sunbrew | 20% | 0.19 | +61 | NO | no | +0.81 | +0.79 |
| 2026-07-01 | STZ | Tariff | 24% | 0.20 | +56 | NO | no | +0.80 | +0.78 |
| 2026-07-01 | STZ | World Cup | 9% | 0.22 | +69 | NO | yes | -0.22 | -0.22 |
| 2026-07-02 | NFLX | Acquisition | 72% | 0.14 | +14 | NO | yes | -0.14 | -0.14 |
| 2026-07-02 | NFLX | Ad-Supported | 25% | 0.61 | +14 | NO | no | +0.39 | +0.38 |
| 2026-07-02 | NFLX | Gaming | 35% | 0.10 | +55 | NO | no | +0.90 | +0.87 |
| 2026-07-02 | NFLX | Hollywood | 35% | 0.52 | +13 | NO | no | +0.48 | +0.47 |
| 2026-07-02 | NFLX | KPop Demon Hunters | 2% | 0.71 | +27 | NO | yes | -0.71 | -0.71 |
| 2026-07-02 | NFLX | Live Event | 23% | 0.16 | +61 | NO | yes | -0.16 | -0.16 |
| 2026-07-02 | NFLX | NFL | 20% | 0.16 | +64 | NO | no | +0.84 | +0.81 |
| 2026-07-02 | NFLX | One Piece | 17% | 0.59 | +24 | NO | no | +0.41 | +0.40 |
| 2026-07-02 | NFLX | Paramount | 17% | 0.71 | +12 | NO | no | +0.29 | +0.28 |
| 2026-07-02 | NFLX | Partnership | 59% | 0.25 | +16 | NO | yes | -0.25 | -0.25 |
| 2026-07-02 | NFLX | Subscriber | 87% | 0.59 | +28 | YES | yes | +0.41 | +0.40 |
| 2026-07-02 | NFLX | Warner Bros. / Warner Brothers | 12% | 0.61 | +27 | NO | no | +0.39 | +0.38 |
| 2026-07-02 | NFLX | World Cup | 10% | 0.46 | +44 | NO | no | +0.54 | +0.52 |
| 2026-07-08 | LEVI | AI / Artificial Intelligence | 29% | 0.27 | +44 | NO | yes | -0.27 | -0.27 |
| 2026-07-08 | LEVI | Beyoncé | 2% | 0.38 | +60 | NO | no | +0.62 | +0.60 |
| 2026-07-08 | LEVI | Beyond Yoga | 32% | 0.07 | +61 | NO | yes | -0.07 | -0.07 |
| 2026-07-08 | LEVI | China | 93% | 0.79 | +14 | YES | yes | +0.21 | +0.20 |
| 2026-07-08 | LEVI | Disney | 4% | 0.85 | +11 | NO | no | +0.15 | +0.15 |
| 2026-07-08 | LEVI | Dockers | 85% | 0.57 | +28 | YES | yes | +0.43 | +0.42 |
| 2026-07-08 | LEVI | Jordan | 43% | 0.40 | +17 | NO | no | +0.60 | +0.58 |
| 2026-07-08 | LEVI | Nike | 16% | 0.55 | +29 | NO | no | +0.45 | +0.44 |
| 2026-07-08 | LEVI | Tariff | 21% | 0.13 | +66 | NO | yes | -0.13 | -0.13 |
| 2026-07-08 | LEVI | World Cup | 5% | 0.37 | +58 | NO | yes | -0.37 | -0.37 |
| 2026-07-10 | DAL | Dividend | 48% | 0.07 | +45 | NO | yes | -0.07 | -0.07 |
| 2026-07-10 | DAL | Headwind | 60% | 0.26 | +14 | NO | yes | -0.26 | -0.26 |
| 2026-07-10 | DAL | Nonstop / Non-Stop | 8% | 0.80 | +12 | NO | no | +0.20 | +0.19 |
| 2026-07-10 | DAL | Oil | 17% | 0.31 | +52 | NO | no | +0.69 | +0.67 |
| 2026-07-10 | DAL | Partnership | 73% | 0.07 | +20 | NO | yes | -0.07 | -0.07 |
| 2026-07-10 | DAL | Shutdown / Shut Down | 23% | 0.13 | +10 | YES | no | -0.13 | -0.13 |
| 2026-07-10 | DAL | Tailwind | 61% | 0.35 | +26 | YES | no | -0.35 | -0.35 |
| 2026-07-10 | DAL | Tariff | 36% | 0.29 | +35 | NO | no | +0.71 | +0.69 |
| 2026-07-10 | DAL | Weather | 54% | 0.26 | +20 | NO | no | +0.74 | +0.72 |
| 2026-07-10 | DAL | YouTube | 17% | 0.38 | +45 | NO | no | +0.62 | +0.60 |
| 2026-07-14 | BAC | CashPro | 35% | 0.45 | +20 | NO | no | +0.55 | +0.53 |
| 2026-07-14 | BAC | Delinquency | 50% | 0.12 | +38 | NO | yes | -0.12 | -0.12 |
| 2026-07-14 | BAC | Inflation | 38% | 0.10 | +52 | NO | yes | -0.10 | -0.10 |
| 2026-07-14 | BAC | M&A / Merger | 60% | 0.22 | +18 | NO | no | +0.78 | +0.76 |
| 2026-07-14 | BAC | Basel 3 | 2% | 0.35 | +63 | NO | no | +0.65 | +0.63 |
| 2026-07-14 | BAC | Pipeline | 59% | 0.21 | +20 | NO | yes | -0.21 | -0.21 |
| 2026-07-14 | BAC | Rate Cut / Cut Rate | 30% | 0.13 | +57 | NO | yes | -0.13 | -0.13 |
| 2026-07-14 | BAC | Recession | 38% | 0.20 | +18 | YES | no | -0.20 | -0.20 |
| 2026-07-14 | BAC | Trump / President | 17% | 0.64 | +19 | NO | no | +0.36 | +0.35 |
| 2026-07-14 | BAC | World Cup | 4% | 0.48 | +48 | NO | yes | -0.48 | -0.48 |
| 2026-07-14 | BAC | Tariff | 11% | 0.45 | +44 | NO | no | +0.55 | +0.53 |
| 2026-07-14 | C | Banamex | 42% | 0.15 | +43 | NO | yes | -0.15 | -0.15 |
| 2026-07-14 | C | Basel 3 | 8% | 0.31 | +61 | NO | yes | -0.31 | -0.31 |
| 2026-07-14 | C | Credit Card | 57% | 0.21 | +22 | NO | yes | -0.21 | -0.21 |
| 2026-07-14 | C | Headwind | 82% | 0.57 | +25 | YES | yes | +0.43 | +0.42 |
| 2026-07-14 | C | Inflation | 47% | 0.16 | +37 | NO | yes | -0.16 | -0.16 |
| 2026-07-14 | C | Recession | 27% | 0.04 | +23 | YES | no | -0.04 | -0.04 |
| 2026-07-14 | C | Oil | 27% | 0.13 | +14 | YES | no | -0.13 | -0.13 |
| 2026-07-14 | C | FICO | 32% | 0.15 | +53 | NO | yes | -0.15 | -0.15 |
| 2026-07-14 | GS | Geopolitical | 60% | 0.27 | +13 | NO | no | +0.73 | +0.71 |
| 2026-07-14 | GS | Industry Ventures | 14% | 0.61 | +25 | NO | yes | -0.61 | -0.61 |
| 2026-07-14 | GS | Marcus | 67% | 0.48 | +19 | YES | no | -0.48 | -0.48 |
| 2026-07-14 | GS | Private Credit | 45% | 0.31 | +24 | NO | yes | -0.31 | -0.31 |
| 2026-07-14 | GS | Recession | 29% | 0.26 | +45 | NO | no | +0.74 | +0.72 |
| 2026-07-14 | GS | Regulation | 32% | 0.37 | +31 | NO | yes | -0.37 | -0.37 |
| 2026-07-14 | GS | SpaceX | 5% | 0.15 | +80 | NO | yes | -0.15 | -0.15 |
| 2026-07-14 | GS | Tailwind | 54% | 0.11 | +35 | NO | yes | -0.11 | -0.11 |
| 2026-07-14 | GS | Tariff | 11% | 0.65 | +24 | NO | no | +0.35 | +0.34 |
| 2026-07-14 | JPM | Basel 3 | 3% | 0.17 | +80 | NO | no | +0.83 | +0.81 |
| 2026-07-14 | JPM | Buyback | 63% | 0.26 | +11 | NO | no | +0.74 | +0.72 |
| 2026-07-14 | JPM | Credit Card | 66% | 0.22 | +12 | NO | yes | -0.22 | -0.22 |
| 2026-07-14 | JPM | Fintech | 30% | 0.20 | +10 | YES | yes | +0.80 | +0.78 |
| 2026-07-14 | JPM | Fraud | 32% | 0.28 | +40 | NO | yes | -0.28 | -0.28 |
| 2026-07-14 | JPM | Geopolitical | 26% | 0.23 | +51 | NO | no | +0.77 | +0.75 |
| 2026-07-14 | JPM | Hike | 51% | 0.31 | +20 | YES | no | -0.31 | -0.31 |
| 2026-07-14 | JPM | Hiring | 30% | 0.24 | +46 | NO | yes | -0.24 | -0.24 |
| 2026-07-14 | JPM | Inflation | 47% | 0.33 | +20 | NO | yes | -0.33 | -0.33 |
| 2026-07-14 | JPM | Private Credit | 32% | 0.25 | +43 | NO | no | +0.75 | +0.73 |
| 2026-07-14 | JPM | Recession | 53% | 0.37 | +16 | YES | no | -0.37 | -0.37 |
| 2026-07-14 | JPM | Regulation | 45% | 0.34 | +21 | NO | yes | -0.34 | -0.34 |
| 2026-07-14 | WFC | AI / Artificial Intelligence | 36% | 0.16 | +48 | NO | yes | -0.16 | -0.16 |
| 2026-07-14 | WFC | Basel 3 | 5% | 0.36 | +59 | NO | no | +0.64 | +0.62 |
| 2026-07-14 | WFC | Delinquency | 20% | 0.34 | +46 | NO | yes | -0.34 | -0.34 |
| 2026-07-14 | WFC | Headwind | 58% | 0.10 | +48 | YES | no | -0.10 | -0.10 |
| 2026-07-14 | WFC | Inflation | 58% | 0.17 | +25 | NO | yes | -0.17 | -0.17 |
| 2026-07-14 | WFC | Iran | 5% | 0.73 | +22 | NO | no | +0.27 | +0.26 |
| 2026-07-14 | WFC | Oil | 26% | 0.45 | +29 | NO | no | +0.55 | +0.53 |
| 2026-07-14 | WFC | Premier | 45% | 0.25 | +30 | NO | yes | -0.25 | -0.25 |
| 2026-07-14 | WFC | Severance | 45% | 0.45 | +10 | NO | no | +0.55 | +0.53 |
| 2026-07-14 | WFC | Tariff | 14% | 0.63 | +23 | NO | yes | -0.63 | -0.63 |
| 2026-07-14 | WFC | Zelle | 23% | 0.50 | +27 | NO | no | +0.50 | +0.48 |
| 2026-07-15 | JNJ | Administration | 36% | 0.50 | +14 | NO | no | +0.50 | +0.48 |
| 2026-07-15 | JNJ | Darzalex Faspro | 22% | 0.47 | +31 | NO | yes | -0.47 | -0.47 |
| 2026-07-15 | JNJ | Halda Therapeutics | 7% | 0.65 | +28 | NO | yes | -0.65 | -0.65 |
| 2026-07-15 | JNJ | Litigation | 86% | 0.61 | +25 | YES | yes | +0.39 | +0.38 |
| 2026-07-15 | JNJ | Nipocalimab / Lupus | 41% | 0.40 | +19 | NO | no | +0.60 | +0.58 |
| 2026-07-15 | JNJ | Ottava | 42% | 0.15 | +43 | NO | yes | -0.15 | -0.15 |
| 2026-07-15 | JNJ | Rybrevant | 38% | 0.07 | +55 | NO | yes | -0.07 | -0.07 |
| 2026-07-15 | JNJ | Tariff | 17% | 0.23 | +60 | NO | yes | -0.23 | -0.23 |
| 2026-07-15 | JNJ | Trufill | 3% | 0.82 | +15 | NO | no | +0.18 | +0.17 |
| 2026-07-15 | JNJ | Vaccine | 49% | 0.10 | +39 | YES | no | -0.10 | -0.10 |
| 2026-07-15 | MS | Basel | 48% | 0.27 | +25 | NO | no | +0.73 | +0.71 |
| 2026-07-15 | MS | Buyback | 70% | 0.44 | +26 | YES | no | -0.44 | -0.44 |
| 2026-07-15 | MS | Investment Grade | 45% | 0.42 | +13 | NO | yes | -0.42 | -0.42 |
| 2026-07-15 | MS | Middle East / Iran | 17% | 0.64 | +19 | NO | no | +0.36 | +0.35 |
| 2026-07-15 | MS | Oil | 14% | 0.67 | +19 | NO | no | +0.33 | +0.32 |
| 2026-07-15 | MS | Private Credit | 54% | 0.34 | +12 | NO | no | +0.66 | +0.64 |
| 2026-07-15 | MS | Tailwind | 48% | 0.40 | +12 | NO | yes | -0.40 | -0.40 |
| 2026-07-15 | MS | Tokenized / Tokenization | 14% | 0.47 | +39 | NO | no | +0.53 | +0.51 |
| 2026-07-15 | MS | Zero Hash | 11% | 0.39 | +50 | NO | no | +0.61 | +0.59 |
| 2026-07-15 | PGR | AI / Artificial Intelligence | 17% | 0.25 | +58 | NO | yes | -0.25 | -0.25 |
| 2026-07-15 | PGR | Catastrophe | 40% | 0.33 | +27 | NO | yes | -0.33 | -0.33 |
| 2026-07-15 | PGR | Headwind | 23% | 0.37 | +40 | NO | no | +0.63 | +0.61 |
| 2026-07-15 | PGR | Inflation | 56% | 0.22 | +22 | NO | yes | -0.22 | -0.22 |
| 2026-07-15 | PGR | Iran / Middle East | 4% | 0.83 | +13 | NO | no | +0.17 | +0.16 |
| 2026-07-15 | PGR | Snapshot | 82% | 0.46 | +36 | YES | yes | +0.54 | +0.52 |
| 2026-07-16 | UAL | Holiday | 41% | 0.13 | +28 | YES | no | -0.13 | -0.13 |
| 2026-07-16 | UAL | Middle East | 34% | 0.53 | +13 | NO | yes | -0.53 | -0.53 |
| 2026-07-16 | UAL | Oil | 19% | 0.35 | +46 | NO | yes | -0.35 | -0.35 |
| 2026-07-16 | UAL | Red Eye | 12% | 0.60 | +28 | NO | no | +0.40 | +0.39 |
| 2026-07-16 | UAL | Relax Row | 9% | 0.66 | +25 | NO | yes | -0.66 | -0.66 |
| 2026-07-16 | UAL | Shutdown / Shut Down | 34% | 0.19 | +15 | YES | no | -0.19 | -0.19 |
| 2026-07-16 | UAL | Starlink | 30% | 0.07 | +63 | NO | yes | -0.07 | -0.07 |
| 2026-07-16 | UAL | Union | 52% | 0.31 | +21 | YES | no | -0.31 | -0.31 |
| 2026-07-16 | UAL | World Cup | 9% | 0.31 | +60 | NO | no | +0.69 | +0.67 |
| 2026-07-17 | HOOD | Acquisition | 67% | 0.12 | +21 | NO | yes | -0.12 | -0.12 |
| 2026-07-17 | HOOD | Blockchain | 24% | 0.51 | +25 | NO | yes | -0.51 | -0.51 |
| 2026-07-17 | HOOD | Concierge | 11% | 0.68 | +21 | NO | no | +0.32 | +0.31 |
| 2026-07-17 | HOOD | Convertible | 11% | 0.51 | +38 | NO | no | +0.49 | +0.48 |
| 2026-07-17 | HOOD | Credit Card | 67% | 0.05 | +28 | NO | yes | -0.05 | -0.05 |
| 2026-07-17 | HOOD | Indonesia | 15% | 0.74 | +11 | NO | yes | -0.74 | -0.74 |
| 2026-07-17 | HOOD | Perp / Perpetual | 19% | 0.24 | +57 | NO | yes | -0.24 | -0.24 |
| 2026-07-17 | HOOD | Robinhood Chain | 19% | 0.11 | +70 | NO | yes | -0.11 | -0.11 |
| 2026-07-17 | HOOD | SIG / Susquehanna | 15% | 0.29 | +56 | NO | yes | -0.29 | -0.29 |
| 2026-07-17 | HOOD | Social | 41% | 0.08 | +51 | NO | yes | -0.08 | -0.08 |
| 2026-07-17 | HOOD | SpaceX | 20% | 0.66 | +14 | NO | yes | -0.66 | -0.66 |
| 2026-07-17 | HOOD | Tokenization | 28% | 0.15 | +57 | NO | yes | -0.15 | -0.15 |
| 2026-07-17 | HOOD | UK / United Kingdom | 19% | 0.40 | +41 | NO | yes | -0.40 | -0.40 |
| 2026-07-20 | DPZ | AI / Artificial Intelligence | 14% | 0.64 | +22 | NO | no | +0.36 | +0.35 |
| 2026-07-20 | DPZ | Best Deal Ever | 10% | 0.28 | +62 | NO | yes | -0.28 | -0.28 |
| 2026-07-20 | DPZ | DomOS | 7% | 0.46 | +47 | NO | no | +0.54 | +0.52 |
| 2026-07-20 | DPZ | DoorDash (5+ times) | 2% | 0.81 | +17 | NO | no | +0.19 | +0.18 |
| 2026-07-20 | DPZ | Emergency Pizza | 13% | 0.73 | +14 | NO | no | +0.27 | +0.26 |
| 2026-07-20 | DPZ | Insurance | 40% | 0.47 | +13 | NO | no | +0.53 | +0.51 |
| 2026-07-20 | DPZ | Joe Jordan | 4% | 0.06 | +90 | NO | yes | -0.06 | -0.06 |
| 2026-07-20 | DPZ | Parmesan | 20% | 0.44 | +36 | NO | yes | -0.44 | -0.44 |
| 2026-07-20 | DPZ | Same Store | 13% | 0.04 | +83 | NO | yes | -0.04 | -0.04 |
| 2026-07-20 | DPZ | Soccer / World Cup | 8% | 0.73 | +19 | NO | yes | -0.73 | -0.73 |
| 2026-07-20 | DPZ | Tailwind | 41% | 0.20 | +39 | NO | no | +0.80 | +0.78 |
| 2026-07-21 | ALLY | AI / Artificial Intelligence | 19% | 0.36 | +45 | NO | no | +0.64 | +0.62 |
| 2026-07-21 | ALLY | Basel | 23% | 0.61 | +16 | NO | no | +0.39 | +0.38 |
| 2026-07-21 | ALLY | EV / Electric | 52% | 0.31 | +21 | YES | yes | +0.69 | +0.67 |
| 2026-07-21 | ALLY | Oil | 10% | 0.45 | +45 | NO | yes | -0.45 | -0.45 |
| 2026-07-21 | ALLY | Rate Cut / Cut Rate | 56% | 0.36 | +20 | YES | no | -0.36 | -0.36 |
| 2026-07-21 | ALLY | Tailwind | 93% | 0.79 | +14 | YES | no | -0.79 | -0.79 |
| 2026-07-21 | ALLY | Tariff | 23% | 0.67 | +10 | NO | yes | -0.67 | -0.67 |
| 2026-07-22 | ALK | Amazon | 34% | 0.39 | +27 | NO | yes | -0.39 | -0.39 |
| 2026-07-22 | ALK | Cargo | 38% | 0.17 | +45 | NO | yes | -0.17 | -0.17 |
| 2026-07-22 | ALK | Starlink | 16% | 0.12 | +72 | NO | yes | -0.12 | -0.12 |
| 2026-07-22 | ALK | Tailwind | 74% | 0.39 | +35 | YES | yes | +0.61 | +0.59 |
| 2026-07-22 | ALK | Iran / Middle East | 7% | 0.81 | +12 | NO | no | +0.19 | +0.18 |
| 2026-07-22 | GEV | Administration | 37% | 0.18 | +19 | YES | yes | +0.82 | +0.80 |
| 2026-07-22 | GEV | Blade | 69% | 0.21 | +48 | YES | no | -0.21 | -0.21 |
| 2026-07-22 | GEV | China | 45% | 0.21 | +24 | YES | yes | +0.79 | +0.77 |
| 2026-07-22 | GEV | Iran / Middle East | 61% | 0.23 | +16 | NO | no | +0.77 | +0.75 |
| 2026-07-22 | GEV | Nuclear | 69% | 0.06 | +25 | NO | yes | -0.06 | -0.06 |
| 2026-07-22 | GEV | Oil | 21% | 0.05 | +16 | YES | no | -0.05 | -0.05 |
| 2026-07-22 | GEV | Robotic / Robotics | 53% | 0.09 | +38 | NO | yes | -0.09 | -0.09 |
| 2026-07-22 | GEV | Tariff | 53% | 0.12 | +35 | NO | yes | -0.12 | -0.12 |
| 2026-07-22 | GEV | Vietnam / India | 53% | 0.17 | +30 | NO | no | +0.83 | +0.81 |
| 2026-07-22 | GOOGL | Autonomous | 42% | 0.24 | +34 | NO | no | +0.76 | +0.74 |
| 2026-07-22 | GOOGL | Gemini 3 | 7% | 0.25 | +68 | NO | no | +0.75 | +0.73 |
| 2026-07-22 | GOOGL | Ironwood | 8% | 0.75 | +17 | NO | no | +0.25 | +0.24 |
| 2026-07-22 | GOOGL | Nano Banana | 7% | 0.45 | +48 | NO | no | +0.55 | +0.53 |
| 2026-07-22 | GOOGL | Nvidia | 22% | 0.32 | +46 | NO | yes | -0.32 | -0.32 |
| 2026-07-22 | GOOGL | Privacy | 42% | 0.18 | +24 | YES | no | -0.18 | -0.18 |
| 2026-07-22 | GOOGL | Regulator / Regulation / Regulatory | 33% | 0.16 | +17 | YES | no | -0.16 | -0.16 |
| 2026-07-22 | GOOGL | Search Advertising / Search Ad | 65% | 0.30 | +35 | YES | yes | +0.70 | +0.68 |
| 2026-07-22 | GOOGL | SpaceX | 2% | 0.79 | +19 | NO | no | +0.21 | +0.20 |
| 2026-07-22 | GOOGL | Tailwind | 33% | 0.29 | +38 | NO | yes | -0.29 | -0.29 |
| 2026-07-22 | GOOGL | Wiz | 5% | 0.32 | +63 | NO | yes | -0.32 | -0.32 |
| 2026-07-22 | GOOGL | Youtube Shorts | 30% | 0.59 | +11 | NO | no | +0.41 | +0.40 |
| 2026-07-22 | TSLA | Affordable | 60% | 0.29 | +11 | NO | yes | -0.29 | -0.29 |
| 2026-07-22 | TSLA | Berlin | 34% | 0.20 | +46 | NO | no | +0.80 | +0.78 |
| 2026-07-22 | TSLA | China | 81% | 0.08 | +11 | NO | no | +0.92 | +0.89 |
| 2026-07-22 | TSLA | Competition | 23% | 0.30 | +47 | NO | yes | -0.30 | -0.30 |
| 2026-07-22 | TSLA | Cybercab | 13% | 0.03 | +84 | NO | yes | -0.03 | -0.03 |
| 2026-07-22 | TSLA | Gigafactory | 52% | 0.29 | +23 | YES | no | -0.29 | -0.29 |
| 2026-07-22 | TSLA | Grok (3+ times) | 2% | 0.42 | +56 | NO | yes | -0.42 | -0.42 |
| 2026-07-22 | TSLA | Intel | 11% | 0.69 | +20 | NO | no | +0.31 | +0.30 |
| 2026-07-22 | TSLA | Iran / Middle East | 2% | 0.86 | +12 | NO | no | +0.14 | +0.14 |
| 2026-07-22 | TSLA | Megapack 3 | 7% | 0.22 | +71 | NO | yes | -0.22 | -0.22 |
| 2026-07-22 | TSLA | Merge / Merger | 4% | 0.67 | +29 | NO | no | +0.33 | +0.32 |
| 2026-07-22 | TSLA | Miami | 4% | 0.15 | +81 | NO | no | +0.85 | +0.82 |
| 2026-07-22 | TSLA | Powerwall | 51% | 0.39 | +10 | NO | no | +0.61 | +0.59 |
| 2026-07-22 | TSLA | Robotaxi | 35% | 0.01 | +64 | NO | yes | -0.01 | -0.01 |
| 2026-07-22 | TSLA | Safety Monitor | 4% | 0.80 | +16 | NO | yes | -0.80 | -0.80 |
| 2026-07-22 | TSLA | Supercharger / Super Charger | 49% | 0.34 | +15 | YES | yes | +0.66 | +0.64 |
| 2026-07-22 | TSLA | Semi | 52% | 0.08 | +40 | NO | yes | -0.08 | -0.08 |
| 2026-07-22 | TSLA | Six-Seater / Six-Seat | 2% | 0.64 | +34 | NO | no | +0.36 | +0.35 |
| 2026-07-22 | TSLA | SpaceX / xAI | 31% | 0.06 | +63 | NO | yes | -0.06 | -0.06 |
| 2026-07-22 | TSLA | Terafab | 5% | 0.10 | +85 | NO | yes | -0.10 | -0.10 |
| 2026-07-22 | TSLA | Tariff | 23% | 0.15 | +62 | NO | yes | -0.15 | -0.15 |
| 2026-07-23 | AAL | AT&T | 23% | 0.35 | +42 | NO | no | +0.65 | +0.63 |
| 2026-07-23 | AAL | ATC | 20% | 0.07 | +13 | YES | no | -0.07 | -0.07 |
| 2026-07-23 | AAL | Basic Economy | 23% | 0.42 | +35 | NO | yes | -0.42 | -0.42 |
| 2026-07-23 | AAL | Holiday | 62% | 0.28 | +34 | YES | no | -0.28 | -0.28 |
| 2026-07-23 | AAL | Centennial | 12% | 0.35 | +53 | NO | no | +0.65 | +0.63 |
| 2026-07-23 | AAL | Chicago / O’Hare | 69% | 0.13 | +18 | NO | yes | -0.13 | -0.13 |
| 2026-07-23 | AAL | Shutdown / Shut Down | 23% | 0.07 | +16 | YES | no | -0.07 | -0.07 |
| 2026-07-23 | AAL | Weather | 48% | 0.41 | +11 | NO | yes | -0.41 | -0.41 |
| 2026-07-23 | AAL | Tariff | 13% | 0.72 | +15 | NO | no | +0.28 | +0.27 |
| 2026-07-23 | AAL | World Cup | 12% | 0.41 | +47 | NO | no | +0.59 | +0.57 |
| 2026-07-23 | INTC | Arizona | 28% | 0.44 | +28 | NO | no | +0.56 | +0.54 |
| 2026-07-23 | INTC | Client Computing | 37% | 0.20 | +17 | YES | yes | +0.80 | +0.78 |
| 2026-07-23 | INTC | Desktop | 71% | 0.39 | +32 | YES | no | -0.39 | -0.39 |
| 2026-07-23 | INTC | Dividend | 75% | 0.09 | +66 | YES | no | -0.09 | -0.09 |
| 2026-07-23 | INTC | Foundry | 59% | 0.01 | +40 | NO | yes | -0.01 | -0.01 |
| 2026-07-23 | INTC | Government | 48% | 0.21 | +31 | NO | no | +0.79 | +0.77 |
| 2026-07-23 | INTC | Mobileye | 56% | 0.09 | +35 | NO | no | +0.91 | +0.88 |
| 2026-07-23 | INTC | Nvidia | 15% | 0.20 | +65 | NO | no | +0.80 | +0.78 |
| 2026-07-23 | INTC | Panther Lake / 18A | 30% | 0.02 | +68 | NO | yes | -0.02 | -0.02 |
| 2026-07-23 | INTC | Security | 54% | 0.17 | +29 | NO | yes | -0.17 | -0.17 |
| 2026-07-23 | INTC | Ultra 3 / Ultra Series 3 | 5% | 0.43 | +52 | NO | no | +0.57 | +0.55 |
| 2026-07-23 | LMT | NASA | 45% | 0.03 | +42 | YES | yes | +0.97 | +0.94 |
| 2026-07-23 | LMT | Sikorsky | 65% | 0.10 | +25 | NO | yes | -0.10 | -0.10 |
| 2026-07-24 | AXP | Basel | 17% | 0.06 | +11 | YES | no | -0.06 | -0.06 |
| 2026-07-24 | AXP | Currency | 27% | 0.14 | +13 | YES | no | -0.14 | -0.14 |
| 2026-07-24 | AXP | Lounge | 51% | 0.23 | +26 | NO | yes | -0.23 | -0.23 |
| 2026-07-24 | AXP | NFL | 4% | 0.69 | +27 | NO | yes | -0.69 | -0.69 |
| 2026-07-24 | AXP | OpenAI / ChatGPT | 4% | 0.81 | +15 | NO | yes | -0.81 | -0.81 |
| 2026-07-24 | AXP | Regulation / Regulatory | 73% | 0.28 | +45 | YES | no | -0.28 | -0.28 |
| 2026-07-24 | AXP | Spending Trend | 41% | 0.15 | +26 | YES | no | -0.15 | -0.15 |
| 2026-07-24 | AXP | Millennial | 47% | 0.12 | +41 | NO | yes | -0.12 | -0.12 |
| 2026-07-24 | VZ | 5G | 92% | 0.71 | +21 | YES | no | -0.71 | -0.71 |
| 2026-07-24 | VZ | C-Band | 76% | 0.60 | +16 | YES | no | -0.60 | -0.60 |
| 2026-07-24 | VZ | Home / MyHome | 88% | 0.62 | +26 | YES | yes | +0.38 | +0.37 |
| 2026-07-24 | VZ | Rural | 36% | 0.19 | +17 | YES | yes | +0.81 | +0.79 |
| 2026-07-24 | VZ | Spectrum | 92% | 0.78 | +14 | YES | yes | +0.22 | +0.21 |
| 2026-07-24 | VZ | Starry | 14% | 0.59 | +27 | NO | no | +0.41 | +0.40 |
| 2026-07-24 | VZ | Synergy | 14% | 0.26 | +60 | NO | yes | -0.26 | -0.26 |
| 2026-07-24 | VZ | Tailwind | 48% | 0.38 | +10 | YES | yes | +0.62 | +0.60 |
| 2026-07-28 | BA | Airbus | 51% | 0.18 | +33 | YES | no | -0.18 | -0.18 |
| 2026-07-28 | BA | Dividend | 61% | 0.17 | +44 | YES | no | -0.17 | -0.17 |
| 2026-07-28 | BA | F-47 | 9% | 0.40 | +51 | NO | no | +0.60 | +0.58 |
| 2026-07-28 | BA | Iran | 15% | 0.71 | +14 | NO | no | +0.29 | +0.28 |
| 2026-07-28 | BA | NASA | 57% | 0.29 | +28 | YES | yes | +0.71 | +0.69 |
| 2026-07-28 | BA | Philippine Airlines | 3% | 0.58 | +39 | NO | no | +0.42 | +0.41 |
| 2026-07-28 | BA | Space | 93% | 0.76 | +17 | YES | yes | +0.24 | +0.23 |
| 2026-07-28 | BA | Tariff | 13% | 0.58 | +29 | NO | no | +0.42 | +0.41 |
| 2026-07-28 | BA | Moon | 9% | 0.78 | +13 | NO | no | +0.22 | +0.21 |
| 2026-07-28 | F | AI / Artificial Intelligence | 53% | 0.37 | +10 | NO | no | +0.63 | +0.61 |
| 2026-07-28 | F | Apple | 23% | 0.42 | +35 | NO | yes | -0.42 | -0.42 |
| 2026-07-28 | F | Autonomy / Autonomous | 80% | 0.22 | +58 | YES | no | -0.22 | -0.22 |
| 2026-07-28 | F | China | 89% | 0.62 | +27 | YES | no | -0.62 | -0.62 |
| 2026-07-28 | F | Electric vehicle / EV | 77% | 0.05 | +18 | NO | yes | -0.05 | -0.05 |
| 2026-07-28 | F | Geely | 5% | 0.60 | +35 | NO | yes | -0.60 | -0.60 |
| 2026-07-28 | F | Oakville | 16% | 0.56 | +28 | NO | yes | -0.56 | -0.56 |
| 2026-07-28 | F | Skunk Works | 7% | 0.65 | +28 | NO | no | +0.35 | +0.34 |
| 2026-07-28 | F | Subsidy / Subsidized | 5% | 0.79 | +16 | NO | no | +0.21 | +0.20 |
| 2026-07-28 | F | Tailwind | 41% | 0.24 | +17 | YES | yes | +0.76 | +0.74 |
| 2026-07-28 | F | Tariff | 41% | 0.21 | +38 | NO | yes | -0.21 | -0.21 |
| 2026-07-28 | PYPL | Ads ID | 3% | 0.85 | +12 | NO | no | +0.15 | +0.15 |
| 2026-07-28 | PYPL | Agentic Commerce | 12% | 0.48 | +40 | NO | yes | -0.48 | -0.48 |
| 2026-07-28 | PYPL | Anthropic / Claude | 5% | 0.77 | +18 | NO | no | +0.23 | +0.22 |
| 2026-07-28 | PYPL | Biometric | 20% | 0.34 | +46 | NO | no | +0.66 | +0.64 |
| 2026-07-28 | PYPL | Braintree | 81% | 0.66 | +15 | YES | yes | +0.34 | +0.33 |
| 2026-07-28 | PYPL | E-Commerce | 83% | 0.41 | +42 | YES | yes | +0.59 | +0.57 |
| 2026-07-28 | PYPL | European Payments Council / EPC | 3% | 0.86 | +11 | NO | no | +0.14 | +0.14 |
| 2026-07-28 | PYPL | Google | 42% | 0.22 | +20 | YES | no | -0.22 | -0.22 |
| 2026-07-28 | PYPL | Regulation / Regulator / Regulatory | 51% | 0.25 | +26 | YES | no | -0.25 | -0.25 |
| 2026-07-28 | PYPL | Stablecoin / Stable Coin | 16% | 0.35 | +49 | NO | no | +0.65 | +0.63 |
| 2026-07-28 | PYPL | Stripe | 8% | 0.72 | +20 | NO | no | +0.28 | +0.27 |
| 2026-07-29 | CMG | Al Pastor | 21% | 0.28 | +51 | NO | yes | -0.28 | -0.28 |
| 2026-07-29 | CMG | Chipotle Kitchen | 6% | 0.27 | +67 | NO | yes | -0.27 | -0.27 |
| 2026-07-29 | CMG | Chipotle Lane / Chipotlane | 43% | 0.10 | +47 | NO | yes | -0.10 | -0.10 |
| 2026-07-29 | CMG | Cilantro Lime | 6% | 0.29 | +65 | NO | yes | -0.29 | -0.29 |
| 2026-07-29 | CMG | Honey Chicken | 9% | 0.22 | +69 | NO | yes | -0.22 | -0.22 |
| 2026-07-29 | CMG | Iran | 3% | 0.83 | +14 | NO | no | +0.17 | +0.16 |
| 2026-07-29 | CMG | Tariff | 10% | 0.69 | +21 | NO | no | +0.31 | +0.30 |
| 2026-07-29 | CVNA | AI / Artificial Intelligence | 24% | 0.35 | +41 | NO | yes | -0.35 | -0.35 |
| 2026-07-29 | CVNA | Ally | 47% | 0.31 | +16 | YES | no | -0.31 | -0.31 |
| 2026-07-29 | CVNA | Auction | 80% | 0.61 | +19 | YES | no | -0.61 | -0.61 |
| 2026-07-29 | CVNA | Iran / Middle East | 6% | 0.76 | +18 | NO | no | +0.24 | +0.23 |
| 2026-07-29 | CVNA | Market Share | 85% | 0.69 | +16 | YES | yes | +0.31 | +0.30 |
| 2026-07-29 | CVNA | Same Day | 9% | 0.77 | +14 | NO | no | +0.23 | +0.22 |
| 2026-07-29 | CVNA | Sebastian | 45% | 0.23 | +22 | YES | yes | +0.77 | +0.75 |
| 2026-07-29 | CVNA | Tariff | 16% | 0.51 | +33 | NO | yes | -0.51 | -0.51 |
| 2026-07-29 | META | Advertising | 96% | 0.80 | +16 | YES | no | -0.80 | -0.80 |
| 2026-07-29 | META | Age Verification | 3% | 0.85 | +12 | NO | no | +0.15 | +0.15 |
| 2026-07-29 | META | Algorithm | 26% | 0.52 | +22 | NO | no | +0.48 | +0.47 |
| 2026-07-29 | META | Cloud | 21% | 0.11 | +68 | NO | yes | -0.11 | -0.11 |
| 2026-07-29 | META | Dividend | 23% | 0.66 | +11 | NO | no | +0.34 | +0.33 |
| 2026-07-29 | META | Hiring | 70% | 0.15 | +15 | NO | no | +0.85 | +0.82 |
| 2026-07-29 | META | Hyperion | 4% | 0.61 | +35 | NO | no | +0.39 | +0.38 |
| 2026-07-29 | META | Oakley | 9% | 0.38 | +53 | NO | no | +0.62 | +0.60 |
| 2026-07-29 | META | Ray-Ban | 24% | 0.26 | +50 | NO | no | +0.74 | +0.72 |
| 2026-07-29 | META | Silicon | 14% | 0.39 | +47 | NO | yes | -0.39 | -0.39 |
| 2026-07-29 | MSFT | AMD / Advanced Micro Devices | 17% | 0.38 | +45 | NO | yes | -0.38 | -0.38 |
| 2026-07-29 | MSFT | Anthropic | 7% | 0.49 | +44 | NO | yes | -0.49 | -0.49 |
| 2026-07-29 | MSFT | Cybersecurity | 26% | 0.62 | +12 | NO | no | +0.38 | +0.37 |
| 2026-07-29 | MSFT | Foundry | 11% | 0.17 | +72 | NO | yes | -0.17 | -0.17 |
| 2026-07-29 | MSFT | Frontier | 23% | 0.51 | +26 | NO | yes | -0.51 | -0.51 |
| 2026-07-29 | MSFT | GitHub | 50% | 0.07 | +43 | NO | yes | -0.07 | -0.07 |
| 2026-07-29 | MSFT | Helios | 2% | 0.66 | +32 | NO | yes | -0.66 | -0.66 |
| 2026-07-29 | MSFT | Layoff / Job Cuts | 2% | 0.86 | +12 | NO | no | +0.14 | +0.14 |
| 2026-07-29 | MSFT | Maia | 11% | 0.46 | +43 | NO | yes | -0.46 | -0.46 |
| 2026-07-29 | MSFT | Memory | 23% | 0.34 | +43 | NO | yes | -0.34 | -0.34 |
| 2026-07-29 | MSFT | OpenAI | 38% | 0.06 | +56 | NO | yes | -0.06 | -0.06 |
| 2026-07-29 | MSFT | Phi | 10% | 0.76 | +14 | NO | no | +0.24 | +0.23 |
| 2026-07-29 | MSFT | Windows 11 | 31% | 0.58 | +11 | NO | no | +0.42 | +0.41 |
| 2026-07-29 | SBUX | Boyu | 7% | 0.38 | +55 | NO | no | +0.62 | +0.60 |
| 2026-07-29 | SBUX | Canada | 40% | 0.14 | +26 | YES | yes | +0.86 | +0.83 |
| 2026-07-29 | SBUX | Comparable Sales | 29% | 0.52 | +19 | NO | yes | -0.52 | -0.52 |
| 2026-07-29 | SBUX | Frappuccino | 50% | 0.28 | +22 | YES | yes | +0.72 | +0.70 |
| 2026-07-29 | SBUX | Horchata | 5% | 0.83 | +12 | NO | no | +0.17 | +0.16 |
| 2026-07-29 | SBUX | Loyalty | 78% | 0.60 | +18 | YES | yes | +0.40 | +0.39 |
| 2026-07-29 | SBUX | Matcha | 15% | 0.61 | +24 | NO | yes | -0.61 | -0.61 |
| 2026-07-29 | SBUX | Non Dairy | 3% | 0.76 | +21 | NO | no | +0.24 | +0.23 |
| 2026-07-29 | SBUX | Promotion | 56% | 0.40 | +16 | YES | no | -0.40 | -0.40 |
| 2026-07-29 | SBUX | Protein | 27% | 0.13 | +60 | NO | no | +0.87 | +0.84 |
| 2026-07-29 | SBUX | Smart Queue / SmartQ | 11% | 0.36 | +53 | NO | yes | -0.36 | -0.36 |
| 2026-07-29 | SBUX | S'more | 5% | 0.73 | +22 | NO | yes | -0.73 | -0.73 |
| 2026-07-29 | SBUX | Tariff | 13% | 0.09 | +78 | NO | yes | -0.09 | -0.09 |
| 2026-07-29 | WING | AI / Artificial Intelligence | 37% | 0.46 | +17 | NO | yes | -0.46 | -0.46 |
| 2026-07-29 | WING | India (2+ times) | 4% | 0.42 | +54 | NO | no | +0.58 | +0.56 |
| 2026-07-29 | WING | NFL / NBA | 43% | 0.31 | +12 | YES | yes | +0.69 | +0.67 |
| 2026-07-29 | WING | Share Repurchase | 34% | 0.09 | +57 | NO | yes | -0.09 | -0.09 |
| 2026-07-29 | WING | Tajín | 4% | 0.47 | +49 | NO | no | +0.53 | +0.51 |
| 2026-07-29 | WING | Tender | 45% | 0.27 | +28 | NO | no | +0.73 | +0.71 |
| 2026-07-29 | WING | World Cup | 10% | 0.51 | +39 | NO | yes | -0.51 | -0.51 |
| 2026-07-30 | AAPL | Broadcom | 2% | 0.37 | +61 | NO | yes | -0.37 | -0.37 |
| 2026-07-30 | AAPL | Formula 1 / F1 | 10% | 0.31 | +59 | NO | yes | -0.31 | -0.31 |
| 2026-07-30 | AAPL | Gemini | 4% | 0.62 | +34 | NO | no | +0.38 | +0.37 |
| 2026-07-30 | AAPL | Liquid Glass | 5% | 0.84 | +11 | NO | no | +0.16 | +0.16 |
| 2026-07-30 | AAPL | Manufacturing | 60% | 0.23 | +17 | NO | yes | -0.23 | -0.23 |
| 2026-07-30 | AAPL | Modem | 13% | 0.54 | +33 | NO | no | +0.46 | +0.45 |
| 2026-07-30 | AAPL | OpenAI / ChatGPT | 9% | 0.74 | +17 | NO | no | +0.26 | +0.25 |
| 2026-07-30 | AAPL | Siri | 54% | 0.07 | +39 | NO | yes | -0.07 | -0.07 |
| 2026-07-30 | AAPL | Sport | 35% | 0.33 | +32 | NO | yes | -0.33 | -0.33 |
| 2026-07-30 | AAPL | Tariff | 21% | 0.05 | +74 | NO | yes | -0.05 | -0.05 |
| 2026-07-30 | AMZN | Alexa+ / Alexa Plus | 10% | 0.29 | +61 | NO | yes | -0.29 | -0.29 |
| 2026-07-30 | AMZN | Anthropic | 21% | 0.18 | +61 | NO | yes | -0.18 | -0.18 |
| 2026-07-30 | AMZN | China | 41% | 0.25 | +16 | YES | no | -0.25 | -0.25 |
| 2026-07-30 | AMZN | Data Center | 42% | 0.16 | +42 | NO | yes | -0.16 | -0.16 |
| 2026-07-30 | AMZN | Drone | 8% | 0.75 | +17 | NO | no | +0.25 | +0.24 |
| 2026-07-30 | AMZN | Gen-AI / Generative AI | 21% | 0.26 | +53 | NO | yes | -0.26 | -0.26 |
| 2026-07-30 | AMZN | Iran / Middle East | 14% | 0.49 | +37 | NO | yes | -0.49 | -0.49 |
| 2026-07-30 | AMZN | Live Sports | 26% | 0.28 | +46 | NO | yes | -0.28 | -0.28 |
| 2026-07-30 | AMZN | OpenAI | 7% | 0.31 | +62 | NO | yes | -0.31 | -0.31 |
| 2026-07-30 | AMZN | Pinterest | 7% | 0.60 | +33 | NO | yes | -0.60 | -0.60 |
| 2026-07-30 | AMZN | Prime Day | 48% | 0.03 | +49 | NO | yes | -0.03 | -0.03 |
| 2026-07-30 | AMZN | Amazon Leo / Project Kuiper | 15% | 0.19 | +66 | NO | yes | -0.19 | -0.19 |
| 2026-07-30 | AMZN | Robotic / Robotics | 29% | 0.28 | +43 | NO | yes | -0.28 | -0.28 |
| 2026-07-30 | AMZN | Rufus | 12% | 0.30 | +58 | NO | no | +0.70 | +0.68 |
| 2026-07-30 | AMZN | Snowflake | 2% | 0.80 | +18 | NO | yes | -0.80 | -0.80 |
| 2026-07-30 | AMZN | Sponsored Products | 26% | 0.51 | +23 | NO | yes | -0.51 | -0.51 |
| 2026-07-30 | AMZN | Supply Chain | 27% | 0.35 | +38 | NO | yes | -0.35 | -0.35 |
| 2026-07-30 | AMZN | Tariff | 10% | 0.04 | +86 | NO | yes | -0.04 | -0.04 |
| 2026-07-30 | AMZN | Third Party Seller | 4% | 0.26 | +70 | NO | no | +0.74 | +0.72 |
| 2026-07-30 | AMZN | Trainium | 21% | 0.04 | +75 | NO | yes | -0.04 | -0.04 |
| 2026-07-30 | AMZN | Zoox / Robotaxi | 8% | 0.52 | +40 | NO | no | +0.48 | +0.47 |
| 2026-07-30 | AMZN | World Cup | 2% | 0.66 | +32 | NO | no | +0.34 | +0.33 |
| 2026-07-30 | RDDT | Developer | 69% | 0.43 | +26 | YES | yes | +0.57 | +0.55 |
| 2026-07-30 | RDDT | Game / Gaming | 61% | 0.43 | +18 | YES | yes | +0.57 | +0.55 |
| 2026-07-30 | RDDT | Google (3+ times) | 13% | 0.56 | +31 | NO | no | +0.44 | +0.43 |
| 2026-07-30 | RDDT | Headwind | 37% | 0.30 | +33 | NO | yes | -0.30 | -0.30 |
| 2026-07-30 | RDDT | OpenAI / Open AI | 61% | 0.43 | +18 | YES | no | -0.43 | -0.43 |
| 2026-07-30 | RDDT | Shopify | 21% | 0.24 | +55 | NO | yes | -0.24 | -0.24 |
| 2026-07-30 | RDDT | Smartly | 37% | 0.24 | +13 | YES | no | -0.24 | -0.24 |
| 2026-07-30 | RDDT | Tailwind | 61% | 0.31 | +30 | YES | yes | +0.69 | +0.67 |
| 2026-07-30 | YUM | AI / Artificial Intelligence | 69% | 0.09 | +22 | NO | yes | -0.09 | -0.09 |
| 2026-07-30 | YUM | Beef | 30% | 0.37 | +33 | NO | no | +0.63 | +0.61 |
| 2026-07-30 | YUM | Byte | 23% | 0.13 | +64 | NO | yes | -0.13 | -0.13 |
| 2026-07-30 | YUM | Cyclospora / Cyclosporiasis | 5% | 0.53 | +42 | NO | no | +0.47 | +0.46 |
| 2026-07-30 | YUM | Food Safety | 20% | 0.47 | +33 | NO | yes | -0.47 | -0.47 |
| 2026-07-30 | YUM | Lettuce | 5% | 0.59 | +36 | NO | no | +0.41 | +0.40 |
| 2026-07-30 | YUM | LongRange Capital | 5% | 0.49 | +46 | NO | yes | -0.49 | -0.49 |
| 2026-07-30 | YUM | Luxe / Luxe Value Menu | 30% | 0.45 | +25 | NO | yes | -0.45 | -0.45 |
| 2026-07-30 | YUM | Outbreak / Illness | 20% | 0.57 | +23 | NO | no | +0.43 | +0.42 |
| 2026-07-30 | YUM | Recall / Recalled | 41% | 0.10 | +31 | YES | no | -0.10 | -0.10 |
| 2026-07-30 | YUM | Saucy / Sauce | 30% | 0.28 | +42 | NO | yes | -0.28 | -0.28 |
| 2026-07-30 | YUM | Taylor Farms | 5% | 0.73 | +22 | NO | no | +0.27 | +0.26 |
| 2026-08-03 | GRAB | Buyback / Buy Back | 35% | 0.30 | +35 | NO | yes | -0.30 | -0.30 |
| 2026-08-03 | GRAB | Commission | 47% | 0.31 | +22 | NO | yes | -0.31 | -0.31 |
| 2026-08-03 | GRAB | Delivery Hero | 10% | 0.77 | +13 | NO | yes | -0.77 | -0.77 |
| 2026-08-03 | GRAB | Foodpanda | 23% | 0.35 | +42 | NO | yes | -0.35 | -0.35 |
| 2026-08-03 | GRAB | GrabMart | 52% | 0.20 | +28 | NO | yes | -0.20 | -0.20 |
| 2026-08-03 | GRAB | Headwind | 43% | 0.39 | +18 | NO | yes | -0.39 | -0.39 |
| 2026-08-03 | GRAB | Iran / Middle East | 10% | 0.56 | +34 | NO | no | +0.44 | +0.43 |
| 2026-08-03 | GRAB | MAI | 14% | 0.44 | +42 | NO | no | +0.56 | +0.54 |
| 2026-08-03 | GRAB | Robot / Robotic / Robotics | 15% | 0.68 | +17 | NO | no | +0.32 | +0.31 |
| 2026-08-03 | GRAB | Stash | 10% | 0.38 | +52 | NO | yes | -0.38 | -0.38 |
| 2026-08-03 | GRAB | Superbank | 23% | 0.06 | +71 | NO | yes | -0.06 | -0.06 |
| 2026-08-03 | GRAB | Tailwind | 31% | 0.14 | +17 | YES | no | -0.14 | -0.14 |
| 2026-08-03 | GRAB | WeRide | 18% | 0.35 | +47 | NO | no | +0.65 | +0.63 |
| 2026-08-03 | PLTR | Anthropic / Claude | 9% | 0.76 | +15 | NO | no | +0.24 | +0.23 |
| 2026-08-03 | PLTR | Automotive | 44% | 0.17 | +27 | YES | no | -0.17 | -0.17 |
| 2026-08-03 | PLTR | Healthcare | 75% | 0.50 | +25 | YES | no | -0.50 | -0.50 |
| 2026-08-03 | PLTR | ICE / Immigration and Customs Enforcement | 10% | 0.77 | +13 | NO | no | +0.23 | +0.22 |
| 2026-08-03 | PLTR | International | 86% | 0.04 | +10 | NO | yes | -0.04 | -0.04 |
| 2026-08-03 | PLTR | Iran / Iranian | 13% | 0.74 | +13 | NO | no | +0.26 | +0.25 |
| 2026-08-03 | PLTR | Israel | 32% | 0.57 | +11 | NO | no | +0.43 | +0.42 |
| 2026-08-03 | PLTR | Lethal | 33% | 0.50 | +17 | NO | no | +0.50 | +0.48 |
| 2026-08-03 | PLTR | Maven | 40% | 0.13 | +47 | NO | yes | -0.13 | -0.13 |
| 2026-08-03 | PLTR | NHS / National Health Service | 44% | 0.17 | +27 | YES | no | -0.17 | -0.17 |
| 2026-08-03 | PLTR | Nvidia | 6% | 0.59 | +35 | NO | yes | -0.59 | -0.59 |
| 2026-08-03 | PLTR | Revenue Guidance | 67% | 0.10 | +23 | NO | yes | -0.10 | -0.10 |
| 2026-08-03 | PLTR | Slop / AI Slop | 9% | 0.39 | +52 | NO | yes | -0.39 | -0.39 |
| 2026-08-03 | PLTR | Sovereign AI | 6% | 0.36 | +58 | NO | yes | -0.36 | -0.36 |
| 2026-08-03 | PLTR | Warp Speed | 44% | 0.24 | +32 | NO | no | +0.76 | +0.74 |
| 2026-08-03 | SNAP | Game | 56% | 0.19 | +25 | NO | no | +0.81 | +0.79 |
| 2026-08-03 | SNAP | Glasses | 52% | 0.14 | +34 | NO | yes | -0.14 | -0.14 |
| 2026-08-03 | SNAP | Memories Storage | 14% | 0.29 | +57 | NO | yes | -0.29 | -0.29 |
| 2026-08-03 | SNAP | Restructuring | 39% | 0.23 | +38 | NO | yes | -0.23 | -0.23 |
| 2026-08-03 | SNAP | Spectacles | 56% | 0.33 | +23 | YES | no | -0.33 | -0.33 |
| 2026-08-03 | SNAP | Storage | 18% | 0.25 | +57 | NO | yes | -0.25 | -0.25 |
| 2026-08-03 | SNAP | UK / United Kingdom | 10% | 0.72 | +18 | NO | no | +0.28 | +0.27 |
| 2026-08-04 | AMD | Agentic AI | 7% | 0.29 | +64 | NO | yes | -0.29 | -0.29 |
| 2026-08-04 | AMD | China | 56% | 0.20 | +24 | NO | yes | -0.20 | -0.20 |
| 2026-08-04 | AMD | Export Restriction / Export Control | 5% | 0.69 | +26 | NO | yes | -0.69 | -0.69 |
| 2026-08-04 | AMD | Frontier | 25% | 0.64 | +11 | NO | yes | -0.64 | -0.64 |
| 2026-08-04 | AMD | Helios | 8% | 0.07 | +85 | NO | yes | -0.07 | -0.07 |
| 2026-08-04 | AMD | Inference / Inferencing | 24% | 0.10 | +66 | NO | yes | -0.10 | -0.10 |
| 2026-08-04 | AMD | Memory / HBM | 42% | 0.06 | +52 | NO | yes | -0.06 | -0.06 |
| 2026-08-04 | AMD | Meta | 17% | 0.35 | +48 | NO | yes | -0.35 | -0.35 |
| 2026-08-04 | AMD | MI450 / MI455X | 7% | 0.07 | +86 | NO | yes | -0.07 | -0.07 |
| 2026-08-04 | AMD | Microsoft / Azure | 75% | 0.11 | +14 | NO | yes | -0.11 | -0.11 |
| 2026-08-04 | AMD | ROCm | 29% | 0.11 | +60 | NO | yes | -0.11 | -0.11 |
| 2026-08-04 | AMD | Supply Chain | 56% | 0.22 | +22 | NO | yes | -0.22 | -0.22 |
| 2026-08-04 | AMD | Venice | 8% | 0.07 | +85 | NO | yes | -0.07 | -0.07 |
| 2026-08-04 | AMD | OpenAI | 14% | 0.26 | +60 | NO | yes | -0.26 | -0.26 |
| 2026-08-04 | MCD | Big Arch | 14% | 0.32 | +54 | NO | no | +0.68 | +0.66 |
| 2026-08-04 | MCD | Caesar | 2% | 0.60 | +38 | NO | no | +0.40 | +0.39 |
| 2026-08-04 | MCD | Delivery | 72% | 0.54 | +18 | YES | yes | +0.46 | +0.45 |
| 2026-08-04 | MCD | Dividend | 65% | 0.17 | +48 | YES | no | -0.17 | -0.17 |
| 2026-08-04 | MCD | Happy Meal | 29% | 0.36 | +35 | NO | yes | -0.36 | -0.36 |
| 2026-08-04 | MCD | Iran / Middle East | 45% | 0.41 | +14 | NO | no | +0.59 | +0.57 |
| 2026-08-04 | MCD | Loyalty | 57% | 0.27 | +16 | NO | yes | -0.27 | -0.27 |
| 2026-08-04 | MCD | McCafé | 2% | 0.30 | +68 | NO | no | +0.70 | +0.68 |
| 2026-08-04 | MCD | McChicken | 21% | 0.65 | +14 | NO | no | +0.35 | +0.34 |
| 2026-08-04 | MCD | Monopoly | 28% | 0.07 | +21 | YES | no | -0.07 | -0.07 |
| 2026-08-04 | MCD | Red Bull | 5% | 0.42 | +53 | NO | yes | -0.42 | -0.42 |
| 2026-08-04 | MCD | Revenue | 47% | 0.30 | +17 | YES | no | -0.30 | -0.30 |
| 2026-08-04 | MCD | Snack Wrap | 16% | 0.43 | +41 | NO | no | +0.57 | +0.55 |
| 2026-08-04 | MCD | Soccer / Football | 5% | 0.70 | +25 | NO | no | +0.30 | +0.29 |
| 2026-08-04 | MCD | Tariff | 8% | 0.75 | +17 | NO | no | +0.25 | +0.24 |
| 2026-08-04 | MCD | World Cup | 11% | 0.19 | +70 | NO | yes | -0.19 | -0.19 |
| 2026-08-04 | SPOT | Apple | 65% | 0.36 | +29 | YES | yes | +0.64 | +0.62 |
| 2026-08-04 | SPOT | Claude | 9% | 0.68 | +23 | NO | yes | -0.68 | -0.68 |
| 2026-08-04 | SPOT | Fitness | 7% | 0.45 | +48 | NO | yes | -0.45 | -0.45 |
| 2026-08-04 | SPOT | Game / Gaming | 43% | 0.26 | +17 | YES | yes | +0.74 | +0.72 |
| 2026-08-04 | SPOT | Headwind | 48% | 0.18 | +30 | YES | yes | +0.82 | +0.80 |
| 2026-08-04 | SPOT | Peloton | 7% | 0.75 | +18 | NO | no | +0.25 | +0.24 |
| 2026-08-04 | TOST | Agent / Agentic | 25% | 0.12 | +63 | NO | yes | -0.12 | -0.12 |
| 2026-08-04 | TOST | Instacart | 11% | 0.76 | +13 | NO | no | +0.24 | +0.23 |
| 2026-08-04 | TOST | Memory / Chip | 20% | 0.38 | +42 | NO | yes | -0.38 | -0.38 |
| 2026-08-04 | TOST | Resy | 20% | 0.57 | +23 | NO | no | +0.43 | +0.42 |
| 2026-08-04 | TOST | Share Repurchase / Buyback | 34% | 0.14 | +52 | NO | yes | -0.14 | -0.14 |
| 2026-08-04 | TOST | Tariff | 29% | 0.14 | +57 | NO | yes | -0.14 | -0.14 |
| 2026-08-04 | TOST | Toast IQ | 25% | 0.09 | +66 | NO | yes | -0.09 | -0.09 |
| 2026-08-04 | ZETA | Agentic Commerce | 7% | 0.80 | +13 | NO | no | +0.20 | +0.19 |
| 2026-08-04 | ZETA | AI Infrastructure | 7% | 0.50 | +43 | NO | yes | -0.50 | -0.50 |
| 2026-08-04 | ZETA | Connected TV | 37% | 0.48 | +15 | NO | no | +0.52 | +0.50 |
| 2026-08-04 | ZETA | Foundry | 7% | 0.26 | +67 | NO | yes | -0.26 | -0.26 |
| 2026-08-04 | ZETA | Inference | 11% | 0.68 | +21 | NO | yes | -0.68 | -0.68 |
| 2026-08-04 | ZETA | Loyalty | 28% | 0.36 | +36 | NO | yes | -0.36 | -0.36 |
| 2026-08-04 | ZETA | OpenAI | 20% | 0.37 | +43 | NO | yes | -0.37 | -0.37 |
| 2026-08-04 | ZETA | Palantir | 7% | 0.07 | +86 | NO | yes | -0.07 | -0.07 |
| 2026-08-04 | ZETA | Snowflake | 58% | 0.44 | +14 | YES | yes | +0.56 | +0.54 |
| 2026-08-04 | ZETA | SuperGraph | 15% | 0.34 | +51 | NO | no | +0.66 | +0.64 |
| 2026-08-05 | DASH | Afford / Affordable / Affordability | 93% | 0.76 | +17 | YES | yes | +0.24 | +0.23 |
| 2026-08-05 | DASH | Autonomous | 35% | 0.25 | +40 | NO | yes | -0.25 | -0.25 |
| 2026-08-05 | DASH | DashMart | 64% | 0.51 | +13 | YES | yes | +0.49 | +0.48 |
| 2026-08-05 | DASH | Drone | 19% | 0.21 | +60 | NO | no | +0.79 | +0.77 |
| 2026-08-05 | DASH | Headwind | 56% | 0.26 | +30 | YES | no | -0.26 | -0.26 |
| 2026-08-05 | DASH | Local Commerce | 89% | 0.61 | +28 | YES | yes | +0.39 | +0.38 |
| 2026-08-05 | DASH | New York | 44% | 0.21 | +23 | YES | no | -0.21 | -0.21 |
| 2026-08-05 | DASH | Robot / Robotic / Robotics | 19% | 0.30 | +51 | NO | no | +0.70 | +0.68 |
| 2026-08-05 | DASH | Shopify | 10% | 0.76 | +14 | NO | no | +0.24 | +0.23 |
| 2026-08-05 | DASH | Tailwind | 35% | 0.18 | +17 | YES | no | -0.18 | -0.18 |
| 2026-08-05 | DASH | Waymo | 6% | 0.80 | +14 | NO | yes | -0.80 | -0.80 |
| 2026-08-05 | DIS | Abu Dhabi | 9% | 0.25 | +66 | NO | yes | -0.25 | -0.25 |
| 2026-08-05 | DIS | AI / Artificial Intelligence | 12% | 0.23 | +65 | NO | yes | -0.23 | -0.23 |
| 2026-08-05 | DIS | Box Office | 78% | 0.06 | +16 | NO | yes | -0.06 | -0.06 |
| 2026-08-05 | DIS | Churn | 40% | 0.19 | +41 | NO | yes | -0.19 | -0.19 |
| 2026-08-05 | DIS | Digital Centerpiece | 3% | 0.66 | +31 | NO | yes | -0.66 | -0.66 |
| 2026-08-05 | DIS | Epic Universe | 5% | 0.69 | +26 | NO | no | +0.31 | +0.30 |
| 2026-08-05 | DIS | Fortnite | 5% | 0.59 | +36 | NO | no | +0.41 | +0.40 |
| 2026-08-05 | DIS | Grogu / Baby Yoda | 9% | 0.35 | +56 | NO | yes | -0.35 | -0.35 |
| 2026-08-05 | DIS | International Visitation | 18% | 0.42 | +40 | NO | yes | -0.42 | -0.42 |
| 2026-08-05 | DIS | Moana | 28% | 0.33 | +39 | NO | yes | -0.33 | -0.33 |
| 2026-08-05 | DIS | NFL Network / RedZone | 6% | 0.34 | +60 | NO | no | +0.66 | +0.64 |
| 2026-08-05 | DIS | Streamline / Streamlining | 6% | 0.78 | +16 | NO | no | +0.22 | +0.21 |
| 2026-08-05 | DIS | Toy Story 5 | 6% | 0.17 | +77 | NO | yes | -0.17 | -0.17 |
| 2026-08-05 | DIS | Vertical Video / Vert | 6% | 0.65 | +29 | NO | yes | -0.65 | -0.65 |
| 2026-08-05 | DUOL | Chess | 37% | 0.31 | +32 | NO | yes | -0.31 | -0.31 |
| 2026-08-05 | DUOL | Flashcard | 11% | 0.68 | +21 | NO | no | +0.32 | +0.31 |
| 2026-08-05 | DUOL | Free Trial | 15% | 0.66 | +19 | NO | yes | -0.66 | -0.66 |
| 2026-08-05 | DUOL | Luckin Coffee | 15% | 0.66 | +19 | NO | no | +0.34 | +0.33 |
| 2026-08-05 | DUOL | McDonald's | 11% | 0.77 | +12 | NO | no | +0.23 | +0.22 |
| 2026-08-05 | DUOL | Tutor | 37% | 0.40 | +23 | NO | no | +0.60 | +0.58 |
| 2026-08-05 | EBAY | AI / Artificial Intelligence | 76% | 0.05 | +19 | NO | yes | -0.05 | -0.05 |
| 2026-08-05 | EBAY | Bullion | 12% | 0.57 | +31 | NO | yes | -0.57 | -0.57 |
| 2026-08-05 | EBAY | Circular Economy | 26% | 0.31 | +43 | NO | no | +0.69 | +0.67 |
| 2026-08-05 | EBAY | Depop | 9% | 0.12 | +79 | NO | yes | -0.12 | -0.12 |
| 2026-08-05 | EBAY | Etsy | 10% | 0.73 | +17 | NO | yes | -0.73 | -0.73 |
| 2026-08-05 | EBAY | GameStop | 4% | 0.68 | +28 | NO | no | +0.32 | +0.31 |
| 2026-08-05 | EBAY | Goldin | 29% | 0.10 | +61 | NO | yes | -0.10 | -0.10 |
| 2026-08-05 | EBAY | Guaranteed Fit | 26% | 0.27 | +47 | NO | yes | -0.27 | -0.27 |
| 2026-08-05 | EBAY | Klarna | 32% | 0.40 | +28 | NO | yes | -0.40 | -0.40 |
| 2026-08-05 | EBAY | One Piece | 9% | 0.73 | +18 | NO | yes | -0.73 | -0.73 |
| 2026-08-05 | EBAY | OpenAI / ChatGPT | 26% | 0.54 | +20 | NO | no | +0.46 | +0.45 |
| 2026-08-05 | EBAY | Pokemon | 4% | 0.26 | +70 | NO | yes | -0.26 | -0.26 |
| 2026-08-05 | FIG | AI / Artificial Intelligence | 75% | 0.03 | +22 | NO | yes | -0.03 | -0.03 |
| 2026-08-05 | FIG | Anthropic | 51% | 0.23 | +28 | YES | no | -0.23 | -0.23 |
| 2026-08-05 | FIG | Code Connect | 63% | 0.39 | +24 | YES | yes | +0.61 | +0.59 |
| 2026-08-05 | FIG | Colors | 46% | 0.13 | +33 | YES | no | -0.13 | -0.13 |
| 2026-08-05 | FIG | Gemini | 51% | 0.24 | +27 | YES | no | -0.24 | -0.24 |
| 2026-08-05 | FIG | Governance Plus | 34% | 0.56 | +10 | NO | no | +0.44 | +0.43 |
| 2026-08-05 | FIG | Hyperscaler | 51% | 0.33 | +18 | YES | no | -0.33 | -0.33 |
| 2026-08-05 | FIG | OpenAI / ChatGPT | 46% | 0.34 | +12 | YES | no | -0.34 | -0.34 |
| 2026-08-05 | MELI | AI / Artificial Intelligence | 18% | 0.17 | +65 | NO | yes | -0.17 | -0.17 |
| 2026-08-05 | MELI | Amazon | 23% | 0.11 | +12 | YES | no | -0.11 | -0.11 |
| 2026-08-05 | MELI | Automated / Automation | 20% | 0.69 | +11 | NO | no | +0.31 | +0.30 |
| 2026-08-05 | MELI | Chile | 64% | 0.22 | +14 | NO | no | +0.78 | +0.76 |
| 2026-08-05 | MELI | Competition | 47% | 0.42 | +11 | NO | no | +0.58 | +0.56 |
| 2026-08-05 | MELI | Digital Bank | 12% | 0.69 | +19 | NO | yes | -0.69 | -0.69 |
| 2026-08-05 | MELI | Headwind | 62% | 0.39 | +23 | YES | yes | +0.61 | +0.59 |
| 2026-08-05 | MELI | Oil / Gas / Gasoline | 13% | 0.75 | +12 | NO | no | +0.25 | +0.24 |
| 2026-08-05 | MELI | Payroll Loan | 5% | 0.68 | +27 | NO | no | +0.32 | +0.31 |
| 2026-08-05 | MELI | Pharmacy | 2% | 0.64 | +34 | NO | no | +0.36 | +0.35 |
| 2026-08-05 | SHOP | Amazon | 60% | 0.39 | +21 | YES | no | -0.39 | -0.39 |
| 2026-08-05 | SHOP | Headwind | 56% | 0.32 | +12 | NO | no | +0.68 | +0.66 |
| 2026-08-05 | SHOP | Microsoft (2+ times) | 3% | 0.54 | +43 | NO | no | +0.46 | +0.45 |
| 2026-08-05 | SHOP | Offline | 71% | 0.19 | +10 | NO | yes | -0.19 | -0.19 |
| 2026-08-05 | SHOP | OpenAI | 16% | 0.61 | +23 | NO | yes | -0.61 | -0.61 |
| 2026-08-05 | SHOP | Repurchase / Buyback | 11% | 0.36 | +53 | NO | no | +0.64 | +0.62 |
| 2026-08-05 | SHOP | Shopify Capital | 75% | 0.29 | +46 | YES | no | -0.29 | -0.29 |
| 2026-08-05 | SHOP | Stablecoin | 9% | 0.61 | +30 | NO | no | +0.39 | +0.38 |
| 2026-08-05 | SHOP | Tariff | 16% | 0.66 | +18 | NO | no | +0.34 | +0.33 |
| 2026-08-05 | TLN | Afford / Affordable / Affordability | 30% | 0.42 | +28 | NO | no | +0.58 | +0.56 |
| 2026-08-05 | TLN | Amazon | 62% | 0.23 | +15 | NO | no | +0.77 | +0.75 |
| 2026-08-05 | TLN | Anthropic / Claude | 17% | 0.05 | +12 | YES | no | -0.05 | -0.05 |
| 2026-08-05 | TLN | Bitcoin | 30% | 0.09 | +21 | YES | no | -0.09 | -0.09 |
| 2026-08-05 | TLN | Fossil | 49% | 0.38 | +11 | YES | yes | +0.62 | +0.60 |
| 2026-08-05 | TLN | Shapiro | 30% | 0.11 | +19 | YES | no | -0.11 | -0.11 |
| 2026-08-05 | TLN | SMR | 30% | 0.13 | +17 | YES | no | -0.13 | -0.13 |
| 2026-08-05 | TLN | Solar | 23% | 0.11 | +12 | YES | no | -0.11 | -0.11 |
| 2026-08-05 | TLN | Tariff | 43% | 0.16 | +27 | YES | no | -0.16 | -0.16 |
| 2026-08-05 | UBER | Avride | 14% | 0.74 | +12 | NO | no | +0.26 | +0.25 |
| 2026-08-05 | UBER | Delivery Hero | 5% | 0.15 | +80 | NO | yes | -0.15 | -0.15 |
| 2026-08-05 | UBER | Drone | 5% | 0.84 | +11 | NO | yes | -0.84 | -0.84 |
| 2026-08-05 | UBER | Expansion | 70% | 0.18 | +12 | NO | no | +0.82 | +0.80 |
| 2026-08-05 | UBER | Innovation | 73% | 0.58 | +15 | YES | yes | +0.42 | +0.41 |
| 2026-08-05 | UBER | Lucid | 14% | 0.41 | +45 | NO | yes | -0.41 | -0.41 |
| 2026-08-05 | UBER | Lyft | 54% | 0.24 | +30 | YES | no | -0.24 | -0.24 |
| 2026-08-05 | UBER | Market Share | 45% | 0.15 | +30 | YES | no | -0.15 | -0.15 |
| 2026-08-05 | UBER | Nvidia | 14% | 0.45 | +41 | NO | yes | -0.45 | -0.45 |
| 2026-08-05 | UBER | Waabi | 17% | 0.72 | +11 | NO | no | +0.28 | +0.27 |
| 2026-08-05 | UBER | Waymo | 32% | 0.20 | +48 | NO | yes | -0.20 | -0.20 |
| 2026-08-05 | UBER | Zoox | 8% | 0.68 | +24 | NO | yes | -0.68 | -0.68 |
| 2026-08-05 | YOU | Agent / Agentic | 19% | 0.42 | +39 | NO | yes | -0.42 | -0.42 |
| 2026-08-05 | YOU | AMEX / American Express | 71% | 0.50 | +21 | YES | no | -0.50 | -0.50 |
| 2026-08-05 | YOU | Epic | 32% | 0.45 | +23 | NO | no | +0.55 | +0.53 |
| 2026-08-05 | YOU | FedRAMP | 11% | 0.53 | +36 | NO | no | +0.47 | +0.46 |
| 2026-08-05 | YOU | GovTech | 15% | 0.38 | +47 | NO | yes | -0.38 | -0.38 |
| 2026-08-05 | YOU | Medicare / Medicaid | 19% | 0.25 | +56 | NO | yes | -0.25 | -0.25 |
| 2026-08-05 | YOU | REAL ID | 19% | 0.58 | +23 | NO | no | +0.42 | +0.41 |
| 2026-08-05 | YOU | Samsung | 7% | 0.29 | +64 | NO | no | +0.71 | +0.69 |
| 2026-08-05 | YOU | Shutdown / Shut Down | 19% | 0.56 | +25 | NO | no | +0.44 | +0.43 |
| 2026-08-05 | YOU | Social Security | 11% | 0.50 | +39 | NO | no | +0.50 | +0.48 |
| 2026-08-05 | YOU | TSA PreCheck | 88% | 0.68 | +20 | YES | no | -0.68 | -0.68 |
| 2026-08-05 | YOU | World Cup | 32% | 0.18 | +50 | NO | no | +0.82 | +0.80 |
| 2026-08-06 | AAOI | CPO / Co-Packaged Optics | 12% | 0.39 | +49 | NO | yes | -0.39 | -0.39 |
| 2026-08-06 | AAOI | DOCSIS 4.0 / DOCSIS 4 | 37% | 0.41 | +22 | NO | yes | -0.41 | -0.41 |
| 2026-08-06 | AAOI | Firmware | 7% | 0.76 | +17 | NO | no | +0.24 | +0.23 |
| 2026-08-06 | AAOI | Indium Phosphide | 9% | 0.29 | +62 | NO | yes | -0.29 | -0.29 |
| 2026-08-06 | AAOI | Mediacom | 4% | 0.45 | +51 | NO | yes | -0.45 | -0.45 |
| 2026-08-06 | AAOI | Pearland | 7% | 0.34 | +59 | NO | yes | -0.34 | -0.34 |
| 2026-08-06 | AAOI | Qualification | 70% | 0.13 | +17 | NO | yes | -0.13 | -0.13 |
| 2026-08-06 | AAOI | Quantum | 21% | 0.28 | +51 | NO | yes | -0.28 | -0.28 |
| 2026-08-06 | AAOI | Refund | 7% | 0.54 | +39 | NO | yes | -0.54 | -0.54 |
| 2026-08-06 | AAOI | Tariff | 32% | 0.21 | +47 | NO | yes | -0.21 | -0.21 |
| 2026-08-06 | ABNB | Acquisition | 46% | 0.31 | +15 | YES | yes | +0.69 | +0.67 |
| 2026-08-06 | ABNB | Boutique | 34% | 0.30 | +36 | NO | yes | -0.30 | -0.30 |
| 2026-08-06 | ABNB | Code / Coding | 10% | 0.60 | +30 | NO | no | +0.40 | +0.39 |
| 2026-08-06 | ABNB | Project Hawaii | 10% | 0.46 | +44 | NO | yes | -0.46 | -0.46 |
| 2026-08-06 | ABNB | Social Media | 46% | 0.35 | +11 | YES | no | -0.35 | -0.35 |
| 2026-08-06 | ABNB | Take Rate | 73% | 0.61 | +12 | YES | yes | +0.39 | +0.38 |
| 2026-08-06 | ABNB | Third Party | 14% | 0.59 | +27 | NO | no | +0.41 | +0.40 |
| 2026-08-06 | ABNB | World Cup | 26% | 0.14 | +60 | NO | yes | -0.14 | -0.14 |
| 2026-08-06 | CELH | Electric Vibe | 6% | 0.40 | +54 | NO | yes | -0.40 | -0.40 |
| 2026-08-06 | CELH | PepsiCo | 55% | 0.15 | +30 | NO | yes | -0.15 | -0.15 |
| 2026-08-06 | CELH | Recall | 27% | 0.16 | +11 | YES | no | -0.16 | -0.16 |
| 2026-08-06 | CELH | Vibe | 52% | 0.20 | +28 | NO | yes | -0.20 | -0.20 |
| 2026-08-06 | CELH | Vitamin | 52% | 0.14 | +38 | YES | no | -0.14 | -0.14 |
| 2026-08-06 | CELH | World Cup | 4% | 0.68 | +28 | NO | no | +0.32 | +0.31 |
| 2026-08-06 | LYFT | Anthropic / Claude | 8% | 0.74 | +18 | NO | no | +0.26 | +0.25 |
| 2026-08-06 | LYFT | Baidu | 14% | 0.65 | +21 | NO | yes | -0.65 | -0.65 |
| 2026-08-06 | LYFT | Competition | 54% | 0.37 | +17 | YES | yes | +0.63 | +0.61 |
| 2026-08-06 | LYFT | DoorDash | 23% | 0.29 | +48 | NO | yes | -0.29 | -0.29 |
| 2026-08-06 | LYFT | Innovation | 89% | 0.34 | +55 | YES | yes | +0.66 | +0.64 |
| 2026-08-06 | LYFT | Membership | 39% | 0.18 | +21 | YES | yes | +0.82 | +0.80 |
| 2026-08-06 | LYFT | Nashville | 17% | 0.32 | +51 | NO | yes | -0.32 | -0.32 |
| 2026-08-06 | LYFT | Nvidia | 11% | 0.74 | +15 | NO | no | +0.26 | +0.25 |
| 2026-08-06 | LYFT | NYC / New York | 70% | 0.38 | +32 | YES | yes | +0.62 | +0.60 |
| 2026-08-06 | LYFT | Revenue | 95% | 0.80 | +15 | YES | no | -0.80 | -0.80 |
| 2026-08-06 | LYFT | Waymo | 39% | 0.24 | +37 | NO | yes | -0.24 | -0.24 |
| 2026-08-06 | NBIS | Aether | 25% | 0.43 | +32 | NO | no | +0.57 | +0.55 |
| 2026-08-06 | NBIS | Gigawatt | 53% | 0.10 | +37 | NO | yes | -0.10 | -0.10 |
| 2026-08-06 | NBIS | Hyperscaler | 53% | 0.21 | +26 | NO | yes | -0.21 | -0.21 |
| 2026-08-06 | NBIS | Meta | 39% | 0.15 | +46 | NO | no | +0.85 | +0.82 |
| 2026-08-06 | NBIS | Nvidia | 53% | 0.12 | +35 | NO | no | +0.88 | +0.85 |
| 2026-08-06 | NBIS | Pennsylvania | 18% | 0.35 | +47 | NO | no | +0.65 | +0.63 |
| 2026-08-06 | NBIS | Robotic | 32% | 0.20 | +12 | YES | no | -0.20 | -0.20 |
| 2026-08-06 | NBIS | Token | 39% | 0.05 | +56 | NO | yes | -0.05 | -0.05 |
| 2026-08-06 | NBIS | TripleTen / Triple Ten | 39% | 0.46 | +15 | NO | yes | -0.46 | -0.46 |
| 2026-08-06 | NBIS | Uber | 53% | 0.15 | +38 | YES | no | -0.15 | -0.15 |
| 2026-08-06 | NBIS | Vera Rubin | 18% | 0.25 | +57 | NO | yes | -0.25 | -0.25 |
| 2026-08-07 | DKNG | Alberta | 16% | 0.14 | +70 | NO | no | +0.86 | +0.83 |
| 2026-08-07 | DKNG | Combo | 12% | 0.34 | +54 | NO | yes | -0.34 | -0.34 |
| 2026-08-07 | DKNG | Competitor / Competition | 94% | 0.68 | +26 | YES | yes | +0.32 | +0.31 |
| 2026-08-07 | DKNG | Feature | 73% | 0.46 | +27 | YES | yes | +0.54 | +0.52 |
| 2026-08-07 | DKNG | Moonshot | 5% | 0.37 | +58 | NO | yes | -0.37 | -0.37 |
| 2026-08-07 | DKNG | NBC / NBCUniversal | 16% | 0.52 | +32 | NO | yes | -0.52 | -0.52 |
| 2026-08-07 | DKNG | Railbird | 13% | 0.68 | +19 | NO | no | +0.32 | +0.31 |
| 2026-08-07 | DKNG | Retention / Retain | 90% | 0.76 | +14 | YES | yes | +0.24 | +0.23 |
| 2026-08-07 | DKNG | Spain | 5% | 0.79 | +16 | NO | no | +0.21 | +0.20 |
| 2026-08-07 | DKNG | Spanish | 19% | 0.56 | +25 | NO | yes | -0.56 | -0.56 |
| 2026-08-07 | DKNG | Super App | 9% | 0.20 | +71 | NO | yes | -0.20 | -0.20 |
| 2026-08-07 | DKNG | World Cup | 23% | 0.04 | +73 | NO | yes | -0.04 | -0.04 |
| 2026-08-07 | LLY | AI / Artificial Intelligence | 7% | 0.44 | +49 | NO | no | +0.56 | +0.54 |
| 2026-08-07 | LLY | Alzheimer | 90% | 0.76 | +14 | YES | yes | +0.24 | +0.23 |
| 2026-08-07 | LLY | Foundayo | 7% | 0.03 | +90 | NO | yes | -0.03 | -0.03 |
| 2026-08-07 | LLY | Headwind | 83% | 0.45 | +38 | YES | no | -0.45 | -0.45 |
| 2026-08-07 | LLY | Inluriyo | 9% | 0.08 | +83 | NO | yes | -0.08 | -0.08 |
| 2026-08-07 | LLY | LillyDirect | 15% | 0.31 | +54 | NO | yes | -0.31 | -0.31 |
| 2026-08-07 | LLY | Novo Nordisk | 21% | 0.09 | +12 | YES | no | -0.09 | -0.09 |
| 2026-08-07 | LLY | Nvidia | 5% | 0.74 | +21 | NO | no | +0.26 | +0.25 |
| 2026-08-07 | LLY | Pennsylvania | 3% | 0.79 | +18 | NO | no | +0.21 | +0.20 |
| 2026-08-07 | LLY | Tariff | 7% | 0.74 | +19 | NO | no | +0.26 | +0.25 |
| 2026-08-07 | LLY | Ventyx | 7% | 0.73 | +20 | NO | no | +0.27 | +0.26 |
| 2026-08-07 | LLY | Vial | 36% | 0.22 | +42 | NO | no | +0.78 | +0.76 |
| 2026-08-07 | TTWO | Borderlands | 84% | 0.63 | +21 | YES | yes | +0.37 | +0.36 |
| 2026-08-07 | TTWO | GTA+ / GTA plus | 24% | 0.20 | +56 | NO | yes | -0.20 | -0.20 |
| 2026-08-07 | TTWO | Mafia | 39% | 0.35 | +26 | NO | yes | -0.35 | -0.35 |
| 2026-08-07 | TTWO | PlayStation 5 | 29% | 0.60 | +11 | NO | no | +0.40 | +0.39 |
| 2026-08-07 | TTWO | Pre Order | 2% | 0.30 | +68 | NO | yes | -0.30 | -0.30 |
| 2026-08-07 | TTWO | Switch 2 | 11% | 0.38 | +51 | NO | no | +0.62 | +0.60 |
| 2026-08-07 | TTWO | Tailwind | 20% | 0.36 | +44 | NO | no | +0.64 | +0.62 |
| 2026-08-07 | TTWO | Vice City | 7% | 0.79 | +14 | NO | no | +0.21 | +0.20 |
| 2026-08-07 | TTWO | Wembanyama | 2% | 0.49 | +49 | NO | yes | -0.49 | -0.49 |
| 2026-08-07 | TTWO | Zynga | 35% | 0.10 | +55 | NO | yes | -0.10 | -0.10 |
| 2026-08-07 | VST | Buyback | 65% | 0.26 | +39 | YES | no | -0.26 | -0.26 |
| 2026-08-07 | VST | Capacity Auction | 39% | 0.33 | +28 | NO | no | +0.67 | +0.65 |
| 2026-08-07 | VST | Cogentrix | 13% | 0.18 | +69 | NO | yes | -0.18 | -0.18 |
| 2026-08-07 | VST | Co-Location | 35% | 0.37 | +28 | NO | yes | -0.37 | -0.37 |
| 2026-08-07 | VST | Hyperscaler | 42% | 0.31 | +27 | NO | yes | -0.31 | -0.31 |
| 2026-08-07 | VST | Investment Grade | 31% | 0.34 | +35 | NO | yes | -0.34 | -0.34 |
| 2026-08-07 | VST | Martin Lake | 35% | 0.42 | +23 | NO | yes | -0.42 | -0.42 |
| 2026-08-07 | VST | Meta | 13% | 0.20 | +67 | NO | yes | -0.20 | -0.20 |
| 2026-08-07 | VST | Oak Hill | 27% | 0.30 | +43 | NO | yes | -0.30 | -0.30 |
| 2026-08-07 | VST | Permian | 38% | 0.27 | +35 | NO | yes | -0.27 | -0.27 |
| 2026-08-07 | VST | Production Tax Credit / PTC | 57% | 0.25 | +18 | NO | yes | -0.25 | -0.25 |
| 2026-08-07 | VST | Uprate / Up Rate | 24% | 0.38 | +38 | NO | no | +0.62 | +0.60 |
| 2026-08-07 | WEN | Baconator | 13% | 0.70 | +17 | NO | yes | -0.70 | -0.70 |
| 2026-08-07 | WEN | Closure | 66% | 0.49 | +17 | YES | yes | +0.51 | +0.49 |
| 2026-08-07 | WEN | Delivery | 94% | 0.67 | +27 | YES | no | -0.67 | -0.67 |
| 2026-08-07 | WEN | FreshAI | 23% | 0.35 | +42 | NO | no | +0.65 | +0.63 |
| 2026-08-07 | WEN | Loyalty | 87% | 0.45 | +42 | YES | yes | +0.55 | +0.53 |
| 2026-08-07 | WEN | Minions | 9% | 0.36 | +55 | NO | yes | -0.36 | -0.36 |
| 2026-08-07 | WEN | Pickle | 13% | 0.75 | +12 | NO | no | +0.25 | +0.24 |
| 2026-08-07 | WEN | Project Fresh | 16% | 0.17 | +67 | NO | yes | -0.17 | -0.17 |
| 2026-08-07 | WEN | Ranch | 23% | 0.63 | +14 | NO | no | +0.37 | +0.36 |
| 2026-08-07 | WEN | Sonic | 5% | 0.70 | +25 | NO | no | +0.30 | +0.29 |
| 2026-08-07 | WEN | Spicy Chicken | 23% | 0.49 | +28 | NO | no | +0.51 | +0.49 |
| 2026-08-10 | HIMS | Canada | 26% | 0.12 | +62 | NO | yes | -0.12 | -0.12 |
| 2026-08-10 | HIMS | Cancer | 22% | 0.57 | +21 | NO | no | +0.43 | +0.42 |
| 2026-08-10 | HIMS | Collaboration | 38% | 0.41 | +21 | NO | yes | -0.41 | -0.41 |
| 2026-08-10 | HIMS | Eucalyptus | 14% | 0.09 | +77 | NO | yes | -0.09 | -0.09 |
| 2026-08-10 | HIMS | Europe | 22% | 0.45 | +33 | NO | yes | -0.45 | -0.45 |
| 2026-08-10 | HIMS | FDA | 34% | 0.16 | +50 | NO | yes | -0.16 | -0.16 |
| 2026-08-10 | HIMS | Lab Testing | 34% | 0.23 | +43 | NO | yes | -0.23 | -0.23 |
| 2026-08-10 | HIMS | Longevity | 38% | 0.22 | +40 | NO | yes | -0.22 | -0.22 |
| 2026-08-10 | HIMS | Microdose / Microdosing | 10% | 0.75 | +15 | NO | no | +0.25 | +0.24 |
| 2026-08-10 | HIMS | Peptide | 30% | 0.05 | +65 | NO | yes | -0.05 | -0.05 |
| 2026-08-10 | HIMS | Regulation | 18% | 0.70 | +12 | NO | no | +0.30 | +0.29 |
| 2026-08-10 | HIMS | Testosterone | 38% | 0.03 | +59 | NO | yes | -0.03 | -0.03 |
| 2026-08-10 | HIMS | Vitamin | 30% | 0.44 | +26 | NO | no | +0.56 | +0.54 |
| 2026-08-10 | HIMS | Wearable | 26% | 0.24 | +50 | NO | yes | -0.24 | -0.24 |
| 2026-08-10 | HIMS | Wegovy | 22% | 0.11 | +67 | NO | yes | -0.11 | -0.11 |
| 2026-08-10 | HIMS | YourBio | 14% | 0.43 | +43 | NO | no | +0.57 | +0.55 |
| 2026-08-10 | HIMS | Zava | 22% | 0.30 | +48 | NO | no | +0.70 | +0.68 |
| 2026-08-11 | CAVA | Acceleration | 36% | 0.17 | +19 | YES | no | -0.17 | -0.17 |
| 2026-08-11 | CAVA | AI / Artificial Intelligence | 62% | 0.15 | +23 | NO | yes | -0.15 | -0.15 |
| 2026-08-11 | CAVA | Automation | 36% | 0.17 | +19 | YES | no | -0.17 | -0.17 |
| 2026-08-11 | CAVA | CavaCore | 10% | 0.30 | +60 | NO | yes | -0.30 | -0.30 |
| 2026-08-11 | CAVA | Cyclospora / Cyclosporiasis | 10% | 0.63 | +27 | NO | yes | -0.63 | -0.63 |
| 2026-08-11 | CAVA | Dining | 69% | 0.35 | +34 | YES | no | -0.35 | -0.35 |
| 2026-08-11 | CAVA | Pita Chips | 56% | 0.15 | +29 | NO | yes | -0.15 | -0.15 |
| 2026-08-11 | CAVA | Salmon | 36% | 0.03 | +61 | NO | yes | -0.03 | -0.03 |
| 2026-08-11 | CAVA | Same Store | 23% | 0.08 | +15 | YES | no | -0.08 | -0.08 |
| 2026-08-11 | CAVA | Shrimp | 23% | 0.44 | +33 | NO | yes | -0.44 | -0.44 |
| 2026-08-11 | CAVA | Spice | 43% | 0.35 | +22 | NO | no | +0.65 | +0.63 |
| 2026-08-11 | CAVA | Sweet Potato | 30% | 0.60 | +10 | NO | no | +0.40 | +0.39 |
| 2026-08-11 | CAVA | Tariff | 36% | 0.24 | +12 | YES | no | -0.24 | -0.24 |
| 2026-08-11 | CRWV | Anthropic | 33% | 0.26 | +41 | NO | no | +0.74 | +0.72 |
| 2026-08-11 | CRWV | China / Chinese | 33% | 0.52 | +15 | NO | no | +0.48 | +0.47 |
| 2026-08-11 | CRWV | Healthcare | 30% | 0.49 | +21 | NO | no | +0.51 | +0.49 |
| 2026-08-11 | CRWV | Nvidia (3+ times) | 19% | 0.17 | +64 | NO | yes | -0.17 | -0.17 |
| 2026-08-11 | CRWV | Quantum | 19% | 0.60 | +21 | NO | no | +0.40 | +0.39 |
| 2026-08-11 | CRWV | Solidigm | 19% | 0.17 | +64 | NO | yes | -0.17 | -0.17 |
| 2026-08-11 | CRWV | Storage | 78% | 0.07 | +15 | NO | yes | -0.07 | -0.07 |
| 2026-08-12 | COHR | China / Chinese | 40% | 0.28 | +12 | YES | no | -0.28 | -0.28 |
| 2026-08-12 | COHR | CHIPS Act | 23% | 0.61 | +16 | NO | no | +0.39 | +0.38 |
| 2026-08-12 | COHR | Indium Phosphide | 75% | 0.05 | +20 | NO | yes | -0.05 | -0.05 |
| 2026-08-12 | COHR | Liquid Crystal | 66% | 0.42 | +24 | YES | no | -0.42 | -0.42 |
| 2026-08-12 | COHR | Multi-Rail | 32% | 0.25 | +43 | NO | yes | -0.25 | -0.25 |
| 2026-08-12 | COHR | Nvidia | 41% | 0.10 | +49 | NO | yes | -0.10 | -0.10 |
| 2026-08-12 | COHR | Optical Circuit Switch | 66% | 0.48 | +18 | YES | no | -0.48 | -0.48 |
| 2026-08-12 | COHR | Sherman | 58% | 0.11 | +31 | NO | yes | -0.11 | -0.11 |
| 2026-08-12 | COHR | Thermadite | 24% | 0.51 | +25 | NO | yes | -0.51 | -0.51 |
| 2026-08-12 | COHR | Zurich | 24% | 0.54 | +22 | NO | yes | -0.54 | -0.54 |
