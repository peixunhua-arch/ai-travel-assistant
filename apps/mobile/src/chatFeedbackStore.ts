// §16.2 聊天消息级反馈：本地记录用户对 AI 回复的 👍/👎（后续可用于改 prompt）。
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'chatFeedback';

export type ChatFeedback = 1 | -1;

export async function loadChatFeedbacks(): Promise<Record<string, ChatFeedback>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ChatFeedback>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function setChatFeedback(messageId: string, feedback: ChatFeedback): Promise<void> {
  const all = await loadChatFeedbacks();
  all[messageId] = feedback;
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}
