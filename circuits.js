const circuits = [
    {
        name: "Circuit Ovale Simple",
        startPosition: { x: 100, y: 150 },
        startAngle: Math.PI / 2,
        // The path the kart should follow, also used for drawing the road
        path: [
            { x: 100, y: 150 }, { x: 700, y: 150 },
            { x: 700, y: 450 }, { x: 100, y: 450 },
            { x: 100, y: 150 }
        ],
        // The outer and inner boundaries of the track
        boundaries: {
            outer: [
                { x: 50, y: 100 }, { x: 750, y: 100 },
                { x: 750, y: 500 }, { x: 50, y: 500 },
                { x: 50, y: 100 }
            ],
            inner: [
                { x: 150, y: 200 }, { x: 650, y: 200 },
                { x: 650, y: 400 }, { x: 150, y: 400 },
                { x: 150, y: 200 }
            ]
        },
        // A line to cross to complete a lap
        finishLine: {
            start: { x: 50, y: 175 },
            end: { x: 150, y: 175 }
        },
        checkpoints: [
            { start: { x: 700, y: 100 }, end: { x: 700, y: 200 } },
            { start: { x: 750, y: 425 }, end: { x: 650, y: 425 } },
            { start: { x: 100, y: 500 }, end: { x: 100, y: 400 } }
        ]
    },
    {
        name: "Circuit en Sinu",
        startPosition: { x: 100, y: 100 },
        startAngle: Math.PI / 2,
        path: [
            { x: 100, y: 100 }, { x: 700, y: 100 }, { x: 700, y: 300 },
            { x: 100, y: 300 }, { x: 100, y: 500 }, { x: 700, y: 500 },
            { x: 700, y: 100 } // Loop back
        ],
        boundaries: {
             outer: [
                { x: 50, y: 50 }, { x: 750, y: 50 }, { x: 750, y: 350 },
                { x: 50, y: 350 }, { x: 50, y: 550 }, { x: 750, y: 550 },
                { x: 750, y: 50 }
            ],
            inner: [
                { x: 150, y: 150 }, { x: 650, y: 150 }, { x: 650, y: 250 },
                { x: 150, y: 250 }, { x: 150, y: 450 }, { x: 650, y: 450 },
                { x: 650, y: 150 }
            ]
        },
        finishLine: {
            start: { x: 50, y: 125 },
            end: { x: 150, y: 125 }
        },
        checkpoints: [
            { start: { x: 750, y: 275 }, end: { x: 650, y: 275 } },
            { start: { x: 50, y: 475 }, end: { x: 150, y: 475 } }
        ]
    }
];

module.exports = circuits;
