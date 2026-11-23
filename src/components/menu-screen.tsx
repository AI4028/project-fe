import { menuDescription } from '@/lib/catalog';
import { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Link, router, useFocusEffect } from 'expo-router';
import { Bookmark, ShoppingBag } from 'lucide-react-native';
import { ItemOptionsSheet } from './item-options-sheet';
import { CatalogThumbnail } from './catalog-thumbnail';
import { OrderingPaused, Problem, SubmissionRecovery } from './feedback';
import { NavLink, Screen } from './screen';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { Text } from './ui/text';
import { errorMessage } from '@/lib/api';
import { money } from '@/lib/cart';
import { useTranslation } from '@/lib/i18n';
import { useSavedMenus } from '@/lib/use-saved-menus';
import { voiceSelection } from '@/lib/voice';
import { useApp } from '@/providers/app-provider';

export function MenuScreen({
  storeId,
  initialItemId,
  initialSpeech,
}: {
  storeId?: string;
  initialItemId?: string;
  initialSpeech?: string;
}) {
  const app = useApp();
  const { language, t } = useTranslation();
  const savedMenus = useSavedMenus(app.api.base);
  const id = storeId || app.connection?.storeId;
  const pairedSessionId =
    app.connection?.kioskId && app.connection.storeId === id ? app.connection.sessionId : undefined;
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!!id);
  const [revision, setRevision] = useState(0);
  const [category, setCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState(() =>
    initialItemId ? { itemId: initialItemId, speech: initialSpeech } : null,
  );

  useFocusEffect(useCallback(() => () => setSelected(null), []));
  useEffect(() => setCategory(null), [id]);
  useEffect(() => {
    let active = true;
    if (!id || !pairedSessionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    void app
      .selectStore(id)
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, pairedSessionId, app.api, revision]);

  const store = pairedSessionId && app.store?.storeId === id ? app.store : null;
  const storeName = store && (language === 'en' ? store.nameEn || store.name : store.name);
  const menu = store?.menu ?? [];
  const categories = [...new Set(menu.map((item) => item.category))];
  const activeCategory = category && categories.includes(category) ? category : categories[0];
  const shown = menu.filter((item) => item.category === activeCategory);
  const item = menu.find((entry) => entry.id === selected?.itemId);
  const qty = app.items.reduce((sum, line) => sum + line.qty, 0);

  function closeSheet() {
    setSelected(null);
    if (initialItemId) router.replace({ pathname: '/menu', params: { storeId } });
  }

  if (!pairedSessionId) {
    return (
      <Screen
        title="키오스크에 연결해 주세요"
        subtitle="연결하면 매장 메뉴를 보고 주문할 수 있어요."
        voice={false}
      >
        <SubmissionRecovery />
        <NavLink
          href={{ pathname: '/connect', params: { storeId: id, itemId: initialItemId } }}
          variant="default"
        >
          키오스크 연결
        </NavLink>
        <NavLink href="/">매장 둘러보기</NavLink>
      </Screen>
    );
  }

  return (
    <Screen
      brandedHeader
      title={
        loading && !store
          ? '메뉴를 불러오고 있어요'
          : error && !store
            ? '매장 정보를 불러오지 못했어요'
            : '어떤 메뉴를 선택하시겠어요?'
      }
      subtitle={storeName || undefined}
      reading
      voice={!item}
      footer={
        store && (
          <View className="py-2">
            <Link href="/cart" asChild>
              <Button
                variant="secondary"
                size="lg"
                className="min-h-16 flex-wrap justify-between gap-3"
              >
                <View className="min-w-0 flex-1 flex-row items-center gap-2">
                  <Icon as={ShoppingBag} className="text-primary" size={24} accessible={false} />
                  <View className="min-h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1">
                    <Text className="font-bold text-primary-foreground">{qty}</Text>
                  </View>
                  <Text translate={false} className="shrink text-left">
                    {qty ? t('장바구니 보기') : t('장바구니 비어 있음')}
                  </Text>
                </View>
                <Text className="text-lg font-extrabold text-foreground">
                  {money(app.cart.total)}
                </Text>
              </Button>
            </Link>
          </View>
        )
      }
      onTranscript={(transcript) => {
        if (!store) return false;
        if (/메뉴.*(읽|알려)|\bread (?:the )?menu\b/i.test(transcript)) {
          app.readAloud(
            menu
              .map(
                (entry) =>
                  `${language === 'en' ? entry.nameEn || entry.name : entry.name} ${t(money(entry.price))}${entry.available ? '' : ' ' + t('품절')}`,
              )
              .join(', ') || '메뉴가 아직 없어요',
          );
          return true;
        }
        const selection = voiceSelection(transcript, menu);
        if (!selection.item) return false;
        setSelected({ itemId: selection.item.id, speech: transcript });
        return true;
      }}
    >
      <SubmissionRecovery />
      {!!error && (
        <>
          <Problem message={error} busy={loading} retry={() => setRevision((value) => value + 1)} />
          <NavLink href="/">다른 매장 찾기</NavLink>
        </>
      )}
      {loading && !store && (
        <View
          accessibilityState={{ busy: true }}
          accessibilityLabel={t('메뉴를 불러오고 있어요')}
          className="gap-3"
        >
          {[0, 1, 2].map((row) => (
            <View key={row} className="gap-2 rounded-2xl bg-card p-4" accessible={false}>
              <View className="h-5 w-4/5 rounded-lg bg-secondary" />
              <View className="h-4 w-1/2 rounded-lg bg-secondary" />
            </View>
          ))}
        </View>
      )}
      {!loading && !store && !error && <NavLink href="/">먼저 매장을 선택해 주세요</NavLink>}
      {store && (
        <>
          {store.orderingPaused && <OrderingPaused />}
          {store.hasOrderTerminal === false && (
            <Text variant="muted">
              이 매장은 휴대폰 주문을 받을 수 없어요. 매장 직원에게 문의해 주세요.
            </Text>
          )}
          {!!categories.length && (
            <View
              className="flex-row flex-wrap gap-2"
              accessibilityRole="radiogroup"
              accessibilityLabel={t('메뉴 분류')}
            >
              {categories.map((entry) => {
                const count = menu.filter((line) => line.category === entry).length;
                const checked = entry === activeCategory;
                return (
                  <Button
                    key={entry}
                    variant={checked ? 'default' : 'outline'}
                    size="sm"
                    accessibilityRole="radio"
                    accessibilityState={{ checked }}
                    accessibilityLabel={`${t(entry)}, ${t(`${count}개`)}`}
                    onPress={() => setCategory(entry)}
                  >
                    <Text className="shrink">{entry}</Text>
                    <View
                      className={
                        checked
                          ? 'min-h-6 min-w-6 items-center justify-center rounded-full bg-primary-foreground px-1'
                          : 'min-h-6 min-w-6 items-center justify-center rounded-full bg-secondary px-1'
                      }
                    >
                      <Text className="font-bold text-foreground">{count}</Text>
                    </View>
                  </Button>
                );
              })}
            </View>
          )}
          {!loading && !menu.length && (
            <View className="gap-1 rounded-2xl border border-border bg-card p-4">
              <Text variant="h3">메뉴가 아직 없어요</Text>
              <Text variant="muted">매장 직원에게 주문 방법을 확인해 주세요.</Text>
            </View>
          )}
          <View className="gap-3">
            {shown.map((entry) => {
              const name = language === 'en' ? entry.nameEn || entry.name : entry.name;
              const description = menuDescription(entry, language);
              const saved = savedMenus.isSaved(store.storeId, entry.id);
              return (
                <View
                  key={entry.id}
                  className="items-stretch gap-3 rounded-[20px] border border-search-border bg-card p-4"
                >
                  <Button
                    variant="ghost"
                    className="min-w-0 justify-start gap-3 rounded-xl p-0"
                    accessibilityLabel={[
                      t(`${name} 옵션 선택`),
                      t(money(entry.price)),
                      !entry.available ? t('품절') : '',
                    ]
                      .filter(Boolean)
                      .join(', ')}
                    onPress={() => setSelected({ itemId: entry.id, speech: undefined })}
                  >
                    <CatalogThumbnail imageUrl={entry.imageUrl} size={72} height={80} />
                    <View className="min-w-0 flex-1 gap-0.5">
                      <Text translate={false} className="text-left text-lg font-bold">
                        {name}
                      </Text>
                      {!!description && (
                        <Text variant="muted" className="text-left">
                          {description}
                        </Text>
                      )}
                      <Text className="text-left font-bold">{money(entry.price)}</Text>
                      {!entry.available && (
                        <Text variant="muted" className="text-left">
                          품절
                        </Text>
                      )}
                    </View>
                  </Button>
                  <Button
                    variant={saved ? 'secondary' : 'ghost'}
                    size="sm"
                    className="self-start"
                    disabled={!savedMenus.ready}
                    {...(Platform.OS === 'web'
                      ? { role: 'button' as const, 'aria-pressed': saved }
                      : {
                          accessibilityRole: 'togglebutton' as const,
                          accessibilityState: { checked: saved },
                        })}
                    accessibilityLabel={`${name}, ${t('메뉴 저장')}`}
                    onPress={() =>
                      void savedMenus
                        .toggle({
                          storeId: store.storeId,
                          storeName: store.name,
                          itemId: entry.id,
                          itemName: entry.name,
                        })
                        .catch(app.report)
                    }
                  >
                    <Icon
                      as={Bookmark}
                      size={20}
                      className="text-primary"
                      fill={saved ? 'currentColor' : 'none'}
                      accessible={false}
                    />
                    <Text>{saved ? '메뉴 저장 해제' : '메뉴 저장'}</Text>
                  </Button>
                </View>
              );
            })}
          </View>
          {selected && !item && !loading && <Problem message="메뉴를 찾을 수 없어요" />}
          {item && selected && (
            <ItemOptionsSheet
              key={`${store.storeId}:${item.id}`}
              store={store}
              item={item}
              speech={selected.speech}
              onClose={closeSheet}
            />
          )}
        </>
      )}
    </Screen>
  );
}
