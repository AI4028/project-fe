import { useState } from 'react';
import { View } from 'react-native';
import { CircleAlert } from 'lucide-react-native';
import { Icon } from './ui/icon';
import { router } from 'expo-router';
import { Text } from './ui/text';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { useApp } from '@/providers/app-provider';
import { errorMessage } from '@/lib/api';
export function Problem({
  message,
  retry,
  busy = false,
}: {
  message: string;
  retry?: () => void;
  busy?: boolean;
}) {
  return (
    <View className="gap-3 rounded-2xl border border-destructive bg-card p-5">
      <View className="flex-row items-start gap-3">
        <Icon as={CircleAlert} size={22} className="text-destructive" accessible={false} />
        <Text className="flex-1" accessibilityRole="alert">
          {message}
        </Text>
      </View>
      {retry && (
        <Button variant="outline" disabled={busy} onPress={retry}>
          <Text>다시 시도</Text>
        </Button>
      )}
    </View>
  );
}
export function ConfirmAction({
  open,
  onOpenChange,
  title,
  description,
  label,
  onConfirm,
  busy = false,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  description: string;
  label: string;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <Button disabled={busy} onPress={onConfirm}>
          <Text>{label}</Text>
        </Button>
        <Button variant="outline" disabled={busy} onPress={() => onOpenChange(false)}>
          <Text>돌아가기</Text>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
export function SubmissionRecovery() {
  const app = useApp();
  const [error, setError] = useState('');
  if (!app.pendingSubmission) return null;
  return (
    <Card>
      <CardContent className="gap-3 pt-6">
        <Text variant="h3">주문 전송 결과를 확인해 주세요</Text>
        <Text>
          응답을 받지 못했어도 주문이 전달되었을 수 있습니다. 중복 주문을 피하려면 기존 주문부터
          확인해 주세요.
        </Text>
        {!!error && <Problem message={error} />}
        <Button
          disabled={app.busy}
          onPress={() => {
            setError('');
            void app
              .recoverSubmission()
              .then((order) => {
                if (order)
                  router.replace({
                    pathname: '/orders/[orderId]',
                    params: { orderId: order.orderId },
                  });
              })
              .catch((reason) => setError(errorMessage(reason)));
          }}
        >
          <Text>기존 주문 확인</Text>
        </Button>
        <Text variant="muted">
          계속 확인할 수 없다면 다시 주문하지 말고 직원에게 문의해 주세요.
        </Text>
      </CardContent>
    </Card>
  );
}
