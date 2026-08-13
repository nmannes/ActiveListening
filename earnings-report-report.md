# Earnings Report

Generated 2026-08-13 · 14 companies with upcoming word markets · 237 words

## Method

Targets are the words in currently open Kalshi earnings-mention markets (from the market caches). Word matching follows Kalshi's resolution rules (word boundaries, plural/possessive forms).

- Aggregate transitions over all upcoming words: P(word said | said last call) = 368/501 = 73.5% vs P(said | not said last call) = 176/740 = 23.8% (base rate 43.8%)
- Baseline P blends the aggregate transition rate with the word's own presence rate (Laplace-smoothed); per-word evidence dominates as call history grows
- Baseline P: from prior earnings call transcripts dated strictly before the event (`transcripts/{TICKER}/`; same-day excluded, so the answer can't leak in); '-' = no pre-event history
- Only markets whose event is today or later are listed — a past event means the market is resolved-by-information, not an opportunity
- Last YES: last traded price for the word's currently open market (Kalshi API, active markets only; the NO side is the pair complement and always sums to $1.00). '-' = no open market or fetch failed
- Verdict tiers: Strong YES (P ≥ 60%), Likely YES (45–60%), Coin flip (30–45%), Unlikely (<30%)

**3 of 14 companies lack transcript history** — run `./bin/kalshi transcripts --from-markets` to fill baselines.

## Opportunities (prior data vs market)

Sorted by gap descending — a positive gap means prior data says the word is more likely than the market prices it (buy YES); a negative gap means less likely (buy NO).

| Company | Word | Baseline P | Market YES | Gap |
|---|---|---|---|---|
| URBN | beauty | 75% | $0.43 | +32 |
| KLAR | walmart | 75% | $0.45 | +30 |
| ULTA | headwind | 57% | $0.31 | +26 |
| ULTA | tailwind | 49% | $0.28 | +21 |
| TGT | circle 360 | 75% | $0.54 | +21 |
| WMT | automotive | 49% | $0.29 | +20 |
| URBN | claude | 24% | $0.04 | +20 |
| TGT | inflation | 57% | $0.38 | +19 |
| KLAR | headwind | 51% | $0.33 | +18 |
| HD | shutdown | 23% | $0.07 | +16 |
| TOL | california | 57% | $0.43 | +14 |
| NVDA | h20 | 40% | $0.26 | +14 |
| WMT | brick and mortar | 31% | $0.18 | +13 |
| TGT | tariff | 67% | $0.54 | +13 |
| NVDA | gm | 23% | $0.11 | +12 |
| TOL | florida | 75% | $0.64 | +11 |
| TGT | food stamp | 14% | $0.03 | +11 |
| TGT | snap | 14% | $0.03 | +11 |
| TGT | roundel | 84% | $0.73 | +11 |
| TOL | buyback | 40% | $0.29 | +11 |
| URBN | holiday | 66% | $0.55 | +11 |
| NVDA | rent | 32% | $0.22 | +10 |
| WMT | omnichannel | 84% | $0.74 | +10 |
| WMT | snap | 23% | $0.13 | +10 |
| FUTU | kalshi | 24% | $0.14 | +10 |
| CRWD | generative ai | 40% | $0.31 | +9 |
| WMT | upper income | 23% | $0.14 | +9 |
| ULTA | tariff | 49% | $0.40 | +9 |
| HD | inflation | 75% | $0.66 | +9 |
| TGT | competition | 40% | $0.32 | +8 |
| NVDA | trump | 23% | $0.15 | +8 |
| NVDA | tariff | 40% | $0.33 | +7 |
| TOL | tariff | 67% | $0.60 | +7 |
| KLAR | headcount | 34% | $0.27 | +7 |
| WMT | rollback | 84% | $0.78 | +6 |
| HD | lumber | 66% | $0.60 | +6 |
| HD | competition | 41% | $0.35 | +6 |
| URBN | doordash | 24% | $0.19 | +5 |
| FUTU | australia | 75% | $0.71 | +4 |
| NVDA | cosmos | 57% | $0.53 | +4 |
| CRWD | consolidation | 84% | $0.80 | +4 |
| NVDA | gaming | 84% | $0.80 | +4 |
| TOL | mortgage | 84% | $0.80 | +4 |
| ULTA | diamond | 40% | $0.36 | +4 |
| HD | revenue | 49% | $0.45 | +4 |
| HD | tailwind | 49% | $0.46 | +3 |
| NVDA | general motors | 14% | $0.11 | +3 |
| TGT | remodel | 84% | $0.81 | +3 |
| ULTA | store opening | 49% | $0.46 | +3 |
| ULTA | holiday | 75% | $0.72 | +3 |
| NVDA | humanoid | 49% | $0.47 | +2 |
| FUTU | cftc | 14% | $0.12 | +2 |
| WMT | food stamp | 14% | $0.13 | +1 |
| WMT | automation | 84% | $0.83 | +1 |
| AMAT | hybrid bonding | 67% | $0.66 | +1 |
| NVDA | omniverse | 66% | $0.66 | -0 |
| NVDA | taiwan | 23% | $0.23 | -0 |
| TGT | target plus | 75% | $0.76 | -1 |
| ULTA | traffic | 67% | $0.68 | -1 |
| URBN | gemini | 24% | $0.25 | -1 |
| AMAT | epitaxy | 41% | $0.43 | -2 |
| CRWD | tailwind | 58% | $0.61 | -3 |
| FUTU | tailwind | 23% | $0.26 | -3 |
| FUTU | expert | 14% | $0.18 | -4 |
| CRWD | falcon flex | 84% | $0.88 | -4 |
| KLAR | tailwind | 39% | $0.43 | -4 |
| TOL | apartment | 67% | $0.71 | -4 |
| KLAR | southwest airlines | 22% | $0.26 | -4 |
| KLAR | sweden | 46% | $0.50 | -4 |
| CRWD | aws | 75% | $0.80 | -5 |
| CRWD | china | 31% | $0.36 | -5 |
| HD | innovation | 84% | $0.89 | -5 |
| KLAR | apple pay | 63% | $0.68 | -5 |
| NVDA | automation | 31% | $0.37 | -6 |
| TOL | all cash | 84% | $0.90 | -6 |
| NVDA | talent | 40% | $0.46 | -6 |
| URBN | store opening | 67% | $0.73 | -6 |
| HD | mexico | 75% | $0.82 | -7 |
| WMT | marketplace | 84% | $0.91 | -7 |
| WMT | prescription | 41% | $0.48 | -7 |
| KLAR | ai | 58% | $0.65 | -7 |
| WMT | competitor | 49% | $0.57 | -8 |
| WMT | fuel | 75% | $0.83 | -8 |
| CRWD | germany | 14% | $0.22 | -8 |
| AMAT | china | 84% | $0.92 | -8 |
| TGT | beauty | 84% | $0.92 | -8 |
| CRWD | gen ai | 23% | $0.31 | -8 |
| TGT | automation | 23% | $0.31 | -8 |
| NVDA | hermes | 24% | $0.32 | -8 |
| AMAT | supply chain | 84% | $0.93 | -9 |
| TOL | spec home | 84% | $0.93 | -9 |
| NVDA | arizona | 23% | $0.32 | -9 |
| ULTA | times square | 24% | $0.33 | -9 |
| FUTU | staking | 49% | $0.59 | -10 |
| TOL | customize | 49% | $0.59 | -10 |
| FUTU | headwind | 23% | $0.33 | -10 |
| NVDA | domestic | 23% | $0.33 | -10 |
| TOL | incentive | 84% | $0.95 | -11 |
| ULTA | luxury | 67% | $0.78 | -11 |
| HD | weather | 75% | $0.87 | -12 |
| TGT | revenue | 58% | $0.70 | -12 |
| AMAT | epic center | 84% | $0.96 | -12 |
| HD | volatility | 49% | $0.61 | -12 |
| NVDA | tsmc | 49% | $0.61 | -12 |
| HD | headwind | 49% | $0.62 | -13 |
| URBN | headwind | 58% | $0.71 | -13 |
| KLAR | credit quality | 63% | $0.76 | -13 |
| KLAR | delinquency | 63% | $0.76 | -13 |
| TGT | synthetic color | 32% | $0.46 | -14 |
| ULTA | reward | 58% | $0.72 | -14 |
| CRWD | acquisition | 67% | $0.81 | -14 |
| URBN | middle east | 24% | $0.38 | -14 |
| WMT | drone | 24% | $0.38 | -14 |
| CRWD | nvidia | 58% | $0.73 | -15 |
| HD | storm | 58% | $0.73 | -15 |
| URBN | international | 41% | $0.56 | -15 |
| HD | tariff | 75% | $0.91 | -16 |
| FUTU | fraud | 32% | $0.48 | -16 |
| ULTA | middle east | 58% | $0.74 | -16 |
| AMAT | singapore | 67% | $0.83 | -16 |
| WMT | tariff | 67% | $0.83 | -16 |
| TGT | autonomous | 14% | $0.31 | -17 |
| WMT | competition | 40% | $0.57 | -17 |
| KLAR | inflation | 22% | $0.39 | -17 |
| TOL | land bank | 58% | $0.76 | -18 |
| AMAT | chiplet | 41% | $0.59 | -18 |
| CRWD | shadow | 41% | $0.59 | -18 |
| WMT | sparky | 49% | $0.69 | -20 |
| KLAR | gemini | 39% | $0.60 | -21 |
| TGT | nintendo switch | 49% | $0.71 | -22 |
| ULTA | tiktok | 49% | $0.71 | -22 |
| KLAR | jp morgan payment | 39% | $0.62 | -23 |
| ULTA | uncertainty | 67% | $0.90 | -23 |
| URBN | supply chain | 23% | $0.46 | -23 |
| URBN | internationally | 31% | $0.56 | -25 |
| NVDA | hyperscaler | 67% | $0.93 | -26 |
| FUTU | panthertrade | 24% | $0.50 | -26 |
| TOL | land banking | 49% | $0.76 | -27 |
| AMAT | screen | 31% | $0.58 | -27 |
| KLAR | profitability | 58% | $0.85 | -27 |
| URBN | back to school | 49% | $0.76 | -27 |
| NVDA | dividend (2+ times) | 14% | $0.42 | -28 |
| FUTU | perpetual | 24% | $0.52 | -28 |
| ULTA | ai | 49% | $0.78 | -29 |
| TOL | lumber | 32% | $0.62 | -30 |
| CRWD | claude | 41% | $0.71 | -30 |
| FUTU | agentic | 14% | $0.45 | -31 |
| KLAR | pricerunner | 22% | $0.54 | -32 |
| CRWD | ai detection | 41% | $0.76 | -35 |
| HD | synergy | 31% | $0.67 | -36 |
| URBN | tariff | 58% | $0.94 | -36 |
| KLAR | banking license | 22% | $0.59 | -37 |
| AMAT | essilorluxottica | 14% | $0.52 | -38 |
| FUTU | perp | 14% | $0.52 | -38 |
| CRWD | openai | 32% | $0.71 | -39 |
| FUTU | tokenized | 32% | $0.71 | -39 |
| TOL | arkansas | 24% | $0.63 | -39 |
| TOL | buffington | 24% | $0.63 | -39 |
| URBN | ieepa | 14% | $0.55 | -41 |
| AMAT | smart glasses | 14% | $0.56 | -42 |
| WMT | gas | 41% | $0.83 | -42 |
| CRWD | mythos | 24% | $0.66 | -42 |
| ULTA | gemini | 24% | $0.66 | -42 |
| ULTA | google | 24% | $0.66 | -42 |
| KLAR | artificial intelligence | 22% | $0.65 | -43 |
| ULTA | rare beauty | 32% | $0.76 | -44 |
| TOL | customization | 14% | $0.59 | -45 |
| URBN | refund | 24% | $0.69 | -45 |
| CRWD | cerebras | 14% | $0.60 | -46 |
| CRWD | continuous identity | 14% | $0.62 | -48 |
| FUTU | tokenization | 23% | $0.71 | -48 |
| TOL | cash buyer | 40% | $0.90 | -50 |
| TGT | back to school | 41% | $0.91 | -50 |
| AMAT | chinese | 40% | $0.92 | -52 |
| AMAT | agentic | 24% | $0.77 | -53 |
| AMAT | broadcom | 14% | $0.70 | -56 |
| AMAT | senz | 14% | $0.70 | -56 |
| CRWD | xm cyber | 14% | $0.71 | -57 |
| ULTA | iran | 14% | $0.74 | -60 |
| AMAT | agent | 14% | $0.77 | -63 |
| ULTA | artificial intelligence | 14% | $0.78 | -64 |
| WMT | roll back | 14% | $0.78 | -64 |
| WMT | gasoline | 14% | $0.83 | -69 |
| NVDA | self driving | 14% | $0.85 | -71 |
| WMT | market place | 14% | $0.91 | -77 |

## Applied Materials (AMAT)
**Upcoming event:** 2026-08-13

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| agent | 0/7 | 14% | $0.77 | **Unlikely** |
| agentic | 0/7 | 24% | $0.77 | **Unlikely** |
| broadcom | 0/7 | 14% | $0.70 | **Unlikely** |
| china | 7/7 | 84% | $0.92 | **Strong YES** |
| chinese | 3/7 | 40% | $0.92 | **Coin flip** |
| chiplet | 2/7 | 41% | $0.59 | **Coin flip** |
| epic center | 7/7 | 84% | $0.96 | **Strong YES** |
| epitaxy | 2/7 | 41% | $0.43 | **Coin flip** |
| essilorluxottica | 0/7 | 14% | $0.52 | **Unlikely** |
| hybrid bonding | 5/7 | 67% | $0.66 | **Strong YES** |
| screen | 2/7 | 31% | $0.58 | **Coin flip** |
| senz | 0/7 | 14% | $0.70 | **Unlikely** |
| singapore | 5/7 | 67% | $0.83 | **Strong YES** |
| smart glasses | 0/7 | 14% | $0.56 | **Unlikely** |
| supply chain | 7/7 | 84% | $0.93 | **Strong YES** |

---

## Amer Sports (AS)
**Upcoming event:** 2026-08-18
*No transcript history — baseline unavailable. Run `./bin/kalshi transcripts --from-markets` to fill it in.*

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| foot locker | - | - | $0.55 | **-** |
| iran | - | - | $0.29 | **-** |
| middle east | - | - | $0.29 | **-** |
| norvan | - | - | $0.77 | **-** |
| oil | - | - | $0.28 | **-** |
| olympic | - | - | $0.00 | **-** |
| olympics | - | - | $0.00 | **-** |
| pickleball | - | - | $0.00 | **-** |
| rei | - | - | $0.66 | **-** |
| sabalenka | - | - | $0.20 | **-** |
| section 122 | - | - | $0.25 | **-** |
| supreme court | - | - | $0.38 | **-** |
| tariff | - | - | $0.81 | **-** |
| waterproof | - | - | $0.00 | **-** |
| wimbledon | - | - | $0.23 | **-** |

---

## CrowdStrike (CRWD)
**Upcoming event:** 2026-08-26

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| acquisition | 5/7 | 67% | $0.81 | **Strong YES** |
| ai detection | 2/7 | 41% | $0.76 | **Coin flip** |
| aws | 6/7 | 75% | $0.80 | **Strong YES** |
| cerebras | 0/7 | 14% | $0.60 | **Unlikely** |
| china | 2/7 | 31% | $0.36 | **Coin flip** |
| claude | 2/7 | 41% | $0.71 | **Coin flip** |
| consolidation | 7/7 | 84% | $0.80 | **Strong YES** |
| continuous identity | 0/7 | 14% | $0.62 | **Unlikely** |
| falcon flex | 7/7 | 84% | $0.88 | **Strong YES** |
| gen ai | 1/7 | 23% | $0.31 | **Unlikely** |
| generative ai | 3/7 | 40% | $0.31 | **Coin flip** |
| germany | 0/7 | 14% | $0.22 | **Unlikely** |
| mythos | 0/7 | 24% | $0.66 | **Unlikely** |
| nvidia | 4/7 | 58% | $0.73 | **Likely YES** |
| openai | 1/7 | 32% | $0.71 | **Coin flip** |
| shadow | 2/7 | 41% | $0.59 | **Coin flip** |
| tailwind | 4/7 | 58% | $0.61 | **Likely YES** |
| xm cyber | 0/7 | 14% | $0.71 | **Unlikely** |

---

## John Deere (DE)
**Upcoming event:** 2026-08-20
*No transcript history — baseline unavailable. Run `./bin/kalshi transcripts --from-markets` to fill it in.*

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ai | - | - | $0.58 | **-** |
| artificial intelligence | - | - | $0.58 | **-** |
| automation | - | - | $0.71 | **-** |
| dividend | - | - | $0.66 | **-** |
| efficiency | - | - | $0.60 | **-** |
| excavator | - | - | $0.45 | **-** |
| fertilizer | - | - | $0.60 | **-** |
| gas | - | - | $0.60 | **-** |
| gasoline | - | - | $0.60 | **-** |
| headwind | - | - | $0.75 | **-** |
| iran | - | - | - | **-** |
| manufacturing | - | - | $0.73 | **-** |
| middle east | - | - | $0.12 | **-** |
| oil | - | - | $0.60 | **-** |
| repair | - | - | $0.29 | **-** |
| tailwind | - | - | $0.62 | **-** |
| tariff | - | - | $0.95 | **-** |
| warranty | - | - | $0.56 | **-** |
| weather | - | - | $0.36 | **-** |

---

## Futu Holdings (FUTU)
**Upcoming event:** 2026-08-20

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| agentic | 0/7 | 14% | $0.45 | **Unlikely** |
| australia | 6/7 | 75% | $0.71 | **Strong YES** |
| cftc | 0/7 | 14% | $0.12 | **Unlikely** |
| expert | 0/7 | 14% | $0.18 | **Unlikely** |
| fraud | 1/7 | 32% | $0.48 | **Coin flip** |
| headwind | 1/7 | 23% | $0.33 | **Unlikely** |
| kalshi | 0/7 | 24% | $0.14 | **Unlikely** |
| panthertrade | 0/7 | 24% | $0.50 | **Unlikely** |
| perp | 0/7 | 14% | $0.52 | **Unlikely** |
| perpetual | 0/7 | 24% | $0.52 | **Unlikely** |
| staking | 3/7 | 49% | $0.59 | **Likely YES** |
| tailwind | 1/7 | 23% | $0.26 | **Unlikely** |
| tokenization | 1/7 | 23% | $0.71 | **Unlikely** |
| tokenized | 1/7 | 32% | $0.71 | **Coin flip** |

---

## The Home Depot (HD)
**Upcoming event:** 2026-08-18

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| competition | 2/7 | 41% | $0.35 | **Coin flip** |
| e commerce | 0/7 | 14% | - | **Unlikely** |
| headwind | 3/7 | 49% | $0.62 | **Likely YES** |
| inflation | 7/7 | 75% | $0.66 | **Strong YES** |
| innovation | 7/7 | 84% | $0.89 | **Strong YES** |
| lumber | 6/7 | 66% | $0.60 | **Strong YES** |
| mexico | 6/7 | 75% | $0.82 | **Strong YES** |
| revenue | 4/7 | 49% | $0.45 | **Likely YES** |
| shutdown | 1/7 | 23% | $0.07 | **Unlikely** |
| storm | 4/7 | 58% | $0.73 | **Likely YES** |
| synergy | 2/7 | 31% | $0.67 | **Coin flip** |
| tailwind | 3/7 | 49% | $0.46 | **Likely YES** |
| tariff | 6/7 | 75% | $0.91 | **Strong YES** |
| volatility | 4/7 | 49% | $0.61 | **Likely YES** |
| weather | 6/7 | 75% | $0.87 | **Strong YES** |

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
| headwind | 1/3 | 51% | $0.33 | **Likely YES** |
| inflation | 0/3 | 22% | $0.39 | **Unlikely** |
| jp morgan payment | 0/3 | 39% | $0.62 | **Coin flip** |
| pricerunner | 0/3 | 22% | $0.54 | **Unlikely** |
| profitability | 3/3 | 58% | $0.85 | **Likely YES** |
| southwest airlines | 0/3 | 22% | $0.26 | **Unlikely** |
| sweden | 2/3 | 46% | $0.50 | **Likely YES** |
| tailwind | 0/3 | 39% | $0.43 | **Coin flip** |
| walmart | 3/3 | 75% | $0.45 | **Strong YES** |

---

## Marvell Technology (MRVL)
**Upcoming event:** 2026-08-27
*No transcript history — baseline unavailable. Run `./bin/kalshi transcripts --from-markets` to fill it in.*

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| amazon | - | - | $0.36 | **-** |
| aws | - | - | $0.36 | **-** |
| celestial | - | - | $0.85 | **-** |
| india | - | - | $0.42 | **-** |
| indian | - | - | $0.42 | **-** |
| inference | - | - | $0.66 | **-** |
| nvidia | - | - | $0.62 | **-** |
| photonic fabric | - | - | $0.71 | **-** |
| pipeline | - | - | $0.72 | **-** |
| polariton | - | - | $0.36 | **-** |
| prepayment | - | - | $0.60 | **-** |
| scale across | - | - | $0.69 | **-** |
| storage | - | - | $0.64 | **-** |
| teralynx | - | - | $0.59 | **-** |
| trainium | - | - | $0.19 | **-** |
| xconn | - | - | $0.67 | **-** |

---

## NVIDIA (NVDA)
**Upcoming event:** 2026-08-26

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| arizona | 1/7 | 23% | $0.32 | **Unlikely** |
| automation | 2/7 | 31% | $0.37 | **Coin flip** |
| cosmos | 5/7 | 57% | $0.53 | **Likely YES** |
| dividend (2+ times) | 0/7 | 14% | $0.42 | **Unlikely** |
| domestic | 1/7 | 23% | $0.33 | **Unlikely** |
| gaming | 7/7 | 84% | $0.80 | **Strong YES** |
| general motors | 0/7 | 14% | $0.11 | **Unlikely** |
| gm | 1/7 | 23% | $0.11 | **Unlikely** |
| h20 | 3/7 | 40% | $0.26 | **Coin flip** |
| hermes | 0/7 | 24% | $0.32 | **Unlikely** |
| humanoid | 3/7 | 49% | $0.47 | **Likely YES** |
| hyperscaler | 5/7 | 67% | $0.93 | **Strong YES** |
| omniverse | 6/7 | 66% | $0.66 | **Strong YES** |
| rent | 1/7 | 32% | $0.22 | **Coin flip** |
| self driving | 0/7 | 14% | $0.85 | **Unlikely** |
| taiwan | 1/7 | 23% | $0.23 | **Unlikely** |
| talent | 3/7 | 40% | $0.46 | **Coin flip** |
| tariff | 3/7 | 40% | $0.33 | **Coin flip** |
| trump | 1/7 | 23% | $0.15 | **Unlikely** |
| tsmc | 4/7 | 49% | $0.61 | **Likely YES** |

---

## Target (TGT)
**Upcoming event:** 2026-08-19

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| automation | 1/7 | 23% | $0.31 | **Unlikely** |
| autonomous | 0/7 | 14% | $0.31 | **Unlikely** |
| back to school | 2/7 | 41% | $0.91 | **Coin flip** |
| beauty | 7/7 | 84% | $0.92 | **Strong YES** |
| circle 360 | 7/7 | 75% | $0.54 | **Strong YES** |
| competition | 3/7 | 40% | $0.32 | **Coin flip** |
| food stamp | 0/7 | 14% | $0.03 | **Unlikely** |
| inflation | 5/7 | 57% | $0.38 | **Likely YES** |
| nintendo switch | 3/7 | 49% | $0.71 | **Likely YES** |
| remodel | 7/7 | 84% | $0.81 | **Strong YES** |
| revenue | 4/7 | 58% | $0.70 | **Likely YES** |
| roundel | 7/7 | 84% | $0.73 | **Strong YES** |
| snap | 0/7 | 14% | $0.03 | **Unlikely** |
| synthetic color | 1/7 | 32% | $0.46 | **Coin flip** |
| target plus | 6/7 | 75% | $0.76 | **Strong YES** |
| tariff | 5/7 | 67% | $0.54 | **Strong YES** |

---

## Toll Brothers (TOL)
**Upcoming event:** 2026-08-18

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| all cash | 7/7 | 84% | $0.90 | **Strong YES** |
| apartment | 5/7 | 67% | $0.71 | **Strong YES** |
| arkansas | 0/7 | 24% | $0.63 | **Unlikely** |
| buffington | 0/7 | 24% | $0.63 | **Unlikely** |
| buyback | 3/7 | 40% | $0.29 | **Coin flip** |
| california | 5/7 | 57% | $0.43 | **Likely YES** |
| cash buyer | 3/7 | 40% | $0.90 | **Coin flip** |
| customization | 0/7 | 14% | $0.59 | **Unlikely** |
| customize | 3/7 | 49% | $0.59 | **Likely YES** |
| florida | 6/7 | 75% | $0.64 | **Strong YES** |
| incentive | 7/7 | 84% | $0.95 | **Strong YES** |
| land bank | 4/7 | 58% | $0.76 | **Likely YES** |
| land banking | 3/7 | 49% | $0.76 | **Likely YES** |
| lumber | 1/7 | 32% | $0.62 | **Coin flip** |
| mortgage | 7/7 | 84% | $0.80 | **Strong YES** |
| move up buyer | 0/7 | 14% | - | **Unlikely** |
| spec home | 7/7 | 84% | $0.93 | **Strong YES** |
| tariff | 5/7 | 67% | $0.60 | **Strong YES** |

---

## Ulta Beauty (ULTA)
**Upcoming event:** 2026-08-27

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ai | 3/7 | 49% | $0.78 | **Likely YES** |
| artificial intelligence | 0/7 | 14% | $0.78 | **Unlikely** |
| diamond | 3/7 | 40% | $0.36 | **Coin flip** |
| gemini | 0/7 | 24% | $0.66 | **Unlikely** |
| google | 0/7 | 24% | $0.66 | **Unlikely** |
| headwind | 5/7 | 57% | $0.31 | **Likely YES** |
| holiday | 7/7 | 75% | $0.72 | **Strong YES** |
| iran | 0/7 | 14% | $0.74 | **Unlikely** |
| luxury | 5/7 | 67% | $0.78 | **Strong YES** |
| middle east | 4/7 | 58% | $0.74 | **Likely YES** |
| rare beauty | 1/7 | 32% | $0.76 | **Coin flip** |
| reward | 4/7 | 58% | $0.72 | **Likely YES** |
| store opening | 4/7 | 49% | $0.46 | **Likely YES** |
| tailwind | 3/7 | 49% | $0.28 | **Likely YES** |
| tariff | 4/7 | 49% | $0.40 | **Likely YES** |
| tiktok | 3/7 | 49% | $0.71 | **Likely YES** |
| times square | 0/7 | 24% | $0.33 | **Unlikely** |
| traffic | 5/7 | 67% | $0.68 | **Strong YES** |
| uncertainty | 5/7 | 67% | $0.90 | **Strong YES** |

---

## Urban Outfitters (URBN)
**Upcoming event:** 2026-08-26

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| back to school | 4/7 | 49% | $0.76 | **Likely YES** |
| beauty | 6/7 | 75% | $0.43 | **Strong YES** |
| claude | 0/7 | 24% | $0.04 | **Unlikely** |
| doordash | 0/7 | 24% | $0.19 | **Unlikely** |
| gemini | 0/7 | 24% | $0.25 | **Unlikely** |
| headwind | 4/7 | 58% | $0.71 | **Likely YES** |
| holiday | 6/7 | 66% | $0.55 | **Strong YES** |
| ieepa | 0/7 | 14% | $0.55 | **Unlikely** |
| international | 2/7 | 41% | $0.56 | **Coin flip** |
| internationally | 2/7 | 31% | $0.56 | **Coin flip** |
| middle east | 0/7 | 24% | $0.38 | **Unlikely** |
| refund | 0/7 | 24% | $0.69 | **Unlikely** |
| store opening | 5/7 | 67% | $0.73 | **Strong YES** |
| supply chain | 1/7 | 23% | $0.46 | **Unlikely** |
| tariff | 4/7 | 58% | $0.94 | **Likely YES** |

---

## Walmart (WMT)
**Upcoming event:** 2026-08-20

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| automation | 7/7 | 84% | $0.83 | **Strong YES** |
| automotive | 4/7 | 49% | $0.29 | **Likely YES** |
| brick and mortar | 2/7 | 31% | $0.18 | **Coin flip** |
| competition | 3/7 | 40% | $0.57 | **Coin flip** |
| competitor | 3/7 | 49% | $0.57 | **Likely YES** |
| drone | 0/7 | 24% | $0.38 | **Unlikely** |
| food stamp | 0/7 | 14% | $0.13 | **Unlikely** |
| fuel | 6/7 | 75% | $0.83 | **Strong YES** |
| gas | 2/7 | 41% | $0.83 | **Coin flip** |
| gasoline | 0/7 | 14% | $0.83 | **Unlikely** |
| market place | 0/7 | 14% | $0.91 | **Unlikely** |
| marketplace | 7/7 | 84% | $0.91 | **Strong YES** |
| omnichannel | 7/7 | 84% | $0.74 | **Strong YES** |
| prescription | 2/7 | 41% | $0.48 | **Coin flip** |
| roll back | 0/7 | 14% | $0.78 | **Unlikely** |
| rollback | 7/7 | 84% | $0.78 | **Strong YES** |
| snap | 1/7 | 23% | $0.13 | **Unlikely** |
| sparky | 3/7 | 49% | $0.69 | **Likely YES** |
| tariff | 5/7 | 67% | $0.83 | **Strong YES** |
| upper income | 1/7 | 23% | $0.14 | **Unlikely** |

---
