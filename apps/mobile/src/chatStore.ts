// §8.4 闲聊会话本地持久化：最近 50 条消息，重启 App 可恢复。
import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAT_KEY = 'chatMessages';
const MAX_MESSAGES = 50;

export interface StoredChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export async function loadChatMessages(): Promise<StoredChatMessage[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CHAT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredChatMessage[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveChatMessages(messages: StoredChatMessage[]): Promise<void> {
  // 只存 user/assistant 正文，不存 failed/error 临时态
  const toSave = messages
    .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.text.trim()))
    .slice(-MAX_MESSAGES);
  await AsyncStorage.setItem(CHAT_KEY, JSON.stringify(toSave));
}

export async function clearChatMessages(): Promise<void> {
  await AsyncStorage.removeItem(CHAT_KEY);
}
