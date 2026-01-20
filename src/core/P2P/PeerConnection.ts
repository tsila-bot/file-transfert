// lib/p2p/PeerConnection.ts

import { EventEmitter } from 'events';
import {
  RTC_CONFIGURATION,
  DATA_CHANNEL_CONFIG,
  CONNECTION_TIMEOUT,
  HEARTBEAT_INTERVAL,
  MAX_RECONNECT_ATTEMPTS,
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
  private dataChannels: RTCDataChannel[] = [];
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private sendQueues: Array<Array<string | ArrayBuffer | Blob>> = [];
  private pendingChunkMetadata: any = null;
  private readonly MAX_SEND_QUEUE = 500; // Increased from 200 to 500
  private readonly MAX_PENDING_ICE = 200;
  private readonly NUM_DATA_CHANNELS = 6; // Reduced from 12 to 6 to reduce overhead
  private readonly MAX_BUFFER_SIZE = 16 * 1024 * 1024; // Increased from 8MB to 16MB
  private channelIndex = 0;
  private connectionTimeoutMs: number;
  private maxRetries: number;
  private retryAttempts: number = 0;
  private retryDelayMs: number = 1500;
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
    this.connectionTimeoutMs = options.connectionTimeout ?? CONNECTION_TIMEOUT;
    this.maxRetries = options.maxRetries ?? MAX_RECONNECT_ATTEMPTS;

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
          console.log('📥 Data channel received:', event.channel.label);
          this.dataChannels.push(event.channel);
          this.sendQueues.push([]);
          this.setupDataChannelHandler(event.channel);
          if (this.dataChannels.length === this.NUM_DATA_CHANNELS) {
            console.log('✅ All data channels received');
            this.emit('datachannel:open');
          }
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

    try {
      const signalingState = this.peerConnection.signalingState;
      if (signalingState === 'closed') {
        console.warn('PeerConnection closed - ignoring answer');
        return;
      }

      // If already stable and remote description is an answer, skip
      const remoteDesc = this.peerConnection.remoteDescription;
      if (signalingState === 'stable' && remoteDesc && remoteDesc.type === 'answer') {
        console.log('Remote answer already set, skipping');
        return;
      }

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

      // Flush any pending ICE candidates now that remote description is set
      if (this.pendingIceCandidates.length > 0) {
        for (const c of [...this.pendingIceCandidates]) {
          try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(c));
            console.log('✅ ICE candidate applied from pending queue (after answer)');
            // remove candidate from queue
            const idx = this.pendingIceCandidates.indexOf(c);
            if (idx >= 0) this.pendingIceCandidates.splice(idx, 1);
          } catch (err) {
            console.warn('Failed to apply pending ICE candidate after answer:', err);
          }
        }
      }
    } catch (error: any) {
      const msg = String(error && error.message ? error.message : error);
      if (msg.includes('Cannot set remote answer in state stable')) {
        console.warn('Cannot set remote answer in state stable — ignoring');
        return;
      }

      console.error('Failed to handle answer:', error);
      this.emit('error', error);
      throw error;
    }
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

      if (this.pendingIceCandidates.length >= this.MAX_PENDING_ICE) {
        console.warn('Pending ICE queue full, dropping oldest candidate');
        this.pendingIceCandidates.shift();
      }
      this.pendingIceCandidates.push(candidate);
      console.log('⏳ ICE candidate queued (peerConnection not ready)');
      return;
    }

    // If remote description is not set yet, queue the candidate to avoid "Unknown ufrag"
    const remoteDesc = this.peerConnection.remoteDescription;
    if (!remoteDesc || !remoteDesc.type) {
      if (this.pendingIceCandidates.length >= this.MAX_PENDING_ICE) {
        console.warn('Pending ICE queue full, dropping oldest candidate');
        this.pendingIceCandidates.shift();
      }
      this.pendingIceCandidates.push(candidate);
      console.log('⏳ ICE candidate queued (remoteDescription not set)');
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ ICE candidate added');
    } catch (error: any) {
      const msg = String(error && error.message ? error.message : error);
      console.warn('Failed to add ICE candidate:', error);
      // If the error indicates unknown ufrag or similar race, queue for later
      if (msg.includes('Unknown ufrag') || msg.includes('Unknown')) {
        this.pendingIceCandidates.push(candidate);
        console.log('⏳ ICE candidate re-queued due to add error');
      }
    }
  }

  /**
   * Envoyer des données
   */
  send(data: string | ArrayBuffer | Blob): void {
    if (this.dataChannels.length === 0 || !this.dataChannels.some(ch => ch.readyState === 'open')) {
      // Queue the message for later send when a data channel opens.
      console.warn('No data channels open, queueing message');
      // Use the first queue for general messages
      if (this.sendQueues[0].length >= this.MAX_SEND_QUEUE) {
        console.warn('Send queue full, dropping oldest message');
        this.sendQueues[0].shift();
      }
      this.sendQueues[0].push(data);
      return;
    }

    // Use round-robin for general sends
    const channel = this.dataChannels[this.channelIndex % this.dataChannels.length];
    this.channelIndex++;

    if (channel.readyState !== 'open') {
      // Queue on the channel's queue
      const queueIndex = this.dataChannels.indexOf(channel);
      if (queueIndex >= 0) {
        const queue = this.sendQueues[queueIndex];
        if (queue.length >= this.MAX_SEND_QUEUE) {
          console.warn('Send queue full, dropping oldest message');
          queue.shift();
        }
        queue.push(data);
      }
      return;
    }

    // Check if channel buffer is too full before sending
    if (channel.bufferedAmount > this.MAX_BUFFER_SIZE) {
      // Queue the message if buffer is too full
      const queueIndex = this.dataChannels.indexOf(channel);
      if (queueIndex >= 0) {
        const queue = this.sendQueues[queueIndex];
        if (queue.length >= this.MAX_SEND_QUEUE) {
          console.warn('Send queue full, dropping oldest message');
          queue.shift();
        }
        queue.push(data);
      }
      return;
    }

    try {
      channel.send(data as any);
    } catch (error) {
      console.error('Failed to send data:', error);
      // Queue on the channel's queue
      const queueIndex = this.dataChannels.indexOf(channel);
      if (queueIndex >= 0) {
        const queue = this.sendQueues[queueIndex];
        if (queue.length >= this.MAX_SEND_QUEUE) {
          console.warn('Send queue full, dropping oldest message');
          queue.shift();
        }
        queue.push(data);
      }
      this.emit('error', error);
    }
  }

  /**
   * Envoyer un message structuré
   */
  sendMessage(message: Message): void {
    try {
      const payload = JSON.stringify(message);
      this.send(payload);
    } catch (error) {
      console.error('Failed to serialize/send message:', error);
      this.emit('error', error);
    }
  }

  /**
   * Envoyer un chunk avec métadonnées et données binaires
   */
  sendChunk(metadata: any, data: ArrayBuffer): void {
    if (this.dataChannels.length === 0) {
      console.error('No data channels available');
      return;
    }

    // Choose a channel for this chunk using round-robin distribution
    const channelIndex = this.channelIndex % this.dataChannels.length;
    this.channelIndex++;
    const channel = this.dataChannels[channelIndex];

    try {
      // Create binary packet with header: [ChunkID: 4 bytes][TotalChunks: 4 bytes][Size: 4 bytes][Data: N bytes]
      const headerSize = 12; // 4 + 4 + 4 bytes
      const packetSize = headerSize + data.byteLength;
      const packet = new ArrayBuffer(packetSize);
      const view = new DataView(packet);

      // Write header
      view.setUint32(0, metadata.index, true); // ChunkID (little-endian)
      view.setUint32(4, metadata.totalChunks, true); // TotalChunks
      view.setUint32(8, data.byteLength, true); // Size of data

      // Copy data after header
      new Uint8Array(packet, headerSize).set(new Uint8Array(data));

      // Send metadata separately (for now, until receiver is updated)
      const metadataMessage = JSON.stringify({ type: 'chunk_metadata', data: metadata });

      if (channel.readyState === 'open') {
        channel.send(metadataMessage);
        channel.send(packet);
      } else {
        // Queue on the channel's queue
        const queue = this.sendQueues[channelIndex];
        queue.push(metadataMessage);
        queue.push(packet);
      }

      console.log(`📤 Sent chunk ${metadata.index}/${metadata.totalChunks} on channel ${channelIndex} (${packetSize} bytes)`);
    } catch (error) {
      console.error('Failed to send chunk:', error);
      this.emit('error', error);
    }
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
   * Obtenir la quantité d'octets actuellement bufferisée sur les data channels
   */
  getBufferedAmount(): number {
    return this.dataChannels.reduce((sum, ch) => sum + (ch.bufferedAmount || 0), 0);
  }

  /**
   * Vérifier si connecté
   */
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  /**
   * Vérifier si les canaux de données sont prêts
   */
  areDataChannelsReady(): boolean {
    return this.dataChannels.length > 0 && this.dataChannels.every(ch => ch.readyState === 'open');
  }

  /**
   * Fermer la connexion
   */
  close(): void {
    console.log(`🔌 Closing peer connection with ${this.peerName}`);

    this.stopHeartbeat();
    this.clearConnectionTimeout();

    if (this.dataChannels.length > 0) {
      this.dataChannels.forEach(ch => ch.close());
      this.dataChannels = [];
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

    console.log(`📡 Creating ${this.NUM_DATA_CHANNELS} data channels...`);

    for (let i = 0; i < this.NUM_DATA_CHANNELS; i++) {
      const channel = this.peerConnection.createDataChannel(
        `fileTransfer${i}`,
        DATA_CHANNEL_CONFIG
      );

      // Set a higher bufferedAmountLowThreshold for better throughput
      try {
        (channel as any).bufferedAmountLowThreshold = 4 * 1024 * 1024; // 4MB
      } catch (err) {
        // ignore
      }

      this.dataChannels.push(channel);
      this.sendQueues.push([]);
      this.setupDataChannelHandler(channel);
    }
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
          // Don't auto-reconnect to prevent connection flapping
          // this.attemptReconnect(new Error('Connection failed'));
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
  private setupDataChannelHandler(channel: RTCDataChannel): void {
    channel.onopen = () => {
      console.log(`✅ Data channel ${channel.label} opened`);
      // Flush queued messages for this channel
      const queueIndex = this.dataChannels.indexOf(channel);
      if (queueIndex >= 0) {
        const queue = this.sendQueues[queueIndex];
        try {
          while (queue.length > 0 && channel.readyState === 'open') {
            const queued = queue.shift()!;
            try {
              channel.send(queued as any);
            } catch (err) {
              console.error(`Failed to flush queued message on ${channel.label}:`, err);
              queue.unshift(queued);
              break;
            }
          }
        } catch (err) {
          console.error(`Error while flushing send queue for ${channel.label}:`, err);
        }
      }
      // Emit open only when all channels are open
      if (this.dataChannels.every(ch => ch.readyState === 'open')) {
        this.emit('datachannel:open');
      }
    };

    channel.onclose = () => {
      console.log(`🔌 Data channel ${channel.label} closed`);
      // Remove closed channel from the list to avoid processing it further
      const index = this.dataChannels.indexOf(channel);
      if (index >= 0) {
        this.dataChannels.splice(index, 1);
        this.sendQueues.splice(index, 1);
      }
      // Emit close only when all are closed or closing
      if (this.dataChannels.length === 0 || this.dataChannels.every(ch => ch.readyState === 'closed' || ch.readyState === 'closing')) {
        this.emit('datachannel:close');
      }
    };

    channel.onerror = (error: any) => {
      // Extract error details for better debugging
      const errorMsg = error?.error?.message || error?.message || String(error);
      console.error(`Data channel ${channel.label} error:`, errorMsg);
      // Only emit if it's a critical error, not a normal closure
      if (!errorMsg.includes('Close called') && !errorMsg.includes('User-Initiated')) {
        this.emit('error', error);
      }
    };

    channel.onmessage = (event) => {
      try {
        this.handleMessage(event.data);
      } catch (err) {
        console.error('Unhandled error in message handler:', err);
        this.emit('error', err as any);
      }
    };

    channel.onbufferedamountlow = () => {
      // Flush queued messages when buffer has space
      const queueIndex = this.dataChannels.indexOf(channel);
      if (queueIndex >= 0) {
        const queue = this.sendQueues[queueIndex];
        try {
          while (queue.length > 0 && channel.readyState === 'open' && channel.bufferedAmount <= this.MAX_BUFFER_SIZE) {
            const queued = queue.shift()!;
            try {
              channel.send(queued as any);
            } catch (err) {
              console.error(`Failed to flush queued message on ${channel.label}:`, err);
              queue.unshift(queued);
              break;
            }
          }
        } catch (err) {
          console.error(`Error while flushing send queue for ${channel.label}:`, err);
        }
      }
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

          case 'metadata_update':
            this.emit('metadata_update', message.data);
            break;

          case 'chunk_metadata':
            this.pendingChunkMetadata = message.data;
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
        // Handle binary data (chunk data following chunk_metadata)
        if (this.pendingChunkMetadata) {
          // Parse header from binary data: [ChunkID: 4 bytes][TotalChunks: 4 bytes][Size: 4 bytes][Data: N bytes]
          if (data.byteLength < 12) {
            console.error('Invalid chunk data: too small for header');
            this.pendingChunkMetadata = null;
            return;
          }

          const view = new DataView(data);
          const chunkId = view.getUint32(0, true);
          const totalChunks = view.getUint32(4, true);
          const dataSize = view.getUint32(8, true);

          if (data.byteLength < 12 + dataSize) {
            console.error('Invalid chunk data: size mismatch');
            this.pendingChunkMetadata = null;
            return;
          }

          // Extract actual data after header
          const actualData = data.slice(12, 12 + dataSize);

          const chunkData = {
            ...this.pendingChunkMetadata,
            index: chunkId,
            totalChunks,
            data: actualData,
          };

          console.log(`📥 Received chunk ${chunkId}/${totalChunks} (${actualData.byteLength} bytes)`);
          this.emit('chunk', chunkData);
          this.pendingChunkMetadata = null;
        } else {
          this.emit('binarydata', data);
        }
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
    this.clearConnectionTimeout();
    this.connectionTimeout = setTimeout(() => {
      if (this.connectionState === 'connecting') {
        console.error('⏱️ Connection timeout');
        this.updateState('failed');
        // Don't auto-reconnect on timeout to prevent connection flapping
        // this.attemptReconnect(new Error('Connection timeout'));
        const err = new Error('Connection timeout');
        this.emit('error', err);
      }
    }, this.connectionTimeoutMs);
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
   * Cleanup peer connection and data channel resources without removing event listeners
   */
  private cleanupPeerResources(): void {
    this.stopHeartbeat();
    this.clearConnectionTimeout();

    if (this.dataChannels.length > 0) {
      this.dataChannels.forEach(ch => {
        try {
          ch.onopen = null;
          ch.onclose = null;
          ch.onerror = null;
          ch.onmessage = null;
          ch.close();
        } catch (e) {
          // ignore
        }
      });
      this.dataChannels = [];
    }

    if (this.peerConnection) {
      try {
        this.peerConnection.onicecandidate = null;
        this.peerConnection.onconnectionstatechange = null;
        this.peerConnection.oniceconnectionstatechange = null;
        this.peerConnection.onicecandidateerror = null;
        this.peerConnection.ondatachannel = null;
        this.peerConnection.close();
      } catch (e) {
        // ignore
      }
      this.peerConnection = null;
    }
  }

  private attemptReconnect(cause?: Error): void {
    if (this.retryAttempts < this.maxRetries) {
      this.retryAttempts += 1;
      console.log(`🔁 Attempting reconnect ${this.retryAttempts}/${this.maxRetries} after:`, cause?.message || cause);

      // Cleanup current resources but keep event listeners
      this.cleanupPeerResources();

      setTimeout(async () => {
        try {
          await this.initialize();
        } catch (err) {
          console.warn('Reconnect attempt failed:', err);
          // Try again
          this.attemptReconnect(err as Error);
        }
      }, this.retryDelayMs * this.retryAttempts);
    } else {
      console.error('Max reconnect attempts reached, failing connection');
      this.updateState('failed');
      const err = cause || new Error('Connection failed after retries');
      this.emit('error', err);
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