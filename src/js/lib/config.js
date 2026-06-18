const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const configPath = path.resolve(__dirname, "..", "..", "..", "config.yaml");
const config = yaml.load(fs.readFileSync(configPath, "utf8"));

module.exports = config;
