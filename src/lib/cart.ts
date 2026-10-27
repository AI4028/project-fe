import type { CartItem, MenuItem, Options, PricedLine } from './types';
export const money = (value: number) => `${value.toLocaleString('ko-KR')}원`;
export function validateItem(item: MenuItem, qty: number, picked: Options): string | null {
  if (!item.available) return '품절된 메뉴입니다.';
  if (!Number.isInteger(qty) || qty < 1 || qty > 10)
    return '수량은 1개부터 10개까지 선택할 수 있습니다.';
  if (Object.keys(picked).some((key) => !item.options.some((option) => option.id === key)))
    return '알 수 없는 옵션입니다.';
  for (const option of item.options) {
    const raw = picked[option.id];
    if (
      raw !== undefined &&
      (option.type === 'multi' ? !Array.isArray(raw) : typeof raw !== 'string')
    )
      return '옵션 형식을 확인해 주세요.';
    const ids = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
    if (option.required && ids.length === 0) return `${option.name} 옵션을 선택해 주세요.`;
    if (
      new Set(ids).size !== ids.length ||
      ids.length > (option.type === 'single' ? 1 : option.maxChoices || option.choices.length)
    )
      return `${option.name} 선택 개수를 확인해 주세요.`;
    if (
      ids.some(
        (id) => !option.choices.some((choice) => choice.id === id && choice.available !== false),
      )
    )
      return '선택할 수 없는 옵션입니다.';
  }
  return null;
}
export function estimate(item: MenuItem, qty: number, picked: Options) {
  return (
    qty *
    (item.price +
      item.options.reduce((sum, option) => {
        const raw = picked[option.id];
        const ids = Array.isArray(raw) ? raw : [raw];
        return (
          sum +
          option.choices
            .filter((choice) => ids.includes(choice.id))
            .reduce((total, choice) => total + choice.priceDelta, 0)
        );
      }, 0))
  );
}
export function restoreCart(lines: PricedLine[], menu: MenuItem[]): CartItem[] {
  return lines.map((line) => {
    const options: Options = {};
    for (const selected of line.options) {
      const multi =
        menu
          .find((item) => item.id === line.itemId)
          ?.options.find((option) => option.id === selected.optionId)?.type === 'multi';
      const old = options[selected.optionId];
      options[selected.optionId] = multi
        ? [...(Array.isArray(old) ? old : []), selected.choiceId]
        : selected.choiceId;
    }
    return { itemId: line.itemId, qty: line.qty, options };
  });
}
