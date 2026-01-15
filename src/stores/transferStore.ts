// stores/transferStore.ts

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getTransferManager } from '@/core/P2P/TransferManager';
import { Transfer, TransferStatus } from '@/types/transfer.types';
import { useEffect } from 'react'; // ✅ AJOUT DE L'IMPORT

interface TransferState {
  // State
  transfers: Map<string, Transfer>;
  activeTransferId: string | null;

  // ✅ Flag pour savoir si les listeners sont actifs
  listenersInitialized: boolean;

  // Actions de base
  addTransfer: (transfer: Transfer) => void;
  updateTransfer: (transfer: Transfer) => void;
  removeTransfer: (fileId: string) => void;
  clearAllTransfers: () => void;

  // ✅ Initialiser les listeners d'événements
  initializeListeners: () => void;
  cleanupListeners: () => void;

  // Actions de sélection
  setActiveTransfer: (fileId: string | null) => void;

  // Getters
  getTransfer: (fileId: string) => Transfer | undefined;
  getAllTransfers: () => Transfer[];
  getActiveTransfers: () => Transfer[];
  getPendingTransfers: () => Transfer[];
  getCompletedTransfers: () => Transfer[];
  getFailedTransfers: () => Transfer[];
  getTransfersByPeer: (peerId: string) => Transfer[];
  getTransfersByStatus: (status: TransferStatus) => Transfer[];

  // Statistiques
  getTotalBytesTransferred: () => number;
  getAverageSpeed: () => number;
  getTransferCount: () => number;

  // Cleanup
  cleanupCompletedTransfers: () => void;
  cleanupFailedTransfers: () => void;
}

// ✅ Référence aux listeners pour pouvoir les nettoyer
const eventListeners: {
  transferUpdate?: (event: Event) => void;
  transferOffer?: (event: Event) => void;
  transferComplete?: (event: Event) => void;
  transferResumed?: (event: Event) => void;
  transferAutoResumed?: (event: Event) => void;
} = {};

export const useTransferStore = create<TransferState>()(
  devtools(
    (set, get) => ({
      // ==================== STATE ====================
      transfers: new Map(),
      activeTransferId: null,
      listenersInitialized: false,

      // ==================== LISTENERS ====================

      initializeListeners: () => {
        if (get().listenersInitialized) {
          console.warn('[TransferStore] Listeners already initialized');
          return;
        }

        console.log('[TransferStore] 🎧 Initializing event listeners...');

        // ✅ Écouter les mises à jour de transfert
        eventListeners.transferUpdate = (event: Event) => {
          const transfer = (event as CustomEvent).detail as Transfer;
          console.log(`[TransferStore] 📥 Transfer update: ${transfer.id} (${transfer.status})`);
          get().updateTransfer(transfer);
        };

        // ✅ Écouter les offres de transfert
        eventListeners.transferOffer = (event: Event) => {
          const transfer = (event as CustomEvent).detail as Transfer;
          console.log(`[TransferStore] 🎁 Transfer offer: ${transfer.id}`);
          get().addTransfer(transfer);
        };

        // ✅ Écouter la complétion de transfert
        eventListeners.transferComplete = (event: Event) => {
          const data = (event as CustomEvent).detail;
          console.log(`[TransferStore] ✅ Transfer complete: ${data.fileId}`);

          const transfer = get().getTransfer(data.fileId);
          if (transfer) {
            get().updateTransfer({
              ...transfer,
              status: 'completed',
              completedAt: new Date(),
              progress: { ...transfer.progress, percentage: 100 },
            });
          }
        };

        // ✅ Écouter les reprises de transfert
        eventListeners.transferResumed = (event: Event) => {
          const data = (event as CustomEvent).detail;
          console.log(`[TransferStore] 🔄 Transfer resumed: ${data.fileId}`);
          get().updateTransfer(data.transfer);
        };

        // ✅ Écouter les transferts repris automatiquement
        eventListeners.transferAutoResumed = (event: Event) => {
          const data = (event as CustomEvent).detail;
          console.log(`[TransferStore] 🔄 Transfer auto-resumed: ${data.fileId} (${data.fileName}) with ${data.peerName}`);

          // Afficher une notification toast
          const { toast } = require('sonner');
          if (toast) {
            toast.success(`Transfert repris automatiquement: ${data.fileName}`, {
              description: `Reprise avec ${data.peerName}`,
              duration: 4000,
            });
          }
        };

        // Attacher les listeners
        window.addEventListener('transfer:update', eventListeners.transferUpdate);
        window.addEventListener('transfer:offer', eventListeners.transferOffer);
        window.addEventListener('transfer:complete', eventListeners.transferComplete);
        window.addEventListener('transfer:resumed', eventListeners.transferResumed);
        window.addEventListener('transfer:auto-resumed', eventListeners.transferAutoResumed);

        set({ listenersInitialized: true });
        console.log('[TransferStore] ✅ Listeners initialized');
      },

      cleanupListeners: () => {
        if (!get().listenersInitialized) return;

        console.log('[TransferStore] 🧹 Cleaning up event listeners...');

        // Détacher tous les listeners
        if (eventListeners.transferUpdate) {
          window.removeEventListener('transfer:update', eventListeners.transferUpdate);
        }
        if (eventListeners.transferOffer) {
          window.removeEventListener('transfer:offer', eventListeners.transferOffer);
        }
        if (eventListeners.transferComplete) {
          window.removeEventListener('transfer:complete', eventListeners.transferComplete);
        }
        if (eventListeners.transferResumed) {
          window.removeEventListener('transfer:resumed', eventListeners.transferResumed);
        }
        if (eventListeners.transferAutoResumed) {
          window.removeEventListener('transfer:auto-resumed', eventListeners.transferAutoResumed);
        }

        set({ listenersInitialized: false });
        console.log('[TransferStore] ✅ Listeners cleaned up');
      },

      // ==================== ACTIONS DE BASE ====================

      addTransfer: (transfer) => {
        set((state) => {
          const newTransfers = new Map(state.transfers);
          newTransfers.set(transfer.id, transfer);
          console.log(`[TransferStore] ➕ Added transfer: ${transfer.id} (${transfer.fileName})`);
          return { transfers: newTransfers };
        });
      },

      updateTransfer: (transfer) => {
        set((state) => {
          const newTransfers = new Map(state.transfers);
          const exists = newTransfers.has(transfer.id);

          if (!exists) {
            console.warn(`[TransferStore] ⚠️ Transfer ${transfer.id} not found, adding it`);
          }

          newTransfers.set(transfer.id, transfer);

          return { transfers: newTransfers };
        });
      },

      removeTransfer: (fileId) => {
        set((state) => {
          const newTransfers = new Map(state.transfers);
          const deleted = newTransfers.delete(fileId);

          if (deleted) {
            console.log(`[TransferStore] ➖ Removed transfer: ${fileId}`);
          }

          const activeTransferId =
            state.activeTransferId === fileId ? null : state.activeTransferId;

          return { transfers: newTransfers, activeTransferId };
        });
      },

      clearAllTransfers: () => {
        console.log('[TransferStore] 🗑️ Clearing all transfers');
        set({ transfers: new Map(), activeTransferId: null });
      },

      // ==================== ACTIONS DE SÉLECTION ====================

      setActiveTransfer: (fileId) => {
        if (fileId && !get().transfers.has(fileId)) {
          console.warn(`[TransferStore] ⚠️ Transfer ${fileId} not found`);
          return;
        }
        set({ activeTransferId: fileId });
      },

      // ==================== GETTERS ====================

      getTransfer: (fileId) => {
        return get().transfers.get(fileId);
      },

      getAllTransfers: () => {
        return Array.from(get().transfers.values());
      },

      getActiveTransfers: () => {
        return Array.from(get().transfers.values()).filter(
          (t) => t.status === 'active'
        );
      },

      getPendingTransfers: () => {
        return Array.from(get().transfers.values()).filter(
          (t) => t.status === 'pending'
        );
      },

      getCompletedTransfers: () => {
        return Array.from(get().transfers.values()).filter(
          (t) => t.status === 'completed'
        );
      },

      getFailedTransfers: () => {
        return Array.from(get().transfers.values()).filter(
          (t) => t.status === 'failed' || t.status === 'cancelled'
        );
      },

      getTransfersByPeer: (peerId) => {
        return Array.from(get().transfers.values()).filter(
          (t) => t.peerId === peerId
        );
      },

      getTransfersByStatus: (status) => {
        return Array.from(get().transfers.values()).filter(
          (t) => t.status === status
        );
      },

      // ==================== STATISTIQUES ====================

      getTotalBytesTransferred: () => {
        return Array.from(get().transfers.values()).reduce(
          (sum, transfer) => sum + transfer.progress.bytesReceived,
          0
        );
      },

      getAverageSpeed: () => {
        const activeTransfers = get().getActiveTransfers();
        if (activeTransfers.length === 0) return 0;

        const totalSpeed = activeTransfers.reduce(
          (sum, t) => sum + t.progress.speed,
          0
        );
        return Math.round(totalSpeed / activeTransfers.length);
      },

      getTransferCount: () => {
        return get().transfers.size;
      },

      // ==================== CLEANUP ====================

      cleanupCompletedTransfers: () => {
        set((state) => {
          const newTransfers = new Map(state.transfers);
          const toRemove: string[] = [];

          newTransfers.forEach((transfer, fileId) => {
            if (transfer.status === 'completed') {
              toRemove.push(fileId);
            }
          });

          toRemove.forEach((fileId) => newTransfers.delete(fileId));

          console.log(`[TransferStore] 🧹 Cleaned up ${toRemove.length} completed transfers`);

          return { transfers: newTransfers };
        });
      },

      cleanupFailedTransfers: () => {
        set((state) => {
          const newTransfers = new Map(state.transfers);
          const toRemove: string[] = [];

          newTransfers.forEach((transfer, fileId) => {
            if (transfer.status === 'failed' || transfer.status === 'cancelled') {
              toRemove.push(fileId);
            }
          });

          toRemove.forEach((fileId) => newTransfers.delete(fileId));

          console.log(`[TransferStore] 🧹 Cleaned up ${toRemove.length} failed transfers`);

          return { transfers: newTransfers };
        });
      },
    }),
    { name: 'TransferStore' }
  )
);

// ==================== HOOKS PERSONNALISÉS ====================

/**
 * Hook pour obtenir un transfert spécifique
 */
export const useTransfer = (fileId: string | null) => {
  return useTransferStore((state) =>
    fileId ? state.transfers.get(fileId) : undefined
  );
};

/**
 * Hook pour obtenir le transfert actif
 */
export const useActiveTransfer = () => {
  const activeTransferId = useTransferStore((state) => state.activeTransferId);
  return useTransfer(activeTransferId);
};

/**
 * Hook pour obtenir les statistiques globales
 */
export const useTransferStats = () => {
  return useTransferStore((state) => ({
    total: state.getTransferCount(),
    active: state.getActiveTransfers().length,
    pending: state.getPendingTransfers().length,
    completed: state.getCompletedTransfers().length,
    failed: state.getFailedTransfers().length,
    totalBytes: state.getTotalBytesTransferred(),
    averageSpeed: state.getAverageSpeed(),
  }));
};

/**
 * Hook pour obtenir les transferts d'un peer
 */
export const usePeerTransfers = (peerId: string | null) => {
  return useTransferStore((state) =>
    peerId ? state.getTransfersByPeer(peerId) : []
  );
};

/**
 * ✅ Hook pour initialiser automatiquement les listeners
 * À utiliser dans votre composant racine de l'app
 */
export const useInitializeTransferStore = () => {
  const initializeListeners = useTransferStore((state) => state.initializeListeners);
  const cleanupListeners = useTransferStore((state) => state.cleanupListeners);
  const listenersInitialized = useTransferStore((state) => state.listenersInitialized);

  // Use a mount-only effect and call the store methods via getState() to avoid
  // depending on selector-returned function identities which can trigger
  // repeated effect runs and infinite mount/unmount loops.
  useEffect(() => {
    const store = useTransferStore.getState();
    if (!store.listenersInitialized) {
      store.initializeListeners();
    }

    return () => {
      store.cleanupListeners();
    };
    // Intentionally empty deps: run once on mount/unmount
  }, []);
};