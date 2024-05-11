const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 1080;
canvas.height = 720;
canvas.style.width = "1080px";
canvas.style.height = "720px";
function drawHexagon(x, y, size) {
    const angle = Math.PI / 3;
    ctx.moveTo(x - size * Math.sin(angle), y + size * Math.cos(angle));
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 + (i * Math.PI) / 3;
        ctx.lineTo(x - size * Math.sin(angle), y + size * Math.cos(angle));
    }
    ctx.closePath();
    ctx.fillStyle = "blue";
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.fill();
}
function drawHexagonGrid(startX, startY, size, rows, columns) {
    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
            if (row % 2 == 0) {
                drawHexagon(startX + Math.sqrt(3) * size * column, startY + size * 1.5 * row, size);
            }
            else {
                drawHexagon(startX +
                    Math.sqrt(3) * size * column +
                    Math.sqrt(3) * size * 0.5, startY + size * 1.5 * row, size);
            }
        }
    }
}
drawHexagonGrid(100, 100, 25, 5, 5);
var ResourceType;
(function (ResourceType) {
    ResourceType[ResourceType["CONCRETE"] = 0] = "CONCRETE";
    ResourceType[ResourceType["SPICE"] = 1] = "SPICE";
    ResourceType[ResourceType["ANIMAL"] = 2] = "ANIMAL";
    ResourceType[ResourceType["METAL"] = 3] = "METAL";
    ResourceType[ResourceType["WOOD"] = 4] = "WOOD";
    ResourceType[ResourceType["DESERT"] = 5] = "DESERT";
    ResourceType[ResourceType["NONE"] = 6] = "NONE";
})(ResourceType || (ResourceType = {}));
class Building {
}
class TileGrid {
    constructor() { }
}
class Tile {
    constructor(xGridCoord, yGridCoord, resourceType, hasRobber, rollNumber) {
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
//# sourceMappingURL=index.js.map