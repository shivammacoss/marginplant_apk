import { useEffect, useState } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
}

export function useNetworkState(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: null,
    type: null,
  });

  useEffect(() => {
    const apply = (s: NetInfoState) =>
      setState({
        isConnected: !!s.isConnected,
        isInternetReachable: s.isInternetReachable,
        type: s.type,
      });
    void NetInfo.fetch().then(apply);
    return NetInfo.addEventListener(apply);
  }, []);

  return state;
}
