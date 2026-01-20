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
  activePeerIds: string[];  // ✅ CHANGÉ: Array au lieu de string | null

  // Actions
  addPeer: (peer: Peer) => void;
  removePeer: (userId: string) => void;
  updatePeerStatus: (userId: string, status: Peer['status']) => void;

  // ✅ NOUVELLES ACTIONS
  addActivePeer: (userId: string) => void;
  removeActivePeer: (userId: string) => void;
  toggleActivePeer: (userId: string) => void;
  clearActivePeers: () => void;
  isActivePeer: (userId: string) => boolean;

  getPeer: (userId: string) => Peer | undefined;
  getOnlinePeers: () => Peer[];
  getActivePeers: () => Peer[];  // ✅ NOUVEAU
  clearPeers: () => void;
}

export const usePeerStore = create<PeerState>((set, get) => ({
  peers: new Map(),
  activePeerIds: [],  // ✅ CHANGÉ

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
      const newActivePeerIds = state.activePeerIds.filter(id => id !== userId);
      return { peers: newPeers, activePeerIds: newActivePeerIds };
    }),

  updatePeerStatus: (userId, status) =>
    set((state) => {
      const peer = state.peers.get(userId);
      if (!peer) return state;

      const newPeers = new Map(state.peers);
      newPeers.set(userId, { ...peer, status });
      return { peers: newPeers };
    }),

  // ✅ NOUVELLES FONCTIONS
  addActivePeer: (userId) =>
    set((state) => {
      if (state.activePeerIds.includes(userId)) {
        return state;
      }
      return { activePeerIds: [...state.activePeerIds, userId] };
    }),

  removeActivePeer: (userId) =>
    set((state) => ({
      activePeerIds: state.activePeerIds.filter(id => id !== userId)
    })),

  toggleActivePeer: (userId) =>
    set((state) => {
      const isActive = state.activePeerIds.includes(userId);
      if (isActive) {
        return { activePeerIds: state.activePeerIds.filter(id => id !== userId) };
      } else {
        return { activePeerIds: [...state.activePeerIds, userId] };
      }
    }),

  clearActivePeers: () => set({ activePeerIds: [] }),

  isActivePeer: (userId) => get().activePeerIds.includes(userId),

  getPeer: (userId) => get().peers.get(userId),

  getOnlinePeers: () => Array.from(get().peers.values()),

  getActivePeers: () => {
    const state = get();
    return state.activePeerIds
      .map(id => state.peers.get(id))
      .filter((peer): peer is Peer => peer !== undefined);
  },

  clearPeers: () => set({ peers: new Map(), activePeerIds: [] }),
}));
