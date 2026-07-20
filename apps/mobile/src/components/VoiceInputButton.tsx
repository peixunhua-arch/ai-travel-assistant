// §16.1 语音输入：Web 用 SpeechRecognition，原生提示系统听写
import { useState } from 'react';
import {
  Alert,
  Platform,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, radius, font } from '../theme';
import { MIN_TOUCH } from '../lib/a11y';
import { tapLight } from '../haptics';

type SpeechRecognitionType = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (ev: { results: { item: (i: number) => { transcript: string } | undefined } }) => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionType;
    webkitSpeechRecognition?: new () => SpeechRecognitionType;
  }
}

export function VoiceInputButton({
  disabled,
  onTranscript,
}: {
  disabled?: boolean;
  onTranscript: (text: string) => void;
}) {
  const [listening, setListening] = useState(false);

  const startWebSpeech = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      Alert.alert('语音输入', '请使用键盘语音听写');
      return;
    }
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) {
      Alert.alert('语音输入', '当前环境不支持语音识别，请使用键盘语音听写');
      return;
    }
    const rec = new SR();
    rec.lang = 'zh-CN';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const text = ev.results.item(0)?.transcript?.trim();
      if (text) onTranscript(text);
      setListening(false);
    };
    rec.onerror = () => {
      setListening(false);
      Alert.alert('语音识别失败', '请重试或使用文字输入');
    };
    setListening(true);
    rec.start();
    tapLight();
  };

  const handlePress = () => {
    if (disabled) return;
    if (Platform.OS === 'web') {
      startWebSpeech();
      return;
    }
    Alert.alert(
      '语音输入',
      '请长按输入框，使用系统键盘上的「麦克风」进行语音听写，识别结果会填入输入框。',
      [{ text: '知道了' }],
    );
    tapLight();
  };

  return (
    <TouchableOpacity
      style={[styles.btn, disabled && styles.disabled]}
      onPress={handlePress}
      disabled={disabled || listening}
      accessibilityRole="button"
      accessibilityLabel="语音输入"
    >
      {listening ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Text style={styles.icon}>🎤</Text>
      )}
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
  disabled: { opacity: 0.5 },
  icon: { fontSize: 20 },
});
