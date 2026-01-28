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
  private pendingChunkMetadata: any = null;
  private readonly MAX_SEND_QUEUE = 20; // ✅ CRITICAL FIX #2: Match TransferEngine.MAX_CONCURRENT_CHUNKS to sync flow control
  private readonly MAX_PENDING_ICE = 200;
  private readonly NUM_DATA_CHANNELS = 12; // ⚡ Optimized for parallelism
  private readonly MAX_BUFFER_SIZE = 100 * 1024 * 1024; // ⚡ Increased for better throughput
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
  
  // 🔧 FRAGMENTATION CONSTANTS: Prevent WebRTC buffer overflow after 45MB
  private readonly FRAGMENT_SIZE = 32 * 1024; // 32KB fragments to avoid 16MB buffer saturation
  private readonly FRAGMENT_HEADER_SIZE = 20; // [ChunkID:4][TotalChunks:4][OriginalSize:4][FragmentID:4][TotalFragments:4]
  private fragmentBuffers: Map<string, Map<number, ArrayBuffer>> = new Map(); // Store reassembled fragments

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
   * Valider et filtrer les serveurs ICE
   * Élimine les serveurs TURN sans credentials (qui causent des erreurs)
   */
  private validateIceServers(iceServers: any[]): any[] {
    if (!iceServers || !Array.isArray(iceServers)) {
      return [];
    }

    return iceServers.filter((server: any) => {
      // Normaliser les URLs
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      
      // Vérifier si c'est un serveur TURN
      const isTurn = urls.some((url: string) => 
        typeof url === 'string' && url.toLowerCase().startsWith('turn')
      );

      if (isTurn) {
        // Filtrer les serveurs TURN sans credentials
        if (!server.username || !server.credential) {
          console.warn(
            `🚫 Filtering TURN server without credentials: ${urls[0]}`
          );
          return false;
        }
        console.log(`✅ TURN server with credentials: ${urls[0]}`);
      } else {
        console.log(`✅ STUN server accepted: ${urls[0]}`);
      }

      return true;
    });
  }

  /**
   * Initialiser la connexion
   */
  async initialize(): Promise<void> {
    try {
      let rtcConfig: RTCConfiguration = RTC_CONFIGURATION;
      try {
        const socketClient = getSocketClient();
        let iceServers = await socketClient.getIceServers();
        if (iceServers && iceServers.length > 0) {
          // 🔧 Valider et filtrer les serveurs ICE (enlever TURN sans credentials)
          iceServers = this.validateIceServers(iceServers);
          
          if (iceServers.length > 0) {
            rtcConfig = { ...RTC_CONFIGURATION, iceServers } as RTCConfiguration;
          } else {
            console.warn('⚠️ No valid ICE servers after filtering, using defaults');
          }
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
          this.dataChannels.push(event.channel);
          this.sendQueues.push([]);
          this.setupDataChannelHandler(event.channel);
          if (this.dataChannels.length === this.NUM_DATA_CHANNELS) {
            this.emit('datachannel:open');
          }
        };
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
    if (this.dataChannels.length === 0) {
      console.warn('❌ No data channels available (length=0)');
      return;
    }

    const openChannels = this.dataChannels.filter(ch => ch.readyState === 'open');
    if (openChannels.length === 0) {
      // Log channel states for debugging
      const states = this.dataChannels.map((ch, i) => `${ch.label}:${ch.readyState}`).join(', ');
      console.warn(`❌ No data channels open. States: [${states}], queueing message`);
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
    
    // ✅ DEBUG: Check if this is an ACK message
    let isAckMessage = false;
    try {
      const parsedData = typeof data === 'string' ? JSON.parse(data) : null;
      isAckMessage = parsedData?.type === 'ack';
    } catch (e) {
      // Not JSON, probably binary data
    }

    if (channel.readyState !== 'open') {
      if (isAckMessage) {
        console.warn(`⚠️ ACK message queued (channel not ready): buffered amount: ${channel.bufferedAmount}, queue length: ${this.sendQueues[this.dataChannels.indexOf(channel)]?.length || 0}`);
      }
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
      if (isAckMessage) {
        console.warn(`⚠️ ACK message queued (buffer too full): buffered amount: ${channel.bufferedAmount}, MAX: ${this.MAX_BUFFER_SIZE}`);
      }
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
      if (isAckMessage) {
        console.log(`✅ ACK physically sent on channel (buffered after: ${channel.bufferedAmount})`);
      }
    } catch (error) {
      console.error(`Failed to send data:`, error);
      if (isAckMessage) {
        console.error(`❌ ACK send failed: ${(error as any)?.message}`);
      }
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
      
      // ✅ DEBUG: Log ACK messages for diagnostics
      if (message.type === 'ack') {
        const ackData = message.data as any;
        console.log(`📤 PeerConnection.sendMessage: Sending ACK for chunk ${ackData?.index} of ${ackData?.fileId}`);
      }
      
      this.send(payload);
      
      // ✅ DEBUG: Confirm send success for ACKs
      if (message.type === 'ack') {
        const ackData = message.data as any;
        console.log(`✅ ACK successfully queued/sent for chunk ${ackData?.index}`);
      }
    } catch (error) {
      console.error(`Failed to serialize/send message of type '${message?.type}':`, error);
      this.emit('error', error);
    }
  }

  /**
   * 🔧 FIXED: Envoyer un chunk avec fragmentation pour éviter débordement WebRTC buffer
   * Fragmente automatiquement les messages > 32KB en plusieurs fragments
   */
  sendChunk(metadata: any, data: ArrayBuffer): void {
    if (this.dataChannels.length === 0) {
      console.error('No data channels available');
      return;
    }

    // ✅ CRITICAL: Validate metadata BEFORE sending
    if (!metadata || metadata.totalChunks === undefined || metadata.totalChunks === 0 || metadata.totalChunks < 0) {
      console.error(`❌ CRITICAL: Invalid metadata.totalChunks for chunk ${metadata?.index}: ${metadata?.totalChunks}`);
      console.error(`   Full metadata:`, metadata);
      return;
    }

    // 🔍 DEBUG: Log chunks 68-73 to verify metadata
    if (metadata.index === 68 || metadata.index === 69 || metadata.index === 70 || 
        metadata.index === 71 || metadata.index === 72 || metadata.index === 73) {
      console.log(`🔍 PeerConnection.sendChunk for chunk ${metadata.index}:`, {
        index: metadata.index,
        totalChunks: metadata.totalChunks,
        dataSize: data.byteLength,
        hash: metadata.hash?.substring(0, 16) + '...',
      });
    }

    // Choose a channel for this chunk using round-robin distribution
    const channelIndex = this.channelIndex % this.dataChannels.length;
    this.channelIndex++;
    const channel = this.dataChannels[channelIndex];

    try {
      // ✅ CRITICAL FIX: Sender sends metadata separately, binary data contains ONLY the chunk data
      // No need to prepend headers to the binary data - metadata already sent as JSON message
      
      const totalChunks = metadata.totalChunks || 0;
      const packetSize = data.byteLength;
      
      // 🔧 FIX: Fragment large packets to prevent buffer overflow after ~45MB
      if (packetSize > this.FRAGMENT_SIZE) {
        // 🔧 CRITICAL: Send metadata FIRST for fragmented chunks!
        const metadataMessage = JSON.stringify({ type: 'chunk_metadata', data: metadata });
        
        if (channel.readyState === 'open') {
          channel.send(metadataMessage);
        } else {
          const queue = this.sendQueues[channelIndex];
          queue.push(metadataMessage);
        }
        
        // Large message - split into fragments
        const dataPayload = new Uint8Array(data);
        const totalFragments = Math.ceil(data.byteLength / this.FRAGMENT_SIZE);
        
        if (metadata.index > totalChunks - 10) {
          console.log(`📤 FRAGMENTATION: chunk ${metadata.index}/${totalChunks}, ${dataPayload.byteLength} bytes → ${totalFragments} fragments of max ${this.FRAGMENT_SIZE} bytes`);
        }
        
        for (let fragId = 0; fragId < totalFragments; fragId++) {
          const start = fragId * this.FRAGMENT_SIZE;
          const end = Math.min(start + this.FRAGMENT_SIZE, data.byteLength);
          // ⚡ CRITICAL FIX: Use Uint8Array.slice() which creates a NEW buffer, not a view
          const fragData = new Uint8Array(dataPayload.slice(start, end));
          
          // Create fragment packet: [Magic:4][ChunkID:4][TotalChunks:4][OriginalSize:4][FragmentID:4][TotalFragments:4][Data:N]
          const fragPacket = new ArrayBuffer(24 + fragData.byteLength);
          const fragView = new DataView(fragPacket);
          
          // ✅ CRITICAL: Add magic header "FRAG" (0x46524147) to identify fragments
          const FRAGMENT_MAGIC = 0x46524147;
          fragView.setUint32(0, FRAGMENT_MAGIC, true); // Magic: "FRAG"
          fragView.setUint32(4, metadata.index, true); // ChunkID
          fragView.setUint32(8, metadata.totalChunks, true); // Total chunks in file
          fragView.setUint32(12, data.byteLength, true); // Original full size
          fragView.setUint32(16, fragId, true); // Fragment ID
          fragView.setUint32(20, totalFragments, true); // Total fragments
          new Uint8Array(fragPacket, 24).set(fragData);
          
          // 🔍 DEBUG: For chunks 68-73, log each fragment
          if (metadata.index === 68 || metadata.index === 69 || metadata.index === 70 || 
              metadata.index === 71 || metadata.index === 72 || metadata.index === 73) {
            console.log(`🔍 Fragment ${fragId}/${totalFragments} for chunk ${metadata.index}:`, {
              magic: fragView.getUint32(0, true).toString(16),
              chunkId: fragView.getUint32(4, true),
              totalChunks: fragView.getUint32(8, true),
              originalSize: fragView.getUint32(12, true),
              fragmentId: fragView.getUint32(16, true),
              totalFragments: fragView.getUint32(20, true),
              fragDataSize: fragData.byteLength,
            });
          }
          
          if (channel.readyState === 'open') {
            channel.send(fragPacket);
            if (metadata.index > totalChunks - 10) {
              console.log(`   → Fragment ${fragId + 1}/${totalFragments}: ${fragData.byteLength} bytes sent`);
            }
          }
        }
      } else {
        // Small message - send normally
        // Send metadata separately first (as JSON message)
        const metadataMessage = JSON.stringify({ type: 'chunk_metadata', data: metadata });

        if (channel.readyState === 'open') {
          channel.send(metadataMessage);
          
          // ⚠️ Check channel buffer before sending
          const bufferBefore = channel.bufferedAmount;
          // Send raw binary data (no header, since metadata was already sent)
          channel.send(data);
          const bufferAfter = channel.bufferedAmount;
          
          if (metadata.index >= 68 && metadata.index <= 78) {
            console.log(`📤 Sent chunk ${metadata.index}/${metadata.totalChunks} on channel ${this.channelIndex % this.dataChannels.length}`);
            console.log(`   Metadata sent first (JSON)`);
            console.log(`   Binary data: ${data.byteLength} bytes`);
            console.log(`   Channel buffer: before=${bufferBefore}, after=${bufferAfter}`);
          }
        } else {
          // Queue on the channel's queue
          const queue = this.sendQueues[this.channelIndex % this.dataChannels.length];
          queue.push(metadataMessage);
          queue.push(data);
        }

        if (metadata.index < 68 || metadata.index > 78) {
          console.log(`📤 Sent chunk ${metadata.index}/${metadata.totalChunks} on channel ${this.channelIndex % this.dataChannels.length} (${data.byteLength} bytes)`);
        }
      }
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
        // 🔍 Log every received message to diagnose connection issues
        if (event.data instanceof ArrayBuffer) {
          console.log(`📨 ${channel.label} received binary data: ${event.data.byteLength} bytes`);
        } else {
          const msgStr = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
          console.log(`📨 ${channel.label} received message: ${msgStr.substring(0, 100)}`);
        }
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
            // ✅ CRITICAL: Validate metadata before accepting
            if (message.data && message.data.fileId && message.data.totalChunks) {
              // 🔍 DEBUG: Log problematic chunks
              if (message.data.index === 68 || message.data.index === 69 || message.data.index === 70 || 
                  message.data.index === 71 || message.data.index === 72 || message.data.index === 73 ||
                  message.data.index === 77 || message.data.index === 78) {
                console.log(`🔍 Received chunk_metadata for chunk ${message.data.index}:`, {
                  fileId: message.data.fileId,
                  totalChunks: message.data.totalChunks,
                  hash: message.data.hash?.substring(0, 16) + '...',
                });
              }
              
              // Validation: totalChunks should be reasonable (between 1 and 10,000,000 for a 1.28TB file at 128KB chunks)
              if (message.data.totalChunks < 1 || message.data.totalChunks > 10000000) {
                console.error(`❌ INVALID: chunk_metadata has unreasonable totalChunks: ${message.data.totalChunks}`);
                // Don't set pending metadata - skip this chunk
                break;
              }
              
              // ✅ CRITICAL FIX: When receiving metadata for a chunk that might be retried,
              // clear any old fragments from previous attempts to prevent mixing
              // This happens when sender retries a chunk after timeout
              const fragmentKey = `${message.data.index}_${message.data.totalChunks}`;
              if (this.fragmentBuffers.has(fragmentKey)) {
                console.log(`🔧 CLEAR RETRY: Clearing ${this.fragmentBuffers.get(fragmentKey)!.size} old fragments for chunk ${message.data.index} (retry detected)`);
                this.fragmentBuffers.delete(fragmentKey);
              }
              
              // 📥 Log metadata reception with encryption info
              if (message.data.encryptionMetadata) {
                console.log(`📥 [CHUNK_METADATA] Chunk ${message.data.index}: IV = ${message.data.encryptionMetadata.iv.substring(0, 16)}...`);
              } else if (message.data.encrypted) {
                console.warn(`⚠️ [CHUNK_METADATA] Chunk ${message.data.index} is marked encrypted but NO encryptionMetadata!`);
              }
            }
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

          case 'transfer_status':
            // ✅ NEW: Handle receiver status updates
            this.emit('transfer_status', message.data);
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
        // Handle binary data (chunk data or fragments)
        // ✅ DEBUG: Log all binary data arrivals
        if (this.pendingChunkMetadata) {
          const chunkIndex = this.pendingChunkMetadata.index;
          if (chunkIndex >= 68 && chunkIndex <= 78) {
            console.log(`📥 RECEIVED BINARY DATA: chunk ${chunkIndex}, ${data.byteLength} bytes`);
          }
        } else {
          console.warn(`⚠️ BINARY DATA arrived but NO pendingChunkMetadata! Size: ${data.byteLength} bytes`);
        }
        
        if (this.pendingChunkMetadata) {
          // 🔧 FIXED: Detect and reassemble fragmented chunks
          // Check if this is a fragment message with magic header (FRAG: 0x46524147 = "FRAG")
          const FRAGMENT_MAGIC = 0x46524147;
          const isMaybeFragment = data.byteLength >= 20;
          let isFragment = false;
          
          if (isMaybeFragment) {
            const view = new DataView(data);
            const magic = view.getUint32(0, true);
            isFragment = (magic === FRAGMENT_MAGIC);
          }
          
          if (isFragment) {
            // ✅ FRAGMENTED MESSAGE: Parse fragment header
            const view = new DataView(data);
            const magic = view.getUint32(0, true); // 0x46524147 = "FRAG"
            const chunkId = view.getUint32(4, true);
            const totalChunks = view.getUint32(8, true);
            const originalSize = view.getUint32(12, true);
            const fragmentId = view.getUint32(16, true);
            const totalFragments = view.getUint32(20, true);
            
            // ✅ CRITICAL: Validate fragment metadata matches pendingChunkMetadata
            if (this.pendingChunkMetadata && this.pendingChunkMetadata.totalChunks !== totalChunks) {
              console.error(`❌ CRITICAL: Fragment header totalChunks (${totalChunks}) MISMATCH with pending metadata totalChunks (${this.pendingChunkMetadata.totalChunks})!`);
              console.error(`   This indicates sender is sending old/stale metadata!`);
              console.error(`   Chunk ${chunkId}: expected totalChunks=${this.pendingChunkMetadata.totalChunks}, got ${totalChunks}`);
              // Don't process this fragment - it's corrupted
              this.pendingChunkMetadata = null;
              return;
            }
            
            // This is a fragmented chunk - reassemble
            const fragmentKey = `${chunkId}_${totalChunks}`;
            if (!this.fragmentBuffers.has(fragmentKey)) {
              this.fragmentBuffers.set(fragmentKey, new Map());
            }
            const fragments = this.fragmentBuffers.get(fragmentKey)!;
            
            // Store this fragment (skip header bytes to get actual data)
            const fragmentData = data.slice(24);
            fragments.set(fragmentId, fragmentData);
            
            if (chunkId > totalChunks - 10) {
              console.log(`🔀 RECEIVED FRAGMENT: chunk ${chunkId}/${totalChunks}, fragment ${fragmentId + 1}/${totalFragments}, ${fragmentData.byteLength} bytes`);
            }
            
            // Check if all fragments received
            if (fragments.size === totalFragments) {
              // Reassemble all fragments
              const reassembled = new Uint8Array(originalSize);
              let offset = 0;
              for (let i = 0; i < totalFragments; i++) {
                const fragData = fragments.get(i);
                if (!fragData) {
                  console.error(`Missing fragment ${i} for chunk ${chunkId}`);
                  this.fragmentBuffers.delete(fragmentKey);
                  this.pendingChunkMetadata = null;
                  return;
                }
                reassembled.set(new Uint8Array(fragData), offset);
                offset += fragData.byteLength;
              }
              
              if (chunkId > totalChunks - 10) {
                console.log(`✅ FRAGMENTS COMPLETE: chunk ${chunkId}/${totalChunks}, reassembled ${originalSize} bytes from ${totalFragments} fragments`);
              }
              
              // Clean up and emit reassembled chunk
              this.fragmentBuffers.delete(fragmentKey);
              const chunkData = {
                ...this.pendingChunkMetadata,
                index: chunkId,
                totalChunks,
                data: reassembled.buffer,
              };
              
              console.log(`📥 Received chunk ${chunkId}/${totalChunks} (${reassembled.byteLength} bytes)`);
              this.emit('chunk', chunkData);
              this.pendingChunkMetadata = null;
            }
          } else {
            // ✅ NON-FRAGMENTED MESSAGE: This is just raw chunk data
            const chunkData = {
              ...this.pendingChunkMetadata,
              data: data,
            };
            
            console.log(`📥 Received chunk ${this.pendingChunkMetadata.index}/${this.pendingChunkMetadata.totalChunks} (${(data as ArrayBuffer).byteLength} bytes)`);
            this.emit('chunk', chunkData);
            this.pendingChunkMetadata = null;
          }
        } else {
          // Binary data arrived but no pending metadata
          console.warn(`⚠️ Binary data received but no pending metadata! Size: ${data.byteLength} bytes`);
          // 🔍 DEBUG: Try to understand what's happening
          console.warn(`   This could indicate:`);
          console.warn(`   1. Metadata was lost/not received`);
          console.warn(`   2. Order of arrival is wrong (binary came before metadata)`);
          console.warn(`   3. Connection issue causing buffering`);
          // Could be out-of-order fragments, store temporarily and wait for metadata
          // For now, just log and ignore
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