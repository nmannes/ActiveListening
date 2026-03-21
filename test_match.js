const { getTeamNames } = require('./lib/discover_markets.js');
const { matchDiscoveryEvents } = require('./lib/discovery_matcher.js');

const title = "Announcers at Louisville vs Michigan St. College Basketball Game";
console.log("Teams:", getTeamNames(title));
