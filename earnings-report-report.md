# Earnings Report

Generated 2026-08-06 · 21 companies with upcoming word markets · 355 words

## Method

Targets are the words in currently open Kalshi earnings-mention markets (from the market caches). Word matching follows Kalshi's resolution rules (word boundaries, plural/possessive forms).

- Aggregate transitions over all upcoming words: P(word said | said last call) = 673/910 = 74.0% vs P(said | not said last call) = 322/1297 = 24.8% (base rate 45.1%)
- Baseline P blends the aggregate transition rate with the word's own presence rate (Laplace-smoothed); per-word evidence dominates as call history grows
- Baseline P: from prior earnings call transcripts (`transcripts/{TICKER}/`); '-' = no transcript history for the company
- Last YES: last traded price for the word's currently open market (Kalshi API, active markets only; the NO side is the pair complement and always sums to $1.00). '-' = no open market or fetch failed
- Verdict tiers: Strong YES (P ≥ 60%), Likely YES (45–60%), Coin flip (30–45%), Unlikely (<30%)

**1 of 21 companies lack transcript history** — run `./bin/kalshi transcripts --from-markets` to fill baselines.

## Opportunities (prior data vs market)

Sorted by |gap| — a positive gap means prior data says the word is more likely than the market prices it.

| Company | Word | Baseline P | Market YES | Gap |
|---|---|---|---|---|
| DKNG | super app | 24% | $0.99 | -75 |
| URBN | beauty | 75% | $0.00 | +75 |
| DKNG | retain | 23% | $0.96 | -73 |
| WMT | market place | 14% | $0.87 | -73 |
| CRWD | acquisition | 67% | $0.00 | +67 |
| TTWO | pre order | 14% | $0.80 | -66 |
| DKNG | world cup | 32% | $0.98 | -66 |
| ULTA | artificial intelligence | 14% | $0.78 | -64 |
| WMT | roll back | 14% | $0.78 | -64 |
| VST | up rate | 14% | $0.76 | -62 |
| DKNG | combo | 32% | $0.93 | -61 |
| NVDA | self driving | 14% | $0.74 | -60 |
| ULTA | iran | 14% | $0.71 | -57 |
| WMT | gasoline | 14% | $0.71 | -57 |
| DKNG | spanish | 32% | $0.89 | -57 |
| VST | cogentrix | 32% | $0.89 | -57 |
| NBIS | vera rubin | 24% | $0.79 | -55 |
| KLAR | artificial intelligence | 22% | $0.77 | -55 |
| WEN | project fresh | 41% | $0.94 | -53 |
| NBIS | triple ten | 14% | $0.67 | -53 |
| DKNG | competition | 40% | $0.92 | -52 |
| VST | investment grade | 32% | $0.84 | -52 |
| NBIS | click house | 14% | $0.65 | -51 |
| WEN | minions | 24% | $0.74 | -50 |
| TOL | cash buyer | 40% | $0.90 | -50 |
| NBIS | token | 49% | $0.99 | -50 |
| HIMS | eucalyptus | 32% | $0.80 | -48 |
| VST | meta | 32% | $0.80 | -48 |
| ULTA | gemini | 24% | $0.71 | -47 |
| ULTA | google | 24% | $0.71 | -47 |
| CAVA | artificial intelligence | 14% | $0.61 | -47 |
| CRWD | continuous identity | 14% | $0.61 | -47 |
| TTWO | gta plus | 31% | $0.78 | -47 |
| CRWD | cerebras | 14% | $0.60 | -46 |
| TOL | customization | 14% | $0.59 | -45 |
| CRWD | mythos | 24% | $0.68 | -44 |
| FUTU | tokenization | 23% | $0.66 | -43 |
| AMAT | agent | 14% | $0.57 | -43 |
| HIMS | wegovy | 41% | $0.82 | -41 |
| AMAT | epitaxy | 41% | $0.00 | +41 |
| COHR | apple | 31% | $0.71 | -40 |
| DKNG | alberta | 41% | $0.80 | -39 |
| AMAT | chinese | 40% | $0.79 | -39 |
| CAVA | dining | 66% | $0.28 | +38 |
| CAVA | salmon | 49% | $0.87 | -38 |
| COHR | nvidia | 41% | $0.78 | -37 |
| CRWD | xm cyber | 14% | $0.51 | -37 |
| FUTU | perp | 14% | $0.51 | -37 |
| VST | production tax credit | 40% | $0.76 | -36 |
| WEN | closure | 84% | $0.48 | +36 |
| TGT | back to school | 41% | $0.75 | -34 |
| FUTU | tokenized | 32% | $0.66 | -34 |
| ULTA | rare beauty | 32% | $0.66 | -34 |
| KLAR | walmart | 75% | $0.41 | +34 |
| AMAT | agentic | 24% | $0.57 | -33 |
| COHR | chips act | 23% | $0.56 | -33 |
| NBIS | uber | 57% | $0.24 | +33 |
| FUTU | agentic | 14% | $0.47 | -33 |
| HIMS | yourbio | 32% | $0.65 | -33 |
| CAVA | acceleration | 49% | $0.17 | +32 |
| CRWD | openai | 32% | $0.64 | -32 |
| CAVA | automation | 49% | $0.17 | +32 |
| NBIS | pennsylvania | 24% | $0.55 | -31 |
| TOL | arkansas | 24% | $0.55 | -31 |
| TOL | buffington | 24% | $0.55 | -31 |
| AMAT | screen | 31% | $0.00 | +31 |
| COHR | chinese | 31% | $0.00 | +31 |
| AMAT | broadcom | 14% | $0.45 | -31 |
| CRWD | claude | 41% | $0.71 | -30 |
| WMT | gas | 41% | $0.71 | -30 |
| COHR | american manufacturing | 31% | $0.60 | -29 |
| TOL | land banking | 49% | $0.78 | -29 |
| ULTA | ai | 49% | $0.78 | -29 |
| HIMS | testosterone | 67% | $0.95 | -28 |
| CAVA | cavacore | 14% | $0.42 | -28 |
| NVDA | dividend (2+ times) | 14% | $0.42 | -28 |
| TOL | lumber | 32% | $0.60 | -28 |
| URBN | store opening | 67% | $0.39 | +28 |
| NVDA | automation | 31% | $0.59 | -28 |
| FUTU | perpetual | 24% | $0.51 | -27 |
| WEN | tariff | 31% | $0.04 | +27 |
| AMAT | essilorluxottica | 14% | $0.41 | -27 |
| VST | permian | 58% | $0.85 | -27 |
| URBN | holiday | 66% | $0.39 | +27 |
| HIMS | canada | 49% | $0.76 | -27 |
| NBIS | gigawatt | 67% | $0.93 | -26 |
| ULTA | headwind | 57% | $0.31 | +26 |
| FUTU | kalshi | 24% | $0.49 | -25 |
| KLAR | gemini | 39% | $0.64 | -25 |
| CRWD | ai detection | 41% | $0.66 | -25 |
| WEN | freshai | 40% | $0.65 | -25 |
| TGT | autonomous | 14% | $0.39 | -25 |
| HD | volatility | 49% | $0.24 | +25 |
| HIMS | peptide | 67% | $0.91 | -24 |
| TTWO | playstation 5 | 40% | $0.64 | -24 |
| DKNG | expansion | 66% | $0.42 | +24 |
| HIMS | zava | 49% | $0.73 | -24 |
| URBN | claude | 24% | $0.00 | +24 |
| URBN | doordash | 24% | $0.00 | +24 |
| ULTA | uncertainty | 67% | $0.90 | -23 |
| COHR | china | 23% | $0.00 | +23 |
| NVDA | arizona | 23% | $0.00 | +23 |
| WMT | competitor | 49% | $0.27 | +22 |
| NVDA | hyperscaler | 67% | $0.89 | -22 |
| URBN | tariff | 58% | $0.80 | -22 |
| TGT | tariff | 67% | $0.45 | +22 |
| ULTA | tiktok | 49% | $0.71 | -22 |
| ULTA | tailwind | 49% | $0.28 | +21 |
| KLAR | jp morgan payment | 39% | $0.18 | +21 |
| DKNG | retention | 75% | $0.96 | -21 |
| COHR | zurich | 24% | $0.44 | -20 |
| WMT | drone | 24% | $0.44 | -20 |
| HIMS | longevity | 58% | $0.78 | -20 |
| NBIS | hyperscaler | 58% | $0.78 | -20 |
| TOL | land bank | 58% | $0.78 | -20 |
| TTWO | gta+ | 58% | $0.78 | -20 |
| CAVA | shrimp | 32% | $0.52 | -20 |
| WMT | sparky | 49% | $0.69 | -20 |
| TGT | circle 360 | 75% | $0.55 | +20 |
| KLAR | ai | 58% | $0.77 | -19 |
| TGT | inflation | 57% | $0.38 | +19 |
| ULTA | diamond | 40% | $0.59 | -19 |
| KLAR | sweden | 46% | $0.27 | +19 |
| NBIS | aether | 31% | $0.50 | -19 |
| CAVA | tariff | 49% | $0.30 | +19 |
| KLAR | pricerunner | 22% | $0.40 | -18 |
| TOL | california | 57% | $0.39 | +18 |
| HIMS | europe | 40% | $0.58 | -18 |
| CRWD | nvidia | 58% | $0.76 | -18 |
| VST | uprate | 58% | $0.76 | -18 |
| WEN | loyalty | 66% | $0.48 | +18 |
| KLAR | headwind | 51% | $0.33 | +18 |
| NBIS | tripleten | 49% | $0.67 | -18 |
| COHR | thermadite | 24% | $0.41 | -17 |
| CRWD | shadow | 41% | $0.58 | -17 |
| URBN | headwind | 58% | $0.75 | -17 |
| HD | lumber | 66% | $0.49 | +17 |
| DKNG | nbc | 41% | $0.24 | +17 |
| AMAT | singapore | 67% | $0.50 | +17 |
| DKNG | competitor | 75% | $0.92 | -17 |
| TOL | florida | 75% | $0.59 | +16 |
| TGT | automation | 23% | $0.39 | -16 |
| NBIS | nvidia | 67% | $0.83 | -16 |
| WEN | spicy chicken | 41% | $0.57 | -16 |
| TTWO | de santa | 32% | $0.16 | +16 |
| HD | tailwind | 49% | $0.65 | -16 |
| NVDA | hermes | 24% | $0.39 | -15 |
| COHR | sherman | 58% | $0.43 | +15 |
| HIMS | amazon | 40% | $0.25 | +15 |
| CAVA | cyclospora | 14% | $0.29 | -15 |
| CAVA | cyclosporiasis | 14% | $0.29 | -15 |
| ULTA | reward | 58% | $0.73 | -15 |
| FUTU | fraud | 32% | $0.47 | -15 |
| KLAR | headcount | 34% | $0.48 | -14 |
| WMT | tariff | 67% | $0.81 | -14 |
| AMAT | senz | 14% | $0.00 | +14 |
| AMAT | smart glasses | 14% | $0.00 | +14 |
| CRWD | germany | 14% | $0.00 | +14 |
| WEN | sonic | 14% | $0.28 | -14 |
| HD | storm | 58% | $0.72 | -14 |
| NBIS | meta | 49% | $0.63 | -14 |
| DKNG | espn | 49% | $0.36 | +13 |
| NVDA | domestic | 23% | $0.36 | -13 |
| URBN | supply chain | 23% | $0.36 | -13 |
| KLAR | banking license | 22% | $0.35 | -13 |
| NVDA | rent | 32% | $0.19 | +13 |
| TGT | roundel | 84% | $0.71 | +13 |
| WEN | delivery | 84% | $0.71 | +13 |
| WMT | omnichannel | 84% | $0.71 | +13 |
| NBIS | robotic | 40% | $0.27 | +13 |
| NVDA | h20 | 40% | $0.27 | +13 |
| WMT | competition | 40% | $0.27 | +13 |
| ULTA | middle east | 58% | $0.71 | -13 |
| HIMS | fda | 75% | $0.88 | -13 |
| HD | headwind | 49% | $0.62 | -13 |
| KLAR | inflation | 22% | $0.34 | -12 |
| HIMS | lab testing | 67% | $0.79 | -12 |
| HIMS | collaboration | 58% | $0.70 | -12 |
| VST | martin lake | 58% | $0.70 | -12 |
| TOL | tariff | 67% | $0.55 | +12 |
| WMT | automotive | 49% | $0.37 | +12 |
| DKNG | regulation | 49% | $0.61 | -12 |
| NBIS | convertible | 24% | $0.35 | -11 |
| TGT | nintendo switch | 49% | $0.38 | +11 |
| HIMS | tariff | 31% | $0.20 | +11 |
| KLAR | delinquency | 63% | $0.74 | -11 |
| NBIS | cash | 84% | $0.95 | -11 |
| NBIS | google | 14% | $0.25 | -11 |
| NVDA | omniverse | 66% | $0.55 | +11 |
| ULTA | store opening | 49% | $0.38 | +11 |
| ULTA | holiday | 75% | $0.64 | +11 |
| FUTU | australia | 75% | $0.65 | +10 |
| NBIS | clickhouse | 75% | $0.65 | +10 |
| NBIS | neocloud | 31% | $0.21 | +10 |
| FUTU | headwind | 23% | $0.33 | -10 |
| KLAR | southwest airlines | 22% | $0.32 | -10 |
| VST | capacity auction | 66% | $0.76 | -10 |
| NVDA | tariff | 40% | $0.30 | +10 |
| WEN | pickle | 14% | $0.24 | -10 |
| CAVA | hyphen | 23% | $0.13 | +10 |
| HD | tariff | 75% | $0.85 | -10 |
| URBN | back to school | 49% | $0.39 | +10 |
| NVDA | humanoid | 49% | $0.59 | -10 |
| TOL | customize | 49% | $0.59 | -10 |
| HD | inflation | 75% | $0.65 | +10 |
| TTWO | borderlands | 75% | $0.65 | +10 |
| ULTA | times square | 24% | $0.33 | -9 |
| AMAT | hybrid bonding | 67% | $0.76 | -9 |
| URBN | ieepa | 14% | $0.05 | +9 |
| CRWD | generative ai | 40% | $0.31 | +9 |
| COHR | indium phosphide | 75% | $0.84 | -9 |
| HD | revenue | 49% | $0.40 | +9 |
| ULTA | tariff | 49% | $0.40 | +9 |
| CRWD | gen ai | 23% | $0.31 | -8 |
| KLAR | profitability | 58% | $0.66 | -8 |
| CAVA | auv | 84% | $0.76 | +8 |
| CRWD | falcon flex | 84% | $0.92 | -8 |
| TTWO | zynga | 84% | $0.92 | -8 |
| WMT | food stamp | 14% | $0.22 | -8 |
| CAVA | spice | 58% | $0.66 | -8 |
| TGT | revenue | 58% | $0.66 | -8 |
| COHR | optical circuit switch | 66% | $0.58 | +8 |
| HD | competition | 41% | $0.33 | +8 |
| ULTA | luxury | 67% | $0.59 | +8 |
| CAVA | same store | 24% | $0.16 | +8 |
| URBN | middle east | 24% | $0.16 | +8 |
| FUTU | panthertrade | 24% | $0.31 | -7 |
| DKNG | nbcuniversal | 31% | $0.24 | +7 |
| HIMS | regulation | 31% | $0.24 | +7 |
| CAVA | catering | 67% | $0.74 | -7 |
| TOL | apartment | 67% | $0.74 | -7 |
| VST | oak hill | 67% | $0.74 | -7 |
| NVDA | talent | 40% | $0.47 | -7 |
| AMAT | epic center | 84% | $0.77 | +7 |
| AMAT | supply chain | 84% | $0.77 | +7 |
| TOL | incentive | 84% | $0.91 | -7 |
| WEN | inflation | 84% | $0.91 | -7 |
| CRWD | tailwind | 58% | $0.65 | -7 |
| CAVA | sweet potato | 32% | $0.39 | -7 |
| KLAR | credit quality | 63% | $0.56 | +7 |
| DKNG | railbird | 31% | $0.38 | -7 |
| TGT | target plus | 75% | $0.69 | +6 |
| KLAR | apple pay | 63% | $0.69 | -6 |
| CAVA | pita chips | 66% | $0.72 | -6 |
| TGT | food stamp | 14% | $0.08 | +6 |
| TGT | snap | 14% | $0.08 | +6 |
| WMT | rollback | 84% | $0.78 | +6 |
| TOL | all cash | 84% | $0.90 | -6 |
| DKNG | kalshi | 14% | $0.20 | -6 |
| HIMS | microdose | 14% | $0.20 | -6 |
| TTWO | vice city | 14% | $0.20 | -6 |
| TGT | synthetic color | 32% | $0.38 | -6 |
| CAVA | ai | 67% | $0.61 | +6 |
| NVDA | gm | 23% | $0.17 | +6 |
| HD | synergy | 31% | $0.26 | +5 |
| WMT | upper income | 23% | $0.28 | -5 |
| HIMS | vitamin | 57% | $0.52 | +5 |
| AMAT | chiplet | 41% | $0.46 | -5 |
| DKNG | horse | 14% | $0.09 | +5 |
| AMAT | china | 84% | $0.79 | +5 |
| VST | comanche peak | 84% | $0.79 | +5 |
| VST | hyperscaler | 84% | $0.79 | +5 |
| TGT | beauty | 84% | $0.89 | -5 |
| WEN | app | 84% | $0.89 | -5 |
| TGT | competition | 40% | $0.35 | +5 |
| FUTU | cftc | 14% | $0.19 | -5 |
| TTWO | wembanyama | 14% | $0.19 | -5 |
| URBN | international | 41% | $0.36 | +5 |
| NBIS | blackwell | 57% | $0.62 | -5 |
| HD | shutdown | 23% | $0.18 | +5 |
| NVDA | trump | 23% | $0.18 | +5 |
| URBN | internationally | 31% | $0.36 | -5 |
| CRWD | aws | 75% | $0.80 | -5 |
| URBN | refund | 24% | $0.19 | +5 |
| WEN | biggie bundle | 24% | $0.28 | -4 |
| COHR | silicon photonics | 75% | $0.71 | +4 |
| WMT | fuel | 75% | $0.71 | +4 |
| WEN | baconator | 31% | $0.27 | +4 |
| TOL | mortgage | 84% | $0.80 | +4 |
| TTWO | red dead | 84% | $0.88 | -4 |
| TOL | buyback | 40% | $0.36 | +4 |
| DKNG | spain | 14% | $0.18 | -4 |
| FUTU | expert | 14% | $0.18 | -4 |
| KLAR | tailwind | 39% | $0.35 | +4 |
| CRWD | china | 31% | $0.35 | -4 |
| FUTU | staking | 49% | $0.53 | -4 |
| WMT | brick and mortar | 31% | $0.28 | +3 |
| COHR | liquid crystal | 66% | $0.69 | -3 |
| DKNG | moonshot | 14% | $0.11 | +3 |
| TGT | remodel | 84% | $0.81 | +3 |
| WMT | marketplace | 84% | $0.87 | -3 |
| NVDA | general motors | 14% | $0.17 | -3 |
| HIMS | wearable | 58% | $0.61 | -3 |
| HIMS | microdosing | 23% | $0.20 | +3 |
| HIMS | cancer | 49% | $0.46 | +3 |
| FUTU | tailwind | 23% | $0.25 | -2 |
| TTWO | switch 2 | 67% | $0.69 | -2 |
| TOL | spec home | 84% | $0.82 | +2 |
| TTWO | tailwind | 57% | $0.59 | -2 |
| HD | mexico | 75% | $0.77 | -2 |
| WEN | frosty | 75% | $0.77 | -2 |
| URBN | gemini | 24% | $0.25 | -1 |
| CAVA | expansion | 75% | $0.74 | +1 |
| VST | buyback | 31% | $0.30 | +1 |
| COHR | thermal management | 41% | $0.42 | -1 |
| WMT | prescription | 41% | $0.42 | -1 |
| HD | innovation | 84% | $0.85 | -1 |
| NVDA | gaming | 84% | $0.85 | -1 |
| WMT | automation | 84% | $0.85 | -1 |
| DKNG | feature | 58% | $0.59 | -1 |
| WEN | ranch | 32% | $0.33 | -1 |
| NVDA | cosmos | 57% | $0.58 | -1 |
| VST | moss landing | 57% | $0.58 | -1 |
| TTWO | mafia | 67% | $0.66 | +1 |
| NVDA | taiwan | 23% | $0.22 | +1 |
| WMT | snap | 23% | $0.22 | +1 |
| HD | weather | 75% | $0.76 | -1 |
| VST | ptc | 75% | $0.76 | -1 |
| NVDA | tsmc | 49% | $0.49 | -0 |
| ULTA | traffic | 67% | $0.67 | -0 |
| CRWD | consolidation | 84% | $0.84 | +0 |

## Air Canada (AC)
**Upcoming event:** 2026-08-12
*No transcript history — baseline unavailable. Run `./bin/kalshi transcripts --from-markets` to fill it in.*

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| a350 | - | - | $0.18 | **-** |
| airbus | - | - | $0.72 | **-** |
| cuba | - | - | $0.36 | **-** |
| cuban | - | - | $0.36 | **-** |
| headwind | - | - | $0.62 | **-** |
| inflation | - | - | $0.56 | **-** |
| iran | - | - | $0.80 | **-** |
| laguardia | - | - | $0.22 | **-** |
| license | - | - | $0.22 | **-** |
| licensed | - | - | $0.22 | **-** |
| middle east | - | - | $0.80 | **-** |
| tailwind | - | - | $0.59 | **-** |
| tariff | - | - | $0.27 | **-** |
| weather | - | - | $0.44 | **-** |
| world cup | - | - | $0.50 | **-** |

---

## Applied Materials (AMAT)
**Upcoming event:** 2026-08-13

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| agent | 0/7 | 14% | $0.57 | **Unlikely** |
| agentic | 0/7 | 24% | $0.57 | **Unlikely** |
| broadcom | 0/7 | 14% | $0.45 | **Unlikely** |
| china | 7/7 | 84% | $0.79 | **Strong YES** |
| chinese | 3/7 | 40% | $0.79 | **Coin flip** |
| chiplet | 2/7 | 41% | $0.46 | **Coin flip** |
| epic center | 7/7 | 84% | $0.77 | **Strong YES** |
| epitaxy | 2/7 | 41% | $0.00 | **Coin flip** |
| essilorluxottica | 0/7 | 14% | $0.41 | **Unlikely** |
| hybrid bonding | 5/7 | 67% | $0.76 | **Strong YES** |
| screen | 2/7 | 31% | $0.00 | **Coin flip** |
| senz | 0/7 | 14% | $0.00 | **Unlikely** |
| singapore | 5/7 | 67% | $0.50 | **Strong YES** |
| smart glasses | 0/7 | 14% | $0.00 | **Unlikely** |
| supply chain | 7/7 | 84% | $0.77 | **Strong YES** |

---

## CAVA Group (CAVA)
**Upcoming event:** 2026-08-11

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| acceleration | 3/7 | 49% | $0.17 | **Likely YES** |
| ai | 5/7 | 67% | $0.61 | **Strong YES** |
| artificial intelligence | 0/7 | 14% | $0.61 | **Unlikely** |
| automation | 4/7 | 49% | $0.17 | **Likely YES** |
| auv | 7/7 | 84% | $0.76 | **Strong YES** |
| catering | 5/7 | 67% | $0.74 | **Strong YES** |
| cavacore | 0/7 | 14% | $0.42 | **Unlikely** |
| cyclospora | 0/7 | 14% | $0.29 | **Unlikely** |
| cyclosporiasis | 0/7 | 14% | $0.29 | **Unlikely** |
| dining | 6/7 | 66% | $0.28 | **Strong YES** |
| expansion | 6/7 | 75% | $0.74 | **Strong YES** |
| hyphen | 1/7 | 23% | $0.13 | **Unlikely** |
| pita chips | 6/7 | 66% | $0.72 | **Strong YES** |
| salmon | 3/7 | 49% | $0.87 | **Likely YES** |
| same store | 0/7 | 24% | $0.16 | **Unlikely** |
| shrimp | 1/7 | 32% | $0.52 | **Coin flip** |
| spice | 4/7 | 58% | $0.66 | **Likely YES** |
| sweet potato | 1/7 | 32% | $0.39 | **Coin flip** |
| tariff | 4/7 | 49% | $0.30 | **Likely YES** |

---

## Cerebras Systems (CBRS)
**Upcoming event:** 2026-08-12

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| amd | - | - | $0.72 | **-** |
| aws | - | - | $0.91 | **-** |
| bell canada | - | - | $0.03 | **-** |
| crowd strike | - | - | $0.65 | **-** |
| crowdstrike | - | - | $0.65 | **-** |
| customer concentration | - | - | $0.21 | **-** |
| disaggregated | - | - | $0.69 | **-** |
| europe | - | - | $0.73 | **-** |
| falcon | - | - | $0.46 | **-** |
| flex | - | - | $0.56 | **-** |
| helios | - | - | $0.55 | **-** |
| kimi | - | - | $0.53 | **-** |
| openai | - | - | $0.91 | **-** |
| trainium | - | - | $0.00 | **-** |
| wafer scale engine | - | - | $0.29 | **-** |

---

## Coherent (COHR)
**Upcoming event:** 2026-08-12

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| american manufacturing | 2/7 | 31% | $0.60 | **Coin flip** |
| apple | 2/7 | 31% | $0.71 | **Coin flip** |
| china | 1/7 | 23% | $0.00 | **Unlikely** |
| chinese | 2/7 | 31% | $0.00 | **Coin flip** |
| chips act | 1/7 | 23% | $0.56 | **Unlikely** |
| indium phosphide | 6/7 | 75% | $0.84 | **Strong YES** |
| liquid crystal | 6/7 | 66% | $0.69 | **Strong YES** |
| multi rail | 0/7 | 14% | - | **Unlikely** |
| nvidia | 2/7 | 41% | $0.78 | **Coin flip** |
| optical circuit switch | 6/7 | 66% | $0.58 | **Strong YES** |
| sherman | 4/7 | 58% | $0.43 | **Likely YES** |
| silicon photonics | 6/7 | 75% | $0.71 | **Strong YES** |
| thermadite | 0/7 | 24% | $0.41 | **Unlikely** |
| thermal management | 2/7 | 41% | $0.42 | **Coin flip** |
| zurich | 0/7 | 24% | $0.44 | **Unlikely** |

---

## CrowdStrike (CRWD)
**Upcoming event:** 2026-08-26

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| acquisition | 5/7 | 67% | $0.00 | **Strong YES** |
| ai detection | 2/7 | 41% | $0.66 | **Coin flip** |
| aws | 6/7 | 75% | $0.80 | **Strong YES** |
| cerebras | 0/7 | 14% | $0.60 | **Unlikely** |
| china | 2/7 | 31% | $0.35 | **Coin flip** |
| claude | 2/7 | 41% | $0.71 | **Coin flip** |
| consolidation | 7/7 | 84% | $0.84 | **Strong YES** |
| continuous identity | 0/7 | 14% | $0.61 | **Unlikely** |
| falcon flex | 7/7 | 84% | $0.92 | **Strong YES** |
| gen ai | 1/7 | 23% | $0.31 | **Unlikely** |
| generative ai | 3/7 | 40% | $0.31 | **Coin flip** |
| germany | 0/7 | 14% | $0.00 | **Unlikely** |
| mythos | 0/7 | 24% | $0.68 | **Unlikely** |
| nvidia | 4/7 | 58% | $0.76 | **Likely YES** |
| openai | 1/7 | 32% | $0.64 | **Coin flip** |
| shadow | 2/7 | 41% | $0.58 | **Coin flip** |
| tailwind | 4/7 | 58% | $0.65 | **Likely YES** |
| xm cyber | 0/7 | 14% | $0.51 | **Unlikely** |

---

## DraftKings (DKNG)
**Upcoming event:** 2026-08-07

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| alberta | 2/7 | 41% | $0.80 | **Coin flip** |
| combo | 1/7 | 32% | $0.93 | **Coin flip** |
| competition | 3/7 | 40% | $0.92 | **Coin flip** |
| competitor | 6/7 | 75% | $0.92 | **Strong YES** |
| espn | 3/7 | 49% | $0.36 | **Likely YES** |
| expansion | 6/7 | 66% | $0.42 | **Strong YES** |
| feature | 4/7 | 58% | $0.59 | **Likely YES** |
| horse | 0/7 | 14% | $0.09 | **Unlikely** |
| kalshi | 0/7 | 14% | $0.20 | **Unlikely** |
| moonshot | 0/7 | 14% | $0.11 | **Unlikely** |
| nbc | 2/7 | 41% | $0.24 | **Coin flip** |
| nbcuniversal | 2/7 | 31% | $0.24 | **Coin flip** |
| railbird | 2/7 | 31% | $0.38 | **Coin flip** |
| regulation | 3/7 | 49% | $0.61 | **Likely YES** |
| retain | 1/7 | 23% | $0.96 | **Unlikely** |
| retention | 6/7 | 75% | $0.96 | **Strong YES** |
| spain | 0/7 | 14% | $0.18 | **Unlikely** |
| spanish | 1/7 | 32% | $0.89 | **Coin flip** |
| super app | 0/7 | 24% | $0.99 | **Unlikely** |
| world cup | 1/7 | 32% | $0.98 | **Coin flip** |

---

## Futu Holdings (FUTU)
**Upcoming event:** 2026-08-20

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| agentic | 0/7 | 14% | $0.47 | **Unlikely** |
| australia | 6/7 | 75% | $0.65 | **Strong YES** |
| cftc | 0/7 | 14% | $0.19 | **Unlikely** |
| expert | 0/7 | 14% | $0.18 | **Unlikely** |
| fraud | 1/7 | 32% | $0.47 | **Coin flip** |
| headwind | 1/7 | 23% | $0.33 | **Unlikely** |
| kalshi | 0/7 | 24% | $0.49 | **Unlikely** |
| panthertrade | 0/7 | 24% | $0.31 | **Unlikely** |
| perp | 0/7 | 14% | $0.51 | **Unlikely** |
| perpetual | 0/7 | 24% | $0.51 | **Unlikely** |
| staking | 3/7 | 49% | $0.53 | **Likely YES** |
| tailwind | 1/7 | 23% | $0.25 | **Unlikely** |
| tokenization | 1/7 | 23% | $0.66 | **Unlikely** |
| tokenized | 1/7 | 32% | $0.66 | **Coin flip** |

---

## The Home Depot (HD)
**Upcoming event:** 2026-08-18

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| competition | 2/7 | 41% | $0.33 | **Coin flip** |
| e commerce | 0/7 | 14% | - | **Unlikely** |
| headwind | 3/7 | 49% | $0.62 | **Likely YES** |
| inflation | 7/7 | 75% | $0.65 | **Strong YES** |
| innovation | 7/7 | 84% | $0.85 | **Strong YES** |
| lumber | 6/7 | 66% | $0.49 | **Strong YES** |
| mexico | 6/7 | 75% | $0.77 | **Strong YES** |
| revenue | 4/7 | 49% | $0.40 | **Likely YES** |
| shutdown | 1/7 | 23% | $0.18 | **Unlikely** |
| storm | 4/7 | 58% | $0.72 | **Likely YES** |
| synergy | 2/7 | 31% | $0.26 | **Coin flip** |
| tailwind | 3/7 | 49% | $0.65 | **Likely YES** |
| tariff | 6/7 | 75% | $0.85 | **Strong YES** |
| volatility | 4/7 | 49% | $0.24 | **Likely YES** |
| weather | 6/7 | 75% | $0.76 | **Strong YES** |

---

## Hims & Hers Health (HIMS)
**Upcoming event:** 2026-08-10

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| amazon | 3/7 | 40% | $0.25 | **Coin flip** |
| canada | 3/7 | 49% | $0.76 | **Likely YES** |
| cancer | 4/7 | 49% | $0.46 | **Likely YES** |
| collaboration | 4/7 | 58% | $0.70 | **Likely YES** |
| eucalyptus | 1/7 | 32% | $0.80 | **Coin flip** |
| europe | 3/7 | 40% | $0.58 | **Coin flip** |
| fda | 6/7 | 75% | $0.88 | **Strong YES** |
| lab testing | 5/7 | 67% | $0.79 | **Strong YES** |
| longevity | 4/7 | 58% | $0.78 | **Likely YES** |
| microdose | 0/7 | 14% | $0.20 | **Unlikely** |
| microdosing | 1/7 | 23% | $0.20 | **Unlikely** |
| peptide | 5/7 | 67% | $0.91 | **Strong YES** |
| regulation | 2/7 | 31% | $0.24 | **Coin flip** |
| tariff | 2/7 | 31% | $0.20 | **Coin flip** |
| testosterone | 5/7 | 67% | $0.95 | **Strong YES** |
| vitamin | 5/7 | 57% | $0.52 | **Likely YES** |
| wearable | 4/7 | 58% | $0.61 | **Likely YES** |
| wegovy | 2/7 | 41% | $0.82 | **Coin flip** |
| yourbio | 1/7 | 32% | $0.65 | **Coin flip** |
| zava | 3/7 | 49% | $0.73 | **Likely YES** |

---

## Klarna Group (KLAR)
**Upcoming event:** 2026-08-18

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ai | 3/3 | 58% | $0.77 | **Likely YES** |
| apple pay | 2/3 | 63% | $0.69 | **Strong YES** |
| artificial intelligence | 0/3 | 22% | $0.77 | **Unlikely** |
| banking license | 0/3 | 22% | $0.35 | **Unlikely** |
| credit quality | 2/3 | 63% | $0.56 | **Strong YES** |
| delinquency | 2/3 | 63% | $0.74 | **Strong YES** |
| gemini | 0/3 | 39% | $0.64 | **Coin flip** |
| headcount | 1/3 | 34% | $0.48 | **Coin flip** |
| headwind | 1/3 | 51% | $0.33 | **Likely YES** |
| inflation | 0/3 | 22% | $0.34 | **Unlikely** |
| jp morgan payment | 0/3 | 39% | $0.18 | **Coin flip** |
| pricerunner | 0/3 | 22% | $0.40 | **Unlikely** |
| profitability | 3/3 | 58% | $0.66 | **Likely YES** |
| southwest airlines | 0/3 | 22% | $0.32 | **Unlikely** |
| sweden | 2/3 | 46% | $0.27 | **Likely YES** |
| tailwind | 0/3 | 39% | $0.35 | **Coin flip** |
| walmart | 3/3 | 75% | $0.41 | **Strong YES** |

---

## Nebius Group (NBIS)
**Upcoming event:** 2026-08-06

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| aether | 2/7 | 31% | $0.50 | **Coin flip** |
| blackwell | 5/7 | 57% | $0.62 | **Likely YES** |
| cash | 7/7 | 84% | $0.95 | **Strong YES** |
| click house | 0/7 | 14% | $0.65 | **Unlikely** |
| clickhouse | 6/7 | 75% | $0.65 | **Strong YES** |
| convertible | 0/7 | 24% | $0.35 | **Unlikely** |
| gigawatt | 5/7 | 67% | $0.93 | **Strong YES** |
| google | 0/7 | 14% | $0.25 | **Unlikely** |
| hyperscaler | 4/7 | 58% | $0.78 | **Likely YES** |
| meta | 3/7 | 49% | $0.63 | **Likely YES** |
| neocloud | 2/7 | 31% | $0.21 | **Coin flip** |
| nvidia | 5/7 | 67% | $0.83 | **Strong YES** |
| pennsylvania | 0/7 | 24% | $0.55 | **Unlikely** |
| robotic | 3/7 | 40% | $0.27 | **Coin flip** |
| token | 3/7 | 49% | $0.99 | **Likely YES** |
| triple ten | 0/7 | 14% | $0.67 | **Unlikely** |
| tripleten | 3/7 | 49% | $0.67 | **Likely YES** |
| uber | 5/7 | 57% | $0.24 | **Likely YES** |
| vera rubin | 0/7 | 24% | $0.79 | **Unlikely** |

---

## NVIDIA (NVDA)
**Upcoming event:** 2026-08-26

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| arizona | 1/7 | 23% | $0.00 | **Unlikely** |
| automation | 2/7 | 31% | $0.59 | **Coin flip** |
| cosmos | 5/7 | 57% | $0.58 | **Likely YES** |
| dividend (2+ times) | 0/7 | 14% | $0.42 | **Unlikely** |
| domestic | 1/7 | 23% | $0.36 | **Unlikely** |
| gaming | 7/7 | 84% | $0.85 | **Strong YES** |
| general motors | 0/7 | 14% | $0.17 | **Unlikely** |
| gm | 1/7 | 23% | $0.17 | **Unlikely** |
| h20 | 3/7 | 40% | $0.27 | **Coin flip** |
| hermes | 0/7 | 24% | $0.39 | **Unlikely** |
| humanoid | 3/7 | 49% | $0.59 | **Likely YES** |
| hyperscaler | 5/7 | 67% | $0.89 | **Strong YES** |
| omniverse | 6/7 | 66% | $0.55 | **Strong YES** |
| rent | 1/7 | 32% | $0.19 | **Coin flip** |
| self driving | 0/7 | 14% | $0.74 | **Unlikely** |
| taiwan | 1/7 | 23% | $0.22 | **Unlikely** |
| talent | 3/7 | 40% | $0.47 | **Coin flip** |
| tariff | 3/7 | 40% | $0.30 | **Coin flip** |
| trump | 1/7 | 23% | $0.18 | **Unlikely** |
| tsmc | 4/7 | 49% | $0.49 | **Likely YES** |

---

## Target (TGT)
**Upcoming event:** 2026-08-19

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| automation | 1/7 | 23% | $0.39 | **Unlikely** |
| autonomous | 0/7 | 14% | $0.39 | **Unlikely** |
| back to school | 2/7 | 41% | $0.75 | **Coin flip** |
| beauty | 7/7 | 84% | $0.89 | **Strong YES** |
| circle 360 | 7/7 | 75% | $0.55 | **Strong YES** |
| competition | 3/7 | 40% | $0.35 | **Coin flip** |
| food stamp | 0/7 | 14% | $0.08 | **Unlikely** |
| inflation | 5/7 | 57% | $0.38 | **Likely YES** |
| nintendo switch | 3/7 | 49% | $0.38 | **Likely YES** |
| remodel | 7/7 | 84% | $0.81 | **Strong YES** |
| revenue | 4/7 | 58% | $0.66 | **Likely YES** |
| roundel | 7/7 | 84% | $0.71 | **Strong YES** |
| snap | 0/7 | 14% | $0.08 | **Unlikely** |
| synthetic color | 1/7 | 32% | $0.38 | **Coin flip** |
| target plus | 6/7 | 75% | $0.69 | **Strong YES** |
| tariff | 5/7 | 67% | $0.45 | **Strong YES** |

---

## Toll Brothers (TOL)
**Upcoming event:** 2026-08-18

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| all cash | 7/7 | 84% | $0.90 | **Strong YES** |
| apartment | 5/7 | 67% | $0.74 | **Strong YES** |
| arkansas | 0/7 | 24% | $0.55 | **Unlikely** |
| buffington | 0/7 | 24% | $0.55 | **Unlikely** |
| buyback | 3/7 | 40% | $0.36 | **Coin flip** |
| california | 5/7 | 57% | $0.39 | **Likely YES** |
| cash buyer | 3/7 | 40% | $0.90 | **Coin flip** |
| customization | 0/7 | 14% | $0.59 | **Unlikely** |
| customize | 3/7 | 49% | $0.59 | **Likely YES** |
| florida | 6/7 | 75% | $0.59 | **Strong YES** |
| incentive | 7/7 | 84% | $0.91 | **Strong YES** |
| land bank | 4/7 | 58% | $0.78 | **Likely YES** |
| land banking | 3/7 | 49% | $0.78 | **Likely YES** |
| lumber | 1/7 | 32% | $0.60 | **Coin flip** |
| mortgage | 7/7 | 84% | $0.80 | **Strong YES** |
| move up buyer | 0/7 | 14% | - | **Unlikely** |
| spec home | 7/7 | 84% | $0.82 | **Strong YES** |
| tariff | 5/7 | 67% | $0.55 | **Strong YES** |

---

## Take-Two Interactive Software (TTWO)
**Upcoming event:** 2026-08-07

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| borderlands | 7/7 | 75% | $0.65 | **Strong YES** |
| de santa | 1/7 | 32% | $0.16 | **Coin flip** |
| gta plus | 2/7 | 31% | $0.78 | **Coin flip** |
| gta+ | 4/7 | 58% | $0.78 | **Likely YES** |
| mafia | 5/7 | 67% | $0.66 | **Strong YES** |
| playstation 5 | 3/7 | 40% | $0.64 | **Coin flip** |
| pre order | 0/7 | 14% | $0.80 | **Unlikely** |
| red dead | 7/7 | 84% | $0.88 | **Strong YES** |
| switch 2 | 5/7 | 67% | $0.69 | **Strong YES** |
| tailwind | 5/7 | 57% | $0.59 | **Likely YES** |
| vice city | 0/7 | 14% | $0.20 | **Unlikely** |
| wembanyama | 0/7 | 14% | $0.19 | **Unlikely** |
| zynga | 7/7 | 84% | $0.92 | **Strong YES** |

---

## Ulta Beauty (ULTA)
**Upcoming event:** 2026-08-27

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| ai | 3/7 | 49% | $0.78 | **Likely YES** |
| artificial intelligence | 0/7 | 14% | $0.78 | **Unlikely** |
| diamond | 3/7 | 40% | $0.59 | **Coin flip** |
| gemini | 0/7 | 24% | $0.71 | **Unlikely** |
| google | 0/7 | 24% | $0.71 | **Unlikely** |
| headwind | 5/7 | 57% | $0.31 | **Likely YES** |
| holiday | 7/7 | 75% | $0.64 | **Strong YES** |
| iran | 0/7 | 14% | $0.71 | **Unlikely** |
| luxury | 5/7 | 67% | $0.59 | **Strong YES** |
| middle east | 4/7 | 58% | $0.71 | **Likely YES** |
| rare beauty | 1/7 | 32% | $0.66 | **Coin flip** |
| reward | 4/7 | 58% | $0.73 | **Likely YES** |
| store opening | 4/7 | 49% | $0.38 | **Likely YES** |
| tailwind | 3/7 | 49% | $0.28 | **Likely YES** |
| tariff | 4/7 | 49% | $0.40 | **Likely YES** |
| tiktok | 3/7 | 49% | $0.71 | **Likely YES** |
| times square | 0/7 | 24% | $0.33 | **Unlikely** |
| traffic | 5/7 | 67% | $0.67 | **Strong YES** |
| uncertainty | 5/7 | 67% | $0.90 | **Strong YES** |

---

## Urban Outfitters (URBN)
**Upcoming event:** 2026-08-26

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| back to school | 4/7 | 49% | $0.39 | **Likely YES** |
| beauty | 6/7 | 75% | $0.00 | **Strong YES** |
| claude | 0/7 | 24% | $0.00 | **Unlikely** |
| doordash | 0/7 | 24% | $0.00 | **Unlikely** |
| gemini | 0/7 | 24% | $0.25 | **Unlikely** |
| headwind | 4/7 | 58% | $0.75 | **Likely YES** |
| holiday | 6/7 | 66% | $0.39 | **Strong YES** |
| ieepa | 0/7 | 14% | $0.05 | **Unlikely** |
| international | 2/7 | 41% | $0.36 | **Coin flip** |
| internationally | 2/7 | 31% | $0.36 | **Coin flip** |
| middle east | 0/7 | 24% | $0.16 | **Unlikely** |
| refund | 0/7 | 24% | $0.19 | **Unlikely** |
| store opening | 5/7 | 67% | $0.39 | **Strong YES** |
| supply chain | 1/7 | 23% | $0.36 | **Unlikely** |
| tariff | 4/7 | 58% | $0.80 | **Likely YES** |

---

## Vistra (VST)
**Upcoming event:** 2026-08-07

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| buyback | 2/7 | 31% | $0.30 | **Coin flip** |
| capacity auction | 6/7 | 66% | $0.76 | **Strong YES** |
| co location | 0/7 | 14% | - | **Unlikely** |
| cogentrix | 1/7 | 32% | $0.89 | **Coin flip** |
| comanche peak | 7/7 | 84% | $0.79 | **Strong YES** |
| hyperscaler | 7/7 | 84% | $0.79 | **Strong YES** |
| investment grade | 1/7 | 32% | $0.84 | **Coin flip** |
| martin lake | 4/7 | 58% | $0.70 | **Likely YES** |
| meta | 1/7 | 32% | $0.80 | **Coin flip** |
| moss landing | 5/7 | 57% | $0.58 | **Likely YES** |
| oak hill | 5/7 | 67% | $0.74 | **Strong YES** |
| permian | 4/7 | 58% | $0.85 | **Likely YES** |
| production tax credit | 3/7 | 40% | $0.76 | **Coin flip** |
| ptc | 6/7 | 75% | $0.76 | **Strong YES** |
| up rate | 0/7 | 14% | $0.76 | **Unlikely** |
| uprate | 4/7 | 58% | $0.76 | **Likely YES** |

---

## The Wendy's Company (WEN)
**Upcoming event:** 2026-08-07

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| app | 7/7 | 84% | $0.89 | **Strong YES** |
| baconator | 2/7 | 31% | $0.27 | **Coin flip** |
| biggie bundle | 0/7 | 24% | $0.28 | **Unlikely** |
| closure | 7/7 | 84% | $0.48 | **Strong YES** |
| delivery | 7/7 | 84% | $0.71 | **Strong YES** |
| freshai | 3/7 | 40% | $0.65 | **Coin flip** |
| frosty | 6/7 | 75% | $0.77 | **Strong YES** |
| inflation | 7/7 | 84% | $0.91 | **Strong YES** |
| loyalty | 6/7 | 66% | $0.48 | **Strong YES** |
| minions | 0/7 | 24% | $0.74 | **Unlikely** |
| pickle | 0/7 | 14% | $0.24 | **Unlikely** |
| project fresh | 2/7 | 41% | $0.94 | **Coin flip** |
| ranch | 1/7 | 32% | $0.33 | **Coin flip** |
| sonic | 0/7 | 14% | $0.28 | **Unlikely** |
| spicy chicken | 2/7 | 41% | $0.57 | **Coin flip** |
| tariff | 2/7 | 31% | $0.04 | **Coin flip** |

---

## Walmart (WMT)
**Upcoming event:** 2026-08-20

| Word | Prior calls | Baseline P | Last YES | Verdict |
|---|---|---|---|---|
| automation | 7/7 | 84% | $0.85 | **Strong YES** |
| automotive | 4/7 | 49% | $0.37 | **Likely YES** |
| brick and mortar | 2/7 | 31% | $0.28 | **Coin flip** |
| competition | 3/7 | 40% | $0.27 | **Coin flip** |
| competitor | 3/7 | 49% | $0.27 | **Likely YES** |
| drone | 0/7 | 24% | $0.44 | **Unlikely** |
| food stamp | 0/7 | 14% | $0.22 | **Unlikely** |
| fuel | 6/7 | 75% | $0.71 | **Strong YES** |
| gas | 2/7 | 41% | $0.71 | **Coin flip** |
| gasoline | 0/7 | 14% | $0.71 | **Unlikely** |
| market place | 0/7 | 14% | $0.87 | **Unlikely** |
| marketplace | 7/7 | 84% | $0.87 | **Strong YES** |
| omnichannel | 7/7 | 84% | $0.71 | **Strong YES** |
| prescription | 2/7 | 41% | $0.42 | **Coin flip** |
| roll back | 0/7 | 14% | $0.78 | **Unlikely** |
| rollback | 7/7 | 84% | $0.78 | **Strong YES** |
| snap | 1/7 | 23% | $0.22 | **Unlikely** |
| sparky | 3/7 | 49% | $0.69 | **Likely YES** |
| tariff | 5/7 | 67% | $0.81 | **Strong YES** |
| upper income | 1/7 | 23% | $0.28 | **Unlikely** |

---
