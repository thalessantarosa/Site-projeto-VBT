import { channelValue } from './core.js';

// Color and line pattern both identify a series; no smoothing or fabricated points.
export const SERIES_COLORS = ['#176451', '#356fa4', '#a35b1f', '#77549c', '#b03f60', '#526c29'];
export const SERIES_DASHES = [[], [7, 4], [2, 4], [10, 3, 2, 3], [12, 5], [3, 3, 8, 3]];
export function seriesStyle(index) {
  return { color: SERIES_COLORS[index % SERIES_COLORS.length], dash: SERIES_DASHES[(index + Math.floor(index / SERIES_COLORS.length)) % SERIES_DASHES.length] };
}
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export function drawChart(canvas, series = [], channel = 'az', normalized = false) {
  const bounds = canvas.getBoundingClientRect();
  if (bounds.width < 1 || bounds.height < 1) return [];
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(bounds.width * dpr);
  canvas.height = Math.round(bounds.height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.scale(dpr, dpr);
  const width = bounds.width, height = bounds.height;
  const left = width < 400 ? 43 : 51, right = 15, top = 18, bottom = 39;
  const plotW = width - left - right, plotH = height - top - bottom;
  ctx.clearRect(0, 0, width, height);
  const rows = series.filter(s => s.samples.length > 0).map(s => {
    let minT = Infinity, maxT = -Infinity, min = Infinity, max = -Infinity;
    for (const sample of s.samples) {
      minT = Math.min(minT, sample[1]); maxT = Math.max(maxT, sample[1]);
      const value = channelValue(sample, channel);
      min = Math.min(min, value); max = Math.max(max, value);
    }
    return { series: s, minT, maxT, min, max };
  });
  let minY = 0, maxY = 0, maxX = normalized ? 100 : 1;
  for (const row of rows) {
    minY = Math.min(minY, row.min); maxY = Math.max(maxY, row.max);
    if (!normalized) maxX = Math.max(maxX, (row.maxT - row.minT) / 1e6);
  }
  if (rows.length === 0) { minY = -2; maxY = 12; maxX = normalized ? 100 : 12; }
  const padding = (maxY - minY || 1) * .12;
  minY -= padding; maxY += padding;
  const x = value => left + value / maxX * plotW;
  const y = value => top + (maxY - value) / (maxY - minY) * plotH;
  ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const value = minY + i / 4 * (maxY - minY), py = y(value);
    ctx.strokeStyle = '#e6ebe6'; ctx.beginPath(); ctx.moveTo(left, py); ctx.lineTo(width - right, py); ctx.stroke();
    ctx.fillStyle = '#5b6862'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(number.format(value), left - 8, py);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let i = 0; i <= 4; i++) {
    const value = i / 4 * maxX;
    ctx.fillText(number.format(value), x(value), height - bottom + 10);
  }
  ctx.textAlign = 'right'; ctx.fillText(normalized ? '%' : 's', width - 1, height - bottom + 10);
  ctx.textAlign = 'left'; ctx.fillText(channel.startsWith('g') ? 'rad/s' : 'm/s²', 1, 0);
  ctx.save(); ctx.beginPath(); ctx.rect(left, top, plotW, plotH); ctx.clip();
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index], duration = row.maxT - row.minT;
    const style = seriesStyle(index);
    ctx.strokeStyle = style.color;
    ctx.setLineDash(style.dash); ctx.lineWidth = 1.6;
    ctx.beginPath();
    let previous = null;
    for (const sample of row.series.samples) {
      const time = normalized ? (duration ? (sample[1] - row.minT) / duration * 100 : 0) : (sample[1] - row.minT) / 1e6;
      const gap = previous && (sample[1] <= previous[1] || sample[1] - previous[1] > 2.5e6 / row.series.metadata.sampleRateHz || (sample[0] - previous[0] + 65536) % 65536 !== 1);
      if (!previous || gap) ctx.moveTo(x(time), y(channelValue(sample, channel)));
      else ctx.lineTo(x(time), y(channelValue(sample, channel)));
      previous = sample;
    }
    ctx.stroke();
    if (row.series.samples.length === 1) {
      ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(x(0), y(row.min), 3, 0, 2 * Math.PI); ctx.fill();
    }
  }
  ctx.restore();
  return rows;
}
