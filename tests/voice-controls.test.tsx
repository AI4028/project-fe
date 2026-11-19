import { fireEvent, render, screen } from '@testing-library/react-native';
import { VoiceControls } from '@/components/voice-controls';

const mockRepeat = jest.fn();
// Mirror Expo Go: the native module is missing and importing the package throws.
jest.mock('expo', () => ({
  ...jest.requireActual('expo'),
  requireOptionalNativeModule: () => null,
}));
jest.mock('expo-speech-recognition', () => {
  throw new Error("Cannot find native module 'ExpoSpeechRecognition'");
});
jest.mock('expo-speech', () => ({ stop: jest.fn(), speak: jest.fn() }));
jest.mock('@/providers/app-provider', () => ({ useApp: () => ({ repeat: mockRepeat }) }));
jest.mock('@/components/ui/text', () => ({ Text: require('react-native').Text }));
jest.mock('@/components/ui/button', () => ({ Button: require('react-native').Pressable }));

test('falls back to touch-only controls without the speech recognition module', async () => {
  await render(<VoiceControls />);
  expect(screen.queryByLabelText('음성으로 주문하기')).toBeNull();
  expect(screen.getByText(/터치로 주문해 주세요/)).toBeTruthy();
  await fireEvent.press(screen.getByText('다시 듣기'));
  expect(mockRepeat).toHaveBeenCalled();
});
