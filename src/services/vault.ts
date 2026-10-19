const encoder = new TextEncoder(),
  decoder = new TextDecoder();
const keyNames = new Map<string, Promise<string>>();
let autoName = '',
  keyPromise: Promise<VaultKeys> | undefined,
  writeTail: Promise<unknown> = Promise.resolve();
interface VaultKeys {
  encryption: CryptoKey;
  names: CryptoKey;
}
export class VaultIntegrityError extends Error {
  constructor() {
    super('存档内容已损坏或被改动，无法读取。');
    this.name = 'VaultIntegrityError';
  }
}
function base64(bytes: Uint8Array) {
  let value = '';
  for (let i = 0; i < bytes.length; i += 16384)
    value += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
function bytes(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new VaultIntegrityError();
  const raw = atob(value.replaceAll('-', '+').replaceAll('_', '/'));
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}
function validKeys(value: unknown): value is VaultKeys {
  const keys = value as Partial<VaultKeys> | null;
  return (
    !!keys &&
    keys.encryption instanceof CryptoKey &&
    keys.names instanceof CryptoKey &&
    !keys.encryption.extractable &&
    !keys.names.extractable &&
    keys.encryption.algorithm.name === 'AES-GCM' &&
    keys.names.algorithm.name === 'HMAC'
  );
}
async function loadKeys(): Promise<VaultKeys> {
  if (!globalThis.crypto?.subtle || !globalThis.indexedDB)
    throw new Error('当前浏览器无法使用加密存档，请开启站点存储权限。');
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    let timedOut = false;
    const request = indexedDB.open('by-source-storage-v4', 1),
      timer = setTimeout(() => {
        timedOut = true;
        reject(new Error('浏览器存储暂时无法使用，请关闭其他游戏页面后重试。'));
      }, 6000);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('keys'))
        request.result.createObjectStore('keys');
    };
    request.onerror = () => {
      clearTimeout(timer);
      reject(new Error('无法打开加密存储，请开启站点存储权限。'));
    };
    request.onsuccess = () => {
      clearTimeout(timer);
      if (timedOut) request.result.close();
      else resolve(request.result);
    };
  });
  try {
    const existing = await new Promise<unknown>((resolve, reject) => {
      const request = db.transaction('keys', 'readonly').objectStore('keys').get('device');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    let chosen: VaultKeys;
    if (existing !== undefined) {
      if (!validKeys(existing)) throw new VaultIntegrityError();
      chosen = existing;
    } else {
      const [encryption, names] = await Promise.all([
        crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']),
        crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
      ]);
      const generated: VaultKeys = { encryption, names };
      chosen = await new Promise<VaultKeys>((resolve, reject) => {
        const transaction = db.transaction('keys', 'readwrite'),
          store = transaction.objectStore('keys'),
          request = store.get('device');
        let result: VaultKeys | undefined;
        request.onsuccess = () => {
          if (request.result === undefined) {
            result = generated;
            store.add(generated, 'device');
          } else if (validKeys(request.result)) result = request.result;
          else transaction.abort();
        };
        transaction.oncomplete = () =>
          result ? resolve(result) : reject(new VaultIntegrityError());
        transaction.onerror = () => reject(transaction.error ?? new Error('加密密钥保存失败。'));
        transaction.onabort = () => reject(new Error('加密密钥保存失败，请重试。'));
      });
    }
    return chosen;
  } finally {
    db.close();
  }
}
export function prepareVault(): Promise<VaultKeys> {
  if (!keyPromise)
    keyPromise = loadKeys().catch((error) => {
      keyPromise = undefined;
      throw error;
    });
  return keyPromise;
}
async function nameFor(purpose: string): Promise<string> {
  let result = keyNames.get(purpose);
  if (!result) {
    result = (async () => {
      const keys = await prepareVault(),
        mac = await crypto.subtle.sign(
          'HMAC',
          keys.names,
          encoder.encode('by-source-v4/name/' + purpose),
        );
      const name = 'bs4.' + base64(new Uint8Array(mac).slice(0, 16));
      if (purpose === 'game:auto') autoName = name;
      return name;
    })();
    keyNames.set(purpose, result);
    result.catch(() => keyNames.delete(purpose));
  }
  return result;
}
function context(purpose: string) {
  return encoder.encode(location.origin + '/BaoYan/source/storage/v4/' + purpose);
}
export async function sealValue(purpose: string, value: unknown): Promise<string> {
  const plain = JSON.stringify(value);
  if (plain === undefined || plain.length > 4_000_000)
    throw new Error('这份存档内容过多，保存未完成。');
  const keys = await prepareVault(),
    iv = crypto.getRandomValues(new Uint8Array(12)),
    cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: context(purpose), tagLength: 128 },
      keys.encryption,
      encoder.encode(plain),
    );
  const packed = new Uint8Array(13 + cipher.byteLength);
  packed[0] = 4;
  packed.set(iv, 1);
  packed.set(new Uint8Array(cipher), 13);
  return base64(packed);
}
export async function openValue<T>(purpose: string, raw: string): Promise<T> {
  if (raw.length > 6_000_000 || raw.length < 40) throw new VaultIntegrityError();
  const keys = await prepareVault();
  try {
    const packed = bytes(raw);
    if (packed[0] !== 4 || packed.length < 29) throw new Error();
    const plain = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: packed.slice(1, 13),
        additionalData: context(purpose),
        tagLength: 128,
      },
      keys.encryption,
      packed.slice(13),
    );
    return JSON.parse(decoder.decode(plain)) as T;
  } catch {
    throw new VaultIntegrityError();
  }
}
export async function readValue<T>(purpose: string): Promise<T | null> {
  const name = await nameFor(purpose),
    raw = localStorage.getItem(name);
  return raw === null ? null : openValue<T>(purpose, raw);
}
export async function putValue(purpose: string, value: unknown): Promise<void> {
  const name = await nameFor(purpose),
    sealed = await sealValue(purpose, value);
  localStorage.setItem(name, sealed);
}
export async function removeValue(purpose: string): Promise<void> {
  localStorage.removeItem(await nameFor(purpose));
}
export function writeVault<T>(work: () => Promise<T>): Promise<T> {
  const next = writeTail.then(async () =>
    navigator.locks
      ? await navigator.locks.request('by-source-storage-v4-write', work)
      : await work(),
  );
  writeTail = next.catch(() => undefined);
  return next;
}
export function setValue(purpose: string, value: unknown): Promise<void> {
  const copy = JSON.parse(JSON.stringify(value)) as unknown;
  return writeVault(() => putValue(purpose, copy));
}
export function isAutoStorageKey(key: string | null): boolean {
  return key === null || (!!autoName && key === autoName);
}
