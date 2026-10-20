/** Portable schematic adapter contracts. The desktop host implements its initial projection and editor. */
export interface SchematicPinRef {
  componentId: string; // Stable board/component ID from the project document.
  pinName: string; // Stable electrical pin identifier, never a screen coordinate.
}
export interface SchematicSymbol {
  id: string;
  componentId: string;
  symbolDefinitionId: string;
  unit?: string; // Multiple symbol units may represent one physical component.
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  pins: Record<string, SchematicPinRef>; // Symbol pin ID -> electrical identity.
}
export interface SchematicProjection {
  format: 'breadbit-schematic';
  version: 1;
  projectId: string;
  basedOnRevision: number;
  symbols: SchematicSymbol[];
  nets: { id: string; label?: string; pins: SchematicPinRef[] }[];
}
/** Presentation-only edits must not silently alter connectivity. */
export type SchematicIntent =
  | { kind: 'move-symbol'; symbolId: string; x: number; y: number }
  | { kind: 'connect'; from: SchematicPinRef; to: SchematicPinRef }
  | { kind: 'disconnect'; from: SchematicPinRef; to: SchematicPinRef };
/** Electrical intent does not uniquely determine breadboard hole/wire placement. */
export type PhysicalRealizationProposal = {
  projectId: string;
  expectedRevision: number;
  intent: SchematicIntent;
} & (
  | { status: 'requires-choice'; reason: string; candidates: { id: string; description: string }[] }
  | { status: 'unsupported'; reason: string }
  | { status: 'resolved'; candidateId: string; explanation: string }
);
