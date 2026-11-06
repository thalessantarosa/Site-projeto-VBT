import { decodePacket } from './core.js';

export const UUIDS = Object.freeze({
  service: '824f0001-53cb-4a5b-9f4b-93e1a5e8f001',
  command: '824f0002-53cb-4a5b-9f4b-93e1a5e8f001',
  data: '824f0003-53cb-4a5b-9f4b-93e1a5e8f001',
  status: '824f0004-53cb-4a5b-9f4b-93e1a5e8f001',
});

export class BluetoothDevice extends EventTarget {
  #bluetooth;
  #timeout;
  #secure;
  #device;
  #command;
  #data;
  #status;
  #ready = false;
  #connecting = false;
  #pending;

  constructor({ bluetooth = globalThis.navigator?.bluetooth, timeoutMs = 5000, secureContext = globalThis.isSecureContext ?? true } = {}) {
    super();
    this.#bluetooth = bluetooth;
    this.#timeout = timeoutMs;
    this.#secure = secureContext;
  }

  get connected() { return this.#ready && Boolean(this.#device?.gatt?.connected); }
  get name() { return this.#device?.name || 'ESP32'; }

  #onData = event => {
    try { this.dispatchEvent(new CustomEvent('sample', { detail: decodePacket(event.target.value) })); }
    catch (error) {
      this.dispatchEvent(new CustomEvent('error', { detail: error }));
      this.disconnect();
    }
  };

  #onStatus = event => this.#receiveStatus(new TextDecoder().decode(event.target.value).trim());

  #receiveStatus(status) {
    this.dispatchEvent(new CustomEvent('status', { detail: status }));
    if (status.startsWith('ERROR:')) {
      const error = new Error(`ESP32: ${status.slice(6)}`);
      if (this.#pending) this.#pending.reject(error);
      else this.dispatchEvent(new CustomEvent('error', { detail: error }));
    } else if (this.#pending?.expected === status) this.#pending.resolve();
  }

  #onDisconnected = () => {
    this.#pending?.reject(new Error('A conexão Bluetooth foi interrompida.'));
    this.#cleanup();
    this.dispatchEvent(new Event('disconnected'));
  };

  #cleanup() {
    this.#ready = false;
    this.#data?.removeEventListener('characteristicvaluechanged', this.#onData);
    this.#status?.removeEventListener('characteristicvaluechanged', this.#onStatus);
    this.#device?.removeEventListener('gattserverdisconnected', this.#onDisconnected);
    this.#command = this.#data = this.#status = null;
    this.#device = null;
  }

  async connect() {
    if (!this.#secure) throw new Error('Abra a aplicação por HTTPS ou localhost para conectar Bluetooth.');
    if (!this.#bluetooth) throw new Error('Web Bluetooth indisponível neste navegador. Use um navegador compatível ou experimente a demonstração.');
    if (this.connected || this.#connecting) throw new Error('Já existe uma conexão ou tentativa em andamento.');
    this.#connecting = true;
    try {
      this.#device = await this.#bluetooth.requestDevice({ filters: [{ services: [UUIDS.service] }] });
      this.#device.addEventListener('gattserverdisconnected', this.#onDisconnected);
      const server = await this.#device.gatt.connect();
      const service = await server.getPrimaryService(UUIDS.service);
      this.#command = await service.getCharacteristic(UUIDS.command);
      this.#data = await service.getCharacteristic(UUIDS.data);
      this.#status = await service.getCharacteristic(UUIDS.status);
      this.#data.addEventListener('characteristicvaluechanged', this.#onData);
      this.#status.addEventListener('characteristicvaluechanged', this.#onStatus);
      await this.#data.startNotifications();
      await this.#status.startNotifications();
      const status = new TextDecoder().decode(await this.#status.readValue()).trim();
      if (!['READY', 'STOPPED', 'STARTED'].includes(status)) throw new Error(`ESP32 não está pronto: ${status || 'sem status'}.`);
      this.#ready = true;
      // A previous browser may have disconnected during acquisition.
      if (status === 'STARTED') await this.#send('STOP', 'STOPPED');
      this.#receiveStatus(status === 'STARTED' ? 'STOPPED' : status);
    } catch (error) {
      this.disconnect();
      if (error.name === 'NotFoundError') throw new Error('Nenhum ESP32 foi selecionado. Tente conectar novamente.');
      throw error;
    } finally { this.#connecting = false; }
  }

  disconnect() {
    const device = this.#device;
    if (device?.gatt?.connected) device.gatt.disconnect();
    else {
      this.#pending?.reject(new Error('A conexão Bluetooth foi encerrada.'));
      this.#cleanup();
      this.dispatchEvent(new Event('disconnected'));
    }
  }

  async #send(command, expected) {
    if (!this.connected) throw new Error('Sem conexão Bluetooth pronta.');
    if (this.#pending) throw new Error('Aguarde a confirmação do comando anterior.');
    let timer;
    const acknowledgment = new Promise((resolve, reject) => {
      this.#pending = { expected, resolve, reject };
      timer = setTimeout(() => reject(new Error(`ESP32 não enviou confirmação de ${command}. A captura foi interrompida.`)), this.#timeout);
    });
    try {
      const data = new TextEncoder().encode(command);
      const write = this.#command.writeValueWithResponse
        ? this.#command.writeValueWithResponse(data) : this.#command.writeValue(data);
      await Promise.all([write, acknowledgment]);
    } catch (error) {
      // State is uncertain after a timeout; disconnect rather than reset a running acquisition.
      this.disconnect();
      throw error;
    } finally { clearTimeout(timer); this.#pending = null; }
  }

  async start() { return this.#send('START', 'STARTED'); }
  async stop() { return this.#send('STOP', 'STOPPED'); }
}
