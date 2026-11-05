import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, NavLink } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useApp } from '@/providers/app-provider';
import { estimate, money, validateItem, replaceCartItem } from '@/lib/cart';
import { voiceSelection } from '@/lib/voice';
import { Problem } from '@/components/feedback';
import { errorMessage } from '@/lib/api';
import type { Options } from '@/lib/types';
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
  const [original] = useState(() => (index !== null ? app.items[index] : undefined));
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
  async function add() {
    if (!item) return;
    const error = validateItem(item, qty, options);
    if (error) {
      setError(error);
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
      title={item?.name ?? '메뉴를 찾을 수 없습니다'}
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
          app.announce('옵션을 선택했습니다. 확인 후 담기라고 말해 주세요.');
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
          <Text>
            {index === null
              ? item.description
              : '옵션과 수량을 바꾸면 기존 장바구니 항목이 수정됩니다.'}
          </Text>
          {!item.available && (
            <Text accessibilityRole="alert">
              이 메뉴는 현재 품절입니다. 장바구니에서 삭제하거나 다른 메뉴를 선택해 주세요.
            </Text>
          )}
          <Button
            variant="outline"
            disabled={app.busy}
            onPress={() => {
              if (app.store)
                void app
                  .selectStore(app.store.storeId)
                  .catch((reason) => setError(errorMessage(reason)));
            }}
          >
            <Text>가격 · 판매 상태 새로고침</Text>
          </Button>
          {item.options.map((option) => (
            <View key={option.id} className="gap-3">
              <Text variant="h3">
                {option.name} {option.required ? '(필수)' : '(선택)'}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {option.choices.map((choice) => {
                  const current = options[option.id];
                  const selected = Array.isArray(current)
                    ? current.includes(choice.id)
                    : current === choice.id;
                  return (
                    <Button
                      key={choice.id}
                      variant={selected ? 'default' : 'outline'}
                      disabled={choice.available === false}
                      accessibilityRole={option.type === 'multi' ? 'checkbox' : 'radio'}
                      accessibilityState={{
                        checked: selected,
                        disabled: choice.available === false,
                      }}
                      onPress={() => {
                        const next = { ...options };
                        if (option.type === 'multi') {
                          const values = Array.isArray(current) ? current : [];
                          if (
                            !selected &&
                            values.length >= (option.maxChoices || option.choices.length)
                          )
                            return app.announce(`최대 ${option.maxChoices}개까지 선택해 주세요.`);
                          next[option.id] = selected
                            ? values.filter((id) => id !== choice.id)
                            : [...values, choice.id];
                        } else if (selected && !option.required) delete next[option.id];
                        else next[option.id] = choice.id;
                        setOptions(next);
                      }}
                    >
                      <Text>
                        {choice.name}
                        {choice.priceDelta ? ` (+${money(choice.priceDelta)})` : ''}
                        {choice.available === false ? ' · 품절' : ''}
                      </Text>
                    </Button>
                  );
                })}
              </View>
            </View>
          ))}
          <View className="flex-row items-center gap-4">
            <Button
              variant="outline"
              disabled={qty <= 1}
              accessibilityLabel="수량 줄이기"
              onPress={() => setQty(qty - 1)}
            >
              <Text>−</Text>
            </Button>
            <Text accessibilityLiveRegion="polite">{qty}개</Text>
            <Button
              variant="outline"
              disabled={qty >= 10}
              accessibilityLabel="수량 늘리기"
              onPress={() => setQty(qty + 1)}
            >
              <Text>+</Text>
            </Button>
          </View>
          <Text variant="h3">예상 금액 {money(estimate(item, qty, options))}</Text>
          {app.connection ? (
            <Button
              disabled={app.busy || !item.available || !!app.pendingSubmission}
              onPress={() => void add().catch(app.report)}
            >
              <Text>{index === null ? '장바구니에 담기' : '수정 내용 저장'}</Text>
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
