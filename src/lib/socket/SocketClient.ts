// lib/socket/SocketClient.ts

import { io, Socket } from 'socket.io-client';
import { ENV } from '../../config/env';

export type SocketEvent =
  | 'connect'
  | 'disconnect'
  | 'authenticated'
  | 'online_users'
  | 'user_online'
  | 'user_offline'
  | 'user_status_change'
  | 'offer'
  | 'answer'
  | 'ice_candidate'
  | 'ice_servers' 
  | 'chat_message'
  | 'typing_start'
  | 'typing_stop'
  | 'group_user_joined'
  | 'group_user_left'
  | 'group_chat_message'
  | 'group_messages_history'
  | 'call_offer'
  | 'call_answer'
  | 'call_end'
  | 'file_transfer_offer' 
  | 'error';

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceServersResponse {
  iceServers: IceServer[];
}

export class SocketClient {
  private socket: Socket | null = null;
  private eventHandlers: Map<SocketEvent, Set<Function>> = new Map();
  private socketListenersSetup: Set<SocketEvent> = new Set(); // 🆕 Track setup listeners
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private iceServers: IceServer[] = [];

  connect(token: string): void {
    if (this.socket?.connected) {
      console.warn('Socket already connected');
      return;
    }

    console.log('🔌 Connecting to WebSocket server...');

    this.socket = io(ENV.WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.setupDefaultHandlers();
    this.setupSocketBridge(); // 🆕 Configure le pont socket->handlers
  }

  disconnect(): void {
    if (this.socket) {
      console.log('🔌 Disconnecting from WebSocket server...');
      this.socket.removeAllListeners(); // 🆕 Nettoyer les listeners socket
      this.socket.disconnect();
      this.socket = null;
      this.eventHandlers.clear();
      this.socketListenersSetup.clear(); // 🆕
      this.iceServers = [];
    }
  }

  emit(event: string, data?: any): void {
    if (!this.socket) {
      console.error('❌ Socket not connected - cannot emit', event);
      return;
    }

    console.log('📤 Emitting:', event, data);
    this.socket.emit(event, data);
  }

  /**
   * 🆕 Écouter un événement (version optimisée)
   * N'installe le listener socket QU'UNE SEULE FOIS
   */
  on(event: SocketEvent, handler: Function): void {
    // Ajouter le handler à notre Map
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    // Installer le listener socket SEULEMENT si pas déjà fait
    this.ensureSocketListener(event);

    console.log(`✅ Handler registered for '${event}' (total: ${this.eventHandlers.get(event)!.size})`);
  }

  off(event: SocketEvent, handler?: Function): void {
    if (!handler) {
      this.eventHandlers.delete(event);
      if (this.socket) {
        this.socket.off(event);
        this.socketListenersSetup.delete(event);
      }
    } else {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.eventHandlers.delete(event);
          if (this.socket) {
            this.socket.off(event);
            this.socketListenersSetup.delete(event);
          }
        }
      }
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  requestIceServers(): void {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }
    console.log('📡 Requesting ICE servers...');
    this.socket.emit('get_ice_servers');
  }

  async getIceServers(): Promise<IceServer[]> {
    if (this.iceServers.length > 0) {
      return this.iceServers;
    }

    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('ICE servers request timeout'));
      }, 5000);

      const handler = (data: IceServersResponse) => {
        clearTimeout(timeout);
        this.iceServers = data.iceServers;
        console.log('✅ ICE servers received:', this.iceServers.length);
        this.socket?.off('ice_servers', handler);
        resolve(this.iceServers);
      };

      this.socket.on('ice_servers', handler);
      this.socket.emit('get_ice_servers');
    });
  }

  async createPeerConnection(
    config?: Partial<RTCConfiguration>
  ): Promise<RTCPeerConnection> {
    const iceServers = await this.getIceServers();
    return new RTCPeerConnection({
      iceServers,
      ...config,
    });
  }

  sendFileTransferOffer(targetUserId: string, fileName: string, fileSize: number): void {
    this.emit('file_transfer_offer', { targetUserId, fileName, fileSize });
  }

  sendOffer(targetUserId: string, offer: RTCSessionDescriptionInit): void {
    this.emit('offer', { targetUserId, offer });
  }

  sendAnswer(targetUserId: string, answer: RTCSessionDescriptionInit): void {
    this.emit('answer', { targetUserId, answer });
  }

  sendIceCandidate(targetUserId: string, candidate: RTCIceCandidateInit): void {
    this.emit('ice_candidate', { targetUserId, candidate });
  }

  updateStatus(status: 'available' | 'busy' | 'in_call' | 'transferring'): void {
    this.emit('update_status', { status });
  }

  sendChatMessage(targetUserId: string, message: string): void {
    this.emit('chat_message', { targetUserId, message });
  }

  joinGroup(groupId: string): void {
    this.emit('join_group', { groupId });
  }

  leaveGroup(groupId: string): void {
    this.emit('leave_group', { groupId });
  }

  sendGroupMessage(groupId: string, message: string): void {
    this.emit('group_chat_message', { groupId, message });
  }

  /**
   * 🆕 Installer le listener socket une seule fois par événement
   */
  private ensureSocketListener(event: SocketEvent): void {
    if (!this.socket || this.socketListenersSetup.has(event)) {
      return; // Déjà installé
    }

    this.socket.on(event, (...args: any[]) => {
      console.log(`📥 Received '${event}':`, args);
      this.triggerHandlers(event, ...args);
    });

    this.socketListenersSetup.add(event);
    console.log(`🔧 Socket listener installed for '${event}'`);
  }

  /**
   * 🆕 Configure le pont automatique entre socket.io et nos handlers
   */
  private setupSocketBridge(): void {
    if (!this.socket) return;

    // Pour chaque événement déjà enregistré, installer le listener
    this.eventHandlers.forEach((_, event) => {
      this.ensureSocketListener(event);
    });
  }

  private setupDefaultHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket connected - ID:', this.socket?.id);
      this.reconnectAttempts = 0;
      this.requestIceServers();
      this.triggerHandlers('connect');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      this.triggerHandlers('disconnect', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.disconnect();
      }
    });

    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
      this.triggerHandlers('error', error);
    });

    this.socket.on('ice_servers', (data: IceServersResponse) => {
      this.iceServers = data.iceServers;
      console.log('✅ ICE servers cached:', this.iceServers.length);
      this.triggerHandlers('ice_servers', data);
    });

    // 🆕 Logger tous les événements pour debug
    this.socket.onAny((event, ...args) => {
      console.log(`📡 Socket event '${event}':`, args);
    });
  }

  private triggerHandlers(event: SocketEvent, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (!handlers || handlers.size === 0) {
      console.warn(`⚠️ No handlers for event '${event}'`);
      return;
    }

    console.log(`🔔 Triggering ${handlers.size} handler(s) for '${event}'`);
    
    // Utiliser requestAnimationFrame pour éviter de bloquer
    requestAnimationFrame(() => {
      handlers.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`❌ Error in handler for '${event}':`, error);
        }
      });
    });
  }
}

let socketClientInstance: SocketClient | null = null;

export function getSocketClient(): SocketClient {
  if (!socketClientInstance) {
    socketClientInstance = new SocketClient();
  }
  return socketClientInstance;
}

export default getSocketClient;