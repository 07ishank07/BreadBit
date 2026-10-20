export function shortcut(key: string, ctrl: boolean, meta: boolean, shift: boolean, editing: boolean) {
  if (!ctrl && !meta) return null;
  key = key.toLowerCase();
  if (key === 's') return shift ? 'saveAs' : 'save';
  if (key === 'o') return 'open';
  if (editing) return null;
  if (key === 'z') return shift ? 'redo' : 'undo';
  if (key === 'y' && !shift) return 'redo';
  return null;
}
