import { v4 as uuidv4 } from "uuid";

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
  BLUE = "blue",
  YELLOW = "yellow",
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
type Hexagon = { coordinates: AxialCoordinate; edges: Edge[]; center: Vertex };
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
      const y = ((event.clientY - rect.top) * canvas.height) / rect.height;
      // Current implementation is for the top clickable to be the only resolved - subject to change
      let topClickable: Clickable | null = this.clickables.reduce(
        (currentTop, clickable) =>
          clickable.isClicked({ x, y, clickable }) &&
          (!currentTop || currentTop.getDepth() > clickable.getDepth())
            ? clickable
            : currentTop,
        null
      );
      if (topClickable) resolver.resolve({ x, y, clickable: topClickable });
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
    size * (Math.sqrt(3) * coord.q + (Math.sqrt(3) / 2) * coord.r) + offSet.x;
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
  hasRobber: boolean = false;
  uuid: uuidv4;
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
        const rollNumber = Math.floor(Math.random() * 11 + 1);
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
        this.weightedResourceTable.push(resourceTileWeights[j].resource);
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
  { resource: ResourceType.SPICE, weight: 0.19 },
  { resource: ResourceType.ANIMAL, weight: 0.2 },
  { resource: ResourceType.METAL, weight: 0.15 },
  { resource: ResourceType.WOOD, weight: 0.15 },
  { resource: ResourceType.FREAKY, weight: 0.01 },
];

class Building implements Renderable, Clickable {
  uuid: uuidv4;
  state: BuildingState = BuildingState.UNDEVELOPED;
  color: PlayerColors;
  adjacentBuildings: Building[] = [];
  adjacentRoads: Road[] = [];

  constructor(public vertex: Vertex) {}

  getDepth(): number {
    return 1;
  }
  isClicked(event: ClickEvent): boolean {
    const hitboxRadius = 20;
    const dx = event.x - this.vertex.x;
    const dy = event.y - this.vertex.y;
    return Math.sqrt(dx * dx + dy * dy) < hitboxRadius;
  }

  buildSettlement(playerColor: PlayerColors) {
    if (this.state != BuildingState.UNDEVELOPED) {
      throw new GameError(
        `${playerColor} tried to build on invalid space owned by ${this.color}`
      );
    }

    this.color = playerColor;
    this.state = BuildingState.SETTLEMENT;
  }

  draw(ctx: CanvasRenderingContext2D): void {
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
class Road implements Renderable, Clickable {
  uuid: uuidv4;
  color: PlayerColors;
  isBuilt: boolean;
  adjacentRoads: Road[] = [];
  adjacentBuildings: Building[] = [];

  constructor(public edge: Edge) {}
  getDepth(): number {
    return 3;
  }

  buildRoad(playerColor: PlayerColors) {
    if (this.isBuilt) {
      throw new GameError(
        `${playerColor} tried to build on a road owned by ${this.color}`
      );
    }
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
        ((event.x - this.edge.v1.x) * dx + (event.y - this.edge.v1.y) * dy) /
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
          this.edge.v1.y < this.edge.v2.y ? this.edge.v1.y : this.edge.v2.y;
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
        angle = this.edge.v1.y < this.edge.v2.y ? Math.PI / 2 : -Math.PI / 2;
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
class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

enum BuildingActions {
  BUILD_CITY,
  BUILD_SETTLEMENT,
}

enum RoadActions {
  BUILD_ROAD,
}

type BuildingMove = {
  uuid: uuidv4;
  action: BuildingActions;
};

type RoadMove = {
  uuid: uuidv4;
  action: RoadActions;
};

// type ResourceTrade = {
//   resource: ResourceType;
//   quantity: number;
// };
// type TradeAction = {
//   withPlayer: PlayerColors;
//   // negative quantity means 'withPlayer' recieves from player
//   resourceExchange: ResourceTrade[];
// };

type GameMove = {
  turn: number;
  player: PlayerColors;
  move: RoadMove | BuildingMove;
};

class LocalGameHandler implements ClickEventResolver {
  currentPlayerIndex: number = 0;
  turn: number = 0;
  moveStack: GameMove[] = [];

  constructor(public players: PlayerColors[]) {}

  resolve(clickEvent: ClickEvent) {
    if (clickEvent.clickable instanceof Building) {
      const building = clickEvent.clickable as Building;
      building.buildSettlement(this.players[this.currentPlayerIndex]);
      this.updateGame({
        turn: 0,
        player: this.players[this.currentPlayerIndex],
        move: {
          uuid: building.uuid,
          action: BuildingActions.BUILD_SETTLEMENT,
        },
      });
    } else if (clickEvent.clickable instanceof Road) {
      const road = clickEvent.clickable as Road;
      road.buildRoad(this.players[this.currentPlayerIndex]);
      this.updateGame({
        turn: 0,
        player: this.players[this.currentPlayerIndex],
        move: {
          uuid: road.uuid,
          action: RoadActions.BUILD_ROAD,
        },
      });
    }
  }

  updateGame(gameMove: GameMove) {
    // Check if move is valid before placing on stack
    try {
    } catch (error) {
      if (error instanceof GameError) {
        console.log("Game Error Attempted: ", error.message);
      } else {
        console.error("Unknown Error: ", error.message);
      }
    }
    this.moveStack.push();
  }
}

///////////////////////////////////////////////////////////////////////////////////
const resourceGenerator = new TileResourceDistributer(resourceTileWeights);

const renderLayers = ["tile", "edge", "vertex"];
const renderService = new RenderService(ctx, renderLayers);

const tileGrid = new TileGrid(
  4,
  { x: canvas.width / 2, y: canvas.height / 2 },
  100,
  resourceGenerator
);

const gameHandler = new LocalGameHandler([PlayerColors.RED, PlayerColors.BLUE]);

const clickHandler = new ClickHandler(canvas, gameHandler);

for (const key in tileGrid.grid) {
  if (tileGrid.grid.hasOwnProperty(key)) {
    renderService.addElement("tile", tileGrid.grid[key]);
  }
}

const buildings: Building[] = [];
const roads: Road[] = [];
tileGrid.vertices.forEach((vertex) => {
  buildings.push(new Building(vertex));
});

for (let i = 0; i < buildings.length; i++) {
  for (let j = 0; j < buildings.length; j++) {
    if (buildings[i] === buildings[j]) continue;
    if (
      buildings[i].vertex.connectedEdges.reduce(
        (val, edge) =>
          buildings[j].vertex.connectedEdges.find((edge2) => edge === edge2) ||
          val,
        false
      )
    )
      buildings[i].adjacentBuildings.push(buildings[j]);
  }
}

tileGrid.edges.forEach((edge) => {
  roads.push(new Road(edge));
});

for (let i = 0; i < roads.length; i++) {
  const adjacentBuildings = buildings.filter(
    (building) =>
      building.vertex === roads[i].edge.v1 ||
      building.vertex === roads[i].edge.v2
  );
  adjacentBuildings.forEach((building) => {
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
