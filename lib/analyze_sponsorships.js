import fs from "fs";

try {
    const data = JSON.parse(fs.readFileSync('announcer_markets.json', 'utf8'));

    const leagueConfigs = {
        'NBA': ['KXNBAMENTION'],
        'NCAA': ['KXNCAABMENTION', 'KXNCAAWMENTION'],
        'NFL': ['KXNFLMENTION']
    };

    const sponsorshipKeywords = [
        'arena', 'garden', 'center', 'fieldhouse', 'coliseum', 'forum', 'stadium', 'dome', 'park',
        'bank', 'insurance', 'airlines', 'mobile', 'crypto', 'toyota', 'kia', 'fedex', 'ups', 'chase',
        'intuit', 'paycom', 'caesars', 'xfinity', 'spectrum', 'state farm', 'capital one', 'target',
        'rocket', 'fiserv', 'moda', 'scotiabank', 'gillette', 'lumen', 'empower', 'levi\'s', 'clorox',
        'nike', 'adidas', 'pepsi', 'coke', 'budweiser', 'michelob', 'at&t'
    ];

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
            const lowerWord = word.toLowerCase();

            const isSponsorship = sponsorshipKeywords.some(kw => lowerWord.includes(kw)) ||
                (market.rules_primary && market.rules_primary.toLowerCase().includes('sponsored by'));

            if (!isSponsorship) return;

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

        if (results.length === 0) return;

        // Sort by volume descending for sponsorships
        results.sort((a, b) => b.volume - a.volume || parseFloat(b.win_rate) - parseFloat(a.win_rate));

        console.log(`\n### ${title} Sponsorship Mention Win Rates`);
        console.log(`| Sponsorship / Venue | Win Rate | Yes/Total | Total Volume |`);
        console.log(`| :--- | :--- | :--- | :--- |`);

        results.forEach(r => {
            console.log(`| ${r.word} | ${r.win_rate}% | ${r.yes}/${r.total} | ${r.volume.toLocaleString()} |`);
        });
    };

    console.log("# Sponsorship Analysis: Sports Leagues\n");
    console.log("This report focuses on brands, venues, and corporate partners mentioned during sports broadcasts.");

    Object.keys(leagueConfigs).forEach(name => {
        printTable(name, statsByLeague[name]);
    });

} catch (err) {
    console.error("Analysis failed:", err.message);
}
