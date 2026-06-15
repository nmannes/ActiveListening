const { scrapeYoutubeUpcoming } = require("./youtube_upcoming");

// YouTube channels to monitor for upcoming livestreams
const YOUTUBE_CHANNELS = [
  "@AssociatedPress",
  "@PBSNewsHour",
  "@WhiteHouse",
  "@CSPAN",
  "@NBCNews",
  "@ABCNews",
  "@CBSNews",
  "@FoxNews",
  "@Reuters",
  "@Bloomberg",
  "@TheHill",
  "@WashingtonPost",
  "@politico",
  "@MSNBC",
  "@CNBC",
  "@SkyNews",
  "@BBCNews",
  "@GuardianNews",
  "@defenseGov",
  "@stateDept",
  "@GovernorKathyHochul",
  "@RealCandaceO",
  "@NYCMayorsOffice",
  "@RSBN",
  "@NationalPressClubLive",
  "@ukparliament"
];

/**
 * Scrapes upcoming YouTube streams from all configured channels.
 * @param {import('puppeteer').Browser} browser
 * @param {string[]} [channels] - Channel handles to scrape (defaults to YOUTUBE_CHANNELS)
 * @returns {Promise<Object[]>} Array of upcoming stream objects across all channels
 */
async function scrapeAllYoutubeUpcoming(browser, channels = YOUTUBE_CHANNELS) {
  const allStreams = [];

  for (const channel of channels) {
    try {
      console.log(`[YouTube] Scraping upcoming streams for ${channel}...`);
      const streams = await scrapeYoutubeUpcoming(browser, channel);
      const tagged = streams.map((s) => ({ ...s, channel }));
      allStreams.push(...tagged);
    } catch (e) {
      console.error(`[YouTube] Error scraping ${channel}: ${e.message}`);
    }
  }

  console.log(`[YouTube] Total upcoming streams across ${channels.length} channels: ${allStreams.length}`);
  return allStreams;
}

module.exports = { scrapeAllYoutubeUpcoming, YOUTUBE_CHANNELS };
