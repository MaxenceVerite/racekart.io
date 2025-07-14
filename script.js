document.addEventListener('DOMContentLoaded', () => {
    const loginContainer = document.getElementById('login-container');
    const gameCanvas = document.getElementById('game-canvas');
    const connectBtn = document.getElementById('connect-btn');
    const usernameInput = document.getElementById('username');

    const ctx = gameCanvas.getContext('2d');
    gameCanvas.width = 800;
    gameCanvas.height = 600;

    class Player {
        constructor(x, y, color) {
            this.x = x;
            this.y = y;
            this.color = color;
            this.width = 20;
            this.height = 40;
            this.speed = 0;
            this.angle = 0;
            this.moveAngle = 0;
        }

        draw() {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            ctx.fillStyle = this.color;
            ctx.fillRect(this.width / -2, this.height / -2, this.width, this.height);
            ctx.restore();
        }
    }

    function drawMap() {
        ctx.fillStyle = '#71c5cf';
        ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

        ctx.fillStyle = 'green';
        ctx.fillRect(50, 50, 700, 500);

        ctx.strokeStyle = 'gray';
        ctx.lineWidth = 10;
        ctx.strokeRect(100, 100, 600, 400);
    }

    let player;
    let otherPlayers = {};
    let socket;

    function gameLoop() {
        update();
        draw();
        requestAnimationFrame(gameLoop);
    }

    function update() {
        player.angle += player.moveAngle * Math.PI / 180;
        player.x += player.speed * Math.sin(player.angle);
        player.y -= player.speed * Math.cos(player.angle);

        socket.emit('player movement', { x: player.x, y: player.y, angle: player.angle });
    }

    function draw() {
        drawMap();
        player.draw();
        for (let id in otherPlayers) {
            otherPlayers[id].draw();
        }
        drawMinimap();
    }

    function drawMinimap() {
        const minimapSize = 150;
        const minimapX = gameCanvas.width - minimapSize - 10;
        const minimapY = gameCanvas.height - minimapSize - 10;
        const scale = minimapSize / Math.max(gameCanvas.width, gameCanvas.height);

        ctx.save();
        ctx.translate(minimapX, minimapY);
        ctx.scale(scale, scale);

        drawMap();

        player.draw();
        for (let id in otherPlayers) {
            otherPlayers[id].draw();
        }

        ctx.restore();
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') player.speed = 5;
        if (e.key === 'ArrowDown') player.speed = -2;
        if (e.key === 'ArrowLeft') player.moveAngle = -3;
        if (e.key === 'ArrowRight') player.moveAngle = 3;
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') player.speed = 0;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') player.moveAngle = 0;
    });

    connectBtn.addEventListener('click', () => {
        const username = usernameInput.value;
        if (username) {
            loginContainer.style.display = 'none';
            gameCanvas.style.display = 'block';

            socket = io();

            socket.on('currentPlayers', (players) => {
                Object.keys(players).forEach((id) => {
                    if (id === socket.id) {
                        player = new Player(players[id].x, players[id].y, players[id].color);
                    } else {
                        otherPlayers[id] = new Player(players[id].x, players[id].y, players[id].color);
                    }
                });
            });

            socket.on('new player', (playerInfo) => {
                otherPlayers[playerInfo.id] = new Player(playerInfo.x, playerInfo.y, playerInfo.color);
            });

            socket.on('player moved', (playerInfo) => {
                if (otherPlayers[playerInfo.playerId]) {
                    otherPlayers[playerInfo.playerId].x = playerInfo.x;
                    otherPlayers[playerInfo.playerId].y = playerInfo.y;
                    otherPlayers[playerInfo.playerId].angle = playerInfo.angle;
                }
            });

            socket.on('player disconnected', (playerId) => {
                delete otherPlayers[playerId];
            });

            socket.emit('new player', username);

            gameLoop();
        }
    });
});
