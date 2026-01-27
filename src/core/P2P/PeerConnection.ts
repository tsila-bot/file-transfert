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
  private sendQueues: Array<Array<string | ArrayBuffer | Blob>> = [[]]; // ✅ FIX: Initialize with empty queue
  private pendingChunkMetadata: Map<string, any> = new Map(); // ✅ FIX: Use Map keyed by fileId#chunkIndex to prevent data race with parallel channels
  private readonly MAX_SEND_QUEUE = 800; // Réduit de 1000 - synchroniser sender/receiver
  private readonly MAX_PENDING_ICE = 200;
  private readonly NUM_DATA_CHANNELS = 6; // Reduced from 12 to 6 to reduce overhead
  private readonly MAX_BUFFER_SIZE = 90 * 1024 * 1024; // Réduit de 100MB à 90MB
  private channelIndex = 0;
  private connectionTimeoutMs: number;
  private maxRetries: number;
  private retryAttempts: number = 0;
  private retryDelayMs: number = 1500;
  private peerId: string;
  private peerName: string;
  private isInitiator: boolean;
  private _connectionState: ConnectionState = 'new';
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private lastHeartbeatReceived: number = Date.now();
  private remoteDescriptionPending: boolean = false; // ✅ FIX: Prevent duplicate answer handling

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
          console.log('📡 Using ICE servers from signaling server:', iceServers.map((s: any) => 
            typeof s.urls === 'string' ? s.urls : s.urls[0]
          ).join(', '));
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

      // ⏸️ Don't flush ICE candidates yet - wait until remote description is set
      // This will happen after offer/answer exchange completes
      if (this.pendingIceCandidates.length > 0) {
        console.log(`⏳ ${this.pendingIceCandidates.length} ICE candidates queued, will apply after remote description`);
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
      
      // ✅ FIX: Check for all cases where we can't set remote description
      if (signalingState === 'closed') {
        console.warn('🔴 PeerConnection closed - ignoring answer');
        return;
      }

      // ✅ FIX: If already stable, answer is already processed
      if (signalingState === 'stable') {
        const remoteDesc = this.peerConnection.remoteDescription;
        if (remoteDesc && remoteDesc.type === 'answer') {
          console.log('✅ Remote answer already set, skipping duplicate');
          return;
        }
      }

      // ✅ FIX: Only set remote description if we're in "have-local-offer" state
      if (signalingState !== 'have-local-offer' && signalingState !== 'stable') {
        console.warn(`⚠️ Cannot set remote answer in state '${signalingState}' - skipping`);
        return;
      }

      // ✅ FIX: Verify this is actually an answer
      if (answer.type !== 'answer') {
        console.warn(`⚠️ Expected answer but got ${answer.type} - skipping`);
        return;
      }

      // ✅ FIX: Check for rapid successive answers
      if (this.remoteDescriptionPending) {
        console.warn('⏳ Remote description already pending - skipping duplicate');
        return;
      }

      this.remoteDescriptionPending = true;

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('✅ Remote answer set successfully');

      this.remoteDescriptionPending = false;

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
      this.remoteDescriptionPending = false;
      
      const msg = String(error && error.message ? error.message : error);
      
      // ✅ FIX: Handle all state-related errors gracefully
      if (msg.includes('Cannot set remote answer in state') || 
          msg.includes('Called in wrong state') ||
          msg.includes('setRemoteDescription')) {
        console.warn('⚠️ Cannot set remote answer right now (connection state changed) — ignoring');
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
      if (this._connectionState === 'closed' || this._connectionState === 'failed') {
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
      if (!this.sendQueues[0]) this.sendQueues[0] = []; // ✅ FIX: Safety check
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
      // ✅ FIX: Embed FileID in packet header to properly correlate with metadata
      // Header format: [FileID_LEN: 2 bytes][FileID: N bytes][ChunkID: 4 bytes][TotalChunks: 4 bytes][Size: 4 bytes][Data: N bytes]
      const fileId = metadata.fileId;
      const fileIdBytes = new TextEncoder().encode(fileId);
      const fileIdLen = fileIdBytes.length;

      const headerSize = 2 + fileIdLen + 4 + 4 + 4; // FileIDLen + FileID + ChunkID + TotalChunks + Size
      const packetSize = headerSize + data.byteLength;
      const packet = new ArrayBuffer(packetSize);
      const view = new DataView(packet);

      let offset = 0;

      // Write FileID length (2 bytes)
      view.setUint16(offset, fileIdLen, true);
      offset += 2;

      // Write FileID bytes
      new Uint8Array(packet, offset, fileIdLen).set(fileIdBytes);
      offset += fileIdLen;

      // Write ChunkID (4 bytes)
      view.setUint32(offset, metadata.index, true);
      offset += 4;

      // Write TotalChunks (4 bytes)
      view.setUint32(offset, metadata.totalChunks, true);
      offset += 4;

      // Write DataSize (4 bytes)
      view.setUint32(offset, data.byteLength, true);
      offset += 4;

      // Copy actual data after header
      new Uint8Array(packet, offset).set(new Uint8Array(data));

      // Send metadata separately (for quick reception, contains hash, encryption metadata)
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
    return this._connectionState === 'connected';
  }

  /**
   * Get the current connection state
   */
  get connectionState(): ConnectionState {
    return this._connectionState;
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

    // Handler pour recevoir les pistes audio/vidéo
    this.peerConnection.ontrack = (event) => {
      console.log(`📹 Received ${event.track.kind} track from peer`);
      console.log(`📊 Track state: ${event.track.readyState}, enabled: ${event.track.enabled}`);
      
      // Créer ou obtenir le stream distant
      if (event.streams && event.streams.length > 0) {
        const remoteStream = event.streams[0];
        console.log(`✅ Remote stream received with ${remoteStream.getTracks().length} tracks`);
        
        // Émettre l'événement pour que le composant UI puisse l'afficher
        this.emit('remotestream', remoteStream);
      } else {
        console.warn('⚠️ No stream provided with track');
      }
      
      // Émettre aussi l'événement de piste pour plus de flexibilité
      this.emit('track', event.track);
    };

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
      const state = this.peerConnection?.iceConnectionState;
      console.log(`❄️ ICE state: ${state}`);
      
      if (state === 'failed') {
        console.error('❌ ICE connection failed - NAT traversal unsuccessful');
        console.log('💡 Suggestion: Check if TURN server is reachable at about:webrtc');
        // Emit ICE failed event for potential fallback strategies
        this.emit('icefailed');
      } else if (state === 'connected' || state === 'completed') {
        console.log('✅ ICE connection established successfully');
      }
    };

    this.peerConnection.onicecandidateerror = (event) => {
      try {
        const text = (event as any).errorText || '';
        const url = (event as any).url || '';
        console.warn('⚠️ ICE candidate error:', {
          text,
          url,
          type: (event as any).type,
        });
        
        // Track TURN server failures
        if (url && url.includes('turn:')) {
          console.warn(`🔄 TURN server ${url} failed, retrying with STUN-only...`);
        }
      } catch (err) {
        console.warn('ICE candidate error (parse failed):', event);
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
            // ✅ FIX: Store metadata in a Map indexed by fileId#chunkIndex to prevent race conditions
            const metaKey = `${message.data.fileId}#${message.data.index}`;
            this.pendingChunkMetadata.set(metaKey, message.data);
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
        // ✅ FIX: Parse FileID from packet header to correctly match with metadata
        if (data.byteLength < 10) {
          console.error('Invalid chunk data: too small for header');
          return;
        }

        let offset = 0;
        const view = new DataView(data);

        // ✅ Read FileID length (2 bytes)
        const fileIdLen = view.getUint16(offset, true);
        offset += 2;

        // ✅ Check if we have enough data for FileID
        if (data.byteLength < offset + fileIdLen + 12) {
          console.error('Invalid chunk data: incomplete header');
          return;
        }

        // ✅ Read FileID (variable length string)
        const fileIdBytes = new Uint8Array(data, offset, fileIdLen);
        const fileId = new TextDecoder().decode(fileIdBytes);
        offset += fileIdLen;

        // ✅ Read ChunkID (4 bytes)
        const chunkId = view.getUint32(offset, true);
        offset += 4;

        // ✅ Read TotalChunks (4 bytes)
        const totalChunks = view.getUint32(offset, true);
        offset += 4;

        // ✅ Read DataSize (4 bytes)
        const dataSize = view.getUint32(offset, true);
        offset += 4;

        // ✅ Validate we have the complete chunk data
        if (data.byteLength < offset + dataSize) {
          console.error(`Invalid chunk data: size mismatch (expected ${offset + dataSize}, got ${data.byteLength})`);
          return;
        }

        // ✅ Extract actual data after header
        const actualData = data.slice(offset, offset + dataSize);

        // ✅ Look up metadata from Map using fileId#chunkIndex key
        const metaKey = `${fileId}#${chunkId}`;
        const metadata = this.pendingChunkMetadata.get(metaKey);
        this.pendingChunkMetadata.delete(metaKey); // Clean up after use

        if (metadata) {
          const chunkData = {
            ...metadata,
            index: chunkId,
            totalChunks,
            data: actualData,
          };

          console.log(`📥 Received chunk ${chunkId}/${totalChunks} (${actualData.byteLength} bytes) for ${fileId}`);
          this.emit('chunk', chunkData);
        } else {
          console.warn(`⚠️ Received chunk data for unknown metadata: ${metaKey}. Buffering may help.`);
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
      if (this._connectionState === 'connecting') {
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
    if (this._connectionState !== state) {
      this._connectionState = state;
      this.emit('statechange', state);
    }
  }

  /**
   * Ajouter un stream local à la connexion P2P
   * @param stream - MediaStream contenant les pistes audio/vidéo à envoyer
   */
  public async addStream(stream: MediaStream): Promise<void> {
    if (!this.peerConnection) {
      console.warn(`⚠️ No peer connection for ${this.peerName}`);
      return;
    }

    try {
      const tracks = stream.getTracks();
      console.log(`📤 Adding ${tracks.length} tracks to ${this.peerName}`);

      for (const track of tracks) {
        try {
          await this.peerConnection.addTrack(track, stream);
          console.log(`✅ Added ${track.kind} track to ${this.peerName}`);
        } catch (error) {
          console.error(`Failed to add ${track.kind} track:`, error);
        }
      }
    } catch (error) {
      console.error(`Error adding stream to ${this.peerName}:`, error);
      this.emit('error', error);
    }
  }

  /**
   * Retirer toutes les pistes d'un stream de la connexion P2P
   */
  public async removeStream(): Promise<void> {
    if (!this.peerConnection) {
      console.warn(`⚠️ No peer connection for ${this.peerName}`);
      return;
    }

    try {
      const senders = this.peerConnection.getSenders();
      console.log(`🛑 Removing ${senders.length} senders from ${this.peerName}`);

      for (const sender of senders) {
        try {
          await this.peerConnection.removeTrack(sender);
          console.log(`✅ Removed ${sender.track?.kind || 'unknown'} track from ${this.peerName}`);
        } catch (error) {
          console.error(`Failed to remove track:`, error);
        }
      }
    } catch (error) {
      console.error(`Error removing stream from ${this.peerName}:`, error);
      this.emit('error', error);
    }
  }

  /**
   * Nettoyer complètement les ressources média (audio/vidéo) tout en gardant la connexion P2P active
   * pour les transferts de fichiers. Arrête les timers et désactive les media handlers.
   */
  public async cleanupMedia(): Promise<void> {
    console.log(`🧹 Cleaning up media resources for ${this.peerName}`);

    try {
      // 1. Retirer tous les senders (pistes audio/vidéo)
      await this.removeStream();

      // 2. Arrêter les timers
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
        console.log('⏹️ Stopped heartbeat');
      }

      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
        console.log('⏹️ Stopped connection timeout');
      }

      // 3. Désactiver les media handlers mais garder la connexion ouverte
      if (this.peerConnection) {
        // Désactiver le handler ontrack pour éviter de recevoir de nouvelles pistes
        this.peerConnection.ontrack = null;
        console.log('🔇 Disabled ontrack handler');

        // Désactiver les handlers de state mais garder la connexion
        // On ne veut PAS fermer la connexion, juste arrêter de traiter les media events
        // La connexion reste ouverte pour les data channels (transferts de fichiers)
      }

      console.log(`✅ Media cleanup complete for ${this.peerName} (connection kept alive for transfers)`);
    } catch (error) {
      console.error(`Error during media cleanup for ${this.peerName}:`, error);
    }
  }

  /**
   * Mettre à jour l'état des pistes audio (toggle mute/unmute)
   * @param enabled - true pour activer, false pour désactiver
   */
  public updateAudioTrackState(enabled: boolean): void {
    if (!this.peerConnection) {
      console.warn(`⚠️ No peer connection for ${this.peerName}`);
      return;
    }

    try {
      // Obtenir tous les senders qui envoient de l'audio
      this.peerConnection.getSenders().forEach((sender) => {
        if (sender.track?.kind === 'audio') {
          if (sender.track) {
            sender.track.enabled = enabled;
            console.log(`🎤 Updated audio track for ${this.peerName}: ${enabled ? 'enabled' : 'disabled'}`);
          }
        }
      });
    } catch (error) {
      console.error(`Error updating audio track state for ${this.peerName}:`, error);
    }
  }
}