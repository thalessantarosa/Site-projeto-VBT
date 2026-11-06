import { createSeries, appendSample, finishSeries, createDemoSeries } from './core.js';

export class CaptureController extends EventTarget {
  #device;
  #store;
  #state = 'disconnected';
  #series = null;
  #busy = false;
  #recovery = null;

  constructor({ device, store }) {
    super();
    this.#device = device;
    this.#store = store;
    this.#state = device.connected ? 'ready' : 'disconnected';
    device.addEventListener('sample', event => {
      if (!['starting', 'recording', 'stopping'].includes(this.#state)) return;
      try {
        appendSample(this.#series, event.detail);
        this.dispatchEvent(new CustomEvent('sample', { detail: event.detail }));
      } catch (error) { this.#interrupt(error); }
    });
    device.addEventListener('disconnected', () => {
      if (this.#series && ['starting', 'recording', 'stopping'].includes(this.#state)) {
        finishSeries(this.#series, 'interrupted');
        this.#state = 'pending';
      } else if (!this.#series) this.#state = 'disconnected';
      this.#change();
    });
    device.addEventListener('error', event => this.#interrupt(event.detail));
  }

  get state() { return this.#state; }
  get series() { return this.#series; }
  get busy() { return this.#busy || Boolean(this.#recovery); }

  #change() { this.dispatchEvent(new Event('change')); }

  #available() {
    if (this.busy) throw new Error('Aguarde a operação atual terminar.');
  }

  #interrupt(error) {
    if (this.#series && ['starting', 'recording', 'stopping'].includes(this.#state)) {
      finishSeries(this.#series, 'interrupted');
      this.#state = 'pending';
      // The pending series is retained even if the device cannot acknowledge STOP.
      this.#recovery = Promise.resolve().then(() => this.#device.stop()).catch(() => {
        // No acknowledgment means the physical acquisition state is unknown.
        this.#device.disconnect();
      }).finally(() => { this.#recovery = null; this.#change(); });
      this.#change();
    }
    this.dispatchEvent(new CustomEvent('error', { detail: error }));
  }

  async connect() {
    this.#available();
    if (this.#state === 'pending') throw new Error('Salve ou descarte a série pendente antes de conectar.');
    if (this.#state !== 'disconnected') throw new Error('Dispositivo já conectado.');
    this.#busy = true;
    this.#change();
    try {
      await this.#device.connect();
      if (!this.#device.connected) throw new Error('A conexão com o dispositivo foi interrompida.');
      this.#state = 'ready';
    } finally { this.#busy = false; this.#change(); }
  }

  disconnect() {
    this.#available();
    this.#device.disconnect();
  }

  async start(metadata) {
    this.#available();
    if (this.#state === 'pending') throw new Error('Salve ou descarte a série pendente antes de iniciar.');
    if (this.#state !== 'ready' || !this.#device.connected) throw new Error('Conecte o ESP32 antes de iniciar a série.');
    const series = createSeries({ ...metadata, source: 'bluetooth', deviceName: this.#device.name });
    this.#series = series;
    this.#state = 'starting';
    this.#busy = true;
    this.#change();
    try {
      await this.#device.start();
      if (this.#state !== 'starting' || !this.#device.connected) throw new Error('A conexão foi interrompida durante o início.');
      this.#state = 'recording';
    } catch (error) {
      if (this.#state === 'starting') {
        finishSeries(series, 'interrupted');
        this.#state = 'pending';
      }
      throw error;
    } finally { this.#busy = false; this.#change(); }
  }

  async stop() {
    this.#available();
    if (this.#state !== 'recording') throw new Error('Não há uma captura em andamento.');
    this.#state = 'stopping';
    this.#busy = true;
    this.#change();
    try {
      await this.#device.stop();
      if (this.#state === 'stopping') {
        finishSeries(this.#series);
        this.#state = 'pending';
      }
    } catch (error) {
      if (this.#state === 'stopping') {
        finishSeries(this.#series, 'interrupted');
        this.#state = 'pending';
      }
      throw error;
    } finally { this.#busy = false; this.#change(); }
  }

  createDemo(metadata) {
    this.#available();
    if (!['ready', 'disconnected'].includes(this.#state)) throw new Error('Salve ou descarte a série atual antes de criar outra.');
    this.#series = createDemoSeries(metadata);
    this.#state = 'pending';
    this.#change();
    return this.#series;
  }

  async save(destination = 'browser') {
    this.#available();
    if (this.#state !== 'pending') throw new Error('Não há série pendente para salvar.');
    if (!['browser', 'json', 'both'].includes(destination)) throw new Error('Destino de salvamento inválido.');
    this.#busy = true;
    this.#change();
    const series = this.#series;
    try {
      if (destination !== 'json') await this.#store.save(series);
      if (destination === 'browser') this.#release();
      return series;
    } finally { this.#busy = false; this.#change(); }
  }

  #release() {
    this.#series = null;
    this.#state = this.#device.connected ? 'ready' : 'disconnected';
    this.#change();
  }

  release() {
    this.#available();
    if (this.#state !== 'pending') throw new Error('Não há série pendente.');
    this.#release();
  }

  async discard() { this.release(); }
}
