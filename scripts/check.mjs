import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(`${directory}/${entry.name}`) : `${directory}/${entry.name}`))).flat();
}

let count = 0;
for (const file of [...await files('web'), ...await files('scripts')].filter(file => /\.m?js$/.test(file))) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) { console.error(result.stderr); process.exitCode = 1; }
  count++;
}
if (!process.exitCode) console.log(`Sintaxe JavaScript verificada: ${count} arquivos.`);
