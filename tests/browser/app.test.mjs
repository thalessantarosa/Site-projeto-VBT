import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from '../../scripts/serve.mjs';
import { createDemoSeries, serializeJSON, parseJSON, parseCSV } from '../../web/js/core.js';
import { readFile } from 'node:fs/promises';

async function withApp(run) {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    await run(browser, `http://127.0.0.1:${server.address().port}`);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}

test('demonstração salva, recarrega, filtra, compara, exporta e restaura séries no navegador', { timeout: 60000 }, async () => {
  await withApp(async (browser, url) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, acceptDownloads: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.locator('#demo').click();
    await page.locator('#save-destination').selectOption('browser');
    await page.locator('#save').click();
    await page.waitForFunction(() => !document.getElementById('view-biblioteca').hidden);
    await page.locator('#compare').click({ timeout: 3000 });
    assert.equal(await page.locator('#analysis-rows tr').count(), 1);
    await page.locator('#channel').selectOption('gMag');
    await page.locator('#time-scale').selectOption('normalized');
    await page.screenshot({ path: 'test-results/analysis-desktop.png', fullPage: true });
    await page.reload();
    await page.locator('.main-nav [data-view="biblioteca"]').click();
    await page.waitForFunction(() => document.querySelectorAll('#series-rows tr').length === 1);

    const fixtures = Array.from({ length: 10 }, (_, i) => createDemoSeries({ exercise: i % 2 ? 'Supino' : 'Agachamento', loadKg: 20 + i * 10, notes: `Ensaio ${i}` }));
    await page.locator('#import-file').setInputFiles({ name: 'series.json', mimeType: 'application/json', buffer: Buffer.from(serializeJSON(fixtures)) });
    await page.waitForFunction(() => document.querySelectorAll('#series-rows tr').length === 11);
    await page.locator('#exercise-filter').selectOption('Supino');
    await page.locator('#min-load').fill('70');
    assert.equal(await page.locator('#series-rows tr').count(), 3);
    await page.locator('#search').fill('Ensaio 7');
    assert.equal(await page.locator('#series-rows tr').count(), 1);
    await page.locator('#clear-filters').click();
    // Imports select all imported series; select-all completes the selection.
    await page.locator('#select-all').check();
    const jsonEvent = page.waitForEvent('download');
    await page.locator('#export-json').click();
    const json = parseJSON(await readFile(await (await jsonEvent).path(), 'utf8'));
    assert.equal(json.length, 11);
    const csvEvent = page.waitForEvent('download');
    await page.locator('#export-csv').click();
    const csvText = await readFile(await (await csvEvent).path(), 'utf8');
    const csv = parseCSV(csvText);
    assert.deepEqual(csv, json);
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#delete').click();
    await page.waitForFunction(() => document.querySelectorAll('#series-rows tr').length === 0);
    await page.locator('#import-file').setInputFiles({ name: 'restaurar.csv', mimeType: 'text/csv', buffer: Buffer.from(csvText) });
    await page.waitForFunction(() => document.querySelectorAll('#series-rows tr').length === 11);
    await page.locator('#compare').click();
    assert.equal(await page.locator('#analysis-rows tr').count(), 11);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: 'test-results/analysis-mobile.png', fullPage: true });
    assert.deepEqual(errors, []);
  });
});
