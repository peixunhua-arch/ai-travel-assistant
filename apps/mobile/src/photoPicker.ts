// §16.1 拍照/选图并压缩为 base64，供多模态聊天使用。
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Alert } from 'react-native';

const MAX_EDGE = 1568;

export type PickedImage = {
  uri: string;
  base64: string;
  mediaType: 'image/jpeg' | 'image/png';
};

export async function pickChatImage(): Promise<PickedImage | null> {
  const camPerm = await ImagePicker.requestCameraPermissionsAsync();
  const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!camPerm.granted && !libPerm.granted) {
    Alert.alert('需要权限', '请允许访问相机或相册以添加图片');
    return null;
  }

  const choice = await new Promise<'camera' | 'library' | null>((resolve) => {
    Alert.alert('添加图片', '选择图片来源', [
      { text: '取消', style: 'cancel', onPress: () => resolve(null) },
      { text: '拍照', onPress: () => resolve('camera') },
      { text: '从相册选择', onPress: () => resolve('library') },
    ]);
  });
  if (!choice) return null;

  const result =
    choice === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.85,
          allowsEditing: false,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.85,
          allowsEditing: false,
        });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const w = asset.width ?? MAX_EDGE;
  const h = asset.height ?? MAX_EDGE;
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));

  const manipulated = await ImageManipulator.manipulateAsync(
    asset.uri,
    scale < 1 ? [{ resize: { width: Math.round(w * scale), height: Math.round(h * scale) } }] : [],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );

  if (!manipulated.base64) {
    Alert.alert('', '图片处理失败，请换一张试试');
    return null;
  }

  return {
    uri: manipulated.uri,
    base64: manipulated.base64,
    mediaType: 'image/jpeg',
  };
}

const AVATAR_EDGE = 256;

/** 选取头像照片（正方形压缩，体积更小） */
export async function pickAvatarImage(): Promise<string | null> {
  const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!libPerm.granted) {
    Alert.alert('需要权限', '请允许访问相册以设置头像');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsEditing: true,
    aspect: [1, 1],
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const w = asset.width ?? AVATAR_EDGE;
  const h = asset.height ?? AVATAR_EDGE;
  const scale = Math.min(1, AVATAR_EDGE / Math.max(w, h));

  const manipulated = await ImageManipulator.manipulateAsync(
    asset.uri,
    scale < 1 ? [{ resize: { width: Math.round(w * scale), height: Math.round(h * scale) } }] : [],
    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );

  if (!manipulated.base64) {
    Alert.alert('', '图片处理失败，请换一张试试');
    return null;
  }

  return `data:image/jpeg;base64,${manipulated.base64}`;
}
