# Earnings Report

Generated 2026-08-13 · 14 companies with upcoming word markets · 237 words

## Method

Targets are the words in currently open Kalshi earnings-mention markets (from the market caches). Word matching follows Kalshi's resolution rules (word boundaries, plural/possessive forms).

- Aggregate transitions over all upcoming words: P(word said | said last call) = 1995/2779 = 71.8% vs P(said | not said last call) = 879/6740 = 13.0% (base rate 30.2%)
- Baseline P blends the aggregate transition rate with the word's own presence rate (Laplace-smoothed); per-word evidence dominates as call history grows
- Baseline P: from prior earnings call transcripts dated strictly before the event (`transcripts/{TICKER}/`; same-day excluded, so the answer can't leak in); '-' = no pre-event history
- Only markets whose event is today or later are listed — a past event means the market is resolved-by-information, not an opportunity
- Last YES: last traded price for the word's currently open market (Kalshi API, active markets only; the NO side is the pair complement and always sums to $1.00). '-' = no open market or fetch failed
- Verdict tiers: Strong YES (P ≥ 60%), Likely YES (45–60%), Coin flip (30–45%), Unlikely (<30%)

## Opportunities (prior data vs market)

Sorted by gap descending — a positive gap means prior data says the word is more likely than the market prices it (buy YES); a negative gap means less likely (buy NO).

| Company | Word | Baseline P | Market YES | Gap |
|---|---|---|---|---|
| AS | olympic | 64% | $0.20 | +44 |
| AS | pickleball | 42% | $0.00 | +42 |
| ULTA | headwind | 72% | $0.31 | +41 |
| DE | weather | 67% | $0.30 | +37 |
| AS | waterproof | 34% | $0.00 | +34 |
| HD | lumber | 90% | $0.58 | +32 |
| TOL | california | 74% | $0.43 | +31 |
| AS | olympics | 49% | $0.20 | +29 |
| TOL | buyback | 57% | $0.29 | +28 |
| MRVL | storage | 89% | $0.64 | +25 |
| URBN | holiday | 76% | $0.55 | +21 |
| HD | inflation | 83% | $0.62 | +21 |
| ULTA | tailwind | 43% | $0.28 | +15 |
| KLAR | walmart | 75% | $0.60 | +15 |
| TOL | mortgage | 94% | $0.80 | +14 |
| URBN | international | 69% | $0.56 | +13 |
| URBN | beauty | 56% | $0.43 | +13 |
| TOL | apartment | 84% | $0.71 | +13 |
| ULTA | traffic | 80% | $0.68 | +12 |
| NVDA | gaming | 90% | $0.80 | +10 |
| TOL | florida | 74% | $0.64 | +10 |
| ULTA | holiday | 81% | $0.72 | +9 |
| TGT | snap | 12% | $0.03 | +9 |
| WMT | snap | 21% | $0.13 | +8 |
| ULTA | diamond | 44% | $0.36 | +8 |
| URBN | supply chain | 53% | $0.46 | +7 |
| AS | sabalenka | 27% | $0.20 | +7 |
| KLAR | headcount | 34% | $0.27 | +7 |
| WMT | fuel | 89% | $0.83 | +6 |
| DE | headwind | 81% | $0.75 | +6 |
| WMT | competitor | 55% | $0.49 | +6 |
| KLAR | headwind | 51% | $0.46 | +5 |
| CRWD | acquisition | 85% | $0.81 | +4 |
| TGT | inflation | 42% | $0.38 | +4 |
| AMAT | essilorluxottica | 3% | $0.01 | +2 |
| AMAT | senz | 3% | $0.01 | +2 |
| AMAT | smart glasses | 3% | $0.01 | +2 |
| DE | oil | 61% | $0.59 | +2 |
| TGT | remodel | 83% | $0.81 | +2 |
| TGT | automation | 31% | $0.31 | +0 |
| URBN | claude | 4% | $0.04 | -0 |
| TGT | food stamp | 3% | $0.03 | -0 |
| TGT | competition | 31% | $0.32 | -1 |
| CRWD | aws | 79% | $0.80 | -1 |
| CRWD | generative ai | 30% | $0.31 | -1 |
| HD | mexico | 80% | $0.82 | -2 |
| WMT | automotive | 26% | $0.29 | -3 |
| TGT | beauty | 90% | $0.93 | -3 |
| CRWD | consolidation | 76% | $0.80 | -4 |
| NVDA | gm | 7% | $0.11 | -4 |
| KLAR | tailwind | 39% | $0.43 | -4 |
| KLAR | southwest airlines | 22% | $0.26 | -4 |
| KLAR | sweden | 46% | $0.50 | -4 |
| HD | weather | 83% | $0.87 | -4 |
| AMAT | china | 95% | $0.99 | -4 |
| KLAR | apple pay | 63% | $0.68 | -5 |
| DE | dividend | 61% | $0.66 | -5 |
| FUTU | kalshi | 9% | $0.14 | -5 |
| AS | section 122 | 20% | $0.25 | -5 |
| ULTA | store opening | 39% | $0.45 | -6 |
| DE | tailwind | 56% | $0.62 | -6 |
| TOL | spec home | 87% | $0.93 | -6 |
| HD | headwind | 56% | $0.62 | -6 |
| FUTU | cftc | 5% | $0.12 | -7 |
| WMT | competition | 42% | $0.49 | -7 |
| NVDA | general motors | 4% | $0.11 | -7 |
| HD | shutdown | 4% | $0.11 | -7 |
| KLAR | ai | 58% | $0.65 | -7 |
| DE | middle east | 4% | $0.11 | -7 |
| NVDA | taiwan | 17% | $0.25 | -8 |
| WMT | prescription | 40% | $0.48 | -8 |
| HD | innovation | 81% | $0.89 | -8 |
| MRVL | pipeline | 64% | $0.72 | -8 |
| ULTA | reward | 64% | $0.72 | -8 |
| AS | oil | 20% | $0.28 | -8 |
| TOL | lumber | 53% | $0.62 | -9 |
| AS | rei | 57% | $0.66 | -9 |
| URBN | internationally | 47% | $0.56 | -9 |
| AS | middle east | 20% | $0.29 | -9 |
| HD | tailwind | 36% | $0.46 | -10 |
| ULTA | luxury | 68% | $0.78 | -10 |
| FUTU | tailwind | 16% | $0.26 | -10 |
| WMT | upper income | 4% | $0.14 | -10 |
| WMT | food stamp | 2% | $0.13 | -11 |
| AS | supreme court | 27% | $0.38 | -11 |
| AS | wimbledon | 12% | $0.23 | -11 |
| HD | competition | 23% | $0.35 | -12 |
| DE | efficiency | 48% | $0.60 | -12 |
| NVDA | rent | 10% | $0.22 | -12 |
| WMT | brick and mortar | 6% | $0.18 | -12 |
| FUTU | expert | 5% | $0.18 | -13 |
| HD | storm | 60% | $0.73 | -13 |
| DE | gas | 46% | $0.59 | -13 |
| KLAR | credit quality | 63% | $0.76 | -13 |
| KLAR | delinquency | 63% | $0.76 | -13 |
| HD | revenue | 31% | $0.44 | -13 |
| NVDA | automation | 23% | $0.37 | -14 |
| MRVL | trainium | 5% | $0.19 | -14 |
| URBN | doordash | 4% | $0.19 | -15 |
| NVDA | domestic | 17% | $0.33 | -16 |
| CRWD | tailwind | 45% | $0.61 | -16 |
| FUTU | australia | 55% | $0.71 | -16 |
| AS | tariff | 64% | $0.81 | -17 |
| ULTA | tariff | 23% | $0.40 | -17 |
| AS | iran | 12% | $0.29 | -17 |
| CRWD | germany | 5% | $0.22 | -17 |
| KLAR | inflation | 22% | $0.39 | -17 |
| NVDA | h20 | 8% | $0.26 | -18 |
| TOL | incentive | 77% | $0.95 | -18 |
| MRVL | amazon | 17% | $0.36 | -19 |
| NVDA | trump | 4% | $0.23 | -19 |
| DE | warranty | 32% | $0.51 | -19 |
| DE | repair | 10% | $0.29 | -19 |
| ULTA | tiktok | 52% | $0.71 | -19 |
| DE | excavator | 26% | $0.45 | -19 |
| URBN | gemini | 4% | $0.25 | -21 |
| KLAR | gemini | 39% | $0.60 | -21 |
| CRWD | china | 14% | $0.36 | -22 |
| WMT | gas | 61% | $0.83 | -22 |
| MRVL | india | 19% | $0.42 | -23 |
| ULTA | times square | 10% | $0.33 | -23 |
| CRWD | gen ai | 8% | $0.31 | -23 |
| TOL | customize | 36% | $0.59 | -23 |
| NVDA | tariff | 7% | $0.30 | -23 |
| KLAR | jp morgan payment | 39% | $0.62 | -23 |
| TOL | all cash | 67% | $0.90 | -23 |
| NVDA | arizona | 5% | $0.29 | -24 |
| FUTU | headwind | 9% | $0.33 | -24 |
| WMT | marketplace | 72% | $0.96 | -24 |
| AMAT | supply chain | 74% | $0.99 | -25 |
| WMT | drone | 9% | $0.34 | -25 |
| URBN | middle east | 12% | $0.38 | -26 |
| NVDA | omniverse | 34% | $0.60 | -26 |
| URBN | store opening | 46% | $0.73 | -27 |
| MRVL | aws | 9% | $0.36 | -27 |
| WMT | tariff | 56% | $0.83 | -27 |
| NVDA | tsmc | 34% | $0.61 | -27 |
| TGT | back to school | 63% | $0.91 | -28 |
| KLAR | profitability | 58% | $0.86 | -28 |
| TGT | autonomous | 3% | $0.31 | -28 |
| NVDA | hermes | 4% | $0.32 | -28 |
| TOL | land banking | 46% | $0.76 | -30 |
| TGT | tariff | 24% | $0.54 | -30 |
| TOL | tariff | 29% | $0.60 | -31 |
| URBN | headwind | 40% | $0.71 | -31 |
| MRVL | polariton | 5% | $0.36 | -31 |
| WMT | omnichannel | 43% | $0.75 | -32 |
| KLAR | pricerunner | 22% | $0.54 | -32 |
| TGT | revenue | 51% | $0.84 | -33 |
| ULTA | uncertainty | 56% | $0.90 | -34 |
| AS | norvan | 42% | $0.77 | -35 |
| TGT | nintendo switch | 17% | $0.52 | -35 |
| FUTU | fraud | 12% | $0.48 | -36 |
| DE | fertilizer | 24% | $0.60 | -36 |
| AS | foot locker | 27% | $0.63 | -36 |
| NVDA | talent | 10% | $0.46 | -36 |
| TGT | synthetic color | 10% | $0.46 | -36 |
| DE | automation | 34% | $0.71 | -37 |
| KLAR | banking license | 22% | $0.59 | -37 |
| MRVL | teralynx | 21% | $0.59 | -38 |
| MRVL | indian | 3% | $0.42 | -39 |
| DE | manufacturing | 42% | $0.81 | -39 |
| FUTU | agentic | 5% | $0.45 | -40 |
| FUTU | staking | 19% | $0.59 | -40 |
| NVDA | dividend (2+ times) | 2% | $0.42 | -40 |
| TOL | land bank | 36% | $0.76 | -40 |
| TGT | roundel | 33% | $0.73 | -40 |
| MRVL | inference | 25% | $0.66 | -41 |
| MRVL | nvidia | 21% | $0.62 | -41 |
| HD | volatility | 20% | $0.61 | -41 |
| WMT | gasoline | 42% | $0.83 | -41 |
| WMT | rollback | 42% | $0.83 | -41 |
| FUTU | panthertrade | 9% | $0.50 | -41 |
| WMT | automation | 45% | $0.87 | -42 |
| CRWD | shadow | 17% | $0.59 | -42 |
| ULTA | ai | 35% | $0.78 | -43 |
| KLAR | artificial intelligence | 22% | $0.65 | -43 |
| FUTU | perpetual | 9% | $0.52 | -43 |
| NVDA | humanoid | 10% | $0.53 | -43 |
| TOL | customization | 16% | $0.59 | -43 |
| AMAT | screen | 54% | $0.99 | -45 |
| FUTU | perp | 5% | $0.52 | -47 |
| NVDA | cosmos | 10% | $0.57 | -47 |
| ULTA | middle east | 27% | $0.74 | -47 |
| URBN | back to school | 29% | $0.76 | -47 |
| ULTA | google | 18% | $0.66 | -48 |
| CRWD | falcon flex | 39% | $0.88 | -49 |
| CRWD | nvidia | 23% | $0.73 | -50 |
| NVDA | hyperscaler | 43% | $0.93 | -50 |
| AMAT | chinese | 48% | $0.99 | -51 |
| TGT | circle 360 | 19% | $0.70 | -51 |
| URBN | ieepa | 2% | $0.55 | -53 |
| MRVL | prepayment | 7% | $0.60 | -53 |
| TOL | arkansas | 8% | $0.63 | -55 |
| TOL | buffington | 8% | $0.63 | -55 |
| CRWD | cerebras | 5% | $0.60 | -55 |
| TGT | target plus | 26% | $0.81 | -55 |
| ULTA | gemini | 10% | $0.66 | -56 |
| DE | ai | 8% | $0.64 | -56 |
| ULTA | rare beauty | 14% | $0.71 | -57 |
| DE | gasoline | 2% | $0.59 | -57 |
| CRWD | continuous identity | 5% | $0.62 | -57 |
| TOL | cash buyer | 33% | $0.90 | -57 |
| DE | artificial intelligence | 7% | $0.64 | -57 |
| CRWD | mythos | 8% | $0.66 | -58 |
| FUTU | tokenized | 12% | $0.71 | -59 |
| HD | synergy | 8% | $0.67 | -59 |
| MRVL | scale across | 9% | $0.69 | -60 |
| MRVL | xconn | 7% | $0.67 | -60 |
| CRWD | openai | 11% | $0.71 | -60 |
| WMT | sparky | 9% | $0.69 | -60 |
| FUTU | tokenization | 9% | $0.71 | -62 |
| CRWD | ai detection | 14% | $0.76 | -62 |
| CRWD | claude | 14% | $0.76 | -62 |
| MRVL | photonic fabric | 7% | $0.71 | -64 |
| HD | tariff | 26% | $0.91 | -65 |
| URBN | refund | 4% | $0.69 | -65 |
| AMAT | hybrid bonding | 33% | $0.99 | -66 |
| CRWD | xm cyber | 5% | $0.71 | -66 |
| DE | tariff | 28% | $0.95 | -67 |
| ULTA | artificial intelligence | 10% | $0.78 | -68 |
| ULTA | iran | 6% | $0.74 | -68 |
| AMAT | chiplet | 27% | $0.99 | -72 |
| URBN | tariff | 19% | $0.92 | -73 |
| AMAT | singapore | 25% | $0.99 | -74 |
| WMT | roll back | 9% | $0.83 | -74 |
| AMAT | epic center | 23% | $0.99 | -76 |
| MRVL | celestial | 7% | $0.85 | -78 |
| AMAT | epitaxy | 17% | $0.99 | -82 |
| NVDA | self driving | 2% | $0.85 | -83 |
| WMT | market place | 2% | $0.96 | -94 |
| AMAT | broadcom | 5% | $0.99 | -94 |
| AMAT | agentic | 5% | $0.99 | -94 |
| AMAT | agent | 3% | $0.99 | -96 |

## Applied Materials (AMAT)
**Upcoming event:** 2026-08-13

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| agent | 0/45 | 3% | $0.99 | **Unlikely** |
| agentic | 0/45 | 5% | $0.99 | **Unlikely** |
| broadcom | 1/45 | 5% | $0.99 | **Unlikely** |
| china | 44/45 | 95% | $0.99 | **Strong YES** |
| chinese | 22/45 | 48% | $0.99 | **Likely YES** |
| chiplet | 11/45 | 27% | $0.99 | **Unlikely** |
| epic center | 9/45 | 23% | $0.99 | **Unlikely** |
| epitaxy | 6/45 | 17% | $0.99 | **Unlikely** |
| essilorluxottica | 0/45 | 3% | $0.01 | **Unlikely** |
| hybrid bonding | 14/45 | 33% | $0.99 | **Coin flip** |
| screen | 25/45 | 54% | $0.99 | **Likely YES** |
| senz | 0/45 | 3% | $0.01 | **Unlikely** |
| singapore | 10/45 | 25% | $0.99 | **Unlikely** |
| smart glasses | 0/45 | 3% | $0.01 | **Unlikely** |
| supply chain | 34/45 | 74% | $0.99 | **Strong YES** |

---

## Amer Sports (AS)
**Upcoming event:** 2026-08-18

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| foot locker | 1/9 | 27% | $0.63 | **Unlikely** |
| iran | 0/9 | 12% | $0.29 | **Unlikely** |
| middle east | 0/9 | 20% | $0.29 | **Unlikely** |
| norvan | 3/9 | 42% | $0.77 | **Coin flip** |
| oil | 0/9 | 20% | $0.28 | **Unlikely** |
| olympic | 7/9 | 64% | $0.20 | **Strong YES** |
| olympics | 5/9 | 49% | $0.20 | **Likely YES** |
| pickleball | 4/9 | 42% | $0.00 | **Coin flip** |
| rei | 5/9 | 57% | $0.66 | **Likely YES** |
| sabalenka | 1/9 | 27% | $0.20 | **Unlikely** |
| section 122 | 0/9 | 20% | $0.25 | **Unlikely** |
| supreme court | 1/9 | 27% | $0.38 | **Unlikely** |
| tariff | 6/9 | 64% | $0.81 | **Strong YES** |
| waterproof | 3/9 | 34% | $0.00 | **Coin flip** |
| wimbledon | 0/9 | 12% | $0.23 | **Unlikely** |

---

## CrowdStrike (CRWD)
**Upcoming event:** 2026-08-26

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| acquisition | 25/28 | 85% | $0.81 | **Strong YES** |
| ai detection | 2/28 | 14% | $0.76 | **Unlikely** |
| aws | 23/28 | 79% | $0.80 | **Strong YES** |
| cerebras | 0/28 | 5% | $0.60 | **Unlikely** |
| china | 3/28 | 14% | $0.36 | **Unlikely** |
| claude | 2/28 | 14% | $0.76 | **Unlikely** |
| consolidation | 22/28 | 76% | $0.80 | **Strong YES** |
| continuous identity | 0/28 | 5% | $0.62 | **Unlikely** |
| falcon flex | 10/28 | 39% | $0.88 | **Coin flip** |
| gen ai | 1/28 | 8% | $0.31 | **Unlikely** |
| generative ai | 8/28 | 30% | $0.31 | **Unlikely** |
| germany | 0/28 | 5% | $0.22 | **Unlikely** |
| mythos | 0/28 | 8% | $0.66 | **Unlikely** |
| nvidia | 5/28 | 23% | $0.73 | **Unlikely** |
| openai | 1/28 | 11% | $0.71 | **Unlikely** |
| shadow | 3/28 | 17% | $0.59 | **Unlikely** |
| tailwind | 12/28 | 45% | $0.61 | **Coin flip** |
| xm cyber | 0/28 | 5% | $0.71 | **Unlikely** |

---

## Deere & Company (DE)
**Upcoming event:** 2026-08-20

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ai | 4/64 | 8% | $0.64 | **Unlikely** |
| artificial intelligence | 3/64 | 7% | $0.64 | **Unlikely** |
| automation | 21/64 | 34% | $0.71 | **Coin flip** |
| dividend | 39/64 | 61% | $0.66 | **Strong YES** |
| efficiency | 31/64 | 48% | $0.60 | **Likely YES** |
| excavator | 15/64 | 26% | $0.45 | **Unlikely** |
| fertilizer | 14/64 | 24% | $0.60 | **Unlikely** |
| gas | 29/64 | 46% | $0.59 | **Likely YES** |
| gasoline | 0/64 | 2% | $0.59 | **Unlikely** |
| headwind | 53/64 | 81% | $0.75 | **Strong YES** |
| iran | 0/64 | 3% | - | **Unlikely** |
| manufacturing | 26/64 | 42% | $0.81 | **Coin flip** |
| middle east | 1/64 | 4% | $0.11 | **Unlikely** |
| oil | 39/64 | 61% | $0.59 | **Strong YES** |
| repair | 5/64 | 10% | $0.29 | **Unlikely** |
| tailwind | 36/64 | 56% | $0.62 | **Likely YES** |
| tariff | 17/64 | 28% | $0.95 | **Unlikely** |
| warranty | 20/64 | 32% | $0.51 | **Coin flip** |
| weather | 44/64 | 67% | $0.30 | **Strong YES** |

---

## Futu Holdings (FUTU)
**Upcoming event:** 2026-08-20

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| agentic | 0/24 | 5% | $0.45 | **Unlikely** |
| australia | 13/24 | 55% | $0.71 | **Likely YES** |
| cftc | 0/24 | 5% | $0.12 | **Unlikely** |
| expert | 0/24 | 5% | $0.18 | **Unlikely** |
| fraud | 1/24 | 12% | $0.48 | **Unlikely** |
| headwind | 1/24 | 9% | $0.33 | **Unlikely** |
| kalshi | 0/24 | 9% | $0.14 | **Unlikely** |
| panthertrade | 0/24 | 9% | $0.50 | **Unlikely** |
| perp | 0/24 | 5% | $0.52 | **Unlikely** |
| perpetual | 0/24 | 9% | $0.52 | **Unlikely** |
| staking | 3/24 | 19% | $0.59 | **Unlikely** |
| tailwind | 3/24 | 16% | $0.26 | **Unlikely** |
| tokenization | 1/24 | 9% | $0.71 | **Unlikely** |
| tokenized | 1/24 | 12% | $0.71 | **Unlikely** |

---

## The Home Depot (HD)
**Upcoming event:** 2026-08-18

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| competition | 13/63 | 23% | $0.35 | **Unlikely** |
| e commerce | 0/63 | 2% | - | **Unlikely** |
| headwind | 35/63 | 56% | $0.62 | **Likely YES** |
| inflation | 54/63 | 83% | $0.62 | **Strong YES** |
| innovation | 52/63 | 81% | $0.89 | **Strong YES** |
| lumber | 59/63 | 90% | $0.58 | **Strong YES** |
| mexico | 51/63 | 80% | $0.82 | **Strong YES** |
| revenue | 19/63 | 31% | $0.44 | **Coin flip** |
| shutdown | 1/63 | 4% | $0.11 | **Unlikely** |
| storm | 38/63 | 60% | $0.73 | **Strong YES** |
| synergy | 4/63 | 8% | $0.67 | **Unlikely** |
| tailwind | 22/63 | 36% | $0.46 | **Coin flip** |
| tariff | 15/63 | 26% | $0.91 | **Unlikely** |
| volatility | 12/63 | 20% | $0.61 | **Unlikely** |
| weather | 53/63 | 83% | $0.87 | **Strong YES** |

---

## Klarna Group (KLAR)
**Upcoming event:** 2026-08-18

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ai | 3/3 | 58% | $0.65 | **Likely YES** |
| apple pay | 2/3 | 63% | $0.68 | **Strong YES** |
| artificial intelligence | 0/3 | 22% | $0.65 | **Unlikely** |
| banking license | 0/3 | 22% | $0.59 | **Unlikely** |
| credit quality | 2/3 | 63% | $0.76 | **Strong YES** |
| delinquency | 2/3 | 63% | $0.76 | **Strong YES** |
| gemini | 0/3 | 39% | $0.60 | **Coin flip** |
| headcount | 1/3 | 34% | $0.27 | **Coin flip** |
| headwind | 1/3 | 51% | $0.46 | **Likely YES** |
| inflation | 0/3 | 22% | $0.39 | **Unlikely** |
| jp morgan payment | 0/3 | 39% | $0.62 | **Coin flip** |
| pricerunner | 0/3 | 22% | $0.54 | **Unlikely** |
| profitability | 3/3 | 58% | $0.86 | **Likely YES** |
| southwest airlines | 0/3 | 22% | $0.26 | **Unlikely** |
| sweden | 2/3 | 46% | $0.50 | **Likely YES** |
| tailwind | 0/3 | 39% | $0.43 | **Coin flip** |
| walmart | 3/3 | 75% | $0.60 | **Strong YES** |

---

## Marvell Technology (MRVL)
**Upcoming event:** 2026-08-27

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| amazon | 7/45 | 17% | $0.36 | **Unlikely** |
| aws | 3/45 | 9% | $0.36 | **Unlikely** |
| celestial | 1/45 | 7% | $0.85 | **Unlikely** |
| india | 8/45 | 19% | $0.42 | **Unlikely** |
| indian | 0/45 | 3% | $0.42 | **Unlikely** |
| inference | 10/45 | 25% | $0.66 | **Unlikely** |
| nvidia | 8/45 | 21% | $0.62 | **Unlikely** |
| photonic fabric | 1/45 | 7% | $0.71 | **Unlikely** |
| pipeline | 29/45 | 64% | $0.72 | **Strong YES** |
| polariton | 0/45 | 5% | $0.36 | **Unlikely** |
| prepayment | 1/45 | 7% | $0.60 | **Unlikely** |
| scale across | 3/45 | 9% | $0.69 | **Unlikely** |
| storage | 42/45 | 89% | $0.64 | **Strong YES** |
| teralynx | 9/45 | 21% | $0.59 | **Unlikely** |
| trainium | 1/45 | 5% | $0.19 | **Unlikely** |
| xconn | 1/45 | 7% | $0.67 | **Unlikely** |

---

## NVIDIA (NVDA)
**Upcoming event:** 2026-08-26

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| arizona | 2/62 | 5% | $0.29 | **Unlikely** |
| automation | 14/62 | 23% | $0.37 | **Unlikely** |
| cosmos | 5/62 | 10% | $0.57 | **Unlikely** |
| dividend (2+ times) | 0/62 | 2% | $0.42 | **Unlikely** |
| domestic | 10/62 | 17% | $0.33 | **Unlikely** |
| gaming | 57/62 | 90% | $0.80 | **Strong YES** |
| general motors | 1/62 | 4% | $0.11 | **Unlikely** |
| gm | 3/62 | 7% | $0.11 | **Unlikely** |
| h20 | 4/62 | 8% | $0.26 | **Unlikely** |
| hermes | 0/62 | 4% | $0.32 | **Unlikely** |
| humanoid | 4/62 | 10% | $0.53 | **Unlikely** |
| hyperscaler | 26/62 | 43% | $0.93 | **Coin flip** |
| omniverse | 21/62 | 34% | $0.60 | **Coin flip** |
| rent | 4/62 | 10% | $0.22 | **Unlikely** |
| self driving | 0/62 | 2% | $0.85 | **Unlikely** |
| taiwan | 10/62 | 17% | $0.25 | **Unlikely** |
| talent | 5/62 | 10% | $0.46 | **Unlikely** |
| tariff | 3/62 | 7% | $0.30 | **Unlikely** |
| trump | 1/62 | 4% | $0.23 | **Unlikely** |
| tsmc | 21/62 | 34% | $0.61 | **Coin flip** |

---

## Target (TGT)
**Upcoming event:** 2026-08-19

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| automation | 16/52 | 31% | $0.31 | **Coin flip** |
| autonomous | 0/52 | 3% | $0.31 | **Unlikely** |
| back to school | 33/52 | 63% | $0.91 | **Strong YES** |
| beauty | 48/52 | 90% | $0.93 | **Strong YES** |
| circle 360 | 9/52 | 19% | $0.70 | **Unlikely** |
| competition | 16/52 | 31% | $0.32 | **Coin flip** |
| food stamp | 0/52 | 3% | $0.03 | **Unlikely** |
| inflation | 22/52 | 42% | $0.38 | **Coin flip** |
| nintendo switch | 7/52 | 17% | $0.52 | **Unlikely** |
| remodel | 44/52 | 83% | $0.81 | **Strong YES** |
| revenue | 26/52 | 51% | $0.84 | **Likely YES** |
| roundel | 16/52 | 33% | $0.73 | **Coin flip** |
| snap | 5/52 | 12% | $0.03 | **Unlikely** |
| synthetic color | 3/52 | 10% | $0.46 | **Unlikely** |
| target plus | 12/52 | 26% | $0.81 | **Unlikely** |
| tariff | 11/52 | 24% | $0.54 | **Unlikely** |

---

## Toll Brothers (TOL)
**Upcoming event:** 2026-08-18

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| all cash | 17/25 | 67% | $0.90 | **Strong YES** |
| apartment | 22/25 | 84% | $0.71 | **Strong YES** |
| arkansas | 0/25 | 8% | $0.63 | **Unlikely** |
| buffington | 0/25 | 8% | $0.63 | **Unlikely** |
| buyback | 15/25 | 57% | $0.29 | **Likely YES** |
| california | 20/25 | 74% | $0.43 | **Strong YES** |
| cash buyer | 8/25 | 33% | $0.90 | **Coin flip** |
| customization | 3/25 | 16% | $0.59 | **Unlikely** |
| customize | 8/25 | 36% | $0.59 | **Coin flip** |
| florida | 19/25 | 74% | $0.64 | **Strong YES** |
| incentive | 20/25 | 77% | $0.95 | **Strong YES** |
| land bank | 8/25 | 36% | $0.76 | **Coin flip** |
| land banking | 11/25 | 46% | $0.76 | **Likely YES** |
| lumber | 13/25 | 53% | $0.62 | **Likely YES** |
| mortgage | 25/25 | 94% | $0.80 | **Strong YES** |
| move up buyer | 1/25 | 9% | - | **Unlikely** |
| spec home | 23/25 | 87% | $0.93 | **Strong YES** |
| tariff | 6/25 | 29% | $0.60 | **Unlikely** |

---

## Ulta Beauty (ULTA)
**Upcoming event:** 2026-08-27

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ai | 6/20 | 35% | $0.78 | **Coin flip** |
| artificial intelligence | 1/20 | 10% | $0.78 | **Unlikely** |
| diamond | 9/20 | 44% | $0.36 | **Coin flip** |
| gemini | 0/20 | 10% | $0.66 | **Unlikely** |
| google | 2/20 | 18% | $0.66 | **Unlikely** |
| headwind | 16/20 | 72% | $0.31 | **Strong YES** |
| holiday | 18/20 | 81% | $0.72 | **Strong YES** |
| iran | 0/20 | 6% | $0.74 | **Unlikely** |
| luxury | 14/20 | 68% | $0.78 | **Strong YES** |
| middle east | 4/20 | 27% | $0.74 | **Unlikely** |
| rare beauty | 1/20 | 14% | $0.71 | **Unlikely** |
| reward | 13/20 | 64% | $0.72 | **Strong YES** |
| store opening | 8/20 | 39% | $0.45 | **Coin flip** |
| tailwind | 8/20 | 43% | $0.28 | **Coin flip** |
| tariff | 4/20 | 23% | $0.40 | **Unlikely** |
| tiktok | 10/20 | 52% | $0.71 | **Likely YES** |
| times square | 0/20 | 10% | $0.33 | **Unlikely** |
| traffic | 17/20 | 80% | $0.68 | **Strong YES** |
| uncertainty | 11/20 | 56% | $0.90 | **Likely YES** |

---

## Urban Outfitters (URBN)
**Upcoming event:** 2026-08-26

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| back to school | 16/57 | 29% | $0.76 | **Unlikely** |
| beauty | 32/57 | 56% | $0.43 | **Likely YES** |
| claude | 0/57 | 4% | $0.04 | **Unlikely** |
| doordash | 0/57 | 4% | $0.19 | **Unlikely** |
| gemini | 0/57 | 4% | $0.25 | **Unlikely** |
| headwind | 22/57 | 40% | $0.71 | **Coin flip** |
| holiday | 45/57 | 76% | $0.55 | **Strong YES** |
| ieepa | 0/57 | 2% | $0.55 | **Unlikely** |
| international | 40/57 | 69% | $0.56 | **Strong YES** |
| internationally | 27/57 | 47% | $0.56 | **Likely YES** |
| middle east | 5/57 | 12% | $0.38 | **Unlikely** |
| refund | 0/57 | 4% | $0.69 | **Unlikely** |
| store opening | 26/57 | 46% | $0.73 | **Likely YES** |
| supply chain | 31/57 | 53% | $0.46 | **Likely YES** |
| tariff | 9/57 | 19% | $0.92 | **Unlikely** |

---

## Walmart (WMT)
**Upcoming event:** 2026-08-20

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| automation | 26/59 | 45% | $0.87 | **Likely YES** |
| automotive | 15/59 | 26% | $0.29 | **Unlikely** |
| brick and mortar | 2/59 | 6% | $0.18 | **Unlikely** |
| competition | 25/59 | 42% | $0.49 | **Coin flip** |
| competitor | 32/59 | 55% | $0.49 | **Likely YES** |
| drone | 3/59 | 9% | $0.34 | **Unlikely** |
| food stamp | 0/59 | 2% | $0.13 | **Unlikely** |
| fuel | 54/59 | 89% | $0.83 | **Strong YES** |
| gas | 36/59 | 61% | $0.83 | **Strong YES** |
| gasoline | 25/59 | 42% | $0.83 | **Coin flip** |
| market place | 0/59 | 2% | $0.96 | **Unlikely** |
| marketplace | 43/59 | 72% | $0.96 | **Strong YES** |
| omnichannel | 25/59 | 43% | $0.75 | **Coin flip** |
| prescription | 23/59 | 40% | $0.48 | **Coin flip** |
| roll back | 4/59 | 9% | $0.83 | **Unlikely** |
| rollback | 24/59 | 42% | $0.83 | **Coin flip** |
| snap | 12/59 | 21% | $0.13 | **Unlikely** |
| sparky | 3/59 | 9% | $0.69 | **Unlikely** |
| tariff | 33/59 | 56% | $0.83 | **Likely YES** |
| upper income | 1/59 | 4% | $0.14 | **Unlikely** |

---
