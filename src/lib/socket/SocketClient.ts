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
  | 'chat:conversations_loaded'
  | 'chat:messages_loaded'
  | 'chat:messages_marked_as_read'
  | 'chat:send_message'
  | 'chat:mark_conversation_read'
  | 'unread_count_updated'
  | 'chat:start_conversation'
  | 'chat:conversation_started'
  | 'chat:get_online_users'
  | 'chat:online_users_list'
  | 'group_user_joined'
  | 'group_user_left'
  | 'group_chat_message'
  | 'join_group'
  | 'leave_group'
  | 'group_call_initiated'
  | 'group_call_active'
  | 'group_call_ended'
  | 'initiate_group_call'
  | 'accept_group_call'
  | 'reject_group_call'
  | 'end_group_call'
  | 'group_call_offer'
  | 'group_call_answer'
  | 'group_call_ice_candidate'
  | 'group_call_participant_joined'
  | 'group_call_participant_rejected'
  | 'group_call_participant_count'
  | 'request_permission'
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
  private eventHandlers: Map<SocketEvent, Function[]> = new Map(); // 🆕 Tableau de handlers
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private iceServers: IceServer[] = [];
  private forwardedEvents: Set<SocketEvent> = new Set();

  connect(token: string): void {
    if (this.socket?.connected) {
      console.warn('Socket already connected');
      return;
    }

    // Log masked token for debugging (do not log full token in production)
    const masked = token ? `${token.slice(0, 6)}...${token.slice(-6)}` : 'no-token';
    console.log('🔌 Connecting to WebSocket server... token=', masked);

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
    // 🆕 Nouvelle méthode pour router tous les événements via onAny()

    // If server immediately rejects auth, keep socket instance for reconnect attempts
  }

  disconnect(): void {
    if (this.socket) {
      console.log('🔌 Disconnecting from WebSocket server...');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.eventHandlers.clear();
      this.iceServers = [];
      this.forwardedEvents.clear();
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
   * 🆕 Ajouter un handler pour un événement (support multiple)
   */
  on(event: SocketEvent, handler: Function): () => void {
    // Initialiser le tableau si besoin
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }

    // ⚠️ NE PAS enregistrer socket.on() car onAny() s'en charge déjà!
    // Ajouter juste le handler à la liste
    const handlers = this.eventHandlers.get(event)!;
    if (handlers.indexOf(handler) !== -1) {
      console.warn(`Handler for '${event}' already registered`);
    } else {
      handlers.push(handler);
    }

    console.log(`✅ Handler registered for '${event}' (total: ${handlers.length})`);

    // Retourner une fonction pour supprimer ce handler spécifique
    return () => {
      this.off(event, handler);
    };
  }

  /**
   * 🆕 Supprimer un ou tous les handlers
   */
  off(event: SocketEvent, handler?: Function): void {
    if (!this.eventHandlers.has(event)) {
      return;
    }

    if (!handler) {
      // Supprimer tous les handlers pour cet événement
      this.eventHandlers.delete(event);
      if (this.socket) {
        this.socket.off(event);
      }
      this.forwardedEvents.delete(event);
      console.log(`🧹 All handlers removed for '${event}'`);
    } else {
      // Supprimer un handler spécifique
      const handlers = this.eventHandlers.get(event)!;
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
        console.log(`🧹 Handler removed for '${event}' (remaining: ${handlers.length})`);
      }

      // Si plus de handlers, supprimer le listener socket.io
      if (handlers.length === 0) {
        this.eventHandlers.delete(event);
        if (this.socket) {
          this.socket.off(event);
          this.forwardedEvents.delete(event);
        }
      }
    }
  }

  /**
   * 🆕 Déclencher tous les handlers pour un événement
   */
  private triggerEvent(event: SocketEvent, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);

    if (!handlers || handlers.length === 0) {
      console.warn(`⚠️ Event '${event}' triggered but no handlers registered`);
      return;
    }

    console.log(`🔔 Triggering ${handlers.length} handler(s) for '${event}'`);

    // Exécuter tous les handlers de manière asynchrone
    handlers.forEach((handler, index) => {
      try {
        // Utiliser setTimeout pour éviter les blocages
        setTimeout(() => {
          handler(...args);
        }, 0);
      } catch (error) {
        console.error(`❌ Error in handler #${index} for '${event}':`, error);
      }
    });
  }

  /**
   * 🆕 Configurer le forwarding des événements socket.io (SUPPRIMÉ - onAny() s'en charge)
   */
  // private setupEventForwarding(): void {
  //   if (!this.socket) return;
  //   // Déprécié: onAny() gère maintenant tous les événements
  // }

  private setupDefaultHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket connected - ID:', this.socket?.id);
      this.reconnectAttempts = 0;
      this.requestIceServers();
      this.triggerEvent('connect');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      this.triggerEvent('disconnect', reason);
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
      this.triggerEvent('error', error);
    });

    this.socket.on('ice_servers', (data: IceServersResponse) => {
      this.iceServers = data.iceServers;
      console.log('✅ ICE servers cached:', this.iceServers.length);
      this.triggerEvent('ice_servers', data);
    });

    // 🆕 ✅ IMPORTANT: Utiliser onAny() pour router TOUS les événements vers les handlers
    this.socket.onAny((event: string, ...args: any[]) => {
      console.log(`📡 Socket event '${event}':`, args);
      
      // Route l'événement vers les handlers enregistrés
      // Sauf si c'est un événement de contrôle (connect, disconnect, etc)
      if (event !== 'connect' && event !== 'disconnect' && event !== 'connect_error' && event !== 'error') {
        this.triggerEvent(event as SocketEvent, ...args);
      }
    });
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

      // 🆕 Utiliser la méthode on normale
      const removeHandler = this.on('ice_servers', (data: IceServersResponse) => {
        clearTimeout(timeout);
        this.iceServers = data.iceServers;
        console.log('✅ ICE servers received:', this.iceServers.length);
        removeHandler(); // Se désinscrire
        resolve(this.iceServers);
      });

      this.socket.emit('get_ice_servers');
    });
  }

  // Autres méthodes inchangées...
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
}

let socketClientInstance: SocketClient | null = null;

export function getSocketClient(): SocketClient {
  if (!socketClientInstance) {
    socketClientInstance = new SocketClient();
  }
  return socketClientInstance;
}

export default getSocketClient;