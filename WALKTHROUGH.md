# Walkthrough - Historical Mentions Analysis

I have completed a deep-dive analysis into Kalshi's "mention" markets by transitioning from market-level to event-level querying. This allowed for more precise identification of mention-based events across nearly 40,000 settled records.

## Results Overview

- **Dataset**: ~38,857 settled events from the past 30 days.
- **Identified Mentions**: 346 unique events specifically related to "mentions" (e.g., political interviews, earnings calls, sports commentary).
- **Persistence**: Implemented a durable extraction process that saves progress (cursor and data) every 200 records.

## Focus: Sports Announcer Markets

I analyzed the **win rates** for specific words used in sports markets (NBA, NCAAB, NFL).

### Top 10 High-Hit Words (Win Rates)
| Word | Total Markets | Win Rate |
| :--- | :--- | :--- |
| **Injury / Injured** | 65 | 93.85% |
| **Crowd / Crowded** | 19 | 89.47% |
| **All-Star** | 46 | 84.78% |
| **Elbow** | 83 | 78.31% |
| **Trade / Trades / Traded** | 64 | 78.13% |
| **Playoff** | 63 | 76.19% |
| **Tech / Technical** | 65 | 69.23% |
| **MVP** | 72 | 63.89% |
| **Airball** | 24 | 62.50% |
| **Draft** | 37 | 62.16% |

### Lowest Hit Words
| Word | Total Markets | Win Rate |
| :--- | :--- | :--- |
| **NIL** | 18 | 5.56% |
| **March Madness** | 18 | 11.11% |
| **Walk On** | 18 | 11.11% |
| **Triple Double** | 65 | 43.08% |
| **Buzzer** | 65 | 40.00% |
| **Alley-oop** | 82 | 39.02% |

## Key Changes & Improvements

### Transitions to Events API
I refactored the data retrieval to use the [Kalshi V2 Events API](https://docs.kalshi.com/api-reference/events/get-events).

**Updated API Methods in `lib/api.js`**:
- `getEvents(opts)`: Fetch list of events with filters.
- `getEvent(ticker)`: Fetch individual event details with nested markets.

### Analysis Scripts
- `lib/analysis.js`: Main extraction script with rate limiting and persistence.
- `lib/analyze_announcer_markets.js`: Calculates win rates from the extracted Nested Markets data.
- `lib/analyze_types.js`: Categorizes mention triggers by sector (Politics, Sports, etc.).

## How to Run
To extract the latest month of settled events:
```bash
bun run lib/analysis.js
```
To analyze the win rates for unique words:
```bash
bun run lib/analyze_announcer_markets.js
```
