// 编辑昵称与头像。
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { UserProfile } from '@travel/shared';
import { UserAvatar } from '../UserAvatar';
import { pickAvatarImage } from '../../photoPicker';
import { emojiAvatar, DEFAULT_PROFILE } from '../../lib/userProfile';
import { colors, spacing, radius, font } from '../../theme';
import { tapLight, tapSuccess, tapError } from '../../haptics';

const EMOJI_PRESETS = ['🧳', '🌍', '✈️', '🏔️', '🌊', '🍜', '📷', '🎒', '🚄', '🌸', '🦊', '🐼'];

interface Props {
  visible: boolean;
  profile: UserProfile;
  signature?: string;
  onClose: () => void;
  onSave: (next: UserProfile, signature: string) => Promise<boolean>;
}

export function ProfileEditModal({
  visible,
  profile,
  signature = '',
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(profile.displayName);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [bio, setBio] = useState(signature);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(profile.displayName);
    setAvatar(profile.avatar);
    setBio(signature);
  }, [visible, profile, signature]);

  const handlePickPhoto = async () => {
    tapLight();
    const uri = await pickAvatarImage();
    if (uri) setAvatar(uri);
  };

  const handleSave = async () => {
    const displayName = name.trim() || DEFAULT_PROFILE.displayName;
    if (!displayName) {
      Alert.alert('', '请输入昵称');
      return;
    }
    setSaving(true);
    const ok = await onSave({ displayName, avatar }, bio.trim());
    setSaving(false);
    if (ok) {
      tapSuccess();
      onClose();
    } else {
      tapError();
      Alert.alert('', '保存失败，请检查网络后重试');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>编辑资料</Text>

          <View style={styles.avatarPreview}>
            <UserAvatar avatar={avatar} size={80} />
            <TouchableOpacity style={styles.photoBtn} onPress={handlePickPhoto}>
              <Text style={styles.photoBtnText}>从相册选择</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>选择头像表情</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiRow}>
            {EMOJI_PRESETS.map((e) => (
              <TouchableOpacity
                key={e}
                style={[styles.emojiChip, avatar === emojiAvatar(e) && styles.emojiChipOn]}
                onPress={() => {
                  tapLight();
                  setAvatar(emojiAvatar(e));
                }}
              >
                <Text style={styles.emojiText}>{e}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>昵称</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="输入昵称"
            placeholderTextColor={colors.textPlaceholder}
            maxLength={20}
          />
          <Text style={styles.hint}>{name.length}/20</Text>

          <Text style={styles.label}>个性签名</Text>
          <TextInput
            style={styles.input}
            value={bio}
            onChangeText={setBio}
            placeholder="一句话说说你的旅行态度"
            placeholderTextColor={colors.textPlaceholder}
            maxLength={40}
          />
          <Text style={styles.hint}>{bio.length}/40</Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveText}>{saving ? '保存中…' : '保存'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textStrong,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  avatarPreview: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  photoBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  photoBtnText: {
    fontSize: font.small.size,
    color: colors.primary,
    fontWeight: '600',
  },
  label: {
    fontSize: font.small.size,
    fontWeight: '700',
    color: colors.textStrong,
    marginTop: spacing.xs,
  },
  emojiRow: {
    flexGrow: 0,
    marginVertical: spacing.xs,
  },
  emojiChip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  emojiChipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  emojiText: { fontSize: 24 },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: font.body.size,
    color: colors.textPrimary,
  },
  hint: {
    fontSize: font.tiny.size,
    color: colors.textMuted,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cancelText: { fontSize: font.body.size, color: colors.textMuted, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { fontSize: font.body.size, color: colors.textOnPrimary, fontWeight: '700' },
});
