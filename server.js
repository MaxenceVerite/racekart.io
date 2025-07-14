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

// --- Vector Math and Collision Helpers ---

function getKartCorners(player) {
    const { x, y, angle } = player;
    const w = PLAYER_SIZE.width / 2;
    const h = PLAYER_SIZE.height / 2;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);

    const corners = [
        { x: x + w * cos - h * sin, y: y + w * sin + h * cos }, // Front-right
        { x: x - w * cos - h * sin, y: y - w * sin + h * cos }, // Front-left
        { x: x - w * cos + h * sin, y: y - w * sin - h * cos }, // Back-left
        { x: x + w * cos + h * sin, y: y + w * sin - h * cos }  // Back-right
    ];
    return corners;
}

function getAxes(corners) {
    const axes = [];
    for (let i = 0; i < corners.length; i++) {
        const p1 = corners[i];
        const p2 = corners[i === corners.length - 1 ? 0 : i + 1];
        const edge = { x: p1.x - p2.x, y: p1.y - p2.y };
        const normal = { x: -edge.y, y: edge.x };
        axes.push(normal);
    }
    return axes;
}

function project(corners, axis) {
    let min = Infinity;
    let max = -Infinity;
    for (const corner of corners) {
        const dot = corner.x * axis.x + corner.y * axis.y;
        min = Math.min(min, dot);
        max = Math.max(max, dot);
    }
    return { min, max };
}

function checkSATCollision(player1, player2) {
    const corners1 = getKartCorners(player1);
    const corners2 = getKartCorners(player2);
    const axes = [...getAxes(corners1), ...getAxes(corners2)];

    for (const axis of axes) {
        const p1 = project(corners1, axis);
        const p2 = project(corners2, axis);
        if (p1.max < p2.min || p2.max < p1.min) {
            return false; // Found a separating axis
        }
    }
    return true; // No separating axis found
}

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
        let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function applyOffTrackPenalty(player) {
    const isOnTrack = isPointInPolygon(player, currentCircuit.boundaries.outer) && !isPointInPolygon(player, currentCircuit.boundaries.inner);
    if (!isOnTrack) {
        player.speed = Math.min(player.speed, 1.0);
    }
}

function checkWallCollisions(player) {
    const worldBoundaries = [
        {x: 0, y: 0}, {x: currentCircuit.map_size.width, y: 0}, // Top
        {x: currentCircuit.map_size.width, y: 0}, {x: currentCircuit.map_size.width, y: currentCircuit.map_size.height}, // Right
        {x: currentCircuit.map_size.width, y: currentCircuit.map_size.height}, {x: 0, y: currentCircuit.map_size.height}, // Bottom
        {x: 0, y: currentCircuit.map_size.height}, {x: 0, y: 0} // Left
    ];

    const boundaries = [...currentCircuit.boundaries.outer, ...currentCircuit.boundaries.inner, ...worldBoundaries];
    for (let i = 0; i < boundaries.length - 1; i++) {
        const p1 = boundaries[i];
        const p2 = boundaries[i + 1];
        const closestPoint = closestPointOnLine(player, p1, p2);
        const distanceToWall = dist(player, closestPoint);

        if (distanceToWall < PLAYER_SIZE.height / 2) {
            const overlap = (PLAYER_SIZE.height / 2) - distanceToWall;
            const wallVector = { x: p2.x - p1.x, y: p2.y - p1.y };
            const wallAngle = Math.atan2(wallVector.y, wallVector.x);
            const normalAngle = wallAngle - Math.PI / 2;
            player.x += overlap * Math.cos(normalAngle);
            player.y += overlap * Math.sin(normalAngle);

            const v = { x: player.speed * Math.sin(player.angle), y: -player.speed * Math.cos(player.angle) };
            const n = { x: Math.cos(normalAngle), y: Math.sin(normalAngle) };
            const dot = v.x * n.x + v.y * n.y;
            const v_reflect = { x: v.x - 2 * dot * n.x, y: v.y - 2 * dot * n.y };
            player.angle = Math.atan2(v_reflect.x, -v_reflect.y);
            player.speed *= 0.6;
            break;
        }
    }
}

function checkCollisions(movedPlayer) {
    for (const id in players) {
        if (id === movedPlayer.id) continue;
        const otherPlayer = players[id];

        if (checkSATCollision(movedPlayer, otherPlayer)) {
            // --- Resolve Overlap ---
            // This part is complex. A simple push-out is used for now.
            const dx = otherPlayer.x - movedPlayer.x;
            const dy = otherPlayer.y - movedPlayer.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const overlap = (PLAYER_SIZE.height) - distance; // Approximate overlap

            if (distance > 0) {
                const pushX = (dx / distance) * overlap / 2;
                const pushY = (dy / distance) * overlap / 2;
                movedPlayer.x -= pushX;
                movedPlayer.y -= pushY;
                otherPlayer.x += pushX;
                otherPlayer.y += pushY;
            }


            // --- Resolve Velocities ---
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
