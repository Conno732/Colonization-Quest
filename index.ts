const canvas: HTMLCanvasElement | null = document.getElementById(
    "gameCanvas"
) as HTMLCanvasElement;
const ctx = canvas.getContext("2d");

canvas.width = 1080;
canvas.height = 720;
canvas.style.width = "1080px";
canvas.style.height = "720px";

function drawHexagon(x: number, y: number, size: number) {
    ctx.beginPath();
    ctx.moveTo(x + size * Math.cos(0), y + size * Math.sin(0));

    for (let i = 1; i <= 6; i++) {
        ctx.lineTo(
            x + size * Math.cos((i * 2 * Math.PI) / 6),
            y + size * Math.sin((i * 2 * Math.PI) / 6)
        );
    }

    ctx.closePath();
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
}

const hexagonSize: number = 50;
const hexagonX: number = canvas.width / 2;
const hexagonY: number = canvas.height / 2;
drawHexagon(hexagonX, hexagonY, hexagonSize);

enum ResourceType {
    CONCRETE,
    SPICE,
    ANIMAL,
    METAL,
    WOOD,
    DESERT,
    NONE,
}

class Building {}

class TileGrid {
    constructor() {}
}

class Tile {
    xGridCoord: number;
    yGridCoord: number;
    resourceType: ResourceType;
    hasRobber: boolean;
    rollNumber: number;
    settlements: Building | null[];
    roads: boolean | null[];

    constructor(
        xGridCoord: number,
        yGridCoord: number,
        resourceType: ResourceType,
        hasRobber: boolean,
        rollNumber: number
    ) {
        this.xGridCoord = xGridCoord;
        this.yGridCoord = yGridCoord;
        this.resourceType = resourceType;
        this.hasRobber = hasRobber;
        this.rollNumber = rollNumber;
        // 6 entries, first is top right, then goes clockwise
        this.settlements = [null, null, null, null, null, null];
        // 6 entries, first is top right, then goes clockwise
        this.roads = [null, null, null, null, null, null];
    }
}
