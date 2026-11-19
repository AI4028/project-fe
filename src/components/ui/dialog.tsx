// Adapted from React Native Reusables (MIT); see THIRD_PARTY_NOTICES.md.
import { Icon } from '@/components/ui/icon';
import { NativeOnlyAnimatedView } from '@/components/ui/native-only-animated-view';
import { cn } from '@/lib/utils';
import { fontFamily, layout } from '@/lib/theme';
import { useTranslation } from '@/lib/i18n';
import { FontReadyContext, TextScaleContext } from './text';
import * as DialogPrimitive from '@rn-primitives/dialog';
import { X } from 'lucide-react-native';
import * as React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type ViewProps,
} from 'react-native';
import { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const FullWindowOverlay = Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment;

function DialogOverlay({
  className,
  children,
  onPress,
  sheet = false,
  ...props
}: Omit<React.ComponentProps<typeof DialogPrimitive.Overlay>, 'asChild'> & {
  children?: React.ReactNode;
  sheet?: boolean;
}) {
  const { onOpenChange } = DialogPrimitive.useRootContext();

  function onOverlayPress(event: GestureResponderEvent) {
    onPress?.(event);
    if (event.target === event.currentTarget && !event.isDefaultPrevented()) {
      onOpenChange(false);
    }
  }

  return (
    <FullWindowOverlay>
      <DialogPrimitive.Overlay
        className={cn(
          'absolute bottom-0 left-0 right-0 top-0 flex flex-col items-center justify-center bg-black/50 p-2',
          sheet && 'justify-end px-0 pb-0',
          Platform.select({
            web: 'animate-in fade-in-0 fixed cursor-default [&>*]:cursor-auto',
          }),
          className,
        )}
        {...props}
        onPress={Platform.select({ web: onOverlayPress, native: onPress })}
        asChild={Platform.OS !== 'web'}
      >
        <NativeOnlyAnimatedView
          entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}
          exiting={FadeOut.duration(150).reduceMotion(ReduceMotion.System)}
          as="Pressable"
        >
          <NativeOnlyAnimatedView
            className={sheet ? 'w-full' : undefined}
            entering={FadeIn.delay(50).reduceMotion(ReduceMotion.System)}
            exiting={FadeOut.duration(150).reduceMotion(ReduceMotion.System)}
          >
            <>{children}</>
          </NativeOnlyAnimatedView>
        </NativeOnlyAnimatedView>
      </DialogPrimitive.Overlay>
    </FullWindowOverlay>
  );
}
function DialogContent({
  className,
  portalHost,
  children,
  presentation = 'dialog',
  style,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  portalHost?: string;
  presentation?: 'dialog' | 'sheet';
}) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const insets = React.useContext(SafeAreaInsetsContext);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);
  const sheet = presentation === 'sheet' && width < layout.sheetBreakpoint;
  const availableWidth = width - (insets?.left ?? 0) - (insets?.right ?? 0);
  const dialogWidth = sheet ? availableWidth : Math.min(availableWidth - 16, 512);
  return (
    <DialogPortal hostName={portalHost}>
      <DialogOverlay sheet={sheet}>
        <DialogPrimitive.Content
          className={cn(
            'bg-card border-border z-50 mx-auto flex flex-col gap-5 border p-6 pt-16 shadow-lg shadow-black/5',
            sheet ? 'rounded-t-3xl border-b-0 px-4' : 'max-w-lg rounded-3xl',
            Platform.select({
              web: 'animate-in fade-in-0 zoom-in-95 duration-200',
            }),
            className,
          )}
          {...props}
          onOpenAutoFocus={(event) => {
            if (Platform.OS === 'web' && document.activeElement instanceof HTMLElement)
              previouslyFocused.current = document.activeElement;
            onOpenAutoFocus?.(event);
          }}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            const previous = previouslyFocused.current;
            if (!event.defaultPrevented && previous?.isConnected) {
              event.preventDefault();
              previous.focus();
            }
          }}
          style={StyleSheet.flatten([
            { width: dialogWidth, maxHeight: height - (insets?.top ?? 0) - 16 },
            sheet && { paddingBottom: Math.max(insets?.bottom ?? 0, 16) },
            style,
          ])}
        >
          <>{children}</>
          <DialogPrimitive.Close
            className={cn(
              'absolute right-3 top-3 h-12 w-12 items-center justify-center rounded-xl',
              Platform.select({
                web: 'ring-offset-background focus:ring-ring data-[state=open]:bg-accent transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2',
              }),
            )}
            accessibilityLabel={t('대화상자 닫기')}
          >
            <Icon
              as={X}
              className={cn('text-accent-foreground web:pointer-events-none size-4 shrink-0')}
            />
            <Text className="sr-only">{t('닫기')}</Text>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogOverlay>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: ViewProps) {
  return (
    <View className={cn('flex flex-col gap-2 text-center sm:text-left', className)} {...props} />
  );
}

function DialogFooter({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  const { t } = useTranslation();
  const scale = React.useContext(TextScaleContext);
  const fontReady = React.useContext(FontReadyContext);
  return (
    <DialogPrimitive.Title
      className={cn('text-foreground text-xl font-bold leading-7', className)}
      {...props}
      children={typeof props.children === 'string' ? t(props.children) : props.children}
      // On web the primitive renders a plain DOM element, which accepts only a
      // single style object: a style array crashes React ("Failed to set an
      // indexed property on CSSStyleDeclaration"). Flatten on every platform.
      style={StyleSheet.flatten([
        {
          fontSize: 20 * scale,
          lineHeight: 28 * scale,
          fontFamily: fontReady ? fontFamily.bold : undefined,
          fontWeight: fontReady ? 'normal' : 'bold',
        },
        props.style,
      ])}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  const { t } = useTranslation();
  const scale = React.useContext(TextScaleContext);
  const fontReady = React.useContext(FontReadyContext);
  return (
    <DialogPrimitive.Description
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
      children={typeof props.children === 'string' ? t(props.children) : props.children}
      // Flattened for the same reason as DialogTitle: web renders a DOM element.
      style={StyleSheet.flatten([
        {
          fontSize: 16 * scale,
          lineHeight: 26 * scale,
          fontFamily: fontReady ? fontFamily.regular : undefined,
        },
        props.style,
      ])}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
