// Protocol v1: acquisition timestamps and SI values are retained unchanged.
export function decodePacket(value) {
  const view = value instanceof DataView ? value : new DataView(value.buffer ?? value, value.byteOffset ?? 0, value.byteLength);
  if (view.byteLength !== 19) throw new Error('A amostra deve conter 19 bytes.');
  if (view.getUint8(0) !== 1) throw new Error('Tipo de pacote desconhecido.');
  return [view.getUint16(1, true), view.getUint32(3, true),
    ...Array.from({ length: 6 }, (_, i) => view.getInt16(7 + i * 2, true) / (i < 3 ? 256 : 2048))];
}

const trackers = new WeakMap();
const blankQuality = () => ({ missingPackets: 0, outOfOrder: 0, duplicates: 0, totalSamples: 0 });
const blankDerived = () => ({ version: null, meanConcentricVelocityMs: null, oneRmKg: null, validated: false });

function createId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // getRandomValues is also available in ordinary HTTP contexts (demo only).
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function validateSample(sample) {
  if (!Array.isArray(sample) || sample.length !== 8 || !sample.every(Number.isFinite)
      || !Number.isInteger(sample[0]) || sample[0] < 0 || sample[0] > 65535
      || !Number.isInteger(sample[1]) || sample[1] < 0 || sample[1] > 4294967295) {
    throw new Error('Amostra inválida: esperados sequência, tempo em µs e seis canais numéricos.');
  }
}

function validateInput({ exercise, loadKg }) {
  if (typeof exercise !== 'string' || !exercise.trim()) throw new Error('Exercício é obrigatório.');
  if (typeof loadKg !== 'number' || !Number.isFinite(loadKg) || loadKg < 0) throw new Error('Carga deve ser um número maior ou igual a zero.');
}

export function createSeries({ exercise, loadKg, notes = '', source = 'bluetooth', deviceName = '', firmwareVersion = 'unknown', sampleRateHz = 100 }) {
  validateInput({ exercise, loadKg });
  if (typeof notes !== 'string') throw new Error('Observações devem ser texto.');
  if (!['bluetooth', 'synthetic'].includes(source)) throw new Error('Origem da série inválida.');
  if (!Number.isFinite(sampleRateHz) || sampleRateHz <= 0) throw new Error('Taxa de amostragem inválida.');
  return {
    schemaVersion: 1,
    metadata: { id: createId(), startedAt: new Date().toISOString(), endedAt: null,
      exercise: exercise.trim(), mode: 'padrao', loadKg, notes, deviceName,
      sampleRateHz, source, firmwareVersion, status: 'recording' },
    samples: [], quality: blankQuality(), derived: blankDerived(),
  };
}

function track(quality, tracker, sample) {
  const [seq, time] = sample;
  tracker.minUs = Math.min(tracker.minUs ?? Infinity, time);
  tracker.maxUs = Math.max(tracker.maxUs ?? -Infinity, time);
  const key = `${seq}:${time}`;
  if (tracker.seen.has(key)) quality.duplicates++;
  else {
    tracker.seen.add(key);
    if (tracker.latest) {
      const delta = (seq - tracker.latest[0] + 65536) % 65536;
      if (time <= tracker.latest[1] || delta === 0 || delta > 32768) quality.outOfOrder++;
      else {
        quality.missingPackets += delta - 1;
        tracker.latest = sample;
      }
    } else tracker.latest = sample;
  }
  quality.totalSamples++;
}

export function appendSample(series, sample) {
  validateSample(sample);
  let tracker = trackers.get(series);
  if (!tracker) {
    tracker = { seen: new Set(), latest: null };
    series.quality = blankQuality();
    for (const previous of series.samples) track(series.quality, tracker, previous);
    trackers.set(series, tracker);
  }
  const copy = [...sample];
  track(series.quality, tracker, copy);
  series.samples.push(copy);
  return series;
}

export function finishSeries(series, status = 'complete') {
  if (!['complete', 'interrupted'].includes(status)) throw new Error('Estado final inválido.');
  series.metadata.endedAt = new Date().toISOString();
  series.metadata.status = status;
  return series;
}

export function seriesDurationSeconds(series) {
  if (!series?.samples.length) return 0;
  const tracker = trackers.get(series);
  if (tracker) return (tracker.maxUs - tracker.minUs) / 1e6;
  let min = Infinity, max = -Infinity;
  for (const sample of series.samples) { min = Math.min(min, sample[1]); max = Math.max(max, sample[1]); }
  return (max - min) / 1e6;
}

export function validateSeries(value) {
  if (!value || value.schemaVersion !== 1) throw new Error('Formato ou versão de série não suportada.');
  const meta = value.metadata;
  if (!meta || typeof meta !== 'object') throw new Error('Metadados ausentes.');
  validateInput(meta);
  for (const key of ['id', 'startedAt', 'exercise', 'mode', 'notes', 'deviceName', 'source', 'firmwareVersion', 'status']) {
    if (typeof meta[key] !== 'string') throw new Error(`Metadado inválido: ${key}.`);
  }
  if (!meta.id || !Number.isFinite(Date.parse(meta.startedAt))
      || !['complete', 'interrupted', 'recording'].includes(meta.status)
      || !['bluetooth', 'synthetic'].includes(meta.source)
      || !Number.isFinite(meta.sampleRateHz) || meta.sampleRateHz <= 0) throw new Error('Metadados da série inválidos.');
  if (meta.endedAt !== null && (typeof meta.endedAt !== 'string' || !Number.isFinite(Date.parse(meta.endedAt)))) throw new Error('Data final inválida.');
  if (meta.status !== 'recording' && meta.endedAt === null) throw new Error('Série finalizada deve informar data final.');
  if (meta.endedAt !== null && Date.parse(meta.endedAt) < Date.parse(meta.startedAt)) throw new Error('Data final anterior ao início.');
  if (!Array.isArray(value.samples)) throw new Error('Amostras ausentes.');
  const series = { schemaVersion: 1, metadata: { ...meta }, samples: [], quality: blankQuality(), derived: blankDerived() };
  for (const sample of value.samples) appendSample(series, sample);
  return series;
}

function validateCollection(values) {
  if (!Array.isArray(values) || !values.length) throw new Error('Arquivo não contém séries.');
  const series = values.map(validateSeries);
  if (new Set(series.map(s => s.metadata.id)).size !== series.length) throw new Error('Arquivo contém identificadores de série duplicados.');
  return series;
}

export function serializeJSON(values) {
  return JSON.stringify({ schemaVersion: 1, series: validateCollection(values) }, null, 2);
}

export function parseJSON(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('JSON inválido. Confira o arquivo selecionado.'); }
  if (Array.isArray(data)) return validateCollection(data);
  if (data?.series) {
    if (data.schemaVersion !== 1) throw new Error('Pacote JSON com versão não suportada.');
    return validateCollection(data.series);
  }
  return validateCollection([data]);
}

const metadataFields = ['id', 'startedAt', 'endedAt', 'exercise', 'mode', 'loadKg', 'notes', 'deviceName', 'sampleRateHz', 'source', 'firmwareVersion', 'status'];
const sampleFields = ['seq', 't_us', 'ax_ms2', 'ay_ms2', 'az_ms2', 'gx_rad_s', 'gy_rad_s', 'gz_rad_s'];
const csvFields = ['schemaVersion', ...metadataFields, ...sampleFields];
const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;

export function serializeCSV(values) {
  const lines = [[...csvFields, 'metadata_extra_json'].join(',')];
  for (const series of validateCollection(values)) {
    const metadata = [1, ...metadataFields.map(key => series.metadata[key])];
    const extras = JSON.stringify(Object.fromEntries(Object.entries(series.metadata).filter(([key]) => !metadataFields.includes(key))));
    for (const sample of series.samples.length ? series.samples : [Array(8).fill('')]) {
      lines.push([...metadata, ...sample, extras].map(csvCell).join(','));
    }
  }
  return lines.join('\r\n') + '\r\n';
}

function csvRows(text) {
  const rows = [];
  let row = [], cell = '', quoted = false, closed = false;
  const endCell = () => { row.push(cell); cell = ''; closed = false; };
  const endRow = () => { endCell(); if (row.some(value => value !== '')) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === ',') endCell();
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else if (char === '"' && cell === '' && !closed) quoted = true;
    else {
      if (closed || char === '"') throw new Error('CSV inválido: aspas ou separadores incorretos.');
      cell += char;
    }
  }
  if (quoted) throw new Error('CSV inválido: campo com aspas não finalizado.');
  if (cell !== '' || row.length || closed) endRow();
  return rows;
}

export function parseCSV(text) {
  const [header, ...rows] = csvRows(text.replace(/^\uFEFF/, ''));
  if (!header || new Set(header).size !== header.length || csvFields.some(key => !header.includes(key))) {
    throw new Error('CSV sem as colunas obrigatórias do VBT Lab.');
  }
  const groups = new Map();
  for (const row of rows) {
    if (row.length !== header.length) throw new Error('CSV inválido: quantidade de colunas inconsistente.');
    const record = Object.fromEntries(header.map((name, i) => [name, row[i]]));
    if (record.schemaVersion !== '1') throw new Error('CSV com versão não suportada.');
    let extras = {};
    if (record.metadata_extra_json) {
      try { extras = JSON.parse(record.metadata_extra_json); }
      catch { throw new Error('CSV com extensão de metadados JSON inválida.'); }
      if (!extras || typeof extras !== 'object' || Array.isArray(extras) || metadataFields.some(key => Object.hasOwn(extras, key))) {
        throw new Error('CSV com extensão de metadados inválida.');
      }
    }
    const metadata = { ...Object.fromEntries(metadataFields.map(key => [key, record[key]])), ...extras };
    metadata.loadKg = metadata.loadKg.trim() === '' ? NaN : Number(metadata.loadKg);
    metadata.sampleRateHz = metadata.sampleRateHz.trim() === '' ? NaN : Number(metadata.sampleRateHz);
    metadata.endedAt ||= null;
    let series = groups.get(metadata.id);
    if (!series) {
      series = { schemaVersion: 1, metadata, samples: [] };
      groups.set(metadata.id, series);
    } else if (JSON.stringify(series.metadata) !== JSON.stringify(metadata)) throw new Error('CSV com metadados conflitantes para a mesma série.');
    const values = sampleFields.map(key => record[key]);
    if (values.every(v => v === '')) continue; // Represents a series with zero samples.
    const sample = values.map(v => v.trim() === '' ? NaN : Number(v));
    validateSample(sample);
    series.samples.push(sample);
  }
  return validateCollection([...groups.values()]);
}

export function createDemoSeries(metadata) {
  const series = createSeries({ ...metadata, source: 'synthetic', deviceName: 'Demonstração', firmwareVersion: 'synthetic-1' });
  for (let i = 0; i < 1200; i++) {
    const t = i / 100;
    const phase = t * Math.PI;
    const envelope = Math.sin(Math.PI * Math.min(t / 12, 1)) ** 2;
    appendSample(series, [i, i * 10000,
      0.18 * Math.sin(phase * 2) * envelope, 0.12 * Math.cos(phase) * envelope,
      9.81 + 2.6 * Math.sin(phase * 2) * envelope,
      0.08 * Math.sin(phase), 0.12 * Math.cos(phase), 0.04 * Math.sin(phase * 2)]);
  }
  series.metadata.startedAt = new Date(Date.now() - 12000).toISOString();
  return finishSeries(series);
}

export function channelValue(sample, channel) {
  const index = { ax: 2, ay: 3, az: 4, gx: 5, gy: 6, gz: 7 }[channel];
  if (index !== undefined) return sample[index];
  if (channel === 'aMag') return Math.hypot(...sample.slice(2, 5));
  if (channel === 'gMag') return Math.hypot(...sample.slice(5, 8));
  throw new Error('Canal desconhecido.');
}
