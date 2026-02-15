import fs from "fs";

try {
    const data = JSON.parse(fs.readFileSync('announcer_markets.json', 'utf8'));

    const leagueConfigs = {
        'NBA': ['KXNBAMENTION'],
        'NCAA': ['KXNCAABMENTION', 'KXNCAAWMENTION'],
        'NFL': ['KXNFLMENTION']
    };

    const statsByLeague = {};
    Object.keys(leagueConfigs).forEach(name => statsByLeague[name] = {});

    data.forEach(item => {
        const event = item.event;
        if (!event || !event.markets) return;

        event.markets.forEach(market => {
            if (market.status !== 'finalized' && market.status !== 'settled') return;

            const ticker = market.ticker || '';
            let leagueName = null;

            for (const [name, prefixes] of Object.entries(leagueConfigs)) {
                if (prefixes.some(p => ticker.startsWith(p))) {
                    leagueName = name;
                    break;
                }
            }

            if (!leagueName) return; // Only include data for these leagues

            const word = (market.custom_strike?.Word || market.yes_sub_title || 'Unknown').trim();
            const leagueStats = statsByLeague[leagueName];

            if (!leagueStats[word]) {
                leagueStats[word] = { yes: 0, no: 0, total: 0, history: [] };
            }

            if (market.result === 'yes') {
                leagueStats[word].yes++;
            } else if (market.result === 'no') {
                leagueStats[word].no++;
            }
            leagueStats[word].total++;
            leagueStats[word].history.push({
                result: market.result,
                time: new Date(market.close_time).getTime()
            });
        });
    });

    const printTable = (title, stats) => {
        const results = Object.entries(stats).map(([word, s]) => {
            // Sort history by time and take last 5
            const recentHistory = s.history
                .sort((a, b) => a.time - b.time)
                .slice(-5)
                .map(h => h.result === 'yes' ? '🟢' : '🔴')
                .join('');

            return {
                word,
                win_rate: (s.yes / s.total * 100).toFixed(2),
                recentHistory,
                ...s
            };
        });

        if (results.length === 0) return;

        results.sort((a, b) => b.total - a.total || b.win_rate - a.win_rate);

        console.log(`\n### ${title} Announcer Mention Win Rates`);
        console.log(`| Word | Win Rate | Yes/Total | Last 5 |`);
        console.log(`| :--- | :--- | :--- | :--- |`);

        results.forEach(r => {
            console.log(`| ${r.word} | ${r.win_rate}% | ${r.yes}/${r.total} | ${r.recentHistory} |`);
        });
    };

    Object.keys(leagueConfigs).forEach(name => {
        printTable(name, statsByLeague[name]);
    });

} catch (err) {
    console.error("Analysis failed:", err.message);
}
