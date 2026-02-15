import fs from "fs";

try {
    const data = JSON.parse(fs.readFileSync('politics_markets.json', 'utf8'));

    const categories = {
        'Trump': { prefixes: ['KXTRUMPMENTION'], stats: {} },
        'Governors': { prefixes: ['KXGOVERNORMENTION'], stats: {} },
        'RFK': { prefixes: ['KXRFKMENTION'], stats: {} },
        'Press Secretary': { prefixes: ['KXSECPRESSMENTION'], stats: {} },
        'Media': { prefixes: ['KXFOXNEWSMENTION', 'KXFTNMENTION', 'KXNEWSNATIONMENTION', 'KXLUTNICKFTNMENTION'], stats: {} },
        'Other Politics': { prefixes: ['KXWITNESSMENTION'], stats: {} }
    };

    data.forEach(item => {
        const event = item.event;
        if (!event || !event.markets) return;

        const series = event.series_ticker || '';
        let catName = 'Other Politics';

        for (const [name, config] of Object.entries(categories)) {
            if (config.prefixes.some(p => series.startsWith(p))) {
                catName = name;
                break;
            }
        }

        const catStats = categories[catName].stats;

        event.markets.forEach(market => {
            if (market.status !== 'finalized' && market.status !== 'settled') return;

            let word = market.custom_strike?.Word || market.yes_sub_title || 'Unknown';
            word = word.trim();

            if (!catStats[word]) {
                catStats[word] = { yes: 0, no: 0, total: 0 };
            }

            if (market.result === 'yes') {
                catStats[word].yes++;
            } else if (market.result === 'no') {
                catStats[word].no++;
            }
            catStats[word].total++;
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

        console.log(`\n### ${title} Mention Win Rates`);
        console.log(`| Phrase | Win Rate | Yes/Total |`);
        console.log(`| :--- | :--- | :--- |`);

        results.forEach(r => {
            console.log(`| ${r.word} | ${r.win_rate}% | ${r.yes}/${r.total} |`);
        });
    };

    for (const [name, config] of Object.entries(categories)) {
        printTable(name, config.stats);
    }

} catch (err) {
    console.error("Analysis failed:", err.message);
}
