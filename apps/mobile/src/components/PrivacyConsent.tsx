// 隐私与合规同意弹窗（UX §10 / 技术方案 §4）：首次启动必须同意后才能使用。
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, font } from '../theme';

export const PRIVACY_KEY = 'hasAcceptedPrivacy_v1';

interface Props {
  onAccept: () => void;
}

export function PrivacyConsent({ onAccept }: Props) {
  const accept = async () => {
    await AsyncStorage.setItem(PRIVACY_KEY, '1');
    onAccept();
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>隐私与数据说明</Text>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.section}>我们如何使用你的数据</Text>
          <Text style={styles.body}>
            · 设备标识：用于匿名登录，不收集手机号或姓名{'\n'}
            · 行程数据：主要保存在本机；保存时会上传一份用于评价同步{'\n'}
            · 评价数据：用于个性化推荐和社区口碑，不会公开你的身份{'\n'}
            · AI 对话：发送至后端 Claude 服务处理，密钥不存储在 App 内
          </Text>

          <Text style={styles.section}>地图与第三方服务</Text>
          <Text style={styles.body}>
            · 地图由高德 Web JS API 提供，地点坐标/评分来自高德 POI{'\n'}
            · 跳转小红书/大众点评仅为搜索链接，我们不抓取其内容{'\n'}
            · 本 App 与上述平台无官方合作关系
          </Text>

          <Text style={styles.section}>高德地图 SDK 说明</Text>
          <Text style={styles.body}>
            · 地图展示使用高德 Web JS API，需联网加载地图资源{'\n'}
            · 地点搜索与坐标回填使用高德 Web 服务 API{'\n'}
            · 使用地图即表示你同意高德相关服务条款与隐私政策
          </Text>

          <Text style={styles.section}>重要提示</Text>
          <Text style={styles.body}>
            · AI 生成内容仅供参考，请以实际营业时间与价格为准{'\n'}
            · 换手机/重装/清数据会丢失本地行程，可在「我的」导出备份
          </Text>
        </ScrollView>

        <TouchableOpacity style={styles.btn} onPress={accept} accessibilityRole="button">
          <Text style={styles.btnText}>我已阅读并同意</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
    zIndex: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '85%',
    gap: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textStrong,
    textAlign: 'center',
  },
  scroll: { flexGrow: 0 },
  scrollContent: { gap: spacing.sm },
  section: {
    fontSize: font.body.size,
    fontWeight: '700',
    color: colors.textStrong,
    marginTop: spacing.sm,
  },
  body: {
    fontSize: font.small.size,
    lineHeight: 22,
    color: colors.textMuted,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  btnText: { color: colors.textOnPrimary, fontSize: font.body.size, fontWeight: '700' },
});
