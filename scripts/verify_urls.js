const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const EarningsSourceFinder = require("../lib/scrapers/earnings_source");

const URLS = [
  { company: "JPMorgan", date: "2026-07-14", slug: "kxearningsmentionjpm-26jul14", url: "https://event.webcasts.com/starthere.jsp?ei=1767182&tp_key=dd05e5b127&tp_special=8" },
  { company: "Goldman Sachs", date: "2026-07-14", slug: "kxearningsmentiongs-26jul14", url: "https://event.webcasts.com/starthere.jsp?ei=1525737&tp_key=cd78c1b8f4" },
  { company: "Wells Fargo", date: "2026-07-14", slug: "kxearningsmentionwfc-26jul14", url: "https://metroconnections-events.com/wf2Qearnings26" },
  { company: "Citigroup", date: "2026-07-14", slug: "kxearningsmentionc-26jul14", url: "https://event.webcasts.com/starthere.jsp?ei=1764858&tp_key=5a38616448&tp_special=8" },
  { company: "Morgan Stanley", date: "2026-07-15", slug: "kxearningsmentionms-26jul15", url: "https://morganstanley.webcasts.com/starthere.jsp?ei=1746603&tp_key=86ab90b7fd" },
  { company: "Johnson & Johnson", date: "2026-07-15", slug: "kxearningsmentionjnj-26jul15", url: "https://event.webcasts.com/starthere.jsp?ei=1765248&tp_key=d41c1c3140" },
  { company: "Progressive", date: "2026-07-15", slug: "kxearningsmentionpgr-26jul15", url: "https://central.virtualshareholdermeeting.com/vsm/web?pvskey=PGR2026" },
  { company: "United Airlines", date: "2026-07-16", slug: "kxearningsmentionual-26jul16", url: "https://events.q4inc.com/attendee/674903004" },
  { company: "Netflix", date: "2026-07-16", slug: "kxearningsmentionnflx-26jul02", url: "https://east.virtualshareholdermeeting.com/vsm/web?pvskey=NFLX2026" },
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const finder = new EarningsSourceFinder(browser);

  for (const entry of URLS) {
    console.log(`\n${entry.company} (${entry.slug})`);
    console.log(`  URL: ${entry.url}`);
    const v = await finder.verifyUrl(entry.url, entry.company, entry.date);
    const icon = v.verdict === "yes" ? "OK" : v.verdict === "maybe" ? "MAYBE" : "FAIL";
    console.log(`  ${icon}: ${v.reason}`);
    if (v.companyOnPage) console.log(`  Company on page: ${v.companyOnPage}`);
    if (v.dateOnPage) console.log(`  Date on page: ${v.dateOnPage}`);
    console.log(`  Page title: ${v.pageTitle}`);
  }

  console.log("\n---");
  await browser.close();
})();
