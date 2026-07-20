// 触觉反馈（手机震一下）的小封装。把 expo-haptics 包一层，好处有二：
//   1. 全项目统一「什么操作震哪种」，形成肌肉记忆（成功轻震、出错重震）；
//   2. 万一某台设备不支持震动（或以后想全局关掉），只改这一处，调用方不用动。
//
// 白话：expo-haptics 提供几种预设「手感」，我们只用三种最常见的。
// 所有函数都吞掉异常——触觉是「锦上添花」，失败绝不能影响主流程。
import * as Haptics from 'expo-haptics';

// 发送消息、点按等「轻确认」——很轻的一下
export function tapLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

// 操作成功（如复制成功）——系统的「成功」手感
export function tapSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

// 出错（发送失败等）——系统的「错误」手感，比成功更明显
export function tapError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
