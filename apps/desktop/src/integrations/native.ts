import { invoke, isTauri } from '@tauri-apps/api/core';
export interface NativeDocument { handle: string; path: string; content: string; revision: string }
export const nativeAvailable = isTauri();
export const openNative = () => invoke<NativeDocument | null>('open_project');
export const saveNativeAs = (content: string) => invoke<NativeDocument | null>('save_project_as', { content });
export const saveNative = (file: NativeDocument, content: string) => invoke<NativeDocument>('save_project', { handle: file.handle, content, expectedRevision: file.revision });
export const runtimeStatus = () => invoke<{ backend: { state: string; message: string } }>('runtime_status');
