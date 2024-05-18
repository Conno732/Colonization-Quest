const canvas: HTMLCanvasElement | null = document.getElementById(
    "gameCanvas"
) as HTMLCanvasElement;
const ctx = canvas.getContext("2d");

canvas.width = 2160;
canvas.height = 1440;
canvas.style.width = "1080px";
canvas.style.height = "720px";

enum ResourceType {
    CONCRETE = "Tomato",
    SPICE = "orange",
    ANIMAL = "MediumSeaGreen",
    METAL = "lightgray",
    WOOD = "brown",
    FREAKY = "purple",
    DESERT = "gray",
}

enum PlayerColors {
    WHITE = "white",
    RED = "red",
    BLACK = "black",
    GREEN = "green",
}

enum TileVertices {
    BOTTOM_LEFT,
    TOP_LEFT,
    TOP,
    TOP_RIGHT,
    BOTTOM_RIGHT,
    BOTTOM,
}

type AxialCoordinate = { q: number; r: number };
type Offset = { x: number; y: number };
type Vertex = { x: number; y: number; connectedEdges: Edge[] };
type Edge = { v1: Vertex; v2: Vertex };
type Hexagon = { coordinates: AxialCoordinate; edges: Edge[]; center: Vertex };
type ResourceWeight = { resource: ResourceType; weight: number };
type RenderLayerMap = {
    [key: string]: number;
};

interface Renderable {
    draw(renderingContext: CanvasRenderingContext2D): void;
}

class RenderService {
    debug: boolean;
    // order in which layers are drawn, 0 is drawn first
    private renderLayers: Renderable[][];
    private renderLayerMap: RenderLayerMap;
    private renderingContext: CanvasRenderingContext2D;

    constructor(
        renderingContext: CanvasRenderingContext2D,
        renderLayerOrder: string[],
        debug: boolean = false
    ) {
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

    addElement(layer: string, renderable: Renderable) {
        this.renderLayers[this.renderLayerMap[layer]].push(renderable);
    }
}

function axialToPixel(
    coord: AxialCoordinate,
    size: number,
    offSet: Offset
): Vertex {
    const x =
        size * (Math.sqrt(3) * coord.q + (Math.sqrt(3) / 2) * coord.r) +
        offSet.x;
    const y = size * ((3 / 2) * coord.r) + offSet.y;
    return { x, y, connectedEdges: [] };
}

function areNumbersEqual(
    num1: number,
    num2: number,
    epsilon: number = 0.1
): boolean {
    return Math.abs(num1 - num2) < epsilon;
}

function verticesEqual(v1: Vertex, v2: Vertex): boolean {
    return areNumbersEqual(v1.x, v2.x) && areNumbersEqual(v1.y, v2.y);
}

function edgesEqual(e1: Edge, e2: Edge): boolean {
    return (
        (verticesEqual(e1.v1, e2.v1) && verticesEqual(e1.v2, e2.v2)) ||
        (verticesEqual(e1.v1, e2.v2) && verticesEqual(e1.v2, e2.v1))
    );
}

function addVertex(vertex: Vertex, vertices: Vertex[]): Vertex {
    for (const v of vertices) {
        if (verticesEqual(v, vertex)) {
            return v;
        }
    }
    vertices.push(vertex);
    return vertex;
}

function addEdge(edge: Edge, edges: Edge[]): Edge {
    for (const e of edges) {
        if (edgesEqual(e, edge)) {
            return e;
        }
    }
    edges.push(edge);
    return edge;
}

function createHexagon(
    coord: AxialCoordinate,
    offSet: Offset,
    size: number,
    vertices: Vertex[],
    edges: Edge[]
): Hexagon {
    const center = axialToPixel(coord, size, offSet);
    const angleIncrement = Math.PI / 3;
    const currentEdges: Edge[] = [];
    const currentVertices = [];

    for (let i = 0; i < 6; i++) {
        const angle = angleIncrement * i - Math.PI / 6;
        const vertex: Vertex = {
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

class Tile implements Renderable {
    resourceType: ResourceType;
    hasRobber: boolean;
    rollNumber: number;
    hexagon: Hexagon;

    constructor(
        hexagon: Hexagon,
        rollNumber: number,
        resourceType: ResourceType
    ) {
        this.rollNumber = rollNumber;
        this.resourceType = resourceType;
        this.hexagon = hexagon;
    }
    draw(ctx: CanvasRenderingContext2D): void {
        const edges = this.hexagon.edges;
        ctx.moveTo(edges[0].v1.x, edges[0].v1.y);
        ctx.beginPath();
        for (let i = 1; i < 7; i++) {
            if (
                verticesEqual(edges[i - 1].v1, edges[i % 6].v1) ||
                verticesEqual(edges[i - 1].v1, edges[i % 6].v2)
            ) {
                ctx.lineTo(edges[i - 1].v2.x, edges[i - 1].v2.y);
                ctx.lineTo(edges[i - 1].v1.x, edges[i - 1].v1.y);
            } else {
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
    tileSize: number;
    centerOffset: Offset;
    gridRadius: number;
    grid: { [key: string]: Tile } = {};
    vertices: Vertex[] = [];
    edges: Edge[] = [];
    directions: AxialCoordinate[] = [
        { q: 1, r: 0 },
        { q: 1, r: -1 },
        { q: 0, r: -1 },
        { q: -1, r: 0 },
        { q: -1, r: 1 },
        { q: 0, r: 1 },
    ];

    constructor(
        radius: number,
        offset: Offset,
        size: number,
        tileResourceDistributor: TileResourceDistributer
    ) {
        this.grid = {};
        this.gridRadius = radius;
        this.centerOffset = offset;
        this.tileSize = size;
        this.generateHexGrid(tileResourceDistributor);
    }

    private generateHexGrid(
        tileResourceDistributor: TileResourceDistributer
    ): void {
        for (let q = -this.gridRadius; q <= this.gridRadius; q++) {
            for (
                let r = Math.max(-this.gridRadius, -q - this.gridRadius);
                r <= Math.min(this.gridRadius, -q + this.gridRadius);
                r++
            ) {
                const key = `${q},${r}`;
                this.grid[key] = new Tile(
                    createHexagon(
                        { q, r },
                        this.centerOffset,
                        this.tileSize,
                        this.vertices,
                        this.edges
                    ),
                    Math.floor(Math.random() * 11 + 1),
                    tileResourceDistributor.getRandomResource()
                );
            }
        }
    }
}

class TileResourceDistributer {
    weightedResourceTable: ResourceType[] = [];

    constructor(resourceTileWeights: ResourceWeight[]) {
        for (let j = 0; j < resourceTileWeights.length; j++) {
            for (let i = 0; i < resourceTileWeights[j].weight * 100; i++) {
                this.weightedResourceTable.push(
                    resourceTileWeights[j].resource
                );
            }
        }
    }

    getRandomResource(): ResourceType {
        return this.weightedResourceTable[
            Math.floor(Math.random() * this.weightedResourceTable.length)
        ];
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
    isCity: boolean;
    color: PlayerColors;
    vertex: Vertex;
    constructor() {}
}
class Road {
    color: PlayerColors;
    edge: Edge;

    constructor() {}
}

///////////////////////////////////////////////////////////////////////////////////
const resourceGenerator = new TileResourceDistributer(resourceTileWeights);

const renderLayers = ["tile", "edge", "vertex"];

const renderService = new RenderService(ctx, renderLayers, true);

const tileGrid = new TileGrid(
    4,
    { x: canvas.width / 2, y: canvas.height / 2 },
    100,
    resourceGenerator
);
for (const key in tileGrid.grid) {
    if (tileGrid.grid.hasOwnProperty(key)) {
        renderService.addElement("tile", tileGrid.grid[key]);
    }
}

console.log(tileGrid.edges);

renderService.renderFrame();
