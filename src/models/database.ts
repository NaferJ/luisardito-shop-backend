import { Sequelize } from "sequelize";
import config from "../../config";

const sequelize = new Sequelize(
  config.db.database,
  config.db.user,
  config.db.password,
  {
    host: config.db.host,
    port: config.db.port,
    dialect: "mysql",
    logging: false,
    dialectOptions: config.db.ssl
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: !!config.db.sslRejectUnauthorized,
          },
        }
      : {},
  }
);

export { sequelize };
