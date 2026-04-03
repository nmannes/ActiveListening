const { matchDiscoveryEvents } = require("../lib/discovery_matcher");
const { applyWordConfigurations } = require("../lib/word_configurations");

const mockMarkets = [
  {
    title: "Announcers at Chicago vs New York Professional Basketball Game",
    slug: "kxnbamention-26apr03chinyk",
    eventStartTime: "2026-04-03T19:30:00.000-04:00",
    keywords: { msg: "KXNBAMENTION-26APR03CHINYK-MSG" }
  },
  {
      title: "Announcers at Milwaukee vs Kansas City Professional Baseball Game",
      slug: "kxmlbmention-26apr04milkc",
      eventStartTime: "2026-04-04T16:10:00.000-04:00"
  }
];

const mockTvEvents = [
  {
    title: "Bulls at Knicks",
    description: "Chicago Bulls visit New York Knicks at Madison Square Garden.",
    startTimestamp: "2026-04-03T19:30:00.000-04:00",
    station: "MSG",
    channelURL: "http://example.com/msg"
  }
];

const mockEspnEvents = [
  {
    league: "MLB",
    title: "Milwaukee Brewers vs. Kansas City Royals",
    startTimestamp: "2026-04-04T16:10:00.000-04:00",
    link: "https://www.espn.com/watch/player?id=123"
  }
];

console.log("Running matching test...");
const configuredMarkets = mockMarkets.map(m => applyWordConfigurations(m));
const results = matchDiscoveryEvents(configuredMarkets, mockTvEvents, mockEspnEvents, []);

results.forEach(res => {
    const { market, tvEvent, espnEvent } = res;
    const matched = tvEvent || espnEvent;
    console.log(`Market: ${market.title}`);
    console.log(`Matched: ${matched ? "YES" : "NO"}`);
    if (tvEvent) console.log(`  Source: TV (${tvEvent.title})`);
    if (espnEvent) console.log(`  Source: ESPN (${espnEvent.title})`);
    console.log("-------------------");
});

const allMatched = results.every(r => r.tvEvent || r.espnEvent);
if (allMatched) {
    console.log("✅ Success: All test markets matched!");
} else {
    console.log("❌ Failure: Some markets did not match.");
    process.exit(1);
}
