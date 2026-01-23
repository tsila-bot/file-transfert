'use client';

import { create } from 'zustand';

export interface CallState {
  status: 'idle' | 'calling' | 'ringing' | 'connected' | 'error';
  recipientId?: string;
  recipientName?: string;
  duration: number;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
  micOn: boolean;
  videoOn: boolean;
  error?: string;
}

interface CallStore {
  callState: CallState;
  setCallState: (state: CallState) => void;
  updateCallState: (partial: Partial<CallState>) => void;
  resetCallState: () => void;
}

const initialState: CallState = {
  status: 'idle',
  duration: 0,
  micOn: true,
  videoOn: true,
};

export const useCallStore = create<CallStore>((set) => ({
  callState: initialState,

  setCallState: (state: CallState) => {
    set({ callState: state });
  },

  updateCallState: (partial: Partial<CallState>) => {
    set((prev) => ({
      callState: { ...prev.callState, ...partial },
    }));
  },

  resetCallState: () => {
    set({ callState: initialState });
  },
}));
