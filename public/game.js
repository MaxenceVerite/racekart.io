const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Initial size

// Kart dimensions
const kartWidth = 40;
const kartHeight = 60;

let players = {};
let selfId = null;
let circuit = null;
let lootboxes = [];
let activeItems = [];
let lootboxAnimationTime = 0;
let playerFrozen = false;

socket.on('connect', () => {
    selfId = socket.id;
    console.log('Connected to server with ID:', selfId);
});

socket.on('gameState', (gameState) => {
    players = gameState.players;
    circuit = gameState.circuit;
    lootboxes = gameState.lootboxes;
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

socket.on('playerDisconnected', (playerId) => {
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

socket.on('itemPickedUp', (item) => {
    if(players[selfId]) {
        players[selfId].item = item;
    }
});

socket.on('lootboxPickedUp', (boxId) => {
    lootboxes = lootboxes.filter(box => box.id !== boxId);
});

socket.on('lootboxRespawned', (box) => {
    lootboxes.push(box);
});

socket.on('itemUsed', (item) => {
    // activeItems.push(item);
});

socket.on('itemDestroyed', (itemId) => {
    activeItems = activeItems.filter(item => item.id !== itemId);
});

socket.on('itemsUpdate', (serverItems) => {
    activeItems = serverItems;
});

socket.on('playerHit', (data) => {
    if (players[data.id]) {
        players[data.id].recovering = true;
        if (data.id === selfId) {
            playerFrozen = true;
        }
    }
});

socket.on('playerRecovered', (data) => {
    if (players[data.id]) {
        players[data.id].recovering = false;
        if (data.id === selfId) {
            playerFrozen = false;
        }
    }
});

let controlsInverted = false;
socket.on('controlsInverted', () => {
    controlsInverted = true;
    setTimeout(() => {
        controlsInverted = false;
    }, 5000);
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
    if (e.key === 'Enter') {
        const player = players[selfId];
        if (player && player.item) {
            socket.emit('useItem', player.item);
            player.item = null; // Clear item immediately on client
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = false;
    }
});

function updatePlayerState() {
    if (playerFrozen) return;
    const player = players[selfId];
    if (!player) return;

    // --- Vehicle Physics ---
    const acceleration = 0.04;
    const deceleration = 0.05;
    const friction = 0.015;
    const maxSpeed = 3.5;
    const turnSpeed = 0.03; // radians

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
            player.angle -= controlsInverted ? -turnSpeed : turnSpeed;
            player.steerAngle = -0.3; // Visual steer
            moved = true;
        }
        if (keys.ArrowRight) {
            player.angle += controlsInverted ? -turnSpeed : turnSpeed;
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
    ctx.lineWidth = 220; // Width of the road
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw the road
    ctx.beginPath();
    ctx.moveTo(circuit.path[0].x, circuit.path[0].y);
    for (let i = 1; i < circuit.path.length; i++) {
        ctx.lineTo(circuit.path[i].x, circuit.path[i].y);
    }
    ctx.stroke();

    // Draw shortcut area
    if (circuit.boundaries.shortcut) {
        ctx.beginPath();
        ctx.moveTo(circuit.boundaries.shortcut[0].x, circuit.boundaries.shortcut[0].y);
        for (let i = 1; i < circuit.boundaries.shortcut.length; i++) {
            ctx.lineTo(circuit.boundaries.shortcut[i].x, circuit.boundaries.shortcut[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(210, 180, 140, 0.8)'; // A dirt/offroad color
        ctx.fill();
    }

    // Draw finish line
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'white';
    ctx.beginPath();
    ctx.moveTo(circuit.finishLine.start.x, circuit.finishLine.start.y);
    ctx.lineTo(circuit.finishLine.end.x, circuit.finishLine.end.y);
    ctx.stroke();

}


function drawKart(player) {
    const { x, y, color, angle, steerAngle, id, recovering, boosted } = player;

    ctx.save();
    ctx.translate(x, y);

    if (recovering) {
        // Blink effect
        ctx.globalAlpha = (Math.floor(Date.now() / 100) % 2 === 0) ? 0.5 : 1;
    }
    ctx.rotate(angle);

    if (boosted) {
        // Draw fire effect
        const fireHeight = 20 + Math.random() * 10;
        const fireWidth = 20 + Math.random() * 5;
        ctx.fillStyle = `rgba(255, ${Math.random() * 150}, 0, 0.8)`;
        ctx.beginPath();
        ctx.moveTo(-fireWidth / 2, kartHeight / 2);
        ctx.lineTo(fireWidth / 2, kartHeight / 2);
        ctx.lineTo(0, kartHeight / 2 + fireHeight);
        ctx.closePath();
        ctx.fill();
    }

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
    ctx.globalAlpha = 1.0; // Reset alpha
}


function drawMinimap() {
    if (!circuit) return;

    const minimapX = canvas.width - 210;
    const minimapY = canvas.height - 160;
    const minimapWidth = 200;
    const minimapHeight = 150;
    const scaleX = minimapWidth / circuit.map_size.width;
    const scaleY = minimapHeight / circuit.map_size.height;

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

const itemImages = {
    'carton': new Image(),
    'pierre_bleue': new Image(),
    'grappin': new Image(),
    'oeuf_au_plat': new Image(),
    'inverseur': new Image()
};
itemImages.carton.src = '/assets/carton.png';
itemImages.pierre_bleue.src = '/assets/pierre_bleue.png';
itemImages.grappin.src = '/assets/grappin.png';
itemImages.oeuf_au_plat.src = '/assets/oeuf_au_plat.png';
itemImages.inverseur.src = '/assets/inverseur.png';


function drawUI() {
    if (!selfId || !players[selfId]) return;

    const player = players[selfId];

    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Display Lap count
    ctx.fillText(`Lap: ${player.lap}`, 20, 20);

    // Display item
    if (player.item && itemImages[player.item]) {
        ctx.drawImage(itemImages[player.item], 20, 50, 40, 40);
    }
}

function drawLootboxes() {
    lootboxAnimationTime += 0.1;
    const boxSize = 30;
    for (const box of lootboxes) {
        ctx.save();
        ctx.translate(box.x, box.y);
        ctx.rotate(lootboxAnimationTime * 0.5);

        // Rainbow effect
        const hue = (lootboxAnimationTime * 10) % 360;
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize);
        ctx.restore();
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const selfPlayer = players[selfId];

    // --- Camera Translation ---
    ctx.save();
    if (selfPlayer) {
        const camX = -selfPlayer.x + canvas.width / 2;
        const camY = -selfPlayer.y + canvas.height / 2;
        ctx.translate(camX, camY);
    }

    ctx.fillStyle = '#6ab04c';
    ctx.fillRect(0, 0, circuit ? circuit.map_size.width : canvas.width, circuit ? circuit.map_size.height : canvas.height);

    drawCircuit();
    drawLootboxes();
    drawActiveItems();

    if (selfPlayer) {
        updatePlayerState();
    }

    for (const id in players) {
        drawKart(players[id]);
    }

    ctx.restore(); // Restore context to pre-camera state

    // --- UI Elements (drawn outside of camera translation) ---
    drawMinimap();
    drawUI();

    requestAnimationFrame(draw);
}

function drawActiveItems() {
    for (const item of activeItems) {
        if (item.type === 'carton') {
            const boxSize = 40;
            ctx.fillStyle = '#D2B48C'; // Tan color for carton
            ctx.fillRect(item.x - boxSize / 2, item.y - boxSize / 2, boxSize, boxSize);
            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth = 2;
            ctx.strokeRect(item.x - boxSize / 2, item.y - boxSize / 2, boxSize, boxSize);
        } else if (item.type === 'pierre_bleue') {
            ctx.fillStyle = 'deepskyblue';
            ctx.beginPath();
            ctx.arc(item.x, item.y, 15, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (item.type === 'grappin') {
            ctx.strokeStyle = 'gray';
            ctx.lineWidth = 5;
            ctx.beginPath();
            const player = players[item.playerId];
            if(player) {
                ctx.moveTo(player.x, player.y);
                ctx.lineTo(item.x, item.y);
                ctx.stroke();
            }
        }
    }
}

draw();
