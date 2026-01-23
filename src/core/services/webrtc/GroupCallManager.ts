// src/core/services/webrtc/GroupCallManager.ts

export interface SocketAPI {
  emit: (event: string, data?: any) => void;
  on: (event: any, handler: Function) => () => void;
}

export interface PeerConnection {
  peerId: string;
  peerName: string;
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  remoteStream?: MediaStream;
}

export interface GroupCallState {
  callId: string;
  groupId: string;
  type: 'audio' | 'video';
  status: 'idle' | 'ringing' | 'connected' | 'ended';
  localStream?: MediaStream;
  peers: Map<string, PeerConnection>;
  iceServers: RTCIceServer[];
}

export class GroupCallManager {
  private socket: SocketAPI;
  private callState: GroupCallState | null = null;
  private readonly config = {
    audio: { echoCancellation: true, noiseSuppression: true },
    video: { width: { ideal: 1280 }, height: { ideal: 720 } },
  };

  constructor(socket: SocketAPI) {
    this.socket = socket;
  }

  /**
   * Initialiser un appel groupe
   */
  async initiateGroupCall(
    groupId: string,
    type: 'audio' | 'video',
    iceServers: RTCIceServer[]
  ): Promise<GroupCallState> {
    console.log(`🎥 Initiation appel groupe (${type}) dans ${groupId}`);

    // Créer un nouvel état d'appel
    const callId = `call-${groupId}-${Date.now()}`;
    this.callState = {
      callId,
      groupId,
      type,
      status: 'ringing',
      peers: new Map(),
      iceServers,
    };

    // Obtenir le flux local
    await this.getLocalStream(type);

    // Émettre l'événement d'initiation
    this.socket.emit('initiate_group_call', {
      groupId,
      callId,
      type,
    });

    return this.callState;
  }

  /**
   * Accepter un appel groupe
   */
  async acceptGroupCall(
    groupId: string,
    callId: string,
    type: 'audio' | 'video',
    iceServers: RTCIceServer[]
  ): Promise<GroupCallState> {
    console.log(`✅ Acceptation appel groupe ${callId}`);

    if (!this.callState) {
      this.callState = {
        callId,
        groupId,
        type,
        status: 'connected',
        peers: new Map(),
        iceServers,
      };
    }

    // Obtenir le flux local
    await this.getLocalStream(type);

    // Émettre l'acceptation
    this.socket.emit('accept_group_call', {
      groupId,
      callId,
    });

    return this.callState;
  }

  /**
   * Rejeter un appel groupe
   */
  rejectGroupCall(groupId: string, callId: string): void {
    console.log(`❌ Rejet appel groupe ${callId}`);
    this.socket.emit('reject_group_call', { groupId, callId });
    this.callState = null;
  }

  /**
   * Terminer un appel groupe
   */
  async endGroupCall(): Promise<void> {
    if (!this.callState) return;

    console.log(`📞 Fin appel groupe ${this.callState.callId}`);

    // Arrêter le flux local
    if (this.callState.localStream) {
      this.callState.localStream.getTracks().forEach((track) => track.stop());
    }

    // Fermer toutes les connexions peer
    for (const peer of this.callState.peers.values()) {
      peer.connection.close();
    }

    // Émettre l'événement de fin
    this.socket.emit('end_group_call', {
      groupId: this.callState.groupId,
      callId: this.callState.callId,
    });

    this.callState = null;
  }

  /**
   * Créer une connexion peer pour un participant
   */
  async createPeerConnection(
    peerId: string,
    peerName: string,
    initiator: boolean
  ): Promise<RTCPeerConnection> {
    if (!this.callState) throw new Error('No active call');

    console.log(`🔗 Création connexion peer avec ${peerName} (initiator: ${initiator})`);

    const peerConnection = new RTCPeerConnection({
      iceServers: this.callState.iceServers,
    });

    // Ajouter le flux local
    if (this.callState.localStream) {
      this.callState.localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, this.callState!.localStream!);
      });
    }

    // Handler: Remote stream
    peerConnection.ontrack = (event) => {
      console.log(`📹 Flux reçu de ${peerName}`);
      if (this.callState) {
        const peer = this.callState.peers.get(peerId);
        if (peer) {
          peer.remoteStream = event.streams[0];
        }
      }
    };

    // Handler: ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('group_call_ice', {
          groupId: this.callState!.groupId,
          callId: this.callState!.callId,
          targetUserId: peerId,
          candidate: event.candidate,
        });
      }
    };

    // Handler: Connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`📡 Connection state: ${peerConnection.connectionState}`);
      if (peerConnection.connectionState === 'failed') {
        console.error(`❌ Connexion échouée avec ${peerName}`);
      }
    };

    // Créer et envoyer une offre si initiateur
    if (initiator) {
      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        this.socket.emit('group_call_offer', {
          groupId: this.callState.groupId,
          callId: this.callState.callId,
          targetUserId: peerId,
          offer: peerConnection.localDescription,
        });
      } catch (error) {
        console.error('Erreur création offre:', error);
      }
    }

    // Stocker la connexion
    this.callState.peers.set(peerId, {
      peerId,
      peerName,
      connection: peerConnection,
    });

    return peerConnection;
  }

  /**
   * Traiter une offre reçue
   */
  async handleRemoteOffer(
    peerId: string,
    peerName: string,
    offer: RTCSessionDescriptionInit
  ): Promise<void> {
    if (!this.callState) throw new Error('No active call');

    console.log(`📨 Offre reçue de ${peerName}`);

    let peerConnection = this.callState.peers.get(peerId)?.connection;

    // Créer une nouvelle connexion si elle n'existe pas
    if (!peerConnection) {
      peerConnection = await this.createPeerConnection(peerId, peerName, false);
    }

    try {
      // Vérifier l'état avant de définir la description distante
      if (peerConnection.signalingState !== 'stable' && peerConnection.signalingState !== 'have-local-offer') {
        console.log(`⚠️ État incorrect pour offre: ${peerConnection.signalingState}, en attente...`);
        // Attendre que la connexion soit dans le bon état
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Définir la description distante
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      // Créer et envoyer une réponse
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      this.socket.emit('group_call_answer', {
        groupId: this.callState.groupId,
        callId: this.callState.callId,
        targetUserId: peerId,
        answer: peerConnection.localDescription,
      });
    } catch (error) {
      console.error('Erreur traitement offre:', error);
    }
  }

  /**
   * Traiter une réponse reçue
   */
  async handleRemoteAnswer(
    peerId: string,
    answer: RTCSessionDescriptionInit
  ): Promise<void> {
    if (!this.callState) throw new Error('No active call');

    console.log(`📩 Réponse reçue de ${peerId}`);

    const peer = this.callState.peers.get(peerId);
    if (!peer) {
      console.error(`❌ Peer ${peerId} non trouvé`);
      return;
    }

    try {
      // Vérifier que l'état est correct avant de définir la réponse distante
      if (peer.connection.signalingState !== 'have-local-offer') {
        console.warn(`⚠️ État incorrect pour réponse: ${peer.connection.signalingState}. État attendu: have-local-offer`);
        return;
      }
      
      await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error('Erreur traitement réponse:', error);
    }
  }

  /**
   * Traiter un ICE candidate reçu
   */
  async handleRemoteIceCandidate(
    peerId: string,
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    const peer = this.callState?.peers.get(peerId);
    if (!peer) return;

    try {
      await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Erreur ajout ICE candidate:', error);
    }
  }

  /**
   * Obtenir le flux local
   */
  private async getLocalStream(type: 'audio' | 'video'): Promise<MediaStream> {
    if (this.callState?.localStream) {
      return this.callState.localStream;
    }

    console.log(`📹 Obtention du flux local (${type})`);

    try {
      const constraints: MediaStreamConstraints =
        type === 'video'
          ? { audio: this.config.audio, video: this.config.video }
          : { audio: this.config.audio };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (this.callState) {
        this.callState.localStream = stream;
      }

      return stream;
    } catch (error) {
      console.error('Erreur obtention flux:', error);
      
      // ⚠️ Si permission refusée, émettre un événement
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        console.warn('❌ Permission refusée pour le microphone/caméra');
        this.socket.emit('request_permission', {
          type: type,
          message: `Veuillez autoriser l'accès au ${type === 'video' ? 'microphone et caméra' : 'microphone'}`
        });
      }
      
      // Fallback : Si vidéo échoue, essayer audio seulement
      if (type === 'video' && error instanceof DOMException) {
        console.log('📹 → 🔊 Fallback à l\'audio seulement');
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: this.config.audio });
          if (this.callState) {
            this.callState.localStream = audioStream;
            // Mettre à jour le type d'appel
            this.callState.type = 'audio';
          }
          return audioStream;
        } catch (audioError) {
          console.error('Erreur obtention flux audio:', audioError);
          // ⚠️ Émettre un événement si audio aussi échoue
          if (audioError instanceof DOMException && audioError.name === 'NotAllowedError') {
            console.warn('❌ Permission refusée pour le microphone');
            this.socket.emit('request_permission', {
              type: 'audio',
              message: 'Veuillez autoriser l\'accès au microphone'
            });
          }
          throw audioError;
        }
      }
      
      throw error;
    }
  }

  /**
   * Obtenir l'état actuel de l'appel
   */
  getCallState(): GroupCallState | null {
    return this.callState;
  }

  /**
   * Obtenir une connexion peer
   */
  getPeerConnection(peerId: string): RTCPeerConnection | undefined {
    return this.callState?.peers.get(peerId)?.connection;
  }

  /**
   * Obtenir tous les peers
   */
  getPeers(): PeerConnection[] {
    return Array.from(this.callState?.peers.values() || []);
  }

  /**
   * Retirer un participant
   */
  removePeer(peerId: string): void {
    const peer = this.callState?.peers.get(peerId);
    if (peer) {
      peer.connection.close();
      this.callState?.peers.delete(peerId);
      console.log(`❌ Participant ${peerId} retiré`);
    }
  }
}
