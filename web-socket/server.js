const WebSocket = require('ws');
const crypto = require('crypto');

const wss = new WebSocket.Server({ port: 8080 });

console.log('✅ WS Chat Server running on ws://localhost:8080');

wss.on('connection', socket => {

  socket.on('message', data => {

    const payload = JSON.parse(data.toString());

    // Add id + timestamp for messages
    if (payload.type === 'message') {
      payload.id = crypto.randomUUID();
      payload.timestamp = Date.now();
    }

    // Broadcast EVERYTHING
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payload));
      }
    });
  });

});
