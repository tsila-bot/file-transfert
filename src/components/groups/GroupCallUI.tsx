// src/components/groups/GroupCallUI.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import type { GroupCallState, PeerConnection } from '@/core/services/webrtc/GroupCallManager';

interface GroupCallUIProps {
  callState: GroupCallState | null;
  peers: PeerConnection[];
  localStream?: MediaStream;
  onEndCall: () => void;
  onToggleAudio?: (enabled: boolean) => void;
  onToggleVideo?: (enabled: boolean) => void;
  totalParticipants?: number;
  currentUserName?: string;
}

export function GroupCallUI({
  callState,
  peers,
  localStream,
  onEndCall,
  onToggleAudio,
  onToggleVideo,
  totalParticipants = 1,
  currentUserName = 'You',
}: GroupCallUIProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(callState?.type === 'video');
  const [isMinimized, setIsMinimized] = useState(false);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Afficher le flux local
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Afficher les flux distants
  useEffect(() => {
    peers.forEach((peer) => {
      const videoRef = remoteVideoRefs.current.get(peer.peerId);
      if (videoRef && peer.remoteStream) {
        videoRef.srcObject = peer.remoteStream;
      }
    });
  }, [peers]);

  if (!callState || callState.status === 'idle') {
    return null;
  }

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition flex items-center gap-2"
      >
        <Phone size={16} />
        📞 Appel en cours ({totalParticipants} participants)
      </button>
    );
  }

  const toggleAudio = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach((track) => (track.enabled = !audioEnabled));
      setAudioEnabled(!audioEnabled);
      onToggleAudio?.(!audioEnabled);
    }
  };

  const toggleVideo = () => {
    if (localStream && callState.type === 'video') {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach((track) => (track.enabled = !videoEnabled));
      setVideoEnabled(!videoEnabled);
      onToggleVideo?.(!videoEnabled);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 h-96 bg-black bg-opacity-95 rounded-xl flex flex-col z-50 border border-gray-700 shadow-2xl">
      {/* Header avec contrôles de fenêtre */}
      <div className="bg-gray-900 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="text-white text-sm font-semibold">📞 Appel en cours</div>
        <button
          onClick={() => setIsMinimized(true)}
          className="text-gray-400 hover:text-white text-lg"
          title="Minimize"
        >
          −
        </button>
      </div>

      {/* Grid de vidéos */}
      <div className="flex-1 overflow-auto grid grid-cols-1 gap-2 p-3">
        {/* Vidéo locale */}
        <div className="relative bg-gray-800 rounded-lg overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-gray-900 bg-opacity-70 px-3 py-1 rounded text-white text-sm">
            {currentUserName}
          </div>
        </div>

        {/* Vidéos distantes */}
        {peers.map((peer) => (
          <div key={peer.peerId} className="relative bg-gray-800 rounded-lg overflow-hidden">
            <video
              ref={(el) => {
                if (el) remoteVideoRefs.current.set(peer.peerId, el);
              }}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-gray-900 bg-opacity-70 px-3 py-1 rounded text-white text-sm">
              {peer.peerName}
            </div>
          </div>
        ))}
      </div>

      {/* Contrôles en bas */}
      <div className="bg-gray-900 border-t border-gray-700 px-3 py-3 flex items-center justify-center gap-3">
        {/* Toggle Audio */}
        <button
          onClick={toggleAudio}
          className={`p-2 rounded-full transition ${
            audioEnabled
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
          title={audioEnabled ? 'Mute' : 'Unmute'}
        >
          {audioEnabled ? <Mic size={18} /> : <MicOff size={18} />}
        </button>

        {/* Toggle Video (si type video) */}
        {callState.type === 'video' && (
          <button
            onClick={toggleVideo}
            className={`p-2 rounded-full transition ${
              videoEnabled
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title={videoEnabled ? 'Stop Video' : 'Start Video'}
          >
            {videoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
          </button>
        )}

        {/* End Call */}
        <button
          onClick={onEndCall}
          className="p-2 rounded-full bg-red-600 hover:bg-red-700 text-white transition"
          title="End Call"
        >
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  );
}
