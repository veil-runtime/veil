export function parseConfig(text) {
  return Object.fromEntries(
    text.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const index = line.indexOf('=');
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim();
        return [key, value];
      })
  );
}
