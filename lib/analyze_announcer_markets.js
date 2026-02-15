import fs from "fs";

try {
    const data = JSON.parse(fs.readFileSync('announcer_markets.json', 'utf8'));

    // We'll track word stats per league, and also a combined total
    const leagueConfigs = {
        'NBA': ['KXNBAMENTION'],
        'NCAA': ['KXNCAABMENTION', 'KXNCAAWMENTION'],
        'NFL': ['KXNFLMENTION']
    };

    const statsByLeague = {
        'ALL': {}
    };

    data.forEach(item => {
        const event = item.event;
        if (!event || !event.markets) return;

        const series = event.series_ticker || '';
        let leagueName = null

        for (const [name, prefixes] of Object.entries(leagueConfigs)) {
            if (prefixes.some(p => series.startsWith(p))) {
                leagueName = name;
                break;
            }
        }

        if (!statsByLeague[leagueName]) statsByLeague[leagueName] = {};

        event.markets.forEach(market => {
            if (market.status !== 'finalized' && market.status !== 'settled') return;

            let word = market.custom_strike?.Word || market.yes_sub_title || 'Unknown';
            word = word.trim();

            const recordStat = (statObj) => {
                if (!statObj[word]) {
                    statObj[word] = { yes: 0, no: 0, total: 0 };
                }
                if (market.result === 'yes') {
                    statObj[word].yes++;
                } else if (market.result === 'no') {
                    statObj[word].no++;
                }
                statObj[word].total++;
            };

            recordStat(statsByLeague[leagueName]);
            recordStat(statsByLeague['ALL']);
        });
    });

    const printTable = (title, stats) => {
        const results = Object.entries(stats).map(([word, s]) => ({
            word,
            win_rate: (s.yes / s.total * 100).toFixed(2),
            ...s
        }));

        if (results.length === 0) return;

        results.sort((a, b) => b.total - a.total || b.win_rate - a.win_rate);

        console.log(`\n### ${title} Announcer Mention Win Rates`);
        console.log(`| Word | Win Rate | Yes/Total |`);
        console.log(`| :--- | :--- | :--- |`);

        results.forEach(r => {
            console.log(`| ${r.word} | ${r.win_rate}% | ${r.yes}/${r.total} |`);
        });
    };

    // Print each league only
    Object.keys(leagueConfigs).forEach(name => {
        printTable(name, statsByLeague[name]);
    });

} catch (err) {
    console.error("Analysis failed:", err.message);
}
