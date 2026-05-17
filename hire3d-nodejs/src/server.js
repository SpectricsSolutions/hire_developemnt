'use strict';

require('dotenv').config();

const app = require('./app');
const settings = require('./config/settings');
const { sequelize } = require('./models');

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    const port = settings.API_PORT;
    const host = settings.API_HOST;

    app.listen(port, host, () => {
      console.log(`${settings.PROJECT_NAME} v${settings.PROJECT_VERSION} running on http://${host}:${port}`);
      if (settings.isDevelopment) {
        console.log(`Swagger docs: http://${host}:${port}/docs`);
      }
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
