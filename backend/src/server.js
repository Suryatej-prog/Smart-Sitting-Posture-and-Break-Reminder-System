const http = require('http');
const mongoose = require('mongoose');
const config = require('./config/env');
const { createApp } = require('./app');
const realtime = require('./realtime/socket');
const mqttClient = require('./mqtt/client');
const sessionService = require('./services/sessionService');

async function start() {
  await mongoose.connect(config.mongodbUri);
  console.log('[db] connected to MongoDB');

  await sessionService.rebuildLiveState();

  const app = createApp();
  const server = http.createServer(app);
  realtime.init(server);
  const mqtt = mqttClient.start();

  await new Promise((resolve) => server.listen(config.port, resolve));
  console.log(`[http] API listening on http://localhost:${config.port}`);
  return { server, mongoose, mqtt };
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start backend:', err);
    process.exit(1);
  });
}

module.exports = { start };
