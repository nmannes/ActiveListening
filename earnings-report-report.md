# Earnings Report

Generated 2026-08-19 · 16 companies with upcoming word markets · 228 words

## Method

Targets are the words in currently open Kalshi earnings-mention markets (from the market caches). Word matching follows Kalshi's resolution rules (word boundaries, plural/possessive forms). Aliases that share a market slug are the same market (the cache splits a market word like "Gas / Gasoline / Fuel" into its pieces), so they render as one joined row.

- Aggregate transitions over all upcoming words: P(word said | said last call) = 2352/3059 = 76.9% vs P(said | not said last call) = 830/7234 = 11.5% (base rate 30.9%)
- Baseline P blends the aggregate transition rate with the word's own presence rate (Laplace-smoothed); per-word evidence dominates as call history grows
- Baseline P: from prior earnings call transcripts dated strictly before the event (`transcripts/{TICKER}/`; same-day excluded, so the answer can't leak in); '-' = no pre-event history
- Only markets whose event is today or later are listed — a past event means the market is resolved-by-information, not an opportunity
- Last YES: last traded price for the word's currently open market (Kalshi API, active markets only; the NO side is the pair complement and always sums to $1.00). A $0.00 last price is the listing default for markets with no trades at all (Kalshi's minimum trade is $0.01), so those count as unpriced ('-') and never appear as opportunities. '-' = no open market, no trades, or fetch failed
- Verdict tiers: Strong YES (P ≥ 60%), Likely YES (45–60%), Coin flip (30–45%), Unlikely (<30%)

## Opportunities (prior data vs market)

Sorted by gap descending — a positive gap means prior data says the word is more likely than the market prices it (buy YES); a negative gap means less likely (buy NO).

| Company | Word | Baseline P | Market YES | Gap |
|---|---|---|---|---|
| DKS | nike | 85% | $0.26 | +59 |
| ULTA | headwind | 72% | $0.32 | +40 |
| ULTA | store opening | 39% | $0.05 | +34 |
| ROST | texas | 72% | $0.41 | +31 |
| DE | weather | 67% | $0.46 | +21 |
| WMT | competition / competitor | 66% | $0.45 | +21 |
| URBN | holiday | 76% | $0.56 | +20 |
| MRVL | storage | 89% | $0.69 | +20 |
| ZM | enterprise | 92% | $0.75 | +17 |
| ULTA | tailwind | 43% | $0.28 | +15 |
| URBN | international / internationally | 71% | $0.56 | +15 |
| URBN | beauty | 56% | $0.43 | +13 |
| TGT | autonomous / automation | 31% | $0.19 | +12 |
| TGT | competition | 31% | $0.19 | +12 |
| ROST | home | 85% | $0.73 | +12 |
| WMT | snap / food stamp | 21% | $0.10 | +11 |
| CRWD | gen ai / generative ai | 33% | $0.23 | +10 |
| AAP | worldpac | 77% | $0.67 | +10 |
| NVDA | gaming | 90% | $0.81 | +9 |
| ULTA | holiday | 81% | $0.72 | +9 |
| TGT | snap / food stamp | 12% | $0.03 | +9 |
| ULTA | luxury | 68% | $0.60 | +8 |
| ROST | california | 85% | $0.78 | +7 |
| ULTA | traffic | 80% | $0.74 | +6 |
| URBN | supply chain | 53% | $0.47 | +6 |
| INTU | quickbooks online | 95% | $0.90 | +5 |
| CRWD | acquisition | 85% | $0.81 | +4 |
| FUTU | tailwind | 16% | $0.12 | +4 |
| TGT | inflation | 42% | $0.38 | +4 |
| ROST | packaway | 89% | $0.85 | +4 |
| INTU | mailchimp | 38% | $0.34 | +4 |
| BJ | gasoline | 89% | $0.86 | +3 |
| DE | oil / gas / gasoline | 61% | $0.58 | +3 |
| INTU | desktop | 95% | $0.93 | +2 |
| BJ | digital | 95% | $0.93 | +2 |
| BJ | general merchandise | 95% | $0.93 | +2 |
| BJ | curbside | 66% | $0.64 | +2 |
| ZM | zoom phone | 92% | $0.90 | +2 |
| BJ | renewal rate | 86% | $0.86 | +0 |
| INTU | investor day | 80% | $0.80 | +0 |
| WMT | prescription | 40% | $0.41 | -1 |
| WMT | automotive | 26% | $0.27 | -1 |
| CRWD | aws | 79% | $0.80 | -1 |
| BJ | own brand | 77% | $0.79 | -2 |
| ULTA | times square | 10% | $0.12 | -2 |
| DE | dividend | 61% | $0.63 | -2 |
| WMT | gas / gasoline / fuel | 89% | $0.92 | -3 |
| ROST | closeout | 76% | $0.79 | -3 |
| NVDA | gm / general motors | 8% | $0.11 | -3 |
| ZM | churn | 82% | $0.85 | -3 |
| DKS | ticket | 87% | $0.90 | -3 |
| BJ | fuel | 66% | $0.69 | -3 |
| DKS | world cup | 23% | $0.27 | -4 |
| DE | middle east / iran | 5% | $0.10 | -5 |
| ULTA | diamond | 44% | $0.50 | -6 |
| URBN | claude | 4% | $0.11 | -7 |
| URBN | doordash | 4% | $0.11 | -7 |
| URBN | gemini | 4% | $0.11 | -7 |
| NVDA | taiwan | 17% | $0.25 | -8 |
| CRWD | consolidation | 76% | $0.84 | -8 |
| MRVL | pipeline | 64% | $0.72 | -8 |
| ULTA | reward | 64% | $0.72 | -8 |
| TGT | beauty | 90% | $0.98 | -8 |
| DE | headwind | 81% | $0.90 | -9 |
| INTU | diy | 71% | $0.80 | -9 |
| BJ | diesel | 16% | $0.25 | -9 |
| ULTA | tariff | 23% | $0.32 | -9 |
| TGT | revenue | 51% | $0.61 | -10 |
| ZM | contact center | 82% | $0.93 | -11 |
| AAP | same store | 8% | $0.19 | -11 |
| ROST | northeast | 35% | $0.46 | -11 |
| NVDA | trump | 4% | $0.15 | -11 |
| DE | efficiency | 48% | $0.59 | -11 |
| AAP | lifo | 42% | $0.54 | -12 |
| TGT | remodel | 83% | $0.95 | -12 |
| DE | repair | 10% | $0.22 | -12 |
| INTU | restructuring | 14% | $0.27 | -13 |
| ROST | bankruptcy | 18% | $0.32 | -14 |
| BJ | egg | 36% | $0.50 | -14 |
| AAP | palantir | 4% | $0.19 | -15 |
| WMT | brick and mortar | 6% | $0.21 | -15 |
| CRWD | tailwind | 45% | $0.61 | -16 |
| NVDA | rent | 10% | $0.26 | -16 |
| NVDA | domestic | 17% | $0.34 | -17 |
| MRVL | aws / amazon | 19% | $0.36 | -17 |
| BJ | wellesley farms | 13% | $0.30 | -17 |
| MRVL | trainium | 5% | $0.22 | -17 |
| CRM | commerce | 68% | $0.85 | -17 |
| WMT | upper income | 4% | $0.22 | -18 |
| NVDA | tsmc | 34% | $0.53 | -19 |
| DKS | omnichannel | 55% | $0.74 | -19 |
| ULTA | tiktok | 52% | $0.71 | -19 |
| DE | tailwind | 56% | $0.76 | -20 |
| FUTU | fraud | 12% | $0.32 | -20 |
| INTU | intuit assist | 14% | $0.34 | -20 |
| FUTU | headwind | 9% | $0.30 | -21 |
| NVDA | automation | 23% | $0.45 | -22 |
| CRWD | china | 14% | $0.36 | -22 |
| FUTU | australia | 55% | $0.77 | -22 |
| NVDA | tariff | 7% | $0.29 | -22 |
| DKS | public land | 28% | $0.51 | -23 |
| DE | manufacturing | 42% | $0.65 | -23 |
| FUTU | agentic | 5% | $0.29 | -24 |
| FUTU | cftc | 5% | $0.29 | -24 |
| MRVL | india / indian | 19% | $0.44 | -25 |
| NVDA | h20 | 8% | $0.33 | -25 |
| DE | excavator | 26% | $0.51 | -25 |
| BJ | ask bev | 7% | $0.33 | -26 |
| NVDA | arizona | 5% | $0.31 | -26 |
| WMT | marketplace / market place | 72% | $0.98 | -26 |
| URBN | store opening | 46% | $0.73 | -27 |
| URBN | middle east | 12% | $0.39 | -27 |
| BJ | tally | 7% | $0.35 | -28 |
| NVDA | hermes | 4% | $0.32 | -28 |
| CRM | mulesoft | 51% | $0.80 | -29 |
| ROST | dress for less | 27% | $0.56 | -29 |
| WMT | drone | 9% | $0.38 | -29 |
| FUTU | tokenized / tokenization | 16% | $0.46 | -30 |
| ULTA | uncertainty | 56% | $0.86 | -30 |
| TGT | back to school | 63% | $0.94 | -31 |
| TGT | synthetic color | 10% | $0.41 | -31 |
| NVDA | omniverse | 34% | $0.66 | -32 |
| INTU | turbotax live | 64% | $0.96 | -32 |
| AAP | peak driving | 4% | $0.36 | -32 |
| FUTU | perp / perpetual | 9% | $0.42 | -33 |
| AAP | net promoter | 18% | $0.52 | -34 |
| URBN | headwind | 40% | $0.74 | -34 |
| DE | warranty | 32% | $0.66 | -34 |
| AAP | tariff | 29% | $0.64 | -35 |
| CRWD | germany | 5% | $0.40 | -35 |
| FUTU | expert | 5% | $0.41 | -36 |
| CRM | tableau | 44% | $0.80 | -36 |
| INTU | online payment | 58% | $0.95 | -37 |
| DKS | sport and culture | 13% | $0.50 | -37 |
| WMT | tariff | 56% | $0.94 | -38 |
| ULTA | iran / middle east | 27% | $0.65 | -38 |
| URBN | back to school | 29% | $0.67 | -38 |
| DE | ai / artificial intelligence | 10% | $0.48 | -38 |
| NVDA | dividend (2+ times) | 2% | $0.41 | -39 |
| ZM | workvivo | 45% | $0.85 | -40 |
| MRVL | polariton | 5% | $0.45 | -40 |
| FUTU | kalshi | 9% | $0.49 | -40 |
| MRVL | inference | 25% | $0.66 | -41 |
| MRVL | nvidia | 21% | $0.62 | -41 |
| DE | fertilizer | 24% | $0.65 | -41 |
| NVDA | cosmos | 10% | $0.51 | -41 |
| CRM | headless 360 | 4% | $0.45 | -41 |
| NVDA | talent | 10% | $0.53 | -43 |
| AAP | zebra | 7% | $0.50 | -43 |
| DKS | vertical brand | 41% | $0.85 | -44 |
| ULTA | ai / artificial intelligence | 35% | $0.79 | -44 |
| CRWD | shadow | 17% | $0.61 | -44 |
| NVDA | humanoid | 10% | $0.54 | -44 |
| FUTU | staking | 19% | $0.64 | -45 |
| TGT | circle 360 | 19% | $0.64 | -45 |
| DE | automation | 34% | $0.81 | -47 |
| TGT | tariff | 24% | $0.71 | -47 |
| WMT | rollback / roll back | 42% | $0.89 | -47 |
| ULTA | google / gemini | 18% | $0.66 | -48 |
| WMT | omnichannel | 43% | $0.91 | -48 |
| WMT | automation | 45% | $0.93 | -48 |
| ROST | new york | 27% | $0.75 | -48 |
| BJ | expresspay | 31% | $0.80 | -49 |
| DKS | house of sport | 40% | $0.90 | -50 |
| URBN | ieepa | 2% | $0.54 | -52 |
| NVDA | hyperscaler | 43% | $0.95 | -52 |
| ROST | beauty | 23% | $0.75 | -52 |
| MRVL | teralynx | 21% | $0.74 | -53 |
| CRWD | falcon flex | 39% | $0.92 | -53 |
| MRVL | prepayment | 7% | $0.61 | -54 |
| CRWD | xm cyber | 5% | $0.59 | -54 |
| ZM | ai companion | 39% | $0.93 | -54 |
| TGT | roundel | 33% | $0.88 | -55 |
| BJ | rotterdam | 13% | $0.69 | -56 |
| ZM | agentic | 23% | $0.80 | -57 |
| CRWD | claude | 14% | $0.71 | -57 |
| TGT | nintendo switch | 17% | $0.74 | -57 |
| CRWD | nvidia | 23% | $0.81 | -58 |
| MRVL | xconn | 7% | $0.67 | -60 |
| CRWD | openai | 11% | $0.71 | -60 |
| CRWD | ai detection | 14% | $0.75 | -61 |
| CRWD | cerebras | 5% | $0.66 | -61 |
| CRM | anthropic | 17% | $0.80 | -63 |
| ZM | system of action | 17% | $0.80 | -63 |
| INTU | pro tax | 27% | $0.90 | -63 |
| MRVL | photonic fabric | 7% | $0.71 | -64 |
| CRWD | continuous identity | 5% | $0.69 | -64 |
| MRVL | scale across | 9% | $0.74 | -65 |
| AAP | good part | 8% | $0.74 | -66 |
| FUTU | panthertrade | 9% | $0.75 | -66 |
| TGT | target plus | 26% | $0.94 | -68 |
| DE | tariff | 28% | $0.97 | -69 |
| NVDA | self driving | 2% | $0.71 | -69 |
| INTU | intuit enterprise suite | 16% | $0.85 | -69 |
| ULTA | rare beauty | 14% | $0.84 | -70 |
| CRM | slackbot | 7% | $0.80 | -73 |
| AAP | advance reward | 5% | $0.79 | -74 |
| AAP | ron | 5% | $0.79 | -74 |
| AAP | argos | 5% | $0.80 | -75 |
| CRM | informatica | 10% | $0.85 | -75 |
| URBN | tariff | 19% | $0.95 | -76 |
| CRWD | mythos | 8% | $0.84 | -76 |
| CRM | coworker | 4% | $0.80 | -76 |
| URBN | refund | 4% | $0.81 | -77 |
| MRVL | celestial | 7% | $0.85 | -78 |
| CRM | data 360 | 7% | $0.85 | -78 |
| CRM | token | 7% | $0.85 | -78 |
| CRM | mcp | 5% | $0.85 | -80 |
| WMT | sparky | 9% | $0.89 | -80 |
| CRM | agentic enterprise | 8% | $0.90 | -82 |
| DKS | foot locker | 13% | $0.96 | -83 |
| DKS | fast break | 6% | $0.90 | -84 |

## Advance Auto Parts (AAP)
**Upcoming event:** 2026-08-20

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| advance reward | 1/63 | 5% | $0.79 | **Unlikely** |
| argos | 1/63 | 5% | $0.80 | **Unlikely** |
| good part | 3/63 | 8% | $0.74 | **Unlikely** |
| lifo | 26/63 | 42% | $0.54 | **Coin flip** |
| net promoter | 10/63 | 18% | $0.52 | **Unlikely** |
| palantir | 1/63 | 4% | $0.19 | **Unlikely** |
| peak driving | 0/63 | 4% | $0.36 | **Unlikely** |
| ron | 1/63 | 5% | $0.79 | **Unlikely** |
| same store | 4/63 | 8% | $0.19 | **Unlikely** |
| tariff | 17/63 | 29% | $0.64 | **Unlikely** |
| worldpac | 49/63 | 77% | $0.67 | **Strong YES** |
| zebra | 2/63 | 7% | $0.50 | **Unlikely** |

---

## BJ's Wholesale Club Holdings (BJ)
**Upcoming event:** 2026-08-21

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ask bev | 1/30 | 7% | $0.33 | **Unlikely** |
| curbside | 20/30 | 66% | $0.64 | **Strong YES** |
| diesel | 3/30 | 16% | $0.25 | **Unlikely** |
| digital | 30/30 | 95% | $0.93 | **Strong YES** |
| egg | 10/30 | 36% | $0.50 | **Coin flip** |
| expresspay | 8/30 | 31% | $0.80 | **Coin flip** |
| fuel | 20/30 | 66% | $0.69 | **Strong YES** |
| gasoline | 28/30 | 89% | $0.86 | **Strong YES** |
| general merchandise | 30/30 | 95% | $0.93 | **Strong YES** |
| own brand | 24/30 | 77% | $0.79 | **Strong YES** |
| renewal rate | 28/30 | 86% | $0.86 | **Strong YES** |
| rotterdam | 2/30 | 13% | $0.69 | **Unlikely** |
| tally | 1/30 | 7% | $0.35 | **Unlikely** |
| wellesley farms | 3/30 | 13% | $0.30 | **Unlikely** |

---

## Salesforce (CRM)
**Upcoming event:** 2026-08-26

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| agentic enterprise | 3/63 | 8% | $0.90 | **Unlikely** |
| anthropic | 9/63 | 17% | $0.80 | **Unlikely** |
| commerce | 43/63 | 68% | $0.85 | **Strong YES** |
| coworker | 0/63 | 4% | $0.80 | **Unlikely** |
| customer zero | 7/63 | 14% | - | **Unlikely** |
| data 360 | 2/63 | 7% | $0.85 | **Unlikely** |
| headless 360 | 0/63 | 4% | $0.45 | **Unlikely** |
| informatica | 4/63 | 10% | $0.85 | **Unlikely** |
| mcp | 1/63 | 5% | $0.85 | **Unlikely** |
| mulesoft | 32/63 | 51% | $0.80 | **Likely YES** |
| openai | 8/63 | 15% | - | **Unlikely** |
| slackbot | 2/63 | 7% | $0.80 | **Unlikely** |
| tableau | 27/63 | 44% | $0.80 | **Coin flip** |
| token | 2/63 | 7% | $0.85 | **Unlikely** |

---

## CrowdStrike (CRWD)
**Upcoming event:** 2026-08-26

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| acquisition | 25/28 | 85% | $0.81 | **Strong YES** |
| ai detection | 2/28 | 14% | $0.75 | **Unlikely** |
| aws | 23/28 | 79% | $0.80 | **Strong YES** |
| cerebras | 0/28 | 5% | $0.66 | **Unlikely** |
| china | 3/28 | 14% | $0.36 | **Unlikely** |
| claude | 2/28 | 14% | $0.71 | **Unlikely** |
| consolidation | 22/28 | 76% | $0.84 | **Strong YES** |
| continuous identity | 0/28 | 5% | $0.69 | **Unlikely** |
| falcon flex | 10/28 | 39% | $0.92 | **Coin flip** |
| gen ai / generative ai | 9/28 | 33% | $0.23 | **Coin flip** |
| germany | 0/28 | 5% | $0.40 | **Unlikely** |
| mythos | 0/28 | 8% | $0.84 | **Unlikely** |
| nvidia | 5/28 | 23% | $0.81 | **Unlikely** |
| openai | 1/28 | 11% | $0.71 | **Unlikely** |
| shadow | 3/28 | 17% | $0.61 | **Unlikely** |
| tailwind | 12/28 | 45% | $0.61 | **Coin flip** |
| xm cyber | 0/28 | 5% | $0.59 | **Unlikely** |

---

## Deere & Company (DE)
**Upcoming event:** 2026-08-20

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ai / artificial intelligence | 5/64 | 10% | $0.48 | **Unlikely** |
| automation | 21/64 | 34% | $0.81 | **Coin flip** |
| dividend | 39/64 | 61% | $0.63 | **Strong YES** |
| efficiency | 31/64 | 48% | $0.59 | **Likely YES** |
| excavator | 15/64 | 26% | $0.51 | **Unlikely** |
| fertilizer | 14/64 | 24% | $0.65 | **Unlikely** |
| headwind | 53/64 | 81% | $0.90 | **Strong YES** |
| manufacturing | 26/64 | 42% | $0.65 | **Coin flip** |
| middle east / iran | 1/64 | 5% | $0.10 | **Unlikely** |
| oil / gas / gasoline | 39/64 | 61% | $0.58 | **Strong YES** |
| repair | 5/64 | 10% | $0.22 | **Unlikely** |
| tailwind | 36/64 | 56% | $0.76 | **Likely YES** |
| tariff | 17/64 | 28% | $0.97 | **Unlikely** |
| warranty | 20/64 | 32% | $0.66 | **Coin flip** |
| weather | 44/64 | 67% | $0.46 | **Strong YES** |

---

## DICK'S Sporting Goods (DKS)
**Upcoming event:** 2026-08-25

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| fast break | 1/55 | 6% | $0.90 | **Unlikely** |
| foot locker | 5/55 | 13% | $0.96 | **Unlikely** |
| going going gone | 0/55 | 3% | - | **Unlikely** |
| golf galaxy | 44/55 | 79% | - | **Strong YES** |
| house of sport | 21/55 | 40% | $0.90 | **Coin flip** |
| nike | 48/55 | 85% | $0.26 | **Strong YES** |
| omnichannel | 30/55 | 55% | $0.74 | **Likely YES** |
| public land | 15/55 | 28% | $0.51 | **Unlikely** |
| retail media | 3/55 | 8% | - | **Unlikely** |
| sport and culture | 5/55 | 13% | $0.50 | **Unlikely** |
| ticket | 49/55 | 87% | $0.90 | **Strong YES** |
| vertical brand | 22/55 | 41% | $0.85 | **Coin flip** |
| world cup | 11/55 | 23% | $0.27 | **Unlikely** |

---

## Futu Holdings (FUTU)
**Upcoming event:** 2026-08-20

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| agentic | 0/24 | 5% | $0.29 | **Unlikely** |
| australia | 13/24 | 55% | $0.77 | **Likely YES** |
| cftc | 0/24 | 5% | $0.29 | **Unlikely** |
| expert | 0/24 | 5% | $0.41 | **Unlikely** |
| fraud | 1/24 | 12% | $0.32 | **Unlikely** |
| headwind | 1/24 | 9% | $0.30 | **Unlikely** |
| kalshi | 0/24 | 9% | $0.49 | **Unlikely** |
| panthertrade | 0/24 | 9% | $0.75 | **Unlikely** |
| perp / perpetual | 0/24 | 9% | $0.42 | **Unlikely** |
| staking | 3/24 | 19% | $0.64 | **Unlikely** |
| tailwind | 3/24 | 16% | $0.12 | **Unlikely** |
| tokenized / tokenization | 2/24 | 16% | $0.46 | **Unlikely** |

---

## Intuit (INTU)
**Upcoming event:** 2026-08-25

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| agentic | 5/50 | 12% | - | **Unlikely** |
| arpu | 19/50 | 40% | - | **Coin flip** |
| desktop | 49/50 | 95% | $0.93 | **Strong YES** |
| diy | 36/50 | 71% | $0.80 | **Strong YES** |
| intuit assist | 6/50 | 14% | $0.34 | **Unlikely** |
| intuit enterprise suite | 6/50 | 16% | $0.85 | **Unlikely** |
| investor day | 42/50 | 80% | $0.80 | **Strong YES** |
| mailchimp | 18/50 | 38% | $0.34 | **Coin flip** |
| online payment | 29/50 | 58% | $0.95 | **Likely YES** |
| pro tax | 12/50 | 27% | $0.90 | **Unlikely** |
| quickbooks advanced | 17/50 | 36% | - | **Coin flip** |
| quickbooks online | 49/50 | 95% | $0.90 | **Strong YES** |
| restructuring | 5/50 | 14% | $0.27 | **Unlikely** |
| turbotax live | 32/50 | 64% | $0.96 | **Strong YES** |

---

## Marvell Technology (MRVL)
**Upcoming event:** 2026-08-27

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| aws / amazon | 8/45 | 19% | $0.36 | **Unlikely** |
| celestial | 1/45 | 7% | $0.85 | **Unlikely** |
| india / indian | 8/45 | 19% | $0.44 | **Unlikely** |
| inference | 10/45 | 25% | $0.66 | **Unlikely** |
| nvidia | 8/45 | 21% | $0.62 | **Unlikely** |
| photonic fabric | 1/45 | 7% | $0.71 | **Unlikely** |
| pipeline | 29/45 | 64% | $0.72 | **Strong YES** |
| polariton | 0/45 | 5% | $0.45 | **Unlikely** |
| prepayment | 1/45 | 7% | $0.61 | **Unlikely** |
| scale across | 3/45 | 9% | $0.74 | **Unlikely** |
| storage | 42/45 | 89% | $0.69 | **Strong YES** |
| teralynx | 9/45 | 21% | $0.74 | **Unlikely** |
| trainium | 1/45 | 5% | $0.22 | **Unlikely** |
| xconn | 1/45 | 7% | $0.67 | **Unlikely** |

---

## NVIDIA (NVDA)
**Upcoming event:** 2026-08-26

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| arizona | 2/62 | 5% | $0.31 | **Unlikely** |
| automation | 14/62 | 23% | $0.45 | **Unlikely** |
| cosmos | 5/62 | 10% | $0.51 | **Unlikely** |
| dividend (2+ times) | 0/62 | 2% | $0.41 | **Unlikely** |
| domestic | 10/62 | 17% | $0.34 | **Unlikely** |
| gaming | 57/62 | 90% | $0.81 | **Strong YES** |
| gm / general motors | 4/62 | 8% | $0.11 | **Unlikely** |
| h20 | 4/62 | 8% | $0.33 | **Unlikely** |
| hermes | 0/62 | 4% | $0.32 | **Unlikely** |
| humanoid | 4/62 | 10% | $0.54 | **Unlikely** |
| hyperscaler | 26/62 | 43% | $0.95 | **Coin flip** |
| omniverse | 21/62 | 34% | $0.66 | **Coin flip** |
| rent | 4/62 | 10% | $0.26 | **Unlikely** |
| self driving | 0/62 | 2% | $0.71 | **Unlikely** |
| taiwan | 10/62 | 17% | $0.25 | **Unlikely** |
| talent | 5/62 | 10% | $0.53 | **Unlikely** |
| tariff | 3/62 | 7% | $0.29 | **Unlikely** |
| trump | 1/62 | 4% | $0.15 | **Unlikely** |
| tsmc | 21/62 | 34% | $0.53 | **Coin flip** |

---

## Ross Stores (ROST)
**Upcoming event:** 2026-08-20

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| bankruptcy | 2/20 | 18% | $0.32 | **Unlikely** |
| beauty | 3/20 | 23% | $0.75 | **Unlikely** |
| california | 18/20 | 85% | $0.78 | **Strong YES** |
| closeout | 16/20 | 76% | $0.79 | **Strong YES** |
| dress for less | 5/20 | 27% | $0.56 | **Unlikely** |
| flywheel | 1/20 | 14% | - | **Unlikely** |
| home | 18/20 | 85% | $0.73 | **Strong YES** |
| korean | 0/20 | 10% | - | **Unlikely** |
| new york | 4/20 | 27% | $0.75 | **Unlikely** |
| northeast | 6/20 | 35% | $0.46 | **Coin flip** |
| off price | 3/20 | 23% | - | **Unlikely** |
| packaway | 19/20 | 89% | $0.85 | **Strong YES** |
| self checkout | 0/20 | 6% | - | **Unlikely** |
| texas | 16/20 | 72% | $0.41 | **Strong YES** |

---

## Target (TGT)
**Upcoming event:** 2026-08-19

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| autonomous / automation | 16/52 | 31% | $0.19 | **Coin flip** |
| back to school | 33/52 | 63% | $0.94 | **Strong YES** |
| beauty | 48/52 | 90% | $0.98 | **Strong YES** |
| circle 360 | 9/52 | 19% | $0.64 | **Unlikely** |
| competition | 16/52 | 31% | $0.19 | **Coin flip** |
| inflation | 22/52 | 42% | $0.38 | **Coin flip** |
| nintendo switch | 7/52 | 17% | $0.74 | **Unlikely** |
| remodel | 44/52 | 83% | $0.95 | **Strong YES** |
| revenue | 26/52 | 51% | $0.61 | **Likely YES** |
| roundel | 16/52 | 33% | $0.88 | **Coin flip** |
| snap / food stamp | 5/52 | 12% | $0.03 | **Unlikely** |
| synthetic color | 3/52 | 10% | $0.41 | **Unlikely** |
| target plus | 12/52 | 26% | $0.94 | **Unlikely** |
| tariff | 11/52 | 24% | $0.71 | **Unlikely** |

---

## Ulta Beauty (ULTA)
**Upcoming event:** 2026-08-27

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ai / artificial intelligence | 6/20 | 35% | $0.79 | **Coin flip** |
| diamond | 9/20 | 44% | $0.50 | **Coin flip** |
| google / gemini | 2/20 | 18% | $0.66 | **Unlikely** |
| headwind | 16/20 | 72% | $0.32 | **Strong YES** |
| holiday | 18/20 | 81% | $0.72 | **Strong YES** |
| iran / middle east | 4/20 | 27% | $0.65 | **Unlikely** |
| luxury | 14/20 | 68% | $0.60 | **Strong YES** |
| rare beauty | 1/20 | 14% | $0.84 | **Unlikely** |
| reward | 13/20 | 64% | $0.72 | **Strong YES** |
| store opening | 8/20 | 39% | $0.05 | **Coin flip** |
| tailwind | 8/20 | 43% | $0.28 | **Coin flip** |
| tariff | 4/20 | 23% | $0.32 | **Unlikely** |
| tiktok | 10/20 | 52% | $0.71 | **Likely YES** |
| times square | 0/20 | 10% | $0.12 | **Unlikely** |
| traffic | 17/20 | 80% | $0.74 | **Strong YES** |
| uncertainty | 11/20 | 56% | $0.86 | **Likely YES** |

---

## Urban Outfitters (URBN)
**Upcoming event:** 2026-08-26

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| back to school | 16/57 | 29% | $0.67 | **Unlikely** |
| beauty | 32/57 | 56% | $0.43 | **Likely YES** |
| claude | 0/57 | 4% | $0.11 | **Unlikely** |
| doordash | 0/57 | 4% | $0.11 | **Unlikely** |
| gemini | 0/57 | 4% | $0.11 | **Unlikely** |
| headwind | 22/57 | 40% | $0.74 | **Coin flip** |
| holiday | 45/57 | 76% | $0.56 | **Strong YES** |
| ieepa | 0/57 | 2% | $0.54 | **Unlikely** |
| international / internationally | 41/57 | 71% | $0.56 | **Strong YES** |
| middle east | 5/57 | 12% | $0.39 | **Unlikely** |
| refund | 0/57 | 4% | $0.81 | **Unlikely** |
| store opening | 26/57 | 46% | $0.73 | **Likely YES** |
| supply chain | 31/57 | 53% | $0.47 | **Likely YES** |
| tariff | 9/57 | 19% | $0.95 | **Unlikely** |

---

## Walmart (WMT)
**Upcoming event:** 2026-08-20

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| automation | 26/59 | 45% | $0.93 | **Likely YES** |
| automotive | 15/59 | 26% | $0.27 | **Unlikely** |
| brick and mortar | 2/59 | 6% | $0.21 | **Unlikely** |
| competition / competitor | 39/59 | 66% | $0.45 | **Strong YES** |
| drone | 3/59 | 9% | $0.38 | **Unlikely** |
| gas / gasoline / fuel | 54/59 | 89% | $0.92 | **Strong YES** |
| marketplace / market place | 43/59 | 72% | $0.98 | **Strong YES** |
| omnichannel | 25/59 | 43% | $0.91 | **Coin flip** |
| prescription | 23/59 | 40% | $0.41 | **Coin flip** |
| rollback / roll back | 24/59 | 42% | $0.89 | **Coin flip** |
| snap / food stamp | 12/59 | 21% | $0.10 | **Unlikely** |
| sparky | 3/59 | 9% | $0.89 | **Unlikely** |
| tariff | 33/59 | 56% | $0.94 | **Likely YES** |
| upper income | 1/59 | 4% | $0.22 | **Unlikely** |

---

## Zoom Video (ZM)
**Upcoming event:** 2026-08-25

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| agentic | 5/28 | 23% | $0.80 | **Unlikely** |
| ai companion | 10/28 | 39% | $0.93 | **Coin flip** |
| churn | 24/28 | 82% | $0.85 | **Strong YES** |
| contact center | 24/28 | 82% | $0.93 | **Strong YES** |
| enterprise | 27/28 | 92% | $0.75 | **Strong YES** |
| federal | 13/28 | 45% | - | **Likely YES** |
| my note | 0/28 | 8% | - | **Unlikely** |
| scribe | 0/28 | 8% | - | **Unlikely** |
| system of action | 3/28 | 17% | $0.80 | **Unlikely** |
| workvivo | 12/28 | 45% | $0.85 | **Coin flip** |
| zoom doc | 3/28 | 14% | - | **Unlikely** |
| zoom phone | 27/28 | 92% | $0.90 | **Strong YES** |

---
