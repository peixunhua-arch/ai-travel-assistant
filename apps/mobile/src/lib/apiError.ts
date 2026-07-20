// §6.2 统一错误文案映射
import type { ApiError } from '@travel/shared';

export function mapApiError(status: number, body?: ApiError, context?: 'chat' | 'trip'): string {
  const code = body?.code;
  const serverMsg = body?.error;

  if (status === 401) return '登录已过期，正在重新连接…';
  if (status === 422 || code === 'TRIP_PARSE_FAILED') {
    return context === 'trip' ? '这次没生成好，换个说法试试' : (serverMsg ?? '请求格式有误');
  }
  if (status === 502 || code === 'CLAUDE_ERROR' || code === 'TRIP_UPLOAD_FAILED') {
    return 'AI 暂时繁忙，请稍后重试';
  }
  if (status === 400) return serverMsg ?? '请求参数不对';
  if (status === 404) return serverMsg ?? '资源不存在';
  if (status === 0) return '无法连接，请检查 WiFi 和后端是否启动';
  return serverMsg ?? `请求失败 (${status})`;
}

export function mapTripGenerateError(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === 'AbortError') return '已取消生成';
    if (e.message.includes('无法连接')) return e.message;
    if (e.message.includes('格式有误') || e.message.includes('没生成好')) {
      return '这次没生成好，换个说法试试';
    }
    if (e.message.includes('繁忙') || e.message.includes('502')) {
      return 'AI 暂时繁忙，请稍后重试';
    }
    return e.message;
  }
  return '生成失败，请重试';
}
