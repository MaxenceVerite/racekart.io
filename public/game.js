const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const playerSize = 20; // Size of the player's kart

let players = {};
let selfId = null;

socket.on('connect', () => {
  selfId = socket.id;
  console.log('Connected to server with ID:', selfId);
});

socket.on('currentPlayers', (serverPlayers) => {
  players = serverPlayers;
  requestAnimationFrame(draw);
});

socket.on('newPlayer', (playerInfo) => {
  players[playerInfo.id] = playerInfo;
});

socket.on('disconnect', (playerId) => {
  delete players[playerId];
});

socket.on('playerMoved', (playerInfo) => {
  if (players[playerInfo.id]) {
    players[playerInfo.id].x = playerInfo.x;
    players[playerInfo.id].y = playerInfo.y;
  }
});

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

function updatePlayerPosition() {
  const player = players[selfId];
  if (!player) return;

  const speed = 5;
  let moved = false;

  if (keys.ArrowUp) {
    player.y -= speed;
    moved = true;
  }
  if (keys.ArrowDown) {
    player.y += speed;
    moved = true;
  }
  if (keys.ArrowLeft) {
    player.x -= speed;
    moved = true;
  }
  if (keys.ArrowRight) {
    player.x += speed;
    moved = true;
  }

  // Clamp position to canvas bounds
  player.x = Math.max(0, Math.min(canvas.width - playerSize, player.x));
  player.y = Math.max(0, Math.min(canvas.height - playerSize, player.y));

  if (moved) {
    socket.emit('playerMovement', { x: player.x, y: player.y });
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if(selfId) {
    updatePlayerPosition();
  }

  for (const id in players) {
    const player = players[id];
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, playerSize, playerSize);

    // Draw player ID
    ctx.fillStyle = 'black';
    ctx.font = '12px Arial';
    ctx.fillText(player.id.substring(0, 5), player.x, player.y - 5);
  }

  requestAnimationFrame(draw);
}

draw();
