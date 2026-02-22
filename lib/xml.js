var parser = require("xml2js");

require("./args")



async function getChannelIdByBand(band) {

    const response = await fetch('http://localhost:9981/xmltv/channels');
    const xml = await response.text();

    let channels;
    let programs;

    parser.parseString(xml, function (err, result) {
        channels = result.tv.channel || [];
        programs = result.tv.programme || [];
    });

    const channel = channels.find(c => c['display-name'] && c['display-name'].includes(band));
    return channel ? channel.$.id : null;
}


async function getChannelURLByBand(band) {
    if (!band) return null;
    const channelId = await getChannelIdByBand(band);
    if (!channelId) return null;
    return `http://localhost:9981/stream/channel/${channelId}`;
}


module.exports = {
    getChannelURLByBand
}
