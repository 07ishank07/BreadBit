import { invoke } from '@tauri-apps/api/core';
import { nativeAvailable } from '../../integrations/native';
import { CloudError, type Account, type Pairing, type CloudTransport } from '../../../../../packages/cloud-projects/src/protocol';

let previewToken: string | undefined;
export type PublicPairing = Omit<Pairing, 'deviceCode'>;
export const cloudConfigured = nativeAvailable || !!import.meta.env.VITE_BREADBIT_CLOUD_URL;
function previewOrigin() {
  const url = new URL(import.meta.env.VITE_BREADBIT_CLOUD_URL || 'https://unconfigured.invalid');
  if (url.protocol !== 'https:' && !(import.meta.env.DEV && url.protocol === 'http:' && ['127.0.0.1','localhost'].includes(url.hostname))) throw new Error('Cloud service requires HTTPS.');
  return url.origin;
}
export const transport: CloudTransport = {
  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response: { status: number; body: unknown };
    if (nativeAvailable) response = await invoke('cloud_request', { method, path, body: body ?? null });
    else {
      const fetched = await fetch(`${previewOrigin()}${path}`, { method, credentials: 'omit', redirect: 'error',
        headers: { 'Content-Type': 'application/json', ...(previewToken ? { Authorization: `Bearer ${previewToken}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
      response = { status: fetched.status, body: await fetched.json() };
    }
    const value = response.body as { error?: string; remote?: never };
    if (response.status < 200 || response.status >= 300) throw new CloudError(response.status, value.error || 'Cloud request failed.', value.remote);
    return response.body as T;
  },
};
export async function beginLogin(): Promise<PublicPairing> {
  if (nativeAvailable) return invoke('cloud_begin_login');
  const pairing = await transport.request<Pairing>('POST', '/v1/pair', {});
  if (!/^[a-f0-9]{64}$/.test(pairing.deviceCode) || !/^[a-f0-9]{64}$/.test(pairing.userCode) || !Number.isFinite(pairing.expiresAt) || new URL(pairing.verificationUrl).origin !== previewOrigin()) throw new Error('Invalid sign in response.');
  previewToken = pairing.deviceCode;
  const { deviceCode: _, ...safe } = pairing; return safe;
}
export const pollLogin = () => transport.request<Account>('GET', '/v1/me');
export async function openCloudPage(page: 'connect' | 'share', code: string) {
  if (!/^[a-f0-9]{64}$/.test(code)) throw new Error('Invalid viewing code.');
  if (nativeAvailable) return invoke<void>('cloud_open_browser', { page, code });
  window.open(`${previewOrigin()}${page === 'connect' ? `/connect?code=${code}` : `/share/${code}`}`, '_blank', 'noopener,noreferrer');
}
export async function signOut() {
  try { await transport.request('DELETE', '/v1/session'); }
  finally { previewToken = undefined; if (nativeAvailable) await invoke('cloud_forget_session'); }
}
