import 'server-only';

import { join } from 'node:path';
import { createWorker, OEM, type Worker } from 'tesseract.js';
import { normalizeClientNoteText } from '@/lib/client-notes';

let workerPromise: Promise<Worker> | undefined;
let queue = Promise.resolve();

function localWorker() {
  workerPromise ??= createWorker('eng', OEM.LSTM_ONLY, {
    langPath: join(process.cwd(), 'node_modules', '@tesseract.js-data', 'eng', '4.0.0'),
    cacheMethod: 'none',
  });
  return workerPromise;
}

export function extractClientNoteText(image: Buffer): Promise<string> {
  const run = queue.then(async () => {
    const worker = await localWorker();
    const result = await worker.recognize(image);
    return normalizeClientNoteText(result.data.text);
  });
  queue = run.then(() => undefined, () => undefined);
  return run;
}
