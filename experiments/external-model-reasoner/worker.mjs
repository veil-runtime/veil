import { anthropicAdapter } from './providers/anthropic.mjs';
import { runTrial } from './driver.mjs';
process.once('message', async config => {
  try {
    const adapter = anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY,
      model: config.model, temperature: config.temperature });
    const trial = await runTrial({ ...config, adapter,
      onEvent: event => process.send({ type: 'event', event }) });
    process.send({ type: 'result', trial }, () => process.disconnect());
  } catch {
    process.send({ type: 'error', category: 'worker-error' }, () => process.disconnect());
  }
});
