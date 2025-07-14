const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname));

let players = {};

io.on('connection', (socket) => {
    console.log('Un joueur s\'est connecté', socket.id);

    socket.on('new player', (username) => {
        players[socket.id] = {
            username: username,
            x: 400,
            y: 300,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`,
            angle: 0,
            speed: 0,
            moveAngle: 0
        };
        socket.emit('currentPlayers', players);
        socket.broadcast.emit('new player', players[socket.id]);
    });

    socket.on('player movement', (data) => {
        const player = players[socket.id] || {};
        player.x = data.x;
        player.y = data.y;
        player.angle = data.angle;
        socket.broadcast.emit('player moved', { playerId: socket.id, ...data });
    });

    socket.on('disconnect', () => {
        console.log('Un joueur s\'est déconnecté', socket.id);
        delete players[socket.id];
        io.emit('player disconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur en écoute sur le port ${PORT}`);
});
