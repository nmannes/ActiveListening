const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
    try {
        const url = 'https://www.ncaa.com/scoreboard/basketball-men/d1/2026/03/21/all-conf';
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
            }
        });
        const $ = cheerio.load(res.data);
        console.log("Title:", $('title').text());
        console.log("Game pods found:", $('.gamePod').length);
        
        // Let's just print a bit of the body or look for script tags
        const text = res.data.substring(0, 1000);
        console.log(text.includes('__NEXT_DATA__') ? "NextJS found" : "Not NextJS");
    } catch(err) {
        console.error("Error:", err.message);
    }
}
test();
