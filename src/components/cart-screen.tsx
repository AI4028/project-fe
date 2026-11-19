import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect, usePathname } from 'expo-router';
import { ArrowRight, ShoppingBag, Trash2 } from 'lucide-react-native';
import { EmptyState } from './brand';
import { OrderingPaused, Problem, SubmissionRecovery } from './feedback';
import { ItemOptionsSheet, type CartEdit } from './item-options-sheet';
import { CartLineSummary, MenuThumbnail, QuantityStepper } from './menu-controls';
import { NavLink, Screen } from './screen';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { Icon } from './ui/icon';
import { Text } from './ui/text';
import { errorMessage } from '@/lib/api';
import { money, removeCartItem, replaceCartItem } from '@/lib/cart';
import { useTranslation } from '@/lib/i18n';
import type { PricedLine } from '@/lib/types';
import { useApp } from '@/providers/app-provider';

export function CartScreen({
  initialEdit,
  initialItemId,
  initialStoreId,
}: {
  initialEdit?: string;
  initialItemId?: string;
  initialStoreId?: string;
}) {
  const app = useApp();
  const { language, t } = useTranslation();
  const [edit, setEdit] = useState<CartEdit | null>(null);
  const [remove, setRemove] = useState<(CartEdit & { line: PricedLine; storeId?: string }) | null>(
    null,
  );
  const [removeError, setRemoveError] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const isCart = usePathname() === '/cart';
  useFocusEffect(
    useCallback(
      () => () => {
        setEdit(null);
        setRemove(null);
      },
      [],
    ),
  );
  const didOpenInitial = useRef(false);
  const storeId = app.connection?.storeId ?? app.store?.storeId;
  const storeName =
    app.store && (language === 'en' ? app.store.nameEn || app.store.name : app.store.name);
  const itemToEdit = app.store?.menu?.find((item) => item.id === edit?.original.itemId);
  const photoOf = (itemId: string) => app.store?.menu?.find((item) => item.id === itemId)?.imageUrl;
  const qty = app.items.reduce((sum, line) => sum + line.qty, 0);
  const disabled = app.busy || checking || !!app.pendingSubmission;
  const menuHref = storeId
    ? { pathname: '/menu' as const, params: { storeId } }
    : ('/menu' as const);

  useEffect(() => {
    if (!isCart || initialEdit === undefined || didOpenInitial.current || !app.ready || app.busy)
      return;
    didOpenInitial.current = true;
    const index = Number(initialEdit);
    const original = app.items[index];
    if (
      initialEdit.trim() &&
      Number.isInteger(index) &&
      original?.itemId === initialItemId &&
      original &&
      (!initialStoreId || initialStoreId === storeId)
    ) {
      const item = app.store?.menu?.find((entry) => entry.id === original.itemId);
      if (item) {
        setEdit({ index, original });
        return;
      }
    }
    setError('수정할 메뉴를 장바구니에서 다시 선택해 주세요.');
  }, [
    isCart,
    initialEdit,
    initialItemId,
    initialStoreId,
    storeId,
    app.ready,
    app.busy,
    app.items,
    app.store,
  ]);

  async function review() {
    setChecking(true);
    setError('');
    try {
      await app.updateCart(app.items, storeId);
      router.push('/review');
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setChecking(false);
    }
  }

  async function adjustQuantity(index: number, value: number) {
    const original = app.items[index];
    if (!original) return;
    setError('');
    try {
      await app.updateCart(
        replaceCartItem(app.items, index, original, { ...original, qty: value }),
        storeId,
      );
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function confirmRemoval() {
    if (!remove || disabled) return;
    setRemoveError('');
    try {
      if (remove.storeId !== storeId) throw new Error('장바구니가 변경되었습니다.');
      await app.updateCart(removeCartItem(app.items, remove.index, remove.original), storeId);
      setRemove(null);
    } catch (reason) {
      setRemoveError(errorMessage(reason));
    }
  }

  return (
    <Screen
      title="장바구니"
      subtitle={qty && storeName ? `${storeName} · ${t(`${qty}개`)}` : undefined}
      reading
      voice={!edit && !remove}
      footer={
        !!qty && (
          <>
            <View className="flex-row flex-wrap items-baseline justify-between gap-2">
              <Text variant="muted">
                {t('총 합계')} ({t(`${qty}개`)})
              </Text>
              <Text className="text-lg font-bold" accessibilityLiveRegion="polite">
                {money(app.cart.total)}
              </Text>
            </View>
            <Button
              size="lg"
              className="justify-between"
              disabled={disabled || !!app.store?.orderingPaused}
              onPress={() => void review()}
            >
              <Text className="shrink text-left">
                {checking ? '가격과 재고 확인 중' : '결제 수단 선택'}
              </Text>
              <Icon
                as={ArrowRight}
                size={19}
                className="text-primary-foreground"
                accessible={false}
              />
            </Button>
          </>
        )
      }
    >
      <SubmissionRecovery />
      {app.store?.orderingPaused && <OrderingPaused />}
      {!!error && <Problem message={error} />}
      {!qty ? (
        <View className="gap-3">
          <EmptyState
            icon={ShoppingBag}
            title="담긴 메뉴가 없어요"
            description="메뉴를 골라 장바구니에 담아 보세요."
          />
          <NavLink href={menuHref} variant="default" size="lg">
            메뉴 보러 가기
          </NavLink>
          <NavLink href="/" size="lg">
            다른 매장 찾기
          </NavLink>
        </View>
      ) : (
        <>
          <View className="gap-3">
            {app.cart.lines.map((line, index) => {
              const original = app.items[index];
              const menuItem = app.store?.menu?.find((item) => item.id === line.itemId);
              const name = language === 'en' ? menuItem?.nameEn || line.name : line.name;
              const localized = { ...line, name };
              return (
                <Card key={`${line.itemId}:${index}`} className="rounded-2xl p-0 shadow-none">
                  <CardContent className="gap-3 p-4">
                    <View className="flex-row items-start gap-3">
                      <MenuThumbnail
                        itemId={line.itemId}
                        imageUrl={photoOf(line.itemId)}
                        size={52}
                      />
                      <View className="min-w-0 flex-1 self-center">
                        <CartLineSummary line={localized} />
                      </View>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={disabled || !original}
                        accessibilityLabel={`${name} 삭제`}
                        onPress={() => {
                          if (!original) return;
                          setRemoveError('');
                          setRemove({ index, original, line: localized, storeId });
                        }}
                      >
                        <Icon as={Trash2} size={21} className="text-primary" accessible={false} />
                      </Button>
                    </View>
                    <Text className="self-end text-xl font-bold">{money(line.lineTotal)}</Text>
                    <QuantityStepper
                      qty={line.qty}
                      name={name}
                      disabled={disabled || !original || menuItem?.available === false}
                      onChange={(value) => void adjustQuantity(index, value)}
                    />
                    <Button
                      variant="outline"
                      className="border-primary"
                      disabled={disabled || !original || !menuItem}
                      accessibilityLabel={`${name} 옵션과 수량 수정`}
                      onPress={() => {
                        if (original) setEdit({ index, original });
                      }}
                    >
                      <Text>옵션 바꾸기</Text>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </View>
          <View className="flex-row flex-wrap gap-2">
            <NavLink href={menuHref}>메뉴 더 고르기</NavLink>
          </View>
        </>
      )}
      {isCart && app.store && itemToEdit && edit && (
        <ItemOptionsSheet
          store={app.store}
          item={itemToEdit}
          edit={edit}
          onClose={() => setEdit(null)}
        />
      )}
      {isCart && remove && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !disabled) setRemove(null);
          }}
        >
          <DialogContent>
            <DialogTitle>이 메뉴를 삭제할까요?</DialogTitle>
            <View className="flex-row items-center gap-3 rounded-2xl border border-border p-3">
              <MenuThumbnail
                itemId={remove.line.itemId}
                imageUrl={photoOf(remove.line.itemId)}
                size={56}
              />
              <View className="min-w-0 flex-1">
                <CartLineSummary line={remove.line} />
              </View>
            </View>
            {!!removeError && <Problem message={removeError} />}
            <Button disabled={disabled} onPress={() => setRemove(null)}>
              <Text>메뉴 유지</Text>
            </Button>
            <Button
              variant="outline"
              className="border-destructive"
              disabled={disabled}
              onPress={() => void confirmRemoval()}
            >
              <Text className="text-destructive">이 메뉴 삭제</Text>
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </Screen>
  );
}
