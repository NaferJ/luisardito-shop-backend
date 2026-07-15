const local = require("./auth/authLocal.controller");
const kick = require("./auth/authKick.controller");
const kickBot = require("./auth/authKickBot.controller");
const discord = require("./auth/authDiscord.controller");
const debug = require("./auth/authDebug.controller");

module.exports = { ...local, ...kick, ...kickBot, ...discord, ...debug };
