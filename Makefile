test:
	bun run test -i
tables:
	bun run lib/analyze_announcer_markets.js > ANNOUNCERS.MD
	bun run lib/analyze_politics_markets.js > POLITICS.MD
	bun run lib/analyze_sponsorships.js > SPONSORSHIPS.MD

sponsorships:
	bun run lib/analyze_sponsorships.js > SPONSORSHIPS.MD