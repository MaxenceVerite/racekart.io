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
            ctx.font = "20px Arial";
            ctx.fillText("🏎️", -10, 10);
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

    function gameLoop() {
        update();
        draw();
        requestAnimationFrame(gameLoop);
    }

    let mouse = { x: 0, y: 0 };

    document.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX - gameCanvas.getBoundingClientRect().left;
        mouse.y = e.clientY - gameCanvas.getBoundingClientRect().top;
    });

    function update() {
        let dx = mouse.x - gameCanvas.width / 2;
        let dy = mouse.y - gameCanvas.height / 2;
        let targetAngle = Math.atan2(dx, -dy);
        player.angle += (targetAngle - player.angle) * 0.1;

        if (keys['ArrowUp']) {
            player.speed += 0.1;
        } else if (keys['ArrowDown']) {
            player.speed -= 0.1;
        } else {
            player.speed *= 0.95;
        }

        player.x += player.speed * Math.sin(player.angle);
        player.y -= player.speed * Math.cos(player.angle);
    }

    function draw() {
        ctx.save();
        ctx.translate(gameCanvas.width / 2 - player.x, gameCanvas.height / 2 - player.y);
        drawMap();
        player.draw();
        ctx.restore();
        drawMinimap();
    }

    function drawMinimap() {
        const minimapSize = 150;
        const minimapX = gameCanvas.width - minimapSize - 10;
        const minimapY = gameCanvas.height - minimapSize - 10;
        const scale = minimapSize / 2000; // Assuming map size is 2000x2000

        ctx.save();
        ctx.translate(minimapX, minimapY);
        ctx.scale(scale, scale);

        drawMap();
        player.draw();

        ctx.restore();
    }

    let keys = {};
    document.addEventListener('keydown', (e) => keys[e.key] = true);
    document.addEventListener('keyup', (e) => keys[e.key] = false);

    connectBtn.addEventListener('click', () => {
        const username = usernameInput.value;
        if (username) {
            loginContainer.style.display = 'none';
            gameCanvas.style.display = 'block';
            player = new Player(400, 300, 'red');
            gameLoop();
        }
    });
});
