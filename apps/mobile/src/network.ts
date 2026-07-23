// 网络状态工具（UX §6.5 / §6.6）：离线横幅、弱网提示、外链/评价前的联网判断。
import { useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export type NetworkKind = 'online' | 'offline' | 'weak';

function classify(state: NetInfoState): NetworkKind {
  // 仅在明确未连接时判离线。isInternetReachable===false 在小米/双通道下常误报
  //（例如连了无外网 WiFi，流量其实可用），不能直接当成离线拦住请求。
  if (state.isConnected === false) return 'offline';
  if (state.isInternetReachable === false) return 'weak';
  if (state.type === 'cellular') return 'weak';
  return 'online';
}

/** 当前是否可访问互联网（同步读缓存值，首次可能为 true）。 */
export async function checkOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return classify(state) !== 'offline';
}

/** 订阅网络变化，返回 online / offline / weak。 */
export function useNetworkStatus(): NetworkKind {
  const [status, setStatus] = useState<NetworkKind>('online');

  useEffect(() => {
    const apply = (state: NetInfoState) => setStatus(classify(state));
    const unsub = NetInfo.addEventListener(apply);
    NetInfo.fetch().then(apply);
    return unsub;
  }, []);

  return status;
}
