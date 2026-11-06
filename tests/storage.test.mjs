import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { SeriesStore } from '../web/js/storage.js';
import { createDemoSeries } from '../web/js/core.js';

test('salva, recarrega e exclui séries pelo armazenamento público sem alterar amostras', async () => {
  const indexedDB = new IDBFactory();
  const store = new SeriesStore({ indexedDB, name: 'roundtrip' });
  const a = createDemoSeries({ exercise: 'Supino', loadKg: 60 });
  const b = createDemoSeries({ exercise: 'Agachamento', loadKg: 100 });
  await store.saveMany([a, b]);
  const reloaded = new SeriesStore({ indexedDB, name: 'roundtrip' });
  assert.deepEqual((await reloaded.list()).find(s => s.metadata.id === a.metadata.id), a);
  const invalid = { ...b, schemaVersion: 99 };
  await assert.rejects(store.saveMany([{ ...a, metadata: { ...a.metadata, notes: 'alterado' } }, invalid]), /versão/);
  assert.equal((await store.list()).find(s => s.metadata.id === a.metadata.id).metadata.notes, '');
  await store.deleteMany([a.metadata.id, b.metadata.id]);
  assert.deepEqual(await store.list(), []);
});
