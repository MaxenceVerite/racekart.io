const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Kart dimensions
const kartWidth = 20;
const kartHeight = 30;

let players = {};
let selfId = null;
let circuit = null;

socket.on('connect', () => {
    selfId = socket.id;
    console.log('Connected to server with ID:', selfId);
});

socket.on('gameState', (gameState) => {
    players = gameState.players;
    circuit = gameState.circuit;
    // Initialize physics properties for all players
    for(let id in players) {
        if (!players[id].speed) { // only init if not already set
             initPlayerPhysics(players[id]);
        }
    }
    requestAnimationFrame(draw);
});


socket.on('newPlayer', (playerInfo) => {
    initPlayerPhysics(playerInfo);
    players[playerInfo.id] = playerInfo;
});

socket.on('disconnect', (playerId) => {
    delete players[playerId];
});

socket.on('playerMoved', (playerInfo) => {
    if (players[playerInfo.id]) {
        Object.assign(players[playerInfo.id], playerInfo);
    }
});

socket.on('lapComplete', (data) => {
    if (players[data.id]) {
        players[data.id].lap = data.lap;
    }
});

function initPlayerPhysics(player) {
    player.speed = 0;
    // angle and position are now set by the server
}

const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = false;
    }
});

function updatePlayerState() {
    const player = players[selfId];
    if (!player) return;

    // --- Vehicle Physics ---
    const acceleration = 0.1;
    const deceleration = 0.05;
    const friction = 0.02;
    const maxSpeed = 5;
    const turnSpeed = 0.05; // radians

    let moved = false;

    // Acceleration and Braking
    if (keys.ArrowUp) {
        player.speed = Math.min(maxSpeed, player.speed + acceleration);
    }
    if (keys.ArrowDown) {
        player.speed = Math.max(-maxSpeed / 2, player.speed - deceleration); // Slower reverse
    }

    // Apply friction
    if (player.speed > 0) {
        player.speed -= friction;
    } else if (player.speed < 0) {
        player.speed += friction;
    }
    // Stop the car if speed is very low
    if (Math.abs(player.speed) < friction) {
        player.speed = 0;
    }


    // Steering (only when moving)
    if (player.speed !== 0) {
        if (keys.ArrowLeft) {
            player.angle -= turnSpeed;
            player.steerAngle = -0.3; // Visual steer
            moved = true;
        }
        if (keys.ArrowRight) {
            player.angle += turnSpeed;
            player.steerAngle = 0.3; // Visual steer
            moved = true;
        }
    }
    if (!keys.ArrowLeft && !keys.ArrowRight) {
        player.steerAngle = 0;
    }


    // Update position based on speed and angle
    player.x += player.speed * Math.sin(player.angle);
    player.y -= player.speed * Math.cos(player.angle);

    if (player.speed !== 0) {
        moved = true;
    }


    // Emit changes to the server
    if (moved) {
        socket.emit('playerMovement', {
            x: player.x,
            y: player.y,
            angle: player.angle,
            steerAngle: player.steerAngle,
            speed: player.speed
        });
    }
}

function drawCircuit() {
    if (!circuit) return;

    ctx.strokeStyle = '#a0a0a0';
    ctx.lineWidth = 50; // Width of the road
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw the road
    ctx.beginPath();
    ctx.moveTo(circuit.path[0].x, circuit.path[0].y);
    for (let i = 1; i < circuit.path.length; i++) {
        ctx.lineTo(circuit.path[i].x, circuit.path[i].y);
    }
    ctx.stroke();

    // Draw finish line
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'white';
    ctx.beginPath();
    ctx.moveTo(circuit.finishLine.start.x, circuit.finishLine.start.y);
    ctx.lineTo(circuit.finishLine.end.x, circuit.finishLine.end.y);
    ctx.stroke();

}


function drawKart(player) {
    const { x, y, color, angle, steerAngle, id } = player;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Kart Body
    ctx.fillStyle = color;
    ctx.fillRect(-kartWidth / 2, -kartHeight / 2, kartWidth, kartHeight);

    // Wheels
    const wheelWidth = 5;
    const wheelHeight = 8;
    const wheelColor = 'black';

    // Rear wheels (fixed)
    ctx.fillStyle = wheelColor;
    ctx.fillRect(-kartWidth / 2 - wheelWidth, kartHeight / 4, wheelWidth, wheelHeight); // Rear Left
    ctx.fillRect(kartWidth / 2, kartHeight / 4, wheelWidth, wheelHeight);           // Rear Right

    // Front wheels (steerable)
    ctx.save();
    ctx.translate(-kartWidth / 2, -kartHeight / 4);
    ctx.rotate(steerAngle);
    ctx.fillStyle = wheelColor;
    ctx.fillRect(-wheelWidth / 2, -wheelHeight / 2, wheelWidth, wheelHeight);
    ctx.restore();

    ctx.save();
    ctx.translate(kartWidth / 2, -kartHeight / 4);
    ctx.rotate(steerAngle);
    ctx.fillStyle = wheelColor;
    ctx.fillRect(-wheelWidth/2, -wheelHeight/2, wheelWidth, wheelHeight);
    ctx.restore();


    ctx.restore();

    // Draw player ID
    ctx.fillStyle = 'white';
    ctx.font = '10px Arial';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;
    ctx.fillText(id.substring(0, 5), x - 10, y - kartHeight/2 - 5);
    ctx.shadowBlur = 0;
}


function drawMinimap() {
    if (!circuit) return;

    const minimapX = canvas.width - 210;
    const minimapY = canvas.height - 160;
    const minimapWidth = 200;
    const minimapHeight = 150;
    const scaleX = minimapWidth / canvas.width;
    const scaleY = minimapHeight / canvas.height;

    ctx.save();

    // Draw minimap background
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = 'black';
    ctx.fillRect(minimapX, minimapY, minimapWidth, minimapHeight);
    ctx.globalAlpha = 1.0;

    // Draw minimap border
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(minimapX, minimapY, minimapWidth, minimapHeight);

    // Draw circuit path on minimap
    ctx.strokeStyle = '#a0a0a0';
    ctx.lineWidth = 5;
    ctx.beginPath();
    const startPoint = circuit.path[0];
    ctx.moveTo(minimapX + startPoint.x * scaleX, minimapY + startPoint.y * scaleY);
    for (let i = 1; i < circuit.path.length; i++) {
        const point = circuit.path[i];
        ctx.lineTo(minimapX + point.x * scaleX, minimapY + point.y * scaleY);
    }
    ctx.stroke();

    // Draw players on minimap
    for (const id in players) {
        const player = players[id];
        ctx.fillStyle = player.color;
        const playerX = minimapX + player.x * scaleX;
        const playerY = minimapY + player.y * scaleY;
        ctx.beginPath();
        ctx.arc(playerX, playerY, 3, 0, 2 * Math.PI);
        ctx.fill();
    }

    ctx.restore();
}

function drawUI() {
    if (!selfId || !players[selfId]) return;

    const player = players[selfId];

    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Display Lap count
    ctx.fillText(`Lap: ${player.lap}`, 20, 20);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#6ab04c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawCircuit();

    if (selfId) {
        updatePlayerState();
    }

    for (const id in players) {
        drawKart(players[id]);
    }

    drawMinimap();
    drawUI();

    requestAnimationFrame(draw);
}

draw();
