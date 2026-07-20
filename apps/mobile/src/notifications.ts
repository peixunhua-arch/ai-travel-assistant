// §6.6 本地通知（生成完成 / 出行提醒）。延迟加载 expo-notifications，避免 Expo Go 启动时触发远程推送注册。
import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

let configured = false;
let notificationsMod: NotificationsModule | null = null;

async function getNotifications(): Promise<NotificationsModule | null> {
  if (notificationsMod) return notificationsMod;
  try {
    notificationsMod = await import('expo-notifications');
    return notificationsMod;
  } catch {
    return null;
  }
}

function isGranted(
  Notifications: NotificationsModule,
  settings: Notifications.NotificationPermissionsStatus,
): boolean {
  const ext = settings as Notifications.NotificationPermissionsStatus & { granted?: boolean };
  if (ext.granted) return true;
  const ios = settings.ios?.status;
  return (
    ios === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    ios === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

export async function setupNotifications(): Promise<boolean> {
  if (configured) return true;
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('trip', {
        name: '行程生成',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const existing = await Notifications.getPermissionsAsync();
    let finalGranted = isGranted(Notifications, existing);
    if (!finalGranted) {
      const requested = await Notifications.requestPermissionsAsync();
      finalGranted = isGranted(Notifications, requested);
    }
    configured = finalGranted;
    return configured;
  } catch {
    return false;
  }
}

export async function notifyTripReady(destination: string): Promise<void> {
  const ok = await setupNotifications();
  if (!ok) return;
  const Notifications = await getNotifications();
  if (!Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '行程已生成',
        body: `「${destination}」行程已准备好，点击查看`,
      },
      trigger: null,
    });
  } catch {
    // 通知失败不阻断主流程
  }
}

const REMINDER_PREFIX = 'travel-reminder-';

/** §16.4 出行前一天提醒 */
export async function scheduleTravelReminder(input: {
  tripId: string;
  destination: string;
  remindAt: Date;
}): Promise<void> {
  const ok = await setupNotifications();
  if (!ok) return;
  const Notifications = await getNotifications();
  if (!Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `${REMINDER_PREFIX}${input.tripId}`,
      content: {
        title: '出行前提醒',
        body: `去「${input.destination}」前，记得看看天气和 Day1 安排`,
        data: { tripId: input.tripId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: input.remindAt,
        channelId: Platform.OS === 'android' ? 'trip' : undefined,
      },
    });
  } catch {
    // 调度失败不阻断主流程
  }
}

export async function cancelAllScheduledNotifications(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ids = scheduled
      .map((n) => n.identifier)
      .filter((id) => id.startsWith(REMINDER_PREFIX));
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  } catch {
    // ignore
  }
}
