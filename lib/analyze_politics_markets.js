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

            if (!catName) return;

            const word = (market.custom_strike?.Word || market.yes_sub_title || 'Unknown').trim();
            const catStats = statsByCategory[catName];

            if (!catStats[word]) {
                catStats[word] = { yes: 0, no: 0, total: 0, volume: 0, history: [] };
            }

            if (market.result === 'yes') {
                catStats[word].yes++;
            } else if (market.result === 'no') {
                catStats[word].no++;
            }
            catStats[word].total++;
            catStats[word].volume += (market.volume || 0);
            catStats[word].history.push({
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

        const filteredResults = results.filter(r => parseFloat(r.win_rate) >= 50);

        if (filteredResults.length === 0) return;

        filteredResults.sort((a, b) => b.volume - a.volume || parseFloat(b.win_rate) - parseFloat(a.win_rate));

        console.log(`\n### ${title} Mention Win Rates (50%+)`);
        console.log(`| Phrase | Win Rate | Yes/Total | Total Volume | Last 5 |`);
        console.log(`| :--- | :--- | :--- | :--- | :--- |`);

        filteredResults.forEach(r => {
            console.log(`| ${r.word} | ${r.win_rate}% | ${r.yes}/${r.total} | ${r.volume.toLocaleString()} | ${r.recentHistory} |`);
        });
    };

    Object.keys(categories).forEach(name => {
        printTable(name, statsByCategory[name]);
    });

} catch (err) {
    console.error("Analysis failed:", err.message);
}
