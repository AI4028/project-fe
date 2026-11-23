import { KioskFinder } from '@/components/kiosk-finder';
import { Screen } from '@/components/screen';
import { useHeading } from '@/lib/use-heading';

// Bluetooth-only view of the kiosk finder (also shown on the direction screen).
export default function FindKiosk() {
  const { heading, status, request } = useHeading(true);
  return (
    <Screen
      title="키오스크 찾기 (블루투스 테스트)"
      subtitle="키오스크의 블루투스 신호로 거리와 방향을 안내해요. 거리와 방향은 대략적이에요."
      voice={false}
    >
      <KioskFinder heading={heading} compassStatus={status} allowCompass={request} />
    </Screen>
  );
}
