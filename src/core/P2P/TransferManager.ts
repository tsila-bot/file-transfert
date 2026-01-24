// lib/p2p/TransferManager.ts

import { PeerConnection } from './PeerConnection';
import { TransferEngine } from './TransferEngine';
import { Transfer, TransferProgress } from '@/types/transfer.types';
import { EventEmitter } from 'events';

export class TransferManager extends EventEmitter {
  private static instance: TransferManager | null = null;
  private transferEngines: Map<string, TransferEngine> = new Map();
  private peerConnections: Map<string, PeerConnection> = new Map();
  private allTransfers: Map<string, Transfer> = new Map();

  private constructor() {
    super();
    // Only setup global listeners in a browser environment
    if (typeof window !== 'undefined') {
      this.setupGlobalListeners();
    }
  }

  /**
   * Obtenir l'instance unique (Singleton)
   */
  static getInstance(): TransferManager {
    if (!TransferManager.instance) {
      TransferManager.instance = new TransferManager();
    }
    return TransferManager.instance;
  }

  /**
   * Ajouter un peer et créer son TransferEngine
   */
  addPeer(connection: PeerConnection): void {
    const peerId = connection['peerId'];
    const peerName = connection['peerName'];

    console.log(`🔌 Adding peer to TransferManager: ${peerName} (${peerId})`);

    // Vérifier si le peer existe déjà
    if (this.transferEngines.has(peerId)) {
      console.log(`ℹ️ Peer ${peerId} already exists, skipping duplicate add`);
      return;
    }

    // Créer le TransferEngine pour ce peer
    const engine = new TransferEngine(connection);
    this.transferEngines.set(peerId, engine);
    this.peerConnections.set(peerId, connection);

    // Écouter les événements de déconnexion
    connection.on('statechange', (state) => {
      if (state === 'closed' || state === 'failed') {
        this.removePeer(peerId);
      }
    });

    this.emit('peer:added', { peerId, peerName });
  }

  /**
   * Retirer un peer
   */
  removePeer(peerId: string): void {
    console.log(`🔌 Removing peer from TransferManager: ${peerId}`);

    // Détruire le TransferEngine (nettoie automatiquement tous les transferts)
    const engine = this.transferEngines.get(peerId);
    if (engine) {
      engine.destroy();
    }

    // Récupérer tous les transferts de ce peer pour mettre à jour allTransfers
    const transfers = this.getTransfersByPeer(peerId);
    for (const transfer of transfers) {
      if (transfer.status === 'active' || transfer.status === 'pending') {
        transfer.status = 'failed';
        transfer.error = 'Peer disconnected';
        this.allTransfers.set(transfer.id, transfer);
        this.emit('transfer:update', transfer);
      }
    }

    // Supprimer le TransferEngine
    this.transferEngines.delete(peerId);
    this.peerConnections.delete(peerId);

    this.emit('peer:removed', { peerId });
  }

  /**
   * ✅ NOUVEAU : Envoyer un fichier avec options de chiffrement
   */
  async sendFile(
    file: File,
    peerId: string,
    options?: { encrypt?: boolean; password?: string }
  ): Promise<string> {
    const engine = this.transferEngines.get(peerId);

    if (!engine) {
      throw new Error(`No TransferEngine found for peer: ${peerId}`);
    }

    console.log(
      `📤 Sending file "${file.name}" to peer ${peerId} (encrypted: ${options?.encrypt})`
    );

    const fileId = await engine.sendFile(file, options);
    return fileId;
  }

  /**
   * Envoyer un fichier à PLUSIEURS peers (multi-send)
   */
  async sendFileToMultiplePeers(
    file: File,
    peerIds: string[],
    options?: { encrypt?: boolean; password?: string }
  ): Promise<Map<string, string>> {
    console.log(`📤 Sending file "${file.name}" to ${peerIds.length} peers`);

    const results = new Map<string, string>(); // peerId -> fileId

    // Envoyer en parallèle à tous les peers
    const promises = peerIds.map(async (peerId) => {
      try {
        const fileId = await this.sendFile(file, peerId, options);
        results.set(peerId, fileId);
      } catch (error) {
        console.error(`Failed to send to peer ${peerId}:`, error);
        // Continue avec les autres peers
      }
    });

    await Promise.allSettled(promises);

    this.emit('multi:send:complete', {
      fileName: file.name,
      totalPeers: peerIds.length,
      successCount: results.size,
    });

    return results;
  }

  /**
   * Envoyer un fichier à TOUS les peers connectés
   */
  async broadcastFile(
    file: File,
    options?: { encrypt?: boolean; password?: string }
  ): Promise<Map<string, string>> {
    const peerIds = Array.from(this.transferEngines.keys());
    console.log(`📡 Broadcasting file "${file.name}" to all peers (${peerIds.length})`);

    return this.sendFileToMultiplePeers(file, peerIds, options);
  }

  /**
   * Accepter un transfert entrant
   */
  acceptTransfer(fileId: string, peerId: string): void {
    const engine = this.transferEngines.get(peerId);

    if (!engine) {
      throw new Error(`No TransferEngine found for peer: ${peerId}`);
    }

    engine.acceptTransfer(fileId);
  }

  /**
   * ✅ NOUVEAU : Accepter un transfert avec mot de passe
   */
  async acceptTransferWithPassword(
    fileId: string,
    peerId: string,
    password: string
  ): Promise<void> {
    const engine = this.transferEngines.get(peerId);

    if (!engine) {
      throw new Error(`No TransferEngine found for peer: ${peerId}`);
    }

    await (engine as any).acceptTransferWithPassword(fileId, password);
  }

  /**
   * Refuser un transfert entrant
   */
  rejectTransfer(fileId: string, peerId: string, reason?: string): void {
    const engine = this.transferEngines.get(peerId);

    if (!engine) {
      throw new Error(`No TransferEngine found for peer: ${peerId}`);
    }

    engine.rejectTransfer(fileId, reason);
  }

  /**
   * Mettre en pause un transfert
   */
  pauseTransfer(fileId: string, peerId: string): void {
    const engine = this.transferEngines.get(peerId);

    if (!engine) {
      throw new Error(`No TransferEngine found for peer: ${peerId}`);
    }

    engine.pauseTransfer(fileId);
  }

  /**
   * Annuler un transfert
   */
  cancelTransfer(fileId: string, peerId: string): void {
    const engine = this.transferEngines.get(peerId);

    if (!engine) {
      throw new Error(`No TransferEngine found for peer: ${peerId}`);
    }

    engine.cancelTransfer(fileId);
  }

  /**
   * Obtenir un transfert spécifique
   */
  getTransfer(fileId: string): Transfer | undefined {
    return this.allTransfers.get(fileId);
  }

  /**
   * Obtenir tous les transferts
   */
  getAllTransfers(): Transfer[] {
    return Array.from(this.allTransfers.values());
  }

  /**
   * Obtenir les transferts d'un peer spécifique
   */
  getTransfersByPeer(peerId: string): Transfer[] {
    return Array.from(this.allTransfers.values()).filter(
      (transfer) => transfer.peerId === peerId
    );
  }

  /**
   * Obtenir les transferts actifs
   */
  getActiveTransfers(): Transfer[] {
    return Array.from(this.allTransfers.values()).filter(
      (transfer) => transfer.status === 'active'
    );
  }

  /**
   * Obtenir les transferts en attente
   */
  getPendingTransfers(): Transfer[] {
    return Array.from(this.allTransfers.values()).filter(
      (transfer) => transfer.status === 'pending'
    );
  }

  /**
   * Obtenir les statistiques globales
   */
  getGlobalStats(): {
    totalPeers: number;
    totalTransfers: number;
    activeTransfers: number;
    completedTransfers: number;
    failedTransfers: number;
    totalBytesTransferred: number;
    averageSpeed: number;
  } {
    const allTransfers = this.getAllTransfers();
    const activeTransfers = allTransfers.filter((t) => t.status === 'active');
    const completedTransfers = allTransfers.filter(
      (t) => t.status === 'completed'
    );
    const failedTransfers = allTransfers.filter((t) => t.status === 'failed');

    const totalBytesTransferred = allTransfers.reduce(
      (sum, transfer) => sum + transfer.progress.bytesReceived,
      0
    );

    const averageSpeed =
      activeTransfers.length > 0
        ? activeTransfers.reduce((sum, t) => sum + t.progress.speed, 0) /
        activeTransfers.length
        : 0;

    return {
      totalPeers: this.transferEngines.size,
      totalTransfers: allTransfers.length,
      activeTransfers: activeTransfers.length,
      completedTransfers: completedTransfers.length,
      failedTransfers: failedTransfers.length,
      totalBytesTransferred,
      averageSpeed,
    };
  }

  /**
   * Obtenir la liste des peers connectés
   */
  getConnectedPeers(): Array<{ peerId: string; peerName: string }> {
    return Array.from(this.peerConnections.entries()).map(
      ([peerId, connection]) => ({
        peerId,
        peerName: connection['peerName'],
      })
    );
  }

  /**
   * Vérifier si un peer est connecté
   */
  isPeerConnected(peerId: string): boolean {
    const connection = this.peerConnections.get(peerId);
    return connection ? connection.isConnected() : false;
  }

  /**
   * Obtenir la connexion d'un peer
   */
  getPeerConnection(peerId: string): PeerConnection | undefined {
    return this.peerConnections.get(peerId);
  }

  /**
   * Nettoyer tous les transferts terminés
   */
  cleanupCompletedTransfers(): void {
    const completed = Array.from(this.allTransfers.entries()).filter(
      ([_, transfer]) =>
        transfer.status === 'completed' ||
        transfer.status === 'failed' ||
        transfer.status === 'cancelled'
    );

    for (const [fileId, _] of completed) {
      this.allTransfers.delete(fileId);
    }

    console.log(`🧹 Cleaned up ${completed.length} completed transfers`);
  }

  /**
   * Configurer les écouteurs globaux
   */
  private setupGlobalListeners(): void {
    if (typeof window === 'undefined') return;

    // Écouter les événements de transfert de tous les engines
    window.addEventListener('transfer:update', (event: Event) => {
      const transfer = (event as CustomEvent).detail as Transfer;
      this.allTransfers.set(transfer.id, transfer);
      this.emit('transfer:update', transfer);
    });

    window.addEventListener('transfer:offer', (event: Event) => {
      const transfer = (event as CustomEvent).detail as Transfer;
      this.allTransfers.set(transfer.id, transfer);
      this.emit('transfer:offer', transfer);
    });

    window.addEventListener('transfer:complete', (event: Event) => {
      const data = (event as CustomEvent).detail;
      this.emit('transfer:complete', data);
    });
  }

  /**
   * Détruire le manager (pour cleanup)
   */
  destroy(): void {
    console.log('🔥 Destroying TransferManager');

    // Fermer toutes les connexions
    for (const connection of this.peerConnections.values()) {
      connection.close();
    }

    // Nettoyer
    this.transferEngines.clear();
    this.peerConnections.clear();
    this.allTransfers.clear();
    this.removeAllListeners();

    TransferManager.instance = null;
  }
}

// Export de l'instance singleton
export const getTransferManager = () => TransferManager.getInstance();