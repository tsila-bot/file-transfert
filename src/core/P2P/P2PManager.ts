// lib/p2p/P2PManager.ts

import { PeerConnection } from './PeerConnection';
import { getSocketClient } from '../../lib/socket/SocketClient';
import { getTransferManager } from './TransferManager';
import { usePeerStore } from '@/stores/peerStore';
import { ConnectionState, SignalData } from '../../types/types';

export class P2PManager {
  private connections: Map<string, PeerConnection> = new Map();
  private socketClient = getSocketClient();
  private signalingUnsubscribers: Array<() => void> = [];
  private currentUserId: string | null = null;
  private isConnecting: boolean = false; // Prevent multiple simultaneous connection attempts

  constructor(userId: string) {
    this.currentUserId = userId;
    this.setupSignalingHandlers();
  }

  /**
   * Initier une connexion avec un peer
   */
  async connect(peerId: string, peerName: string): Promise<PeerConnection> {
    console.log(`🚀 Initiating connection to ${peerName} (${peerId})`);

    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting) {
      console.warn(`⚠️ Connection attempt already in progress, rejecting request to connect to ${peerName}`);
      throw new Error('A connection attempt is already in progress. Please wait.');
    }

    this.isConnecting = true;

    try {
      // Vérifier si une connexion existe déjà
      if (this.connections.has(peerId)) {
        const existing = this.connections.get(peerId)!;
        if (existing.isConnected()) {
          console.log('Already connected to this peer');
          return existing;
        } else {
          // Fermer l'ancienne connexion
          existing.close();
          this.connections.delete(peerId);
        }
      }

    // Créer une nouvelle connexion (initiateur)
    const connection = new PeerConnection({
      peerId,
      peerName,
      isInitiator: true,
      onStateChange: (state) => this.handleStateChange(peerId, state),
      onDataChannelOpen: () => this.handleDataChannelOpen(peerId),
      onError: (error) => this.handleError(peerId, error),
    });

    // Stocker la connexion
    this.connections.set(peerId, connection);

    try {
      // Initialiser la connexion
      await connection.initialize();

      // Créer l'offre
      const offer = await connection.createOffer();

      // Envoyer l'offre via signaling
      this.socketClient.emit('offer', {
        targetUserId: peerId,
        offer,
      });

      // Gérer les ICE candidates
      connection.on('icecandidate', (candidate: RTCIceCandidate) => {
        this.socketClient.emit('ice_candidate', {
          targetUserId: peerId,
          candidate: candidate.toJSON(),
        });
      });

      return connection;
    } catch (error) {
      console.error('Failed to connect:', error);
      this.connections.delete(peerId);
      throw error;
    }
    } finally {
      // Reset connection flag when connection attempt completes
      this.isConnecting = false;
    }
  }

  /**
   * Accepter une connexion entrante
   */
  async acceptConnection(
    peerId: string,
    peerName: string,
    offer: SignalData
  ): Promise<PeerConnection> {
    console.log(`📞 Accepting connection from ${peerName}...`);

    // Close any existing connection with this peer before creating a new one
    if (this.connections.has(peerId)) {
      const existing = this.connections.get(peerId)!;
      console.log(`🧹 Closing existing connection with ${peerId} before accepting new one`);
      existing.close();
      this.connections.delete(peerId);
    }

    // Créer une nouvelle connexion (receveur)
    const connection = new PeerConnection({
      peerId,
      peerName,
      isInitiator: false,
      onStateChange: (state) => this.handleStateChange(peerId, state),
      onDataChannelOpen: () => this.handleDataChannelOpen(peerId),
      onError: (error) => this.handleError(peerId, error),
    });

    // Stocker la connexion
    this.connections.set(peerId, connection);

    // Mark this peer as active in the global peer store (incoming accept)
    try {
      usePeerStore.getState().addActivePeer(peerId);
    } catch (err) {
      console.warn('Failed to add active peer in peerStore:', err);
    }

    try {
      // Initialiser la connexion
      await connection.initialize();

      // Créer la réponse
      const answer = await connection.createAnswer(offer);

      // Envoyer la réponse via signaling
      this.socketClient.emit('answer', {
        targetUserId: peerId,
        answer,
      });

      // Gérer les ICE candidates
      connection.on('icecandidate', (candidate: RTCIceCandidate) => {
        this.socketClient.emit('ice_candidate', {
          targetUserId: peerId,
          candidate: candidate.toJSON(),
        });
      });

      return connection;
    } catch (error) {
      console.error('Failed to accept connection:', error);
      this.connections.delete(peerId);
      throw error;
    }
  }

  /**
   * Obtenir une connexion existante
   */
  getConnection(peerId: string): PeerConnection | undefined {
    return this.connections.get(peerId);
  }

  /**
   * Fermer une connexion
   */
  disconnect(peerId: string): void {
    const connection = this.connections.get(peerId);
    if (connection) {
      connection.close();
      this.connections.delete(peerId);
      console.log(`Disconnected from peer: ${peerId}`);
    }
  }

  /**
   * Fermer toutes les connexions
   */
  disconnectAll(): void {
    this.connections.forEach((connection, peerId) => {
      connection.close();
    });
    this.connections.clear();
    console.log('All connections closed');
  }

  /**
   * Obtenir toutes les connexions actives
   */
  getActiveConnections(): PeerConnection[] {
    return Array.from(this.connections.values()).filter((conn) =>
      conn.isConnected()
    );
  }

  /**
   * Configurer les handlers du signaling
   */
  private setupSignalingHandlers(): void {
    // Recevoir une offre
    const offOffer = this.socketClient.on('offer', async (data: any) => {
      console.log(`📥 Received offer from ${data.fromUserName}`);

      // Check if we already have a connection with this peer
      if (this.connections.has(data.fromUserId)) {
        const existing = this.connections.get(data.fromUserId)!;
        if (existing.isConnected()) {
          console.log(`Already connected to ${data.fromUserName}, ignoring offer`);
          return;
        }
      }

      // Check if we're currently trying to connect to someone else
      if (this.isConnecting) {
        console.log(`Connection attempt in progress, rejecting offer from ${data.fromUserName}`);
        return;
      }

      // Demander confirmation à l'utilisateur
      const accept = window.confirm(
        `${data.fromUserName} souhaite se connecter. Accepter?`
      );

      if (accept) {
        await this.acceptConnection(
          data.fromUserId,
          data.fromUserName,
          data.offer
        );
      }
    });
    this.signalingUnsubscribers.push(offOffer);

    // Recevoir une réponse
    const offAnswer = this.socketClient.on('answer', async (data: any) => {
      console.log(`📥 Received answer from ${data.fromUserId}`);

      const connection = this.connections.get(data.fromUserId);
      if (connection) {
        await connection.handleAnswer(data.answer);
      }
    });
    this.signalingUnsubscribers.push(offAnswer);

    // Recevoir un ICE candidate
    const offIce = this.socketClient.on('ice_candidate', async (data: any) => {
      const connection = this.connections.get(data.fromUserId);
      if (connection) {
        await connection.addIceCandidate(data.candidate);
      }
    });
    this.signalingUnsubscribers.push(offIce);
  }

  /**
   * Nettoyer les handlers de signaling enregistrés
   */
  private teardownSignalingHandlers(): void {
    this.signalingUnsubscribers.forEach((off) => {
      try {
        off();
      } catch (err) {
        console.warn('Error while unsubscribing signaling handler', err);
      }
    });
    this.signalingUnsubscribers = [];
  }

  /**
   * Dispose the P2PManager: remove signaling handlers and close connections
   */
  public dispose(): void {
    this.teardownSignalingHandlers();
    this.disconnectAll();
  }

  /**
   * Gérer les changements d'état
   */
  private handleStateChange(peerId: string, state: ConnectionState): void {
    console.log(`Connection state with ${peerId}: ${state}`);

    // Si la connexion a échoué ou est fermée, la retirer
    if (state === 'failed' || state === 'closed') {
      this.connections.delete(peerId);
      try {
        getTransferManager().removePeer(peerId);
      } catch (err) {
        console.warn('Failed to remove peer from TransferManager:', err);
      }
    }
  }

  /**
   * Gérer l'ouverture du Data Channel
   */
  private handleDataChannelOpen(peerId: string): void {
    console.log(`✅ Data channel opened with ${peerId}`);
    // Émettre un événement global
    window.dispatchEvent(
      new CustomEvent('p2p:connected', { detail: { peerId } })
    );
    // Register peer with TransferManager so transfer UI can list it
    try {
      const conn = this.connections.get(peerId);
      if (conn) getTransferManager().addPeer(conn);
    } catch (err) {
      console.warn('Failed to add peer to TransferManager:', err);
    }
  }

  /**
   * Gérer les erreurs
   */
  private handleError(peerId: string, error: Error): void {
    console.error(`Error with peer ${peerId}:`, error);
    // Émettre un événement global
    window.dispatchEvent(
      new CustomEvent('p2p:error', { detail: { peerId, error } })
    );
  }
}

// Singleton
let p2pManagerInstance: P2PManager | null = null;

export function getP2PManager(userId: string): P2PManager {
  if (!p2pManagerInstance) {
    p2pManagerInstance = new P2PManager(userId);
  }
  return p2pManagerInstance;
}

export function destroyP2PManager(): void {
  if (p2pManagerInstance) {
    p2pManagerInstance.dispose();
    p2pManagerInstance = null;
  }
}