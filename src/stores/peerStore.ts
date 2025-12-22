// stores/peerStore.ts

import { create } from 'zustand';

export interface Peer {
  userId: string;
  userName: string;
  status: 'available' | 'busy' | 'in_call' | 'transferring';
  avatar?: string;
  connectedAt: Date;
}

interface PeerState {
  peers: Map<string, Peer>;
  activePeerId: string | null;

  // Actions
  addPeer: (peer: Peer) => void;
  removePeer: (userId: string) => void;
  updatePeerStatus: (userId: string, status: Peer['status']) => void;
  setActivePeer: (userId: string | null) => void;
  getPeer: (userId: string) => Peer | undefined;
  getOnlinePeers: () => Peer[];
  clearPeers: () => void;
}

export const usePeerStore = create<PeerState>((set, get) => ({
  peers: new Map(),
  activePeerId: null,

  addPeer: (peer) =>
    set((state) => {
      const newPeers = new Map(state.peers);
      newPeers.set(peer.userId, peer);
      return { peers: newPeers };
    }),

  removePeer: (userId) =>
    set((state) => {
      const newPeers = new Map(state.peers);
      newPeers.delete(userId);
      return { peers: newPeers };
    }),

  updatePeerStatus: (userId, status) =>
    set((state) => {
      const peer = state.peers.get(userId);
      if (!peer) return state;

      const newPeers = new Map(state.peers);
      newPeers.set(userId, { ...peer, status });
      return { peers: newPeers };
    }),

  setActivePeer: (userId) => set({ activePeerId: userId }),

  getPeer: (userId) => get().peers.get(userId),

  getOnlinePeers: () => Array.from(get().peers.values()),

  clearPeers: () => set({ peers: new Map(), activePeerId: null }),
}));