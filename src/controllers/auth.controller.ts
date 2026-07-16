import * as local from "./auth/authLocal.controller";
import * as kick from "./auth/authKick.controller";
import * as kickBot from "./auth/authKickBot.controller";
import * as discord from "./auth/authDiscord.controller";
import * as debug from "./auth/authDebug.controller";

export = { ...local, ...kick, ...kickBot, ...discord, ...debug };
