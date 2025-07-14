const scale = 2.5;

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
        name: "Circuit Ovale Simple",
        map_size: {width: 800 * scale, height: 600 * scale},
        startPosition: { x: 100 * scale, y: 150 * scale },
        startAngle: Math.PI / 2,
        path: scalePoints([
            { x: 100, y: 150 }, { x: 700, y: 150 },
            { x: 700, y: 450 }, { x: 100, y: 450 },
            { x: 100, y: 150 }
        ]),
        boundaries: {
            outer: scalePoints([
                { x: 50, y: 100 }, { x: 750, y: 100 },
                { x: 750, y: 500 }, { x: 50, y: 500 },
                { x: 50, y: 100 }
            ]),
            inner: scalePoints([
                { x: 150, y: 200 }, { x: 650, y: 200 },
                { x: 650, y: 400 }, { x: 150, y: 400 },
                { x: 150, y: 200 }
            ])
        },
        finishLine: scaleLine({
            start: { x: 50, y: 175 },
            end: { x: 150, y: 175 }
        }),
        checkpoints: [
            scaleLine({ start: { x: 700, y: 100 }, end: { x: 700, y: 200 } }),
            scaleLine({ start: { x: 750, y: 425 }, end: { x: 650, y: 425 } }),
            scaleLine({ start: { x: 100, y: 500 }, end: { x: 100, y: 400 } })
        ]
    },
    {
        name: "Circuit en Sinu",
        map_size: {width: 800 * scale, height: 600 * scale},
        startPosition: { x: 100 * scale, y: 100 * scale },
        startAngle: Math.PI / 2,
        path: scalePoints([
            { x: 100, y: 100 }, { x: 700, y: 100 }, { x: 700, y: 300 },
            { x: 100, y: 300 }, { x: 100, y: 500 }, { x: 700, y: 500 },
            { x: 700, y: 100 }
        ]),
        boundaries: {
             outer: scalePoints([
                { x: 50, y: 50 }, { x: 750, y: 50 }, { x: 750, y: 350 },
                { x: 50, y: 350 }, { x: 50, y: 550 }, { x: 750, y: 550 },
                { x: 750, y: 50 }
            ]),
            inner: scalePoints([
                { x: 150, y: 150 }, { x: 650, y: 150 }, { x: 650, y: 250 },
                { x: 150, y: 250 }, { x: 150, y: 450 }, { x: 650, y: 450 },
                { x: 650, y: 150 }
            ])
        },
        finishLine: scaleLine({
            start: { x: 50, y: 125 },
            end: { x: 150, y: 125 }
        }),
        checkpoints: [
            scaleLine({ start: { x: 750, y: 275 }, end: { x: 650, y: 275 } }),
            scaleLine({ start: { x: 50, y: 475 }, end: { x: 150, y: 475 } })
        ]
    }
];

module.exports = circuits;
