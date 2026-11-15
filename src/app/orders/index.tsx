import { ReceiptText } from 'lucide-react-native';
import { Screen, NavLink } from '@/components/screen';
import { EmptyState } from '@/components/brand';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { SubmissionRecovery } from '@/components/feedback';
import { useApp } from '@/providers/app-provider';
import { statusLabels } from '@/lib/types';
import { money } from '@/lib/cart';
export default function Orders() {
  const app = useApp();
  return (
    <Screen title="내 주문" subtitle="현재 장바구니와 최근 주문을 확인하세요." voice={false}>
      <SubmissionRecovery />
      {app.connection && (
        <Card>
          <CardContent className="gap-3">
            <Text variant="h3" translate={false}>
              {app.store?.name}
            </Text>
            <NavLink href="/cart">장바구니</NavLink>
            <NavLink href="/menu">메뉴 보기</NavLink>
            <NavLink href="/help">도움 요청</NavLink>
          </CardContent>
        </Card>
      )}
      {app.order && (
        <Card>
          <CardContent className="gap-3">
            <Text variant="h3">{`주문 번호 ${app.order.orderNumber}`}</Text>
            <Text>{statusLabels[app.order.status]}</Text>
            <Text>{money(app.order.total)}</Text>
            <NavLink
              href={{ pathname: '/orders/[orderId]', params: { orderId: app.order.orderId } }}
            >
              진행 중인 주문 확인
            </NavLink>
          </CardContent>
        </Card>
      )}
      {!app.connection && !app.order && !app.pendingSubmission && (
        <EmptyState
          icon={ReceiptText}
          title="진행 중인 주문이 없어요"
          description="매장 메뉴를 살펴보거나 연결 코드로 주문을 시작하세요."
        >
          <NavLink href="/connect">매장 코드로 주문 시작</NavLink>
        </EmptyState>
      )}
    </Screen>
  );
}
