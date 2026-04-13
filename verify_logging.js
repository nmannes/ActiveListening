const { matchDiscoveryEvents } = require("./lib/discovery_matcher");
const logger = require("./lib/logger");

// Mocking objects to avoid external dependencies
const mockMarkets = [
  {
    title: "Will the Lakers win?",
    slug: "lakers-win-2026",
    speakerEntities: ["LeBron James"],
    eventStartTime: "2026-04-12T12:00:00Z",
  },
  {
    title: "Will it rain in NYC?",
    slug: "rain-nyc-2026",
    speakerEntities: [],
    eventStartTime: "2026-04-12T15:00:00Z",
  }
];

const mockTvEvents = [];
const mockEspnEvents = [];
const mockAmazonData = [];

console.log("Testing matchDiscoveryEvents logging...");
matchDiscoveryEvents(mockMarkets, mockTvEvents, mockEspnEvents, mockAmazonData);
