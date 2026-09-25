import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export async function startHost(prefix, timeoutMs = 60000) {
  const child = fork(fileURLToPath(new URL('./host.mjs', import.meta.url)), [prefix], {
    env: { JOB_STORE: 'memory' }, execArgv: [], silent: true,
  });
  // Runtime logs and stacks are never model input or provider error text.
  child.stdout.resume(); child.stderr.resume();
  let pending;
  let sequence = 0;
  let closed = false;
  const ready = new Promise((resolve, reject) => {
    pending = { resolve, reject };
  });
  child.on('message', message => {
    if (message.type === 'ready' || message.id === pending?.id) {
      const waiter = pending; pending = undefined;
      if (message.error) waiter?.reject(new Error(message.error));
      else waiter?.resolve(message);
    }
  });
  const fail = () => { closed = true; pending?.reject(new Error('host-disconnected')); pending = undefined; };
  child.on('error', fail); child.on('exit', fail);
  async function bounded(promise, deadlineMs = timeoutMs) {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => { child.kill(); reject(new Error('host-timeout')); }, deadlineMs);
    })]); } finally { clearTimeout(timer); }
  }
  await bounded(ready);
  async function call(type, text, deadlineMs) {
    if (closed || pending) throw new Error('host-unavailable');
    const id = ++sequence;
    const response = new Promise((resolve, reject) => { pending = { id, resolve, reject }; });
    child.send({ id, type, ...(text === undefined ? {} : { text }) });
    return bounded(response, deadlineMs);
  }
  return {
    request: (text, deadlineMs) => call('request', text, deadlineMs),
    close: async () => {
      try { return (await call('close')).report; }
      catch (error) { child.kill(); throw error; }
    },
    kill: () => child.kill(),
  };
}
