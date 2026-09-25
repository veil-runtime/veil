import { anthropicAdapter } from './providers/anthropic.mjs';
import { openaiAdapter } from './providers/openai.mjs';
import { runTrial } from './driver.mjs';
process.once('message', async config => {
  try {
    const adapterFactory = config.provider === 'openai' ? openaiAdapter : anthropicAdapter;
    const apiKey = config.provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY;
    const adapter = adapterFactory({ apiKey,
      model: config.model, temperature: config.temperature });
    const trial = await runTrial({ ...config, adapter,
      onEvent: event => process.send({ type: 'event', event }) });
    process.send({ type: 'result', trial }, () => process.disconnect());
  } catch {
    process.send({ type: 'error', category: 'worker-error' }, () => process.disconnect());
  }
});
