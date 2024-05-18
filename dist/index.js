const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 1080;
canvas.height = 720;
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
function axialToPixel(coord, size) {
    const x = size * (Math.sqrt(3) * coord.q + (Math.sqrt(3) / 2) * coord.r);
    const y = size * ((3 / 2) * coord.r);
    return { x, y };
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
function createHexagon(coord, size, vertices, edges) {
    const center = axialToPixel(coord, size);
    const angleIncrement = Math.PI / 3;
    const currentEdges = [];
    const currentVertices = [];
    for (let i = 0; i < 6; i++) {
        const angle = angleIncrement * i - Math.PI / 6;
        const vertex = {
            x: center.x + size * Math.cos(angle),
            y: center.y + size * Math.sin(angle),
        };
        currentVertices.push(addVertex(vertex, vertices));
    }
    for (let i = 0; i < 6; i++) {
        const edge = {
            v1: currentVertices[i],
            v2: currentVertices[(i + 1) % 6],
        };
        currentEdges.push(addEdge(edge, edges));
    }
    return { coordinates: coord, edges: currentEdges };
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
            // I don't really like this, but vertex order in the edges isn't gurenteed
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
    }
}
class TileGrid {
}
function createTile(coord, size, vertices, edges, resource) {
    return new Tile(createHexagon(coord, size, vertices, edges), 1, resource);
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
const resourceGenerator = new TileResourceDistributer(resourceTileWeights);
const renderLayers = ["tile", "edge", "vertex"];
const renderService = new RenderService(ctx, renderLayers, true);
const directions = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
];
const size = 50;
const centerCoord = { q: 1, r: 1 };
const vertices = [];
const edges = [];
let tile = createTile(centerCoord, size, vertices, edges, resourceGenerator.getRandomResource());
let tile2 = createTile({ q: 1, r: 2 }, size, vertices, edges, resourceGenerator.getRandomResource());
let tile3 = createTile({ q: 2, r: 1 }, size, vertices, edges, resourceGenerator.getRandomResource());
let tile4 = createTile({ q: 2, r: 2 }, size, vertices, edges, resourceGenerator.getRandomResource());
renderService.addElement("tile", tile);
renderService.addElement("tile", tile2);
renderService.addElement("tile", tile3);
renderService.addElement("tile", tile4);
renderService.renderFrame();
//# sourceMappingURL=index.js.map