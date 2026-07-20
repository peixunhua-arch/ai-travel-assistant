// §10 应用内 WebView 打开第三方链接
import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, spacing, font, radius } from '../theme';

let openHandler: ((url: string, title?: string) => void) | null = null;

export function registerWebViewHandler(fn: (url: string, title?: string) => void) {
  openHandler = fn;
}

export function openInAppWebView(url: string, title?: string) {
  openHandler?.(url, title);
}

export function ExternalLinkHost() {
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('网页');

  useEffect(() => {
    registerWebViewHandler((u, t) => {
      setUrl(u);
      setTitle(t ?? '网页');
      setVisible(true);
    });
  }, []);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setVisible(false)} accessibilityLabel="关闭网页">
            <Text style={styles.close}>关闭</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.spacer} />
        </View>
        {url ? <WebView source={{ uri: url }} style={styles.web} /> : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  close: { fontSize: font.body.size, color: colors.primary, fontWeight: '600', minWidth: 48 },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: font.small.size,
    fontWeight: '600',
    color: colors.textStrong,
  },
  spacer: { width: 48 },
  web: { flex: 1 },
});
