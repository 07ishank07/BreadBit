import { useState } from 'react';
import { useSimulatorStore } from '@velxio/store/useSimulatorStore';
import { collectSketchFilesForBoard, compileOptionsForBoard } from '@velxio/utils/boardCompile';
import { compileCode } from '@velxio/services/compilation';
import { fqbnForLanguage } from '@velxio/types/board';
import { buildKey, isCurrent, type BuiltArtifact } from '../integrations/buildState';
import type { ProjectController } from '../integrations/project';
export function BuildControls({ controller, notify }: {
    controller: ProjectController;
    notify: (s: string) => void;
}) {
    const boards = useSimulatorStore(s => s.boards), active = useSimulatorStore(s => s.activeBoardId);
    const board = boards.find(b => b.id === active);
    const [built, setBuilt] = useState<Record<string, BuiltArtifact>>({}), [busy, setBusy] = useState(false);
    const doc = controller.project, ready = board && isCurrent(built[board.id], doc.id, doc.document, board.id, board.compiledProgram);
    const enabled = import.meta.env.VITE_BREADBIT_DEV_BACKEND === '1';
    const reason = !enabled ? 'Compiler is not connected. Start the local backend and enable VITE_BREADBIT_DEV_BACKEND.' : !board ? 'Select a board.' : board.boardKind !== 'arduino-uno' ? 'This Build workflow currently supports Arduino Uno.' : '';
    async function build() {
        if (reason || !board || busy)
            return;
        controller.flush();
        const before = controller.project, key = buildKey(before.document, board.id);
        setBusy(true);
        setBuilt(old => { const next = { ...old }; delete next[board.id]; return next; });
        notify('Building firmware…');
        try {
            const result = await compileCode(collectSketchFilesForBoard(board), fqbnForLanguage(board.boardKind, board.languageMode) ?? undefined, undefined, undefined, compileOptionsForBoard(board));
            controller.flush();
            if (controller.project.id !== before.id || buildKey(controller.project.document, board.id) !== key)
                throw new Error('Sources changed during Build. Build again before Run.');
            const program = result.hex_content ?? result.binary_content;
            if (!result.success || !program)
                throw new Error(result.stderr || result.error || 'Build produced no firmware.');
            useSimulatorStore.getState().compileBoardProgram(board.id, program);
            setBuilt(old => ({ ...old, [board.id]: { key, program, projectId: before.id } }));
            notify('Build succeeded. Run is now available; circuit behavior has not yet been verified.');
        }
        catch (e) {
            notify(String(e));
        }
        finally {
            setBusy(false);
        }
    }
    function run() { controller.flush(); const s = useSimulatorStore.getState(), b = s.boards.find(b => b.id === active), p = controller.project; if (!b || !isCurrent(built[b.id], p.id, p.document, b.id, b.compiledProgram)) {
        notify('Build the current firmware before Run.');
        return;
    } s.startBoard(b.id); notify('Simulation started.'); }
    return <div className="bb-build"><button disabled={!!reason || busy} title={reason || 'Compile current firmware'} onClick={() => void build()}>{busy ? 'Building…' : 'Build'}</button><button disabled={!ready || busy || board?.running} onClick={run}>Run</button><button disabled={!boards.some(b => b.running)} onClick={() => { const s = useSimulatorStore.getState(); for (const b of s.boards)
        if (b.running)
            s.stopBoard(b.id); }}>Stop</button><button onClick={() => useSimulatorStore.getState().toggleSerialMonitor()}>Serial</button><span>{reason || (!ready ? 'Build required' : board?.running ? 'Running' : 'Ready to run')}</span></div>;
}
