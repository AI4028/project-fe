import type { LiveEvent } from './types';
export function subscribe(
  url: string,
  onEvent: (event: LiveEvent) => void,
  onConnect: () => void,
  onAuthError: () => void,
  makeSocket = (address: string) => new WebSocket(address),
) {
  let stopped = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let socket: WebSocket;
  function connect() {
    if (stopped) return;
    socket = makeSocket(url);
    socket.onopen = () => {
      attempt = 0;
      onConnect();
    };
    socket.onmessage = (event) => {
      try {
        const message: unknown = JSON.parse(String(event.data));
        if (
          message &&
          typeof message === 'object' &&
          'type' in message &&
          typeof message.type === 'string'
        )
          onEvent(message as LiveEvent);
      } catch {
        /* Ignore malformed network frames, never execute them. */
      }
    };
    socket.onerror = () => socket.close();
    socket.onclose = (event) => {
      if (stopped) return;
      if ([4401, 4403, 4404].includes(event.code)) {
        onAuthError();
        return;
      }
      timer = setTimeout(connect, Math.min(1000 * 2 ** attempt++, 30000));
    };
  }
  connect();
  return () => {
    stopped = true;
    clearTimeout(timer);
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    socket.close();
  };
}
