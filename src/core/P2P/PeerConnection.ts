// lib/p2p/PeerConnection.ts

import { EventEmitter } from 'events';
import {
  RTC_CONFIGURATION,
  DATA_CHANNEL_CONFIG,
  CONNECTION_TIMEOUT,
  HEARTBEAT_INTERVAL,
} from '../../config/webrtc';
import { getSocketClient } from '../../lib/socket/SocketClient';
import {
  ConnectionState,
  PeerConnectionOptions,
  ConnectionStats,
  SignalData,
  Message,
} from '../../types/types';

export class PeerConnection extends EventEmitter {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private peerId: string;
  private peerName: string;
  private isInitiator: boolean;
  private connectionState: ConnectionState = 'new';
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private lastHeartbeatReceived: number = Date.now();

  constructor(options: PeerConnectionOptions) {
    super();
    this.peerId = options.peerId;
    this.peerName = options.peerName;
    this.isInitiator = options.isInitiator;

    if (options.onStateChange) {
      this.on('statechange', options.onStateChange);
    }
    if (options.onDataChannelOpen) {
      this.on('datachannel:open', options.onDataChannelOpen);
    }
    if (options.onDataChannelClose) {
      this.on('datachannel:close', options.onDataChannelClose);
    }
    if (options.onData) {
      this.on('data', options.onData);
    }
    if (options.onError) {
      this.on('error', options.onError);
    }
  }

  /**
   * Initialiser la connexion
   */
  async initialize(): Promise<void> {
    console.log(`🔗 Initializing peer connection with ${this.peerName}`);

    try {
      let rtcConfig: RTCConfiguration = RTC_CONFIGURATION;
      try {
        const socketClient = getSocketClient();
        const iceServers = await socketClient.getIceServers();
        if (iceServers && iceServers.length > 0) {
          rtcConfig = { ...RTC_CONFIGURATION, iceServers } as RTCConfiguration;
          console.log('Using ICE servers from signaling server');
        }
      } catch (err) {
        console.warn('Failed to fetch ICE servers from signaling, using default', err);
      }

      this.peerConnection = new RTCPeerConnection(rtcConfig);

      this.setupConnectionHandlers();

      if (this.isInitiator) {
        this.createDataChannel();
      } else {
        this.peerConnection.ondatachannel = (event) => {
          console.log('📥 Data channel received');
          this.dataChannel = event.channel;
          this.setupDataChannelHandlers();
        };
      }

      if (this.pendingIceCandidates.length > 0 && this.peerConnection) {
        for (const c of this.pendingIceCandidates) {
          try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(c));
            console.log('✅ ICE candidate applied from pending queue');
          } catch (err) {
            console.warn('Failed to apply pending ICE candidate:', err);
          }
        }
        this.pendingIceCandidates = [];
      }

      this.updateState('connecting');
      this.startConnectionTimeout();
    } catch (error) {
      console.error('Failed to initialize peer connection:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Créer une offre (initiateur)
   */
  async createOffer(): Promise<SignalData> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    console.log('📤 Creating offer...');

    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false,
    });

    await this.peerConnection.setLocalDescription(offer);

    return {
      type: 'offer',
      sdp: offer.sdp!,
    };
  }

  /**
   * Créer une réponse (receveur)
   */
  async createAnswer(offer: SignalData): Promise<SignalData> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    console.log('📥 Received offer, creating answer...');

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    return {
      type: 'answer',
      sdp: answer.sdp!,
    };
  }

  /**
   * Traiter une réponse (initiateur)
   */
  async handleAnswer(answer: SignalData): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    console.log('📥 Received answer');

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  /**
   * Ajouter un ICE Candidate
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      if (this.connectionState === 'closed' || this.connectionState === 'failed') {
        console.warn('Dropping ICE candidate because connection is closed/failed');
        return;
      }

      this.pendingIceCandidates.push(candidate);
      console.log('⏳ ICE candidate queued (peerConnection not ready)');
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ ICE candidate added');
    } catch (error) {
      console.warn('Failed to add ICE candidate:', error);
    }
  }

  /**
   * Envoyer des données
   */
  send(data: string | ArrayBuffer | Blob): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not open');
    }

    try {
      this.dataChannel.send(data as any);
    } catch (error) {
      console.error('Failed to send data:', error);
      this.emit('error', error);
    }
  }

  /**
   * Envoyer un message structuré
   */
  sendMessage(message: Message): void {
    this.send(JSON.stringify(message));
  }

  /**
   * Envoyer un message de chat
   */
  sendChat(text: string): void {
    this.sendMessage({
      type: 'chat',
      data: { text, timestamp: Date.now() },
    });
  }

  /**
   * Envoyer un message de heartbeat
   */
  sendHeartbeat(data?: any): void {
    this.sendMessage({
      type: 'heartbeat',
      data: {
        timestamp: Date.now(),
        ...data,
      },
    });
  }

  /**
   * Vérifier la latence de la connexion
   */
  async checkLatency(): Promise<number> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(-1), 5000);

      const handleAck = (data: any) => {
        if (data.timestamp === startTime) {
          clearTimeout(timeout);
          this.off('heartbeat_ack', handleAck);
          resolve(Date.now() - startTime);
        }
      };

      this.on('heartbeat_ack', handleAck);
      this.sendHeartbeat({ timestamp: startTime });
    });
  }

  /**
   * Obtenir les statistiques de connexion
   */
  async getStats(): Promise<ConnectionStats> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    const stats = await this.peerConnection.getStats();
    const result: ConnectionStats = {
      bytesReceived: 0,
      bytesSent: 0,
      packetsReceived: 0,
      packetsSent: 0,
    };

    stats.forEach((report) => {
      if (report.type === 'inbound-rtp') {
        result.bytesReceived += report.bytesReceived || 0;
        result.packetsReceived += report.packetsReceived || 0;
      } else if (report.type === 'outbound-rtp') {
        result.bytesSent += report.bytesSent || 0;
        result.packetsSent += report.packetsSent || 0;
      } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        result.currentRoundTripTime = report.currentRoundTripTime;
        result.availableOutgoingBitrate = report.availableOutgoingBitrate;
      }
    });

    return result;
  }

  /**
   * Obtenir l'état de la connexion
   */
  getState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Obtenir la quantité d'octets actuellement bufferisée sur le data channel
   */
  getBufferedAmount(): number {
    return this.dataChannel ? (this.dataChannel.bufferedAmount || 0) : 0;
  }

  /**
   * Vérifier si connecté
   */
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  /**
   * Fermer la connexion
   */
  close(): void {
    console.log(`🔌 Closing peer connection with ${this.peerName}`);

    this.stopHeartbeat();
    this.clearConnectionTimeout();

    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.updateState('closed');
    this.removeAllListeners();
  }

  /**
   * Créer le Data Channel
   */
  private createDataChannel(): void {
    if (!this.peerConnection) return;

    console.log('📡 Creating data channel...');

    this.dataChannel = this.peerConnection.createDataChannel(
      'fileTransfer',
      DATA_CHANNEL_CONFIG
    );

    this.setupDataChannelHandlers();
  }

  /**
   * Configurer les handlers de la connexion
   */
  private setupConnectionHandlers(): void {
    if (!this.peerConnection) return;

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 ICE candidate generated');
        this.emit('icecandidate', event.candidate);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log(`Connection state: ${state}`);

      switch (state) {
        case 'connected':
          this.updateState('connected');
          this.clearConnectionTimeout();
          this.startHeartbeat();
          break;
        case 'disconnected':
          this.updateState('disconnected');
          this.stopHeartbeat();
          break;
        case 'failed':
          this.updateState('failed');
          this.emit('error', new Error('Connection failed'));
          break;
        case 'closed':
          this.updateState('closed');
          break;
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE state: ${this.peerConnection?.iceConnectionState}`);
    };

    this.peerConnection.onicecandidateerror = (event) => {
      try {
        const text = (event as any).errorText || '';
        console.warn('ICE candidate error:', text || event, 'url:', (event as any).url);
      } catch (err) {
        console.warn('ICE candidate error (unknown):', event);
      }
    };
  }

  /**
   * Configurer les handlers du Data Channel
   */
  private setupDataChannelHandlers(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('✅ Data channel opened');
      this.emit('datachannel:open');
    };

    this.dataChannel.onclose = () => {
      console.log('🔌 Data channel closed');
      this.emit('datachannel:close');
    };

    this.dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
      this.emit('error', error);
    };

    this.dataChannel.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.dataChannel.onbufferedamountlow = () => {
      this.emit('bufferedamountlow');
    };
  }

  /**
   * Gérer les messages reçus
   */
  private handleMessage(data: string | ArrayBuffer): void {
    try {
      if (typeof data === 'string') {
        const message: Message = JSON.parse(data);

        switch (message.type) {
          case 'chat':
            this.emit('chat', message.data);
            break;

          case 'metadata':
            this.emit('metadata', message.data);
            break;

          case 'chunk':
            this.emit('chunk', message.data);
            break;

          case 'ack':
            this.emit('ack', message.data);
            break;

          case 'heartbeat':
            this.emit('heartbeat', message.data);
            // Répondre immédiatement avec un ack
            this.sendMessage({
              type: 'heartbeat_ack',
              data: {
                timestamp: message.data.timestamp,
                received: true,
              },
            });
            this.handleHeartbeat();
            break;

          case 'heartbeat_ack':
            this.emit('heartbeat_ack', message.data);
            break;

          case 'transfer_sync':
            this.emit('transfer_sync', message.data);
            break;

          case 'resume_request':
            this.emit('resume_request', message.data);
            break;

          case 'resume_ack':
            this.emit('resume_ack', message.data);
            break;

          default:
            this.emit('data', message);
        }
      } else {
        this.emit('binarydata', data);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
      this.emit('error', error);
    }
  }

  /**
   * Démarrer le heartbeat
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.sendMessage({ type: 'heartbeat', data: {} });

        const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeatReceived;
        if (timeSinceLastHeartbeat > HEARTBEAT_INTERVAL * 3) {
          console.warn('⚠️ No heartbeat received, connection may be lost');
          this.updateState('disconnected');
        }
      }
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * Arrêter le heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Gérer un heartbeat reçu
   */
  private handleHeartbeat(): void {
    this.lastHeartbeatReceived = Date.now();
  }

  /**
   * Démarrer le timeout de connexion
   */
  private startConnectionTimeout(): void {
    this.connectionTimeout = setTimeout(() => {
      if (this.connectionState === 'connecting') {
        console.error('⏱️ Connection timeout');
        this.updateState('failed');
        this.emit('error', new Error('Connection timeout'));
      }
    }, CONNECTION_TIMEOUT);
  }

  /**
   * Annuler le timeout de connexion
   */
  private clearConnectionTimeout(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  /**
   * Mettre à jour l'état de la connexion
   */
  private updateState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.emit('statechange', state);
    }
  }
}