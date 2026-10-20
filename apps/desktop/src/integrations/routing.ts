import type { Point } from './schematic';
interface Obstacle {
    x: number;
    y: number;
    width: number;
    height: number;
}
/** Orthogonal visibility grid around symbol bodies; crossings do not imply junctions. */
export function routeWire(start: Point, end: Point, obstacles: Obstacle[], used:Point[][]=[]): Point[] {
    const originalStart=start,originalEnd=end;
    const exit=(p:Point)=>{const owner=obstacles.find(b=>p.y>=b.y&&p.y<=b.y+b.height&&(p.x===b.x-25||p.x===b.x+b.width+25));return owner?{x:p.x<owner.x?owner.x-50:owner.x+owner.width+50,y:p.y}:p;};
    start=exit(start);end=exit(end);
    const boxes = obstacles.map(b => ({ l: b.x - 35, r: b.x + b.width + 35, t: b.y - 30, b: b.y + b.height + 10 }));
    const occupied=used.flatMap(path=>path.slice(1).map((b,i)=>({a:path[i],b})));
    const extra=used.flat().slice(-120);
    const xs = [...new Set([start.x, end.x, 20, ...extra.flatMap(p=>[Math.max(10,p.x-6),p.x+6]), ...boxes.flatMap(b => [Math.max(10, b.l - 12), b.r + 12])])].sort((a, b) => a - b);
    const ys = [...new Set([start.y, end.y, 20, ...extra.flatMap(p=>[Math.max(10,p.y-6),p.y+6]), ...boxes.flatMap(b => [Math.max(10, b.t - 12), b.b + 12])])].sort((a, b) => a - b);
    const node = (x: number, y: number) => y * xs.length + x, from = node(xs.indexOf(start.x), ys.indexOf(start.y)), to = node(xs.indexOf(end.x), ys.indexOf(end.y));
    const point = (n: number) => ({ x: xs[n % xs.length], y: ys[Math.floor(n / xs.length)] });
    const clear = (a: Point, b: Point) => !boxes.some(r => a.x === b.x ? a.x > r.l && a.x < r.r && Math.max(a.y, b.y) > r.t && Math.min(a.y, b.y) < r.b : a.y > r.t && a.y < r.b && Math.max(a.x, b.x) > r.l && Math.min(a.x, b.x) < r.r);
    const cost = new Map<number, number>([[from, 0]]), previous = new Map<number, number>(), open = [from], done = new Set<number>();
    while (open.length) {
        open.sort((a, b) => { const p = point(a), q = point(b); return cost.get(a)! + Math.abs(p.x - end.x) + Math.abs(p.y - end.y) - cost.get(b)! - Math.abs(q.x - end.x) - Math.abs(q.y - end.y); });
        const current = open.shift()!;
        if (current === to) {
            const path: Point[] = [];
            let n = current;
            while (n !== from) {
                path.push(point(n));
                n = previous.get(n)!;
            }
            path.push(start);
            path.reverse();
            path.unshift(originalStart);path.push(originalEnd);
            return path.filter((p, i) => i === 0 || i === path.length - 1 || !(path[i - 1].x === p.x && path[i + 1].x === p.x || path[i - 1].y === p.y && path[i + 1].y === p.y));
        }
        if (done.has(current))
            continue;
        done.add(current);
        const x = current % xs.length, y = Math.floor(current / xs.length), a = point(current);
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
            if (nx < 0 || nx >= xs.length || ny < 0 || ny >= ys.length)
                continue;
            const next = node(nx, ny), b = point(next);
            if (done.has(next) || !clear(a, b))
                continue;
            const overlaps=occupied.some(s=>a.x===b.x&&s.a.x===s.b.x&&a.x===s.a.x&&Math.min(Math.max(a.y,b.y),Math.max(s.a.y,s.b.y))>Math.max(Math.min(a.y,b.y),Math.min(s.a.y,s.b.y))||a.y===b.y&&s.a.y===s.b.y&&a.y===s.a.y&&Math.min(Math.max(a.x,b.x),Math.max(s.a.x,s.b.x))>Math.max(Math.min(a.x,b.x),Math.min(s.a.x,s.b.x)));
            const distance = cost.get(current)! + Math.abs(a.x - b.x) + Math.abs(a.y - b.y)+(overlaps?10000:0);
            if (distance < (cost.get(next) ?? Infinity)) {
                cost.set(next, distance);
                previous.set(next, current);
                if (!open.includes(next))
                    open.push(next);
            }
        }
    }
    return [];
}
