import type { UserProfile } from '@travel/shared';

export const DEFAULT_PROFILE: UserProfile = {
  displayName: '途灵旅行者',
  avatar: 'emoji:🧳',
};

export function parseAvatar(avatar: string): { kind: 'emoji'; value: string } | { kind: 'photo'; uri: string } {
  if (avatar.startsWith('emoji:')) {
    return { kind: 'emoji', value: avatar.slice(6) || '🧳' };
  }
  return { kind: 'photo', uri: avatar };
}

export function emojiAvatar(emoji: string): string {
  return `emoji:${emoji}`;
}
