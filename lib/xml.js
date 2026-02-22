var parser = require("xml2js");

require("./args")

const response = await fetch('http://localhost:9981/xmltv/channels');
const xml = await response.text();

let channels;
let programs;

parser.parseString(xml, function (err, result) {
    channels = result.tv.channel || [];
    programs = result.tv.programme || [];
});


function getChannelIdByBand(band) {
    const channel = channels.find(c => c['display-name'] && c['display-name'].includes(band));
    return channel ? channel.$.id : null;
}


function getChannelURLByBand(band) {
    if (!band) return null;
    const channelId = getChannelIdByBand(band);
    if (!channelId) return null;
    return `http://localhost:9981/stream/channel/${channelId}`;
}


module.exports = {
    getChannelURLByBand
}
