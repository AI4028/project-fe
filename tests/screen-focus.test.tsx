import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { resetScreenFocusForTests, useScreenFocus } from '@/lib/use-screen-focus';

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) =>
    require('react').useEffect(effect, [effect]),
}));

// The React Native preset cannot run in jsdom, so model just the DOM the hook reads.
type FakeElement = {
  attributes: Record<string, string>;
  isConnected: boolean;
  rects: number;
  hasAttribute(name: string): boolean;
  setAttribute(name: string, value: string): void;
  getClientRects(): unknown[];
  focus(): void;
};
const page = { body: {} as unknown, activeElement: null as unknown };

function element(rects = 0): FakeElement {
  return {
    attributes: {},
    isConnected: true,
    rects,
    hasAttribute(name) {
      return name in this.attributes;
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    getClientRects() {
      return Array.from({ length: this.rects });
    },
    focus() {
      page.activeElement = this;
    },
  };
}

const originalOS = Platform.OS;
const originalFrame = global.requestAnimationFrame;

beforeEach(() => {
  page.activeElement = page.body;
  resetScreenFocusForTests();
  Object.defineProperty(global, 'document', { configurable: true, value: page });
  global.requestAnimationFrame = (callback) => {
    callback(0);
    return 0;
  };
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
});

afterAll(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
  global.requestAnimationFrame = originalFrame;
  delete (global as { document?: unknown }).document;
});

test('a screen opened after the first moves focus to its heading', async () => {
  const first = { current: element() };
  await renderHook(() => useScreenFocus(first));
  expect(page.activeElement).toBe(page.body);

  // The control that opened the next screen is hidden along with its screen.
  element(0).focus();
  const next = { current: element() };
  await renderHook(() => useScreenFocus(next));

  expect(page.activeElement).toBe(next.current);
  expect(next.current.attributes.tabindex).toBe('-1');
});

test('focus already placed on a visible control stays there', async () => {
  await renderHook(() => useScreenFocus({ current: element() }));
  const field = element(1);
  field.focus();

  await renderHook(() => useScreenFocus({ current: element() }));

  expect(page.activeElement).toBe(field);
});

test('native screen readers keep their own screen-change focus', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  await renderHook(() => useScreenFocus({ current: element() }));
  const next = { current: element() };
  await renderHook(() => useScreenFocus(next));

  expect(page.activeElement).toBe(page.body);
});
