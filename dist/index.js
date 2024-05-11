const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 1080;
canvas.height = 720;
canvas.style.width = "1080px";
canvas.style.height = "720px";
function drawHexagon(x, y, size, tile) {
    const angle = Math.PI / 3;
    ctx.moveTo(x - size * Math.sin(angle), y + size * Math.cos(angle));
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 + (i * Math.PI) / 3;
        ctx.lineTo(x - size * Math.sin(angle), y + size * Math.cos(angle));
    }
    ctx.closePath();
    ctx.fillStyle = tile.resourceType;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.fill();
    let text = tile.rollNumber.toString();
    if (tile.hasRobber) {
        text = "R";
    }
    else if (tile.rollNumber == -1) {
        text = "";
    }
    ctx.font = "30px Arial";
    ctx.fillStyle = "white";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
}
function drawHexagonGrid(startX, startY, size, width, height, grid) {
    for (let row = 0; row < height; row++) {
        for (let column = 0; column < width; column++) {
            const tile = grid.getTileStd(row, column);
            if (row % 2 == 0) {
                drawHexagon(startX + Math.sqrt(3) * size * column, startY + size * 1.5 * row, size, tile);
            }
            else {
                drawHexagon(startX +
                    Math.sqrt(3) * size * column +
                    Math.sqrt(3) * size * 0.5, startY + size * 1.5 * row, size, tile);
            }
        }
    }
}
var ResourceType;
(function (ResourceType) {
    ResourceType["CONCRETE"] = "gray";
    ResourceType["SPICE"] = "orange";
    ResourceType["ANIMAL"] = "green";
    ResourceType["METAL"] = "lightgray";
    ResourceType["WOOD"] = "brown";
    ResourceType["DESERT"] = "yellow";
})(ResourceType || (ResourceType = {}));
class Building {
}
class Tile {
    constructor(resourceType, hasRobber, rollNumber) {
        this.resourceType = resourceType;
        this.hasRobber = hasRobber;
        this.rollNumber = rollNumber;
        // 6 entries, first is top right, then goes clockwise
        this.settlements = [null, null, null, null, null, null];
        // 6 entries, first is top right, then goes clockwise
        this.roads = [null, null, null, null, null, null];
    }
}
class TileGrid {
    constructor(width, height) {
        const enumKeys = Object.keys(ResourceType);
        this.grid = [];
        for (let row = 0; row < height; row++) {
            this.grid.push([]);
            for (let col = 0; col < width * 2; col++) {
                if ((row + col) % 2 == 1) {
                    this.grid[row].push(null);
                }
                else {
                    const randomKey = enumKeys[Math.floor(Math.random() * enumKeys.length)];
                    this.grid[row].push(new Tile(ResourceType[randomKey], false, Math.floor(Math.random() * 11) + 2));
                }
            }
        }
        console.log(this.grid);
    }
    getTileStd(row, col) {
        if (row % 2 == 0)
            return this.grid[row][col * 2];
        return this.grid[row][col * 2 + 1];
    }
}
const width = 7;
const height = 5;
const grid = new TileGrid(width, height);
drawHexagonGrid(250, 200, 50, width, height, grid);
//# sourceMappingURL=index.js.map