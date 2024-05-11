const canvas: HTMLCanvasElement | null = document.getElementById(
  "gameCanvas"
) as HTMLCanvasElement;
const ctx = canvas.getContext("2d");

canvas.width = 1080;
canvas.height = 720;
canvas.style.width = "1080px";
canvas.style.height = "720px";

function drawHexagon(x: number, y: number, size: number, tile: Tile) {
  const angle = Math.PI / 3;
  ctx.moveTo(x - size * Math.sin(angle), y + size * Math.cos(angle));
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 + (i * Math.PI) / 3;
    ctx.lineTo(x - size * Math.sin(angle), y + size * Math.cos(angle));

    if (tile.settlements[i]) {
      ctx.fillRect(
        x - size * Math.sin(angle) - 10,
        y + size * Math.cos(angle) - 10,
        20,
        20
      );
    }
  }

  ctx.closePath();
  ctx.fillStyle = tile.resourceType;
  ctx.strokeStyle = "#ffffff";

  ctx.stroke();
  ctx.fill();

  let text = tile.rollNumber.toString();
  if (tile.hasRobber) {
    text = "R";
  } else if (tile.rollNumber == -1) {
    text = "";
  }

  ctx.font = "30px Arial";
  ctx.fillStyle = "white";
  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

function drawSettlements(x: number, y: number, size: number, tile: Tile) {
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 + (i * Math.PI) / 3;
    ctx.moveTo(x - size * Math.sin(angle), y + size * Math.cos(angle));
    if (tile.settlements[i] != null) {
      ctx.fillStyle = tile.settlements[i].color;
      ctx.fillRect(
        x - size * Math.sin(angle) - 10,
        y + size * Math.cos(angle) - 10,
        20,
        20
      );
    }
  }
}
function drawRoads() {}

function drawHexagonGrid(startX, startY, size, width, height, grid: TileGrid) {
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const tile = grid.getTileStd(row, column);
      if (row % 2 == 0) {
        drawHexagon(
          startX + Math.sqrt(3) * size * column,
          startY + size * 1.5 * row,
          size,
          tile
        );
      } else {
        drawHexagon(
          startX + Math.sqrt(3) * size * column + Math.sqrt(3) * size * 0.5,
          startY + size * 1.5 * row,
          size,
          tile
        );
      }
    }
  }

  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const tile = grid.getTileStd(row, column);
      if (row % 2 == 0) {
        drawSettlements(
          startX + Math.sqrt(3) * size * column,
          startY + size * 1.5 * row,
          size,
          tile
        );
      } else {
        drawSettlements(
          startX + Math.sqrt(3) * size * column + Math.sqrt(3) * size * 0.5,
          startY + size * 1.5 * row,
          size,
          tile
        );
      }
    }
  }
}

enum ResourceType {
  CONCRETE = "gray",
  SPICE = "orange",
  ANIMAL = "green",
  METAL = "lightgray",
  WOOD = "brown",
  DESERT = "yellow",
}

enum PlayerColors {
  WHITE = "white",
  RED = "red",
  BLACK = "black",
  GREEN = "green",
}

const resourceTileWeights = [
  { resource: ResourceType.CONCRETE, weight: 0.2 },
  { resource: ResourceType.SPICE, weight: 0.25 },
  { resource: ResourceType.ANIMAL, weight: 0.2 },
  { resource: ResourceType.METAL, weight: 0.15 },
  { resource: ResourceType.WOOD, weight: 0.15 },
  { resource: ResourceType.DESERT, weight: 0.05 },
];

const weightedResourceTable = [];

for (let j = 0; j < resourceTileWeights.length; j++) {
  for (let i = 0; i < resourceTileWeights[j].weight * 100; i++) {
    weightedResourceTable.push(resourceTileWeights[j].resource);
  }
}

class Building {
  isCity: boolean;
  color: PlayerColors;
  constructor(color: PlayerColors) {
    this.color = color;
    this.isCity = false;
  }
}

class Road {
  color: PlayerColors;
  constructor(color: PlayerColors) {
    this.color = color;
  }
}

class Tile {
  resourceType: ResourceType;
  hasRobber: boolean;
  rollNumber: number;
  settlements: Building[] | null[];
  roads: boolean[] | null[];

  constructor(
    resourceType: ResourceType,
    hasRobber: boolean,
    rollNumber: number
  ) {
    this.resourceType = resourceType;
    this.hasRobber = hasRobber;
    this.rollNumber = rollNumber;
    // 6 entries, first is top right, then goes clockwise
    this.settlements = [
      new Building(PlayerColors.BLACK),
      null,
      null,
      null,
      null,
      null,
    ];
    // 6 entries, first is top right, then goes clockwise
    this.roads = [null, null, null, null, null, null];
  }
}

class TileGrid {
  width: number;
  height: number;
  grid: Tile[][];
  vertices: Building[][] | null[][];
  edges: Road[][] | null[][];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.grid = [];
    this.vertices = [];
    this.edges = [];
    this.initTiles();
    this.initVertices();
  }

  private initTiles() {
    for (let row = 0; row < this.height; row++) {
      this.grid.push([]);
      for (let col = 0; col < this.width * 2; col++) {
        if ((row + col) % 2 == 1) {
          this.grid[row].push(null);
        } else {
          const resource =
            weightedResourceTable[Math.floor(Math.random() * 100)];
          this.grid[row].push(
            new Tile(resource, false, Math.floor(Math.random() * 11) + 2)
          );
        }
      }
    }
  }

  private initVertices() {
    for (let row = 0; row < this.height + 1; row++) {
      if (row % 2 == 0) {
        this.vertices.push([null]);
      } else {
        this.vertices.push([]);
      }
      for (let col = 0; col < this.width * 2; col++) {
        this.vertices[row].push(null);
      }
      if (row % 2 != 0) {
        this.vertices[row].push(null);
      }
    }
    console.log(this.vertices);
  }

  getTileStd(row: number, col: number): Tile {
    if (row % 2 == 0) return this.grid[row][col * 2];
    return this.grid[row][col * 2 + 1];
  }
}

const width = 8;
const height = 3;

const grid = new TileGrid(width, height);
drawHexagonGrid(250, 200, 50, width, height, grid);
