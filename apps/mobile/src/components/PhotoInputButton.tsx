// §16.1 拍照提问入口。
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, radius, font } from '../theme';
import { MIN_TOUCH } from '../lib/a11y';
import { pickChatImage, type PickedImage } from '../photoPicker';

export function PhotoInputButton({
  disabled,
  onImagePicked,
}: {
  disabled?: boolean;
  onImagePicked: (image: PickedImage) => void;
}) {
  const handlePress = async () => {
    const picked = await pickChatImage();
    if (picked) onImagePicked(picked);
  };

  return (
    <TouchableOpacity
      style={[styles.btn, disabled && styles.btnDisabled]}
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="拍照或选图提问"
      accessibilityHint="可拍照或从相册选择图片，配合文字一起发给 AI"
    >
      <Text style={styles.icon}>📷</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.pill,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  icon: { fontSize: font.title.size },
});
