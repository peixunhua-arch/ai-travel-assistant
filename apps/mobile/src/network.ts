// 网络状态工具（UX §6.5 / §6.6）：离线横幅、弱网提示、外链/评价前的联网判断。
import { useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export type NetworkKind = 'online' | 'offline' | 'weak';

function classify(state: NetInfoState): NetworkKind {
  if (state.isConnected === false || state.isInternetReachable === false) return 'offline';
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
