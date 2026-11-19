import { render } from '@testing-library/react-native';
import type { LucideIcon } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { View } from 'react-native';
import { Icon } from '@/components/ui/icon';

jest.mock('@rn-primitives/slot', () => ({ Slot: jest.fn() }));
jest.mock('nativewind', () => ({
  cssInterop: jest.fn((component) => component),
}));

test('registers color in cssInterop nativeStyleToProp for native SVG icons', () => {
  expect(cssInterop).toHaveBeenCalledWith(
    expect.any(Function),
    expect.objectContaining({
      className: expect.objectContaining({
        target: 'style',
        nativeStyleToProp: expect.objectContaining({
          color: true,
          height: 'size',
          width: 'size',
        }),
      }),
    }),
  );
});

test('resolves currentColor fill to the icon color prop without altering none fills', async () => {
  const received: Record<string, unknown>[] = [];
  const StubIcon = ((props: Record<string, unknown>) => {
    received.push(props);
    return <View />;
  }) as unknown as LucideIcon;

  await render(<Icon as={StubIcon} color="#654B3C" fill="currentColor" />);
  await render(<Icon as={StubIcon} color="#654B3C" fill="none" />);

  expect(received[0]).toMatchObject({ color: '#654B3C', fill: '#654B3C' });
  expect(received[1]).toMatchObject({ color: '#654B3C', fill: 'none' });
});
