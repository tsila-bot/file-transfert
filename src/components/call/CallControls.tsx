'use client';

import { Phone, Mic, MicOff, Video, VideoOff } from 'lucide-react';

interface CallControlsProps {
  micOn: boolean;
  videoOn: boolean;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  isLoading?: boolean;
}

export function CallControls({
  micOn,
  videoOn,
  onToggleMic,
  onToggleVideo,
  onEndCall,
  isLoading = false,
}: CallControlsProps) {
  return (
    <div className="flex items-center justify-center gap-6 bg-gray-100 p-6 rounded-lg">
      <button
        onClick={onToggleMic}
        disabled={isLoading}
        className={`p-4 rounded-full transition transform hover:scale-110 ${
          micOn
            ? 'bg-gray-300 text-gray-900 hover:bg-gray-400'
            : 'bg-red-500 text-white hover:bg-red-600'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title={micOn ? 'Désactiver le microphone' : 'Activer le microphone'}
      >
        {micOn ? <Mic size={24} /> : <MicOff size={24} />}
      </button>

      <button
        onClick={onToggleVideo}
        disabled={isLoading}
        className={`p-4 rounded-full transition transform hover:scale-110 ${
          videoOn
            ? 'bg-gray-300 text-gray-900 hover:bg-gray-400'
            : 'bg-red-500 text-white hover:bg-red-600'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title={videoOn ? 'Désactiver la caméra' : 'Activer la caméra'}
      >
        {videoOn ? <Video size={24} /> : <VideoOff size={24} />}
      </button>

      <button
        onClick={onEndCall}
        disabled={isLoading}
        className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 transition transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Raccrocher"
      >
        <Phone size={24} />
      </button>
    </div>
  );
}
