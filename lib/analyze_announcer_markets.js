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

            if (!leagueName) return;

            const word = (market.custom_strike?.Word || market.yes_sub_title || 'Unknown').trim();
            const leagueStats = statsByLeague[leagueName];

            if (!leagueStats[word]) {
                leagueStats[word] = { yes: 0, no: 0, total: 0, volume: 0 };
            }

            if (market.result === 'yes') {
                leagueStats[word].yes++;
            } else if (market.result === 'no') {
                leagueStats[word].no++;
            }
            leagueStats[word].total++;
            leagueStats[word].volume += (market.volume || 0);
        });
    });

    const printTable = (title, stats) => {
        const results = Object.entries(stats).map(([word, s]) => ({
            word,
            win_rate: (s.yes / s.total * 100).toFixed(2),
            ...s
        }));

        const filteredResults = results.filter(r => parseFloat(r.win_rate) >= 50);

        if (filteredResults.length === 0) return;

        filteredResults.sort((a, b) => b.volume - a.volume || parseFloat(b.win_rate) - parseFloat(a.win_rate));

        console.log(`\n### ${title} Announcer Mention Win Rates (50%+)`);
        console.log(`| Word | Win Rate | Yes/Total | Total Volume |`);
        console.log(`| :--- | :--- | :--- | :--- |`);

        filteredResults.forEach(r => {
            console.log(`| ${r.word} | ${r.win_rate}% | ${r.yes}/${r.total} | ${r.volume.toLocaleString()} |`);
        });
    };

    Object.keys(leagueConfigs).forEach(name => {
        printTable(name, statsByLeague[name]);
    });

} catch (err) {
    console.error("Analysis failed:", err.message);
}
