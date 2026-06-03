import { useMemo } from 'react';
import en from '../../i18n/en.js';

const ROWS = 8;
const COLS = 5;
const ENTRY = { r: 1, c: 0 };
/** Horizontal cross-aisles — matches backend pathfinding.js (rows 0, 3, 4) */
const CROSS_AISLE_ROWS = new Set([0, 3, 4]);

const STEP_DELTA = {
    '⬇️': { dr: 1, dc: 0 },
    '⬆️': { dr: -1, dc: 0 },
    '➡️': { dr: 0, dc: 1 },
    '⬅️': { dr: 0, dc: -1 },
    '↔️': { dr: 0, dc: 0 },
};

function key(r, c) {
    return `${r},${c}`;
}

function buildPathCells(routeItems) {
    const mapped = routeItems.filter((item) => item.mapped && item.aisle);
    if (mapped.length === 0) return [];

    const cells = [];
    const seen = new Set();
    let pos = { ...ENTRY };

    const push = (r, c, meta = {}) => {
        const k = key(r, c);
        if (!seen.has(k)) {
            seen.add(k);
            cells.push({ r, c, ...meta });
        }
    };

    push(ENTRY.r, ENTRY.c, { kind: 'entry' });

    for (let i = 0; i < mapped.length; i++) {
        const item = mapped[i];
        for (const step of item.fullPath || []) {
            const d = STEP_DELTA[step];
            if (!d) continue;
            pos = {
                r: Math.max(0, Math.min(ROWS - 1, pos.r + d.dr)),
                c: Math.max(0, Math.min(COLS - 1, pos.c + d.dc)),
            };
            push(pos.r, pos.c, { kind: 'walk' });
        }
        const dest = { r: item.aisle.row, c: item.aisle.col };
        pos = dest;
        push(dest.r, dest.c, { kind: 'stop', name: item.item_name });
    }

    return cells;
}

/** Row height weights — must match grid-template-rows in App.css */
const ROW_WEIGHTS = [0.72, 1, 1, 0.72, 0.72, 1, 1, 1];
const TOTAL_ROW_WEIGHT = ROW_WEIGHTS.reduce((a, b) => a + b, 0);
/** Within cross-row cells, horizontal passage sits between compact shelf bands */
const CROSS_PASSAGE_ROW_FRACTION = 0.52;

function rowCenterWeight(r) {
    let before = 0;
    for (let i = 0; i < r; i++) before += ROW_WEIGHTS[i];
    return before + ROW_WEIGHTS[r] * 0.5;
}

function rowCrossPassageWeight(r) {
    let before = 0;
    for (let i = 0; i < r; i++) before += ROW_WEIGHTS[i];
    return before + ROW_WEIGHTS[r] * CROSS_PASSAGE_ROW_FRACTION;
}

function gridPointToSvg(r, c, stepKind) {
    const x = ((c + 0.5) / COLS) * 100;
    const yWeight =
        stepKind === 'H' && CROSS_AISLE_ROWS.has(r)
            ? rowCrossPassageWeight(r)
            : rowCenterWeight(r);
    return { x, y: (yWeight / TOTAL_ROW_WEIGHT) * 100 };
}

function dedupeConsecutivePoints(points) {
    if (points.length === 0) return points;
    const out = [points[0]];
    for (let i = 1; i < points.length; i++) {
        const prev = out[out.length - 1];
        const cur = points[i];
        if (Math.abs(prev.x - cur.x) > 0.05 || Math.abs(prev.y - cur.y) > 0.05) {
            out.push(cur);
        }
    }
    return out;
}

function buildRoutePolyline(routeItems) {
    const mapped = routeItems.filter((item) => item.mapped && item.aisle);
    const points = [gridPointToSvg(ENTRY.r, ENTRY.c, 'V')];
    let pos = { ...ENTRY };

    for (const item of mapped) {
        const steps = item.fullPath || [];
        for (const step of steps) {
            const d = STEP_DELTA[step];
            if (!d || (d.dr === 0 && d.dc === 0)) continue;

            const kind = d.dc !== 0 ? 'H' : 'V';
            const prev = { ...pos };
            pos = {
                r: Math.max(0, Math.min(ROWS - 1, pos.r + d.dr)),
                c: Math.max(0, Math.min(COLS - 1, pos.c + d.dc)),
            };

            if (kind === 'H' && CROSS_AISLE_ROWS.has(prev.r)) {
                points.push(gridPointToSvg(prev.r, prev.c, 'H'));
            }
            if (kind === 'V' && CROSS_AISLE_ROWS.has(prev.r) && prev.r !== pos.r) {
                points.push(gridPointToSvg(prev.r, prev.c, 'H'));
            }

            points.push(gridPointToSvg(pos.r, pos.c, kind));
        }

        const dest = { r: item.aisle.row, c: item.aisle.col };
        if (pos.r !== dest.r || pos.c !== dest.c) {
            pos = dest;
        }
        const lastStep = steps[steps.length - 1];
        const lastKind =
            lastStep && STEP_DELTA[lastStep]?.dc !== 0 ? 'H' : 'V';
        const destPoint = gridPointToSvg(dest.r, dest.c, lastKind);
        const last = points[points.length - 1];
        if (
            Math.abs(last.x - destPoint.x) > 0.05 ||
            Math.abs(last.y - destPoint.y) > 0.05
        ) {
            points.push(destPoint);
        }
        pos = dest;
    }

    return dedupeConsecutivePoints(points);
}

function PickupTooltip({ pickups }) {
    return (
        <span className="store-pickup-tooltip" role="tooltip">
            {pickups.map((p, idx) => (
                <span key={`${p.name}-${idx}`} className="store-pickup-tooltip-line">
                    {p.name}
                    {p.category && (
                        <em className="store-pickup-cat"> ({p.category})</em>
                    )}
                </span>
            ))}
        </span>
    );
}

function ShelfSide({ side, compact, hasPickup }) {
    return (
        <div
            className={[
                'store-shelf',
                `store-shelf-${side}`,
                compact && 'store-shelf-compact',
                hasPickup && 'store-shelf-pickup',
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <span className="store-shelf-face" aria-hidden="true" />
            {hasPickup && (
                <span className="store-pickup-pin" aria-hidden="true">
                    <span className="store-pickup-icon">🛒</span>
                </span>
            )}
        </div>
    );
}

function buildLaneClass({ isCrossRow, onPath, isEntry }) {
    return [
        'store-walk-lane',
        isCrossRow && 'store-lane-cross',
        onPath && 'store-lane-path',
        isEntry && 'store-lane-entry',
    ]
        .filter(Boolean)
        .join(' ');
}

const StoreMap = ({ routeItems = [] }) => {
    const mappedStops = useMemo(
        () => routeItems.filter((item) => item.mapped && item.aisle),
        [routeItems]
    );

    const pathCells = useMemo(() => buildPathCells(routeItems), [routeItems]);
    const polyline = useMemo(() => buildRoutePolyline(routeItems), [routeItems]);

    const pathCellKeys = useMemo(
        () => new Set(pathCells.map((c) => key(c.r, c.c))),
        [pathCells]
    );

    const pickupsByKey = useMemo(() => {
        const m = new Map();
        for (const item of mappedStops) {
            const k = key(item.aisle.row, item.aisle.col);
            if (!m.has(k)) m.set(k, []);
            m.get(k).push({
                order: item.routeOrder,
                name: item.item_name,
                category: item.categoryName,
            });
        }
        for (const list of m.values()) {
            list.sort((a, b) => a.order - b.order);
        }
        return m;
    }, [mappedStops]);

    if (mappedStops.length === 0) {
        return (
            <div className="store-map-empty">
                {en.storeMap.empty}
            </div>
        );
    }

    const polylinePoints = polyline.map((p) => `${p.x},${p.y}`).join(' ');

    return (
        <div className="store-map-wrap">
            <div className="store-map-legend" aria-hidden="true">
                <span className="legend-item">
                    <span className="legend-swatch legend-shelf" /> {en.storeMap.shelves}
                </span>
                <span className="legend-item">
                    <span className="legend-swatch legend-walk" /> {en.storeMap.aisleFloor}
                </span>
                <span className="legend-item">
                    <span className="legend-swatch legend-cross" /> {en.storeMap.crossAisle}
                </span>
                <span className="legend-item">
                    <span className="legend-swatch legend-entry" /> {en.storeMap.entrance}
                </span>
                <span className="legend-item">
                    <span className="legend-swatch legend-path" /> {en.storeMap.yourPath}
                </span>
                <span className="legend-item">
                    <span className="legend-swatch legend-pickup" /> {en.storeMap.pickup}
                </span>
            </div>

            <div className="store-map-frame">
                <div className="store-entry-rail" aria-hidden="true">
                    {Array.from({ length: ROWS }, (_, r) => (
                        <div
                            key={r}
                            className={`store-entry-rail-slot${
                                r === ENTRY.r ? ' store-entry-rail-slot-active' : ''
                            }`}
                        >
                            {r === ENTRY.r && (
                                <div className="store-entry-sign">
                                    <span className="store-entry-sign-icon">🚪</span>
                                    <span>{en.storeMap.entrance}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="store-map-grid-container">
                    <div
                        className="store-map-grid"
                        role="img"
                        aria-label={en.storeMap.ariaLabel(mappedStops.length)}
                    >
                    {Array.from({ length: ROWS }, (_, r) =>
                        Array.from({ length: COLS }, (_, c) => {
                            const k = key(r, c);
                            const onPath = pathCellKeys.has(k);
                            const pickups = pickupsByKey.get(k);
                            const hasPickup = pickups && pickups.length > 0;
                            const isEntry = r === ENTRY.r && c === ENTRY.c;
                            const isCrossRow = CROSS_AISLE_ROWS.has(r);

                            let cellClass = 'store-cell store-cell-aisle';
                            if (isEntry) cellClass += ' store-cell-entry';
                            else if (isCrossRow) cellClass += ' store-cell-cross-band';
                            if (onPath) cellClass += ' store-cell-path';
                            if (hasPickup && !isEntry) cellClass += ' store-cell-pickup';

                            const pickupLabel = hasPickup
                                ? pickups.map((p) => p.name).join(', ')
                                : null;

                            const laneClass = buildLaneClass({ isCrossRow, onPath, isEntry });

                            const hPassageClass = [
                                'store-cross-passage-h',
                                onPath && 'store-cross-passage-h-path',
                            ]
                                .filter(Boolean)
                                .join(' ');

                            return (
                                <div
                                    key={k}
                                    className={cellClass}
                                    style={{ gridRow: r + 1, gridColumn: c + 1 }}
                                    title={hasPickup && !isEntry ? pickupLabel : undefined}
                                    aria-label={hasPickup && !isEntry ? `${en.storeMap.pickUp}: ${pickupLabel}` : undefined}
                                    tabIndex={hasPickup && !isEntry ? 0 : undefined}
                                >
                                    {isEntry ? (
                                        <div className="store-entry-passage">
                                            <span className="store-entry-out-arrow" aria-hidden="true">
                                                ←
                                            </span>
                                            <span className="store-entry-marker">
                                                <span className="store-entry-marker-icon" aria-hidden="true">
                                                    ↓
                                                </span>
                                                <span className="store-entry-marker-text">{en.storeMap.in}</span>
                                            </span>
                                        </div>
                                    ) : isCrossRow ? (
                                        <div className="store-cross-cell-inner">
                                            <div className="store-cross-shelf-band">
                                                <ShelfSide side="l" compact />
                                                <div className={laneClass} />
                                                <ShelfSide
                                                    side="r"
                                                    compact
                                                    hasPickup={hasPickup}
                                                />
                                            </div>
                                            <div className="store-cross-passage-row">
                                                <div className="store-cross-passage-pad" aria-hidden="true" />
                                                <div className={hPassageClass}>
                                                    {c === 0 && (
                                                        <span className="store-cross-h-hint" aria-hidden="true">
                                                            ↔
                                                        </span>
                                                    )}
                                                </div>
                                                <div
                                                    className="store-cross-passage-pad store-cross-passage-pad-shelf"
                                                    aria-hidden="true"
                                                />
                                            </div>
                                            <div className="store-cross-shelf-band">
                                                <ShelfSide side="l" compact />
                                                <div className={laneClass} />
                                                <ShelfSide side="r" compact />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="store-aisle-inner">
                                            <ShelfSide side="l" />
                                            <div className={laneClass} />
                                            <ShelfSide side="r" hasPickup={hasPickup} />
                                        </div>
                                    )}
                                    {hasPickup && !isEntry && (
                                        <PickupTooltip pickups={pickups} />
                                    )}
                                </div>
                            );
                        })
                    )}

                    <svg
                        className="store-map-route-svg"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                    >
                        <polyline
                            className="store-route-line store-route-line-glow"
                            points={polylinePoints}
                            fill="none"
                        />
                        <polyline
                            className="store-route-line"
                            points={polylinePoints}
                            fill="none"
                        />
                        {polyline.length > 0 && (
                            <>
                                <circle
                                    className="store-route-dot store-route-dot-entry"
                                    cx={polyline[0].x}
                                    cy={polyline[0].y}
                                    r={2.2}
                                />
                                {polyline.length > 1 && (
                                    <circle
                                        className="store-route-dot store-route-dot-end"
                                        cx={polyline[polyline.length - 1].x}
                                        cy={polyline[polyline.length - 1].y}
                                        r={2.2}
                                    />
                                )}
                            </>
                        )}
                    </svg>
                    </div>

                    <div className="store-map-axis store-map-axis-cols" aria-hidden="true">
                        {Array.from({ length: COLS }, (_, c) => (
                            <span key={c}>{c}</span>
                        ))}
                    </div>
                    <div className="store-map-axis store-map-axis-rows" aria-hidden="true">
                        {Array.from({ length: ROWS }, (_, r) => (
                            <span
                                key={r}
                            className={CROSS_AISLE_ROWS.has(r) ? 'axis-cross' : undefined}
                            title={CROSS_AISLE_ROWS.has(r) ? en.storeMap.crossAisleTitle : undefined}
                            >
                                {r}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <p className="store-map-hint">{en.storeMap.hint}</p>
        </div>
    );
};

export default StoreMap;
