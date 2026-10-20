import type { VlxPayload } from '../../../../packages/project-core/src';
export function buildKey(doc: VlxPayload, boardId: string) {
    const b = doc.boards.find(b => b.id === boardId);
    if (!b)
        throw new Error('Select a board first');
    return JSON.stringify({ boardId, kind: b.boardKind, language: b.languageMode, options: b.boardOptions, libraries: b.libraries, spiffs: b.spiffsFiles, files: doc.fileGroups[b.activeFileGroupId], customChips: doc.components.filter(c => c.metadataId.includes('chip')).map(c => c.properties) });
}
export interface BuiltArtifact {
    key: string;
    program: string;
    projectId: string;
}
export function isCurrent(artifact: BuiltArtifact | undefined, projectId: string, doc: VlxPayload, id: string, program: string | null | undefined) { return !!artifact && artifact.projectId === projectId && artifact.key === buildKey(doc, id) && artifact.program === program; }
