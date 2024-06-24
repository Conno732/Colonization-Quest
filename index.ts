const canvas: HTMLCanvasElement | null = document.getElementById(
    "gameCanvas"
) as HTMLCanvasElement;
const ctx = canvas.getContext("2d");

canvas.width = 2160;
canvas.height = 1440;
canvas.style.width = "1080px";
canvas.style.height = "720px";

enum ResourceType {
    BRICK = "Tomato",
    WHEAT = "#FFBF00",
    CATTLE = "MediumSeaGreen",
    ORE = "lightgray",
    WOOD = "green",
    DESERT = "gray",
}

const ResourceGraphics = {
    Tomato: "🧱",
    "#FFBF00": "🌾",
    MediumSeaGreen: "🐄",
    lightgray: "🪨",
    green: "🪵",
};

enum PlayerColors {
    WHITE = "White",
    RED = "Red",
    BLACK = "Black",
    GREEN = "Green",
    BLUE = "Blue",
    YELLOW = "Yellow",
}

enum BuildingState {
    UNDEVELOPED,
    SETTLEMENT,
    CITY,
}

type AxialCoordinate = { q: number; r: number };
type Offset = { x: number; y: number };
type Vertex = { x: number; y: number; connectedEdges: Edge[] };
type Edge = { v1: Vertex; v2: Vertex };
type Hexagon = {
    coordinates: AxialCoordinate;
    edges: Edge[];
    center: Vertex;
    vertices: Vertex[];
};
type ResourceWeight = { resource: ResourceType; weight: number };
type RenderLayerMap = {
    [key: string]: number;
};

interface Renderable {
    draw(ctx: CanvasRenderingContext2D): void;
}

class RenderService {
    // order in which layers are drawn, 0 is drawn first
    private renderLayers: Renderable[][];
    private renderLayerMap: RenderLayerMap;

    constructor(
        public renderingContext: CanvasRenderingContext2D,
        renderLayerOrder: string[],
        public debug: boolean = false
    ) {
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

interface Clickable {
    /** Gets the 'z depth' of the object, higher is farther away
     *
     */
    getDepth(): number;
    // Probs would be interesting to implement this if more complicated resolutions are required for overlapping clickables
    // isBlocking(): boolean;
    // canBeBlocked(): boolean;
    isClicked(event: ClickEvent): boolean;
}

// Potentially use the clickevent details to resolve overlapping clickables on a per implementation basis
type ClickEvent = {
    x: number;
    y: number;
    clickable: Clickable;
};

interface ClickEventResolver {
    resolve(clickEvent: ClickEvent);
}

class ClickHandler {
    clickables: Clickable[] = [];
    constructor(canvas: HTMLCanvasElement, resolver: ClickEventResolver) {
        canvas.addEventListener("click", (event: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const x = ((event.clientX - rect.left) * canvas.width) / rect.width;
            const y =
                ((event.clientY - rect.top) * canvas.height) / rect.height;
            // Current implementation is for the top clickable to be the only resolved - subject to change
            let topClickable: Clickable | null = this.clickables.reduce(
                (currentTop, clickable) =>
                    clickable.isClicked({ x, y, clickable }) &&
                    (!currentTop ||
                        currentTop.getDepth() > clickable.getDepth())
                        ? clickable
                        : currentTop,
                null
            );
            if (topClickable)
                resolver.resolve({ x, y, clickable: topClickable });
        });
    }

    addClickable(clickable: Clickable): void {
        this.clickables.push(clickable);
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

    return {
        coordinates: coord,
        edges: currentEdges,
        center: center,
        vertices: currentVertices,
    };
}

class Tile implements Renderable {
    hasRobber: boolean = false;
    id: number;
    adjacentBuildings: Building[] = [];
    constructor(
        public hexagon: Hexagon,
        public rollNumber: number,
        public resourceType: ResourceType
    ) {}
    draw(ctx: CanvasRenderingContext2D): void {
        ctx.save();
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
        ctx.lineWidth = 2;
        ctx.fillStyle = this.resourceType;
        ctx.strokeStyle = "#ffffff";
        ctx.fill();
        ctx.stroke();
        if (this.rollNumber === 7) return;
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
        ctx.restore();
    }
}

class TileGrid {
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
        public gridRadius: number,
        public centerOffset: Offset,
        public tileSize: number,
        tileResourceDistributor: TileResourceDistributer
    ) {
        this.grid = {};

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
                const rollNumber = Math.floor(Math.random() * 11 + 1.9999);
                const resource =
                    rollNumber === 7
                        ? ResourceType.DESERT
                        : tileResourceDistributor.getRandomResource();

                this.grid[key] = new Tile(
                    createHexagon(
                        { q, r },
                        this.centerOffset,
                        this.tileSize,
                        this.vertices,
                        this.edges
                    ),
                    rollNumber,
                    resource
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
    { resource: ResourceType.BRICK, weight: 0.2 },
    { resource: ResourceType.WHEAT, weight: 0.2 },
    { resource: ResourceType.CATTLE, weight: 0.2 },
    { resource: ResourceType.ORE, weight: 0.2 },
    { resource: ResourceType.WOOD, weight: 0.2 },
];

class Building implements Renderable, Clickable {
    state: BuildingState = BuildingState.UNDEVELOPED;
    color: string;
    adjacentTiles: Tile[] = [];
    adjacentBuildings: Building[] = [];
    adjacentRoads: Road[] = [];

    constructor(public vertex: Vertex, public id: number) {}

    getDepth(): number {
        return 1;
    }

    isClicked(event: ClickEvent): boolean {
        const hitboxRadius = 20;
        const dx = event.x - this.vertex.x;
        const dy = event.y - this.vertex.y;
        return Math.sqrt(dx * dx + dy * dy) < hitboxRadius;
    }

    private buildInvalid(playerColor: string, turn: number) {
        return turn !== 0
            ? !this.adjacentRoads.find((road) => road.color === playerColor) ||
                  this.adjacentBuildings.find((building) => building.color)
            : this.adjacentBuildings.find((building) => building.color);
    }

    buildSettlement(playerColor: string, turn: number) {
        if (this.state != BuildingState.UNDEVELOPED)
            throw new GameError(
                `${playerColor} tried to build on invalid space owned by ${this.color}`
            );
        else if (this.buildInvalid(playerColor, turn))
            throw new GameError(
                `${playerColor} tried to too close to another settlement or by no adjacent roads`
            );
        this.color = playerColor;
        this.state = BuildingState.SETTLEMENT;
    }

    buildCity(playerColor: string, turn: number) {
        if (this.state != BuildingState.SETTLEMENT)
            throw new GameError(
                `${playerColor} tried to build on invalid space owned by ${this.color}`
            );
        this.color = playerColor;
        this.state = BuildingState.CITY;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.save();
        switch (this.state) {
            case BuildingState.UNDEVELOPED:
                break;
            case BuildingState.CITY:
                let spikes = 5;
                let radius = 40;
                let innerRadius = 20;
                let rot = (Math.PI / 2) * 3;
                let step = Math.PI / spikes;
                let cx = this.vertex.x;
                let cy = this.vertex.y;

                ctx.beginPath();
                ctx.moveTo(cx, cy - radius);

                for (let i = 0; i < spikes; i++) {
                    let x = cx + Math.cos(rot) * radius;
                    let y = cy + Math.sin(rot) * radius;
                    ctx.lineTo(x, y);
                    rot += step;

                    x = cx + Math.cos(rot) * innerRadius;
                    y = cy + Math.sin(rot) * innerRadius;
                    ctx.lineTo(x, y);
                    rot += step;
                }

                ctx.lineTo(cx, cy - radius);
                ctx.closePath();
                ctx.fillStyle = this.color;
                ctx.strokeStyle = "black";
                ctx.lineWidth = 5;
                ctx.fill();
                ctx.stroke();
                break;
            case BuildingState.SETTLEMENT:
                ctx.fillStyle = this.color;
                ctx.fillRect(this.vertex.x - 20, this.vertex.y - 20, 40, 40);
                ctx.strokeStyle = "black";
                ctx.lineWidth = 5;
                ctx.strokeRect(this.vertex.x - 20, this.vertex.y - 20, 40, 40);
                break;
        }
        ctx.restore();
    }
}
class Road implements Renderable, Clickable {
    color: string;
    isBuilt: boolean;
    adjacentRoads: Road[] = [];
    adjacentBuildings: Building[] = [];

    constructor(public edge: Edge, public id: number) {}
    getDepth(): number {
        return 3;
    }

    private buildInvalid(playerColor: string) {
        return !(
            this.adjacentBuildings.find(
                (building) => building.color === playerColor
            ) || this.adjacentRoads.find((road) => road.color === playerColor)
        );
    }

    buildRoad(playerColor: string) {
        if (this.isBuilt)
            throw new GameError(
                `${playerColor} tried to build on a road owned by ${this.color}`
            );
        else if (this.buildInvalid(playerColor))
            throw new GameError(
                `${playerColor} has no adjacent roads or buildings here`
            );
        this.isBuilt = true;
        this.color = playerColor;
    }

    isClicked(event: ClickEvent): boolean {
        const dx = this.edge.v2.x - this.edge.v1.x;
        const dy = this.edge.v2.y - this.edge.v1.y;
        const length = dx * dx + dy * dy;
        const t = Math.max(
            0,
            Math.min(
                1,
                ((event.x - this.edge.v1.x) * dx +
                    (event.y - this.edge.v1.y) * dy) /
                    length
            )
        );
        const projectionX = this.edge.v1.x + t * dx;
        const projectionY = this.edge.v1.y + t * dy;
        const dx2 = event.x - projectionX;
        const dy2 = event.y - projectionY;
        const distance = Math.sqrt(dx2 * dx2 + dy2 * dy2);

        return distance <= 10;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if (this.isBuilt) {
            ctx.save();

            ctx.fillStyle = this.color;
            ctx.strokeStyle = "black";

            const centerX = (this.edge.v1.x + this.edge.v2.x) / 2;
            const centerY = (this.edge.v1.y + this.edge.v2.y) / 2;
            const width = Math.abs(this.edge.v2.x - this.edge.v1.x);
            const height = Math.abs(this.edge.v2.y - this.edge.v1.y);

            // When the road is vertical I can't figure out how to not hardcode it
            if (Math.abs(this.edge.v1.x - this.edge.v2.x) < 0.1) {
                const yVal =
                    this.edge.v1.y < this.edge.v2.y
                        ? this.edge.v1.y
                        : this.edge.v2.y;
                ctx.fillRect(
                    this.edge.v1.x - 12.5,
                    yVal,
                    25,
                    Math.abs(this.edge.v1.y - this.edge.v2.y)
                );
                ctx.strokeRect(
                    this.edge.v1.x - 12.5,
                    yVal,
                    25,
                    Math.abs(this.edge.v1.y - this.edge.v2.y)
                );
                return;
            }

            let angle = 0;
            if (this.edge.v1.x !== this.edge.v2.x) {
                angle = Math.atan2(
                    this.edge.v2.y - this.edge.v1.y,
                    this.edge.v2.x - this.edge.v1.x
                );
            } else {
                angle =
                    this.edge.v1.y < this.edge.v2.y
                        ? Math.PI / 2
                        : -Math.PI / 2;
            }

            ctx.translate(centerX, centerY);
            ctx.rotate(angle);
            ctx.fillRect(-width / 2, -height / 2 + 12.5, width, 25);
            ctx.strokeRect(-width / 2, -height / 2 + 12.5, width, 25);
            ctx.restore();
        }
    }
}

class Game {
    private lastTimestamp: number = 0;
    private renderService: RenderService;

    constructor(renderService: RenderService) {
        this.gameLoop = this.gameLoop.bind(this);
        this.renderService = renderService;
    }

    private async update(deltaTime: number): Promise<void> {
        // work here
    }

    private render(): void {
        this.renderService.renderFrame();
    }

    private async gameLoop(timestamp: number): Promise<void> {
        const deltaTime = timestamp - this.lastTimestamp;
        this.lastTimestamp = timestamp;

        await this.update(deltaTime);
        this.render();

        requestAnimationFrame(this.gameLoop);
    }

    public start(): void {
        this.lastTimestamp = performance.now();
        requestAnimationFrame(this.gameLoop);
    }
}

///////////////////////////////////////////////////////////////////////////////////

type ResourceCounts = {
    [resource: string]: number;
};

class Player {
    resources: ResourceCounts = {};
    constructor(
        public color: string,
        public playerUI: HTMLElement,
        public buildableSettlements: number = 5,
        public buildableCities: number = 4,
        public buildableRoads: number = 15
    ) {
        Object.keys(ResourceType).forEach((key) => {
            const value = ResourceType[key as keyof typeof ResourceType];
            this.resources[value] = 0;
        });
        this.displayCounts();
    }

    isTradeValid(trade: ResourceTrade[]): boolean {
        return !trade.find(
            (resource) =>
                resource.quantity + this.resources[resource.resource] < 0
        );
    }

    trade(trade: ResourceTrade[]) {
        trade.forEach((resource) => {
            this.resources[resource.resource] += resource.quantity;
        });
        this.displayCounts();
    }

    private displayCounts() {
        this.playerUI.innerHTML = "";
        for (const resource in this.resources) {
            if (
                Object.prototype.hasOwnProperty.call(this.resources, resource)
            ) {
                if (resource === "gray") return;
                const element = this.resources[resource];
                this.playerUI.innerHTML += `${ResourceGraphics[resource]} : ${element}`;
            }
        }
    }
}

class Bank {
    constructor(public resources: ResourceCounts, public bankUI: HTMLElement) {
        this.displayCounts();
    }

    isTradeValid(trade: ResourceTrade[]): boolean {
        return !trade.find(
            (resource) =>
                resource.quantity + this.resources[resource.resource] < 0
        );
    }

    trade(trade: ResourceTrade[]) {
        trade.forEach((resource) => {
            this.resources[resource.resource] += resource.quantity;
        });
        this.displayCounts();
    }

    private displayCounts() {
        this.bankUI.innerHTML = "";
        for (const resource in this.resources) {
            if (
                Object.prototype.hasOwnProperty.call(this.resources, resource)
            ) {
                if (resource === "gray") return;
                const element = this.resources[resource];
                this.bankUI.innerHTML += `${ResourceGraphics[resource]} : ${element}`;
            }
        }
    }
}

class GameError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

enum MoveType {
    BUILDING,
    ROAD,
    TRADE,
    END_PLAYER_TURN,
}

enum BuildingActions {
    BUILD_CITY,
    BUILD_SETTLEMENT,
}

enum RoadActions {
    BUILD_ROAD,
}

type BuildingMove = {
    id: number;
    action: BuildingActions;
};

type RoadMove = {
    id: number;
    action: RoadActions;
};

type GameMove = {
    turn: number;
    playerColor: string;
    move: RoadMove | BuildingMove | TradeMove;
    // This is needed to discern the different types of moves, when serializing the data its uber important
    moveType: MoveType;
};

type ResourceTrade = {
    resource: string;
    quantity: number;
};

type TradeMove = {
    withPlayer: string;
    // negative quantity means 'withPlayer' recieves from player
    resourceExchange: ResourceTrade[];
};

class RemoteGameHandler implements ClickEventResolver {
    resolve(clickEvent: ClickEvent) {
        throw new Error("Method not implemented.");
    }
}

class LocalGameHandler implements ClickEventResolver {
    private firstRoundPlaced: boolean = false;
    private currentPlayerIndex: number = 0;
    private turn: number = 0;
    moveStack: GameMove[] = [];
    private players: Player[] = [];
    private colorIndex = {};
    private diceRolled: boolean = false;

    constructor(
        playerColors: string[],
        public buildings: Building[],
        public roads: Road[],
        public tileGrid: TileGrid,
        public bank: Bank
    ) {
        const playerdata = document.getElementById("playerdatas");
        playerColors.forEach((color, index) => {
            const header = document.createElement("h3");
            header.innerHTML = color;
            header.className = "character-title";
            playerdata.appendChild(header);
            const playerUI = document.createElement("div");
            playerdata.appendChild(playerUI);
            this.players.push(new Player(color, playerUI));
            this.colorIndex[color] = index;
        });

        for (const key in tileGrid.grid) {
            if (tileGrid.grid.hasOwnProperty(key)) {
                renderService.addElement("tile", tileGrid.grid[key]);
            }
        }

        tileGrid.vertices.forEach((vertex, index) => {
            buildings.push(new Building(vertex, index));
        });

        for (let i = 0; i < buildings.length; i++) {
            for (let j = 0; j < buildings.length; j++) {
                if (buildings[i] === buildings[j]) continue;
                if (
                    buildings[i].vertex.connectedEdges.reduce(
                        (val, edge) =>
                            buildings[j].vertex.connectedEdges.find(
                                (edge2) => edge === edge2
                            ) || val,
                        false
                    )
                )
                    buildings[i].adjacentBuildings.push(buildings[j]);
            }
        }

        tileGrid.edges.forEach((edge, index) => {
            roads.push(new Road(edge, index));
        });

        for (let i = 0; i < roads.length; i++) {
            buildings
                .filter(
                    (building) =>
                        building.vertex === roads[i].edge.v1 ||
                        building.vertex === roads[i].edge.v2
                )
                .forEach((building) => {
                    roads[i].adjacentBuildings.push(building);
                    building.adjacentRoads.push(roads[i]);
                });

            for (let j = 0; j < roads.length; j++) {
                if (roads[i] === roads[j]) continue;
                if (
                    roads[i].edge.v1 == roads[j].edge.v1 ||
                    roads[i].edge.v2 == roads[j].edge.v1 ||
                    roads[i].edge.v1 == roads[j].edge.v2 ||
                    roads[i].edge.v2 == roads[j].edge.v2
                )
                    roads[i].adjacentRoads.push(roads[j]);
            }
        }

        for (const key in tileGrid.grid) {
            if (tileGrid.grid.hasOwnProperty(key)) {
                const tile = tileGrid.grid[key];
                tile.hexagon.vertices.forEach((vertex) => {
                    const building = buildings.find(
                        (building) => building.vertex == vertex
                    );
                    tile.adjacentBuildings.push(building);
                    building.adjacentTiles.push(tile);
                });
            }
        }
    }

    resolve(clickEvent: ClickEvent) {
        if (clickEvent.clickable instanceof Building) {
            const building = clickEvent.clickable as Building;
            this.updateGame({
                turn: this.turn,
                playerColor: this.players[this.currentPlayerIndex].color,
                move: {
                    id: building.id,
                    action:
                        building.state === BuildingState.UNDEVELOPED
                            ? BuildingActions.BUILD_SETTLEMENT
                            : BuildingActions.BUILD_CITY,
                },
                moveType: MoveType.BUILDING,
            });
        } else if (clickEvent.clickable instanceof Road) {
            const road = clickEvent.clickable as Road;
            this.updateGame({
                turn: this.turn,
                playerColor: this.players[this.currentPlayerIndex].color,
                move: {
                    id: road.id,
                    action: RoadActions.BUILD_ROAD,
                },
                moveType: MoveType.ROAD,
            });
        }
    }

    updateGame(gameMove: GameMove) {
        try {
            if (
                gameMove.playerColor !==
                    this.players[this.currentPlayerIndex].color &&
                gameMove.moveType !== MoveType.TRADE
            )
                throw new GameError(
                    `${gameMove.playerColor} tried to move during ${
                        this.players[this.currentPlayerIndex].color
                    } turn.`
                );
            else if (gameMove.turn !== this.turn) {
                throw new GameError(
                    `${gameMove.playerColor}'s turn is out of sync, ${this.turn} (local), ${gameMove.turn} (player)`
                );
            }
            if (this.turn === 0) {
                this.handleFirstMove(gameMove);
            } else {
                if (!this.diceRolled) {
                    throw new GameError(`Please roll dice first`);
                }
                this.handleMove(gameMove);
            }
            this.moveStack.push(gameMove);
        } catch (error) {
            if (error instanceof GameError) {
                console.log("Game Error Attempted: ", error.message);
            } else {
                console.error("Unknown Error: ", error.message);
            }
        }
    }

    diceRoll(rollNumber: number) {
        if (this.diceRolled) throw new GameError("Only one dice roll per turn");
        this.diceRolled = true;
        for (const key in tileGrid.grid) {
            if (Object.prototype.hasOwnProperty.call(tileGrid.grid, key)) {
                const tile = tileGrid.grid[key];
                if (tile.rollNumber === rollNumber) {
                    tile.adjacentBuildings
                        .filter(
                            (building) =>
                                building.state !== BuildingState.UNDEVELOPED
                        )
                        .forEach((building) => {
                            this.updateGame({
                                turn: this.turn,
                                playerColor: building.color,
                                move: {
                                    withPlayer: "bank",
                                    resourceExchange: [
                                        {
                                            resource: tile.resourceType,
                                            quantity: building.state,
                                        },
                                    ],
                                },
                                moveType: MoveType.TRADE,
                            });
                        });
                }
            }
        }
    }

    private handleFirstMove(gameMove: GameMove) {
        switch (gameMove.moveType) {
            case MoveType.ROAD:
                const roadMove = gameMove.move as RoadMove;
                if (
                    this.moveStack[this.moveStack.length - 1].moveType ===
                    MoveType.ROAD
                ) {
                    throw new GameError("Build building first");
                }
                const move = this.moveStack[this.moveStack.length - 1]
                    .move as BuildingMove;

                if (
                    !this.roads[roadMove.id].adjacentBuildings.find(
                        (building) => building === this.buildings[move.id]
                    )
                ) {
                    throw new GameError("Build road next to new building");
                }
                if (this.firstRoundPlaced) {
                    this.currentPlayerIndex -= 1;
                    if (this.currentPlayerIndex < 0) {
                        this.turn += 1;
                        this.currentPlayerIndex = 0;
                    }
                } else if (this.currentPlayerIndex >= this.players.length - 1)
                    this.firstRoundPlaced = true;
                else this.currentPlayerIndex += 1;

                this.roads[roadMove.id].buildRoad(gameMove.playerColor);

                break;
            case MoveType.BUILDING:
                const buildMove = gameMove.move as BuildingMove;
                if (
                    this.moveStack.length > 0 &&
                    this.moveStack[this.moveStack.length - 1].moveType ===
                        MoveType.BUILDING
                ) {
                    throw new GameError("Build building twice");
                }
                this.buildings[buildMove.id].buildSettlement(
                    gameMove.playerColor,
                    gameMove.turn
                );

                if (this.firstRoundPlaced) {
                    this.buildings[buildMove.id].adjacentTiles.forEach((tile) =>
                        this.updateGame({
                            turn: this.turn,
                            playerColor: gameMove.playerColor,
                            move: {
                                withPlayer: "bank",
                                resourceExchange: [
                                    {
                                        resource: tile.resourceType,
                                        quantity: 1,
                                    },
                                ],
                            },
                            moveType: MoveType.TRADE,
                        })
                    );
                }

                break;
            case MoveType.TRADE:
                this.handleMove(gameMove);
                break;
            default:
                throw new GameError("Unknown first move");
        }
    }

    private handleMove(gameMove: GameMove) {
        const player = this.players[this.colorIndex[gameMove.playerColor]];
        switch (gameMove.moveType) {
            case MoveType.ROAD:
                const roadMove = gameMove.move as RoadMove;
                const roadTrade = {
                    turn: this.turn,
                    playerColor: gameMove.playerColor,
                    move: {
                        withPlayer: "bank",
                        resourceExchange: [
                            {
                                resource: ResourceType.BRICK,
                                quantity: -1,
                            },
                            {
                                resource: ResourceType.WOOD,
                                quantity: -1,
                            },
                        ],
                    },
                    moveType: MoveType.TRADE,
                };
                this.handleMove(roadTrade);
                this.roads[roadMove.id].buildRoad(gameMove.playerColor);
                break;
            case MoveType.BUILDING:
                const buildMove = gameMove.move as BuildingMove;
                if (buildMove.action === BuildingActions.BUILD_SETTLEMENT) {
                    const buildTrade = {
                        turn: this.turn,
                        playerColor: gameMove.playerColor,
                        move: {
                            withPlayer: "bank",
                            resourceExchange: [
                                {
                                    resource: ResourceType.BRICK,
                                    quantity: -1,
                                },
                                {
                                    resource: ResourceType.CATTLE,
                                    quantity: -1,
                                },
                                {
                                    resource: ResourceType.WOOD,
                                    quantity: -1,
                                },
                                {
                                    resource: ResourceType.WHEAT,
                                    quantity: -1,
                                },
                            ],
                        },
                        moveType: MoveType.TRADE,
                    };
                    this.handleMove(buildTrade);
                    this.buildings[buildMove.id].buildSettlement(
                        gameMove.playerColor,
                        gameMove.turn
                    );
                } else {
                    const buildTrade = {
                        turn: this.turn,
                        playerColor: gameMove.playerColor,
                        move: {
                            withPlayer: "bank",
                            resourceExchange: [
                                {
                                    resource: ResourceType.ORE,
                                    quantity: -3,
                                },
                                {
                                    resource: ResourceType.WHEAT,
                                    quantity: -2,
                                },
                            ],
                        },
                        moveType: MoveType.TRADE,
                    };
                    this.handleMove(buildTrade);
                    this.buildings[buildMove.id].buildCity(
                        gameMove.playerColor,
                        gameMove.turn
                    );
                }

                break;
            case MoveType.TRADE:
                const tradeMove = gameMove.move as TradeMove;

                const tradingWith =
                    tradeMove.withPlayer === "bank"
                        ? this.bank
                        : this.players[this.colorIndex[tradeMove.withPlayer]];

                if (
                    !player.isTradeValid(tradeMove.resourceExchange) ||
                    !tradingWith.isTradeValid(tradeMove.resourceExchange)
                )
                    throw new GameError(`Invalid trade,`);
                tradingWith.trade(
                    tradeMove.resourceExchange.map((element) => {
                        return {
                            resource: element.resource,
                            quantity: element.quantity * -1,
                        };
                    })
                );
                player.trade(tradeMove.resourceExchange);

                break;
            case MoveType.END_PLAYER_TURN:
                this.endPlayerTurn();
                break;
        }
    }

    private endPlayerTurn() {
        this.currentPlayerIndex += 1;
        this.diceRolled = false;
        if (this.currentPlayerIndex >= this.players.length) {
            this.turn += 1;
            this.currentPlayerIndex = 0;
        }
    }
}

// {
//   "turn": 0,
//   "playerColor": "red",
//   "move": {
//     "id": 106,
//     "action": 0
//   },
//   "moveType": 1
// }

function mapToGameMove(move: any) {
    const result = {
        turn: move.turn,
        playerColor: move.playerColor,
        moveType: move.moveType,
    };
    switch (move.moveType) {
        case MoveType.BUILDING:
            result["move"] = {
                id: move.move.id,
                action: move.move.action,
            } as BuildingMove;
            break;
        case MoveType.ROAD:
            result["move"] = {
                id: move.move.id,
                action: move.move.action,
            } as RoadMove;
            break;
    }
    return result as GameMove;
}

////////////////////////////////////////////////////////////////////////////////////

const resourceGenerator = new TileResourceDistributer(resourceTileWeights);

const renderLayers = ["tile", "edge", "vertex"];
const renderService = new RenderService(ctx, renderLayers);

const tileGrid = new TileGrid(
    4,
    { x: canvas.width / 2, y: canvas.height / 2 },
    100,
    resourceGenerator
);
const buildings: Building[] = [];
const roads: Road[] = [];

const resourceCounts: ResourceCounts = {};

Object.keys(ResourceType).forEach((key) => {
    const value = ResourceType[key as keyof typeof ResourceType];
    resourceCounts[value] = 19;
});

const gameHandler = new LocalGameHandler(
    [PlayerColors.RED, PlayerColors.BLUE],
    buildings,
    roads,
    tileGrid,
    new Bank(resourceCounts, document.getElementById("bank"))
);

const endTurnButton = document.getElementById("end-turn");
endTurnButton.addEventListener("", () => {});

const clickHandler = new ClickHandler(canvas, gameHandler);

buildings.forEach((building) => {
    clickHandler.addClickable(building);
    renderService.addElement("vertex", building);
});

roads.forEach((road) => {
    clickHandler.addClickable(road);
    renderService.addElement("edge", road);
});

const game = new Game(renderService);
game.start();
