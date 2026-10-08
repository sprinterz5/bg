import { beforeEach, expect, jest, test } from '@jest/globals';
import * as SecureStore from 'expo-secure-store';

import { api, ApiError, saveTokens } from '../api';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});

type FetchInit = { headers: Record<string, string>; signal: AbortSignal };
const fetchMock = jest.fn<(url: string, init: FetchInit) => Promise<unknown>>();
global.fetch = fetchMock as unknown as typeof fetch;

const reply = (status: number, body: unknown) =>
  Promise.resolve({ status, ok: status >= 200 && status < 300, text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)) });

const headersOf = (call: number) => fetchMock.mock.calls[call]![1].headers;

beforeEach(() => {
  fetchMock.mockReset();
});

test('returns the parsed JSON body', async () => {
  fetchMock.mockReturnValueOnce(reply(200, { ok: 1 }));
  await expect(api('/x')).resolves.toEqual({ ok: 1 });
});

test('a non-JSON error page is an ApiError, not a crash', async () => {
  fetchMock.mockReturnValueOnce(reply(502, '<html>Bad gateway</html>'));
  await expect(api('/x')).rejects.toMatchObject({ status: 502 });
});

test('idempotent writes retry once with the same Idempotency-Key after a dropped connection', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('Network request failed')).mockReturnValueOnce(reply(201, { id: 'm1' }));
  await expect(api('/messages', { body: { text: 'hi' }, idempotent: true })).resolves.toEqual({ id: 'm1' });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(headersOf(0)['Idempotency-Key']).toBeTruthy();
  expect(headersOf(1)['Idempotency-Key']).toBe(headersOf(0)['Idempotency-Key']);
});

test('other writes are not retried', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
  await expect(api('/x', { body: {} })).rejects.toThrow('Network request failed');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(headersOf(0)['Idempotency-Key']).toBeUndefined();
});

test('an expired access token is refreshed once and the request repeated', async () => {
  await saveTokens({ accessToken: 'old', refreshToken: 'r1' });
  fetchMock
    .mockReturnValueOnce(reply(401, { error: 'expired' }))
    .mockReturnValueOnce(reply(200, { accessToken: 'new', refreshToken: 'r2' }))
    .mockReturnValueOnce(reply(200, { me: true }));
  await expect(api('/me', { auth: true })).resolves.toEqual({ me: true });
  expect(headersOf(0).Authorization).toBe('Bearer old');
  expect(fetchMock.mock.calls[1]![0]).toMatch(/\/auth\/refresh$/);
  expect(headersOf(2).Authorization).toBe('Bearer new');
  expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith(expect.any(String), 'r2');
});

test('a hung request times out as ApiError 0', async () => {
  jest.useFakeTimers();
  fetchMock.mockImplementationOnce(
    (_url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))),
  );
  const pending = api('/slow');
  jest.advanceTimersByTime(20_000);
  await expect(pending).rejects.toEqual(new ApiError(0, 'timeout'));
  jest.useRealTimers();
});
