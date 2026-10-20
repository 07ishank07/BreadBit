import { routeWire } from './routing';
import { breadboardGroupKey, isBreadboard } from '@velxio/utils/breadboardNets';
import type { VlxPayload, Endpoint } from '../../../../packages/project-core/src';
const endpointKey = (p: Pick<Endpoint, 'componentId' | 'pinName'>) => JSON.stringify([p.componentId, p.pinName]);
export interface Point {
    x: number;
    y: number;
}
export type Primitive = {
    kind: 'line'; wireId?:string;
    points: Point[];
    color?: string;
    dash?: boolean;
} | {
    kind: 'text';
    x: number;
    y: number;
    text: string;
    size?: number;
} | {
    kind: 'circle';
    x: number;
    y: number;
    r: number;
};
export interface SymbolView {
    id: string;
    kind: string;
    value?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    pins: {
        ref: Endpoint;
        point: Point;
        net: string;
    }[];
}
export interface SchematicScene {
    symbols: SymbolView[];
    drawing: Primitive[];
    width: number;
    height: number;
    warnings: string[];
    nets: string[][];
}
export interface SheetLayout {
    positions?: Record<string, Point>;
    routes?: Record<string, Point[]>;
}
export function resolveNets(doc: VlxPayload, pins: Record<string, string[]>) {
    const parent = new Map<string, string>();
    const root = (k: string): string => { if (!parent.has(k))
        parent.set(k, k); const p = parent.get(k)!; if (p === k)
        return k; const r = root(p); parent.set(k, r); return r; };
    const join = (a: string, b: string) => { const ra = root(a), rb = root(b); if (ra !== rb)
        parent.set(rb, ra); };
    const entities = [...doc.boards.map(b => ({ id: b.id, kind: b.boardKind })), ...doc.components.map(c => ({ id: c.id, kind: c.metadataId }))];
    const warnings: string[] = [];
    for (const e of entities) {
        const groups = new Map<string, string>();
        for (const pin of pins[e.id] ?? []) {
            const k = endpointKey({ componentId: e.id, pinName: pin });
            root(k);
            let group = breadboardGroupKey(e.kind, pin);
            if (e.kind === 'pushbutton' && /^[12]\.[lr]$/.test(pin))
                group = pin[0];
            if (e.kind === 'arduino-uno' && /^GND(\.\d+)?$/.test(pin))
                group = 'ground';
            if (e.kind === 'arduino-uno' && /^A[45](\.2)?$/.test(pin))
                group = pin.slice(0, 2);
            if (group) {
                if (groups.has(group))
                    join(k, groups.get(group)!);
                else
                    groups.set(group, k);
            }
        }
    }
    for (const w of doc.wires) {
        for (const p of [w.start, w.end])
            if (!pins[p.componentId]?.includes(p.pinName))
                warnings.push('Unmapped pin ' + p.componentId + ':' + p.pinName);
        join(endpointKey(w.start), endpointKey(w.end));
    }
    const groups = new Map<string, string[]>();
    for (const k of parent.keys()) {
        const r = root(k);
        groups.set(r, [...(groups.get(r) ?? []), k]);
    }
    const nets = [...groups.values()].map(n => n.sort()).sort((a, b) => a[0].localeCompare(b[0]));
    const names = new Map<string, string>();
    nets.forEach((n, i) => n.forEach(p => names.set(p, 'N' + (i + 1))));
    return { nets, names, warnings: [...new Set(warnings)] };
}
export function schematicScene(doc: VlxPayload, pins: Record<string, string[]>, layout: SheetLayout = {}): SchematicScene {
    layout = validLayout(layout);
    const graph = resolveNets(doc, pins), drawing: Primitive[] = [], warnings = [...graph.warnings];
    const entities = [...doc.boards.map(b => ({ id: b.id, kind: b.boardKind, value: '' })), ...doc.components.map(c => ({ id: c.id, kind: c.metadataId, value: String(c.properties.value ?? c.properties.resistance ?? '') }))];
    const columns = [70,70];
    const symbols: SymbolView[] = entities.map((e, i) => {
        let ids = pins[e.id] ?? [];
        if (isBreadboard(e.kind))
            ids = [...new Set(doc.wires.flatMap(w => [w.start, w.end]).filter(p => p.componentId === e.id).map(p => p.pinName))];
        if (!ids.length)
            warnings.push('No pin mapping for ' + e.id);
        const height = Math.max(100, Math.ceil(ids.length / 2) * 25 + 45);
        const column=columns[0]<=columns[1]?0:1;
        let candidateY=columns[column];
        if(Math.floor((candidateY-30)/650)!==Math.floor((candidateY+height+30)/650))candidateY=Math.ceil(candidateY/650)*650+50;
        const position=layout.positions?.[e.id]??{x:column===0?100:610,y:candidateY};
        columns[column]=candidateY+height+100;
        const symbol: SymbolView = { id: e.id, kind: e.kind, value: e.value, ...position, width: 270, height, pins: ids.map((pin, j) => { const left = j % 2 === 0; return { ref: { componentId: e.id, pinName: pin, x: 0, y: 0 }, point: { x: position.x + (left ? -25 : 295), y: position.y + 40 + Math.floor(j / 2) * 25 }, net: graph.names.get(endpointKey({ componentId: e.id, pinName: pin })) ?? '?' }; }) };
        drawing.push({ kind: 'text', x: position.x, y: position.y - 14, text: e.id + ' · ' + e.kind + (e.value ? ' · ' + e.value : ''), size: 13 });
        const x = position.x, y = position.y;
        if (e.kind === 'resistor')
            drawing.push({ kind: 'line', points: [{ x, y: y + 40 }, { x: x + 70, y: y + 40 }, ...[0, 1, 2, 3, 4, 5, 6].map(n => ({ x: x + 85 + n * 15, y: y + 40 + (n % 2 === 0 ? -12 : 12) })), { x: x + 190, y: y + 40 }, { x: x + 270, y: y + 40 }] });
        else if (e.kind === 'led') {
            drawing.push({ kind: 'line', points: [{ x, y: y + 40 }, { x: x + 110, y: y + 40 }, { x: x + 110, y: y + 20 }, { x: x + 150, y: y + 40 }, { x: x + 110, y: y + 60 }, { x: x + 110, y: y + 40 }] }, { kind: 'line', points: [{ x: x + 150, y: y + 20 }, { x: x + 150, y: y + 60 }] }, { kind: 'line', points: [{ x: x + 150, y: y + 40 }, { x: x + 270, y: y + 40 }] }, { kind: 'line', points: [{ x: x + 135, y: y + 12 }, { x: x + 150, y: y - 3 }, { x: x + 142, y: y - 1 }, { x: x + 150, y: y - 3 }, { x: x + 148, y: y + 5 }] }, { kind: 'line', points: [{ x: x + 152, y: y + 19 }, { x: x + 167, y: y + 4 }, { x: x + 159, y: y + 6 }, { x: x + 167, y: y + 4 }, { x: x + 165, y: y + 12 }] });
        }
        else if (e.kind === 'pushbutton') {
            drawing.push({ kind: 'line', points: [{ x, y: y + 65 }, { x, y: y + 40 }, { x: x + 100, y: y + 40 }, { x: x + 155, y: y + 20 }] }, { kind: 'line', points: [{ x: x + 160, y: y + 40 }, { x: x + 270, y: y + 40 }, { x: x + 270, y: y + 65 }] });
        }
        else
            drawing.push({ kind: 'line', points: [{ x, y }, { x: x + 270, y }, { x: x + 270, y: y + height }, { x, y: y + height }, { x, y }] });
        for (const p of symbol.pins) {
            const left = p.point.x < x;
            drawing.push({ kind: 'line', points: [p.point, { x: left ? x : x + 270, y: p.point.y }] }, { kind: 'circle', x: p.point.x, y: p.point.y, r: 3 }, { kind: 'text', x: left ? x + 5 : x + 205, y: p.point.y - 7, text: p.ref.pinName + ' [' + p.net + ']', size: 12 });
        }
        return symbol;
    });
    const find = (p: Endpoint) => symbols.find(s => s.id === p.componentId)?.pins.find(pin => pin.ref.pinName === p.pinName)?.point;
    const usedRoutes:Point[][]=[];
    for (const [i, w] of doc.wires.entries()) {
        const a = find(w.start), b = find(w.end);
        if (!a || !b)
            continue;
        const automatic = routeWire(a, b, symbols,usedRoutes);
        if (!automatic.length && !layout.routes?.[w.id]?.length)
            warnings.push('No clear route for ' + w.id + '; move overlapping symbols.');
        const bends = layout.routes?.[w.id]?.length ? layout.routes[w.id] : automatic.slice(1, -1);
        const points: Point[] = [a];
        for (const p of [...bends, b]) {
            const last = points.at(-1)!;
            if (last.x !== p.x && last.y !== p.y)
                points.push({ x: p.x, y: last.y });
            points.push(p);
        }
        usedRoutes.push(points);
        drawing.unshift({ kind: 'line', wireId:w.id, points, color: w.color, dash: !!w.bb });
        if (w.label) {
            const longest = points.slice(1).map((p, j) => ({ a: points[j], b: p, len: Math.abs(points[j].x - p.x) + Math.abs(points[j].y - p.y) })).sort((p, q) => q.len - p.len)[0];
            if (longest)
                drawing.push({ kind: 'text', x: longest.a.x + 6, y: (longest.a.y + longest.b.y) / 2 - 8, text: String(w.label), size: 11 });
        }
    }
    const routePoints = drawing.flatMap(d => d.kind === 'line' ? d.points : []);
    const width = Math.max(1000, ...symbols.map(s => s.x + s.width + 100), ...routePoints.map(p => p.x + 40)), height = Math.max(650, ...symbols.map(s => s.y + s.height + 80), ...routePoints.map(p => p.y + 40));
    return { symbols, drawing, width, height, warnings: [...new Set(warnings)], nets: graph.nets };
}
export function validLayout(value: unknown): SheetLayout {
    const result: SheetLayout = { positions: {}, routes: {} };
    if (!value || typeof value !== 'object')
        return result;
    const v = value as SheetLayout;
    const point = (p: unknown): p is Point => !!p && typeof p === 'object' && Number.isFinite((p as Point).x) && Number.isFinite((p as Point).y) && (p as Point).x >= 0 && (p as Point).y >= 0 && (p as Point).x <= 20000 && (p as Point).y <= 20000;
    for (const [id, p] of Object.entries(v.positions ?? {}))
        if (point(p))
            result.positions![id] = { x: p.x, y: p.y };
    for (const [id, points] of Object.entries(v.routes ?? {}))
        if (Array.isArray(points) && points.length <= 200 && points.every(point))
            result.routes![id] = points;
    return result;
}
