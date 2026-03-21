const { matchDiscoveryEvents } = require('./lib/discovery_matcher.js');

const markets = [{
    "link": "https://kalshi.com/markets/kxncaabmention/college-basketball/kxncaabmention-26mar21loumsu",
    "slug": "kxncaabmention-26mar21loumsu",
    "title": "Announcers at Louisville vs Michigan St. College Basketball Game",
    "eventStartTime": "2026-03-21T13:00:00.000-04:00"
}];

const tvEvents = [{
    "title": "2026 NCAA BASKETBALL TOURNAMENT",
    "startTimestamp": "2026-03-21T18:30:00.000Z",
    "description": "Second Round: Louisville Cardinals vs Michigan St. Spartans from KeyBank Center in Buffalo, N.Y."
}];

const results = matchDiscoveryEvents(markets, tvEvents, []);
console.log("Matched TV Event:", results[0].tvEvent ? "YES" : "NO");
