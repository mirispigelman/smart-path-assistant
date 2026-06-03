// Matrix dimensions (per SQL: row indices 0–7, column indices 0–4)
const ROWS = 8;
const COLS = 5;

// Cross-aisle rules: horizontal moves between columns are allowed only on these rows:
const ALLOWED_CROSS_ROWS = new Set([0, 3, 4]); 

/**
 * Compute the full path between two grid points using BFS.
 * Returns distance and the step array (fullPath).
 */
function getBFS_Path(start, end) {
    if (start.r === end.r && start.c === end.c) {
        return { distance: 0, fullPath: [] }; // already at destination
    }

    // Queue holds: current position and the path of steps that led here
    const queue = [{ r: start.r, c: start.c, path: [] }];
    const visited = new Set();
    const startKey = `${start.r},${start.c}`;
    visited.add(startKey);

    const moves = [
        { dr: 1, dc: 0, label: '⬇️' },  // down (r increases — visually downward on the map)
        { dr: -1, dc: 0, label: '⬆️' }, // up (r decreases)
        { dr: 0, dc: 1, label: '➡️' },  // right
        { dr: 0, dc: -1, label: '⬅️' }  // left
    ];

    while (queue.length > 0) {
        const { r, c, path } = queue.shift();

        for (const move of moves) {
            const nr = r + move.dr;
            const nc = c + move.dc;

            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                // Validate move: horizontal steps require an allowed cross-aisle row
                if (move.dc !== 0 && !ALLOWED_CROSS_ROWS.has(r)) {
                    continue;
                }

                const newKey = `${nr},${nc}`;
                if (visited.has(newKey)) continue;

                const newPath = [...path, move.label];

                if (nr === end.r && nc === end.c) {
                    return { distance: newPath.length, fullPath: newPath };
                }

                visited.add(newKey);
                queue.push({ r: nr, c: nc, path: newPath });
            }
        }
    }
    // No path found (should not happen if the graph is connected)
    return { distance: Infinity, fullPath: [] }; 
}

export function calculateShortestPath(itemCoordinates) {
    if (itemCoordinates.length === 0) return {};
    
    // Start point: store entrance
    const startPoint = { r: 1, c: 0 }; 
    let currentPoint = startPoint;
    
    // Coerce coordinates to numbers for reliable comparison
    let remainingItems = itemCoordinates.map(item => ({
        ...item,
        r: parseInt(item.r, 10),
        c: parseInt(item.c, 10)
    }));

    let calculatedOrderMap = {};
    let currentOrder = 1;

    while (remainingItems.length > 0) {
        let shortestDistance = Infinity;
        let nextItemIndex = -1;
        let bestPath = [];
        
        for (let i = 0; i < remainingItems.length; i++) {
            const item = remainingItems[i];
            const result = getBFS_Path(currentPoint, { r: item.r, c: item.c });
            
            // Optimization: distance 0 means we are already at this cell — pick it immediately
            // so items in the same category stay adjacent in the list.
            if (result.distance === 0) {
                shortestDistance = 0;
                nextItemIndex = i;
                // Another item in the same category/cell — same aisle, not a new entrance stop
                bestPath = currentOrder === 1 ? [] : ['↔️'];
                break;
            }

            if (result.distance < shortestDistance) {
                shortestDistance = result.distance;
                nextItemIndex = i;
                bestPath = result.fullPath;
            }
        }
        
        if (nextItemIndex !== -1) {
            const nextItem = remainingItems[nextItemIndex];
            
            calculatedOrderMap[nextItem.item_id] = {
                order: currentOrder++,
                fullPath: bestPath
            };
            
            currentPoint = { r: nextItem.r, c: nextItem.c };
            remainingItems.splice(nextItemIndex, 1);
        } else {
            // Fallback: if BFS fails (e.g. unreachable target), take the first item
            // to avoid an infinite loop or dropping items.
            const nextItem = remainingItems[0];
            calculatedOrderMap[nextItem.item_id] = {
                order: currentOrder++,
                fullPath: ['❓']
            };
            currentPoint = { r: nextItem.r, c: nextItem.c };
            remainingItems.splice(0, 1);
        }
    }
    
    return calculatedOrderMap;
}
