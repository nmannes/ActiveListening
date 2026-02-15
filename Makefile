test:
	bun run test -i --silent

tables:
	bun run lib/analyze_announcer_markets.js > ANNOUNCERS.MD
	bun run lib/analyze_politics_markets.js > POLITICS.MD