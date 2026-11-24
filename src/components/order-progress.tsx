import { useContext } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text, TextScaleContext } from '@/components/ui/text';
import { useTranslation } from '@/lib/i18n';
import type { OrderStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { SpokenGroup } from '@/components/spoken-group';

const stages = [
  { status: 'submitted', label: '전송' },
  { status: 'accepted', label: '접수' },
  { status: 'preparing', label: '준비 중' },
  { status: 'ready', label: '준비 완료' },
] as const;

export function OrderProgress({ status }: { status: OrderStatus | 'sending' | 'failed' }) {
  const { t, language } = useTranslation();
  const { width, fontScale } = useWindowDimensions();
  const scale = useContext(TextScaleContext) * fontScale;
  const vertical = width < (language === 'en' ? 360 : 310) || scale > 1.35;
  const activeIndex =
    status === 'picked_up' ? stages.length : stages.findIndex((s) => s.status === status);
  // Read the current status once instead of every numbered step.
  const step = Math.max(activeIndex, 0);
  const summary =
    status === 'failed'
      ? t('전송 실패')
      : status === 'picked_up'
        ? t('픽업 완료')
        : `${t((stages[step] ?? stages[0]).label)}, ${t(`주문 ${stages.length}단계 중 ${step + 1}단계`)}`;

  return (
    <Card className="border-0 bg-secondary py-4 shadow-none">
      <CardContent className="gap-3 px-4">
        <Text variant="h4">주문 진행</Text>
        {status === 'cancelled' ? (
          <View className="flex-row items-center gap-2">
            <Icon as={X} size={18} className="text-destructive" accessible={false} />
            <Text className="shrink font-semibold">주문 취소</Text>
          </View>
        ) : (
          <SpokenGroup label={summary} className={cn(vertical ? 'gap-2' : 'flex-row')}>
            {stages.map(({ status: stage, label }, index) => {
              const failed = index === 0 && status === 'failed';
              const current = index === activeIndex || (index === 0 && status === 'sending');
              const complete = index < activeIndex;
              const caption = failed ? '전송 실패' : label;
              return (
                <View
                  key={stage}
                  className={cn(
                    'relative min-w-0 gap-2',
                    vertical ? 'flex-row items-center' : 'flex-1 items-center',
                  )}
                >
                  {!vertical && index < stages.length - 1 && (
                    <View
                      accessible={false}
                      className={cn(
                        'absolute left-1/2 top-[15px] h-0.5 w-full',
                        complete ? 'bg-primary' : 'bg-border',
                      )}
                    />
                  )}
                  <View
                    className={cn(
                      'h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                      failed
                        ? 'border-destructive bg-destructive'
                        : complete || current
                          ? 'border-primary bg-primary'
                          : 'border-border bg-card',
                    )}
                  >
                    {failed || complete ? (
                      <Icon
                        as={failed ? X : Check}
                        size={17}
                        accessible={false}
                        className={
                          failed ? 'text-destructive-foreground' : 'text-primary-foreground'
                        }
                      />
                    ) : (
                      <Text
                        aria-hidden
                        className={cn(
                          'text-sm font-bold leading-none',
                          current && 'text-primary-foreground',
                        )}
                      >
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  <Text
                    variant="small"
                    className={cn(
                      vertical ? 'shrink' : 'text-center',
                      current || failed ? 'font-bold' : 'text-muted-foreground',
                    )}
                  >
                    {caption}
                  </Text>
                </View>
              );
            })}
          </SpokenGroup>
        )}
      </CardContent>
    </Card>
  );
}
