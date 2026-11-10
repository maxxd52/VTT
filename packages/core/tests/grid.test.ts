import { describe, expect, it } from 'vitest';
import type { GridConfig } from '../src/contracts';
import {
  calculateDistance,
  cellToWorld,
  snapToGrid,
  worldToCell
} from '../src/grid';

describe('Square Grid Calculations', () => {
  const squareGrid: GridConfig = { size: 50, type: 'square' };

  it('snaps coordinates to the nearest square cell center', () => {
    // Cell (0,0) center is (25, 25)
    expect(snapToGrid(10, 10, squareGrid)).toEqual({ x: 25, y: 25 });
    // Cell (1,2) center is (75, 125)
    expect(snapToGrid(80, 110, squareGrid)).toEqual({ x: 75, y: 125 });
  });

  it('converts between world coordinates and cell coordinates', () => {
    expect(worldToCell(75, 125, squareGrid)).toEqual({ col: 1, row: 2 });
    expect(cellToWorld(1, 2, squareGrid)).toEqual({ x: 75, y: 125 });
  });

  it('calculates ruler distance with Chebyshev (D&D 5e / Pathfinder standard) distance', () => {
    // 3 cells horizontal = 15 ft
    const distH = calculateDistance({ x: 25, y: 25 }, { x: 175, y: 25 }, squareGrid);
    expect(distH.cells).toBe(3);
    expect(distH.distance).toBe(15);

    // Diagonal: 3 cells right, 4 cells down (Chebyshev: max(3, 4) = 4 cells = 20 ft)
    const distDiag = calculateDistance({ x: 25, y: 25 }, { x: 175, y: 225 }, squareGrid);
    expect(distDiag.cells).toBe(4);
    expect(distDiag.distance).toBe(20);
  });
});

describe('Hexagonal Grid Calculations', () => {
  const hexGrid: GridConfig = { size: 60, type: 'hex' };

  it('snaps coordinates to nearest hex center', () => {
    const originSnap = snapToGrid(0, 0, hexGrid);
    expect(typeof originSnap.x).toBe('number');
    expect(typeof originSnap.y).toBe('number');

    // Snapping twice yields identical coordinates (idempotency)
    const resnap = snapToGrid(originSnap.x, originSnap.y, hexGrid);
    expect(resnap.x).toBeCloseTo(originSnap.x, 3);
    expect(resnap.y).toBeCloseTo(originSnap.y, 3);
  });

  it('calculates distance across hex grid', () => {
    const dist = calculateDistance({ x: 0, y: 0 }, { x: 120, y: 0 }, hexGrid);
    expect(dist.cells).toBeGreaterThan(0);
    expect(dist.distance).toBe(dist.cells * 5);
  });
});
