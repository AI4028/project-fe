import { Api, ApiError, errorMessage, normalizeBase } from '@/lib/api';
test('sends device auth and unpriced lines to the backend', async () => {
  const transport = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ total: 3000 }) });
  const api = new Api('https://example.test/', transport);
  const items = [{ itemId: 'coffee', qty: 1, options: { size: 'large' } }];
  await api.cart('session-id', items, 'dev_test');
  expect(transport).toHaveBeenCalledWith(
    'https://example.test/sessions/session-id/cart',
    expect.objectContaining({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer dev_test' },
      body: JSON.stringify({ items }),
    }),
  );
  expect(api.wsUrl('/ws/kiosk', 'a+b&c')).toBe('wss://example.test/ws/kiosk?token=a%2Bb%26c');
});
test('surfaces server failures rather than creating a fake offline order', async () => {
  const transport = jest.fn().mockResolvedValue({
    ok: false,
    status: 409,
    json: async () => ({ error: 'kiosk-busy', message: 'Busy' }),
  });
  await expect(
    new Api('http://localhost:8000', transport).connect('GK01', 'ABCDEFGH', 'dev_test'),
  ).rejects.toMatchObject({ code: 'kiosk-busy', status: 409 });
  expect(errorMessage(new ApiError('kiosk-busy', 409, 'Busy'))).toContain('다른 고객');
  expect(transport).toHaveBeenCalledTimes(1);
});
test('rejects credentials and non-HTTP server URLs', () => {
  for (const url of [
    'javascript:alert(1)',
    'https://user:pass@example.test',
    'https://example.test/?key=x',
  ])
    expect(() => normalizeBase(url)).toThrow();
});
test('aborts requests after timeout and does not retry order submission', async () => {
  jest.useFakeTimers();
  const transport = jest.fn(
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () =>
          reject(Object.assign(new Error('timeout'), { name: 'AbortError' })),
        );
      }),
  ) as unknown as typeof fetch;
  const pending = new Api('https://example.test', transport).submit(
    's',
    [],
    'counter',
    '',
    'dev_test',
  );
  const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  await jest.advanceTimersByTimeAsync(12000);
  await assertion;
  expect(transport).toHaveBeenCalledTimes(1);
  jest.useRealTimers();
});

test('keeps the global receiver required by browser fetch', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = function (this: unknown) {
    expect(this).toBe(globalThis);
    return Promise.resolve({ ok: true, json: async () => [] } as unknown as Response);
  };
  try {
    await expect(new Api('https://example.test').stores()).resolves.toEqual([]);
  } finally {
    globalThis.fetch = original;
  }
});
