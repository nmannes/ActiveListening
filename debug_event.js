const { getEvent } = require('./lib/api');

async function main() {
    try {
        const response = await getEvent('kxnbamention-allstargame-26', true);
        console.log(JSON.stringify(response.event, null, 2));
    } catch (err) {
        console.error(err);
    }
}

main();
