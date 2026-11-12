import { View } from 'react-native';
import { MapPin, Link2, ShoppingBag, Settings2, ArrowRight } from 'lucide-react-native';
import { Screen, NavLink } from '@/components/screen';
import { IconTile } from '@/components/brand';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';

const steps = [
  {
    icon: MapPin,
    number: '01',
    title: '갈 곳을 살펴봐요',
    description: '주소와 매장 접근성 정보를 확인해요. 확인되지 않은 정보는 직원에게 문의해 주세요.',
  },
  {
    icon: Link2,
    number: '02',
    title: '내 휴대폰을 연결해요',
    description: '매장의 기기 코드와 연결 코드를 입력하고, 주문할 매장이 맞는지 확인해요.',
  },
  {
    icon: ShoppingBag,
    number: '03',
    title: '내 방식으로 주문해요',
    description:
      '터치나 음성으로 메뉴를 고른 뒤 최종 확인해요. 결제는 매장 안내에 따라 진행해 주세요.',
  },
];

export default function Onboarding() {
  return (
    <Screen
      title="살펴보고, 선택하고, 연결해요."
      voice={false}
      subtitle="매장 정보를 확인하는 순간부터 주문까지, 갈지도와 차근차근 시작해 보세요."
    >
      <View className="flex-row flex-wrap gap-4">
        {steps.map((step) => (
          <Card key={step.number} className="flex-1" style={{ flexBasis: 260 }}>
            <CardContent className="gap-5">
              <View className="flex-row items-center justify-between">
                <IconTile icon={step.icon} />
                <Text className="font-bold text-primary">{step.number}</Text>
              </View>
              <Text variant="h2">{step.title}</Text>
              <Text className="leading-7 text-muted-foreground">{step.description}</Text>
            </CardContent>
          </Card>
        ))}
      </View>
      <View className="gap-5 rounded-3xl border border-border bg-secondary p-6 sm:p-8">
        <IconTile icon={Settings2} />
        <Text variant="h2">이용 방법은 직접 선택해 주세요.</Text>
        <Text className="max-w-2xl leading-7">
          장애 유형을 선택할 필요는 없어요. 큰 글자, 고대비, 음성 안내를 각각 설정할 수 있고,
          휴대폰의 VoiceOver와 TalkBack도 사용할 수 있어요.
        </Text>
        <View className="flex-row flex-wrap gap-3">
          <NavLink href="/settings">나에게 맞게 설정하기</NavLink>
          <NavLink href="/" variant="default" icon={ArrowRight}>
            매장 찾기 시작
          </NavLink>
        </View>
      </View>
      <NavLink href="/connect" className="self-start" icon={Link2}>
        이미 매장에 있어요 · 주문 연결
      </NavLink>
    </Screen>
  );
}
