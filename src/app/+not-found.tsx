import { Screen, NavLink } from '@/components/screen';
import { MapPin } from 'lucide-react-native';
import { EmptyState } from '@/components/brand';
export default function NotFound() {
  return (
    <Screen title="페이지를 찾을 수 없습니다" voice={false}>
      <EmptyState
        icon={MapPin}
        title="이 페이지는 찾지 못했어요"
        description="링크가 바뀌었거나 주소가 잘못되었을 수 있어요. 매장 찾기에서 다시 시작해 주세요."
      >
        <NavLink href="/" variant="default">
          매장 찾기로 돌아가기
        </NavLink>
      </EmptyState>
    </Screen>
  );
}
