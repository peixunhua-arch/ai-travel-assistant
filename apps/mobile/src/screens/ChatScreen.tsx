// 聊天界面（自包含）。原本是整个 App.tsx，P1 迁移到 Expo Router 时抽出来，
// 放进「规划」Tab 的「聊聊」子页。逻辑一字未改，只做了三处「搬家」调整：
//   1. 顶层容器从 SafeAreaView 换成普通 View —— 安全区由外层页面(index.tsx)统一管；
//   2. 去掉了顶部标题栏和「新对话」按钮 —— 它们上移到「规划」Tab 的顶栏；
//   3. 去掉了外层 SafeAreaProvider 和首次引导覆盖层 —— 上移到根布局 app/_layout.tsx。
//
// 「新对话」怎么实现的？父组件给这个 ChatScreen 一个 key，点「新对话」就换 key，
// React 会把整个组件重新挂载，内部 state 自然回到初始（只有欢迎语）。所以这里
// 不需要暴露「清空」方法，保持自包含。
import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { sendMessageStream } from '../api';
import type { PickedImage } from '../photoPicker';
import { Markdown } from '../Markdown';
import { colors, spacing, radius, font, shadow } from '../theme';
import { tapLight, tapSuccess, tapError } from '../haptics';
import { QuickPromptChips } from '../components/QuickPromptChips';
import { TypingIndicator } from '../components/TypingIndicator';
import { HealthBanner } from '../components/HealthBanner';
import { SlideInBubble } from '../components/SlideInBubble';
import { loadChatMessages, saveChatMessages } from '../chatStore';
import { loadChatFeedbacks, setChatFeedback, type ChatFeedback } from '../chatFeedbackStore';
import { PhotoInputButton } from '../components/PhotoInputButton';
import { CapabilityHintCompact } from '../components/CapabilityHintCompact';
import { ErrorBanner } from '../components/ErrorBanner';
import { VoiceInputButton } from '../components/VoiceInputButton';
import { postChatFeedback } from '../api';
import type { TripGenerateRequest } from '@travel/shared';
import { parseTripIntent, looksLikeTripPlanIntent } from '../lib/parseTripIntent';

// 消息长度上限：和后端 chat.ts 的 z.string().max(2000) 对齐。
const MAX_LEN = 2000;
// 剩多少字时开始显示计数（快到上限才提示，平时不打扰）
const COUNT_WARN_AT = MAX_LEN - 200;

// 一条消息：谁说的 + 说了什么。id 给 FlatList 当 key。
// failed / error：只用于「用户发出去但没拿到回复」的消息 —— 用来显示「点按重试」。
interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  imageUri?: string;
  failed?: boolean;
  error?: string;
}

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  text: '你好！我是途灵，你的 AI 出行助手 🧳\n\n想去哪玩？可以问我行程、签证、天气、美食～\n想直接出行程时，也可以说「帮我规划成都3天」或点下方规划入口。',
};

type ChatScreenProps = {
  /** 把聊天里识别到的行程意图带入规划表单 */
  onPlanTrip?: (params: TripGenerateRequest) => void;
};

export function ChatScreen({ onPlanTrip }: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState('');
  const [quote, setQuote] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<Record<string, ChatFeedback>>({});
  const [pendingImage, setPendingImage] = useState<PickedImage | null>(null);
  const [pasteExpanded, setPasteExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const abortRef = useRef<AbortController | null>(null);

  // §8.4 启动时恢复最近聊天记录
  useEffect(() => {
    Promise.all([loadChatMessages(), loadChatFeedbacks()]).then(([stored, fb]) => {
      if (stored && stored.length > 0) {
        setMessages([WELCOME, ...stored.map((m) => ({ ...m }))]);
      }
      setFeedbacks(fb);
      setHydrated(true);
    });
  }, []);

  // 消息变化时持久化（跳过首次 hydration）
  useEffect(() => {
    if (!hydrated) return;
    saveChatMessages(messages.filter((m) => m.id !== 'welcome'));
  }, [messages, hydrated]);

  // 空对话（只有欢迎语）时，才显示快捷问题
  const isEmptyConversation = messages.length === 1;

  // 最近一条用户消息若像「要规划」，露出一键规划条
  const lastUserText = [...messages].reverse().find((m) => m.role === 'user' && !m.failed)?.text;
  const planHint =
    onPlanTrip && lastUserText && looksLikeTripPlanIntent(lastUserText)
      ? parseTripIntent(lastUserText)
      : null;

  const handlePlanFromText = (text: string) => {
    if (!onPlanTrip) return;
    const parsed = parseTripIntent(text) ?? {
      destination: '',
      days: 3,
      budget: 0,
      preferences: [],
      prompt: text.trim().slice(0, 200),
    };
    // 没猜到目的地：仍跳转表单，把原文塞进补充说明，让用户补全
    if (!parsed.destination) {
      onPlanTrip({
        destination: '',
        days: 3,
        budget: 0,
        preferences: [],
        prompt: text.trim().slice(0, 200),
      });
      return;
    }
    onPlanTrip(parsed);
  };

  // 滚到底部，保证最新消息可见
  const scrollToEnd = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  // 真正发请求的核心：不管是首次发送还是重试，都走这里。
  // userId 指向「是哪条用户消息在等回复」，成功就清掉它的失败标记，失败就打上。
  const runSend = async (
    text: string,
    userId: string,
    image?: Pick<PickedImage, 'base64' | 'mediaType'>,
  ) => {
    setLoading(true);
    scrollToEnd();
    const controller = new AbortController();
    abortRef.current = controller;

    const aiId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev.map((m) => (m.id === userId ? { ...m, failed: false, error: undefined } : m)),
      { id: aiId, role: 'assistant', text: '' },
    ]);

    try {
      const reply = await sendMessageStream(
        text,
        (delta) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === aiId ? { ...m, text: m.text + delta } : m)),
          );
          scrollToEnd();
        },
        controller.signal,
        image
          ? { imageBase64: image.base64, imageMediaType: image.mediaType }
          : undefined,
      );
      setMessages((prev) =>
        prev.map((m) => (m.id === aiId ? { ...m, text: reply || m.text } : m)),
      );
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') {
        setMessages((prev) => prev.filter((m) => m.id !== aiId));
        return;
      }
      tapError();
      const errText =
        e instanceof Error ? e.message : '网络出错了，请检查后端是否启动、手机和电脑是否同一 WiFi';
      setMessages((prev) =>
        prev
          .filter((m) => m.id !== aiId)
          .map((m) => (m.id === userId ? { ...m, failed: true, error: errText } : m)),
      );
    } finally {
      abortRef.current = null;
      setLoading(false);
      scrollToEnd();
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const buildMessage = (text: string) => {
    if (!quote) return text;
    const snippet = quote.length > 200 ? `${quote.slice(0, 200)}…` : quote;
    return `【针对以下回复继续问】\n> ${snippet}\n\n${text}`;
  };

  // 发送一条新消息（输入框发送、点 chip 都走这里）
  const send = (raw: string, image?: PickedImage | null) => {
    const text = raw.trim() || (image ? '请帮我看看这张图片，给出旅游相关的建议' : '');
    if (!text || loading) return;
    tapLight();
    const payload = buildMessage(text);
    const userId = `u-${Date.now()}`;
    const img = image ?? pendingImage;
    setMessages((prev) => [
      ...prev,
      {
        id: userId,
        role: 'user',
        text: payload,
        imageUri: img?.uri,
      },
    ]);
    setQuote(null);
    setPendingImage(null);
    runSend(
      payload,
      userId,
      img ? { base64: img.base64, mediaType: img.mediaType } : undefined,
    );
  };

  const handleSend = () => {
    if ((!input.trim() && !pendingImage) || loading) return;
    send(input, pendingImage);
    setInput('');
  };

  const handleAiLongPress = (messageId: string, text: string) => {
    if (!text.trim()) return;
    Alert.alert('AI 回复', undefined, [
      { text: '针对这条继续问', onPress: () => setQuote(text.trim()) },
      { text: '回答有用', onPress: () => handleFeedback(messageId, 1) },
      { text: '回答不准', onPress: () => handleFeedback(messageId, -1) },
      { text: '复制全文', onPress: () => handleCopy(text) },
      { text: '取消', style: 'cancel' },
    ]);
  };

  const handleFeedback = async (messageId: string, value: ChatFeedback) => {
    await setChatFeedback(messageId, value);
    postChatFeedback({ messageId, sentiment: value }).catch(() => {});
    setFeedbacks((prev) => ({ ...prev, [messageId]: value }));
    tapLight();
    Alert.alert('', value === 1 ? '感谢反馈，已记录' : '感谢反馈，我们会持续改进');
  };

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    tapSuccess();
    Alert.alert('', '已复制到剪贴板');
  };

  // 点「重试」：复用那条失败消息的原文，重新发一次
  const handleRetry = (m: Message) => {
    if (loading) return;
    runSend(m.text, m.id);
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    const bubble = (
      <View style={[styles.bubbleRow, isUser ? styles.rowRight : styles.rowLeft]}>
        <View style={styles.msgCol}>
          {isUser ? (
            <View style={[styles.bubble, styles.userBubble]}>
              {item.imageUri ? (
                <Image
                  source={{ uri: item.imageUri }}
                  style={styles.userImage}
                  accessibilityLabel="用户发送的图片"
                />
              ) : null}
              <Text style={styles.userText} allowFontScaling>{item.text}</Text>
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.8}
              onLongPress={() => handleAiLongPress(item.id, item.text)}
              delayLongPress={350}
              accessibilityRole="text"
              accessibilityLabel="AI 回复，长按可复制、引用或反馈"
            >
              <View style={[styles.bubble, styles.aiBubble]}>
                <Markdown text={item.text} />
                {feedbacks[item.id] != null && (
                  <Text style={styles.feedbackBadge}>
                    {feedbacks[item.id] === 1 ? '👍 已反馈有用' : '👎 已反馈不准'}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}

          {item.failed && (
            <ErrorBanner
              message={item.error ?? '发送失败'}
              onRetry={() => handleRetry(item)}
            />
          )}
        </View>
      </View>
    );

    if (item.id === 'welcome') return bubble;
    return <SlideInBubble>{bubble}</SlideInBubble>;
  };

  return (
    <View style={styles.flex}>
      {/* 后端连不上时，这里会冒出一条黄色提示条；正常则什么都不显示 */}
      <HealthBanner />

      <KeyboardAvoidingView
        style={styles.flex}
        // iOS 用 padding 顶起输入栏；Android 交给系统的 adjustResize（Expo 默认），
        // 不要在 Android 上再叠 behavior，否则会「双重顶起」反而更糟。
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={scrollToEnd}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={isEmptyConversation ? <CapabilityHintCompact /> : null}
          // 空对话时，欢迎语下面挂一排快捷问题
          ListFooterComponent={
            isEmptyConversation ? (
              <QuickPromptChips
                onPick={send}
                onPlanPick={onPlanTrip ? handlePlanFromText : undefined}
                disabled={loading}
              />
            ) : null
          }
        />

        {planHint && !loading && (
          <View style={styles.planBar}>
            <Text style={styles.planBarText} numberOfLines={2}>
              检测到想规划「{planHint.destination}」{planHint.days} 天
            </Text>
            <TouchableOpacity
              style={styles.planBarBtn}
              onPress={() => onPlanTrip?.(planHint)}
              accessibilityRole="button"
              accessibilityLabel="用检测到的信息打开规划表单"
            >
              <Text style={styles.planBarBtnText}>去生成行程</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading && <TypingIndicator />}

        {loading && (
          <TouchableOpacity style={styles.stopBtn} onPress={handleStop} accessibilityLabel="停止生成">
            <Text style={styles.stopText}>停止</Text>
          </TouchableOpacity>
        )}

        {/* 快到字数上限才显示计数，平时不打扰 */}
        {input.length >= COUNT_WARN_AT && (
          <Text style={styles.counter}>
            {input.length} / {MAX_LEN}
          </Text>
        )}

        {input.length > 400 && (
          <TouchableOpacity
            style={styles.pastePreview}
            onPress={() => setPasteExpanded((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="展开或折叠长文本预览"
          >
            <Text style={styles.pastePreviewText} numberOfLines={pasteExpanded ? 6 : 2}>
              {input}
            </Text>
            <Text style={styles.pasteToggle}>{pasteExpanded ? '收起' : '展开全文'}</Text>
          </TouchableOpacity>
        )}

        {quote && (
          <View style={styles.quoteBar}>
            <Text style={styles.quoteText} numberOfLines={2}>
              引用：{quote}
            </Text>
            <TouchableOpacity onPress={() => setQuote(null)} accessibilityLabel="取消引用">
              <Text style={styles.quoteClear}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {pendingImage && (
          <View style={styles.imagePreview}>
            <Image source={{ uri: pendingImage.uri }} style={styles.previewThumb} />
            <Text style={styles.previewLabel}>已选图片，可补充文字后发送</Text>
            <TouchableOpacity
              onPress={() => setPendingImage(null)}
              accessibilityLabel="移除待发送图片"
            >
              <Text style={styles.quoteClear}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputBar}>
          <PhotoInputButton
            disabled={loading}
            onImagePicked={(img) => setPendingImage(img)}
          />
          <VoiceInputButton
            disabled={loading}
            onTranscript={(text) => setInput((prev) => (prev ? `${prev} ${text}` : text))}
          />
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="问我任何旅游问题…"
            placeholderTextColor={colors.textPlaceholder}
            multiline
            maxLength={MAX_LEN}
            editable={!loading}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            accessibilityLabel="消息输入框"
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              ((!input.trim() && !pendingImage) || loading) && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={(!input.trim() && !pendingImage) || loading}
            accessibilityRole="button"
            accessibilityLabel="发送消息"
          >
            <Text style={styles.sendBtnText}>发送</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  planBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primaryBg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
  },
  planBarText: {
    flex: 1,
    fontSize: font.small.size,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  planBarBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  planBarBtnText: {
    color: colors.textOnPrimary,
    fontSize: font.small.size,
    fontWeight: '700',
  },
  listContent: { padding: spacing.md, gap: spacing.sm + 2 },
  bubbleRow: { flexDirection: 'row' },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  msgCol: { maxWidth: '82%' },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
  },
  aiBubble: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sm - 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    ...shadow.soft,
  },
  userBubble: {
    backgroundColor: colors.accent,
    borderTopRightRadius: radius.sm - 2,
  },
  userText: { color: colors.textOnAccent, fontSize: font.body.size, lineHeight: font.body.lineHeight },
  userImage: {
    width: 160,
    height: 120,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  imagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.inputBg,
    borderRadius: radius.sm,
  },
  previewThumb: { width: 48, height: 48, borderRadius: radius.sm },
  previewLabel: { flex: 1, fontSize: font.tiny.size, color: colors.textMuted },
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
  },
  retryText: { color: colors.danger, fontSize: font.tiny.size, flexShrink: 1 },
  retryAction: {
    color: colors.primary,
    fontSize: font.tiny.size,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  counter: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    color: colors.textMuted,
    fontSize: font.tiny.size,
  },
  pastePreview: {
    marginHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.inputBg,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  pastePreviewText: {
    fontSize: font.tiny.size,
    color: colors.textMuted,
    lineHeight: 18,
  },
  pasteToggle: {
    marginTop: spacing.xs,
    fontSize: font.tiny.size,
    color: colors.primary,
    fontWeight: '600',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
    ...shadow.float,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 42,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: colors.inputBg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    fontSize: font.body.size,
    color: colors.textPrimary,
  },
  sendBtn: {
    height: 44,
    minWidth: 52,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  sendBtnDisabled: { backgroundColor: colors.primaryDisabled, elevation: 0, shadowOpacity: 0 },
  sendBtnText: { color: colors.textOnPrimary, fontSize: font.body.size, fontWeight: '700' },
  stopBtn: {
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  stopText: { fontSize: font.small.size, color: colors.danger, fontWeight: '600' },
  quoteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.inputBg,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  quoteText: {
    flex: 1,
    fontSize: font.tiny.size,
    color: colors.textMuted,
  },
  quoteClear: {
    fontSize: 16,
    color: colors.textMuted,
    paddingHorizontal: spacing.sm,
  },
  feedbackBadge: {
    marginTop: spacing.xs,
    fontSize: font.tiny.size,
    color: colors.textMuted,
  },
});
