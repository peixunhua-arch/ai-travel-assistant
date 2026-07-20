// 冷启动示例行程（UX §5.3）：让新用户先看懂 UI 长什么样，只读、不可评价。
import type { SavedTrip } from '@travel/shared';

export const SAMPLE_TRIP_ID = '__sample_chengdu__';

export const SAMPLE_TRIP: SavedTrip = {
  id: SAMPLE_TRIP_ID,
  createdAt: '2026-01-01T00:00:00.000Z',
  destination: '成都（示例）',
  daysCount: 2,
  budgetEstimate: 2500,
  days: [
    {
      day: 1,
      theme: '老城区人文一日',
      items: [
        {
          time: '09:30',
          name: '宽窄巷子',
          type: 'sight',
          description: '清代老街巷，适合早晨慢慢逛，感受老成都慢生活。',
        },
        {
          time: '12:00',
          name: '陈麻婆豆腐',
          type: 'food',
          description: '川菜经典，建议早点去避开排队高峰。',
        },
        {
          time: '15:00',
          name: '杜甫草堂',
          type: 'sight',
          description: '唐代诗人杜甫故居，园林清幽，适合午后散步。',
        },
        {
          time: '19:00',
          name: '春熙路',
          type: 'sight',
          description: '成都最热闹商圈，晚餐和夜景都不错。',
        },
      ],
    },
    {
      day: 2,
      theme: '熊猫与茶馆',
      items: [
        {
          time: '08:30',
          name: '成都大熊猫繁育研究基地',
          type: 'sight',
          description: '建议开园即到，上午熊猫最活跃。',
        },
        {
          time: '13:00',
          name: '人民公园鹤鸣茶社',
          type: 'food',
          description: '盖碗茶 + 掏耳朵，体验地道成都茶馆文化。',
        },
        {
          time: '17:00',
          name: '武侯祠',
          type: 'sight',
          description: '三国文化地标，旁边就是锦里古街。',
        },
      ],
    },
  ],
};

export function isSampleTrip(id: string): boolean {
  return id === SAMPLE_TRIP_ID;
}
