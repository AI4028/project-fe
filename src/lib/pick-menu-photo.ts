import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';
import { ApiError } from './api';

export async function pickMenuPhoto(): Promise<ArrayBuffer | null> {
  const result = await getDocumentAsync({
    type: ['image/jpeg', 'image/png', 'image/webp'],
    base64: false,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  const file = asset.file ?? new File(asset.uri);
  try {
    if (file.size > 1024 * 1024) throw new ApiError('photo-too-large', 413, '');
    return await file.arrayBuffer();
  } finally {
    if (asset.file) URL.revokeObjectURL(asset.uri);
  }
}
