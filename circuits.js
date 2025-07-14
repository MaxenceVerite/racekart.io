const scale = 7.0;

function scalePoints(points) {
    return points.map(p => ({ x: p.x * scale, y: p.y * scale }));
}

function scaleLine(line) {
    return {
        start: { x: line.start.x * scale, y: line.start.y * scale },
        end: { x: line.end.x * scale, y: line.end.y * scale }
    };
}

const circuits = [
    {
        name: "Le Grand Huit",
        map_size: {width: 1200 * scale, height: 800 * scale},
        startPosition: { x: 150 * scale, y: 150 * scale },
        startAngle: 0,
        path: scalePoints([
            // Grande ligne droite de départ
            { x: 150, y: 150 }, { x: 600, y: 150 },
            // Virage serré à droite
            { x: 650, y: 200 }, { x: 650, y: 250 },
            // Diagonale
            { x: 550, y: 350 }, { x: 450, y: 450 },
            // Chicane
            { x: 400, y: 500 }, { x: 450, y: 550 }, { x: 500, y: 500 },
            // Longue courbe vers la gauche
            { x: 600, y: 450 }, { x: 800, y: 450 }, { x: 900, y: 550 },
            // Ligne droite arrière
            { x: 900, y: 650 },
            // Virage large
            { x: 800, y: 750 }, { x: 600, y: 750 },
            // Retour vers la ligne de départ
            { x: 200, y: 750 }, { x: 100, y: 650 }, { x: 100, y: 250 },
            { x: 150, y: 150 }
        ]),
        boundaries: {
            outer: scalePoints([
                { x: 50, y: 100 }, { x: 650, y: 100 }, { x: 700, y: 200 }, { x: 700, y: 300 },
                { x: 550, y: 400 }, { x: 500, y: 600 }, { x: 950, y: 700 }, { x: 950, y: 800 },
                { x: 50, y: 800 }, { x: 50, y: 200 }, { x: 50, y: 100 }
            ]),
            inner: scalePoints([
                { x: 200, y: 200 }, { x: 600, y: 200 }, { x: 600, y: 250 }, { x: 500, y: 350 },
                { x: 450, y: 400 }, { x: 500, y: 450 }, { x: 550, y: 400 }, { x: 750, y: 500 },
                { x: 850, y: 600 }, { x: 850, y: 700 }, { x: 250, y: 700 }, { x: 150, y: 600 },
                { x: 150, y: 250 }, { x: 200, y: 200 }
            ]),
            shortcut: scalePoints([
                { x: 650, y: 250 }, { x: 750, y: 350 }, { x: 750, y: 500 }, { x: 600, y: 400 }, { x: 600, y: 250 }
            ])
        },
        finishLine: scaleLine({
            start: { x: 125, y: 100 },
            end: { x: 125, y: 200 }
        }),
        checkpoints: [
            { line: scaleLine({ start: { x: 675, y: 225 }, end: { x: 625, y: 275 } }), position: { x: 650 * scale, y: 250 * scale } },
            { line: scaleLine({ start: { x: 475, y: 575 }, end: { x: 525, y: 525 } }), position: { x: 500 * scale, y: 550 * scale } },
            { line: scaleLine({ start: { x: 925, y: 625 }, end: { x: 875, y: 675 } }), position: { x: 900 * scale, y: 650 * scale } },
            { line: scaleLine({ start: { x: 150, y: 700 }, end: { x: 250, y: 700 } }), position: { x: 200 * scale, y: 700 * scale } }
        ],
        lootboxes: [
            { x: 400 * scale, y: 150 * scale },
            { x: 650 * scale, y: 225 * scale },
            { x: 475 * scale, y: 525 * scale },
            { x: 850 * scale, y: 500 * scale },
            { x: 850 * scale, y: 700 * scale },
            { x: 400 * scale, y: 750 * scale },
            { x: 150 * scale, y: 450 * scale }
        ]
    },
    // Le deuxième circuit reste inchangé pour l'instant
    {
        name: "Circuit Sinueux",
        map_size: {width: 800 * 4.5, height: 600 * 4.5},
        startPosition: { x: 100 * 4.5, y: 100 * 4.5 },
        startAngle: Math.PI / 2,
        path: [{x:450,y:450},{x:3150,y:450},{x:3150,y:1350},{x:450,y:1350},{x:450,y:2250},{x:3150,y:2250},{x:3150,y:450}],
        boundaries: {
             outer: [{x:225,y:225},{x:3375,y:225},{x:3375,y:1575},{x:225,y:1575},{x:225,y:2475},{x:3375,y:2475},{x:3375,y:225}],
             inner: [{x:675,y:675},{x:2925,y:675},{x:2925,y:1125},{x:675,y:1125},{x:675,y:2025},{x:2925,y:2025},{x:2925,y:675}]
        },
        finishLine: {start:{x:225,y:562.5},end:{x:675,y:562.5}},
        checkpoints: [
            { line: {start:{x:3375,y:1237.5},end:{x:2925,y:1237.5}}, position: { x: 3150, y: 1237.5 } },
            { line: {start:{x:225,y:2137.5},end:{x:675,y:2137.5}}, position: { x: 450, y: 2137.5 } }
        ],
        lootboxes: [
            { x: 1800, y: 450 },
            { x: 1800, y: 1350 },
            { x: 1800, y: 2250 }
        ]
    }
];

module.exports = circuits;
