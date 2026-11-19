import { subscribe } from '@/lib/live';
test('reconnects, ignores malformed frames, and cancels retries on disposal', () => {
  jest.useFakeTimers();
  const socket = {
    close: jest.fn(),
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null,
  } as unknown as WebSocket;
  const factory = jest.fn(() => socket);
  const event = jest.fn();
  const open = jest.fn();
  const auth = jest.fn();
  const stop = subscribe('wss://example.test', event, open, auth, factory);
  socket.onmessage?.({ data: '{invalid' } as MessageEvent);
  socket.onmessage?.({ data: '{"type":"cart"}' } as MessageEvent);
  expect(event).toHaveBeenCalledTimes(1);
  socket.onclose?.({ code: 1006 } as CloseEvent);
  jest.advanceTimersByTime(1000);
  expect(factory).toHaveBeenCalledTimes(2);
  socket.onclose?.({ code: 4401 } as CloseEvent);
  expect(auth).toHaveBeenCalledTimes(1);
  stop();
  jest.advanceTimersByTime(30000);
  expect(factory).toHaveBeenCalledTimes(2);
  jest.useRealTimers();
});
