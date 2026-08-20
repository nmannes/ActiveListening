# Earnings Report

Generated 2026-08-20 · 13 companies with upcoming word markets · 193 words

## Method

Targets are the words in currently open Kalshi earnings-mention markets (from the market caches). Word matching follows Kalshi's resolution rules (word boundaries, plural/possessive forms). Aliases that share a market slug are the same market (the cache splits a market word like "Gas / Gasoline / Fuel" into its pieces), so they render as one joined row.

- Aggregate transitions over all upcoming words: P(word said | said last call) = 1893/2476 = 76.5% vs P(said | not said last call) = 677/5559 = 12.2% (base rate 32.0%)
- Baseline P blends the aggregate transition rate with the word's own presence rate (Laplace-smoothed); per-word evidence dominates as call history grows
- Baseline P: from prior earnings call transcripts dated strictly before the event (`transcripts/{TICKER}/`; same-day excluded, so the answer can't leak in); '-' = no pre-event history
- Only markets whose event is today or later are listed — a past event means the market is resolved-by-information, not an opportunity
- Last YES: last traded price for the word's currently open market (Kalshi API, active markets only; the NO side is the pair complement and always sums to $1.00). A $0.00 last price is the listing default for markets with no trades at all (Kalshi's minimum trade is $0.01), so those count as unpriced ('-') and never appear as opportunities. '-' = no open market, no trades, or fetch failed
- Verdict tiers: Strong YES (P ≥ 60%), Likely YES (45–60%), Coin flip (30–45%), Unlikely (<30%)

## Opportunities (prior data vs market)

Sorted by gap descending — a positive gap means prior data says the word is more likely than the market prices it (buy YES); a negative gap means less likely (buy NO).

| Company | Word | Baseline P | Market YES | Gap |
|---|---|---|---|---|
| DE | weather | 67% | $0.01 | +66 |
| DE | oil / gas / gasoline | 61% | $0.01 | +60 |
| DE | dividend | 61% | $0.10 | +51 |
| DELL | headwind | 72% | $0.30 | +42 |
| ULTA | headwind | 72% | $0.32 | +40 |
| ROST | texas | 72% | $0.35 | +37 |
| DELL | tailwind | 60% | $0.32 | +28 |
| ZM | federal | 45% | $0.19 | +26 |
| DE | manufacturing | 42% | $0.20 | +22 |
| URBN | holiday | 76% | $0.56 | +20 |
| MRVL | storage | 89% | $0.69 | +20 |
| INTU | arpu | 40% | $0.21 | +19 |
| DELL | inflation / inflationary | 64% | $0.46 | +18 |
| DE | warranty | 32% | $0.15 | +17 |
| ULTA | tailwind | 43% | $0.28 | +15 |
| DELL | china | 31% | $0.16 | +15 |
| URBN | international / internationally | 71% | $0.56 | +15 |
| DKS | public land | 28% | $0.14 | +14 |
| URBN | supply chain | 53% | $0.40 | +13 |
| URBN | beauty | 56% | $0.45 | +11 |
| CRWD | gen ai / generative ai | 33% | $0.23 | +10 |
| ROST | california | 85% | $0.75 | +10 |
| ROST | home | 85% | $0.75 | +10 |
| NVDA | gaming | 90% | $0.81 | +9 |
| ULTA | holiday | 81% | $0.72 | +9 |
| DE | repair | 10% | $0.01 | +9 |
| ULTA | traffic | 80% | $0.73 | +7 |
| INTU | quickbooks advanced | 36% | $0.29 | +7 |
| DKS | nike | 85% | $0.79 | +6 |
| ROST | dress for less | 27% | $0.21 | +6 |
| INTU | diy | 71% | $0.65 | +6 |
| INTU | desktop | 95% | $0.90 | +5 |
| INTU | quickbooks online | 95% | $0.90 | +5 |
| DELL | data center | 89% | $0.84 | +5 |
| BJ | curbside | 66% | $0.61 | +5 |
| CRWD | acquisition | 85% | $0.81 | +4 |
| DE | automation | 34% | $0.30 | +4 |
| DE | middle east / iran | 5% | $0.01 | +4 |
| BJ | digital | 95% | $0.92 | +3 |
| BJ | renewal rate | 86% | $0.84 | +2 |
| DELL | confidence | 68% | $0.66 | +2 |
| ZM | zoom phone | 92% | $0.90 | +2 |
| ULTA | store opening | 39% | $0.38 | +1 |
| BJ | general merchandise | 95% | $0.94 | +1 |
| BJ | gasoline | 89% | $0.89 | +0 |
| CRWD | aws | 79% | $0.80 | -1 |
| ULTA | times square | 10% | $0.12 | -2 |
| ROST | closeout | 76% | $0.79 | -3 |
| NVDA | gm / general motors | 8% | $0.11 | -3 |
| ROST | korean | 10% | $0.13 | -3 |
| ZM | churn | 82% | $0.87 | -5 |
| ZM | enterprise | 92% | $0.97 | -5 |
| INTU | investor day | 80% | $0.86 | -6 |
| DELL | trump | 6% | $0.12 | -6 |
| DELL | powerscale | 68% | $0.74 | -6 |
| ROST | packaway | 89% | $0.95 | -6 |
| ROST | beauty | 23% | $0.29 | -6 |
| URBN | claude | 4% | $0.11 | -7 |
| URBN | doordash | 4% | $0.11 | -7 |
| URBN | gemini | 4% | $0.11 | -7 |
| BJ | own brand | 77% | $0.85 | -8 |
| NVDA | taiwan | 17% | $0.25 | -8 |
| CRWD | consolidation | 76% | $0.84 | -8 |
| DKS | ticket | 87% | $0.95 | -8 |
| MRVL | pipeline | 64% | $0.72 | -8 |
| ULTA | reward | 64% | $0.72 | -8 |
| BJ | diesel | 16% | $0.24 | -8 |
| BJ | wellesley farms | 13% | $0.22 | -9 |
| ULTA | tariff | 23% | $0.32 | -9 |
| BJ | egg | 36% | $0.46 | -10 |
| INTU | intuit assist | 14% | $0.24 | -10 |
| ZM | contact center | 82% | $0.93 | -11 |
| NVDA | trump | 4% | $0.15 | -11 |
| INTU | turbotax live | 64% | $0.75 | -11 |
| ULTA | luxury | 68% | $0.80 | -12 |
| ZM | zoom doc | 14% | $0.26 | -12 |
| ROST | bankruptcy | 18% | $0.31 | -13 |
| BJ | fuel | 66% | $0.80 | -14 |
| DELL | mistral | 14% | $0.30 | -16 |
| CRWD | tailwind | 45% | $0.61 | -16 |
| CRM | commerce | 68% | $0.84 | -16 |
| NVDA | rent | 10% | $0.26 | -16 |
| DKS | going going gone | 3% | $0.19 | -16 |
| MRVL | aws / amazon | 19% | $0.36 | -17 |
| MRVL | india / indian | 19% | $0.36 | -17 |
| MRVL | trainium | 5% | $0.22 | -17 |
| BJ | tally | 7% | $0.25 | -18 |
| DE | headwind | 81% | $0.99 | -18 |
| NVDA | h20 | 8% | $0.26 | -18 |
| DELL | texas | 10% | $0.29 | -19 |
| CRWD | germany | 5% | $0.24 | -19 |
| ULTA | tiktok | 52% | $0.71 | -19 |
| BJ | ask bev | 7% | $0.27 | -20 |
| NVDA | automation | 23% | $0.44 | -21 |
| DELL | secure ai alliance | 6% | $0.27 | -21 |
| NVDA | tsmc | 34% | $0.55 | -21 |
| CRWD | china | 14% | $0.36 | -22 |
| DKS | retail media | 8% | $0.31 | -23 |
| URBN | middle east | 12% | $0.37 | -25 |
| URBN | headwind | 40% | $0.65 | -25 |
| NVDA | tariff | 7% | $0.32 | -25 |
| NVDA | arizona | 5% | $0.31 | -26 |
| NVDA | hermes | 4% | $0.30 | -26 |
| URBN | store opening | 46% | $0.73 | -27 |
| ZM | scribe | 8% | $0.35 | -27 |
| DELL | poweredge / power edge | 47% | $0.76 | -29 |
| DELL | dividend (3+ times) | 6% | $0.35 | -29 |
| DKS | omnichannel | 55% | $0.84 | -29 |
| NVDA | dividend (2+ times) | 2% | $0.32 | -30 |
| ULTA | uncertainty | 56% | $0.86 | -30 |
| CRM | mulesoft | 51% | $0.82 | -31 |
| NVDA | omniverse | 34% | $0.66 | -32 |
| INTU | online payment | 58% | $0.91 | -33 |
| ULTA | iran / middle east | 27% | $0.60 | -33 |
| MRVL | teralynx | 21% | $0.55 | -34 |
| ROST | flywheel | 14% | $0.48 | -34 |
| NVDA | talent | 10% | $0.46 | -36 |
| DELL | nvidia | 47% | $0.84 | -37 |
| ZM | workvivo | 45% | $0.82 | -37 |
| ULTA | diamond | 44% | $0.81 | -37 |
| MRVL | polariton | 5% | $0.44 | -39 |
| URBN | back to school | 29% | $0.68 | -39 |
| MRVL | inference | 25% | $0.66 | -41 |
| MRVL | nvidia | 21% | $0.62 | -41 |
| NVDA | cosmos | 10% | $0.51 | -41 |
| CRM | tableau | 44% | $0.85 | -41 |
| NVDA | domestic | 17% | $0.59 | -42 |
| DE | tailwind | 56% | $0.99 | -43 |
| DELL | lightning | 31% | $0.74 | -43 |
| ROST | northeast | 35% | $0.79 | -44 |
| CRWD | shadow | 17% | $0.61 | -44 |
| NVDA | humanoid | 10% | $0.58 | -48 |
| DKS | vertical brand | 41% | $0.90 | -49 |
| DELL | ai factory | 27% | $0.76 | -49 |
| CRM | headless 360 | 4% | $0.53 | -49 |
| ULTA | ai / artificial intelligence | 35% | $0.86 | -51 |
| DE | efficiency | 48% | $0.99 | -51 |
| ZM | ai companion | 39% | $0.91 | -52 |
| DELL | agentic | 23% | $0.75 | -52 |
| BJ | expresspay | 31% | $0.83 | -52 |
| CRWD | nvidia | 23% | $0.76 | -53 |
| ZM | agentic | 23% | $0.76 | -53 |
| CRWD | falcon flex | 39% | $0.92 | -53 |
| BJ | rotterdam | 13% | $0.67 | -54 |
| INTU | pro tax | 27% | $0.81 | -54 |
| DKS | house of sport | 40% | $0.95 | -55 |
| ULTA | google / gemini | 18% | $0.74 | -56 |
| NVDA | hyperscaler | 43% | $0.99 | -56 |
| ROST | new york | 27% | $0.83 | -56 |
| INTU | mailchimp | 38% | $0.94 | -56 |
| INTU | restructuring | 14% | $0.70 | -56 |
| CRWD | claude | 14% | $0.71 | -57 |
| CRM | agentic enterprise | 8% | $0.66 | -58 |
| URBN | ieepa | 2% | $0.61 | -59 |
| MRVL | prepayment | 7% | $0.66 | -59 |
| MRVL | xconn | 7% | $0.67 | -60 |
| CRWD | openai | 11% | $0.71 | -60 |
| CRWD | ai detection | 14% | $0.75 | -61 |
| CRWD | cerebras | 5% | $0.66 | -61 |
| CRM | customer zero | 14% | $0.76 | -62 |
| CRM | anthropic | 17% | $0.80 | -63 |
| CRWD | xm cyber | 5% | $0.68 | -63 |
| MRVL | photonic fabric | 7% | $0.71 | -64 |
| CRWD | continuous identity | 5% | $0.69 | -64 |
| MRVL | scale across | 9% | $0.74 | -65 |
| DKS | world cup | 23% | $0.90 | -67 |
| ZM | system of action | 17% | $0.85 | -68 |
| NVDA | self driving | 2% | $0.71 | -69 |
| DE | tariff | 28% | $0.98 | -70 |
| ULTA | rare beauty | 14% | $0.84 | -70 |
| CRM | coworker | 4% | $0.75 | -71 |
| DKS | sport and culture | 13% | $0.84 | -71 |
| ZM | my note | 8% | $0.80 | -72 |
| DE | excavator | 26% | $0.99 | -73 |
| URBN | refund | 4% | $0.78 | -74 |
| INTU | intuit enterprise suite | 16% | $0.90 | -74 |
| DE | fertilizer | 24% | $0.99 | -75 |
| CRM | informatica | 10% | $0.85 | -75 |
| URBN | tariff | 19% | $0.95 | -76 |
| CRWD | mythos | 8% | $0.84 | -76 |
| CRM | mcp | 5% | $0.82 | -77 |
| MRVL | celestial | 7% | $0.85 | -78 |
| CRM | data 360 | 7% | $0.85 | -78 |
| CRM | slackbot | 7% | $0.85 | -78 |
| CRM | token | 7% | $0.85 | -78 |
| DKS | foot locker | 13% | $0.97 | -84 |
| DKS | fast break | 6% | $0.92 | -86 |
| DE | ai / artificial intelligence | 10% | $0.99 | -89 |

## BJ's Wholesale Club Holdings (BJ)
**Upcoming event:** 2026-08-21

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ask bev | 1/30 | 7% | $0.27 | **Unlikely** |
| curbside | 20/30 | 66% | $0.61 | **Strong YES** |
| diesel | 3/30 | 16% | $0.24 | **Unlikely** |
| digital | 30/30 | 95% | $0.92 | **Strong YES** |
| egg | 10/30 | 36% | $0.46 | **Coin flip** |
| expresspay | 8/30 | 31% | $0.83 | **Coin flip** |
| fuel | 20/30 | 66% | $0.80 | **Strong YES** |
| gasoline | 28/30 | 89% | $0.89 | **Strong YES** |
| general merchandise | 30/30 | 95% | $0.94 | **Strong YES** |
| own brand | 24/30 | 77% | $0.85 | **Strong YES** |
| renewal rate | 28/30 | 86% | $0.84 | **Strong YES** |
| rotterdam | 2/30 | 13% | $0.67 | **Unlikely** |
| tally | 1/30 | 7% | $0.25 | **Unlikely** |
| wellesley farms | 3/30 | 13% | $0.22 | **Unlikely** |

---

## Salesforce (CRM)
**Upcoming event:** 2026-08-26

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| agentic enterprise | 3/63 | 8% | $0.66 | **Unlikely** |
| anthropic | 9/63 | 17% | $0.80 | **Unlikely** |
| commerce | 43/63 | 68% | $0.84 | **Strong YES** |
| coworker | 0/63 | 4% | $0.75 | **Unlikely** |
| customer zero | 7/63 | 14% | $0.76 | **Unlikely** |
| data 360 | 2/63 | 7% | $0.85 | **Unlikely** |
| headless 360 | 0/63 | 4% | $0.53 | **Unlikely** |
| informatica | 4/63 | 10% | $0.85 | **Unlikely** |
| mcp | 1/63 | 5% | $0.82 | **Unlikely** |
| mulesoft | 32/63 | 51% | $0.82 | **Likely YES** |
| openai | 8/63 | 15% | - | **Unlikely** |
| slackbot | 2/63 | 7% | $0.85 | **Unlikely** |
| tableau | 27/63 | 44% | $0.85 | **Coin flip** |
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
| germany | 0/28 | 5% | $0.24 | **Unlikely** |
| mythos | 0/28 | 8% | $0.84 | **Unlikely** |
| nvidia | 5/28 | 23% | $0.76 | **Unlikely** |
| openai | 1/28 | 11% | $0.71 | **Unlikely** |
| shadow | 3/28 | 17% | $0.61 | **Unlikely** |
| tailwind | 12/28 | 45% | $0.61 | **Coin flip** |
| xm cyber | 0/28 | 5% | $0.68 | **Unlikely** |

---

## Deere & Company (DE)
**Upcoming event:** 2026-08-20

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ai / artificial intelligence | 5/64 | 10% | $0.99 | **Unlikely** |
| automation | 21/64 | 34% | $0.30 | **Coin flip** |
| dividend | 39/64 | 61% | $0.10 | **Strong YES** |
| efficiency | 31/64 | 48% | $0.99 | **Likely YES** |
| excavator | 15/64 | 26% | $0.99 | **Unlikely** |
| fertilizer | 14/64 | 24% | $0.99 | **Unlikely** |
| headwind | 53/64 | 81% | $0.99 | **Strong YES** |
| manufacturing | 26/64 | 42% | $0.20 | **Coin flip** |
| middle east / iran | 1/64 | 5% | $0.01 | **Unlikely** |
| oil / gas / gasoline | 39/64 | 61% | $0.01 | **Strong YES** |
| repair | 5/64 | 10% | $0.01 | **Unlikely** |
| tailwind | 36/64 | 56% | $0.99 | **Likely YES** |
| tariff | 17/64 | 28% | $0.98 | **Unlikely** |
| warranty | 20/64 | 32% | $0.15 | **Coin flip** |
| weather | 44/64 | 67% | $0.01 | **Strong YES** |

---

## Dell Technologies (DELL)
**Upcoming event:** 2026-09-03

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| agentic | 3/20 | 23% | $0.75 | **Unlikely** |
| ai factory | 4/20 | 27% | $0.76 | **Unlikely** |
| china | 6/20 | 31% | $0.16 | **Coin flip** |
| confidence | 14/20 | 68% | $0.66 | **Strong YES** |
| data center | 19/20 | 89% | $0.84 | **Strong YES** |
| dividend (3+ times) | 0/20 | 6% | $0.35 | **Unlikely** |
| headwind | 16/20 | 72% | $0.30 | **Strong YES** |
| inflation / inflationary | 13/20 | 64% | $0.46 | **Strong YES** |
| lightning | 5/20 | 31% | $0.74 | **Coin flip** |
| mistral | 1/20 | 14% | $0.30 | **Unlikely** |
| nvidia | 9/20 | 47% | $0.84 | **Likely YES** |
| poweredge / power edge | 9/20 | 47% | $0.76 | **Likely YES** |
| powerscale | 14/20 | 68% | $0.74 | **Strong YES** |
| secure ai alliance | 0/20 | 6% | $0.27 | **Unlikely** |
| tailwind | 12/20 | 60% | $0.32 | **Likely YES** |
| texas | 1/20 | 10% | $0.29 | **Unlikely** |
| trump | 0/20 | 6% | $0.12 | **Unlikely** |

---

## DICK'S Sporting Goods (DKS)
**Upcoming event:** 2026-08-25

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| fast break | 1/55 | 6% | $0.92 | **Unlikely** |
| foot locker | 5/55 | 13% | $0.97 | **Unlikely** |
| going going gone | 0/55 | 3% | $0.19 | **Unlikely** |
| golf galaxy | 44/55 | 79% | - | **Strong YES** |
| house of sport | 21/55 | 40% | $0.95 | **Coin flip** |
| nike | 48/55 | 85% | $0.79 | **Strong YES** |
| omnichannel | 30/55 | 55% | $0.84 | **Likely YES** |
| public land | 15/55 | 28% | $0.14 | **Unlikely** |
| retail media | 3/55 | 8% | $0.31 | **Unlikely** |
| sport and culture | 5/55 | 13% | $0.84 | **Unlikely** |
| ticket | 49/55 | 87% | $0.95 | **Strong YES** |
| vertical brand | 22/55 | 41% | $0.90 | **Coin flip** |
| world cup | 11/55 | 23% | $0.90 | **Unlikely** |

---

## Intuit (INTU)
**Upcoming event:** 2026-08-25

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| agentic | 5/50 | 12% | - | **Unlikely** |
| arpu | 19/50 | 40% | $0.21 | **Coin flip** |
| desktop | 49/50 | 95% | $0.90 | **Strong YES** |
| diy | 36/50 | 71% | $0.65 | **Strong YES** |
| intuit assist | 6/50 | 14% | $0.24 | **Unlikely** |
| intuit enterprise suite | 6/50 | 16% | $0.90 | **Unlikely** |
| investor day | 42/50 | 80% | $0.86 | **Strong YES** |
| mailchimp | 18/50 | 38% | $0.94 | **Coin flip** |
| online payment | 29/50 | 58% | $0.91 | **Likely YES** |
| pro tax | 12/50 | 27% | $0.81 | **Unlikely** |
| quickbooks advanced | 17/50 | 36% | $0.29 | **Coin flip** |
| quickbooks online | 49/50 | 95% | $0.90 | **Strong YES** |
| restructuring | 5/50 | 14% | $0.70 | **Unlikely** |
| turbotax live | 32/50 | 64% | $0.75 | **Strong YES** |

---

## Marvell Technology (MRVL)
**Upcoming event:** 2026-08-27

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| aws / amazon | 8/45 | 19% | $0.36 | **Unlikely** |
| celestial | 1/45 | 7% | $0.85 | **Unlikely** |
| india / indian | 8/45 | 19% | $0.36 | **Unlikely** |
| inference | 10/45 | 25% | $0.66 | **Unlikely** |
| nvidia | 8/45 | 21% | $0.62 | **Unlikely** |
| photonic fabric | 1/45 | 7% | $0.71 | **Unlikely** |
| pipeline | 29/45 | 64% | $0.72 | **Strong YES** |
| polariton | 0/45 | 5% | $0.44 | **Unlikely** |
| prepayment | 1/45 | 7% | $0.66 | **Unlikely** |
| scale across | 3/45 | 9% | $0.74 | **Unlikely** |
| storage | 42/45 | 89% | $0.69 | **Strong YES** |
| teralynx | 9/45 | 21% | $0.55 | **Unlikely** |
| trainium | 1/45 | 5% | $0.22 | **Unlikely** |
| xconn | 1/45 | 7% | $0.67 | **Unlikely** |

---

## NVIDIA (NVDA)
**Upcoming event:** 2026-08-26

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| arizona | 2/62 | 5% | $0.31 | **Unlikely** |
| automation | 14/62 | 23% | $0.44 | **Unlikely** |
| cosmos | 5/62 | 10% | $0.51 | **Unlikely** |
| dividend (2+ times) | 0/62 | 2% | $0.32 | **Unlikely** |
| domestic | 10/62 | 17% | $0.59 | **Unlikely** |
| gaming | 57/62 | 90% | $0.81 | **Strong YES** |
| gm / general motors | 4/62 | 8% | $0.11 | **Unlikely** |
| h20 | 4/62 | 8% | $0.26 | **Unlikely** |
| hermes | 0/62 | 4% | $0.30 | **Unlikely** |
| humanoid | 4/62 | 10% | $0.58 | **Unlikely** |
| hyperscaler | 26/62 | 43% | $0.99 | **Coin flip** |
| omniverse | 21/62 | 34% | $0.66 | **Coin flip** |
| rent | 4/62 | 10% | $0.26 | **Unlikely** |
| self driving | 0/62 | 2% | $0.71 | **Unlikely** |
| taiwan | 10/62 | 17% | $0.25 | **Unlikely** |
| talent | 5/62 | 10% | $0.46 | **Unlikely** |
| tariff | 3/62 | 7% | $0.32 | **Unlikely** |
| trump | 1/62 | 4% | $0.15 | **Unlikely** |
| tsmc | 21/62 | 34% | $0.55 | **Coin flip** |

---

## Ross Stores (ROST)
**Upcoming event:** 2026-08-20

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| bankruptcy | 2/20 | 18% | $0.31 | **Unlikely** |
| beauty | 3/20 | 23% | $0.29 | **Unlikely** |
| california | 18/20 | 85% | $0.75 | **Strong YES** |
| closeout | 16/20 | 76% | $0.79 | **Strong YES** |
| dress for less | 5/20 | 27% | $0.21 | **Unlikely** |
| flywheel | 1/20 | 14% | $0.48 | **Unlikely** |
| home | 18/20 | 85% | $0.75 | **Strong YES** |
| korean | 0/20 | 10% | $0.13 | **Unlikely** |
| new york | 4/20 | 27% | $0.83 | **Unlikely** |
| northeast | 6/20 | 35% | $0.79 | **Coin flip** |
| off price | 3/20 | 23% | - | **Unlikely** |
| packaway | 19/20 | 89% | $0.95 | **Strong YES** |
| self checkout | 0/20 | 6% | - | **Unlikely** |
| texas | 16/20 | 72% | $0.35 | **Strong YES** |

---

## Ulta Beauty (ULTA)
**Upcoming event:** 2026-08-27

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ai / artificial intelligence | 6/20 | 35% | $0.86 | **Coin flip** |
| diamond | 9/20 | 44% | $0.81 | **Coin flip** |
| google / gemini | 2/20 | 18% | $0.74 | **Unlikely** |
| headwind | 16/20 | 72% | $0.32 | **Strong YES** |
| holiday | 18/20 | 81% | $0.72 | **Strong YES** |
| iran / middle east | 4/20 | 27% | $0.60 | **Unlikely** |
| luxury | 14/20 | 68% | $0.80 | **Strong YES** |
| rare beauty | 1/20 | 14% | $0.84 | **Unlikely** |
| reward | 13/20 | 64% | $0.72 | **Strong YES** |
| store opening | 8/20 | 39% | $0.38 | **Coin flip** |
| tailwind | 8/20 | 43% | $0.28 | **Coin flip** |
| tariff | 4/20 | 23% | $0.32 | **Unlikely** |
| tiktok | 10/20 | 52% | $0.71 | **Likely YES** |
| times square | 0/20 | 10% | $0.12 | **Unlikely** |
| traffic | 17/20 | 80% | $0.73 | **Strong YES** |
| uncertainty | 11/20 | 56% | $0.86 | **Likely YES** |

---

## Urban Outfitters (URBN)
**Upcoming event:** 2026-08-26

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| back to school | 16/57 | 29% | $0.68 | **Unlikely** |
| beauty | 32/57 | 56% | $0.45 | **Likely YES** |
| claude | 0/57 | 4% | $0.11 | **Unlikely** |
| doordash | 0/57 | 4% | $0.11 | **Unlikely** |
| gemini | 0/57 | 4% | $0.11 | **Unlikely** |
| headwind | 22/57 | 40% | $0.65 | **Coin flip** |
| holiday | 45/57 | 76% | $0.56 | **Strong YES** |
| ieepa | 0/57 | 2% | $0.61 | **Unlikely** |
| international / internationally | 41/57 | 71% | $0.56 | **Strong YES** |
| middle east | 5/57 | 12% | $0.37 | **Unlikely** |
| refund | 0/57 | 4% | $0.78 | **Unlikely** |
| store opening | 26/57 | 46% | $0.73 | **Likely YES** |
| supply chain | 31/57 | 53% | $0.40 | **Likely YES** |
| tariff | 9/57 | 19% | $0.95 | **Unlikely** |

---

## Zoom Video (ZM)
**Upcoming event:** 2026-08-25

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| agentic | 5/28 | 23% | $0.76 | **Unlikely** |
| ai companion | 10/28 | 39% | $0.91 | **Coin flip** |
| churn | 24/28 | 82% | $0.87 | **Strong YES** |
| contact center | 24/28 | 82% | $0.93 | **Strong YES** |
| enterprise | 27/28 | 92% | $0.97 | **Strong YES** |
| federal | 13/28 | 45% | $0.19 | **Likely YES** |
| my note | 0/28 | 8% | $0.80 | **Unlikely** |
| scribe | 0/28 | 8% | $0.35 | **Unlikely** |
| system of action | 3/28 | 17% | $0.85 | **Unlikely** |
| workvivo | 12/28 | 45% | $0.82 | **Coin flip** |
| zoom doc | 3/28 | 14% | $0.26 | **Unlikely** |
| zoom phone | 27/28 | 92% | $0.90 | **Strong YES** |

---
