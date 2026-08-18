# Earnings Report

Generated 2026-08-18 · 11 companies with upcoming word markets · 194 words

## Method

Targets are the words in currently open Kalshi earnings-mention markets (from the market caches). Word matching follows Kalshi's resolution rules (word boundaries, plural/possessive forms).

- Aggregate transitions over all upcoming words: P(word said | said last call) = 1584/2253 = 70.3% vs P(said | not said last call) = 744/5840 = 12.7% (base rate 28.8%)
- Baseline P blends the aggregate transition rate with the word's own presence rate (Laplace-smoothed); per-word evidence dominates as call history grows
- Baseline P: from prior earnings call transcripts dated strictly before the event (`transcripts/{TICKER}/`; same-day excluded, so the answer can't leak in); '-' = no pre-event history
- Only markets whose event is today or later are listed — a past event means the market is resolved-by-information, not an opportunity
- Last YES: last traded price for the word's currently open market (Kalshi API, active markets only; the NO side is the pair complement and always sums to $1.00). '-' = no open market or fetch failed
- Verdict tiers: Strong YES (P ≥ 60%), Likely YES (45–60%), Coin flip (30–45%), Unlikely (<30%)

## Opportunities (prior data vs market)

Sorted by gap descending — a positive gap means prior data says the word is more likely than the market prices it (buy YES); a negative gap means less likely (buy NO).

| Company | Word | Baseline P | Market YES | Gap |
|---|---|---|---|---|
| DELL | headwind | 72% | $0.30 | +42 |
| ULTA | headwind | 72% | $0.32 | +40 |
| TOL | buyback | 57% | $0.25 | +32 |
| URBN | holiday | 76% | $0.56 | +20 |
| MRVL | storage | 89% | $0.69 | +20 |
| ULTA | tailwind | 43% | $0.28 | +15 |
| TGT | automation | 31% | $0.16 | +15 |
| DELL | china | 31% | $0.16 | +15 |
| URBN | international | 69% | $0.55 | +14 |
| NVDA | gaming | 90% | $0.76 | +14 |
| TOL | california | 74% | $0.60 | +14 |
| URBN | beauty | 56% | $0.43 | +13 |
| DE | dividend | 61% | $0.48 | +13 |
| ULTA | traffic | 80% | $0.68 | +12 |
| URBN | supply chain | 53% | $0.41 | +12 |
| TOL | apartment | 84% | $0.73 | +11 |
| DELL | tailwind | 60% | $0.49 | +11 |
| TGT | competition | 31% | $0.21 | +10 |
| WMT | competitor | 55% | $0.45 | +10 |
| ULTA | holiday | 81% | $0.72 | +9 |
| ULTA | luxury | 68% | $0.60 | +8 |
| TGT | snap | 12% | $0.04 | +8 |
| CRWD | generative ai | 30% | $0.23 | +7 |
| DE | oil | 61% | $0.55 | +6 |
| FUTU | tailwind | 16% | $0.11 | +5 |
| DELL | data center | 89% | $0.84 | +5 |
| CRWD | acquisition | 85% | $0.81 | +4 |
| WMT | snap | 21% | $0.18 | +3 |
| DELL | inflation | 52% | $0.49 | +3 |
| DE | headwind | 81% | $0.79 | +2 |
| DELL | confidence | 68% | $0.66 | +2 |
| WMT | automotive | 26% | $0.26 | +0 |
| TOL | mortgage | 94% | $0.94 | +0 |
| URBN | claude | 4% | $0.04 | -0 |
| TOL | florida | 74% | $0.74 | -0 |
| CRWD | aws | 79% | $0.80 | -1 |
| TGT | food stamp | 3% | $0.04 | -1 |
| DE | repair | 10% | $0.11 | -1 |
| DELL | inflationary | 47% | $0.49 | -2 |
| WMT | prescription | 40% | $0.42 | -2 |
| ULTA | times square | 10% | $0.12 | -2 |
| DE | weather | 67% | $0.69 | -2 |
| WMT | fuel | 89% | $0.92 | -3 |
| WMT | competition | 42% | $0.45 | -3 |
| NVDA | gm | 7% | $0.11 | -4 |
| ULTA | store opening | 39% | $0.45 | -6 |
| DELL | trump | 6% | $0.12 | -6 |
| DELL | powerscale | 68% | $0.74 | -6 |
| TGT | remodel | 83% | $0.89 | -6 |
| TGT | beauty | 90% | $0.97 | -7 |
| NVDA | general motors | 4% | $0.11 | -7 |
| CRWD | consolidation | 76% | $0.84 | -8 |
| MRVL | pipeline | 64% | $0.72 | -8 |
| ULTA | reward | 64% | $0.72 | -8 |
| URBN | internationally | 47% | $0.55 | -8 |
| DE | gas | 46% | $0.55 | -9 |
| ULTA | tariff | 23% | $0.32 | -9 |
| TGT | revenue | 51% | $0.60 | -9 |
| NVDA | taiwan | 17% | $0.27 | -10 |
| DE | tailwind | 56% | $0.67 | -11 |
| TOL | spec home | 87% | $0.98 | -11 |
| TOL | lumber | 53% | $0.64 | -11 |
| NVDA | trump | 4% | $0.15 | -11 |
| DE | efficiency | 48% | $0.59 | -11 |
| WMT | brick and mortar | 6% | $0.17 | -11 |
| TGT | inflation | 42% | $0.54 | -12 |
| MRVL | trainium | 5% | $0.18 | -13 |
| TGT | autonomous | 3% | $0.16 | -13 |
| DELL | secure ai alliance | 6% | $0.20 | -14 |
| DE | middle east | 4% | $0.18 | -14 |
| URBN | doordash | 4% | $0.19 | -15 |
| CRWD | gen ai | 8% | $0.23 | -15 |
| WMT | food stamp | 2% | $0.18 | -16 |
| DELL | mistral | 14% | $0.30 | -16 |
| CRWD | tailwind | 45% | $0.61 | -16 |
| NVDA | rent | 10% | $0.26 | -16 |
| NVDA | domestic | 17% | $0.34 | -17 |
| FUTU | headwind | 9% | $0.26 | -17 |
| NVDA | tariff | 7% | $0.25 | -18 |
| DELL | texas | 10% | $0.29 | -19 |
| MRVL | amazon | 17% | $0.36 | -19 |
| WMT | upper income | 4% | $0.23 | -19 |
| DE | manufacturing | 42% | $0.61 | -19 |
| ULTA | tiktok | 52% | $0.71 | -19 |
| FUTU | fraud | 12% | $0.32 | -20 |
| DE | warranty | 32% | $0.52 | -20 |
| TOL | incentive | 77% | $0.98 | -21 |
| URBN | gemini | 4% | $0.25 | -21 |
| CRWD | china | 14% | $0.36 | -22 |
| TOL | tariff | 29% | $0.51 | -22 |
| FUTU | australia | 55% | $0.77 | -22 |
| FUTU | cftc | 5% | $0.29 | -24 |
| NVDA | arizona | 5% | $0.29 | -24 |
| DE | excavator | 26% | $0.50 | -24 |
| NVDA | automation | 23% | $0.48 | -25 |
| FUTU | agentic | 5% | $0.30 | -25 |
| NVDA | h20 | 8% | $0.33 | -25 |
| MRVL | india | 19% | $0.45 | -26 |
| URBN | middle east | 12% | $0.38 | -26 |
| WMT | marketplace | 72% | $0.98 | -26 |
| TOL | all cash | 67% | $0.93 | -26 |
| URBN | store opening | 46% | $0.73 | -27 |
| MRVL | aws | 9% | $0.36 | -27 |
| TOL | land banking | 46% | $0.73 | -27 |
| ULTA | diamond | 44% | $0.71 | -27 |
| NVDA | tsmc | 34% | $0.62 | -28 |
| DELL | poweredge | 47% | $0.76 | -29 |
| DELL | dividend (3+ times) | 6% | $0.35 | -29 |
| WMT | drone | 9% | $0.38 | -29 |
| FUTU | expert | 5% | $0.35 | -30 |
| TGT | back to school | 63% | $0.93 | -30 |
| TOL | customize | 36% | $0.66 | -30 |
| ULTA | uncertainty | 56% | $0.86 | -30 |
| WMT | gas | 61% | $0.92 | -31 |
| WMT | tariff | 56% | $0.88 | -32 |
| NVDA | omniverse | 34% | $0.66 | -32 |
| URBN | headwind | 40% | $0.74 | -34 |
| MRVL | polariton | 5% | $0.39 | -34 |
| NVDA | hermes | 4% | $0.38 | -34 |
| CRWD | germany | 5% | $0.40 | -35 |
| DE | fertilizer | 24% | $0.60 | -36 |
| TOL | land bank | 36% | $0.73 | -37 |
| DELL | nvidia | 47% | $0.85 | -38 |
| ULTA | middle east | 27% | $0.65 | -38 |
| NVDA | dividend (2+ times) | 2% | $0.41 | -39 |
| URBN | back to school | 29% | $0.68 | -39 |
| MRVL | inference | 25% | $0.66 | -41 |
| MRVL | nvidia | 21% | $0.62 | -41 |
| TGT | synthetic color | 10% | $0.51 | -41 |
| MRVL | indian | 3% | $0.45 | -42 |
| DE | ai | 8% | $0.51 | -43 |
| DELL | lightning | 31% | $0.74 | -43 |
| NVDA | talent | 10% | $0.53 | -43 |
| FUTU | perpetual | 9% | $0.52 | -43 |
| NVDA | humanoid | 10% | $0.53 | -43 |
| ULTA | ai | 35% | $0.79 | -44 |
| WMT | automation | 45% | $0.89 | -44 |
| CRWD | shadow | 17% | $0.61 | -44 |
| FUTU | kalshi | 9% | $0.53 | -44 |
| DE | artificial intelligence | 7% | $0.51 | -44 |
| WMT | omnichannel | 43% | $0.89 | -46 |
| FUTU | staking | 19% | $0.65 | -46 |
| NVDA | cosmos | 10% | $0.56 | -46 |
| WMT | rollback | 42% | $0.88 | -46 |
| FUTU | perp | 5% | $0.52 | -47 |
| DE | automation | 34% | $0.81 | -47 |
| ULTA | google | 18% | $0.66 | -48 |
| FUTU | tokenized | 12% | $0.61 | -49 |
| WMT | gasoline | 42% | $0.92 | -50 |
| TOL | customization | 16% | $0.66 | -50 |
| TGT | circle 360 | 19% | $0.70 | -51 |
| URBN | ieepa | 2% | $0.54 | -52 |
| FUTU | tokenization | 9% | $0.61 | -52 |
| NVDA | hyperscaler | 43% | $0.95 | -52 |
| DELL | ai factory | 27% | $0.79 | -52 |
| DELL | agentic | 23% | $0.75 | -52 |
| MRVL | teralynx | 21% | $0.74 | -53 |
| DE | gasoline | 2% | $0.55 | -53 |
| TGT | tariff | 24% | $0.77 | -53 |
| CRWD | falcon flex | 39% | $0.92 | -53 |
| MRVL | prepayment | 7% | $0.61 | -54 |
| CRWD | xm cyber | 5% | $0.59 | -54 |
| TGT | roundel | 33% | $0.88 | -55 |
| ULTA | gemini | 10% | $0.66 | -56 |
| CRWD | claude | 14% | $0.71 | -57 |
| CRWD | nvidia | 23% | $0.81 | -58 |
| ULTA | iran | 6% | $0.65 | -59 |
| MRVL | xconn | 7% | $0.67 | -60 |
| CRWD | openai | 11% | $0.71 | -60 |
| TOL | cash buyer | 33% | $0.93 | -60 |
| CRWD | ai detection | 14% | $0.75 | -61 |
| CRWD | cerebras | 5% | $0.66 | -61 |
| FUTU | panthertrade | 9% | $0.72 | -63 |
| MRVL | photonic fabric | 7% | $0.71 | -64 |
| TGT | nintendo switch | 17% | $0.82 | -65 |
| CRWD | continuous identity | 5% | $0.70 | -65 |
| TGT | target plus | 26% | $0.91 | -65 |
| DE | tariff | 28% | $0.96 | -68 |
| TOL | arkansas | 8% | $0.76 | -68 |
| TOL | buffington | 8% | $0.76 | -68 |
| CRWD | mythos | 8% | $0.76 | -68 |
| ULTA | artificial intelligence | 10% | $0.79 | -69 |
| NVDA | self driving | 2% | $0.71 | -69 |
| ULTA | rare beauty | 14% | $0.84 | -70 |
| DELL | power edge | 6% | $0.76 | -70 |
| MRVL | celestial | 7% | $0.81 | -74 |
| MRVL | scale across | 9% | $0.84 | -75 |
| URBN | tariff | 19% | $0.95 | -76 |
| URBN | refund | 4% | $0.81 | -77 |
| WMT | roll back | 9% | $0.88 | -79 |
| WMT | sparky | 9% | $0.90 | -81 |
| WMT | market place | 2% | $0.98 | -96 |

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
| continuous identity | 0/28 | 5% | $0.70 | **Unlikely** |
| falcon flex | 10/28 | 39% | $0.92 | **Coin flip** |
| gen ai | 1/28 | 8% | $0.23 | **Unlikely** |
| generative ai | 8/28 | 30% | $0.23 | **Unlikely** |
| germany | 0/28 | 5% | $0.40 | **Unlikely** |
| mythos | 0/28 | 8% | $0.76 | **Unlikely** |
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
| ai | 4/64 | 8% | $0.51 | **Unlikely** |
| artificial intelligence | 3/64 | 7% | $0.51 | **Unlikely** |
| automation | 21/64 | 34% | $0.81 | **Coin flip** |
| dividend | 39/64 | 61% | $0.48 | **Strong YES** |
| efficiency | 31/64 | 48% | $0.59 | **Likely YES** |
| excavator | 15/64 | 26% | $0.50 | **Unlikely** |
| fertilizer | 14/64 | 24% | $0.60 | **Unlikely** |
| gas | 29/64 | 46% | $0.55 | **Likely YES** |
| gasoline | 0/64 | 2% | $0.55 | **Unlikely** |
| headwind | 53/64 | 81% | $0.79 | **Strong YES** |
| iran | 0/64 | 3% | - | **Unlikely** |
| manufacturing | 26/64 | 42% | $0.61 | **Coin flip** |
| middle east | 1/64 | 4% | $0.18 | **Unlikely** |
| oil | 39/64 | 61% | $0.55 | **Strong YES** |
| repair | 5/64 | 10% | $0.11 | **Unlikely** |
| tailwind | 36/64 | 56% | $0.67 | **Likely YES** |
| tariff | 17/64 | 28% | $0.96 | **Unlikely** |
| warranty | 20/64 | 32% | $0.52 | **Coin flip** |
| weather | 44/64 | 67% | $0.69 | **Strong YES** |

---

## Dell Technologies (DELL)
**Upcoming event:** 2026-09-03

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| agentic | 3/20 | 23% | $0.75 | **Unlikely** |
| ai factory | 4/20 | 27% | $0.79 | **Unlikely** |
| china | 6/20 | 31% | $0.16 | **Coin flip** |
| confidence | 14/20 | 68% | $0.66 | **Strong YES** |
| data center | 19/20 | 89% | $0.84 | **Strong YES** |
| dividend (3+ times) | 0/20 | 6% | $0.35 | **Unlikely** |
| headwind | 16/20 | 72% | $0.30 | **Strong YES** |
| inflation | 11/20 | 52% | $0.49 | **Likely YES** |
| inflationary | 9/20 | 47% | $0.49 | **Likely YES** |
| lightning | 5/20 | 31% | $0.74 | **Coin flip** |
| mistral | 1/20 | 14% | $0.30 | **Unlikely** |
| nvidia | 9/20 | 47% | $0.85 | **Likely YES** |
| power edge | 0/20 | 6% | $0.76 | **Unlikely** |
| poweredge | 9/20 | 47% | $0.76 | **Likely YES** |
| powerscale | 14/20 | 68% | $0.74 | **Strong YES** |
| secure ai alliance | 0/20 | 6% | $0.20 | **Unlikely** |
| tailwind | 12/20 | 60% | $0.49 | **Likely YES** |
| texas | 1/20 | 10% | $0.29 | **Unlikely** |
| trump | 0/20 | 6% | $0.12 | **Unlikely** |

---

## Futu Holdings (FUTU)
**Upcoming event:** 2026-08-20

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| agentic | 0/24 | 5% | $0.30 | **Unlikely** |
| australia | 13/24 | 55% | $0.77 | **Likely YES** |
| cftc | 0/24 | 5% | $0.29 | **Unlikely** |
| expert | 0/24 | 5% | $0.35 | **Unlikely** |
| fraud | 1/24 | 12% | $0.32 | **Unlikely** |
| headwind | 1/24 | 9% | $0.26 | **Unlikely** |
| kalshi | 0/24 | 9% | $0.53 | **Unlikely** |
| panthertrade | 0/24 | 9% | $0.72 | **Unlikely** |
| perp | 0/24 | 5% | $0.52 | **Unlikely** |
| perpetual | 0/24 | 9% | $0.52 | **Unlikely** |
| staking | 3/24 | 19% | $0.65 | **Unlikely** |
| tailwind | 3/24 | 16% | $0.11 | **Unlikely** |
| tokenization | 1/24 | 9% | $0.61 | **Unlikely** |
| tokenized | 1/24 | 12% | $0.61 | **Unlikely** |

---

## Marvell Technology (MRVL)
**Upcoming event:** 2026-08-27

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| amazon | 7/45 | 17% | $0.36 | **Unlikely** |
| aws | 3/45 | 9% | $0.36 | **Unlikely** |
| celestial | 1/45 | 7% | $0.81 | **Unlikely** |
| india | 8/45 | 19% | $0.45 | **Unlikely** |
| indian | 0/45 | 3% | $0.45 | **Unlikely** |
| inference | 10/45 | 25% | $0.66 | **Unlikely** |
| nvidia | 8/45 | 21% | $0.62 | **Unlikely** |
| photonic fabric | 1/45 | 7% | $0.71 | **Unlikely** |
| pipeline | 29/45 | 64% | $0.72 | **Strong YES** |
| polariton | 0/45 | 5% | $0.39 | **Unlikely** |
| prepayment | 1/45 | 7% | $0.61 | **Unlikely** |
| scale across | 3/45 | 9% | $0.84 | **Unlikely** |
| storage | 42/45 | 89% | $0.69 | **Strong YES** |
| teralynx | 9/45 | 21% | $0.74 | **Unlikely** |
| trainium | 1/45 | 5% | $0.18 | **Unlikely** |
| xconn | 1/45 | 7% | $0.67 | **Unlikely** |

---

## NVIDIA (NVDA)
**Upcoming event:** 2026-08-26

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| arizona | 2/62 | 5% | $0.29 | **Unlikely** |
| automation | 14/62 | 23% | $0.48 | **Unlikely** |
| cosmos | 5/62 | 10% | $0.56 | **Unlikely** |
| dividend (2+ times) | 0/62 | 2% | $0.41 | **Unlikely** |
| domestic | 10/62 | 17% | $0.34 | **Unlikely** |
| gaming | 57/62 | 90% | $0.76 | **Strong YES** |
| general motors | 1/62 | 4% | $0.11 | **Unlikely** |
| gm | 3/62 | 7% | $0.11 | **Unlikely** |
| h20 | 4/62 | 8% | $0.33 | **Unlikely** |
| hermes | 0/62 | 4% | $0.38 | **Unlikely** |
| humanoid | 4/62 | 10% | $0.53 | **Unlikely** |
| hyperscaler | 26/62 | 43% | $0.95 | **Coin flip** |
| omniverse | 21/62 | 34% | $0.66 | **Coin flip** |
| rent | 4/62 | 10% | $0.26 | **Unlikely** |
| self driving | 0/62 | 2% | $0.71 | **Unlikely** |
| taiwan | 10/62 | 17% | $0.27 | **Unlikely** |
| talent | 5/62 | 10% | $0.53 | **Unlikely** |
| tariff | 3/62 | 7% | $0.25 | **Unlikely** |
| trump | 1/62 | 4% | $0.15 | **Unlikely** |
| tsmc | 21/62 | 34% | $0.62 | **Coin flip** |

---

## Target (TGT)
**Upcoming event:** 2026-08-19

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| automation | 16/52 | 31% | $0.16 | **Coin flip** |
| autonomous | 0/52 | 3% | $0.16 | **Unlikely** |
| back to school | 33/52 | 63% | $0.93 | **Strong YES** |
| beauty | 48/52 | 90% | $0.97 | **Strong YES** |
| circle 360 | 9/52 | 19% | $0.70 | **Unlikely** |
| competition | 16/52 | 31% | $0.21 | **Coin flip** |
| food stamp | 0/52 | 3% | $0.04 | **Unlikely** |
| inflation | 22/52 | 42% | $0.54 | **Coin flip** |
| nintendo switch | 7/52 | 17% | $0.82 | **Unlikely** |
| remodel | 44/52 | 83% | $0.89 | **Strong YES** |
| revenue | 26/52 | 51% | $0.60 | **Likely YES** |
| roundel | 16/52 | 33% | $0.88 | **Coin flip** |
| snap | 5/52 | 12% | $0.04 | **Unlikely** |
| synthetic color | 3/52 | 10% | $0.51 | **Unlikely** |
| target plus | 12/52 | 26% | $0.91 | **Unlikely** |
| tariff | 11/52 | 24% | $0.77 | **Unlikely** |

---

## Toll Brothers (TOL)
**Upcoming event:** 2026-08-18

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| all cash | 17/25 | 67% | $0.93 | **Strong YES** |
| apartment | 22/25 | 84% | $0.73 | **Strong YES** |
| arkansas | 0/25 | 8% | $0.76 | **Unlikely** |
| buffington | 0/25 | 8% | $0.76 | **Unlikely** |
| buyback | 15/25 | 57% | $0.25 | **Likely YES** |
| california | 20/25 | 74% | $0.60 | **Strong YES** |
| cash buyer | 8/25 | 33% | $0.93 | **Coin flip** |
| customization | 3/25 | 16% | $0.66 | **Unlikely** |
| customize | 8/25 | 36% | $0.66 | **Coin flip** |
| florida | 19/25 | 74% | $0.74 | **Strong YES** |
| incentive | 20/25 | 77% | $0.98 | **Strong YES** |
| land bank | 8/25 | 36% | $0.73 | **Coin flip** |
| land banking | 11/25 | 46% | $0.73 | **Likely YES** |
| lumber | 13/25 | 53% | $0.64 | **Likely YES** |
| mortgage | 25/25 | 94% | $0.94 | **Strong YES** |
| move up buyer | 1/25 | 9% | - | **Unlikely** |
| spec home | 23/25 | 87% | $0.98 | **Strong YES** |
| tariff | 6/25 | 29% | $0.51 | **Unlikely** |

---

## Ulta Beauty (ULTA)
**Upcoming event:** 2026-08-27

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ai | 6/20 | 35% | $0.79 | **Coin flip** |
| artificial intelligence | 1/20 | 10% | $0.79 | **Unlikely** |
| diamond | 9/20 | 44% | $0.71 | **Coin flip** |
| gemini | 0/20 | 10% | $0.66 | **Unlikely** |
| google | 2/20 | 18% | $0.66 | **Unlikely** |
| headwind | 16/20 | 72% | $0.32 | **Strong YES** |
| holiday | 18/20 | 81% | $0.72 | **Strong YES** |
| iran | 0/20 | 6% | $0.65 | **Unlikely** |
| luxury | 14/20 | 68% | $0.60 | **Strong YES** |
| middle east | 4/20 | 27% | $0.65 | **Unlikely** |
| rare beauty | 1/20 | 14% | $0.84 | **Unlikely** |
| reward | 13/20 | 64% | $0.72 | **Strong YES** |
| store opening | 8/20 | 39% | $0.45 | **Coin flip** |
| tailwind | 8/20 | 43% | $0.28 | **Coin flip** |
| tariff | 4/20 | 23% | $0.32 | **Unlikely** |
| tiktok | 10/20 | 52% | $0.71 | **Likely YES** |
| times square | 0/20 | 10% | $0.12 | **Unlikely** |
| traffic | 17/20 | 80% | $0.68 | **Strong YES** |
| uncertainty | 11/20 | 56% | $0.86 | **Likely YES** |

---

## Urban Outfitters (URBN)
**Upcoming event:** 2026-08-26

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| back to school | 16/57 | 29% | $0.68 | **Unlikely** |
| beauty | 32/57 | 56% | $0.43 | **Likely YES** |
| claude | 0/57 | 4% | $0.04 | **Unlikely** |
| doordash | 0/57 | 4% | $0.19 | **Unlikely** |
| gemini | 0/57 | 4% | $0.25 | **Unlikely** |
| headwind | 22/57 | 40% | $0.74 | **Coin flip** |
| holiday | 45/57 | 76% | $0.56 | **Strong YES** |
| ieepa | 0/57 | 2% | $0.54 | **Unlikely** |
| international | 40/57 | 69% | $0.55 | **Strong YES** |
| internationally | 27/57 | 47% | $0.55 | **Likely YES** |
| middle east | 5/57 | 12% | $0.38 | **Unlikely** |
| refund | 0/57 | 4% | $0.81 | **Unlikely** |
| store opening | 26/57 | 46% | $0.73 | **Likely YES** |
| supply chain | 31/57 | 53% | $0.41 | **Likely YES** |
| tariff | 9/57 | 19% | $0.95 | **Unlikely** |

---

## Walmart (WMT)
**Upcoming event:** 2026-08-20

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| automation | 26/59 | 45% | $0.89 | **Likely YES** |
| automotive | 15/59 | 26% | $0.26 | **Unlikely** |
| brick and mortar | 2/59 | 6% | $0.17 | **Unlikely** |
| competition | 25/59 | 42% | $0.45 | **Coin flip** |
| competitor | 32/59 | 55% | $0.45 | **Likely YES** |
| drone | 3/59 | 9% | $0.38 | **Unlikely** |
| food stamp | 0/59 | 2% | $0.18 | **Unlikely** |
| fuel | 54/59 | 89% | $0.92 | **Strong YES** |
| gas | 36/59 | 61% | $0.92 | **Strong YES** |
| gasoline | 25/59 | 42% | $0.92 | **Coin flip** |
| market place | 0/59 | 2% | $0.98 | **Unlikely** |
| marketplace | 43/59 | 72% | $0.98 | **Strong YES** |
| omnichannel | 25/59 | 43% | $0.89 | **Coin flip** |
| prescription | 23/59 | 40% | $0.42 | **Coin flip** |
| roll back | 4/59 | 9% | $0.88 | **Unlikely** |
| rollback | 24/59 | 42% | $0.88 | **Coin flip** |
| snap | 12/59 | 21% | $0.18 | **Unlikely** |
| sparky | 3/59 | 9% | $0.90 | **Unlikely** |
| tariff | 33/59 | 56% | $0.88 | **Likely YES** |
| upper income | 1/59 | 4% | $0.23 | **Unlikely** |

---
