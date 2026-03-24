var parser = require("xml2js");

require("./args");

async function getChannelIdByBand(band) {
  if (band === '4.1'){
      return "0f485a1a848627fbd928551824b0e8ff";
  }
  const response = await fetch("http://localhost:9981/xmltv/channels");
  const xml = await response.text();

  const result = await new Promise((resolve, reject) => {
    parser.parseString(xml, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  });

  const channels = result?.tv?.channel || [];
  const channel = channels.find(
    (c) =>
      c["display-name"] &&
      c["display-name"].some((name) => name.includes(band)),
  );
  return channel ? channel.$.id : null;
}

async function getChannelURLByBand(band) {
  if (!band) return null;
  const channelId = await getChannelIdByBand(band);
  if (!channelId) return null;
  return `http://localhost:9981/stream/channel/${channelId}?profile=pass`;
}

module.exports = {
  getChannelURLByBand,
};
