const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 1080;
canvas.height = 720;
canvas.style.width = "1080px";
canvas.style.height = "720px";
function drawHexagon(x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x + size * Math.cos(0), y + size * Math.sin(0));
    for (let i = 1; i <= 6; i++) {
        ctx.lineTo(x + size * Math.cos((i * 2 * Math.PI) / 6), y + size * Math.sin((i * 2 * Math.PI) / 6));
    }
    ctx.closePath();
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
}
const hexagonSize = 50;
const hexagonX = canvas.width / 2;
const hexagonY = canvas.height / 2;
drawHexagon(hexagonX, hexagonY, hexagonSize);
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