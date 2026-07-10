# Plan: Separate Event Processing from Kalshi Word Checking

## Context

Two concerns tightly coupled throughout the pipeline:
1. **Event processing** — discovering when/where events happen, matching to media sources, scheduling recording
2. **Kalshi word checking** — keywords, word substitutions, purchase configs, speaker identification, market-type rules

Goal: streaming/pubsub architecture where the event pipeline produces clean MediaEvents and multiple markets with different word-checking configs consume from the same stream. Example: one NBA broadcast serving 3+ markets (announcer phrases, player mentions, game outcomes), all watching the same stream but checking different words.

## Target Architecture

```
┌─────────────────────────────────┐
│       EVENT PIPELINE             │
│  (word-agnostic)                 │
│                                  │
│  e2e_discovery.js                │
│    └─> fetches markets + schedules│
│  schedule_matches.js             │
│    └─> matches markets to media   │
│  lib/scheduling.js               │
│    └─> schedules recording        │
│                                  │
│  Output: MediaEvent stream       │
│  { streamUrl, startTime,         │
│    channel, duration,            │
│    type (sports/news/show) }     │
└────────────┬────────────────────┘
             │  MediaEvents
             ▼
┌─────────────────────────────────┐
│       WORD CHECKING              │
│  (Kalshi-specific)               │
│                                  │
│  lib/word_configurations.js      │
│  lib/word_checker.js  (NEW)      │
│    └─> WORD_RULES, substitutions  │
│    └─> purchase configs           │
│    └─> speaker matching           │
│    └─> market-type rules          │
│                                  │
│  client.js                       │
│    └─> consumes MediaEvent        │
│    └─> applies word configs       │
│    └─> connects to stream         │
│    └─> sends audio to server.py   │
│                                  │
│  server.py / pylib/*             │
│    └─> transcription + trading    │
└─────────────────────────────────┘
```

## Phase 1: Extract word checking from event pipeline

**`lib/discovery_matcher.js`** — Largest change:
- Extract 5 hardcoded market type detectors (SNL, Survivor, Championship, Meet the Press, The Last Word) → word checking module
- Extract speaker entity matching logic → word checking module
- Extract `extractContextKeywords()` → word checking module
- Remove `getOrderAmount()` call, defer to word checking
- Matcher becomes a pure function accepting a pluggable `marketClassifier` parameter

**`lib/scheduling.js`**:
- Replace `market.keywords` check with generic flag
- Move `delete market.keywords["event does not qualify"]` to word checking

**`schedule_matches.js`**:
- Route word configs through `wordChecker.applyToMarket(market)` instead of direct import

**`e2e_discovery.js`**:
- Make CATEGORIES array configurable from word checker config

## Phase 2: Create word checking module

**New file: `lib/word_checker.js`** — Central Kalshi-specific module:

```js
// Market type classification
classifier.isSportsMarket(market)
classifier.isShowMarket(market)     // SNL, Survivor, etc.
classifier.isNewsMarket(market)     // Meet the Press, Last Word
classifier.isSpeakerMarket(market)

// Word configuration
wordChecker.applyToMarket(market)   // wraps applyWordConfigurations

// Speaker matching (moved from discovery_matcher.js)
wordChecker.matchSpeakerToEvent(market, event)

// Context keyword extraction (moved from discovery_matcher.js)
wordChecker.extractContextKeywords(title, speakerEntities)
```

## Phase 3: Streaming / multi-market support

- Group candidates by `streamUrl` instead of per-market
- One GPU server + recording session per unique stream
- Multiple `run-client` jobs per stream (one per market), same server window
- `client.js` already sends individual markets; multiple clients connect to same server.py

## Phase 4: Clean up data flow

Current tangled flow:
```
discover_markets.js → market.keywords, market.speakerEntities
schedule_matches.js → applyWordConfigurations(market) [mutates keywords]
discovery_matcher.js → uses speakerEntities for matching
scheduling.js → checks market.keywords, deletes keywords
client.js → applyWordConfigurations(market) [mutates again]
```

New flow:
```
discover_markets.js → market.keywords, market.speakerEntities  (raw data)
schedule_matches.js → wordChecker.applyToMarket(market)        (word configs applied)
discovery_matcher.js → wordChecker.classify(market)            (market type classification)
scheduling.js → groups by streamUrl, no keyword checks
client.js → wordChecker.applyToMarket(market)                  (final word configs)
```

## Files to Modify

| File | Change |
|------|--------|
| `lib/word_checker.js` | **NEW** — centralized word checking module |
| `lib/discovery_matcher.js` | Extract market-type classifiers, speaker matching, context keywords; accept classifier as parameter |
| `lib/scheduling.js` | Remove keyword checks; group by streamUrl for multi-market |
| `schedule_matches.js` | Route word configs through wordChecker; pass classifier to matcher |
| `e2e_discovery.js` | Make CATEGORIES configurable; pass from word checker config |
| `client.js` | Minor — import from wordChecker instead of word_configurations directly |

## Verification

1. `bun run schedule_matches.js --dry-run` — identical matching results
2. `bun run schedule_matches.js --dry-run --youtube-only` — YouTube filtering still works
3. `bun run client.js --fromFile <market.json> --duration 2` — word checking functions
4. Streaming grouping logic correctly groups markets by stream URL
5. speaker.md output unchanged after refactor
