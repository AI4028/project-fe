import { useFocusEffect } from 'expo-router';
import { useCallback, type RefObject } from 'react';
import { Platform } from 'react-native';

// The first screen of a page load keeps the browser's natural reading start.
let initialScreen = true;

function shown(element: Element | null): element is HTMLElement {
  return (
    !!element &&
    element !== document.body &&
    element.isConnected &&
    element.getClientRects().length > 0
  );
}

/**
 * On web the stack hides the previous screen with `display: none`, taking the
 * control that opened the new screen with it. VoiceOver is then left on an
 * invisible spot and the next swipe jumps to the browser toolbar. Move focus to
 * the new screen's heading so screen readers start reading at its top.
 */
export function useScreenFocus(target: RefObject<unknown>) {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web') return;
      if (initialScreen) {
        initialScreen = false;
        return;
      }
      const frame = requestAnimationFrame(() => {
        const heading = target.current as HTMLElement | null;
        // Leave focus alone when the new screen already placed it, e.g. an autofocused field.
        if (!heading || shown(document.activeElement)) return;
        if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      });
      return () => cancelAnimationFrame(frame);
    }, [target]),
  );
}

export function resetScreenFocusForTests() {
  initialScreen = true;
}
