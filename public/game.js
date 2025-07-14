const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Kart dimensions
const kartWidth = 20;
const kartHeight = 30;

let players = {};
let selfId = null;

socket.on('connect', () => {
    selfId = socket.id;
    console.log('Connected to server with ID:', selfId);
});

socket.on('currentPlayers', (serverPlayers) => {
    players = serverPlayers;
    // Initialize physics properties for all players
    for(let id in players) {
        initPlayerPhysics(players[id]);
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

function initPlayerPhysics(player) {
    player.speed = 0;
    player.angle = 0;
    player.steerAngle = 0; // For wheel animation
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


    // Clamp position to canvas bounds
    player.x = Math.max(kartWidth / 2, Math.min(canvas.width - kartWidth / 2, player.x));
    player.y = Math.max(kartHeight / 2, Math.min(canvas.height - kartHeight / 2, player.y));

    // Emit changes to the server
    if (moved) {
        socket.emit('playerMovement', {
            x: player.x,
            y: player.y,
            angle: player.angle,
            steerAngle: player.steerAngle
        });
    }
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

    // Front wheels (steerable) - save context for individual rotation
    // Front Left
    ctx.save();
    ctx.translate(-kartWidth / 2, -kartHeight / 4);
    ctx.rotate(steerAngle);
    ctx.fillStyle = wheelColor;
    ctx.fillRect(-wheelWidth / 2, -wheelHeight / 2, wheelWidth, wheelHeight);
    ctx.restore();

    // Front Right
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


function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set a background color for the track
    ctx.fillStyle = '#6ab04c'; // A grassy green
    ctx.fillRect(0, 0, canvas.width, canvas.height);


    if (selfId) {
        updatePlayerState();
    }

    for (const id in players) {
        drawKart(players[id]);
    }

    requestAnimationFrame(draw);
}

draw();
