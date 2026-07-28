/**
 * A uniform spatial grid over a rectangle.
 *
 * A node can only link to a node within one link radius, so the cells are
 * exactly one radius across and each node need only look at its own cell and
 * the four neighbours that have not already looked at it. That takes the pair
 * count from n(n−1)/2 to roughly n × (the density of a 5-cell neighbourhood),
 * which is what makes a user-raisable node population affordable at all.
 *
 * This module knows nothing about the field: it is handed a span, a radius, an
 * origin and an array of things with `x` and `y`. Everything it owns is a
 * pre-sized typed array, rebuilt with a counting sort each frame — no maps, no
 * arrays of arrays, no allocation in the render loop.
 */

/** Cell offsets covering the half-neighbourhood: self, E, SW, S, SE. */
export const NEIGHBOUR_DX = Int8Array.from([0, 1, -1, 0, 1]);
export const NEIGHBOUR_DY = Int8Array.from([0, 0, 1, 1, 1]);

/** Ceiling on cell count, so a small reach on a huge world cannot run away. */
const MAX_GRID_CELLS = 8192;

/**
 * The grid itself. `counts`, `start`, `items` and `cellOf` are reallocated only
 * when the shape changes, which never happens inside a frame.
 */
export const grid = {
  cols: 1,
  rows: 1,
  /** Cell size in world units. Never smaller than the link radius. */
  cell: 1,
  cellCount: 0,
  counts: new Int32Array(0),
  start: new Int32Array(0),
  cursor: new Int32Array(0),
  /** Node indices, ordered by cell. */
  items: new Int16Array(0),
  /** Which cell each node landed in, by node index. */
  cellOf: new Int16Array(0),
};

/**
 * Size the grid for a rectangle and a population.
 *
 * @param {number} spanX world units covered horizontally
 * @param {number} spanY world units covered vertically
 * @param {number} radius the link radius — the cell size, before coarsening
 * @param {number} nodeCount how many items will be sorted into it
 */
export function allocateGrid(spanX, spanY, radius, nodeCount) {
  let cell = Math.max(1, radius);
  grid.cols = Math.max(1, Math.ceil(spanX / cell));
  grid.rows = Math.max(1, Math.ceil(spanY / cell));

  // A very small reach on a very large world would ask for millions of cells,
  // which costs more to clear than the pair tests it saves. Coarsen instead;
  // the neighbourhood stays conservative either way.
  while (grid.cols * grid.rows > MAX_GRID_CELLS) {
    cell *= 1.5;
    grid.cols = Math.max(1, Math.ceil(spanX / cell));
    grid.rows = Math.max(1, Math.ceil(spanY / cell));
  }
  grid.cell = cell;

  const cells = grid.cols * grid.rows;
  if (grid.counts.length !== cells) {
    grid.counts = new Int32Array(cells);
    grid.start = new Int32Array(cells);
    grid.cursor = new Int32Array(cells);
  }
  if (grid.items.length !== nodeCount) {
    grid.items = new Int16Array(nodeCount);
    grid.cellOf = new Int16Array(nodeCount);
  }
  grid.cellCount = cells;
}

/**
 * Counting-sort every node into its cell. O(n + cells), allocation-free.
 *
 * @param {Array<{x: number, y: number}>} nodes
 * @param {number} n how many of them to place
 * @param {number} originX world x of the grid's left edge, negated
 * @param {number} originY world y of the grid's top edge, negated
 */
export function buildGrid(nodes, n, originX, originY) {
  const { cols, rows, cell, counts, start, cursor, items, cellOf } = grid;
  const cells = cols * rows;
  counts.fill(0);

  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    let cx = ((node.x + originX) / cell) | 0;
    let cy = ((node.y + originY) / cell) | 0;
    if (cx < 0) cx = 0; else if (cx >= cols) cx = cols - 1;
    if (cy < 0) cy = 0; else if (cy >= rows) cy = rows - 1;
    const c = cy * cols + cx;
    cellOf[i] = c;
    counts[c]++;
  }

  let running = 0;
  for (let c = 0; c < cells; c++) {
    start[c] = running;
    cursor[c] = running;
    running += counts[c];
  }
  for (let i = 0; i < n; i++) {
    items[cursor[cellOf[i]]++] = i;
  }
}
