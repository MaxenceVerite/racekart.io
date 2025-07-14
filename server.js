const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const PLAYER_SIZE = { width: 20, height: 30 }; // Matching client-side approx.

app.use(express.static('public'));

let players = {};

function checkCollisions(movedPlayer) {
    for (const id in players) {
        if (id === movedPlayer.id) continue;

        const otherPlayer = players[id];

        // Simple AABB collision detection (approximated)
        const dx = otherPlayer.x - movedPlayer.x;
        const dy = otherPlayer.y - movedPlayer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = (PLAYER_SIZE.width + PLAYER_SIZE.height) / 2; // Simple average radius

        if (distance < minDistance) {
            // Collision detected!
            const overlap = minDistance - distance;
            const angle = Math.atan2(dy, dx);

            // Move both players apart
            const moveX = (overlap / 2) * Math.cos(angle);
            const moveY = (overlap / 2) * Math.sin(angle);

            movedPlayer.x -= moveX;
            movedPlayer.y -= moveY;
            otherPlayer.x += moveX;
            otherPlayer.y += moveY;

            // Notify both players of the position correction
            io.to(movedPlayer.id).emit('playerMoved', movedPlayer);
            io.to(otherPlayer.id).emit('playerMoved', otherPlayer);
        }
    }
}


io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    players[socket.id] = {
        x: Math.floor(Math.random() * 700) + 50,
        y: Math.floor(Math.random() * 500) + 50,
        color: `hsl(${Math.random() * 360}, 100%, 50%)`,
        id: socket.id,
        angle: 0,
        steerAngle: 0
    };

    socket.emit('currentPlayers', players);
    socket.broadcast.emit('newPlayer', players[socket.id]);

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete players[socket.id];
        io.emit('disconnect', socket.id);
    });

    socket.on('playerMovement', function (movementData) {
        const player = players[socket.id];
        if (!player) return;

        player.x = movementData.x;
        player.y = movementData.y;
        player.angle = movementData.angle;
        player.steerAngle = movementData.steerAngle;

        // Check for collisions after moving
        checkCollisions(player);

        // Broadcast the potentially corrected position
        socket.broadcast.emit('playerMoved', player);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
