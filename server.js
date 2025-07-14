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
let lootboxes = JSON.parse(JSON.stringify(currentCircuit.lootboxes || [])); // Deep copy
lootboxes.forEach((box, i) => box.id = i);
let activeItems = [];
let itemUID = 0;


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
    const onMainTrack = isPointInPolygon(player, currentCircuit.boundaries.outer) && !isPointInPolygon(player, currentCircuit.boundaries.inner);
    const onShortcut = currentCircuit.boundaries.shortcut && isPointInPolygon(player, currentCircuit.boundaries.shortcut);

    if (onShortcut) {
        player.speed *= 0.98; // Slight speed reduction for shortcut
    } else if (!onMainTrack) {
        player.speed = Math.min(player.speed, 1.0); // Heavy penalty for grass
    }
}

function checkWorldBounds(player) {
    const { x, y } = player;
    const { width, height } = currentCircuit.map_size;
    if (x < 0 || x > width || y < 0 || y > height) {
        let lastCheckpoint = player.checkpoint > 0 ? currentCircuit.checkpoints[player.checkpoint - 1] : null;
        if (lastCheckpoint) {
            player.x = lastCheckpoint.position.x;
            player.y = lastCheckpoint.position.y;
        } else {
            player.x = currentCircuit.startPosition.x;
            player.y = currentCircuit.startPosition.y;
        }
        player.speed = 0;
        io.to(player.id).emit('playerMoved', player);
    }
}

function checkWallCollisions(player) {
    const boundaries = [...currentCircuit.boundaries.outer, ...currentCircuit.boundaries.inner];
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
        checkpoint: 0,
        item: null
    };
    socket.emit('gameState', { players, circuit: currentCircuit, lootboxes });
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

        checkWorldBounds(player);
        checkWallCollisions(player);
        checkCollisions(player);
        applyOffTrackPenalty(player);
        checkLaps(player);
        checkLootboxPickup(player);
        checkItemCollision(player);

        socket.broadcast.emit('playerMoved', player);
    });

    socket.on('useItem', (itemType) => {
        const player = players[socket.id];
        if (!player || player.item !== itemType) return;

        if (itemType === 'carton') {
            const newItem = {
                id: itemUID++,
                type: 'carton',
                x: player.x - Math.sin(player.angle) * (PLAYER_SIZE.height), // Place it behind the kart
                y: player.y + Math.cos(player.angle) * (PLAYER_SIZE.height),
            };
            activeItems.push(newItem);
            io.emit('itemUsed', newItem);
        } else if (itemType === 'pierre_bleue') {
            // Find target (player in front)
            // This is a simple implementation based on who is next in the players object list
            // A real implementation would use race standings.
            const playerIds = Object.keys(players);
            const currentIndex = playerIds.indexOf(socket.id);
            const targetIndex = (currentIndex + 1) % playerIds.length;
            const targetId = playerIds[targetIndex];

            if (targetId !== socket.id) {
                const newItem = {
                    id: itemUID++,
                    type: 'pierre_bleue',
                    x: player.x,
                    y: player.y,
                    targetId: targetId,
                    speed: 5 // Speed of the shell
                };
                activeItems.push(newItem);
                io.emit('itemUsed', newItem);
            }
        }
        player.item = null;
    });
});

function checkLootboxPickup(player) {
    if (player.item) return; // Player already has an item

    for (let i = lootboxes.length - 1; i >= 0; i--) {
        const box = lootboxes[i];
        if (dist(player, box) < PLAYER_SIZE.height) { // Simple distance check for pickup
            const items = ['carton', 'pierre_bleue'];
            player.item = items[Math.floor(Math.random() * items.length)];

            // Remove the box and notify clients
            lootboxes.splice(i, 1);
            io.emit('lootboxPickedUp', box.id);

            // Respawn the box after a delay
            setTimeout(() => {
                lootboxes.push(box);
                io.emit('lootboxRespawned', box);
            }, 10000); // 10 second respawn time

            io.to(player.id).emit('itemPickedUp', player.item);
            break;
        }
    }
}

function checkItemCollision(player) {
    if (player.recovering) return;

    for (let i = activeItems.length - 1; i >= 0; i--) {
        const item = activeItems[i];
        if (item.type === 'carton') {
            if (dist(player, item) < PLAYER_SIZE.width) {
                player.speed = 0;
                player.recovering = true;
                io.emit('playerHit', { id: player.id, recovering: true });
                activeItems.splice(i, 1);
                io.emit('itemDestroyed', item.id);
                setTimeout(() => {
                    player.recovering = false;
                    io.emit('playerRecovered', { id: player.id, recovering: false });
                }, 1500);
                break;
            }
        } else if (item.type === 'pierre_bleue') {
            if (item.targetId === player.id && dist(player, item) < PLAYER_SIZE.width) {
                player.speed = 0;
                player.recovering = true;
                io.emit('playerHit', { id: player.id, recovering: true });
                activeItems.splice(i, 1);
                io.emit('itemDestroyed', item.id);
                setTimeout(() => {
                    player.recovering = false;
                    io.emit('playerRecovered', { id: player.id, recovering: false });
                }, 1500);
                break;
            }
        }
    }
}

function checkLaps(player) {
    const prevPos = { x: player.x - player.speed * Math.sin(player.angle), y: player.y + player.speed * Math.cos(player.angle) };
    const nextCheckpointIndex = player.checkpoint;
    if (nextCheckpointIndex < currentCircuit.checkpoints.length) {
        const checkpoint = currentCircuit.checkpoints[nextCheckpointIndex].line;
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

setInterval(() => {
    if(updateActiveItems()) {
        io.emit('itemsUpdate', activeItems);
    }
}, 1000 / 60); // 60 times per second

function updateActiveItems() {
    let updated = false;
    for (const item of activeItems) {
        if (item.type === 'pierre_bleue') {
            updated = true;
            const target = players[item.targetId];
            if (!target) {
                activeItems = activeItems.filter(i => i.id !== item.id);
                continue;
            }

            // Simple path following
            const path = currentCircuit.path;
            let closestPoint = null;
            let minDistance = Infinity;

            for(let i = 0; i < path.length -1; i++) {
                const p = closestPointOnLine(item, path[i], path[i+1]);
                const d = dist(item, p);
                if (d < minDistance) {
                    minDistance = d;
                    closestPoint = p;
                }
            }

            const angleToPath = Math.atan2(closestPoint.y - item.y, closestPoint.x - item.x);
            const angleToTarget = Math.atan2(target.y - item.y, target.x - item.x);

            // If close to target, go straight for it
            const distanceToTarget = dist(item, target);
            let finalAngle = angleToPath;
            if(distanceToTarget < 200) {
                finalAngle = angleToTarget;
            }


            item.x += item.speed * Math.cos(finalAngle);
            item.y += item.speed * Math.sin(finalAngle);
        }
    }
    return updated;
}
