import { fireEvent, render, screen } from '@testing-library/react-native';
import { LanguageContext, objectParticle, translate } from '@/lib/i18n';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { LanguageSwitch } from '@/components/language-switch';

jest.mock('@rn-primitives/slot', () => ({ Slot: jest.fn() }));
const mockSave = jest.fn().mockResolvedValue(undefined);
jest.mock('@/providers/app-provider', () => ({
  useApp: () => ({
    settings: { language: 'ko', contrast: true },
    updateSettings: mockSave,
    report: jest.fn(),
    busy: false,
  }),
}));

test('translates fixed and dynamic UI messages while preserving unknown content', () => {
  expect(translate('장바구니', 'en')).toBe('Cart');
  expect(translate('주문 번호 42', 'en')).toBe('Order #42');
  expect(translate('장바구니 2개 · 5,000원', 'en')).toBe('Cart · 2 items · ₩5,000');
  expect(translate('장바구니 1개 · 2,500원', 'en')).toBe('Cart · 1 item · ₩2,500');
  expect(translate('따뜻하게', 'en')).toBe('Hot');
  expect(translate('온도 옵션을 선택해 주세요.', 'en')).toBe('Choose an option for Temperature.');
  expect(translate('카페 갈지도 서울점', 'en')).toBe('카페 갈지도 서울점');
  expect(translate('장바구니', 'ko')).toBe('장바구니');
});

test('language changes update UI and placeholders without changing original content or input values', async () => {
  const content = (
    <>
      <Text>장바구니</Text>
      <Text translate={false}>장바구니</Text>
      <Input placeholder="연결 코드" value="한국어 요청" />
    </>
  );
  const view = await render(
    <LanguageContext.Provider value="ko">{content}</LanguageContext.Provider>,
  );
  expect(screen.getAllByText('장바구니')).toHaveLength(2);
  await view.rerender(<LanguageContext.Provider value="en">{content}</LanguageContext.Provider>);
  expect(screen.getByText('Cart')).toBeTruthy();
  expect(screen.getByText('장바구니')).toBeTruthy();
  expect(screen.getByPlaceholderText('Connection code')).toBeTruthy();
  expect(screen.getByDisplayValue('한국어 요청')).toBeTruthy();
});

test('language switch saves the selected language alongside existing preferences', async () => {
  await render(<LanguageSwitch compact />);
  await fireEvent.press(screen.getByLabelText('Switch to English'));
  expect(screen.getByRole('radio', { name: '한국어로 전환' })).toBeTruthy();
  expect(mockSave).toHaveBeenCalledWith({ language: 'en' });
});

test('uses the right Korean object particle for menu names', () => {
  expect(objectParticle('크루아상')).toBe('을');
  expect(objectParticle('카페라떼')).toBe('를');
  expect(objectParticle('Latte')).toBe('을(를)');
  expect(translate('크루아상을 장바구니에서 삭제합니다.', 'en')).toBe(
    'Remove 크루아상 from your cart.',
  );
  expect(translate('카페라떼를 장바구니에서 삭제합니다.', 'en')).toBe(
    'Remove 카페라떼 from your cart.',
  );
  expect(translate('Latte을(를) 장바구니에서 삭제합니다.', 'en')).toBe(
    'Remove Latte from your cart.',
  );
});
