import { useState } from 'react';
import { Image, View } from 'react-native';
import { Coffee, type LucideIcon } from 'lucide-react-native';
import { Icon } from './ui/icon';

export function CatalogThumbnail({
  imageUrl,
  size = 68,
  height = size,
  fallback = Coffee,
}: {
  imageUrl?: string;
  size?: number;
  height?: number;
  fallback?: LucideIcon;
}) {
  const [failedUrl, setFailedUrl] = useState<string>();
  return (
    <View
      className="shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary"
      style={{ width: size, height }}
      accessible={false}
    >
      {imageUrl && imageUrl !== failedUrl ? (
        <Image
          source={{ uri: imageUrl }}
          onError={() => setFailedUrl(imageUrl)}
          style={{ width: size, height }}
          accessibilityIgnoresInvertColors
          accessible={false}
        />
      ) : (
        <Icon as={fallback} size={22} className="text-primary" accessible={false} />
      )}
    </View>
  );
}
