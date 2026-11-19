import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export type SpeechRecognition = typeof import('expo-speech-recognition');

// The module is absent in Expo Go, while web supplies a browser implementation.
export const recognition: SpeechRecognition | null =
  Platform.OS === 'web' || requireOptionalNativeModule('ExpoSpeechRecognition')
    ? require('expo-speech-recognition')
    : null;
