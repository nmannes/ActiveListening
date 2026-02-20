const fs = require("fs");
var parser = require("xml2js");


const xml = fs.readFileSync("a.xml", "utf8");

let channels;
let programs;

parser.parseString(xml, function (err, result) {
    channels = result.tv.channel || [];
    programs = result.tv.programme || [];
});


function getChannelIdByBand(band) {
    const channel = channels.find(c => c['display-name'] && c['display-name'].includes(band));
    return channel ? { id: channel.$.id, name: channel['display-name'][0], band: channel['display-name'][1] } : null;
}

function parseTimestamp(ts) {
    if (!ts) return null;
    const year = ts.slice(0, 4);
    const month = ts.slice(4, 6);
    const day = ts.slice(6, 8);
    const hour = ts.slice(8, 10);
    const minute = ts.slice(10, 12);
    const second = ts.slice(12, 14);
    const offsetDirection = ts.slice(15, 16);
    const offsetHours = ts.slice(16, 18);
    const offsetMinutes = ts.slice(18, 20);
    const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}${offsetDirection}${offsetHours}:${offsetMinutes}`;

    // Return a real timestamp (UNIX milliseconds) along with formatted original timezone
    return {
        timestamp: new Date(isoString).getTime(),
        formatted: `${year}-${month}-${day} ${hour}:${minute}:${second} UTC${offsetDirection}${offsetHours}:${offsetMinutes}`
    };
}

function getProgramsByTitleKeyword(keyword) {
    return programs
        .filter(p => {
            if (!p.title || !p.title.length) return false;
            const titleObj = p.title[0];
            const titleText = typeof titleObj === 'object' ? titleObj._ : titleObj;
            return typeof titleText === 'string' && titleText.toLowerCase().includes(keyword.toLowerCase());
        })
        .map(p => {
            const titleObj = p.title?.[0];
            const descObj = p.desc?.[0];
            return {
                title: typeof titleObj === 'object' ? titleObj._ : titleObj,
                description: typeof descObj === 'object' ? descObj._ : descObj,
                channel: p.$.channel,
                start: parseTimestamp(p.$.start),
                stop: parseTimestamp(p.$.stop),
            };
        });
}


module.exports = {
    getChannelIdByBand,
    getProgramsByTitleKeyword
}
