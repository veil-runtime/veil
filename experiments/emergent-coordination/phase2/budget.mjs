// Extended smoke only. Each call first reserves its full byte-based upper
// bound. A completed response with valid provider usage can settle that call;
// missing or uncertain usage leaves the full reservation charged.
export function settledTokenBudget(ceiling) {
  if (!Number.isSafeInteger(ceiling) || ceiling < 1) throw new Error('Invalid token ceiling');
  let exposure = 0;
  let grossReserved = 0;
  let settledReported = 0;
  let nextTicket = 1;
  const pending = new Map();
  return {
    reserve(tokens) {
      if (!Number.isSafeInteger(tokens) || tokens < 1 || tokens > ceiling - exposure) return false;
      const ticket = nextTicket++;
      pending.set(ticket, tokens);
      exposure += tokens;
      grossReserved += tokens;
      return ticket;
    },
    settle(ticket, { inputBound, outputCap, response }) {
      const reservation = pending.get(ticket);
      if (reservation === undefined) throw new Error('Unknown or already settled reservation');
      pending.delete(ticket);
      const input = response?.metadata?.inputTokens;
      const output = response?.metadata?.outputTokens;
      if (!response?.ok || !Number.isSafeInteger(input) || input < 1 ||
          !Number.isSafeInteger(output) || output < 0) {
        return { status: 'held', chargedTokens: reservation };
      }
      if (input > inputBound || output > outputCap || input + output > reservation) {
        return { status: 'invalid-usage', chargedTokens: reservation };
      }
      const reported = input + output;
      exposure -= reservation - reported;
      settledReported += reported;
      return { status: 'settled', chargedTokens: reported, releasedTokens: reservation - reported };
    },
    get reserved() { return exposure; },
    get grossReserved() { return grossReserved; },
    get settledReported() { return settledReported; },
  };
}
