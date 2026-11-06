import { validateSeries } from './core.js';

export class SeriesStore {
  #factory;
  #name;
  #connection;

  constructor({ indexedDB = globalThis.indexedDB, name = 'vbt-lab' } = {}) {
    this.#factory = indexedDB;
    this.#name = name;
  }

  async #open() {
    if (!this.#factory) throw new Error('Armazenamento local indisponível. Você ainda pode baixar JSON.');
    if (!this.#connection) {
      this.#connection = new Promise((resolve, reject) => {
        const request = this.#factory.open(this.#name, 1);
        let blocked = false;
        request.onupgradeneeded = () => request.result.createObjectStore('series', { keyPath: 'metadata.id' });
        request.onerror = () => reject(new Error('Não foi possível abrir o armazenamento local.'));
        request.onblocked = () => { blocked = true; reject(new Error('Feche outras abas do VBT Lab para atualizar o armazenamento.')); };
        request.onsuccess = () => {
          const db = request.result;
          if (blocked) { db.close(); return; }
          db.onversionchange = () => { db.close(); this.#connection = null; };
          resolve(db);
        };
      });
      this.#connection.catch(() => { this.#connection = null; });
    }
    return this.#connection;
  }

  async #transaction(mode, action) {
    const db = await this.#open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('series', mode);
      let request;
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onabort = () => reject(new Error('Falha ao salvar os dados locais. Confira o espaço disponível e tente novamente ou baixe JSON.'));
      transaction.onerror = () => {}; // Rejection is delivered by abort, after rollback.
      try { request = action(transaction.objectStore('series')); }
      catch (error) { transaction.abort(); reject(error); }
    });
  }

  async list() {
    const values = await this.#transaction('readonly', store => store.getAll());
    return values.map(validateSeries).sort((a, b) => b.metadata.startedAt.localeCompare(a.metadata.startedAt));
  }

  async save(series) { return this.saveMany([series]); }

  async saveMany(values) {
    // Validate the complete import before opening a write transaction.
    const series = values.map(validateSeries);
    await this.#transaction('readwrite', store => {
      for (const value of series) store.put(value);
    });
  }

  async deleteMany(ids) {
    await this.#transaction('readwrite', store => {
      for (const id of ids) store.delete(id);
    });
  }
}
