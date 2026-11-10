import type { GridConfig } from './contracts';

export interface GridCell {
  col: number;
  row: number;
}

export interface DistanceResult {
  cells: number;
  distance: number;
}

/**
 * Convert world coordinate to square or hex cell indices.
 */
export function worldToCell(x: number, y: number, grid: GridConfig): GridCell {
  if (grid.type === 'hex') {
    // Pointy-topped hex grid axial coordinates
    const size = grid.size / Math.sqrt(3);
    const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / size;
    const r = ((2 / 3) * y) / size;
    return roundAxialToHex(q, r);
  }

  return {
    col: Math.floor(x / grid.size),
    row: Math.floor(y / grid.size)
  };
}

/**
 * Convert cell index to world coordinate at cell center.
 */
export function cellToWorld(col: number, row: number, grid: GridConfig): { x: number; y: number } {
  if (grid.type === 'hex') {
    const size = grid.size / Math.sqrt(3);
    const x = size * (Math.sqrt(3) * col + (Math.sqrt(3) / 2) * row);
    const y = size * ((3 / 2) * row);
    return { x, y };
  }

  return {
    x: (col + 0.5) * grid.size,
    y: (row + 0.5) * grid.size
  };
}

/**
 * Snap any world position (x, y) to the nearest cell center.
 */
export function snapToGrid(x: number, y: number, grid: GridConfig): { x: number; y: number } {
  const cell = worldToCell(x, y, grid);
  return cellToWorld(cell.col, cell.row, grid);
}

/**
 * Calculate distance between two world points in grid units and feet.
 */
export function calculateDistance(
  start: { x: number; y: number },
  end: { x: number; y: number },
  grid: GridConfig,
  unitsPerCell = 5
): DistanceResult {
  const startCell = worldToCell(start.x, start.y, grid);
  const endCell = worldToCell(end.x, end.y, grid);

  let cells: number;

  if (grid.type === 'hex') {
    // Hex cube distance
    const s1 = -startCell.col - startCell.row;
    const s2 = -endCell.col - endCell.row;
    cells = Math.max(
      Math.abs(startCell.col - endCell.col),
      Math.abs(startCell.row - endCell.row),
      Math.abs(s1 - s2)
    );
  } else {
    // Square Chebyshev distance (standard 5e diagonal rule: 5-5-5)
    cells = Math.max(
      Math.abs(endCell.col - startCell.col),
      Math.abs(endCell.row - startCell.row)
    );
  }

  return {
    cells,
    distance: cells * unitsPerCell
  };
}

function roundAxialToHex(fracQ: number, fracR: number): GridCell {
  const fracS = -fracQ - fracR;
  let q = Math.round(fracQ);
  let r = Math.round(fracR);
  let s = Math.round(fracS);

  const qDiff = Math.abs(q - fracQ);
  const rDiff = Math.abs(r - fracR);
  const sDiff = Math.abs(s - fracS);

  if (qDiff > rDiff && qDiff > sDiff) {
    q = -r - s;
  } else if (rDiff > sDiff) {
    r = -q - s;
  }

  return { col: q, row: r };
}
