// hooks/useTransferManager.ts

import { useEffect } from 'react';
import { getTransferManager } from '@/core/P2P/TransferManager';
import { useTransferStore } from '@/stores/transferStore';
import { Transfer } from '@/types/transfer.types';

/**
 * Hook pour synchroniser le TransferManager avec le store Zustand
 */
export const useTransferManager = () => {
    const addTransfer = useTransferStore((state) => state.addTransfer);
    const updateTransfer = useTransferStore((state) => state.updateTransfer);
    const removeTransfer = useTransferStore((state) => state.removeTransfer);

    useEffect(() => {
        const transferManager = getTransferManager();

        // Écouter les événements du TransferManager
        const handleTransferUpdate = (event: Event) => {
            const transfer = (event as CustomEvent<Transfer>).detail;
            updateTransfer(transfer);
        };

        const handleTransferOffer = (event: Event) => {
            const transfer = (event as CustomEvent<Transfer>).detail;
            addTransfer(transfer);

            // Optionnel : Afficher une notification
            showTransferOfferNotification(transfer);
        };

        const handleTransferComplete = (event: Event) => {
            const { fileId, blob } = (event as CustomEvent<any>).detail;

            // Télécharger automatiquement le fichier
            const transfer = transferManager.getTransfer(fileId);
            if (transfer) {
                downloadFile(blob, transfer.fileName);
            }
        };

        const handlePeerRemoved = (event: Event) => {
            const { peerId } = (event as CustomEvent<any>).detail;

            // Optionnel : Supprimer les transferts de ce peer
            console.log(`Peer removed: ${peerId}`);
        };

        // Enregistrer les listeners
        window.addEventListener('transfer:update', handleTransferUpdate);
        window.addEventListener('transfer:offer', handleTransferOffer);
        window.addEventListener('transfer:complete', handleTransferComplete);
        transferManager.on('peer:removed', handlePeerRemoved);

        // Cleanup
        return () => {
            window.removeEventListener('transfer:update', handleTransferUpdate);
            window.removeEventListener('transfer:offer', handleTransferOffer);
            window.removeEventListener('transfer:complete', handleTransferComplete);
            transferManager.off('peer:removed', handlePeerRemoved);
        };
    }, [addTransfer, updateTransfer, removeTransfer]);

    return getTransferManager();
};

/**
 * Afficher une notification pour une offre de transfert
 */
function showTransferOfferNotification(transfer: Transfer) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New file incoming', {
            body: `${transfer.peerName} wants to send you: ${transfer.fileName}`,
            icon: '/icon-192.png',
        });
    }
}

/**
 * Télécharger un fichier
 */
function downloadFile(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`✅ File downloaded: ${fileName}`);
}