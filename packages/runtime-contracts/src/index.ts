/** Runtime DTOs intentionally carry identities, never a second project document. */
export interface ProjectIdentity { projectId: string; revision: number }
export interface FirmwareArtifact extends ProjectIdentity {
  artifactId: string;
  artifactHash: string;
  sourceHash: string;
  boardId: string;
  boardKind: string;
  compilerVersion: string;
  toolchainDigest: string;
  format: 'hex' | 'elf' | 'bin' | 'uf2';
}
export interface EngineCapability {
  engineId: string;
  engineVersion: string;
  boardKind: string;
  availability: 'available' | 'unavailable' | 'unqualified';
  reason?: string;
  liveInputs: readonly string[];
  hotParameters: readonly string[];
  supportsPause: boolean;
  supportsTrace: boolean;
}
export interface SimulationSession extends ProjectIdentity {
  runId: string;
  boardId: string;
  boardKind: string;
  artifactHash: string;
  engineId: string;
  engineVersion: string;
  status: 'starting' | 'running' | 'paused' | 'stopped' | 'failed';
  simulatedMicroseconds: number;
}
export type RuntimeChange =
  | { kind: 'view' }
  | { kind: 'input'; input: string }
  | { kind: 'parameter'; parameter: string }
  | { kind: 'topology' }
  | { kind: 'firmware' }
  | { kind: 'board' }
  | { kind: 'toolchain' };
export type UpdatePolicy = 'visual-only' | 'live' | 'restart' | 'recompile' | 'unsupported';

/** Conservative by default. Capability flags must come from a qualified adapter. */
export function updatePolicy(change: RuntimeChange, engine: EngineCapability): UpdatePolicy {
  if (change.kind === 'view') return 'visual-only';
  if (engine.availability !== 'available') return 'unsupported';
  switch (change.kind) {
    case 'firmware': case 'board': case 'toolchain': return 'recompile';
    case 'topology': return 'restart';
    case 'input': return engine.liveInputs.includes(change.input) ? 'live' : 'unsupported';
    case 'parameter': return engine.hotParameters.includes(change.parameter) ? 'live' : 'restart';
  }
}

export type RuntimeResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: 'unavailable' | 'unsupported' | 'stale' | 'invalid' | 'failed'; message: string };

/** A compiled artifact alone is never evidence that firmware ran successfully. */
export function sessionMatchesArtifact(session: SimulationSession, artifact: FirmwareArtifact): boolean {
  return session.projectId === artifact.projectId && session.revision === artifact.revision
    && session.boardId === artifact.boardId && session.boardKind === artifact.boardKind
    && session.artifactHash === artifact.artifactHash;
}

export interface RuntimeAdapter {
  capabilities(): readonly EngineCapability[];
  start(artifact: FirmwareArtifact): Promise<RuntimeResult<SimulationSession>>;
  stop(runId: string): Promise<RuntimeResult<void>>;
  setInput(runId: string, input: string, value: number | boolean): Promise<RuntimeResult<void>>;
}
