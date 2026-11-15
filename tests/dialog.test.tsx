import { render } from '@testing-library/react-native';
import * as React from 'react';

// On web, @rn-primitives/dialog renders Title and Description as plain DOM
// elements. React DOM throws on a style *array* ("Failed to set an indexed
// property on CSSStyleDeclaration"), which blanked the whole app when the
// order-cancel confirmation opened. Capture the props they receive.
const mockReceived: { title?: unknown; description?: unknown } = {};

jest.mock('@rn-primitives/slot', () => ({ Slot: jest.fn() }));
jest.mock('@/providers/app-provider', () => ({ useApp: () => ({ settings: { language: 'ko' } }) }));

jest.mock('@/components/ui/native-only-animated-view', () => ({
  NativeOnlyAnimatedView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('react-native-reanimated', () => ({
  FadeIn: {
    duration: () => ({ reduceMotion: () => ({}) }),
    delay: () => ({ reduceMotion: () => ({}) }),
  },
  FadeOut: { duration: () => ({ reduceMotion: () => ({}) }) },
  ReduceMotion: { System: 'system' },
}));
jest.mock('react-native-screens', () => ({
  FullWindowOverlay: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@rn-primitives/dialog', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Root: ({ children }: { children: React.ReactNode }) => children,
    Trigger: ({ children }: { children: React.ReactNode }) => children,
    Portal: ({ children }: { children: React.ReactNode }) => children,
    Close: ({ children }: { children: React.ReactNode }) => children,
    Overlay: ({ children }: { children: React.ReactNode }) => children,
    Content: ({ children }: { children: React.ReactNode }) => children,
    Title: (props: { style?: unknown; children?: React.ReactNode }) => {
      mockReceived.title = props.style;
      return <Text>{props.children}</Text>;
    },
    Description: (props: { style?: unknown; children?: React.ReactNode }) => {
      mockReceived.description = props.style;
      return <Text>{props.children}</Text>;
    },
    useRootContext: () => ({ onOpenChange: () => {} }),
  };
});

// eslint-disable-next-line import/first
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';

describe('dialog text styles', () => {
  it('passes a single style object to the title, keeping caller styles', async () => {
    await render(<DialogTitle style={{ color: 'red' }}>이 주문을 취소할까요?</DialogTitle>);
    expect(Array.isArray(mockReceived.title)).toBe(false);
    expect(mockReceived.title).toMatchObject({ fontSize: 20, lineHeight: 28, color: 'red' });
  });

  it('passes a single style object to the description, keeping caller styles', async () => {
    await render(<DialogDescription style={{ color: 'blue' }}>설명</DialogDescription>);
    expect(Array.isArray(mockReceived.description)).toBe(false);
    expect(mockReceived.description).toMatchObject({ fontSize: 16, lineHeight: 26, color: 'blue' });
  });
});
