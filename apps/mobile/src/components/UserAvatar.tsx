// 用户头像展示：支持 emoji 预设与相册图片。
import { View, Text, Image, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { parseAvatar } from '../lib/userProfile';
import { colors } from '../theme';

interface Props {
  avatar: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function UserAvatar({ avatar, size = 56, style }: Props) {
  const parsed = parseAvatar(avatar);
  const radius = size / 2;
  const sizeStyle = { width: size, height: size, borderRadius: radius };

  if (parsed.kind === 'photo') {
    return (
      <View style={[styles.photoWrap, sizeStyle, style]}>
        <Image source={{ uri: parsed.uri }} style={[styles.photo, sizeStyle]} />
      </View>
    );
  }

  return (
    <View style={[styles.emojiWrap, sizeStyle, style]}>
      <Text style={{ fontSize: size * 0.46 }}>{parsed.value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emojiWrap: {
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  photoWrap: {
    backgroundColor: colors.inputBg,
    borderWidth: 2,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
});
