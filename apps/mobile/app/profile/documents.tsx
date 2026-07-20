// 出行工具：证件信息备忘（仅本机，不上传）。
import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { colors, spacing, radius, font } from '../../src/theme';
import { tapSuccess } from '../../src/haptics';

const KEY = 'travelDocsMemo_v1';

type Docs = {
  idNote: string;
  passportNote: string;
  other: string;
};

const EMPTY: Docs = { idNote: '', passportNote: '', other: '' };

export default function DocumentsScreen() {
  const [docs, setDocs] = useState<Docs>(EMPTY);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(KEY).then((raw) => {
        if (!raw) return;
        try {
          setDocs({ ...EMPTY, ...(JSON.parse(raw) as Docs) });
        } catch {
          // ignore
        }
      });
    }, []),
  );

  const save = async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify(docs));
    tapSuccess();
    Alert.alert('', '已保存在本机，不会上传云端');
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.lead}>
        仅作出行备忘，内容只存在本机。请勿填写完整证件号等高敏感信息。
      </Text>

      <Text style={styles.label}>身份证提示</Text>
      <TextInput
        style={styles.input}
        value={docs.idNote}
        onChangeText={(idNote) => setDocs((d) => ({ ...d, idNote }))}
        placeholder="如：放在钱包夹层"
        placeholderTextColor={colors.textPlaceholder}
      />

      <Text style={styles.label}>护照 / 签证提示</Text>
      <TextInput
        style={styles.input}
        value={docs.passportNote}
        onChangeText={(passportNote) => setDocs((d) => ({ ...d, passportNote }))}
        placeholder="如：签证有效期、存放位置"
        placeholderTextColor={colors.textPlaceholder}
      />

      <Text style={styles.label}>其他</Text>
      <TextInput
        style={[styles.input, styles.area]}
        value={docs.other}
        onChangeText={(other) => setDocs((d) => ({ ...d, other }))}
        placeholder="登机牌、酒店确认号等"
        placeholderTextColor={colors.textPlaceholder}
        multiline
      />

      <TouchableOpacity style={styles.btn} onPress={save}>
        <Text style={styles.btnText}>保存备忘</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl * 2 },
  lead: { fontSize: font.small.size, color: colors.textMuted, lineHeight: 20, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textStrong, marginTop: 6 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: font.body.size,
    color: colors.textPrimary,
  },
  area: { minHeight: 96, textAlignVertical: 'top' },
  btn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: { color: colors.textOnPrimary, fontWeight: '800', fontSize: 15 },
});
