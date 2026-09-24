// Dedicated, credential-free process. No model/provider integration here.
import { createFixtureHost } from '../external-reasoner/fixture-host.mjs';
const fixture = await createFixtureHost(process.argv[2], { detailed: true });
let chain = Promise.resolve();
process.on('message', message => {
  chain = chain.then(async () => {
    if (message.type === 'request') {
      try { process.send({ id: message.id, ...(await fixture.request(message.text)) }); }
      catch { process.send({ id: message.id, error: 'host-protocol-error' }); }
    } else if (message.type === 'close') {
      const report = fixture.report();
      await fixture.close();
      process.send({ id: message.id, report }, () => process.disconnect());
    }
  }).catch(async () => { await fixture.close(); process.exitCode = 1; process.disconnect(); });
});
process.on('disconnect', () => { void chain.then(() => fixture.close()); });
process.send({ type: 'ready' });
