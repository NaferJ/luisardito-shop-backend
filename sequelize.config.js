const dotenv = require("dotenv");
const fs = require("fs");

// Same precedence as config.ts: real env > .env.development > .env
const realEnvKeys = new Set(Object.keys(process.env));

dotenv.config();

if (fs.existsSync(".env.development")) {
  const devVars = dotenv.parse(fs.readFileSync(".env.development"));
  for (const [key, value] of Object.entries(devVars)) {
    if (!realEnvKeys.has(key)) {
      process.env[key] = value;
    }
  }
}

const toBool = (val, def = false) => {
  if (val === undefined) return def;
  return /^(1|true|yes|on)$/i.test(String(val).trim());
};

const base = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  dialect: "mysql",
  logging: false,
  dialectOptions: toBool(process.env.DB_SSL, false)
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: toBool(
            process.env.DB_SSL_REJECT_UNAUTHORIZED,
            false
          ),
        },
      }
    : {},
};

module.exports = {
  development: { ...base },
  test: { ...base },
  production: { ...base },
};
