import fs from "fs";

try {
    const data = JSON.parse(fs.readFileSync('politics_markets.json', 'utf8'));

    const categories = {
        'Trump': { prefixes: ['KXTRUMPMENTION'] },
        'Governors': { prefixes: ['KXGOVERNORMENTION'] },
        'RFK': { prefixes: ['KXRFKMENTION'] },
        'Press Secretary': { prefixes: ['KXSECPRESSMENTION'] },
        'Media': { prefixes: ['KXFOXNEWSMENTION', 'KXFTNMENTION', 'KXNEWSNATIONMENTION', 'KXLUTNICKFTNMENTION'] }
    };

    const statsByCategory = {};
    Object.keys(categories).forEach(name => statsByCategory[name] = {});

    data.forEach(item => {
        const event = item.event;
        if (!event || !event.markets) return;

        event.markets.forEach(market => {
            if (market.status !== 'finalized' && market.status !== 'settled') return;

            const ticker = market.ticker || '';
            let catName = null;

            for (const [name, config] of Object.entries(categories)) {
                if (config.prefixes.some(p => ticker.startsWith(p))) {
                    catName = name;
                    break;
                }
            }

            if (!catName) return; // Only include data for these categories

            const word = (market.custom_strike?.Word || market.yes_sub_title || 'Unknown').trim();
            const catStats = statsByCategory[catName];

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

        const filteredResults = results.filter(r => parseFloat(r.win_rate) >= 50);

        if (filteredResults.length === 0) return;

        filteredResults.sort((a, b) => parseFloat(b.win_rate) - parseFloat(a.win_rate) || b.total - a.total);

        console.log(`\n### ${title} Mention Win Rates (50%+)`);
        console.log(`| Phrase | Win Rate | Yes/Total |`);
        console.log(`| :--- | :--- | :--- |`);

        filteredResults.forEach(r => {
            console.log(`| ${r.word} | ${r.win_rate}% | ${r.yes}/${r.total} |`);
        });
    };

    Object.keys(categories).forEach(name => {
        printTable(name, statsByCategory[name]);
    });

} catch (err) {
    console.error("Analysis failed:", err.message);
}
