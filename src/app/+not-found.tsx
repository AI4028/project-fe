import { Screen, NavLink } from '@/components/screen';
export default function NotFound() {
  return (
    <Screen title="페이지를 찾을 수 없습니다" voice={false}>
      <NavLink href="/">홈으로 돌아가기</NavLink>
    </Screen>
  );
}
