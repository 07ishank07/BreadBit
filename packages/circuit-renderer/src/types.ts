import type { ComponentType, CSSProperties, ReactNode } from 'react';

/** Millimetres. X = right, Y = up, Z = towards the viewer. */
export type Vec3 = readonly [number, number, number];
export type ViewPreset = 'isometric' | 'top' | 'front';
export type Quality = 'draft' | 'balanced' | 'high';
export type InteractionMode = 'inspect' | 'move' | 'wire' | 'interact';
export type BuiltinKind = 'arduino-uno' | 'breadboard' | 'led' | 'resistor' | 'pushbutton' | 'potentiometer' | 'servo' | 'oled';

export interface CircuitPart {
  id: string;
  kind: string;
  label?: string;
  /** Local origin is at the centre of the component's footprint, on its bottom face. */
  position: Vec3;
  /** Radians around the vertical Y axis. */
  rotation?: number;
  properties?: Readonly<Record<string, unknown>>;
  locked?: boolean;
}
export interface PinRef { partId: string; pinId: string }
export interface PinDefinition {
  id: string;
  label?: string;
  position: Vec3;
  role?: 'power' | 'ground' | 'signal';
}
export interface CircuitWire {
  id: string;
  from: PinRef;
  to: PinRef;
  color?: string;
  /** Optional intermediate world positions in millimetres. Ends always follow their pins. */
  waypoints?: readonly Vec3[];
  /** Height of the automatic cable arch, in millimetres above the higher endpoint. */
  lift?: number;
}
export interface CircuitDocument {
  parts: readonly CircuitPart[];
  wires: readonly CircuitWire[];
}
/** Display values only. The host owns simulation, timing, validity and electrical units. */
export interface PartVisualState {
  brightness?: number;
  pressed?: boolean;
  value?: number;
  angle?: number;
  displayLines?: readonly string[];
  fault?: boolean;
}
export interface SimulationSnapshot {
  parts?: Readonly<Record<string, PartVisualState>>;
  pins?: Readonly<Record<string, { voltage?: number; high?: boolean }>>;
  /** Highlighted by the host; the renderer does not infer current from topology. */
  activeWireIds?: readonly string[];
}
export type Selection = { type: 'part' | 'wire'; id: string } | null;
export interface ComponentModelProps { part: CircuitPart; state: PartVisualState; selected: boolean }
export interface ComponentDefinition {
  kind: string;
  label: string;
  /** Conservative X/Y/Z bounds in millimetres. Used for camera framing and selection. */
  size: Vec3;
  pins: readonly PinDefinition[];
  Model: ComponentType<ComponentModelProps>;
  /** Optional standard input; arbitrary inputs can use their own host controls. */
  input?: 'momentary' | 'analogue';
}
export type ComponentRegistry = Readonly<Record<string, ComponentDefinition>>;
export interface InteractionChange { partId: string; property: 'pressed' | 'value'; value: boolean | number }
export interface ViewportTheme {
  background: string;
  surface: string;
  grid: string;
  accent: string;
  foreground: string;
}
export interface ViewportStats { drawCalls: number; triangles: number; pixelRatio: number }
export interface CircuitViewportProps {
  circuit: CircuitDocument;
  snapshot?: SimulationSnapshot;
  /** User definitions override builtins by kind; omitted builtins remain available. */
  registry?: ComponentRegistry;
  selection?: Selection;
  mode?: InteractionMode;
  quality?: Quality;
  theme?: Partial<ViewportTheme>;
  showGrid?: boolean;
  showLabels?: boolean;
  /** Move snapping in millimetres. Default 2.54; zero disables snapping. */
  snap?: number;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  fallback?: ReactNode;
  onSelect?: (selection: Selection) => void;
  /** Commit only. Drag preview is local, so the host can record one undo operation. */
  onPartMove?: (id: string, position: Vec3) => void;
  onPartRotate?: (id: string, radians: number) => void;
  onWireCreate?: (from: PinRef, to: PinRef) => void;
  /** Button down/up are both emitted. A lost capture or unmount releases the button. */
  onInputChange?: (change: InteractionChange) => void;
  onPinHover?: (pin: PinRef | null) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
  /** Invoked on rendered frames only; avoid storing every sample in host React state. */
  onStats?: (stats: ViewportStats) => void;
}
export interface CircuitViewportHandle {
  setView: (view: ViewPreset) => void;
  fit: () => void;
  /** Captures the WebGL scene only; maximum pixel ratio 3. No external assets are required. */
  capture: (pixelRatio?: number) => string | undefined;
  cancelInteraction: () => void;
  /** Canvas-local CSS pixels, useful for host tooltips and browser integration tests. */
  projectPin: (pin: PinRef) => { x: number; y: number } | undefined;
}
