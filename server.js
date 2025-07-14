const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const PLAYER_SIZE = { width: 40, height: 60 };
const circuits = require('./circuits');
const currentCircuit = circuits[0];

app.use(express.static('public'));

let players = {};

// --- Vector Math Helpers ---
function closestPointOnLine(p, a, b) {
    const ap = { x: p.x - a.x, y: p.y - a.y };
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const magAb = ab.x * ab.x + ab.y * ab.y;
    let t = (ap.x * ab.x + ap.y * ab.y) / magAb;
    t = Math.max(0, Math.min(1, t));
    return { x: a.x + t * ab.x, y: a.y + t * ab.y };
}

function dist(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

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

function applyOffTrackPenalty(player) {
    const isOnTrack = isPointInPolygon(player, currentCircuit.boundaries.outer) &&
                      !isPointInPolygon(player, currentCircuit.boundaries.inner);
    if (!isOnTrack) {
        player.speed *= 0.95; // Constant friction/drag on grass
    }
}


function checkWallCollisions(player) {
    const boundaries = [...currentCircuit.boundaries.outer, ...currentCircuit.boundaries.inner];
    let collision = false;

    for (let i = 0; i < boundaries.length - 1; i++) {
        const p1 = boundaries[i];
        const p2 = boundaries[i+1];

        const closestPoint = closestPointOnLine(player, p1, p2);
        const distanceToWall = dist(player, closestPoint);

        if (distanceToWall < PLAYER_SIZE.height / 2) {
            collision = true;

            // Move player back to the point of collision
            const overlap = (PLAYER_SIZE.height / 2) - distanceToWall;
            const wallVector = { x: p2.x - p1.x, y: p2.y - p1.y };
            const wallAngle = Math.atan2(wallVector.y, wallVector.x);

            // Push player out of the wall along the normal
            const normalAngle = wallAngle - Math.PI / 2;
            player.x += overlap * Math.cos(normalAngle);
            player.y += overlap * Math.sin(normalAngle);

            // Calculate reflection
            const v = { x: player.speed * Math.sin(player.angle), y: -player.speed * Math.cos(player.angle) };
            const n = { x: Math.cos(normalAngle), y: Math.sin(normalAngle) };
            const dot = v.x * n.x + v.y * n.y;
            const v_reflect = { x: v.x - 2 * dot * n.x, y: v.y - 2 * dot * n.y };

            player.angle = Math.atan2(v_reflect.x, -v_reflect.y);
            player.speed *= 0.6; // Speed loss on impact
            break;
        }
    }
    return collision;
}

function checkCollisions(movedPlayer) {
    for (const id in players) {
        if (id === movedPlayer.id) continue;

        const otherPlayer = players[id];

        const dx = otherPlayer.x - movedPlayer.x;
        const dy = otherPlayer.y - movedPlayer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = PLAYER_SIZE.height;

        if (distance < minDistance) {
            const angle = Math.atan2(dy, dx);
            const overlap = minDistance - distance;

            movedPlayer.x -= (overlap / 2) * Math.cos(angle);
            movedPlayer.y -= (overlap / 2) * Math.sin(angle);
            otherPlayer.x += (overlap / 2) * Math.cos(angle);
            otherPlayer.y += (overlap / 2) * Math.sin(angle);

            const v1 = { x: movedPlayer.speed * Math.sin(movedPlayer.angle), y: -movedPlayer.speed * Math.cos(movedPlayer.angle) };
            const v2 = { x: otherPlayer.speed * Math.sin(otherPlayer.angle), y: -otherPlayer.speed * Math.cos(otherPlayer.angle) };

            const nx = dx / distance;
            const ny = dy / distance;

            const p = 2 * (v1.x * nx + v1.y * ny - v2.x * nx - v2.y * ny) / 2;

            const v1_new_x = v1.x - p * nx;
            const v1_new_y = v1.y - p * ny;
            const v2_new_x = v2.x + p * nx;
            const v2_new_y = v2.y + p * ny;

            movedPlayer.speed = Math.sqrt(v1_new_x**2 + v1_new_y**2);
            movedPlayer.angle = Math.atan2(v1_new_x, -v1_new_y);
            otherPlayer.speed = Math.sqrt(v2_new_x**2 + v2_new_y**2);
            otherPlayer.angle = Math.atan2(v2_new_x, -v2_new_y);

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

    socket.emit('gameState', { players: players, circuit: currentCircuit });
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

        checkWallCollisions(player);
        checkCollisions(player);
        applyOffTrackPenalty(player);
        checkLaps(player);

        player.x = Math.max(0, Math.min(currentCircuit.map_size.width, player.x));
        player.y = Math.max(0, Math.min(currentCircuit.map_size.height, player.y));

        socket.broadcast.emit('playerMoved', player);
    });
});

function checkLaps(player) {
    const prevPos = { x: player.x - player.speed * Math.sin(player.angle), y: player.y + player.speed * Math.cos(player.angle) };

    const nextCheckpointIndex = player.checkpoint;
    if (nextCheckpointIndex < currentCircuit.checkpoints.length) {
        const checkpoint = currentCircuit.checkpoints[nextCheckpointIndex];
        if (line_intersect(prevPos.x, prevPos.y, player.x, player.y, checkpoint.start.x, checkpoint.start.y, checkpoint.end.x, checkpoint.end.y)) {
            player.checkpoint++;
        }
    }

    if (player.checkpoint === currentCircuit.checkpoints.length) {
        const finishLine = currentCircuit.finishLine;
        if (line_intersect(prevPos.x, prevPos.y, player.x, player.y, finishLine.start.x, finishLine.start.y, finishLine.end.x, finishLine.end.y)) {
            player.lap++;
            player.checkpoint = 0;
            io.emit('lapComplete', { id: player.id, lap: player.lap });
        }
    }
}

function line_intersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    var ua, ub, den = (y4 - y3)*(x2 - x1) - (x4 - x3)*(y2 - y1);
    if (den === 0) return null;
    ua = ((x4 - x3)*(y1 - y3) - (y4 - y3)*(x1 - x3))/den;
    ub = ((x2 - x1)*(y1 - y3) - (y2 - y1)*(x1 - x3))/den;
    return (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1);
}

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
