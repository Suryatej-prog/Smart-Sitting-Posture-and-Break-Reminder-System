const { Server } = require('socket.io');
const config = require('../config/env');

let io = null;

function init(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.corsOrigin === '*' ? true : config.corsOrigin }
  });
  io.on('connection', (socket) => {
    socket.emit('connected', { ok: true, at: new Date().toISOString() });
  });
  return io;
}

// Event names the frontend listens for:
//   live-status, posture-warning, session-started, session-ended, break-reminder
function emit(event, payload) {
  if (io) io.emit(event, payload);
}

module.exports = { init, emit };
