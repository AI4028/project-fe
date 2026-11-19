import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { VoiceControls } from '@/components/voice-controls';
import { VoiceSearch } from '@/components/voice-search';

const mockStart = jest.fn();
const mockStop = jest.fn();
const mockAbort = jest.fn();
const mockRequestPermissions = jest.fn();
const mockIsAvailable = jest.fn();
const mockRepeat = jest.fn();
const mockAnnounce = jest.fn();
const mockReport = jest.fn();

jest.mock('expo-speech', () => ({ stop: jest.fn(), speak: jest.fn() }));
jest.mock('@/lib/speech-recognition', () => ({
  recognition: {
    ExpoSpeechRecognitionModule: {
      isRecognitionAvailable: () => mockIsAvailable(),
      requestPermissionsAsync: () => mockRequestPermissions(),
      start: (options: unknown) => mockStart(options),
      stop: () => mockStop(),
      abort: () => mockAbort(),
    },
    useSpeechRecognitionEvent: jest.fn(),
  },
}));
jest.mock('@/providers/app-provider', () => ({
  useApp: () => ({
    repeat: mockRepeat,
    announce: mockAnnounce,
    report: mockReport,
    store: null,
  }),
}));
jest.mock('@/components/ui/text', () => ({ Text: require('react-native').Text }));
jest.mock('@/components/ui/button', () => ({ Button: require('react-native').Pressable }));
jest.mock('@/components/ui/input', () => ({ Input: require('react-native').TextInput }));
jest.mock('@/components/ui/icon', () => ({ Icon: () => null }));

const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAvailable.mockReturnValue(true);
  mockRequestPermissions.mockResolvedValue({ granted: true });
  // Leave Speech.stop unresolved to prove web calls start() synchronously.
  jest.mocked(Speech.stop).mockReturnValue(new Promise(() => {}));
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
});

afterAll(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
});

test('VoiceControls falls back to touch-only when speech recognition is unavailable', async () => {
  mockIsAvailable.mockReturnValue(false);
  await render(<VoiceControls />);
  expect(screen.queryByLabelText('음성으로 주문하기')).toBeNull();
  expect(screen.getByText(/터치로 주문해 주세요/)).toBeTruthy();
});

test('VoiceControls starts synchronously on web without awaiting Speech.stop or permissions', async () => {
  await render(<VoiceControls />);
  await fireEvent.press(screen.getByLabelText('음성으로 주문하기'));
  expect(Speech.stop).toHaveBeenCalledTimes(1);
  expect(mockRequestPermissions).not.toHaveBeenCalled();
  expect(mockStart).toHaveBeenCalledWith({
    lang: 'ko-KR',
    interimResults: false,
    continuous: false,
  });
});

test('VoiceSearch starts synchronously on web without awaiting Speech.stop or permissions', async () => {
  await render(
    <VoiceSearch query="" onEdit={jest.fn()} onSearch={jest.fn()} onClose={jest.fn()} />,
  );
  await fireEvent.press(screen.getByText('마이크 켜고 말하기'));
  expect(Speech.stop).toHaveBeenCalledTimes(1);
  expect(mockRequestPermissions).not.toHaveBeenCalled();
  expect(mockStart).toHaveBeenCalledWith({
    lang: 'ko-KR',
    interimResults: false,
    continuous: false,
  });
});
