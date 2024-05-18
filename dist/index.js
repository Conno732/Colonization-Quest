const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 2160;
canvas.height = 1440;
canvas.style.width = "1080px";
canvas.style.height = "720px";
var ResourceType;
(function (ResourceType) {
    ResourceType["CONCRETE"] = "Tomato";
    ResourceType["SPICE"] = "orange";
    ResourceType["ANIMAL"] = "MediumSeaGreen";
    ResourceType["METAL"] = "lightgray";
    ResourceType["WOOD"] = "brown";
    ResourceType["FREAKY"] = "purple";
    ResourceType["DESERT"] = "gray";
})(ResourceType || (ResourceType = {}));
var PlayerColors;
(function (PlayerColors) {
    PlayerColors["WHITE"] = "white";
    PlayerColors["RED"] = "red";
    PlayerColors["BLACK"] = "black";
    PlayerColors["GREEN"] = "green";
})(PlayerColors || (PlayerColors = {}));
var TileVertices;
(function (TileVertices) {
    TileVertices[TileVertices["BOTTOM_LEFT"] = 0] = "BOTTOM_LEFT";
    TileVertices[TileVertices["TOP_LEFT"] = 1] = "TOP_LEFT";
    TileVertices[TileVertices["TOP"] = 2] = "TOP";
    TileVertices[TileVertices["TOP_RIGHT"] = 3] = "TOP_RIGHT";
    TileVertices[TileVertices["BOTTOM_RIGHT"] = 4] = "BOTTOM_RIGHT";
    TileVertices[TileVertices["BOTTOM"] = 5] = "BOTTOM";
})(TileVertices || (TileVertices = {}));
class RenderService {
    constructor(renderingContext, renderLayerOrder, debug = false) {
        this.debug = debug;
        this.renderingContext = renderingContext;
        this.renderLayers = [];
        this.renderLayerMap = {};
        for (let i = 0; i < renderLayerOrder.length; i++) {
            this.renderLayerMap[renderLayerOrder[i]] = i;
            this.renderLayers.push([]);
        }
        if (debug) {
            console.log(this.renderLayerMap, this.renderLayers);
        }
    }
    renderFrame() {
        for (let j = 0; j < this.renderLayers.length; j++) {
            const objects = this.renderLayers[j];
            for (let i = 0; i < objects.length; i++)
                objects[i].draw(this.renderingContext);
        }
    }
    addElement(layer, renderable) {
        this.renderLayers[this.renderLayerMap[layer]].push(renderable);
    }
}
function axialToPixel(coord, size, offSet) {
    const x = size * (Math.sqrt(3) * coord.q + (Math.sqrt(3) / 2) * coord.r) +
        offSet.x;
    const y = size * ((3 / 2) * coord.r) + offSet.y;
    return { x, y, connectedEdges: [] };
}
function areNumbersEqual(num1, num2, epsilon = 0.1) {
    return Math.abs(num1 - num2) < epsilon;
}
function verticesEqual(v1, v2) {
    return areNumbersEqual(v1.x, v2.x) && areNumbersEqual(v1.y, v2.y);
}
function edgesEqual(e1, e2) {
    return ((verticesEqual(e1.v1, e2.v1) && verticesEqual(e1.v2, e2.v2)) ||
        (verticesEqual(e1.v1, e2.v2) && verticesEqual(e1.v2, e2.v1)));
}
function addVertex(vertex, vertices) {
    for (const v of vertices) {
        if (verticesEqual(v, vertex)) {
            return v;
        }
    }
    vertices.push(vertex);
    return vertex;
}
function addEdge(edge, edges) {
    for (const e of edges) {
        if (edgesEqual(e, edge)) {
            return e;
        }
    }
    edges.push(edge);
    return edge;
}
function createHexagon(coord, offSet, size, vertices, edges) {
    const center = axialToPixel(coord, size, offSet);
    const angleIncrement = Math.PI / 3;
    const currentEdges = [];
    const currentVertices = [];
    for (let i = 0; i < 6; i++) {
        const angle = angleIncrement * i - Math.PI / 6;
        const vertex = {
            x: center.x + size * Math.cos(angle),
            y: center.y + size * Math.sin(angle),
            connectedEdges: [],
        };
        currentVertices.push(addVertex(vertex, vertices));
    }
    for (let i = 0; i < 6; i++) {
        const edge = {
            v1: currentVertices[i],
            v2: currentVertices[(i + 1) % 6],
        };
        const newEdge = addEdge(edge, edges);
        addEdge(newEdge, newEdge.v1.connectedEdges);
        addEdge(newEdge, newEdge.v2.connectedEdges);
        currentEdges.push(newEdge);
    }
    return { coordinates: coord, edges: currentEdges, center: center };
}
class Tile {
    constructor(hexagon, rollNumber, resourceType) {
        this.rollNumber = rollNumber;
        this.resourceType = resourceType;
        this.hexagon = hexagon;
    }
    draw(ctx) {
        const edges = this.hexagon.edges;
        ctx.moveTo(edges[0].v1.x, edges[0].v1.y);
        ctx.beginPath();
        for (let i = 1; i < 7; i++) {
            if (verticesEqual(edges[i - 1].v1, edges[i % 6].v1) ||
                verticesEqual(edges[i - 1].v1, edges[i % 6].v2)) {
                ctx.lineTo(edges[i - 1].v2.x, edges[i - 1].v2.y);
                ctx.lineTo(edges[i - 1].v1.x, edges[i - 1].v1.y);
            }
            else {
                ctx.lineTo(edges[i - 1].v1.x, edges[i - 1].v1.y);
                ctx.lineTo(edges[i - 1].v2.x, edges[i - 1].v2.y);
            }
        }
        ctx.closePath();
        ctx.fillStyle = this.resourceType;
        ctx.strokeStyle = "#ffffff";
        ctx.fill();
        ctx.stroke();
        ctx.font = "60px Verdana";
        ctx.fillStyle = "white";
        ctx.strokeStyle = "black";
        const textMetrics = ctx.measureText(this.rollNumber.toString());
        const textWidth = textMetrics.width;
        const textHeight = 50;
        const x = this.hexagon.center.x - textWidth / 2;
        const y = this.hexagon.center.y + textHeight / 2;
        ctx.fillText(this.rollNumber.toString(), x, y);
        ctx.strokeText(this.rollNumber.toString(), x, y);
    }
}
class TileGrid {
    constructor(radius, offset, size, tileResourceDistributor) {
        this.grid = {};
        this.vertices = [];
        this.edges = [];
        this.directions = [
            { q: 1, r: 0 },
            { q: 1, r: -1 },
            { q: 0, r: -1 },
            { q: -1, r: 0 },
            { q: -1, r: 1 },
            { q: 0, r: 1 },
        ];
        this.grid = {};
        this.gridRadius = radius;
        this.centerOffset = offset;
        this.tileSize = size;
        this.generateHexGrid(tileResourceDistributor);
    }
    generateHexGrid(tileResourceDistributor) {
        for (let q = -this.gridRadius; q <= this.gridRadius; q++) {
            for (let r = Math.max(-this.gridRadius, -q - this.gridRadius); r <= Math.min(this.gridRadius, -q + this.gridRadius); r++) {
                const key = `${q},${r}`;
                this.grid[key] = new Tile(createHexagon({ q, r }, this.centerOffset, this.tileSize, this.vertices, this.edges), Math.floor(Math.random() * 11 + 1), tileResourceDistributor.getRandomResource());
            }
        }
    }
}
class TileResourceDistributer {
    constructor(resourceTileWeights) {
        this.weightedResourceTable = [];
        for (let j = 0; j < resourceTileWeights.length; j++) {
            for (let i = 0; i < resourceTileWeights[j].weight * 100; i++) {
                this.weightedResourceTable.push(resourceTileWeights[j].resource);
            }
        }
    }
    getRandomResource() {
        return this.weightedResourceTable[Math.floor(Math.random() * this.weightedResourceTable.length)];
    }
}
const resourceTileWeights = [
    { resource: ResourceType.CONCRETE, weight: 0.2 },
    { resource: ResourceType.SPICE, weight: 0.25 },
    { resource: ResourceType.ANIMAL, weight: 0.2 },
    { resource: ResourceType.METAL, weight: 0.15 },
    { resource: ResourceType.WOOD, weight: 0.1 },
    { resource: ResourceType.FREAKY, weight: 0.1 },
];
class Building {
    constructor() { }
}
class Road {
    constructor() { }
}
///////////////////////////////////////////////////////////////////////////////////
const resourceGenerator = new TileResourceDistributer(resourceTileWeights);
const renderLayers = ["tile", "edge", "vertex"];
const renderService = new RenderService(ctx, renderLayers, true);
const tileGrid = new TileGrid(4, { x: canvas.width / 2, y: canvas.height / 2 }, 100, resourceGenerator);
for (const key in tileGrid.grid) {
    if (tileGrid.grid.hasOwnProperty(key)) {
        renderService.addElement("tile", tileGrid.grid[key]);
    }
}
console.log(tileGrid.edges);
renderService.renderFrame();
//# sourceMappingURL=index.js.map