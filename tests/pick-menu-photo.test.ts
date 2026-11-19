import { getDocumentAsync } from 'expo-document-picker';
import { pickMenuPhoto } from '@/lib/pick-menu-photo';

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({
  File: class {
    size = 4;
    arrayBuffer = async () => new Uint8Array([1, 2, 3, 4]).buffer;
  },
}));

const pick = getDocumentAsync as jest.Mock;
test('canceling or closing an empty picker skips the upload', async () => {
  pick
    .mockResolvedValueOnce({ canceled: true })
    .mockResolvedValueOnce({ canceled: false, assets: [] });
  expect(await pickMenuPhoto()).toBeNull();
  expect(await pickMenuPhoto()).toBeNull();
});

test('reads the selected native cache file', async () => {
  pick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/coffee.png' }] });
  expect(new Uint8Array((await pickMenuPhoto())!)).toEqual(new Uint8Array([1, 2, 3, 4]));
});

test('rejects oversized browser files before reading their contents', async () => {
  const revoke = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const file = { size: 1024 * 1024 + 1, arrayBuffer: jest.fn() };
  try {
    pick.mockResolvedValue({ canceled: false, assets: [{ file, uri: 'blob:photo' }] });
    await expect(pickMenuPhoto()).rejects.toMatchObject({ code: 'photo-too-large' });
    expect(file.arrayBuffer).not.toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith('blob:photo');
  } finally {
    revoke.mockRestore();
  }
});
