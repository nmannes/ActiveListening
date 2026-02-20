const fs = require("fs");
var parser = require("xml2js");


const xml = fs.readFileSync("a.xml", "utf8");

let channels;

parser.parseString(xml, function (err, result) {
    channels = result.tv.channel;
});


function getChannelIdByBand(band) {
    const channel = channels.find(c => c['display-name'] && c['display-name'].includes(band));
    return channel ? channel.$.id : null;
}


module.exports = {
    getChannelIdByBand
}
