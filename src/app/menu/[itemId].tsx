import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, Minus, Plus, RefreshCw } from 'lucide-react-native';
import { Screen, NavLink } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { useApp } from '@/providers/app-provider';
import { estimate, money, validateItem, replaceCartItem } from '@/lib/cart';
import { voiceSelection } from '@/lib/voice';
import { Problem } from '@/components/feedback';
import { errorMessage } from '@/lib/api';
import type { Options } from '@/lib/types';

const photos: Record<string, number> = {
  americano: require('../../../assets/menu/americano.jpg'),
  'cafe-latte': require('../../../assets/menu/cafe-latte.jpg'),
  'vanilla-latte': require('../../../assets/menu/vanilla-latte.jpg'),
  'grapefruit-ade': require('../../../assets/menu/grapefruit-ade.jpg'),
};

export default function ItemOptions() {
  const { itemId, speech, edit } = useLocalSearchParams<{
    itemId: string;
    speech?: string;
    edit?: string;
  }>();
  const app = useApp();
  const item = app.store?.menu?.find((entry) => entry.id === itemId);
  const initial = voiceSelection(typeof speech === 'string' ? speech : '', []);
  const index = edit === undefined ? null : Number(edit);
  const [original, setOriginal] = useState(() => (index !== null ? app.items[index] : undefined));
  const [error, setError] = useState('');
  const [qty, setQty] = useState(original?.qty ?? initial.qty);
  const [options, setOptions] = useState<Options>(
    () =>
      original?.options ??
      Object.fromEntries(
        Object.entries(initial.options).filter(([key]) =>
          item?.options.some((option) => option.id === key),
        ),
      ),
  );
  useEffect(() => {
    if (index === null || original) return;
    const restored = app.items[index];
    if (!restored) return;
    setOriginal(restored);
    setQty(restored.qty);
    setOptions(restored.options);
  }, [app.items, index, original]);

  async function add() {
    if (!item) return;
    const validationError = validateItem(item, qty, options);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    try {
      const next = { itemId: item.id, qty, options };
      if (index !== null && (!original || original.itemId !== item.id))
        throw new Error('수정할 메뉴를 장바구니에서 다시 선택해 주세요.');
      await app.updateCart(
        index === null ? [...app.items, next] : replaceCartItem(app.items, index, original!, next),
      );
      router.replace('/cart');
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  return (
    <Screen
      title={item?.name ?? '메뉴를 찾을 수 없어요'}
      subtitle={index === null ? '원하는 옵션과 수량을 골라 주세요.' : '옵션과 수량을 바꿔 주세요.'}
      onTranscript={(text) => {
        if (!item) return false;
        if (/담아|담기|넣어/.test(text)) {
          void add().catch(app.report);
          return true;
        }
        const selection = voiceSelection(text, []);
        const recognized: Options = { ...options };
        for (const option of item.options) {
          const candidate = selection.options[option.id];
          if (
            typeof candidate === 'string' &&
            option.choices.some((choice) => choice.id === candidate)
          )
            recognized[option.id] = candidate;
          for (const choice of option.choices)
            if (text.replace(/\s/g, '').includes(choice.name.replace(/\s/g, '')))
              recognized[option.id] = option.type === 'multi' ? [choice.id] : choice.id;
        }
        if (JSON.stringify(recognized) !== JSON.stringify(options) || /잔|개/.test(text)) {
          setOptions(recognized);
          if (/잔|개/.test(text)) setQty(selection.qty);
          app.announce('옵션을 선택했어요. 확인 후 담기라고 말해 주세요.');
          return true;
        }
        return false;
      }}
    >
      {!!error && <Problem message={error} />}
      {!item ? (
        <NavLink href="/">매장 선택으로 돌아가기</NavLink>
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            {photos[item.id] && (
              <Image
                source={photos[item.id]}
                style={{ width: '100%', height: 260 }}
                accessibilityIgnoresInvertColors
                accessible={false}
              />
            )}
            <CardContent className="gap-3 py-6">
              <Text className="text-sm font-semibold text-primary">{item.category}</Text>
              <Text variant="h2">{item.name}</Text>
              <Text variant="muted">
                {index === null ? item.description : '변경하면 장바구니의 기존 항목에 적용돼요.'}
              </Text>
              <Text className="text-xl font-bold">{money(item.price)}부터</Text>
            </CardContent>
          </Card>

          {!item.available && (
            <Card className="border-destructive/30 bg-card shadow-none">
              <CardContent className="gap-2 pt-6">
                <Text accessibilityRole="alert" variant="h3">
                  지금은 품절이에요
                </Text>
                <Text>장바구니에서 삭제하거나 다른 메뉴를 골라 주세요.</Text>
              </CardContent>
            </Card>
          )}
          <Button
            variant="outline"
            disabled={app.busy}
            className="self-start"
            onPress={() => {
              if (app.store)
                void app
                  .selectStore(app.store.storeId)
                  .catch((reason) => setError(errorMessage(reason)));
            }}
          >
            <Icon as={RefreshCw} size={17} />
            <Text>가격과 판매 상태 새로고침</Text>
          </Button>

          {item.options.map((option) => (
            <View key={option.id} className="gap-3">
              <View className="flex-row flex-wrap items-baseline gap-2">
                <Text variant="h2">{option.name}</Text>
                <Text className="text-sm font-semibold text-primary">
                  {option.required ? '필수' : '선택'}
                  {option.type === 'multi' && option.maxChoices
                    ? ' · 최대 ' + option.maxChoices + '개'
                    : ''}
                </Text>
              </View>
              <View
                className="gap-2"
                accessibilityRole={option.type === 'single' ? 'radiogroup' : undefined}
              >
                {option.choices.map((choice) => {
                  const current = options[option.id];
                  const selected = Array.isArray(current)
                    ? current.includes(choice.id)
                    : current === choice.id;
                  const canDeselectUnavailable =
                    selected && (option.type === 'multi' || !option.required);
                  const disabled = choice.available === false && !canDeselectUnavailable;
                  return (
                    <Button
                      key={choice.id}
                      variant={selected ? 'secondary' : 'outline'}
                      className="min-h-14 w-full justify-between px-4 py-3"
                      disabled={disabled}
                      accessibilityRole={option.type === 'multi' ? 'checkbox' : 'radio'}
                      accessibilityState={{ checked: selected, disabled }}
                      accessibilityLabel={
                        choice.name +
                        (choice.priceDelta ? ', 추가 ' + money(choice.priceDelta) : '') +
                        (disabled ? ', 품절' : '')
                      }
                      onPress={() => {
                        const next = { ...options };
                        if (option.type === 'multi') {
                          const values = Array.isArray(current) ? current : [];
                          if (
                            !selected &&
                            values.length >= (option.maxChoices || option.choices.length)
                          )
                            return app.announce(
                              '최대 ' + option.maxChoices + '개까지 선택해 주세요.',
                            );
                          next[option.id] = selected
                            ? values.filter((id) => id !== choice.id)
                            : [...values, choice.id];
                        } else if (selected && !option.required) delete next[option.id];
                        else next[option.id] = choice.id;
                        setOptions(next);
                      }}
                    >
                      <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-2">
                        <Text className="font-semibold">{choice.name}</Text>
                        {choice.available === false && <Text>품절</Text>}
                      </View>
                      <View className="flex-row items-center gap-3">
                        {!!choice.priceDelta && <Text>+{money(choice.priceDelta)}</Text>}
                        {selected && <Icon as={Check} size={20} className="text-primary" />}
                      </View>
                    </Button>
                  );
                })}
              </View>
            </View>
          ))}

          <Card className="shadow-none">
            <CardContent className="gap-4 pt-6">
              <Text variant="h2">수량</Text>
              <View className="flex-row items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={qty <= 1}
                  accessibilityLabel="수량 줄이기"
                  onPress={() => setQty(qty - 1)}
                >
                  <Icon as={Minus} size={19} />
                </Button>
                <Text variant="h2" accessibilityLiveRegion="polite">
                  {qty}개
                </Text>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={qty >= 10}
                  accessibilityLabel="수량 늘리기"
                  onPress={() => setQty(qty + 1)}
                >
                  <Icon as={Plus} size={19} />
                </Button>
              </View>
              <View className="border-t border-border pt-4">
                <Text variant="muted">예상 금액 · 최종 금액은 매장 확인 후 표시돼요</Text>
                <Text variant="h2">{money(estimate(item, qty, options))}</Text>
              </View>
            </CardContent>
          </Card>

          {app.connection ? (
            <Button
              size="lg"
              disabled={app.busy || !item.available || !!app.pendingSubmission}
              onPress={() => void add().catch(app.report)}
            >
              <Text>{index === null ? '장바구니에 담기' : '변경 내용 저장'}</Text>
            </Button>
          ) : (
            <NavLink href={{ pathname: '/connect', params: { storeId: app.store!.storeId } }}>
              먼저 매장에 연결하기
            </NavLink>
          )}
          <NavLink href={index === null ? '/menu' : '/cart'}>변경하지 않고 돌아가기</NavLink>
        </>
      )}
    </Screen>
  );
}
