import test from 'node:test';
import assert from 'node:assert/strict';
import { BluetoothDevice, UUIDS } from '../web/js/bluetooth.js';

class Characteristic extends EventTarget {
  value = new DataView(new TextEncoder().encode('READY').buffer);
  async startNotifications() { return this; }
  async readValue() { return this.value; }
  emit(text) {
    this.value = new DataView(new TextEncoder().encode(text).buffer);
    this.dispatchEvent(new Event('characteristicvaluechanged'));
  }
}

function peripheral() {
  const status = new Characteristic();
  const data = new Characteristic();
  const command = new Characteristic();
  let confirms = true;
  command.writeValueWithResponse = async value => {
    if (confirms) status.emit(new TextDecoder().decode(value) === 'START' ? 'STARTED' : 'STOPPED');
  };
  const device = new EventTarget();
  device.name = 'VBT-ESP32';
  const service = { async getCharacteristic(uuid) {
    return { [UUIDS.command]: command, [UUIDS.data]: data, [UUIDS.status]: status }[uuid];
  } };
  device.gatt = {
    connected: false,
    async connect() { this.connected = true; return this; },
    async getPrimaryService() { return service; },
    disconnect() { this.connected = false; device.dispatchEvent(new Event('gattserverdisconnected')); },
  };
  return { bluetooth: { async requestDevice() { return device; } }, device, data, status, disableConfirmation() { confirms = false; } };
}

test('Bluetooth confirma comandos pelo STATUS e relata timeout e desconexão', async () => {
  const sensor = peripheral();
  const ble = new BluetoothDevice({ bluetooth: sensor.bluetooth, timeoutMs: 30 });
  await ble.connect();
  assert.equal(ble.connected, true);
  await ble.start();
  await ble.stop();
  sensor.disableConfirmation();
  await assert.rejects(ble.start(), /confirmação/);
  assert.equal(ble.connected, false);
  await ble.connect();
  const waiting = ble.stop();
  sensor.device.gatt.disconnect();
  await assert.rejects(waiting, /conexão/);
  assert.equal(ble.connected, false);
});
