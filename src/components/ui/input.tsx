// Adapted from React Native Reusables (MIT); see THIRD_PARTY_NOTICES.md.
import { cn } from '@/lib/utils';
import { useContext } from 'react';
import { TextScaleContext, FontReadyContext } from './text';
import { Platform, TextInput } from 'react-native';

function Input({
  className,
  ...props
}: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput>) {
  const scale = useContext(TextScaleContext);
  const fontsReady = useContext(FontReadyContext);
  return (
    <TextInput
      className={cn(
        'border-input bg-card text-foreground flex min-h-14 w-full min-w-0 flex-row items-center rounded-xl border px-4 py-3 text-base leading-6',
        props.editable === false &&
          cn(
            'opacity-50',
            Platform.select({ web: 'disabled:pointer-events-none disabled:cursor-not-allowed' }),
          ),
        Platform.select({
          web: cn(
            'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow]',
            'focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-[3px] focus-visible:ring-offset-2',
            'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
          ),
          native: 'placeholder:text-muted-foreground',
        }),
        className,
      )}
      {...props}
      style={[
        {
          fontSize: 16 * scale,
          lineHeight: 24 * scale,
          fontFamily: fontsReady ? 'KoddiUDRegular' : undefined,
        },
        props.style,
      ]}
    />
  );
}

export { Input };
