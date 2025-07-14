const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const PLAYER_SIZE = { width: 20, height: 30 }; // Matching client-side approx.
const circuits = require('./circuits');
const currentCircuit = circuits[0]; // Start with the first circuit

app.use(express.static('public'));

let players = {};

function isPointInPolygon(point, polygon) {
    let x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        let xi = polygon[i].x, yi = polygon[i].y;
        let xj = polygon[j].x, yj = polygon[j].y;

        let intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function checkTrackBoundaries(player) {
    const isOnTrack = isPointInPolygon(player, currentCircuit.boundaries.outer) &&
                      !isPointInPolygon(player, currentCircuit.boundaries.inner);

    if (!isOnTrack) {
        player.speed = Math.min(player.speed, 1.5); // Cap speed when off-track
    }
}

function checkCollisions(movedPlayer) {
    for (const id in players) {
        if (id === movedPlayer.id) continue;

        const otherPlayer = players[id];

        const dx = otherPlayer.x - movedPlayer.x;
        const dy = otherPlayer.y - movedPlayer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = (PLAYER_SIZE.width + PLAYER_SIZE.height) / 2;

        if (distance < minDistance) {
            const overlap = minDistance - distance;
            const angle = Math.atan2(dy, dx);

            const moveX = (overlap / 2) * Math.cos(angle);
            const moveY = (overlap / 2) * Math.sin(angle);

            movedPlayer.x -= moveX;
            movedPlayer.y -= moveY;
            otherPlayer.x += moveX;
            otherPlayer.y += moveY;

            io.to(movedPlayer.id).emit('playerMoved', movedPlayer);
            io.to(otherPlayer.id).emit('playerMoved', otherPlayer);
        }
    }
}


io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    players[socket.id] = {
        x: currentCircuit.startPosition.x,
        y: currentCircuit.startPosition.y,
        color: `hsl(${Math.random() * 360}, 100%, 50%)`,
        id: socket.id,
        angle: currentCircuit.startAngle,
        steerAngle: 0,
        lap: 0,
        checkpoint: 0
    };

    // Send circuit data and current players
    socket.emit('gameState', { players: players, circuit: currentCircuit });

    // Update all other players of the new player
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
        player.speed = movementData.speed;


        // Server-side checks
        checkTrackBoundaries(player);
        checkCollisions(player);
        checkLaps(player);

        // World boundaries
        player.x = Math.max(0, Math.min(currentCircuit.map_size.width, player.x));
        player.y = Math.max(0, Math.min(currentCircuit.map_size.height, player.y));

        // Broadcast the potentially corrected position and speed
        socket.broadcast.emit('playerMoved', player);
    });
});

function checkLaps(player) {
    const prevPos = { x: player.x - player.speed * Math.sin(player.angle), y: player.y + player.speed * Math.cos(player.angle) };

    // Check for crossing checkpoints
    const nextCheckpointIndex = player.checkpoint;
    if (nextCheckpointIndex < currentCircuit.checkpoints.length) {
        const checkpoint = currentCircuit.checkpoints[nextCheckpointIndex];
        if (line_intersect(prevPos.x, prevPos.y, player.x, player.y, checkpoint.start.x, checkpoint.start.y, checkpoint.end.x, checkpoint.end.y)) {
            player.checkpoint++;
            console.log(`Player ${player.id} passed checkpoint ${player.checkpoint}`);
        }
    }

    // Check for crossing finish line
    if (player.checkpoint === currentCircuit.checkpoints.length) { // Must have passed all checkpoints
        const finishLine = currentCircuit.finishLine;
        if (line_intersect(prevPos.x, prevPos.y, player.x, player.y, finishLine.start.x, finishLine.start.y, finishLine.end.x, finishLine.end.y)) {
            player.lap++;
            player.checkpoint = 0; // Reset for next lap
            console.log(`Player ${player.id} completed lap ${player.lap}`);
            io.emit('lapComplete', { id: player.id, lap: player.lap });
        }
    }
}

// Line intercept math helper
function line_intersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    var ua, ub, den = (y4 - y3)*(x2 - x1) - (x4 - x3)*(y2 - y1);
    if (den === 0) {
        return null;
    }
    ua = ((x4 - x3)*(y1 - y3) - (y4 - y3)*(x1 - x3))/den;
    ub = ((x2 - x1)*(y1 - y3) - (y2 - y1)*(x1 - x3))/den;
    return (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1);
}

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
