import { menuDescription } from '@/lib/catalog';
import { useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, Platform, ScrollView, View } from 'react-native';
import { Check, Circle, Square } from 'lucide-react-native';
import { Problem } from './feedback';
import { QuantityStepper } from './menu-controls';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { Icon } from './ui/icon';
import { Text } from './ui/text';
import { VoiceControls } from './voice-controls';
import { errorMessage } from '@/lib/api';
import { estimate, money, replaceCartItem, validateItem } from '@/lib/cart';
import { translate, useTranslation } from '@/lib/i18n';
import type { CartItem, MenuItem, Options, Store } from '@/lib/types';
import { cn } from '@/lib/utils';
import { spokenQuantity, voiceSelection } from '@/lib/voice';
import { useApp } from '@/providers/app-provider';

export type CartEdit = { index: number; original: CartItem };

function recognizeOptions(item: MenuItem, text: string, current: Options): Options {
  const normalized = text.toLowerCase().replace(/\s/g, '');
  const selection = voiceSelection(text, []);
  const next = { ...current };
  for (const group of item.options) {
    const matched = group.choices.filter(
      (choice) =>
        choice.available !== false &&
        (selection.options[group.id] === choice.id ||
          [choice.name, translate(choice.name, 'en')].some((name) =>
            normalized.includes(name.toLowerCase().replace(/\s/g, '')),
          )),
    );
    const first = matched[0];
    if (!first) continue;
    if (group.type === 'multi') {
      const previous = next[group.id];
      const ids = [
        ...new Set([
          ...(Array.isArray(previous) ? previous : []),
          ...matched.map((choice) => choice.id),
        ]),
      ];
      if (ids.length <= (group.maxChoices || group.choices.length)) next[group.id] = ids;
    } else next[group.id] = first.id;
  }
  return next;
}

export function ItemOptionsSheet({
  store,
  item,
  edit,
  speech = '',
  onClose,
}: {
  store: Store;
  item: MenuItem;
  edit?: CartEdit;
  speech?: string;
  onClose: () => void;
}) {
  const app = useApp();
  const { language, t } = useTranslation();
  const description = menuDescription(item, language);
  const [options, setOptions] = useState<Options>(
    () => edit?.original.options ?? recognizeOptions(item, speech, {}),
  );
  const [qty, setQty] = useState(() =>
    Math.max(1, Math.min(10, edit?.original.qty ?? voiceSelection(speech, []).qty)),
  );
  const [missing, setMissing] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const groupHeaders = useRef<Record<string, ComponentRef<typeof View> | null>>({});
  const groupPositions = useRef<Record<string, number>>({});
  const name = language === 'en' ? item.nameEn || item.name : item.name;
  const orderReady =
    !!app.connection?.kioskId &&
    app.connection.storeId === store.storeId &&
    item.available &&
    !store.orderingPaused &&
    store.hasOrderTerminal !== false &&
    !app.pendingSubmission;
  const blocked = app.busy || saving;
  const estimated = money(estimate(item, qty, options));

  function focusGroup(id: string) {
    scroll.current?.scrollTo({ y: groupPositions.current[id] ?? 0 });
    requestAnimationFrame(() => {
      const header = groupHeaders.current[id];
      if (Platform.OS === 'web') header?.focus();
      else if (header) AccessibilityInfo.sendAccessibilityEvent(header, 'focus');
    });
  }

  async function save() {
    if (savingRef.current || !orderReady || app.busy) return;
    const required = item.options.find((group) => {
      const value = options[group.id];
      return group.required && (!value || value.length === 0);
    });
    if (required) {
      setError('');
      setMissing(required.id);
      focusGroup(required.id);
      return;
    }
    const validation = validateItem(item, qty, options);
    if (validation) {
      setMissing('');
      setError(validation);
      return;
    }
    setError('');
    savingRef.current = true;
    setSaving(true);
    try {
      const line = { itemId: item.id, qty, options };
      const next = edit
        ? replaceCartItem(app.items, edit.index, edit.original, line)
        : [...app.items, line];
      await app.updateCart(next, store.storeId);
      onClose();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function onTranscript(text: string) {
    if (blocked) return true;
    const next = recognizeOptions(item, text, options);
    const quantity = spokenQuantity(text.trim());
    if (JSON.stringify(next) !== JSON.stringify(options) || quantity !== undefined) {
      setOptions(next);
      if (next[missing]?.length) setMissing('');
      if (quantity !== undefined) setQty(Math.max(1, Math.min(10, quantity)));
      app.announce('옵션을 선택했어요. 확인 후 담기라고 말해 주세요.');
      return true;
    }
    if (
      /^\s*(장바구니에\s*)?(담아\s*(줘|주세요)?|담기|넣어\s*(줘|주세요)?|변경 내용 저장|수정 완료|add(?: (?:it |this )?to (?:the |my )?cart)?|save(?: changes)?)[.!?]?\s*$/i.test(
        text,
      )
    ) {
      void save();
      return true;
    }
    if (/^\s*(뒤로|닫기|취소|back|close|cancel)[.!?]?\s*$/i.test(text)) {
      onClose();
      return true;
    }
    return false;
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent presentation="sheet" className="gap-3">
        <DialogTitle>{edit ? '담긴 메뉴 수정' : <>{name}</>}</DialogTitle>
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          className="shrink"
          contentContainerClassName="gap-4 pb-2"
        >
          {edit ? (
            <DialogDescription>
              {name} · {t('옵션과 수량을 바꿔요.')}
            </DialogDescription>
          ) : (
            <View className="gap-1">
              {!!description && <DialogDescription>{description}</DialogDescription>}
              <Text className="text-lg font-bold">{money(item.price)}</Text>
            </View>
          )}
          {store.hasOrderTerminal === false && (
            <Problem message="이 매장은 휴대폰 주문을 받을 수 없어요. 매장 직원에게 문의해 주세요." />
          )}
          {!item.available && <Problem message="지금은 품절이에요" />}
          {store.orderingPaused && <Problem message="지금은 주문을 받지 않고 있어요" />}
          {!!error && <Problem message={error} />}
          {item.options.map((group) => {
            const invalid = missing === group.id;
            const selectedValue = options[group.id];
            const ids = Array.isArray(selectedValue)
              ? selectedValue
              : selectedValue
                ? [selectedValue]
                : [];
            const limit = group.maxChoices || group.choices.length;
            return (
              <View
                key={group.id}
                className="gap-2"
                onLayout={(event) => {
                  groupPositions.current[group.id] = event.nativeEvent.layout.y;
                }}
              >
                <View
                  ref={(node) => {
                    groupHeaders.current[group.id] = node;
                  }}
                  accessible
                  accessibilityRole="header"
                  tabIndex={-1}
                >
                  <View className="flex-row flex-wrap items-baseline gap-x-2">
                    <Text className={cn('font-bold', invalid && 'text-destructive')}>
                      {group.name}
                    </Text>
                    <Text
                      variant="small"
                      className={cn('font-bold', invalid && 'text-destructive')}
                    >
                      {group.required ? (group.type === 'single' ? '필수 1개' : '필수') : '선택'}
                    </Text>
                  </View>
                  {invalid && (
                    <Text
                      accessibilityRole="alert"
                      className="text-destructive"
                    >{`${group.name} 옵션을 선택해 주세요.`}</Text>
                  )}
                </View>
                <View
                  className="gap-2"
                  accessibilityRole={group.type === 'single' ? 'radiogroup' : undefined}
                  accessibilityLabel={t(group.name)}
                >
                  {group.choices.map((choice) => {
                    const selected = ids.includes(choice.id);
                    const unavailable = choice.available === false;
                    const disabled =
                      blocked ||
                      (unavailable && !(selected && (group.type === 'multi' || !group.required)));
                    return (
                      <Button
                        key={choice.id}
                        variant={selected ? 'secondary' : 'outline'}
                        className={cn(
                          'min-h-14 w-full justify-between rounded-xl px-3',
                          selected && 'border-primary',
                          invalid && 'border-destructive',
                        )}
                        disabled={disabled}
                        accessibilityRole={group.type === 'multi' ? 'checkbox' : 'radio'}
                        accessibilityState={{ checked: selected, disabled }}
                        accessibilityLabel={[
                          t(choice.name),
                          choice.priceDelta ? t(money(choice.priceDelta)) : '',
                          unavailable ? t('품절') : '',
                        ]
                          .filter(Boolean)
                          .join(', ')}
                        onPress={() => {
                          const next = { ...options };
                          if (group.type === 'multi') {
                            if (!selected && ids.length >= limit) {
                              app.announce(`${t('최대')} ${t(`${limit}개`)}`);
                              return;
                            }
                            next[group.id] = selected
                              ? ids.filter((id) => id !== choice.id)
                              : [...ids, choice.id];
                          } else if (selected && !group.required) delete next[group.id];
                          else next[group.id] = choice.id;
                          setOptions(next);
                          if (next[missing]?.length) setMissing('');
                          setError('');
                        }}
                      >
                        <Icon
                          as={selected ? Check : group.type === 'single' ? Circle : Square}
                          size={20}
                          className="text-primary"
                          accessible={false}
                        />
                        <View className="min-w-0 flex-1">
                          <Text className="text-left text-foreground">{choice.name}</Text>
                          {unavailable && (
                            <Text variant="small" className="text-left">
                              품절
                            </Text>
                          )}
                        </View>
                        <Text
                          translate={false}
                          className="text-right text-lg font-bold text-foreground"
                        >
                          {choice.priceDelta >= 0 ? '+' : '−'}
                          {t(money(Math.abs(choice.priceDelta)))}
                        </Text>
                      </Button>
                    );
                  })}
                </View>
              </View>
            );
          })}
          {app.settings.voiceInput && <VoiceControls onTranscript={onTranscript} />}
        </ScrollView>
        <View className="gap-2 border-t border-border pt-2">
          <Text className="font-bold">수량</Text>
          <QuantityStepper qty={qty} onChange={setQty} disabled={blocked} />
          <Button
            size="lg"
            variant={missing ? 'secondary' : 'default'}
            disabled={blocked || !orderReady}
            onPress={() => void save()}
          >
            <Text className="shrink text-center">
              {missing
                ? t(
                    `${item.options.find((group) => group.id === missing)?.name} 옵션을 선택해 주세요.`,
                  )
                : `${t(`${qty}개`)} · ${t(estimated)} ${t(edit ? '수정 완료' : '담기')}`}
            </Text>
          </Button>
        </View>
      </DialogContent>
    </Dialog>
  );
}
