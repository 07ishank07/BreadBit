import { it, expect } from 'vitest';
import { routeWire } from './routing';
it('routes around a board instead of drawing through it', () => { const path = routeWire({ x: 75, y: 120 }, { x: 75, y: 580 }, [{ x: 100, y: 70, width: 270, height: 445 }, { x: 100, y: 540, width: 270, height: 100 }]); expect(path.length).toBeGreaterThan(1); expect(path[0]).toEqual({ x: 75, y: 120 }); expect(path.at(-1)).toEqual({ x: 75, y: 580 }); expect(path.every(p => p.x < 100)).toBe(true); });
it('finds an orthogonal detour between opposite sides of a symbol', () => { const path = routeWire({ x: 75, y: 110 }, { x: 395, y: 110 }, [{ x: 100, y: 70, width: 270, height: 100 }]); expect(path.length).toBeGreaterThan(2); for (let i = 1; i < path.length; i++)
    expect(path[i].x === path[i - 1].x || path[i].y === path[i - 1].y).toBe(true); expect(path.some(p => p.y < 40 || p.y > 180)).toBe(true); });
