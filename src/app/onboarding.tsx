import { router } from 'expo-router';
import { Screen } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useApp } from '@/providers/app-provider';
import { assistanceLabels, assistanceFromSpeech, type Assistance } from '@/lib/location';
export default function Onboarding() {
  const app = useApp();
  async function choose(assistance: Assistance) {
    await app.saveSettings({ ...app.settings, assistance });
    router.replace('/');
  }
  return (
    <Screen
      title="어떤 도움이 필요하세요?"
      subtitle="선택을 기억해 다음부터 바로 지도를 보여 드려요."
      onTranscript={(text) => {
        const type = assistanceFromSpeech(text);
        if (!type) return false;
        void choose(type).catch(app.report);
        return true;
      }}
    >
      {(Object.keys(assistanceLabels) as Assistance[]).map((type) => (
        <Button key={type} onPress={() => void choose(type).catch(app.report)}>
          <Text>{assistanceLabels[type]}</Text>
        </Button>
      ))}
    </Screen>
  );
}
