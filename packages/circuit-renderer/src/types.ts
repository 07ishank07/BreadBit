import type { ComponentType, CSSProperties, ReactNode } from 'react';

/** Millimetres. X = right, Y = up, Z = towards the viewer. */
export type Vec3 = readonly [number, number, number];
export type ViewPreset = 'isometric' | 'top' | 'front';
export type Quality = 'draft' | 'balanced' | 'high';
export type InteractionMode = 'inspect' | 'pan' | 'orbit' | 'move' | 'wire' | 'interact';
export interface NavigationPreferences {
  profile: 'trackpad' | 'mouse';
  twoFingerAction: 'pan' | 'zoom';
  panSensitivity: number;
  zoomSensitivity: number;
  orbitSensitivity: number;
  invertPan: boolean;
  invertZoom: boolean;
  initialView: ViewPreset;
}
/** View state only. Never include in electrical undo or project fingerprints. */
export interface CameraState { target: Vec3; position: Vec3; up: Vec3; zoom: number }
export interface ViewportFeedback {
  code: 'unavailable' | 'invalid' | 'stale' | 'rejected' | 'context-lost';
  message: string;
  entityIds: readonly string[];
  recovery: string;
}
export type ProjectRevision = number | string;
export type RendererEdit =
  | { type: 'part.move'; id: string; position: Vec3 }
  | { type: 'part.rotate'; id: string; radians: number }
  | { type: 'wire.create'; from: PinRef; to: PinRef; waypoints: readonly Vec3[] }
  | { type: 'wire.reconnect'; id: string; end: 'from' | 'to'; pin: PinRef }
  | { type: 'wire.route'; id: string; waypoints: readonly Vec3[] }
  | { type: 'wire.delete'; id: string };
/** A proposal. Host must validate revision, actual pins and semantics atomically. */
export interface RendererCommand {
  actionId: string;
  label: string;
  expectedRevision: ProjectRevision;
  edit: RendererEdit;
}
export type CommandResult = { accepted: true } | { accepted: false; feedback: ViewportFeedback };
export type InteractionState =
  | { kind: 'idle' }
  | { kind: 'wire'; source: PinRef; waypoints: readonly Vec3[]; destination?: PinRef }
  | { kind: 'reconnect'; wireId: string; end: 'from' | 'to'; destination?: PinRef }
  | { kind: 'placement'; partId: string; position: Vec3 }
  | { kind: 'route'; wireId: string; waypoints: readonly Vec3[] }
  | { kind: 'pending'; actionId: string };
export interface PickCandidate {
  key: string;
  label: string;
  distance: number;
  point: Vec3;
  target: { type: 'pin'; pin: PinRef } | { type: 'wire'; id: string };
}
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
  /** Declared by the host. A mesh anchor alone establishes no electrical capability. */
  capability?: 'visual' | 'mapped' | 'simulated';
}
export interface CircuitWire {
  id: string;
  from: PinRef;
  to: PinRef;
  color?: string;
  /** Decorative label, never an electrical net name. */
  label?: string;
  pattern?: 'solid' | 'dashed' | 'dotted';
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
export type Selection = { type: 'part' | 'wire' | 'net'; id: string } | null;
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
export interface ViewportStats {
  drawCalls: number; triangles: number; pixelRatio: number;
  /** CPU render submission time; not GPU time or full input latency. */
  renderMs?: number;
  geometries?: number; textures?: number; renderedFrames?: number;
}
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
  navigation?: Partial<NavigationPreferences>;
  initialCameraState?: CameraState;
  onCameraChange?: (state: CameraState) => void;
  reducedMotion?: boolean;
  largerTargets?: boolean;
  labelScale?: number;
  showNavigationControls?: boolean;
  /** Only dims other wires. Never alters connectivity. */
  isolateSelectedWire?: boolean;
  highlightedWireIds?: readonly string[];
  projectRevision?: ProjectRevision;
  onCommand?: (command: RendererCommand) => CommandResult | Promise<CommandResult>;
  onFeedback?: (feedback: ViewportFeedback) => void;
  onInteractionChange?: (state: InteractionState) => void;
  onPickCandidates?: (candidates: readonly PickCandidate[]) => void;
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
  getCameraState: () => CameraState | undefined;
  restoreCamera: (state: CameraState) => void;
  pan: (xPixels: number, yPixels: number) => void;
  zoom: (factor: number) => void;
  orbit: (xPixels: number, yPixels: number) => void;
  focusSelection: () => void;
  setNavigationTool: (tool: 'inspect' | 'pan' | 'orbit') => void;
  /** The same workflow as pointer picking; usable from a host keyboard pin list. */
  choosePin: (pin: PinRef) => void;
  chooseCandidate: (key: string) => void;
  addWireBend: (position: Vec3) => void;
  beginReconnect: (wireId: string, end: 'from' | 'to') => void;
  beginPlacement: (partId: string) => void;
  previewPlacement: (position: Vec3) => void;
  commitPlacement: () => void;
  beginRouteEdit: (wireId: string) => void;
  insertBend: (index: number, position: Vec3) => void;
  moveBend: (index: number, position: Vec3) => void;
  removeBend: (index: number) => void;
  moveSegment: (index: number, delta: Vec3) => void;
  commitRoute: () => void;
  deleteWire: (wireId: string) => void;
  /** Canvas-local CSS pixels, useful for host tooltips and browser integration tests. */
  projectPin: (pin: PinRef) => { x: number; y: number } | undefined;
}
