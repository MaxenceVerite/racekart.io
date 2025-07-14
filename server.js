const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let players = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Create a new player and add it to our players object
  players[socket.id] = {
    x: Math.floor(Math.random() * 700) + 50,
    y: Math.floor(Math.random() * 500) + 50,
    color: `hsl(${Math.random() * 360}, 100%, 50%)`,
    id: socket.id
  };

  // Send the current state of all players to the new player
  socket.emit('currentPlayers', players);

  // Update all other players of the new player
  socket.broadcast.emit('newPlayer', players[socket.id]);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove this player from our players object
    delete players[socket.id];
    // Emit a message to all other players to remove this player
    io.emit('disconnect', socket.id);
  });

  // when a player moves, update the player data
  socket.on('playerMovement', function (movementData) {
    if (players[socket.id]) {
      players[socket.id].x = movementData.x;
      players[socket.id].y = movementData.y;
      // emit a message to all other players about the player that moved
      socket.broadcast.emit('playerMoved', players[socket.id]);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
