const { matchDiscoveryEvents } = require("./lib/discovery_matcher.js");

const markets = [
  {
    "link": "https://kalshi.com/markets/kxsnlmention/snl-mention/kxsnlmention-26apr04",
    "slug": "kxsnlmention-26apr04",
    "title": "What will Jack Black say during his SNL opening monologue?",
    "eventStartTime": "2026-04-04T23:00:00.000-04:00",
    "speakerEntities": [
        "Jack Black"
    ],
    "keywords": {
        "event does not qualify": "KXSNLMENTION-26APR04-NQE",
        "trump": "KXSNLMENTION-26APR04-TRUM"
    }
  }
];

const tvSchedule = [
  {
    "title": "SATURDAY NIGHT LIVE",
    "date": "Saturday - 4/4",
    "time": "11:30 PM - 1:03 AM",
    "startTimestamp": "2026-04-05T03:30:00.000Z",
    "endTimestamp": "2026-04-05T05:03:00.000Z",
    "station": "WRC-DT • 4.1",
    "description": "Actor Jack Black hosts; musical guest Jack White.",
    "channelURL": "http://localhost:9981/stream/channel/f018cce4fe0afaa863cfd93310610bff?profile=pass"
  }
];

const results = matchDiscoveryEvents(markets, tvSchedule, [], []);

const matched = results.filter(r => r.tvEvent !== null);

if (matched.length > 0) {
  console.log("SUCCESS: Market matched to TV event");
  process.exit(0);
} else {
  console.log("FAILURE: Market NOT matched to TV event");
  process.exit(1);
}
