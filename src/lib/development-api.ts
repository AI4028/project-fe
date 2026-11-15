// On a physical phone, localhost means the phone rather than the Metro computer.
export function developmentApiBase(base: string, hostUri: string | undefined, native: boolean) {
  if (!native || !hostUri) return base;
  const url = new URL(base);
  const host = new URL(`http://${hostUri}`).hostname;
  if (
    url.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
    /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)
  )
    url.hostname = host;
  return url.toString().replace(/\/$/, '');
}
