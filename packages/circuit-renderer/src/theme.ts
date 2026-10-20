import type { Quality, ViewportTheme } from './types';
export const graphiteTheme: ViewportTheme = {
  background: '#161e21', surface: '#202b30', grid: '#34434a', accent: '#9cf2c8', foreground: '#e8f1ed',
};
export const porcelainTheme: ViewportTheme = {
  background: '#dfe7e4', surface: '#e8eeeb', grid: '#b8c8c3', accent: '#08795e', foreground: '#20382f',
};
export const qualityProfiles: Record<Quality, { dpr: [number, number]; shadowSize: number; segments: number }> = {
  draft: { dpr: [1, 1], shadowSize: 1024, segments: 32 },
  balanced: { dpr: [1, 2], shadowSize: 2048, segments: 56 },
  high: { dpr: [2, 3], shadowSize: 4096, segments: 80 },
};
