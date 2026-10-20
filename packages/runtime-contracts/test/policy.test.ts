import { describe, expect, it } from 'vitest';
import { updatePolicy, sessionMatchesArtifact, type EngineCapability, type FirmwareArtifact, type SimulationSession } from '../src/index';
const engine: EngineCapability = { engineId: 'test-engine', engineVersion: '1', boardKind: 'uno', availability: 'available', liveInputs: ['button'], hotParameters: [], supportsPause: true, supportsTrace: false };
describe('runtime changes', () => {
  it('does not reset runtime for view changes, even before engine qualification', () => {
    expect(updatePolicy({ kind: 'view' }, { ...engine, availability: 'unqualified' })).toBe('visual-only');
  });
  it('distinguishes actual supported inputs, topology and firmware', () => {
    expect(updatePolicy({ kind: 'input', input: 'button' }, engine)).toBe('live');
    expect(updatePolicy({ kind: 'input', input: 'invented' }, engine)).toBe('unsupported');
    expect(updatePolicy({ kind: 'topology' }, engine)).toBe('restart');
    expect(updatePolicy({ kind: 'firmware' }, engine)).toBe('recompile');
    expect(updatePolicy({ kind: 'parameter', parameter: 'resistance' }, engine)).toBe('restart');
    expect(updatePolicy({ kind: 'topology' }, { ...engine, availability: 'unavailable' })).toBe('unsupported');
  });
  it('rejects stale artifacts and artifacts belonging to another board', () => {
    const artifact: FirmwareArtifact = { projectId: 'p', revision: 2, artifactId: 'a', artifactHash: 'sha256:a', sourceHash: 'sha256:s', boardId: 'b', boardKind: 'uno', compilerVersion: '1', toolchainDigest: 't', format: 'hex' };
    const session: SimulationSession = { projectId: 'p', revision: 2, runId: 'r', boardId: 'b', boardKind: 'uno', artifactHash: 'sha256:a', engineId: 'e', engineVersion: '1', status: 'running', simulatedMicroseconds: 0 };
    expect(sessionMatchesArtifact(session, artifact)).toBe(true);
    expect(sessionMatchesArtifact({ ...session, revision: 1 }, artifact)).toBe(false);
    expect(sessionMatchesArtifact({ ...session, boardId: 'other' }, artifact)).toBe(false);
    expect(sessionMatchesArtifact({ ...session, artifactHash: 'sha256:new' }, artifact)).toBe(false);
  });
});
