import { Screen, NavLink } from '@/components/screen';
import { Text } from '@/components/ui/text';
export default function Onboarding() {
  return (
    <Screen
      title="나에게 맞게 이용하기"
      voice={false}
      subtitle="장애 유형을 선택하지 않아도 모든 기능을 이용할 수 있어요."
    >
      <Text>
        큰 글자, 고대비, 추가 음성 안내를 각각 선택할 수 있습니다. 휴대폰의 VoiceOver와 TalkBack도
        사용할 수 있어요.
      </Text>
      <NavLink href="/settings">이용 설정 선택</NavLink>
      <NavLink href="/">설정 없이 매장 찾기</NavLink>
      <NavLink href="/connect">매장에 있어요 · 주문 시작</NavLink>
    </Screen>
  );
}
