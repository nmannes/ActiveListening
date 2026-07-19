# Trading Risk Gates — What We Have & What's Missing

## Existing Quality Gates (Runtime)

These fire in order during `SignalHandler.handle_signal()` and the scheduling pipeline:

### 1. Scheduling-time gates (before any session launches)

| Gate | Where | What it does |
|------|-------|--------------|
| Unscheduled blocklist | `lib/scheduling.js` | Manually cancelled markets are never re-scheduled |
| Stale event skip | `lib/scheduling.js` | Events older than 30 min are dropped |
| Lookahead window | `lib/scheduling.js` | Events >168h out are skipped |
| Past-date validation | `worker.js` | Events whose ET date is before today are skipped |
| No-keyword check | `lib/scheduling.js` | Markets with 0 keywords are never scheduled |
| Lockfile | `client.js` | PID-based lock prevents duplicate instances for the same session |

### 2. Trade-time gates (in `SignalHandler.handle_signal()`)

| # | Gate | How it works | Config |
|---|------|-------------|--------|
| 1 | **Speaker whitelist** | Trade only fires if `speaker_id` is in `trading_speakers` set. Populated by voice embedding match (TitaNet, cosine ≥0.65) or Bedrock LLM inference. Earnings calls: any speaker with ≥100 words is auto-allowlisted. | Per-market `speakerEntities` |
| 2 | **Trade-for-real flag** | Global kill switch. When `TRADE_FOR_REAL` env var is unset, all trades are simulated (logged/notified but not submitted to Kalshi). Currently **off** in `.env.prod`. | `TRADE_FOR_REAL` env var |
| 3 | **Blocked keywords** | 16 hardcoded phonetically-ambiguous/losing keywords return `dollarAmount=0`, skipping the trade. Saves ~$148 in losses vs ~$20 in forgone wins. | `ordering_config.py` `BLOCKED_KEYWORDS` |
| 4 | **Min confidence** | Word-level Deepgram confidence must be ≥0.80. Filters low-certainty ASR matches. | `MIN_CONFIDENCE` env (default 0.80) |
| 5 | **Min YES ask price** | If best YES ask ≤2¢, market likely already resolved YES — skip. | `MIN_YES_ASK_PRICE` env (default 0.02) |
| 6 | **Resolved-NO detection** | If YES bid is missing or ≤1¢, market likely settled NO — skip. | `orderbook_tracker.py` |
| 7 | **Single-shot per keyword** | After a keyword match triggers a trade, `remove_market_from_index()` removes that ticker from the keyword index — it can't fire again. | hardcoded |

### 3. Position sizing

| Rule | Where | Amount |
|------|-------|--------|
| Default | `ordering_config.py` | $1 |
| World Cup / MLB | `ordering_config.py` `ORDER_RULES` | $25 |
| Per-keyword override | Market JSON `keywordConfigs` | custom `dollarAmount` or `purchaseCount` |
| Per-keyword override | `lib/word_configurations.js` | custom `purchaseCount` |

### 4. Session lifecycle

| Gate | Where | What it does |
|------|-------|--------------|
| Duration cap | `client.js` | `setTimeout(shutdown, remainingMs)` based on event start + duration |
| Transcript timeout | `client.js` | Shuts down if no transcript activity for 30 min |
| Game-ended detection | `client.js` | Polls ESPN API for game completion |
| EC2 auto-shutdown | `worker.js` / config | Instance terminates after `defaultShutdownMinutes` (70 min) |

---

## What's Missing

### A. Session-level aggregate caps (trivial effort, high impact)

There are **zero limits** on how many trades fire per session. A single session could hit every keyword on every ticker if conditions align.

| Gap | Risk | Fix |
|-----|------|-----|
| No max trades/session | Runaway ASR hallucination could fire dozens of trades | Add `max_trades_per_session` config (e.g. 20) |
| No max loss/session | Sum of all trade costs has no ceiling | Track cumulative `dollar_amount` and cap (e.g. $100) |
| No trade cooldown | A sentence with 3 keywords fires 3 simultaneous trades | Add `trade_cooldown_sec` (e.g. 30s) between any trades |

### B. Account-level risk (low effort, high impact)

| Gap | Risk | Fix |
|-----|------|-----|
| No pre-trade balance check | Could overdraw or trade with insufficient funds | Call `getBalance()` before placing order; skip if balance < threshold |
| No daily loss limit | No circuit breaker if the bot has a bad day | Track daily P&L; pause all trading if loss exceeds limit |
| No account floor | Could trade account to zero | Minimum balance required to place any trade |

### C. Pre-session market state validation (low effort, medium impact)

| Gap | Risk | Fix |
|-----|------|-----|
| No pre-filter of resolved tickers | Trade on markets that resolved before the broadcast started | At session start, check all tickers in keyword index against orderbook. Remove any that appear resolved YES or NO. |

The orderbook tracker is already connected — this is just moving the check from trade-time to session-start.

### D. Signal quality (low-medium effort, medium impact)

| Gap | Risk | Fix |
|-----|------|-----|
| Phrase-level confidence | Multi-word phrase ("triple double"): one high-confidence word passes the check even if the other is low | Require ALL words in phrase to meet confidence threshold |
| No context validation | Word detected but conversation context makes it clearly wrong (e.g., "alley oop" during a commercial break) | Wire `WordPredictor` as a gate. Already built in `word_prediction.py`, just not connected to trade decisions. If LLM predicts <5% probability for keyword given context, skip. |
| No time-based gating | First 30s (pre-show "coming up next…") and last 60s (post-event replay) are high false-positive zones | Skip signals where `token.start < 60` or within 60s of session end |

### E. Execution quality (low effort, medium impact)

| Gap | Risk | Fix |
|-----|------|-----|
| Aggressive 99¢ pricing | Every trade crosses the full spread. On a contract trading at 30¢/70¢, you're overpaying 29¢/contract — that's 29¢ of unnecessary loss on every losing trade. | Use limit orders at best ask or mid-market instead of 99¢ IOC |
| No liquidity check | Could get bad fills on thin markets | Require minimum depth at best ask (e.g. ≥10 contracts) before trading |

### F. Feedback loop (medium effort, high long-term impact)

| Gap | Risk | Fix |
|-----|------|-----|
| No running P&L | We don't know if we're winning or losing at runtime. `kalshi_trade_history.js` exists but is never called automatically. | Track fills and settlements in a trade journal. Compute P&L per session, day, keyword. |
| No data-driven keyword blocking | `BLOCKED_KEYWORDS` is manual. New losing keywords aren't caught. | Auto-add keywords to blocklist after N losses with negative P&L |
| No per-market-type sizing | NBA mentions and earnings calls bet the same amount despite different win rates | Adjust sizing based on historical accuracy per market category |

### G. No backtesting (high effort, high long-term impact)

Analysis scripts exist offline (`risk_of_ruin_analysis.js`, `signal_vs_no_closeout.js`, orderbook time analysis) but nothing replays historical sessions with different parameters. The strategy is evaluated by running live at $1 with Telegram notifications.

---

## Quick Wins (under 100 lines total)

These five changes together cover the biggest gaps with minimal code:

1. **Session trade cap & cooldown** (~30 lines in `signal_handler.py`) — counter + timer
2. **Pre-filter resolved tickers at session start** (~20 lines in `server.py` `start_session()`) — already have the orderbook tracker
3. **Phrase-level confidence** (~10 lines in `signal_detector.py`) — check all words, not just min
4. **Time-based gating** (~5 lines in `signal_handler.py`) — skip first/last N seconds
5. **Better order pricing** (~10 lines in `kalshi_client.py`) — use best ask instead of 99¢

## Next Tier (higher effort, structural improvements)

6. Wire `WordPredictor` as a gate — the module is built, needs ~30 lines of wiring
7. Trade journal + running P&L — needs a SQLite table and ~100 lines of recording/query code
8. Pre-trade balance check — needs a `getBalance()` method on the Python KalshiClient + gate
9. Daily loss limit — builds on #7
