// 发布社区帖子：行程 / 旅拍 / 评价。
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import type { CommunityPostType, SavedTrip } from '@travel/shared';
import { createCommunityPost } from '../../src/api';
import { listSavedTrips } from '../../src/tripStore';
import { pickChatImage } from '../../src/photoPicker';
import {
  buildTripSnapshot,
  defaultTripPostBody,
  defaultTripPostTitle,
} from '../../src/communityShare';
import { colors, spacing, radius, font } from '../../src/theme';
import { tapLight, tapSuccess, tapError } from '../../src/haptics';
import { safeGoBack } from '../../src/navigation';

const TYPES: { key: CommunityPostType; label: string; emoji: string }[] = [
  { key: 'trip', label: '行程', emoji: '🗺️' },
  { key: 'photo', label: '旅拍', emoji: '📷' },
  { key: 'review', label: '评价', emoji: '⭐' },
];

export default function CreateCommunityPostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    type?: CommunityPostType;
    tripId?: string;
    serverTripId?: string;
    destination?: string;
  }>();

  const [type, setType] = useState<CommunityPostType>(params.type ?? 'trip');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [coverPhoto, setCoverPhoto] = useState<string | undefined>();
  const [selectedTrip, setSelectedTrip] = useState<SavedTrip | null>(null);
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listSavedTrips().then(setTrips);
  }, []);

  useEffect(() => {
    if (!params.tripId || trips.length === 0) return;
    const trip = trips.find((t) => t.id === params.tripId);
    if (!trip) return;
    setSelectedTrip(trip);
    setType('trip');
    setTitle(defaultTripPostTitle(trip));
    setBody(defaultTripPostBody(trip));
    const firstPhoto = trip.days
      .flatMap((d) => d.items)
      .find((i) => i.photoUrl)?.photoUrl;
    if (firstPhoto) setCoverPhoto(firstPhoto);
  }, [params.tripId, trips]);

  const handlePickPhoto = async () => {
    const picked = await pickChatImage();
    if (!picked) return;
    setCoverPhoto(`data:${picked.mediaType};base64,${picked.base64}`);
    if (type !== 'photo') setType('photo');
  };

  const handleSelectTrip = (trip: SavedTrip) => {
    setSelectedTrip(trip);
    setType('trip');
    setTitle(defaultTripPostTitle(trip));
    setBody(defaultTripPostBody(trip));
    const firstPhoto = trip.days
      .flatMap((d) => d.items)
      .find((i) => i.photoUrl)?.photoUrl;
    if (firstPhoto) setCoverPhoto(firstPhoto);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('', '请填写标题和正文');
      return;
    }
    if (type === 'photo' && !coverPhoto) {
      Alert.alert('', '旅拍帖请添加一张照片');
      return;
    }
    if (type === 'trip' && !selectedTrip?.serverTripId) {
      Alert.alert(
        '需要同步行程',
        '请先确保该行程已保存并同步到云端（详情页显示可评价即已同步），再分享行程。',
      );
      return;
    }

    setSubmitting(true);
    const id = await createCommunityPost({
      type,
      title: title.trim(),
      body: body.trim(),
      tripId: type === 'trip' ? selectedTrip?.serverTripId : undefined,
      coverPhoto,
      tripSnapshot: type === 'trip' && selectedTrip ? buildTripSnapshot(selectedTrip) : undefined,
    });
    setSubmitting(false);

    if (!id) {
      tapError();
      Alert.alert('', '发布失败，请检查网络后重试');
      return;
    }
    tapSuccess();
    router.replace(`/community/${id}`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeGoBack(router, '/(tabs)/community')}>
          <Text style={styles.back}>← 取消</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>发布到社区</Text>
        <TouchableOpacity onPress={handleSubmit} disabled={submitting}>
          <Text style={[styles.publish, submitting && styles.publishDisabled]}>发布</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.typeRow}>
          {TYPES.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.typeBtn, type === t.key && styles.typeBtnActive]}
              onPress={() => {
                tapLight();
                setType(t.key);
              }}
            >
              <Text style={styles.typeEmoji}>{t.emoji}</Text>
              <Text style={[styles.typeLabel, type === t.key && styles.typeLabelActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.titleInput}
          placeholder="标题，如「成都 3 日美食之旅」"
          placeholderTextColor={colors.textPlaceholder}
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />
        <TextInput
          style={styles.bodyInput}
          placeholder={
            type === 'review'
              ? '写下你的真实体验、避雷建议…'
              : type === 'photo'
                ? '配一段旅拍说明…'
                : '介绍这份行程的亮点、适合人群…'
          }
          placeholderTextColor={colors.textPlaceholder}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={500}
        />

        <TouchableOpacity style={styles.photoBtn} onPress={handlePickPhoto}>
          <Text style={styles.photoBtnText}>📷 添加照片</Text>
        </TouchableOpacity>
        {coverPhoto ? (
          <Image source={{ uri: coverPhoto }} style={styles.preview} resizeMode="cover" />
        ) : null}

        {type === 'trip' && (
          <View style={styles.tripPick}>
            <Text style={styles.sectionTitle}>关联行程（需已同步云端）</Text>
            {trips.length === 0 ? (
              <Text style={styles.muted}>暂无已保存行程，请先在「规划行程」生成并保存</Text>
            ) : (
              trips.slice(0, 8).map((trip) => (
                <TouchableOpacity
                  key={trip.id}
                  style={[
                    styles.tripItem,
                    selectedTrip?.id === trip.id && styles.tripItemActive,
                  ]}
                  onPress={() => handleSelectTrip(trip)}
                >
                  <Text style={styles.tripName}>{trip.destination}</Text>
                  <Text style={styles.tripMeta}>
                    {trip.daysCount} 天
                    {trip.serverTripId ? ' · 已同步' : ' · 未同步'}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.accentBg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  back: { fontSize: font.body.size, color: colors.textMuted, fontWeight: '600' },
  headerTitle: { fontSize: font.title.size, fontWeight: font.title.weight, color: colors.textStrong },
  publish: { fontSize: font.body.size, color: colors.primary, fontWeight: '700' },
  publishDisabled: { opacity: 0.5 },
  content: { padding: spacing.md, gap: spacing.md },
  typeRow: { flexDirection: 'row', gap: spacing.sm },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  typeEmoji: { fontSize: 22, marginBottom: 4 },
  typeLabel: { fontSize: font.small.size, color: colors.textMuted, fontWeight: '600' },
  typeLabelActive: { color: colors.primaryDark },
  titleInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: font.body.size,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  bodyInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: font.body.size,
    color: colors.textPrimary,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  photoBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  photoBtnText: { fontSize: font.small.size, color: colors.primary, fontWeight: '600' },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
  },
  tripPick: { gap: spacing.sm },
  sectionTitle: { fontSize: font.small.size, fontWeight: '700', color: colors.textStrong },
  muted: { fontSize: font.small.size, color: colors.textMuted },
  tripItem: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tripItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  tripName: { fontSize: font.body.size, fontWeight: '600', color: colors.textStrong },
  tripMeta: { fontSize: font.tiny.size, color: colors.textMuted, marginTop: 2 },
});
