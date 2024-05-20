var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 2160;
canvas.height = 1440;
canvas.style.width = "1080px";
canvas.style.height = "720px";
var ResourceType;
(function (ResourceType) {
    ResourceType["BRICK"] = "Tomato";
    ResourceType["WHEAT"] = "#FFBF00";
    ResourceType["CATTLE"] = "MediumSeaGreen";
    ResourceType["ORE"] = "lightgray";
    ResourceType["WOOD"] = "green";
    ResourceType["DESERT"] = "gray";
})(ResourceType || (ResourceType = {}));
var PlayerColors;
(function (PlayerColors) {
    PlayerColors["WHITE"] = "white";
    PlayerColors["RED"] = "red";
    PlayerColors["BLACK"] = "black";
    PlayerColors["GREEN"] = "green";
    PlayerColors["BLUE"] = "blue";
    PlayerColors["YELLOW"] = "yellow";
})(PlayerColors || (PlayerColors = {}));
var BuildingState;
(function (BuildingState) {
    BuildingState[BuildingState["UNDEVELOPED"] = 0] = "UNDEVELOPED";
    BuildingState[BuildingState["SETTLEMENT"] = 1] = "SETTLEMENT";
    BuildingState[BuildingState["CITY"] = 2] = "CITY";
})(BuildingState || (BuildingState = {}));
class RenderService {
    constructor(renderingContext, renderLayerOrder, debug = false) {
        this.renderingContext = renderingContext;
        this.debug = debug;
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
class ClickHandler {
    constructor(canvas, resolver) {
        this.clickables = [];
        canvas.addEventListener("click", (event) => {
            const rect = canvas.getBoundingClientRect();
            const x = ((event.clientX - rect.left) * canvas.width) / rect.width;
            const y = ((event.clientY - rect.top) * canvas.height) / rect.height;
            // Current implementation is for the top clickable to be the only resolved - subject to change
            let topClickable = this.clickables.reduce((currentTop, clickable) => clickable.isClicked({ x, y, clickable }) &&
                (!currentTop ||
                    currentTop.getDepth() > clickable.getDepth())
                ? clickable
                : currentTop, null);
            if (topClickable)
                resolver.resolve({ x, y, clickable: topClickable });
        });
    }
    addClickable(clickable) {
        this.clickables.push(clickable);
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
    return {
        coordinates: coord,
        edges: currentEdges,
        center: center,
        vertices: currentVertices,
    };
}
class Tile {
    constructor(hexagon, rollNumber, resourceType) {
        this.hexagon = hexagon;
        this.rollNumber = rollNumber;
        this.resourceType = resourceType;
        this.hasRobber = false;
        this.adjacentBuildings = [];
    }
    draw(ctx) {
        ctx.save();
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
        ctx.lineWidth = 2;
        ctx.fillStyle = this.resourceType;
        ctx.strokeStyle = "#ffffff";
        ctx.fill();
        ctx.stroke();
        if (this.rollNumber === 7)
            return;
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
    constructor(gridRadius, centerOffset, tileSize, tileResourceDistributor) {
        this.gridRadius = gridRadius;
        this.centerOffset = centerOffset;
        this.tileSize = tileSize;
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
        this.generateHexGrid(tileResourceDistributor);
    }
    generateHexGrid(tileResourceDistributor) {
        for (let q = -this.gridRadius; q <= this.gridRadius; q++) {
            for (let r = Math.max(-this.gridRadius, -q - this.gridRadius); r <= Math.min(this.gridRadius, -q + this.gridRadius); r++) {
                const key = `${q},${r}`;
                const rollNumber = Math.floor(Math.random() * 11 + 1);
                const resource = rollNumber === 7
                    ? ResourceType.DESERT
                    : tileResourceDistributor.getRandomResource();
                this.grid[key] = new Tile(createHexagon({ q, r }, this.centerOffset, this.tileSize, this.vertices, this.edges), rollNumber, resource);
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
    { resource: ResourceType.BRICK, weight: 0.2 },
    { resource: ResourceType.WHEAT, weight: 0.2 },
    { resource: ResourceType.CATTLE, weight: 0.2 },
    { resource: ResourceType.ORE, weight: 0.2 },
    { resource: ResourceType.WOOD, weight: 0.2 },
];
class Building {
    constructor(vertex, id) {
        this.vertex = vertex;
        this.id = id;
        this.state = BuildingState.UNDEVELOPED;
        this.adjacentBuildings = [];
        this.adjacentRoads = [];
    }
    getDepth() {
        return 1;
    }
    isClicked(event) {
        const hitboxRadius = 20;
        const dx = event.x - this.vertex.x;
        const dy = event.y - this.vertex.y;
        return Math.sqrt(dx * dx + dy * dy) < hitboxRadius;
    }
    buildInvalid(playerColor, turn) {
        return turn !== 0
            ? !this.adjacentRoads.find((road) => road.color === playerColor) ||
                this.adjacentBuildings.find((building) => building.color)
            : this.adjacentBuildings.find((building) => building.color);
    }
    buildSettlement(playerColor, turn) {
        if (this.state != BuildingState.UNDEVELOPED)
            throw new GameError(`${playerColor} tried to build on invalid space owned by ${this.color}`);
        else if (this.buildInvalid(playerColor, turn))
            throw new GameError(`${playerColor} tried to too close to another settlement or by no adjacent roads`);
        this.color = playerColor;
        this.state = BuildingState.SETTLEMENT;
    }
    draw(ctx) {
        ctx.save();
        switch (this.state) {
            case BuildingState.UNDEVELOPED:
                break;
            case BuildingState.CITY:
            case BuildingState.SETTLEMENT:
                ctx.fillStyle = this.color;
                ctx.fillRect(this.vertex.x - 20, this.vertex.y - 20, 40, 40);
                ctx.strokeStyle = "black";
                ctx.lineWidth = 5;
                ctx.strokeRect(this.vertex.x - 20, this.vertex.y - 20, 40, 40);
        }
        ctx.restore();
    }
}
class Road {
    constructor(edge, id) {
        this.edge = edge;
        this.id = id;
        this.adjacentRoads = [];
        this.adjacentBuildings = [];
    }
    getDepth() {
        return 3;
    }
    buildInvalid(playerColor) {
        return !(this.adjacentBuildings.find((building) => building.color === playerColor) || this.adjacentRoads.find((road) => road.color === playerColor));
    }
    buildRoad(playerColor) {
        if (this.isBuilt)
            throw new GameError(`${playerColor} tried to build on a road owned by ${this.color}`);
        else if (this.buildInvalid(playerColor))
            throw new GameError(`${playerColor} has no adjacent roads or buildings here`);
        this.isBuilt = true;
        this.color = playerColor;
    }
    isClicked(event) {
        const dx = this.edge.v2.x - this.edge.v1.x;
        const dy = this.edge.v2.y - this.edge.v1.y;
        const length = dx * dx + dy * dy;
        const t = Math.max(0, Math.min(1, ((event.x - this.edge.v1.x) * dx +
            (event.y - this.edge.v1.y) * dy) /
            length));
        const projectionX = this.edge.v1.x + t * dx;
        const projectionY = this.edge.v1.y + t * dy;
        const dx2 = event.x - projectionX;
        const dy2 = event.y - projectionY;
        const distance = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        return distance <= 10;
    }
    draw(ctx) {
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
                const yVal = this.edge.v1.y < this.edge.v2.y
                    ? this.edge.v1.y
                    : this.edge.v2.y;
                ctx.fillRect(this.edge.v1.x - 12.5, yVal, 25, Math.abs(this.edge.v1.y - this.edge.v2.y));
                ctx.strokeRect(this.edge.v1.x - 12.5, yVal, 25, Math.abs(this.edge.v1.y - this.edge.v2.y));
                return;
            }
            let angle = 0;
            if (this.edge.v1.x !== this.edge.v2.x) {
                angle = Math.atan2(this.edge.v2.y - this.edge.v1.y, this.edge.v2.x - this.edge.v1.x);
            }
            else {
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
    constructor(renderService) {
        this.lastTimestamp = 0;
        this.gameLoop = this.gameLoop.bind(this);
        this.renderService = renderService;
    }
    update(deltaTime) {
        return __awaiter(this, void 0, void 0, function* () {
            // work here
        });
    }
    render() {
        this.renderService.renderFrame();
    }
    gameLoop(timestamp) {
        return __awaiter(this, void 0, void 0, function* () {
            const deltaTime = timestamp - this.lastTimestamp;
            this.lastTimestamp = timestamp;
            yield this.update(deltaTime);
            this.render();
            requestAnimationFrame(this.gameLoop);
        });
    }
    start() {
        this.lastTimestamp = performance.now();
        requestAnimationFrame(this.gameLoop);
    }
}
class Player {
    constructor(color, buildableSettlements = 5, buildableCities = 4, buildableRoads = 15) {
        this.color = color;
        this.buildableSettlements = buildableSettlements;
        this.buildableCities = buildableCities;
        this.buildableRoads = buildableRoads;
        this.resources = {};
    }
    isTradeValid(trade) {
        return !!trade.find((resource) => resource.quantity + this.resources[resource.resource] < 0);
    }
    trade(trade) {
        trade.forEach((resource) => {
            this.resources[resource.resource] += resource.quantity;
        });
    }
}
class Bank {
    constructor(resources) {
        this.resources = resources;
    }
    isTradeValid(trade) {
        return !!trade.find((resource) => resource.quantity + this.resources[resource.resource] < 0);
    }
    trade(trade) {
        trade.forEach((resource) => {
            this.resources[resource.resource] += resource.quantity;
        });
    }
}
class GameError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}
var MoveType;
(function (MoveType) {
    MoveType[MoveType["BUILDING"] = 0] = "BUILDING";
    MoveType[MoveType["ROAD"] = 1] = "ROAD";
    MoveType[MoveType["TRADE"] = 2] = "TRADE";
    MoveType[MoveType["END_PLAYER_TURN"] = 3] = "END_PLAYER_TURN";
})(MoveType || (MoveType = {}));
var BuildingActions;
(function (BuildingActions) {
    BuildingActions[BuildingActions["BUILD_CITY"] = 0] = "BUILD_CITY";
    BuildingActions[BuildingActions["BUILD_SETTLEMENT"] = 1] = "BUILD_SETTLEMENT";
})(BuildingActions || (BuildingActions = {}));
var RoadActions;
(function (RoadActions) {
    RoadActions[RoadActions["BUILD_ROAD"] = 0] = "BUILD_ROAD";
})(RoadActions || (RoadActions = {}));
class RemoteGameHandler {
    resolve(clickEvent) {
        throw new Error("Method not implemented.");
    }
}
class LocalGameHandler {
    constructor(playerColors, buildings, roads, tileGrid) {
        this.playerColors = playerColors;
        this.buildings = buildings;
        this.roads = roads;
        this.tileGrid = tileGrid;
        this.currentPlayerIndex = 0;
        this.turn = 0;
        this.moveStack = [];
        this.players = [];
        this.diceRolled = false;
        playerColors.forEach((color) => {
            this.players.push(new Player(color));
        });
    }
    resolve(clickEvent) {
        if (clickEvent.clickable instanceof Building) {
            const building = clickEvent.clickable;
            this.updateGame({
                turn: this.turn,
                player: this.playerColors[this.currentPlayerIndex],
                move: {
                    id: building.id,
                    action: BuildingActions.BUILD_SETTLEMENT,
                },
                moveType: MoveType.BUILDING,
            });
        }
        else if (clickEvent.clickable instanceof Road) {
            const road = clickEvent.clickable;
            this.updateGame({
                turn: this.turn,
                player: this.playerColors[this.currentPlayerIndex],
                move: {
                    id: road.id,
                    action: RoadActions.BUILD_ROAD,
                },
                moveType: MoveType.ROAD,
            });
        }
    }
    updateGame(gameMove) {
        // Check if move is valid before placing on stack
        try {
            if (gameMove.player !== this.playerColors[this.currentPlayerIndex])
                throw new GameError(`${gameMove.player} tried to move during ${this.playerColors[this.currentPlayerIndex]} turn.`);
            else if (gameMove.turn !== this.turn) {
                throw new GameError(`${gameMove.player}'s turn is out of sync, ${this.turn} (local), ${gameMove.turn} (player)`);
            }
            this.handleMove(gameMove);
        }
        catch (error) {
            if (error instanceof GameError) {
                console.log("Game Error Attempted: ", error.message);
            }
            else {
                console.error("Unknown Error: ", error.message);
            }
        }
        this.moveStack.push(gameMove);
    }
    diceRoll(rollNumber) {
        for (const key in tileGrid.grid) {
            if (Object.prototype.hasOwnProperty.call(tileGrid.grid, key)) {
                const tile = tileGrid.grid[key];
                if (tile.rollNumber === rollNumber) {
                    tile.adjacentBuildings
                        .filter((building) => building.state !== BuildingState.UNDEVELOPED)
                        .forEach((building) => {
                        this.updateGame({
                            turn: this.turn,
                            player: building.color,
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
    handleMove(gameMove) {
        switch (gameMove.moveType) {
            case MoveType.ROAD:
                const roadMove = gameMove.move;
                this.roads[roadMove.id].buildRoad(gameMove.player);
                break;
            case MoveType.BUILDING:
                const buildMove = gameMove.move;
                this.buildings[buildMove.id].buildSettlement(gameMove.player, gameMove.turn);
                break;
            case MoveType.TRADE:
                const tradeMove = gameMove.move;
                if (tradeMove.withPlayer === "bank") {
                    console.log(tradeMove);
                }
                break;
            case MoveType.END_PLAYER_TURN:
                this.endPlayerTurn();
                break;
        }
    }
    endPlayerTurn() {
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
//   "player": "red",
//   "move": {
//     "id": 106,
//     "action": 0
//   },
//   "moveType": 1
// }
function mapToGameMove(move) {
    const result = {
        turn: move.turn,
        player: move.player,
        moveType: move.moveType,
    };
    switch (move.moveType) {
        case MoveType.BUILDING:
            result["move"] = {
                id: move.move.id,
                action: move.move.action,
            };
            break;
        case MoveType.ROAD:
            result["move"] = {
                id: move.move.id,
                action: move.move.action,
            };
            break;
    }
    return result;
}
////////////////////////////////////////////////////////////////////////////////////
const resourceGenerator = new TileResourceDistributer(resourceTileWeights);
const renderLayers = ["tile", "edge", "vertex"];
const renderService = new RenderService(ctx, renderLayers);
const tileGrid = new TileGrid(4, { x: canvas.width / 2, y: canvas.height / 2 }, 100, resourceGenerator);
const buildings = [];
const roads = [];
const gameHandler = new LocalGameHandler([PlayerColors.RED, PlayerColors.BLUE], buildings, roads, tileGrid);
const clickHandler = new ClickHandler(canvas, gameHandler);
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
        if (buildings[i] === buildings[j])
            continue;
        if (buildings[i].vertex.connectedEdges.reduce((val, edge) => buildings[j].vertex.connectedEdges.find((edge2) => edge === edge2) || val, false))
            buildings[i].adjacentBuildings.push(buildings[j]);
    }
}
tileGrid.edges.forEach((edge, index) => {
    roads.push(new Road(edge, index));
});
for (let i = 0; i < roads.length; i++) {
    buildings
        .filter((building) => building.vertex === roads[i].edge.v1 ||
        building.vertex === roads[i].edge.v2)
        .forEach((building) => {
        roads[i].adjacentBuildings.push(building);
        building.adjacentRoads.push(roads[i]);
    });
    for (let j = 0; j < roads.length; j++) {
        if (roads[i] === roads[j])
            continue;
        if (roads[i].edge.v1 == roads[j].edge.v1 ||
            roads[i].edge.v2 == roads[j].edge.v1 ||
            roads[i].edge.v1 == roads[j].edge.v2 ||
            roads[i].edge.v2 == roads[j].edge.v2)
            roads[i].adjacentRoads.push(roads[j]);
    }
}
for (const key in tileGrid.grid) {
    if (tileGrid.grid.hasOwnProperty(key)) {
        const tile = tileGrid.grid[key];
        tile.hexagon.vertices.forEach((vertex) => {
            tile.adjacentBuildings.push(buildings.find((building) => building.vertex == vertex));
        });
    }
}
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
//# sourceMappingURL=index.js.map