import type { GameState } from '../engine/types';
import { validateState } from '../engine/validation';
import {
  readValue,
  putValue,
  removeValue,
  setValue,
  writeVault,
  VaultIntegrityError,
} from './vault';
function stateValue(value: unknown): GameState {
  if (!validateState(value)) throw new VaultIntegrityError();
  return value;
}
export async function readAuto(): Promise<{ state: GameState | null; recovered: boolean }> {
  let damaged = false;
  for (const purpose of ['game:auto', 'game:backup']) {
    try {
      const value = await readValue<unknown>(purpose);
      if (value !== null) return { state: stateValue(value), recovered: damaged };
    } catch (error) {
      if (!(error instanceof VaultIntegrityError)) throw error;
      damaged = true;
    }
  }
  if (damaged) throw new VaultIntegrityError();
  return { state: null, recovered: false };
}
export function clearAuto(): Promise<void> {
  return writeVault(async () => {
    await removeValue('game:auto');
    await removeValue('game:backup');
  });
}
export function saveAuto(state: GameState, allowed: () => boolean = () => true): Promise<void> {
  const snapshot = stateValue(JSON.parse(JSON.stringify(state)));
  return writeVault(async () => {
    if (!allowed()) return;
    let previous: GameState | null = null;
    try {
      const raw = await readValue<unknown>('game:auto');
      if (raw !== null) previous = stateValue(raw);
    } catch (error) {
      if (!(error instanceof VaultIntegrityError)) throw error;
    }
    if (!allowed()) return;
    if (previous) await putValue('game:backup', previous);
    if (allowed()) await putValue('game:auto', snapshot);
  });
}
export function saveSlot(index: number, state: GameState): Promise<void> {
  if (!Number.isInteger(index) || index < 1 || index > 3) throw new Error('请选择一个档案位置。');
  return setValue('game:slot:' + index, stateValue(state));
}
export async function readSlot(index: number): Promise<GameState | null> {
  if (!Number.isInteger(index) || index < 1 || index > 3) throw new Error('请选择一个档案位置。');
  const value = await readValue<unknown>('game:slot:' + index);
  return value === null ? null : stateValue(value);
}
export interface Memory {
  id: string;
  number: string;
  title: string;
  seed: string;
  date: string;
}
function memoryValues(value: unknown): Memory[] {
  if (value === null) return [];
  if (
    !Array.isArray(value) ||
    value.length > 100 ||
    value.some(
      (m) =>
        !m ||
        typeof m.id !== 'string' ||
        typeof m.title !== 'string' ||
        typeof m.number !== 'string' ||
        typeof m.seed !== 'string' ||
        typeof m.date !== 'string',
    )
  )
    throw new VaultIntegrityError();
  return value as Memory[];
}
export async function memories(): Promise<Memory[]> {
  return memoryValues(await readValue<unknown>('game:memories'));
}
export function remember(memory: Memory): Promise<void> {
  return writeVault(async () => {
    const items = memoryValues(await readValue<unknown>('game:memories'));
    if (!items.some((m) => m.id === memory.id))
      await putValue('game:memories', [...items, memory].slice(-100));
  });
}
