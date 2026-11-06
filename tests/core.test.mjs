import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../web/js/core.js';

test('decodifica a amostra BLE conhecida, respeitando offset e unidades do protocolo', () => {
  const buffer = new ArrayBuffer(23);
  const view = new DataView(buffer, 2, 19);
  view.setUint8(0, 1);
  view.setUint16(1, 65535, true);
  view.setUint32(3, 10000, true);
  [256, -512, 2511, 2048, -4096, 0].forEach((v, i) => view.setInt16(7 + i * 2, v, true));
  assert.deepEqual(core.decodePacket(view), [65535, 10000, 1, -2, 9.80859375, 1, -2, 0]);
  assert.throws(() => core.decodePacket(new DataView(new ArrayBuffer(18))), /19 bytes/);
  view.setUint8(0, 2);
  assert.throws(() => core.decodePacket(view), /Tipo/);
});

test('CSV preserva metadados com aspas, quebras de linha e várias séries, inclusive série vazia', () => {
  const first = core.createSeries({ exercise: 'Remada, livre', loadKg: 42.5, notes: 'Linha "um"\r\nLinha dois' });
  first.metadata.athlete = { name: 'Pessoa A', setup: 'Montagem 1' };
  core.appendSample(first, [0, 0, 0.00000001, -12.3456789, 9.81, 1.2, 0, 0]);
  core.finishSeries(first);
  const empty = core.finishSeries(core.createSeries({ exercise: 'Supino', loadKg: 0 }));
  assert.deepEqual(core.parseCSV('\uFEFF' + core.serializeCSV([first, empty])), [first, empty]);
  assert.throws(() => core.parseCSV('id,seq\na,1'), /colunas/);
  assert.throws(() => core.parseCSV(core.serializeCSV([first]).replace('1e-8', 'NaN')), /Amostra/);
  assert.throws(() => core.parseCSV('"campo aberto'), /CSV/);
});

test('duração usa a extensão do relógio de aquisição mesmo com chegada fora de ordem', () => {
  const series = core.createSeries({ exercise: 'Supino', loadKg: 60 });
  for (const [seq, time] of [[0, 0], [2, 20000], [1, 10000]]) core.appendSample(series, [seq, time, 0, 0, 9.81, 0, 0, 0]);
  assert.equal(core.seriesDurationSeconds(series), 0.02);
  assert.deepEqual(series.samples.map(sample => sample[1]), [0, 20000, 10000]);
});

test('JSON restaura uma ou várias séries e recusa arquivos inválidos sem confiar em métricas externas', () => {
  const series = core.createSeries({ exercise: 'Supino', loadKg: 0, notes: 'Vírgula, aspas " e\nlinha' });
  core.appendSample(series, [12, 35000, 0.01, -0.02, 9.81, 0, 1.25, 0]);
  core.finishSeries(series);
  assert.deepEqual(core.parseJSON(core.serializeJSON([series, { ...series, metadata: { ...series.metadata, id: 'outra' } }]))[0], series);
  assert.deepEqual(core.parseJSON(JSON.stringify(series)), [series]);
  const forged = structuredClone(series);
  forged.derived = { validated: true, oneRmKg: 200 };
  assert.equal(core.parseJSON(JSON.stringify(forged))[0].derived.oneRmKg, null);
  assert.throws(() => core.parseJSON('{'), /JSON/);
  assert.throws(() => core.parseJSON(JSON.stringify({ ...series, schemaVersion: 9 })), /versão/);
  assert.throws(() => core.parseJSON(JSON.stringify({ ...series, samples: [[1, 0, null, 0, 0, 0, 0, 0]] })), /Amostra/);
});

test('preserva os sinais e quantifica lacunas, duplicatas e desordem sem perda fictícia na volta de sequência', () => {
  const series = core.createSeries({ exercise: ' Supino ', loadKg: 60, notes: 'RPE 7' });
  const row = (seq, time) => [seq, time, 0, 0, 9.81, 0, 0, 0];
  for (const sample of [row(65534, 0), row(65535, 10000), row(0, 20000), row(2, 40000), row(2, 40000), row(1, 30000)]) {
    core.appendSample(series, sample);
  }
  core.finishSeries(series, 'interrupted');
  assert.equal(series.metadata.exercise, 'Supino');
  assert.equal(series.metadata.status, 'interrupted');
  assert.equal(series.samples[2][0], 0);
  assert.deepEqual(series.quality, { missingPackets: 1, outOfOrder: 1, duplicates: 1, totalSamples: 6 });
  assert.equal(series.derived.validated, false);
  assert.equal(series.derived.meanConcentricVelocityMs, null);
  assert.throws(() => core.createSeries({ exercise: '', loadKg: 20 }), /Exercício/);
  for (const loadKg of ['', null, -1, Infinity, NaN]) {
    assert.throws(() => core.createSeries({ exercise: 'Supino', loadKg }), /Carga/);
  }
  assert.throws(() => core.appendSample(series, [1, 0, NaN, 0, 0, 0, 0, 0]), /Amostra/);
});
