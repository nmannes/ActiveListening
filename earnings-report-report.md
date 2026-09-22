# Earnings Report

Generated 2026-09-22 · 36 companies with upcoming word markets · 571 words

## Method

Targets are the words in currently open Kalshi earnings-mention markets (from the market caches). Word matching follows Kalshi's resolution rules (word boundaries, plural/possessive forms). Aliases that share a market slug are the same market (the cache splits a market word like "Gas / Gasoline / Fuel" into its pieces), so they render as one joined row.

- Aggregate transitions over all upcoming words: P(word said | said last call) = 4819/6660 = 72.4% vs P(said | not said last call) = 2058/14801 = 13.9% (base rate 32.0%)
- Baseline P blends the aggregate transition rate with the word's own presence rate (Laplace-smoothed); per-word evidence dominates as call history grows
- Baseline P: from prior earnings call transcripts dated strictly before the event (`transcripts/{TICKER}/`; same-day excluded, so the answer can't leak in); '-' = no pre-event history
- Only markets whose event is today or later are listed — a past event means the market is resolved-by-information, not an opportunity
- Last YES: last traded price for the word's currently open market (Kalshi API, active markets only; the NO side is the pair complement and always sums to $1.00). A $0.00 last price is the listing default for markets with no trades at all (Kalshi's minimum trade is $0.01), so those count as unpriced ('-') and never appear as opportunities. '-' = no open market, no trades, or fetch failed
- Verdict tiers: Strong YES (P ≥ 60%), Likely YES (45–60%), Coin flip (30–45%), Unlikely (<30%)

**2 of 36 companies lack transcript history** — run `./bin/kalshi transcripts --from-markets` to fill baselines.

## Opportunities (prior data vs market)

Sorted by gap descending — a positive gap means prior data says the word is more likely than the market prices it (buy YES); a negative gap means less likely (buy NO).

| Company | Word | Baseline P | Market YES | Gap |
|---|---|---|---|---|
| INTC | dividend | 74% | $0.13 | +61 |
| BAC | pipeline | 59% | $0.02 | +57 |
| JNJ | procedure | 92% | $0.42 | +50 |
| CAVA | traffic | 89% | $0.40 | +49 |
| JPM | trading | 86% | $0.40 | +46 |
| BAC | merrill | 89% | $0.44 | +45 |
| STZ | dividend | 80% | $0.36 | +44 |
| WFC | credit card | 95% | $0.51 | +44 |
| C | buyback / buy back | 82% | $0.40 | +42 |
| GS | marcus | 65% | $0.23 | +42 |
| CAVA | expansion | 83% | $0.42 | +41 |
| JNJ | vaccine | 48% | $0.11 | +37 |
| PSKY | pluto tv | 70% | $0.35 | +35 |
| CCL | princess | 79% | $0.47 | +32 |
| NKE | direct to consumer / dtc | 55% | $0.23 | +32 |
| COST | cannibalization | 51% | $0.21 | +30 |
| GIS | nielsen | 81% | $0.53 | +28 |
| JNJ | rybrevant | 40% | $0.14 | +26 |
| WFC | middle market | 83% | $0.59 | +24 |
| STZ | especial | 90% | $0.68 | +22 |
| STZ | inventory | 84% | $0.62 | +22 |
| JNJ | tecvayli | 35% | $0.14 | +21 |
| STZ | wine | 92% | $0.71 | +21 |
| DPZ | closure | 84% | $0.63 | +21 |
| CBRL | dividend | 81% | $0.60 | +21 |
| CCL | inflation | 51% | $0.31 | +20 |
| COST | buyback / buy back | 53% | $0.34 | +19 |
| C | credit card | 59% | $0.40 | +19 |
| STZ | depletion / depletions | 96% | $0.78 | +18 |
| WFC | headwind | 56% | $0.38 | +18 |
| GIS | iran / middle east | 74% | $0.56 | +18 |
| GS | buyback / buy back | 68% | $0.51 | +17 |
| GIS | progresso | 53% | $0.36 | +17 |
| COST | labor | 71% | $0.55 | +16 |
| MS | parametric | 74% | $0.59 | +15 |
| PSKY | subscriber | 93% | $0.80 | +13 |
| CCL | dry dock | 79% | $0.67 | +12 |
| COST | dividend | 71% | $0.59 | +12 |
| GOOGL | privacy | 42% | $0.30 | +12 |
| DPZ | insurance | 40% | $0.28 | +12 |
| DPZ | india | 56% | $0.45 | +11 |
| CCL | tailwind | 51% | $0.41 | +10 |
| UAL | nonstop / non stop | 36% | $0.26 | +10 |
| NKE | converse | 84% | $0.75 | +9 |
| COST | holiday | 70% | $0.61 | +9 |
| UAL | tariff | 19% | $0.10 | +9 |
| GIS | brazil | 74% | $0.65 | +9 |
| UAL | atc / air traffic control | 43% | $0.35 | +8 |
| GOOGL | search advertising / search ad | 66% | $0.58 | +8 |
| PSKY | netflix | 49% | $0.42 | +7 |
| MS | private market | 38% | $0.31 | +7 |
| GIS | divestiture | 81% | $0.74 | +7 |
| KR | shrink / theft | 83% | $0.77 | +6 |
| UAL | weather | 60% | $0.54 | +6 |
| BAC | oil | 20% | $0.14 | +6 |
| COST | expansion | 84% | $0.79 | +5 |
| JPM | m&a / merger | 80% | $0.75 | +5 |
| CBRL | headwind | 86% | $0.81 | +5 |
| BAC | tariff | 11% | $0.06 | +5 |
| STZ | pacifico | 84% | $0.79 | +5 |
| STZ | inflation | 57% | $0.52 | +5 |
| ACI | holiday | 50% | $0.45 | +5 |
| GOOGL | regulator / regulation / regulatory | 33% | $0.28 | +5 |
| STZ | ice | 5% | $0.01 | +4 |
| GIS | cheerios | 88% | $0.84 | +4 |
| ACI | retirement | 23% | $0.20 | +3 |
| CCL | oil | 17% | $0.14 | +3 |
| CCL | iran | 11% | $0.08 | +3 |
| PEP | volume | 89% | $0.86 | +3 |
| C | banamex | 45% | $0.42 | +3 |
| UAL | american airlines | 16% | $0.13 | +3 |
| JNJ | ottava | 44% | $0.42 | +2 |
| GOOGL | youtube shorts | 31% | $0.30 | +1 |
| COST | google / youtube | 34% | $0.34 | +0 |
| CBRL | tailwind | 25% | $0.25 | -0 |
| JNJ | administration | 36% | $0.36 | -0 |
| KR | divestiture | 20% | $0.20 | -0 |
| ACI | delivery | 81% | $0.81 | -0 |
| NKE | sustainable | 87% | $0.88 | -1 |
| ACI | snap / food stamp | 50% | $0.51 | -1 |
| UAL | newark | 74% | $0.75 | -1 |
| COST | automation | 9% | $0.11 | -2 |
| NKE | supply chain | 87% | $0.89 | -2 |
| JNJ | gene therapy | 11% | $0.13 | -2 |
| JPM | credit card | 66% | $0.68 | -2 |
| DPZ | inflation | 47% | $0.49 | -2 |
| MS | basel | 47% | $0.49 | -2 |
| WFC | consecutive | 86% | $0.88 | -2 |
| INTC | client computing | 37% | $0.40 | -3 |
| KR | produce | 69% | $0.72 | -3 |
| BAC | trump / president | 17% | $0.20 | -3 |
| GS | uncertainty | 86% | $0.89 | -3 |
| JNJ | litigation | 86% | $0.90 | -4 |
| JPM | apple | 29% | $0.33 | -4 |
| GOOGL | chrome | 76% | $0.80 | -4 |
| INTC | mobileye | 55% | $0.60 | -5 |
| AMZN | drone | 8% | $0.13 | -5 |
| CCL | tariff | 14% | $0.19 | -5 |
| AMZN | layoff / job cuts | 2% | $0.08 | -6 |
| NKE | retailer | 55% | $0.61 | -6 |
| TSLA | cybertruck | 38% | $0.44 | -6 |
| COST | gold bar | 7% | $0.13 | -6 |
| GIS | headwind | 81% | $0.87 | -6 |
| GIS | grands / croissants | 11% | $0.18 | -7 |
| GIS | inflation | 88% | $0.95 | -7 |
| ACI | tariff | 18% | $0.26 | -8 |
| GOOGL | autonomous | 42% | $0.50 | -8 |
| PEP | prebiotic | 11% | $0.19 | -8 |
| CCL | headwind | 57% | $0.66 | -9 |
| DPZ | tariff | 5% | $0.14 | -9 |
| DPZ | tailwind | 41% | $0.50 | -9 |
| GIS | certified color | 11% | $0.20 | -9 |
| GS | recession | 29% | $0.38 | -9 |
| NKE | beaverton | 10% | $0.19 | -9 |
| ACI | economy | 13% | $0.23 | -10 |
| TSLA | supercharger / super charger | 50% | $0.60 | -10 |
| MS | galaxy digital | 5% | $0.15 | -10 |
| PEP | protein | 31% | $0.42 | -11 |
| COST | instacart | 62% | $0.73 | -11 |
| INTC | security | 55% | $0.66 | -11 |
| PSKY | synergy | 14% | $0.25 | -11 |
| GIS | blue buffalo | 74% | $0.85 | -11 |
| MS | middle east / iran | 17% | $0.28 | -11 |
| JPM | geopolitical | 25% | $0.37 | -12 |
| JPM | tariff | 11% | $0.23 | -12 |
| JPM | clarity act | 3% | $0.15 | -12 |
| COST | spending | 62% | $0.75 | -13 |
| CBRL | road trip | 13% | $0.26 | -13 |
| CAVA | catering | 77% | $0.90 | -13 |
| CAVA | same restaurant / same store | 77% | $0.90 | -13 |
| KR | tariff | 23% | $0.36 | -13 |
| CAVA | ai / artificial intelligence | 65% | $0.78 | -13 |
| TSLA | regulator / regulatory / regulation | 77% | $0.90 | -13 |
| UAL | holiday | 40% | $0.53 | -13 |
| DPZ | ai / artificial intelligence | 14% | $0.29 | -15 |
| UAL | chase | 43% | $0.58 | -15 |
| AMZN | iran / middle east | 15% | $0.31 | -16 |
| INTC | arizona | 27% | $0.43 | -16 |
| AMZN | alexa+ / alexa plus | 11% | $0.27 | -16 |
| CBRL | maple street | 78% | $0.94 | -16 |
| PEP | celsius | 41% | $0.57 | -16 |
| CAVA | spice | 40% | $0.57 | -17 |
| GIS | supply chain | 67% | $0.84 | -17 |
| MS | zero hash | 11% | $0.28 | -17 |
| GIS | totino | 60% | $0.77 | -17 |
| INTC | nvidia | 15% | $0.33 | -18 |
| UAL | oil | 22% | $0.40 | -18 |
| NKE | sabrina | 20% | $0.38 | -18 |
| KR | snap / food stamp | 48% | $0.67 | -19 |
| CAVA | cyclospora / cyclosporiasis | 16% | $0.35 | -19 |
| TSLA | waymo | 13% | $0.32 | -19 |
| PEP | away from home | 62% | $0.81 | -19 |
| MS | tailwind | 50% | $0.69 | -19 |
| PEP | world cup | 10% | $0.30 | -20 |
| ACI | pharmacy | 75% | $0.95 | -20 |
| STZ | tariff | 24% | $0.44 | -20 |
| STZ | aluminum | 30% | $0.51 | -21 |
| GIS | wilderness | 53% | $0.74 | -21 |
| CCL | consumer sentiment | 20% | $0.42 | -22 |
| GIS | glp 1 / ozempic | 11% | $0.33 | -22 |
| GOOGL | recall / recalled | 22% | $0.44 | -22 |
| STZ | mi campo | 24% | $0.46 | -22 |
| CBRL | cracker barrel 400 | 16% | $0.39 | -23 |
| PEP | acquisition | 53% | $0.76 | -23 |
| CCL | holland america | 57% | $0.81 | -24 |
| COST | kirkland | 71% | $0.95 | -24 |
| CCL | dividend | 45% | $0.69 | -24 |
| COST | hot dog | 26% | $0.50 | -24 |
| KR | ai / artificial intelligence | 44% | $0.69 | -25 |
| INTC | foundry | 59% | $0.84 | -25 |
| JPM | hike / hiked | 50% | $0.75 | -25 |
| PSKY | regulation / regulatory | 30% | $0.55 | -25 |
| PEP | autonomous | 5% | $0.30 | -25 |
| COST | valuation | 9% | $0.35 | -26 |
| JPM | sapphire | 29% | $0.55 | -26 |
| TSLA | intel | 11% | $0.37 | -26 |
| NKE | dividend | 33% | $0.59 | -26 |
| DPZ | andrew gregory | 7% | $0.33 | -26 |
| INTC | government | 48% | $0.75 | -27 |
| WFC | iran / middle east | 8% | $0.35 | -27 |
| WFC | basel 3 | 5% | $0.32 | -27 |
| TSLA | miami | 4% | $0.32 | -28 |
| GIS | protein | 67% | $0.95 | -28 |
| DPZ | parmesan | 21% | $0.50 | -29 |
| TSLA | solar | 60% | $0.89 | -29 |
| JNJ | ai / artificial intelligence | 19% | $0.48 | -29 |
| GIS | tariff | 18% | $0.47 | -29 |
| STZ | oil / gas / gasoline | 30% | $0.61 | -31 |
| CBRL | ai / artificial intelligence | 16% | $0.47 | -31 |
| KR | inflation reduction act / ira | 19% | $0.51 | -32 |
| GIS | humanization | 25% | $0.57 | -32 |
| MS | ai / artificial intelligence | 47% | $0.79 | -32 |
| DPZ | world cup | 10% | $0.42 | -32 |
| JPM | hiring | 31% | $0.64 | -33 |
| ACI | uber | 13% | $0.46 | -33 |
| KR | instacart | 37% | $0.70 | -33 |
| DPZ | signature | 7% | $0.40 | -33 |
| COST | glp 1 | 2% | $0.36 | -34 |
| NKE | skims / nikeskims | 8% | $0.42 | -34 |
| CCL | middle east | 20% | $0.55 | -35 |
| UAL | crj450 | 5% | $0.41 | -36 |
| COST | churro | 5% | $0.41 | -36 |
| COST | revenue | 46% | $0.82 | -36 |
| UAL | middle east | 36% | $0.72 | -36 |
| KR | deflation | 34% | $0.70 | -36 |
| ACI | ai / artificial intelligence | 49% | $0.86 | -37 |
| GS | industry ventures | 16% | $0.53 | -37 |
| PEP | tariff | 16% | $0.55 | -39 |
| WFC | tariff | 16% | $0.55 | -39 |
| BAC | delinquency | 49% | $0.88 | -39 |
| COST | protein | 46% | $0.85 | -39 |
| DPZ | doordash | 14% | $0.53 | -39 |
| UAL | a321xlr | 19% | $0.58 | -39 |
| STZ | victoria | 18% | $0.57 | -39 |
| CAVA | salmon | 40% | $0.80 | -40 |
| TSLA | semi | 53% | $0.93 | -40 |
| GS | regulation | 34% | $0.75 | -41 |
| CCL | propel | 26% | $0.67 | -41 |
| JNJ | darzalex faspro | 23% | $0.64 | -41 |
| CBRL | reward | 48% | $0.89 | -41 |
| AMZN | prime day | 49% | $0.90 | -41 |
| PSKY | hbo | 18% | $0.59 | -41 |
| WFC | premier | 47% | $0.89 | -42 |
| UAL | relax row | 12% | $0.55 | -43 |
| PEP | fiber | 20% | $0.63 | -43 |
| JPM | regulation | 46% | $0.89 | -43 |
| CCL | modernization | 17% | $0.61 | -44 |
| TSLA | roadster | 48% | $0.93 | -45 |
| PSKY | antitrust / ftc / doj | 10% | $0.55 | -45 |
| CCL | ai / artificial intelligence | 14% | $0.59 | -45 |
| BAC | inflation | 39% | $0.84 | -45 |
| NKE | investor day | 40% | $0.86 | -46 |
| PSKY | investment grade | 14% | $0.60 | -46 |
| GOOGL | tailwind | 34% | $0.80 | -46 |
| CBRL | campfire | 22% | $0.68 | -46 |
| AMZN | snowflake | 3% | $0.50 | -47 |
| BAC | world cup | 5% | $0.52 | -47 |
| C | fico | 35% | $0.84 | -49 |
| TSLA | megapack 3 | 8% | $0.57 | -49 |
| PSKY | ufc | 26% | $0.75 | -49 |
| AMZN | supply chain | 28% | $0.79 | -51 |
| AMZN | third party seller | 4% | $0.55 | -51 |
| BAC | recession | 37% | $0.89 | -52 |
| AMZN | sponsored products | 27% | $0.79 | -52 |
| JNJ | halda therapeutics | 9% | $0.61 | -52 |
| CAVA | pomegranate | 28% | $0.80 | -52 |
| ACI | personalization | 29% | $0.81 | -52 |
| BAC | rate cut / cut rate | 31% | $0.84 | -53 |
| AMZN | live sports | 27% | $0.80 | -53 |
| DPZ | stuffed crust | 11% | $0.65 | -54 |
| COST | iran / middle east | 6% | $0.62 | -56 |
| UAL | starlink | 32% | $0.88 | -56 |
| BAC | ai / artificial intelligence | 34% | $0.90 | -56 |
| TSLA | samsung | 11% | $0.68 | -57 |
| JNJ | caplyta | 17% | $0.75 | -58 |
| TSLA | spacex / xai | 32% | $0.90 | -58 |
| UAL | coastliner | 12% | $0.70 | -58 |
| CBRL | tariff | 33% | $0.92 | -59 |
| TSLA | robotaxi | 36% | $0.95 | -59 |
| AMZN | robotic / robotics | 30% | $0.90 | -60 |
| INTC | panther lake / 18a | 31% | $0.93 | -62 |
| COST | retail media | 18% | $0.80 | -62 |
| GS | spacex | 7% | $0.71 | -64 |
| AMZN | gen ai / generative ai | 23% | $0.89 | -66 |
| COST | tariff | 24% | $0.93 | -69 |
| KR | giant eagle | 9% | $0.80 | -71 |
| AMZN | bedrock | 23% | $0.94 | -71 |
| AMZN | trainium | 23% | $0.94 | -71 |
| DPZ | detroit | 5% | $0.78 | -73 |
| GOOGL | antigravity | 7% | $0.81 | -74 |
| TSLA | merge / merger | 4% | $0.79 | -75 |
| NKE | tariff | 18% | $0.94 | -76 |
| GOOGL | codemender | 4% | $0.80 | -76 |
| AMZN | continuum | 3% | $0.80 | -77 |
| GOOGL | ai mode | 11% | $0.90 | -79 |
| TSLA | terafab | 7% | $0.90 | -83 |
| JPM | crypto / cryptocurrency / bitcoin | 5% | $0.89 | -84 |
| TSLA | cybercab | 14% | $0.98 | -84 |
| DPZ | same store | 13% | $0.98 | -85 |
| AMZN | tariff | 11% | $0.98 | -87 |
| GOOGL | gemini (3+ times) | 2% | $0.90 | -88 |
| DPZ | joe jordan | 5% | $0.96 | -91 |

## Apple (AAPL)
**Upcoming event:** 2026-10-29

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| apple pay | 37/61 | 61% | - | **Strong YES** |
| broadcom | 0/61 | 4% | - | **Unlikely** |
| creator studio | 1/61 | 5% | - | **Unlikely** |
| fold / folding / foldable | 2/61 | 5% | - | **Unlikely** |
| formula 1 / f1 | 5/61 | 11% | - | **Unlikely** |
| gemini | 1/61 | 4% | - | **Unlikely** |
| iphone 18 | 0/61 | 2% | - | **Unlikely** |
| liquid glass | 2/61 | 5% | - | **Unlikely** |
| mac studio | 6/61 | 13% | - | **Unlikely** |
| manufacturing | 37/61 | 61% | - | **Strong YES** |
| openai / chatgpt | 4/61 | 10% | - | **Unlikely** |
| private cloud compute | 7/61 | 14% | - | **Unlikely** |
| siri | 33/61 | 54% | - | **Likely YES** |
| sport | 21/61 | 36% | - | **Coin flip** |
| streaming | 18/61 | 30% | - | **Unlikely** |
| tariff | 12/61 | 22% | - | **Unlikely** |
| widget | 2/61 | 5% | - | **Unlikely** |

---

## Albertsons Companies (ACI)
**Upcoming event:** 2026-10-20

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| aci edge | 0/15 | 13% | - | **Unlikely** |
| ai / artificial intelligence | 7/15 | 49% | $0.86 | **Likely YES** |
| delivery | 13/15 | 81% | $0.81 | **Strong YES** |
| dividend | 14/15 | 86% | - | **Strong YES** |
| economy | 1/15 | 13% | $0.23 | **Unlikely** |
| glp 1 | 0/15 | 8% | - | **Unlikely** |
| holiday | 8/15 | 50% | $0.45 | **Likely YES** |
| medicare / medicaid | 1/15 | 13% | - | **Unlikely** |
| personalization | 3/15 | 29% | $0.81 | **Unlikely** |
| pharmacy | 12/15 | 75% | $0.95 | **Strong YES** |
| retirement | 2/15 | 23% | $0.20 | **Unlikely** |
| snap / food stamp | 8/15 | 50% | $0.51 | **Likely YES** |
| tariff | 2/15 | 18% | $0.26 | **Unlikely** |
| uber | 1/15 | 13% | $0.46 | **Unlikely** |

---

## Amazon (AMZN)
**Upcoming event:** 2026-10-29

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| alexa+ / alexa plus | 5/64 | 11% | $0.27 | **Unlikely** |
| anthropic / claude | 13/64 | 23% | - | **Unlikely** |
| bedrock | 13/64 | 23% | $0.94 | **Unlikely** |
| china | 26/64 | 40% | - | **Coin flip** |
| continuum | 0/64 | 3% | $0.80 | **Unlikely** |
| drone | 4/64 | 8% | $0.13 | **Unlikely** |
| gen ai / generative ai | 13/64 | 23% | $0.89 | **Unlikely** |
| graviton | 11/64 | 20% | - | **Unlikely** |
| iran / middle east | 8/64 | 15% | $0.31 | **Unlikely** |
| layoff / job cuts | 0/64 | 2% | $0.08 | **Unlikely** |
| live sports | 16/64 | 27% | $0.80 | **Unlikely** |
| nvidia | 10/64 | 18% | - | **Unlikely** |
| openai | 3/64 | 8% | - | **Unlikely** |
| pinterest | 3/64 | 8% | - | **Unlikely** |
| prime day | 31/64 | 49% | $0.90 | **Likely YES** |
| robotic / robotics | 18/64 | 30% | $0.90 | **Unlikely** |
| snowflake | 0/64 | 3% | $0.50 | **Unlikely** |
| sponsored products | 16/64 | 27% | $0.79 | **Unlikely** |
| supply chain | 17/64 | 28% | $0.79 | **Unlikely** |
| tariff | 5/64 | 11% | $0.98 | **Unlikely** |
| third party seller | 1/64 | 4% | $0.55 | **Unlikely** |
| trainium | 13/64 | 23% | $0.94 | **Unlikely** |

---

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
| influencer | - | - | $0.28 | **-** |
| new orleans | - | - | $0.26 | **-** |
| payback | - | - | $0.46 | **-** |
| personalization | - | - | $0.37 | **-** |
| runway | - | - | $0.67 | **-** |
| super puff | - | - | $0.30 | **-** |
| tariff | - | - | $0.96 | **-** |
| top of mind | - | - | $0.41 | **-** |

---

## Bank of America (BAC)
**Upcoming event:** 2026-10-14

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| agentic | 1/64 | 5% | - | **Unlikely** |
| ai / artificial intelligence | 21/64 | 34% | $0.90 | **Coin flip** |
| buyback / buy back | 39/64 | 60% | - | **Likely YES** |
| delinquency | 32/64 | 49% | $0.88 | **Likely YES** |
| hike / hiked | 22/64 | 36% | - | **Coin flip** |
| inflation | 24/64 | 39% | $0.84 | **Coin flip** |
| iran / middle east | 1/64 | 5% | - | **Unlikely** |
| merrill | 58/64 | 89% | $0.44 | **Strong YES** |
| oil | 12/64 | 20% | $0.14 | **Unlikely** |
| pipeline | 38/64 | 59% | $0.02 | **Likely YES** |
| rate cut / cut rate | 19/64 | 31% | $0.84 | **Coin flip** |
| recession | 24/64 | 37% | $0.89 | **Coin flip** |
| tariff | 6/64 | 11% | $0.06 | **Unlikely** |
| trump / president | 10/64 | 17% | $0.20 | **Unlikely** |
| world cup | 1/64 | 5% | $0.52 | **Unlikely** |

---

## BlackBerry (BB)
**Upcoming event:** 2026-09-24
*No transcript history — baseline unavailable. Run `./bin/kalshi transcripts --from-markets` to fill it in.*

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| alloy kore | - | - | $0.85 | **-** |
| amazon | - | - | - | **-** |
| autonomous | - | - | $0.50 | **-** |
| digital sovereignty | - | - | $0.87 | **-** |
| hailo | - | - | $0.59 | **-** |
| headwind | - | - | $0.64 | **-** |
| nvidia | - | - | $0.70 | **-** |
| physical ai | - | - | $0.86 | **-** |
| qnx | - | - | $0.96 | **-** |
| quantum | - | - | $0.19 | **-** |
| record revenue | - | - | - | **-** |
| tailwind | - | - | $0.53 | **-** |
| tariff | - | - | $0.21 | **-** |

---

## BlackRock (BLK)
**Upcoming event:** 2026-10-13

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| aes | 1/24 | 12% | - | **Unlikely** |
| aip / ai infrastructure partnership | 2/24 | 16% | - | **Unlikely** |
| aladdin | 23/24 | 90% | - | **Strong YES** |
| digital asset | 11/24 | 48% | - | **Likely YES** |
| etf inflow | 2/24 | 13% | - | **Unlikely** |
| hps | 5/24 | 26% | - | **Unlikely** |
| inflation / inflationary | 17/24 | 66% | - | **Strong YES** |
| lifepath paycheck | 8/24 | 37% | - | **Coin flip** |
| performance fee | 23/24 | 90% | - | **Strong YES** |
| private market | 23/24 | 90% | - | **Strong YES** |
| securitize / securitized | 4/24 | 23% | - | **Unlikely** |
| spiderrock / spider rock | 4/24 | 23% | - | **Unlikely** |
| tailwind | 8/24 | 34% | - | **Coin flip** |
| tokenized / tokenization | 6/24 | 30% | - | **Coin flip** |

---

## Citigroup (C)
**Upcoming event:** 2026-10-13

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| banamex | 7/17 | 45% | $0.42 | **Coin flip** |
| basel 3 | 0/17 | 7% | - | **Unlikely** |
| buyback / buy back | 15/17 | 82% | $0.40 | **Strong YES** |
| credit card | 10/17 | 59% | $0.40 | **Likely YES** |
| custody | 11/17 | 64% | - | **Strong YES** |
| dividend | 16/17 | 87% | - | **Strong YES** |
| fico | 5/17 | 35% | $0.84 | **Coin flip** |
| headcount | 7/17 | 45% | - | **Coin flip** |
| headwind | 15/17 | 82% | - | **Strong YES** |
| hormuz / iran | 0/17 | 7% | - | **Unlikely** |
| inflation | 8/17 | 49% | - | **Likely YES** |
| recession | 4/17 | 26% | - | **Unlikely** |
| tailwind | 6/17 | 40% | - | **Coin flip** |
| tariff | 4/17 | 31% | - | **Coin flip** |

---

## CAVA Group (CAVA)
**Upcoming event:** 2026-11-03

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| acceleration | 4/12 | 34% | - | **Coin flip** |
| ai / artificial intelligence | 8/12 | 65% | $0.78 | **Strong YES** |
| automation | 4/12 | 34% | - | **Coin flip** |
| catering | 10/12 | 77% | $0.90 | **Strong YES** |
| cavacore | 0/12 | 10% | - | **Unlikely** |
| cyclospora / cyclosporiasis | 0/12 | 16% | $0.35 | **Unlikely** |
| dining | 9/12 | 65% | - | **Strong YES** |
| expansion | 11/12 | 83% | $0.42 | **Strong YES** |
| pita chips | 7/12 | 59% | - | **Likely YES** |
| pomegranate | 2/12 | 28% | $0.80 | **Unlikely** |
| salmon | 4/12 | 40% | $0.80 | **Coin flip** |
| same restaurant / same store | 10/12 | 77% | $0.90 | **Strong YES** |
| shrimp | 2/12 | 28% | - | **Unlikely** |
| spice | 5/12 | 40% | $0.57 | **Coin flip** |
| tariff | 4/12 | 34% | - | **Coin flip** |
| traffic | 12/12 | 89% | $0.40 | **Strong YES** |

---

## Cracker Barrel (CBRL)
**Upcoming event:** 2026-09-23

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ai / artificial intelligence | 3/30 | 16% | $0.47 | **Unlikely** |
| campfire | 5/30 | 22% | $0.68 | **Unlikely** |
| cracker barrel 400 | 3/30 | 16% | $0.39 | **Unlikely** |
| dividend | 26/30 | 81% | $0.60 | **Strong YES** |
| headwind | 27/30 | 86% | $0.81 | **Strong YES** |
| maple street | 25/30 | 78% | $0.94 | **Strong YES** |
| reward | 14/30 | 48% | $0.89 | **Likely YES** |
| road trip | 2/30 | 13% | $0.26 | **Unlikely** |
| tailwind | 6/30 | 25% | $0.25 | **Unlikely** |
| tariff | 9/30 | 33% | $0.92 | **Coin flip** |

---

## Carnival Corporation (CCL)
**Upcoming event:** 2026-09-28

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ai / artificial intelligence | 2/28 | 14% | $0.59 | **Unlikely** |
| consumer sentiment | 4/28 | 20% | $0.42 | **Unlikely** |
| dividend | 12/28 | 45% | $0.69 | **Coin flip** |
| dry dock | 24/28 | 79% | $0.67 | **Strong YES** |
| headwind | 16/28 | 57% | $0.66 | **Likely YES** |
| holland america | 16/28 | 57% | $0.81 | **Likely YES** |
| inflation | 15/28 | 51% | $0.31 | **Likely YES** |
| iran | 2/28 | 11% | $0.08 | **Unlikely** |
| middle east | 4/28 | 20% | $0.55 | **Unlikely** |
| modernization | 3/28 | 17% | $0.61 | **Unlikely** |
| oil | 4/28 | 17% | $0.14 | **Unlikely** |
| princess | 23/28 | 79% | $0.47 | **Strong YES** |
| propel | 6/28 | 26% | $0.67 | **Unlikely** |
| tailwind | 14/28 | 51% | $0.41 | **Likely YES** |
| tariff | 2/28 | 14% | $0.19 | **Unlikely** |

---

## Costco (COST)
**Upcoming event:** 2026-09-24

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| automation | 4/64 | 9% | $0.11 | **Unlikely** |
| buyback / buy back | 34/64 | 53% | $0.34 | **Likely YES** |
| cannibalization | 33/64 | 51% | $0.21 | **Likely YES** |
| churro | 2/64 | 5% | $0.41 | **Unlikely** |
| dividend | 46/64 | 71% | $0.59 | **Strong YES** |
| expansion | 55/64 | 84% | $0.79 | **Strong YES** |
| glp 1 | 0/64 | 2% | $0.36 | **Unlikely** |
| gold bar | 3/64 | 7% | $0.13 | **Unlikely** |
| google / youtube | 21/64 | 34% | $0.34 | **Coin flip** |
| holiday | 46/64 | 70% | $0.61 | **Strong YES** |
| hot dog | 15/64 | 26% | $0.50 | **Unlikely** |
| instacart | 40/64 | 62% | $0.73 | **Strong YES** |
| iran / middle east | 2/64 | 6% | $0.62 | **Unlikely** |
| kirkland | 46/64 | 71% | $0.95 | **Strong YES** |
| labor | 47/64 | 71% | $0.55 | **Strong YES** |
| protein | 29/64 | 46% | $0.85 | **Likely YES** |
| retail media | 10/64 | 18% | $0.80 | **Unlikely** |
| revenue | 29/64 | 46% | $0.82 | **Likely YES** |
| spending | 40/64 | 62% | $0.75 | **Strong YES** |
| tariff | 14/64 | 24% | $0.93 | **Unlikely** |
| valuation | 4/64 | 9% | $0.35 | **Unlikely** |

---

## Carvana Co. (CVNA)
**Upcoming event:** 2026-10-28

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| acquired / acquisition | 34/36 | 91% | - | **Strong YES** |
| adesa | 16/36 | 46% | - | **Likely YES** |
| ai / artificial intelligence | 8/36 | 26% | - | **Unlikely** |
| ally | 17/36 | 46% | - | **Likely YES** |
| auction | 30/36 | 79% | - | **Strong YES** |
| automation | 4/36 | 14% | - | **Unlikely** |
| carli | 4/36 | 14% | - | **Unlikely** |
| insurance | 6/36 | 19% | - | **Unlikely** |
| iran / middle east | 1/36 | 6% | - | **Unlikely** |
| market share | 32/36 | 86% | - | **Strong YES** |
| sebastian | 16/36 | 46% | - | **Likely YES** |
| tariff | 5/36 | 18% | - | **Unlikely** |
| title / registration | 18/36 | 49% | - | **Likely YES** |

---

## Domino's Pizza (DPZ)
**Upcoming event:** 2026-10-15

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ai / artificial intelligence | 8/63 | 14% | $0.29 | **Unlikely** |
| andrew gregory | 2/63 | 7% | $0.33 | **Unlikely** |
| closure | 55/63 | 84% | $0.63 | **Strong YES** |
| detroit | 2/63 | 5% | $0.78 | **Unlikely** |
| doordash | 7/63 | 14% | $0.53 | **Unlikely** |
| india | 35/63 | 56% | $0.45 | **Likely YES** |
| inflation | 30/63 | 47% | $0.49 | **Likely YES** |
| insurance | 25/63 | 40% | $0.28 | **Coin flip** |
| joe jordan | 1/63 | 5% | $0.96 | **Unlikely** |
| parmesan | 12/63 | 21% | $0.50 | **Unlikely** |
| same store | 7/63 | 13% | $0.98 | **Unlikely** |
| signature | 2/63 | 7% | $0.40 | **Unlikely** |
| stuffed crust | 5/63 | 11% | $0.65 | **Unlikely** |
| tailwind | 26/63 | 41% | $0.50 | **Coin flip** |
| tariff | 2/63 | 5% | $0.14 | **Unlikely** |
| world cup | 4/63 | 10% | $0.42 | **Unlikely** |

---

## General Mills (GIS)
**Upcoming event:** 2026-09-23

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| blue buffalo | 8/10 | 74% | $0.85 | **Strong YES** |
| brazil | 8/10 | 74% | $0.65 | **Strong YES** |
| certified color | 0/10 | 11% | $0.20 | **Unlikely** |
| cheerios | 10/10 | 88% | $0.84 | **Strong YES** |
| divestiture | 9/10 | 81% | $0.74 | **Strong YES** |
| glp 1 / ozempic | 0/10 | 11% | $0.33 | **Unlikely** |
| grands / croissants | 0/10 | 11% | $0.18 | **Unlikely** |
| headwind | 9/10 | 81% | $0.87 | **Strong YES** |
| humanization | 2/10 | 25% | $0.57 | **Unlikely** |
| inflation | 10/10 | 88% | $0.95 | **Strong YES** |
| iran / middle east | 8/10 | 74% | $0.56 | **Strong YES** |
| nielsen | 9/10 | 81% | $0.53 | **Strong YES** |
| progresso | 6/10 | 53% | $0.36 | **Likely YES** |
| protein | 8/10 | 67% | $0.95 | **Strong YES** |
| supply chain | 7/10 | 67% | $0.84 | **Strong YES** |
| tariff | 1/10 | 18% | $0.47 | **Unlikely** |
| totino | 7/10 | 60% | $0.77 | **Likely YES** |
| wilderness | 5/10 | 53% | $0.74 | **Likely YES** |

---

## Alphabet (GOOGL)
**Upcoming event:** 2026-10-29

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ai mode | 5/62 | 11% | $0.90 | **Unlikely** |
| antigravity | 2/62 | 7% | $0.81 | **Unlikely** |
| autonomous | 26/62 | 42% | $0.50 | **Coin flip** |
| chrome | 48/62 | 76% | $0.80 | **Strong YES** |
| codemender | 0/62 | 4% | $0.80 | **Unlikely** |
| gemini (3+ times) | 0/62 | 2% | $0.90 | **Unlikely** |
| geothermal | 1/62 | 4% | - | **Unlikely** |
| headwind | 41/62 | 66% | - | **Strong YES** |
| ironwood | 4/62 | 8% | - | **Unlikely** |
| nvidia | 13/62 | 23% | - | **Unlikely** |
| open source | 4/62 | 8% | - | **Unlikely** |
| privacy | 26/62 | 42% | $0.30 | **Coin flip** |
| recall / recalled | 12/62 | 22% | $0.44 | **Unlikely** |
| regulator / regulation / regulatory | 20/62 | 33% | $0.28 | **Coin flip** |
| search advertising / search ad | 41/62 | 66% | $0.58 | **Strong YES** |
| spacex | 0/62 | 4% | - | **Unlikely** |
| tailwind | 20/62 | 34% | $0.80 | **Coin flip** |
| wiz | 2/62 | 7% | - | **Unlikely** |
| youtube shorts | 18/62 | 31% | $0.30 | **Coin flip** |

---

## The Goldman Sachs Group (GS)
**Upcoming event:** 2026-10-13

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| buyback / buy back | 20/29 | 68% | $0.51 | **Strong YES** |
| capital solutions | 3/29 | 16% | - | **Unlikely** |
| industry ventures | 3/29 | 16% | $0.53 | **Unlikely** |
| innovator | 4/29 | 19% | - | **Unlikely** |
| iran / middle east | 4/29 | 19% | - | **Unlikely** |
| marcus | 20/29 | 65% | $0.23 | **Strong YES** |
| pipeline | 15/29 | 53% | - | **Likely YES** |
| private credit | 13/29 | 47% | - | **Likely YES** |
| recession | 8/29 | 29% | $0.38 | **Unlikely** |
| regulation | 9/29 | 34% | $0.75 | **Coin flip** |
| spacex | 0/29 | 7% | $0.71 | **Unlikely** |
| tailwind | 16/29 | 56% | - | **Likely YES** |
| tariff | 2/29 | 11% | - | **Unlikely** |
| uncertainty | 26/29 | 86% | $0.89 | **Strong YES** |

---

## Hims & Hers Health (HIMS)
**Upcoming event:** 2026-11-02

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| amazon | 5/22 | 25% | - | **Unlikely** |
| australia | 4/22 | 25% | - | **Unlikely** |
| canada / canadian | 6/22 | 32% | - | **Coin flip** |
| cancer | 4/22 | 21% | - | **Unlikely** |
| collaboration | 8/22 | 40% | - | **Coin flip** |
| eucalyptus | 2/22 | 17% | - | **Unlikely** |
| europe | 4/22 | 25% | - | **Unlikely** |
| fda | 7/22 | 36% | - | **Coin flip** |
| galen | 0/22 | 6% | - | **Unlikely** |
| lab testing | 7/22 | 36% | - | **Coin flip** |
| longevity | 8/22 | 40% | - | **Coin flip** |
| microdose / microdosing | 1/22 | 10% | - | **Unlikely** |
| peptide | 6/22 | 32% | - | **Coin flip** |
| perimenopause / menopause | 12/22 | 55% | - | **Likely YES** |
| regulation | 3/22 | 17% | - | **Unlikely** |
| testosterone | 8/22 | 40% | - | **Coin flip** |
| wearable | 5/22 | 28% | - | **Unlikely** |
| wegovy | 4/22 | 25% | - | **Unlikely** |
| zava | 4/22 | 21% | - | **Unlikely** |

---

## Intel (INTC)
**Upcoming event:** 2026-10-22

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| apple | 17/64 | 27% | - | **Unlikely** |
| arizona | 17/64 | 27% | $0.43 | **Unlikely** |
| clearwater forest | 11/64 | 20% | - | **Unlikely** |
| client computing | 23/64 | 37% | $0.40 | **Coin flip** |
| desktop | 46/64 | 70% | - | **Strong YES** |
| dividend | 49/64 | 74% | $0.13 | **Strong YES** |
| fortinet | 0/64 | 3% | - | **Unlikely** |
| foundry | 38/64 | 59% | $0.84 | **Likely YES** |
| government | 31/64 | 48% | $0.75 | **Likely YES** |
| mobileye | 36/64 | 55% | $0.60 | **Likely YES** |
| nvidia | 9/64 | 15% | $0.33 | **Unlikely** |
| panther lake / 18a | 19/64 | 31% | $0.93 | **Coin flip** |
| security | 35/64 | 55% | $0.66 | **Likely YES** |
| ultra 3 / ultra series 3 | 2/64 | 5% | - | **Unlikely** |

---

## Johnson & Johnson (JNJ)
**Upcoming event:** 2026-10-13

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| administration | 16/45 | 36% | $0.36 | **Coin flip** |
| ai / artificial intelligence | 7/45 | 19% | $0.48 | **Unlikely** |
| caplyta | 6/45 | 17% | $0.75 | **Unlikely** |
| china | 41/45 | 88% | - | **Strong YES** |
| darzalex faspro | 9/45 | 23% | $0.64 | **Unlikely** |
| firefly bio | 0/45 | 5% | - | **Unlikely** |
| gene therapy | 4/45 | 11% | $0.13 | **Unlikely** |
| halda therapeutics | 2/45 | 9% | $0.61 | **Unlikely** |
| litigation | 40/45 | 86% | $0.90 | **Strong YES** |
| nipocalimab / lupus | 18/45 | 40% | - | **Coin flip** |
| ottava | 19/45 | 44% | $0.42 | **Coin flip** |
| procedure | 43/45 | 92% | $0.42 | **Strong YES** |
| rybrevant | 17/45 | 40% | $0.14 | **Coin flip** |
| tariff | 7/45 | 19% | - | **Unlikely** |
| tecvayli | 15/45 | 35% | $0.14 | **Coin flip** |
| vaccine | 22/45 | 48% | $0.11 | **Likely YES** |

---

## JPMorgan Chase (JPM)
**Upcoming event:** 2026-10-13

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| apple | 12/45 | 29% | $0.33 | **Unlikely** |
| blockchain | 6/45 | 15% | - | **Unlikely** |
| buyback / buy back | 30/45 | 66% | - | **Strong YES** |
| clarity act | 0/45 | 3% | $0.15 | **Unlikely** |
| credit card | 30/45 | 66% | $0.68 | **Strong YES** |
| crypto / cryptocurrency / bitcoin | 1/45 | 5% | $0.89 | **Unlikely** |
| fintech | 13/45 | 31% | - | **Coin flip** |
| geopolitical | 11/45 | 25% | $0.37 | **Unlikely** |
| hike / hiked | 23/45 | 50% | $0.75 | **Likely YES** |
| hiring | 13/45 | 31% | $0.64 | **Coin flip** |
| inflation | 21/45 | 48% | - | **Likely YES** |
| m&a / merger | 37/45 | 80% | $0.75 | **Strong YES** |
| rate cut / cut rates | 14/45 | 32% | - | **Coin flip** |
| regulation | 20/45 | 46% | $0.89 | **Likely YES** |
| sapphire | 12/45 | 29% | $0.55 | **Unlikely** |
| tariff | 4/45 | 11% | $0.23 | **Unlikely** |
| trading | 40/45 | 86% | $0.40 | **Strong YES** |

---

## The Kroger Co. (KR)
**Upcoming event:** 2026-12-03

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ai / artificial intelligence | 11/24 | 44% | $0.69 | **Coin flip** |
| deflation | 7/24 | 34% | $0.70 | **Coin flip** |
| divestiture | 4/24 | 20% | $0.20 | **Unlikely** |
| giant eagle | 0/24 | 9% | $0.80 | **Unlikely** |
| glp 1 | 0/24 | 5% | - | **Unlikely** |
| inflation reduction act / ira | 3/24 | 19% | $0.51 | **Unlikely** |
| instacart | 8/24 | 37% | $0.70 | **Coin flip** |
| produce | 17/24 | 69% | $0.72 | **Strong YES** |
| shrink / theft | 21/24 | 83% | $0.77 | **Strong YES** |
| snap / food stamp | 11/24 | 48% | $0.67 | **Likely YES** |
| tariff | 4/24 | 23% | $0.36 | **Unlikely** |

---

## McDonald's (MCD)
**Upcoming event:** 2026-11-04

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| big arch | 8/64 | 14% | - | **Unlikely** |
| caesar | 0/64 | 2% | - | **Unlikely** |
| competition | 37/64 | 58% | - | **Likely YES** |
| delivery | 47/64 | 73% | - | **Strong YES** |
| dividend | 42/64 | 64% | - | **Strong YES** |
| doordash | 5/64 | 10% | - | **Unlikely** |
| happy meal | 18/64 | 30% | - | **Unlikely** |
| iran / middle east | 29/64 | 45% | - | **Coin flip** |
| loyalty | 37/64 | 58% | - | **Likely YES** |
| mccafé | 0/64 | 2% | - | **Unlikely** |
| mccrispy | 14/64 | 24% | - | **Unlikely** |
| mcvalue (3+ times) | 0/64 | 2% | - | **Unlikely** |
| monopoly | 17/64 | 27% | - | **Unlikely** |
| red bull | 2/64 | 6% | - | **Unlikely** |
| revenue | 30/64 | 46% | - | **Likely YES** |
| snack wrap | 9/64 | 15% | - | **Unlikely** |
| soccer / football | 2/64 | 5% | - | **Unlikely** |
| supply chain | 36/64 | 55% | - | **Likely YES** |
| tariff | 4/64 | 8% | - | **Unlikely** |
| world cup | 6/64 | 12% | - | **Unlikely** |

---

## Morgan Stanley (MS)
**Upcoming event:** 2026-10-14

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ai / artificial intelligence | 13/29 | 47% | $0.79 | **Likely YES** |
| basel | 14/29 | 47% | $0.49 | **Likely YES** |
| buyback / buy back | 22/29 | 71% | - | **Strong YES** |
| galaxy digital | 0/29 | 5% | $0.15 | **Unlikely** |
| investment grade | 13/29 | 47% | - | **Likely YES** |
| middle east / iran | 4/29 | 17% | $0.28 | **Unlikely** |
| oil | 3/29 | 14% | - | **Unlikely** |
| parametric | 22/29 | 74% | $0.59 | **Strong YES** |
| private credit | 16/29 | 53% | - | **Likely YES** |
| private market | 11/29 | 38% | $0.31 | **Coin flip** |
| recession | 8/29 | 29% | - | **Unlikely** |
| spacex | 0/29 | 5% | - | **Unlikely** |
| tailwind | 14/29 | 50% | $0.69 | **Likely YES** |
| tokenized / tokenization | 3/29 | 14% | - | **Unlikely** |
| zero hash | 2/29 | 11% | $0.28 | **Unlikely** |

---

## Nike (NKE)
**Upcoming event:** 2026-09-29

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| beaverton | 5/64 | 10% | $0.19 | **Unlikely** |
| converse | 55/64 | 84% | $0.75 | **Strong YES** |
| direct to consumer / dtc | 36/64 | 55% | $0.23 | **Likely YES** |
| dividend | 20/64 | 33% | $0.59 | **Coin flip** |
| investor day | 25/64 | 40% | $0.86 | **Coin flip** |
| retailer | 35/64 | 55% | $0.61 | **Likely YES** |
| sabrina | 12/64 | 20% | $0.38 | **Unlikely** |
| skims / nikeskims | 4/64 | 8% | $0.42 | **Unlikely** |
| supply chain | 57/64 | 87% | $0.89 | **Strong YES** |
| sustainable | 57/64 | 87% | $0.88 | **Strong YES** |
| tariff | 10/64 | 18% | $0.94 | **Unlikely** |

---

## NVIDIA (NVDA)
**Upcoming event:** 2026-11-18

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| automation | 14/63 | 23% | - | **Unlikely** |
| cosmos | 5/63 | 11% | - | **Unlikely** |
| dividend (2+ times) | 0/63 | 2% | - | **Unlikely** |
| domestic | 10/63 | 17% | - | **Unlikely** |
| dsx | 0/63 | 4% | - | **Unlikely** |
| gaming | 58/63 | 89% | - | **Strong YES** |
| h20 | 4/63 | 8% | - | **Unlikely** |
| hermes | 1/63 | 4% | - | **Unlikely** |
| humanoid | 5/63 | 10% | - | **Unlikely** |
| hyperscaler | 27/63 | 44% | - | **Coin flip** |
| isaac | 5/63 | 11% | - | **Unlikely** |
| omniverse | 21/63 | 35% | - | **Coin flip** |
| rent / renting | 8/63 | 15% | - | **Unlikely** |
| rubin (3+ times) | 0/63 | 2% | - | **Unlikely** |
| self driving | 0/63 | 2% | - | **Unlikely** |
| taiwan | 10/63 | 18% | - | **Unlikely** |
| tariff | 3/63 | 7% | - | **Unlikely** |
| trump | 1/63 | 4% | - | **Unlikely** |
| tsmc | 21/63 | 34% | - | **Coin flip** |

---

## PepsiCo (PEP)
**Upcoming event:** 2026-10-08

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| acquisition | 15/29 | 53% | $0.76 | **Likely YES** |
| affordability | 14/29 | 50% | - | **Likely YES** |
| artificial color | 3/29 | 14% | - | **Unlikely** |
| autonomous | 0/29 | 5% | $0.30 | **Unlikely** |
| away from home | 18/29 | 62% | $0.81 | **Strong YES** |
| bubly | 9/29 | 32% | - | **Coin flip** |
| celsius | 11/29 | 41% | $0.57 | **Coin flip** |
| china | 19/29 | 65% | - | **Strong YES** |
| fiber | 5/29 | 20% | $0.63 | **Unlikely** |
| food for tomorrow | 0/29 | 5% | - | **Unlikely** |
| glp 1 | 0/29 | 5% | - | **Unlikely** |
| prebiotic | 2/29 | 11% | $0.19 | **Unlikely** |
| protein | 8/29 | 31% | $0.42 | **Coin flip** |
| tariff | 3/29 | 16% | $0.55 | **Unlikely** |
| volume | 27/29 | 89% | $0.86 | **Strong YES** |
| world cup | 1/29 | 10% | $0.30 | **Unlikely** |

---

## The Progressive Corporation (PGR)
**Upcoming event:** 2026-11-03

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ai / artificial intelligence | 8/51 | 19% | - | **Unlikely** |
| bundle / bundling | 39/51 | 75% | - | **Strong YES** |
| buyback / buy back | 8/51 | 17% | - | **Unlikely** |
| catastrophe | 20/51 | 41% | - | **Coin flip** |
| hippo | 0/51 | 3% | - | **Unlikely** |
| homeowner | 40/51 | 77% | - | **Strong YES** |
| inflation | 29/51 | 57% | - | **Likely YES** |
| m&a / acquisition | 43/51 | 82% | - | **Strong YES** |
| open the house | 0/51 | 3% | - | **Unlikely** |
| reinsurance | 24/51 | 48% | - | **Likely YES** |
| rosella | 0/51 | 3% | - | **Unlikely** |
| snapshot | 43/51 | 82% | - | **Strong YES** |

---

## Palantir (PLTR)
**Upcoming event:** 2026-11-02

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| aipcon | 2/23 | 13% | - | **Unlikely** |
| anthropic / claude | 1/23 | 9% | - | **Unlikely** |
| commercial growth | 4/23 | 20% | - | **Unlikely** |
| gotham platform | 1/23 | 9% | - | **Unlikely** |
| government contract | 2/23 | 13% | - | **Unlikely** |
| healthcare | 18/23 | 72% | - | **Strong YES** |
| international | 21/23 | 86% | - | **Strong YES** |
| iran / iranian | 2/23 | 13% | - | **Unlikely** |
| israel / israeli | 7/23 | 31% | - | **Coin flip** |
| lethal | 7/23 | 31% | - | **Coin flip** |
| maven | 9/23 | 42% | - | **Coin flip** |
| nebius | 0/23 | 6% | - | **Unlikely** |
| nvidia | 0/23 | 9% | - | **Unlikely** |
| revenue guidance | 16/23 | 68% | - | **Strong YES** |
| slop | 1/23 | 13% | - | **Unlikely** |
| sovereign ai | 0/23 | 9% | - | **Unlikely** |
| titan | 10/23 | 42% | - | **Coin flip** |
| usda | 1/23 | 9% | - | **Unlikely** |
| warp speed | 10/23 | 42% | - | **Coin flip** |

---

## Paramount Skydance (PSKY)
**Upcoming event:** 2026-11-09

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| antitrust / ftc / doj | 1/21 | 10% | $0.55 | **Unlikely** |
| cnn | 1/21 | 10% | - | **Unlikely** |
| dutton ranch | 3/21 | 22% | - | **Unlikely** |
| hbo | 3/21 | 18% | $0.59 | **Unlikely** |
| investment grade | 2/21 | 14% | $0.60 | **Unlikely** |
| layoff / headcount | 6/21 | 30% | - | **Unlikely** |
| netflix | 10/21 | 49% | $0.42 | **Likely YES** |
| pluto tv | 16/21 | 70% | $0.35 | **Strong YES** |
| regulation / regulatory | 6/21 | 30% | $0.55 | **Unlikely** |
| subscriber | 21/21 | 93% | $0.80 | **Strong YES** |
| synergy | 1/21 | 14% | $0.25 | **Unlikely** |
| ufc | 4/21 | 26% | $0.75 | **Unlikely** |

---

## Sprouts Farmers Market (SFM)
**Upcoming event:** 2026-10-28

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| buddy brew | 0/25 | 5% | - | **Unlikely** |
| coffee (2+ times) | 0/25 | 5% | - | **Unlikely** |
| cyclospora / cyclosporiasis | 0/25 | 8% | - | **Unlikely** |
| delivery | 17/25 | 67% | - | **Strong YES** |
| e commerce | 0/25 | 5% | - | **Unlikely** |
| holiday | 14/25 | 53% | - | **Likely YES** |
| inflation | 20/25 | 77% | - | **Strong YES** |
| instacart | 17/25 | 67% | - | **Strong YES** |
| pasturebird / pasture bird | 0/25 | 8% | - | **Unlikely** |
| personalization | 14/25 | 56% | - | **Likely YES** |
| revenue | 5/25 | 22% | - | **Unlikely** |
| seed oil | 4/25 | 22% | - | **Unlikely** |
| self distribution (3+ times) | 0/25 | 5% | - | **Unlikely** |
| succession | 0/25 | 5% | - | **Unlikely** |
| wellness bowl (2+ times) | 0/25 | 5% | - | **Unlikely** |

---

## SpaceX (SPCX)
**Upcoming event:** 2026-11-04

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| anthropic / openai | - | - | $0.74 | **-** |
| artemis | - | - | - | **-** |
| china / chinese | - | - | $0.61 | **-** |
| colossus | - | - | $0.78 | **-** |
| combine / combining | - | - | $0.35 | **-** |
| cursor | - | - | $0.87 | **-** |
| data center | - | - | $0.80 | **-** |
| grok | - | - | $0.97 | **-** |
| iss / international space station | - | - | $0.25 | **-** |
| mars | - | - | $0.49 | **-** |
| moon | - | - | - | **-** |
| nasa | - | - | $0.45 | **-** |
| nvidia | - | - | $0.75 | **-** |
| starbase | - | - | - | **-** |
| starlink | - | - | $0.98 | **-** |
| starmind | - | - | $0.81 | **-** |
| starshield | - | - | - | **-** |
| starship | - | - | $0.97 | **-** |
| t mobile | - | - | - | **-** |
| tesla | - | - | $0.80 | **-** |
| trump | - | - | $0.15 | **-** |
| unlock / lock up | - | - | $0.70 | **-** |

---

## Constellation Brands (STZ)
**Upcoming event:** 2026-10-05

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| aluminum | 13/44 | 30% | $0.51 | **Coin flip** |
| depletion / depletions | 44/44 | 96% | $0.78 | **Strong YES** |
| dividend | 37/44 | 80% | $0.36 | **Strong YES** |
| especial | 41/44 | 90% | $0.68 | **Strong YES** |
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

## Tesla (TSLA)
**Upcoming event:** 2026-10-28

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| afford / affordable | 43/63 | 68% | - | **Strong YES** |
| china | 52/63 | 80% | - | **Strong YES** |
| competition | 14/63 | 24% | - | **Unlikely** |
| cybercab | 7/63 | 14% | $0.98 | **Unlikely** |
| cybertruck | 23/63 | 38% | $0.44 | **Coin flip** |
| gigafactory | 33/63 | 51% | - | **Likely YES** |
| grok (3+ times) | 0/63 | 2% | - | **Unlikely** |
| intel | 6/63 | 11% | $0.37 | **Unlikely** |
| iran / middle east | 0/63 | 2% | - | **Unlikely** |
| megapack 3 | 3/63 | 8% | $0.57 | **Unlikely** |
| merge / merger | 1/63 | 4% | $0.79 | **Unlikely** |
| miami | 1/63 | 4% | $0.32 | **Unlikely** |
| regulator / regulatory / regulation | 49/63 | 77% | $0.90 | **Strong YES** |
| roadster | 31/63 | 48% | $0.93 | **Likely YES** |
| robotaxi | 22/63 | 36% | $0.95 | **Coin flip** |
| safety monitor | 1/63 | 5% | - | **Unlikely** |
| samsung | 5/63 | 11% | $0.68 | **Unlikely** |
| semi | 33/63 | 53% | $0.93 | **Likely YES** |
| six seater / six seat | 0/63 | 2% | - | **Unlikely** |
| solar | 38/63 | 60% | $0.89 | **Strong YES** |
| spacex / xai | 19/63 | 32% | $0.90 | **Coin flip** |
| supercharger / super charger | 31/63 | 50% | $0.60 | **Likely YES** |
| tariff | 14/63 | 24% | - | **Unlikely** |
| terafab | 2/63 | 7% | $0.90 | **Unlikely** |
| waymo | 7/63 | 13% | $0.32 | **Unlikely** |

---

## United Airlines Holdings (UAL)
**Upcoming event:** 2026-10-14

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| a321xlr | 4/25 | 19% | $0.58 | **Unlikely** |
| american airlines | 3/25 | 16% | $0.13 | **Unlikely** |
| atc / air traffic control | 11/25 | 43% | $0.35 | **Coin flip** |
| chase | 10/25 | 43% | $0.58 | **Coin flip** |
| coastliner | 1/25 | 12% | $0.70 | **Unlikely** |
| crj450 | 0/25 | 5% | $0.41 | **Unlikely** |
| holiday | 10/25 | 40% | $0.53 | **Coin flip** |
| middle east | 8/25 | 36% | $0.72 | **Coin flip** |
| newark | 19/25 | 74% | $0.75 | **Strong YES** |
| nonstop / non stop | 9/25 | 36% | $0.26 | **Coin flip** |
| oil | 4/25 | 22% | $0.40 | **Unlikely** |
| relax row | 1/25 | 12% | $0.55 | **Unlikely** |
| starlink | 7/25 | 32% | $0.88 | **Coin flip** |
| tariff | 3/25 | 19% | $0.10 | **Unlikely** |
| weather | 16/25 | 60% | $0.54 | **Strong YES** |

---

## Wells Fargo & Company (WFC)
**Upcoming event:** 2026-10-13

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| advisor gateway | 0/29 | 7% | - | **Unlikely** |
| ai / artificial intelligence | 10/29 | 38% | - | **Coin flip** |
| basel 3 | 0/29 | 5% | $0.32 | **Unlikely** |
| buyback / buy back | 23/29 | 77% | - | **Strong YES** |
| consecutive | 26/29 | 86% | $0.88 | **Strong YES** |
| credit card | 29/29 | 95% | $0.51 | **Strong YES** |
| delinquency | 5/29 | 22% | - | **Unlikely** |
| headwind | 17/29 | 56% | $0.38 | **Likely YES** |
| inflation | 17/29 | 59% | - | **Likely YES** |
| iran / middle east | 1/29 | 8% | $0.35 | **Unlikely** |
| middle market | 26/29 | 83% | $0.59 | **Strong YES** |
| premier | 13/29 | 47% | $0.89 | **Likely YES** |
| private equity | 20/29 | 65% | - | **Strong YES** |
| severance | 13/29 | 44% | - | **Coin flip** |
| tariff | 3/29 | 16% | $0.55 | **Unlikely** |

---
