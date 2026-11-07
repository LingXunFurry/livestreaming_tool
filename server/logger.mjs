import fs from 'node:fs';
import path from 'node:path';

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    /token|cookie|password|authorization|secret/i.test(key) ? '[REDACTED]' : redact(item),
  ]));
}

export function createLogger(directory, { maxBytes = 1024 * 1024, keep = 3 } = {}) {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'runtime.log');
  return function log(event, fields = {}) {
    const entry = `${JSON.stringify({ time: new Date().toISOString(), event, ...redact(fields) })}\n`;
    const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
    if (size + Buffer.byteLength(entry) > maxBytes) {
      for (let index = keep; index >= 1; index -= 1) {
        const destination = `${file}.${index}`;
        const source = index === 1 ? file : `${file}.${index - 1}`;
        if (fs.existsSync(destination)) fs.unlinkSync(destination);
        if (fs.existsSync(source)) fs.renameSync(source, destination);
      }
    }
    fs.appendFileSync(file, entry, { mode: 0o600 });
  };
}
