import { serializeJSON, parseJSON, serializeCSV, parseCSV } from './core.js';
import { BluetoothDevice } from './bluetooth.js';
import { CaptureController } from './capture.js';
import { SeriesStore } from './storage.js';
import { drawChart, SERIES_COLORS, SERIES_DASHES } from './chart.js';

const $ = id => document.getElementById(id);
const store = new SeriesStore();
const device = new BluetoothDevice();
const capture = new CaptureController({ device, store });
const selected = new Set();
let library = [], currentView = 'captura', busy = false, lastPreview = null;
let libraryLoaded = false, drawPending = false;
const integer = new Intl.NumberFormat('pt-BR');
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const stateLabels = { disconnected: 'Aguardando sensor', ready: 'Sensor pronto', starting: 'Iniciando…', recording: 'Gravando', stopping: 'Finalizando…', pending: 'Aguardando salvamento' };

function notify(message, type = 'success') {
  $('notice-text').textContent = message;
  $('notice').className = `notice ${type === 'success' ? '' : type}`;
  $('notice').hidden = false;
}
function errorMessage(error) { return error instanceof Error ? error.message : String(error); }
async function action(task) {
  if (busy) return;
  busy = true; renderCapture();
  try { await task(); } catch (error) { notify(errorMessage(error), 'error'); }
  finally { busy = false; renderCapture(); renderSelection(); }
}
function showView(view) {
  if (!['captura', 'biblioteca', 'analise'].includes(view)) view = 'captura';
  currentView = view;
  for (const section of document.querySelectorAll('main > section')) section.hidden = section.id !== `view-${view}`;
  for (const button of document.querySelectorAll('.main-nav button')) {
    if (button.dataset.view === view) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  history.replaceState(null, '', `#${view}`);
  if (view === 'analise') renderAnalysis();
  else if (view === 'captura') scheduleDraw();
}
function metadata(demo = false) {
  if (demo) {
    if (!$('exercise').value.trim()) $('exercise').value = 'Supino';
    if ($('load').value === '') $('load').value = '20';
  }
  const exercise = $('exercise').value.trim();
  const loadKg = $('load').value === '' ? NaN : Number($('load').value);
  const validExercise = exercise.length > 0;
  const validLoad = Number.isFinite(loadKg) && loadKg >= 0;
  $('exercise-error').hidden = validExercise; $('load-error').hidden = validLoad;
  $('exercise').setAttribute('aria-invalid', String(!validExercise));
  $('load').setAttribute('aria-invalid', String(!validLoad));
  if (!validExercise || !validLoad) {
    (validExercise ? $('load') : $('exercise')).focus();
    return null;
  }
  return { exercise, loadKg, notes: $('notes').value.trim() };
}
function duration(series) {
  if (!series || series.samples.length === 0) return 0;
  const samples = series.samples;
  return Math.max(0, (samples[samples.length - 1][1] - samples[0][1]) / 1e6);
}
function timeText(seconds, detail = false) {
  const minutes = Math.floor(seconds / 60), remainder = Math.floor(seconds % 60);
  const basic = `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  return detail ? `${basic}.${Math.floor(seconds % 1 * 10)}` : basic;
}
function sourceName(series) { return series.metadata.source === 'synthetic' ? 'Sintética' : 'Bluetooth'; }
function title(series) { return `${series.metadata.exercise} · ${decimal.format(series.metadata.loadKg)} kg`; }
function sourceBadge(series) {
  const badge = document.createElement('span');
  badge.className = `badge ${series.metadata.source === 'synthetic' ? 'synthetic' : 'active'}`;
  badge.textContent = sourceName(series);
  return badge;
}
function formatDate(value) { const d = new Date(value); return Number.isNaN(d.valueOf()) ? 'Data indisponível' : date.format(d); }
function renderCapture() {
  const state = capture.state, series = capture.series;
  const active = ['starting', 'recording', 'stopping'].includes(state);
  const pending = state === 'pending';
  $('metadata-fields').disabled = busy || active || pending;
  $('connect').disabled = busy || active || pending || !navigator.bluetooth || !window.isSecureContext;
  $('connect').textContent = device.connected ? 'Desconectar sensor' : 'Conectar ESP32';
  $('connection-label').textContent = device.connected ? (device.name || 'ESP32 conectado') : 'Sensor desconectado';
  $('connection-dot').className = `status-dot ${state === 'recording' ? 'recording' : device.connected ? 'connected' : ''}`;
  $('sensor-help').textContent = device.connected ? `${device.name || 'ESP32'} conectado e disponível.` : 'Use o ESP32 com o protocolo VBT Lab.';
  $('start').hidden = active;
  $('start').disabled = busy || state !== 'ready';
  $('stop').hidden = !active;
  $('stop').disabled = busy || state !== 'recording';
  $('stop').textContent = state === 'starting' ? 'Iniciando…' : state === 'stopping' ? 'Finalizando…' : '■ Finalizar série';
  $('demo').disabled = busy || active || pending;
  $('capture-state').textContent = stateLabels[state] || state;
  $('capture-state').className = `badge ${state === 'recording' || state === 'ready' ? 'active' : pending ? 'warning' : ''}`;
  $('capture-help').textContent = pending ? 'Salve ou descarte a série antes de continuar.' : state === 'recording' ? 'Mantenha esta página aberta durante a captura.' : state === 'ready' ? 'O relógio de aquisição será o do ESP32.' : active ? 'Aguardando confirmação do sensor…' : 'Conecte um sensor para iniciar a captura.';
  $('save-panel').hidden = !pending;
  $('save').disabled = busy; $('discard').disabled = busy; $('save-destination').disabled = busy;
  if (pending && series) {
    $('pending-source').textContent = sourceName(series);
    $('pending-source').className = `badge ${series.metadata.source === 'synthetic' ? 'synthetic' : 'active'}`;
    $('pending-description').textContent = `${title(series)} · ${integer.format(series.samples.length)} amostras · ${timeText(duration(series), true)}${series.metadata.status === 'interrupted' ? ' · Captura interrompida: os dados recebidos foram preservados.' : ''}`;
  }
  renderLiveValues(); scheduleDraw();
}
function renderLiveValues() {
  const series = capture.series || lastPreview;
  $('duration').textContent = timeText(duration(series), true);
  $('sample-count').textContent = integer.format(series?.samples.length || 0);
  $('missing-count').textContent = integer.format(series?.quality.missingPackets || 0);
  $('sample-rate').textContent = `${series?.metadata.sampleRateHz || 100} Hz nominal`;
  $('live-source').textContent = series ? `${sourceName(series)} · ${series.metadata.status === 'interrupted' ? 'Interrompida' : capture.series ? stateLabels[capture.state] : 'Última série'}` : 'Nenhuma série em andamento';
  $('live-empty').hidden = Boolean(series?.samples.length);
}
function scheduleDraw() {
  if (drawPending) return;
  drawPending = true;
  requestAnimationFrame(() => {
    drawPending = false;
    if (currentView !== 'captura') return;
    const series = capture.series || lastPreview;
    drawChart($('live-chart'), series ? [series] : [], 'az');
  });
}
async function refreshLibrary() {
  try {
    library = await store.list(); libraryLoaded = true;
    library.sort((a, b) => Date.parse(b.metadata.startedAt) - Date.parse(a.metadata.startedAt));
    for (const id of selected) if (!library.some(series => series.metadata.id === id)) selected.delete(id);
    renderLibrary();
  } catch (error) {
    libraryLoaded = true; renderLibrary();
    notify(`Não foi possível ler o armazenamento local. Você pode criar uma demonstração e baixar o JSON. ${errorMessage(error)}`, 'error');
  }
}
function filteredLibrary() {
  const query = $('search').value.trim().toLocaleLowerCase('pt-BR');
  const exercise = $('exercise-filter').value;
  const minimum = $('min-load').value === '' ? 0 : Number($('min-load').value);
  return library.filter(series => {
    const m = series.metadata;
    return (!query || `${m.exercise} ${m.notes}`.toLocaleLowerCase('pt-BR').includes(query)) && (!exercise || m.exercise === exercise) && m.loadKg >= (Number.isFinite(minimum) ? minimum : 0);
  });
}
function cell(text, className = '') { const td = document.createElement('td'); td.textContent = text; td.className = className; return td; }
function renderLibrary() {
  $('library-count').textContent = integer.format(library.length);
  const previous = $('exercise-filter').value;
  $('exercise-filter').replaceChildren(new Option('Todos os exercícios', ''));
  for (const exercise of [...new Set(library.map(s => s.metadata.exercise))].sort((a, b) => a.localeCompare(b, 'pt-BR'))) $('exercise-filter').add(new Option(exercise, exercise));
  if ([...$('exercise-filter').options].some(option => option.value === previous)) $('exercise-filter').value = previous;
  const visible = filteredLibrary();
  const fragment = document.createDocumentFragment();
  for (const series of visible) {
    const row = document.createElement('tr'), checkboxCell = cell('', 'check-cell');
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = selected.has(series.metadata.id);
    checkbox.setAttribute('aria-label', `Selecionar ${title(series)}, ${formatDate(series.metadata.startedAt)}`);
    checkbox.addEventListener('change', () => { if (checkbox.checked) selected.add(series.metadata.id); else selected.delete(series.metadata.id); renderSelection(); });
    checkboxCell.append(checkbox);
    const exerciseCell = cell('');
    const name = document.createElement('span'); name.className = 'series-exercise'; name.textContent = series.metadata.exercise;
    const dateLabel = document.createElement('span'); dateLabel.className = 'series-date'; dateLabel.textContent = formatDate(series.metadata.startedAt);
    exerciseCell.append(name, dateLabel);
    if (series.metadata.notes) { const note = document.createElement('span'); note.className = 'series-note'; note.textContent = series.metadata.notes; note.title = series.metadata.notes; exerciseCell.append(note); }
    const quality = series.quality, problems = quality.missingPackets + quality.outOfOrder + (quality.duplicates || 0);
    const qualityCell = cell(problems ? `${integer.format(quality.missingPackets)} lacunas · ${integer.format(quality.outOfOrder)} fora de ordem · ${integer.format(quality.duplicates || 0)} duplicadas` : 'Sem lacunas detectadas', `quality-cell ${problems ? 'quality-warning' : 'quality-good'}`);
    if (series.metadata.status === 'interrupted') { const status = document.createElement('span'); status.className = 'series-date'; status.textContent = 'Captura interrompida'; qualityCell.append(status); }
    const originCell = cell(''); originCell.append(sourceBadge(series));
    row.append(checkboxCell, exerciseCell, cell(`${decimal.format(series.metadata.loadKg)} kg`), cell(integer.format(series.samples.length)), qualityCell, originCell); fragment.append(row);
  }
  $('series-rows').replaceChildren(fragment);
  $('library-table-wrap').hidden = visible.length === 0;
  $('library-empty').hidden = !libraryLoaded || library.length > 0;
  $('no-results').hidden = !libraryLoaded || !library.length || visible.length > 0;
  $('library-summary').textContent = libraryLoaded ? `${integer.format(visible.length)} de ${integer.format(library.length)} ${library.length === 1 ? 'série' : 'séries'}` : 'Carregando séries…';
  renderSelection();
}
function renderSelection() {
  const count = selected.size;
  $('selection-count').textContent = `${integer.format(count)} ${count === 1 ? 'selecionada' : 'selecionadas'}`;
  for (const id of ['compare', 'export-json', 'export-csv', 'delete']) $(id).disabled = count === 0 || busy;
  const visible = filteredLibrary(), checked = visible.filter(s => selected.has(s.metadata.id)).length;
  $('select-all').checked = visible.length > 0 && checked === visible.length;
  $('select-all').indeterminate = checked > 0 && checked < visible.length;
  $('select-all').disabled = visible.length === 0;
  if (currentView === 'analise') renderAnalysis();
}
function renderAnalysis() {
  const series = library.filter(item => selected.has(item.metadata.id));
  const channel = $('channel').value, normalized = $('time-scale').value === 'normalized';
  $('analysis-count').textContent = `${series.length} ${series.length === 1 ? 'série selecionada' : 'séries selecionadas'}`;
  $('analysis-empty').hidden = series.length > 0;
  $('analysis-summary').hidden = series.length === 0;
  const rows = drawChart($('analysis-chart'), series, channel, normalized);
  const channelName = $('channel').selectedOptions[0].textContent;
  $('analysis-chart').setAttribute('aria-label', `${channelName}, ${normalized ? 'tempo normalizado em porcentagem' : 'tempo de aquisição em segundos'}, ${series.length} séries. Resumo numérico na tabela abaixo.`);
  const legend = document.createDocumentFragment(), table = document.createDocumentFragment();
  for (let index = 0; index < rows.length; index++) {
    const { series: item, min, max } = rows[index];
    const label = document.createElement('div'); label.className = 'legend-item';
    const swatch = document.createElement('span'); swatch.className = 'legend-line'; swatch.style.borderColor = SERIES_COLORS[index % SERIES_COLORS.length];
    swatch.style.borderTopStyle = SERIES_DASHES[index % SERIES_DASHES.length].length ? 'dashed' : 'solid';
    const name = document.createElement('span'); name.textContent = `${index + 1}. ${title(item)} · ${sourceName(item)}`;
    label.append(swatch, name); legend.append(label);
    const row = document.createElement('tr');
    row.append(cell(`${index + 1}. ${title(item)} · ${sourceName(item)} · ${formatDate(item.metadata.startedAt)}`), cell(`${decimal.format(duration(item))} s`), cell(integer.format(item.samples.length)), cell(`${item.quality.missingPackets} / ${item.quality.outOfOrder}`), cell(`${decimal.format(min)} a ${decimal.format(max)} ${channel.startsWith('g') ? 'rad/s' : 'm/s²'}`));
    table.append(row);
  }
  $('chart-legend').replaceChildren(legend); $('analysis-rows').replaceChildren(table);
}
function download(content, extension, filename = 'vbt-series') {
  const url = URL.createObjectURL(new Blob([content], { type: extension === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `${filename}.${extension}`;
  document.body.append(link);
  try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
}

document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); showView(button.dataset.view); $('main').focus({ preventScroll: true }); }));
document.querySelector('.brand').addEventListener('click', event => { event.preventDefault(); showView('captura'); });
$('notice-close').addEventListener('click', () => { $('notice').hidden = true; });
$('connect').addEventListener('click', () => action(async () => {
  if (device.connected) { await capture.disconnect(); notify('Sensor desconectado.'); }
  else { await capture.connect(); notify(`${device.name || 'ESP32'} conectado. Prepare os dados da série.`); }
}));
$('capture-form').addEventListener('submit', event => {
  event.preventDefault(); const data = metadata();
  if (data) action(async () => { lastPreview = null; await capture.start(data); });
});
for (const id of ['exercise', 'load']) $(id).addEventListener('input', () => {
  const valid = id === 'exercise' ? Boolean($('exercise').value.trim()) : $('load').value !== '' && Number.isFinite(Number($('load').value)) && Number($('load').value) >= 0;
  if (valid) { $(id).setAttribute('aria-invalid', 'false'); $(id === 'load' ? 'load-error' : 'exercise-error').hidden = true; }
});
$('stop').addEventListener('click', () => action(async () => { await capture.stop(); }));
$('demo').addEventListener('click', () => {
  const data = metadata(true); if (!data) return;
  action(async () => { capture.createDemo(data); notify('Série sintética criada. Escolha onde salvar para explorar a biblioteca.'); });
});
$('save').addEventListener('click', () => action(async () => {
  const destination = $('save-destination').value;
  const series = await capture.save(destination);
  if (destination === 'json' || destination === 'both') { download(serializeJSON([series]), 'json', `vbt-${series.metadata.id}`); capture.release(); }
  lastPreview = series;
  if (destination !== 'json') { await refreshLibrary(); selected.add(series.metadata.id); renderLibrary(); showView('biblioteca'); }
  notify(destination === 'json' ? 'Download JSON solicitado. Confira o arquivo nos downloads do navegador.' : destination === 'both' ? 'Série salva no navegador e download JSON solicitado.' : 'Série salva neste navegador.');
}));
$('discard').addEventListener('click', () => action(async () => {
  if (!window.confirm('Descartar esta série? Os dados ainda não salvos serão perdidos.')) return;
  await capture.discard(); lastPreview = null; notify('Série descartada. Você pode iniciar outro registro.');
}));
for (const id of ['search', 'exercise-filter', 'min-load']) $(id).addEventListener('input', renderLibrary);
$('clear-filters').addEventListener('click', () => { $('search').value = ''; $('exercise-filter').value = ''; $('min-load').value = ''; renderLibrary(); });
$('select-all').addEventListener('change', () => { const checked = $('select-all').checked; for (const series of filteredLibrary()) { if (checked) selected.add(series.metadata.id); else selected.delete(series.metadata.id); } renderLibrary(); });
$('compare').addEventListener('click', () => { showView('analise'); $('main').focus({ preventScroll: true }); });
for (const id of ['channel', 'time-scale']) $(id).addEventListener('change', renderAnalysis);
for (const extension of ['json', 'csv']) $(`export-${extension}`).addEventListener('click', () => action(async () => {
  const items = library.filter(series => selected.has(series.metadata.id));
  download(extension === 'json' ? serializeJSON(items) : serializeCSV(items), extension);
  notify(`Exportação ${extension.toUpperCase()} solicitada para ${items.length} ${items.length === 1 ? 'série' : 'séries'}.`);
}));
$('delete').addEventListener('click', () => action(async () => {
  if (!selected.size || !window.confirm(`Excluir ${selected.size} ${selected.size === 1 ? 'série' : 'séries'} deste navegador? Mantenha um arquivo exportado se precisar restaurar.`)) return;
  await store.deleteMany([...selected]); selected.clear(); await refreshLibrary(); notify('Séries excluídas deste navegador.');
}));
$('import').addEventListener('click', () => { if (!busy) $('import-file').click(); });
$('import-file').addEventListener('change', () => {
  const file = $('import-file').files[0]; if (!file) return;
  action(async () => {
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('O arquivo excede 50 MB. Divida as séries em arquivos menores.');
      const content = await file.text();
      const items = file.name.toLowerCase().endsWith('.csv') ? parseCSV(content) : parseJSON(content);
      const existing = items.filter(item => library.some(saved => saved.metadata.id === item.metadata.id));
      if (existing.length && !window.confirm(`${existing.length} ${existing.length === 1 ? 'série já existe' : 'séries já existem'} neste navegador. Substituir pelos registros do arquivo?`)) return;
      await store.saveMany(items); await refreshLibrary();
      for (const item of items) selected.add(item.metadata.id);
      renderLibrary(); showView('biblioteca');
      notify(`${items.length} ${items.length === 1 ? 'série importada' : 'séries importadas'} de ${file.name}.`);
    } finally { $('import-file').value = ''; }
  });
});

capture.addEventListener('change', renderCapture);
capture.addEventListener('sample', () => { renderLiveValues(); scheduleDraw(); });
capture.addEventListener('error', event => notify(errorMessage(event.detail), 'error'));
device.addEventListener('disconnected', () => {
  notify(capture.state === 'pending' ? 'A conexão caiu. Os dados recebidos foram preservados; salve a série interrompida.' : 'Sensor desconectado. Conecte novamente para registrar outra série.', 'warning');
  renderCapture();
});
window.addEventListener('beforeunload', event => { if (capture.series) { event.preventDefault(); event.returnValue = ''; } });
document.addEventListener('visibilitychange', () => { if (document.hidden && capture.state === 'recording') notify('A captura pode ser interrompida em segundo plano. Mantenha a página aberta e verifique as lacunas ao finalizar.', 'warning'); });
let resizeFrame;
new ResizeObserver(() => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(() => { if (currentView === 'analise') renderAnalysis(); else scheduleDraw(); }); }).observe($('main'));
function updateNetwork() { $('network-status').textContent = navigator.onLine ? 'Local por princípio.' : 'Sem rede · dados locais disponíveis'; }
window.addEventListener('online', updateNetwork); window.addEventListener('offline', updateNetwork); updateNetwork();
if (!window.isSecureContext) $('bluetooth-support').textContent = 'Abra em HTTPS ou localhost para habilitar o Bluetooth. A demonstração continua disponível.';
else if (!navigator.bluetooth) $('bluetooth-support').textContent = 'Este navegador não oferece Web Bluetooth. Use Chrome/Edge compatível ou explore a demonstração.';
if ('serviceWorker' in navigator && window.isSecureContext) window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { $('network-status').textContent = 'Cache offline indisponível neste navegador.'; }); });
showView(location.hash.slice(1)); renderCapture(); renderLibrary(); refreshLibrary();
