import type { Account } from '../../../../../packages/cloud-projects/src/protocol';
import type { Draft, DraftStore } from '../../../../../packages/cloud-projects/src/sync';

let database: Promise<IDBDatabase> | undefined;
function open() {
  return database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('breadbit-cloud-v1', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('drafts', { keyPath: ['owner', 'project.id'] });
      request.result.createObjectStore('account');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(new Error('Local project storage is unavailable.')); };
    request.onblocked = () => reject(new Error('Close other BreadBit windows to open project storage.'));
  });
}
async function operation<T>(store: string, mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, mode); const request = work(transaction.objectStore(store));
    transaction.oncomplete = () => resolve(request.result as T);
    transaction.onerror = transaction.onabort = () => reject(new Error('Local save failed. Keep this window open and export your project.'));
  });
}
export const drafts: DraftStore = {
  get: (owner, id) => operation('drafts', 'readonly', store => store.get([owner, id])),
  put: draft => operation('drafts', 'readwrite', store => store.put(draft)),
  list: async owner => (await operation<Draft[]>('drafts', 'readonly', store => store.getAll())).filter(d => d.owner === owner),
};
// Identity is a local workspace preference, not a credential or proof of login.
// Tokens live only in the native process (or preview memory) and never in IndexedDB.
export const rememberedAccount = () => operation<Account | undefined>('account', 'readonly', store => store.get('last'));
export const rememberAccount = (account: Account | null) => operation<void>('account', 'readwrite', store => account ? store.put(account, 'last') : store.delete('last'));
