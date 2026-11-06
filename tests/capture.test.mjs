import test from 'node:test';
import assert from 'node:assert/strict';
import { CaptureController } from '../web/js/capture.js';

class FakeDevice extends EventTarget {
  connected = false;
  name = 'Sensor de teste';
  startResult = Promise.resolve();
  async connect() { this.connected = true; }
  disconnect() { this.connected = false; this.dispatchEvent(new Event('disconnected')); }
  start() { return this.startResult; }
  async stop() {}
  sample() { this.dispatchEvent(new CustomEvent('sample', { detail: [0, 1000, 0, 0, 9.81, 0, 0, 0] })); }
}
const meta = { exercise: 'Supino', loadKg: 60 };

test('captura impede início desconectado e mantém série interrompida até conseguir salvar', async () => {
  const device = new FakeDevice();
  let fails = true;
  const saved = [];
  const store = { async save(series) { if (fails) throw new Error('disco cheio'); saved.push(series); } };
  const capture = new CaptureController({ device, store });
  await assert.rejects(capture.start(meta), /conect/i);
  await capture.connect();
  await capture.start(meta);
  device.sample();
  device.disconnect();
  assert.equal(capture.state, 'pending');
  assert.equal(capture.series.metadata.status, 'interrupted');
  assert.equal(capture.series.samples.length, 1);
  await assert.rejects(capture.start(meta), /salv|pendente/);
  await assert.rejects(capture.save('browser'), /disco cheio/);
  assert.equal(capture.series.samples.length, 1);
  fails = false;
  await capture.save('browser');
  assert.equal(saved.length, 1);
  assert.equal(capture.state, 'disconnected');
  assert.equal(capture.series, null);
});

test('aguarda START, conserva amostras durante confirmação e impede comandos concorrentes', async () => {
  const device = new FakeDevice();
  let acknowledge;
  device.startResult = new Promise(resolve => { acknowledge = resolve; });
  const capture = new CaptureController({ device, store: { async save() { throw new Error('indisponível'); } } });
  await capture.connect();
  const starting = capture.start(meta);
  assert.equal(capture.state, 'starting');
  await assert.rejects(capture.start(meta), /Aguarde/);
  device.sample();
  acknowledge();
  await starting;
  assert.equal(capture.state, 'recording');
  await capture.stop();
  assert.equal(capture.series.metadata.status, 'complete');
  assert.equal(capture.series.samples.length, 1);
  const pending = capture.series;
  const downloaded = await capture.save('json');
  assert.equal(downloaded, pending);
  assert.equal(capture.state, 'pending');
  assert.throws(() => capture.createDemo(meta), /Salve/);
  capture.release();
  assert.equal(capture.state, 'ready');
});

test('falha de confirmação START ou STOP deixa uma série interrompida para exportação', async () => {
  const device = new FakeDevice();
  const capture = new CaptureController({ device, store: {} });
  await capture.connect();
  device.startResult = Promise.reject(new Error('START sem confirmação'));
  await assert.rejects(capture.start(meta), /confirmação/);
  assert.equal(capture.series.metadata.status, 'interrupted');
  await capture.discard();
  device.startResult = Promise.resolve();
  await capture.start(meta);
  device.sample();
  device.stop = async () => { throw new Error('STOP sem confirmação'); };
  await assert.rejects(capture.stop(), /confirmação/);
  assert.equal(capture.state, 'pending');
  assert.equal(capture.series.metadata.status, 'interrupted');
  assert.equal(capture.series.samples.length, 1);
});
