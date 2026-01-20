'use client';

import { Phone, Video, Mic, MicOff, VideoOff } from 'lucide-react';
import { useState } from 'react';

export default function CallsPage() {
  const [isInCall, setIsInCall] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Appels Vidéo</h1>
        <p className="text-gray-500 mt-1">Gérez vos appels vidéo et audio en P2P</p>
      </div>

      {isInCall ? (
        <div className="bg-white rounded-lg shadow p-8">
          <div className="bg-gray-900 rounded-lg mb-6 h-96 flex items-center justify-center">
            <div className="text-center text-white space-y-4">
              <div className="w-24 h-24 bg-indigo-600 rounded-full mx-auto flex items-center justify-center">
                <span className="text-4xl">🎥</span>
              </div>
              <div>
                <h2 className="text-xl font-semibold">Appel en cours</h2>
                <p className="text-gray-400 text-sm">Utilisateur distant</p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setMicOn(!micOn)}
              className={`p-4 rounded-full transition ${
                micOn ? 'bg-gray-200 text-gray-900' : 'bg-red-500 text-white'
              }`}
            >
              {micOn ? <Mic size={24} /> : <MicOff size={24} />}
            </button>

            <button
              onClick={() => setVideoOn(!videoOn)}
              className={`p-4 rounded-full transition ${
                videoOn ? 'bg-gray-200 text-gray-900' : 'bg-red-500 text-white'
              }`}
            >
              {videoOn ? <Video size={24} /> : <VideoOff size={24} />}
            </button>

            <button
              onClick={() => setIsInCall(false)}
              className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition"
            >
              <Phone size={24} />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="w-24 h-24 bg-indigo-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Phone className="text-indigo-600" size={48} />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Aucun appel en cours</h2>
          <p className="text-gray-500 mb-6">Sélectionnez un contact pour commencer un appel</p>
          <button
            onClick={() => setIsInCall(true)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition"
          >
            Démarrer un appel
          </button>
        </div>
      )}
    </div>
  );
}
