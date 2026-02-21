const fs = require('fs');

function getTeamNames(kalshi_market_title) {
    // "Announcers at Dallas vs Minnesota Professional Basketball Game"
    let cleanTitle = kalshi_market_title.replace('Announcers at ', '').replace('St.', 'State');
    // "Dallas vs Minnesota Professional Basketball Game"
    if (cleanTitle.toLowerCase().includes('professional basketball game')) {
        cleanTitle = cleanTitle.replace(/professional basketball game/i, '').trim();
    }
    // "Dallas vs Minnesota"
    let teams = cleanTitle.split(' vs ').map(t => t.trim().toLowerCase());

    for (let i = 0; i < teams.length; i++) {
        switch (teams[i]) {
            case 'north carolina state':
                teams[i] = 'nc state';
                break;
            default:
                break;
        }
    }
    return teams;
}


function matchMarkets(markets, scheduleData) {
    // Flatten schedule data
    const tvPrograms = [];
    scheduleData.forEach(station => {
        station.programs.forEach(program => {
            tvPrograms.push({
                stationCallSign: station.callSign,
                stationChannel: station.channel,
                ...program
            });
        });
    });

    const matches = [];

    markets.forEach(market => {
        if (!market.eventStartTimeTS) return; // Skip if no event time

        // Extract teams
        const teams = getTeamNames(market.title);
        if (teams.length !== 2) return; // Skip if doesn't contain teams
        const [team1, team2] = teams;

        const eventTime = market.eventStartTimeTS;

        let bestMatch = null;
        for (const program of tvPrograms) {
            if (!program.startDateTime || !program.endDateTime) continue;

            const progStartTime = new Date(program.startDateTime).getTime();
            const progEndTime = new Date(program.endDateTime).getTime();

            // Ensure strict time matching to avoid matching reruns of live broadcasts
            // Allow event to start up to 1 hour before the program slot (e.g. pre-game coverage)
            if (eventTime >= (progStartTime - 60 * 60 * 1000) && eventTime <= progEndTime) {
                // Check if program title or subtitle matches teams
                const fullProgramText = `${program.title} ${program.subTitle}`.toLowerCase();
                // If both teams mentioned, we consider it a very strong match
                if (fullProgramText.includes(team1) && fullProgramText.includes(team2)) {
                    bestMatch = program;
                    break; // Found strong match
                } else {
                    // Check if it's a sports/basketball program since it didn't match perfectly
                    if (fullProgramText.includes(team1) || fullProgramText.includes(team2)) {
                        console.warn(`[Partial Match] Market: ${team1} vs ${team2} | TV: ${fullProgramText}`);
                    }
                }
            }
        }

        if (bestMatch) {
            matches.push({
                market: market,
                tv_program: bestMatch
            });
        }

    });

    return matches;
}

function matchMarketsToSchedule(marketsFile, scheduleFile) {
    if (!fs.existsSync(marketsFile)) {
        console.error(`Markets file not found: ${marketsFile}`);
        process.exit(1);
    }
    if (!fs.existsSync(scheduleFile)) {
        console.error(`Schedule file not found: ${scheduleFile}`);
        process.exit(1);
    }

    const markets = JSON.parse(fs.readFileSync(marketsFile, 'utf8'));
    const scheduleData = JSON.parse(fs.readFileSync(scheduleFile, 'utf8'));
    return matchMarkets(markets, scheduleData);
}

if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error("Usage: node match_markets.js <markets_file> <schedule_file>");
        process.exit(1);
    }

    const marketsFile = args[0];
    const scheduleFile = args[1];

    const results = matchMarketsToSchedule(marketsFile, scheduleFile);
    console.log(JSON.stringify(results, null, 2));
    console.warn(`Found ${results.length} matches!`);
}

module.exports = {
    matchMarkets,
    matchMarketsToSchedule
};
