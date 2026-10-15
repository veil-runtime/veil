import { runModelTrial } from './host.mjs';

// This process owns Veil and the private world. The model adapter and API key
// exist only in the parent. IPC carries model-visible observations one at a time.
const pending = new Map();
let nextRequest = 1;
let started = false;
process.on('message', async message => {
  if (message?.type === 'decision-response') {
    const resolve = pending.get(message.requestId);
    if (resolve) { pending.delete(message.requestId); resolve(message.answer); }
    return;
  }
  if (message?.type !== 'start' || started) return;
  started = true;
  try {
    const trial = await runModelTrial({ ...message.config,
      decide: ({ audience, observation }) => new Promise(resolve => {
        const requestId = nextRequest++;
        pending.set(requestId, resolve);
        process.send({ type: 'model-request', requestId, audience, observation });
      }),
      onEvent: event => process.send({ type: 'host-event', event }),
    });
    process.send({ type: 'result', trial, hostCredentialPresent: Boolean(process.env.OPENAI_API_KEY) });
  } catch (error) {
    process.send({ type: 'host-failure', category: error instanceof Error ? error.name : 'unknown' });
  } finally { process.disconnect(); }
});
