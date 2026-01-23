'use client';

import { useEffect, useRef } from 'react';

interface VideoElementProps {
  stream?: MediaStream;
  label: string;
  isLocal?: boolean;
  isMuted?: boolean;
}

export function VideoElement({
  stream,
  label,
  isLocal = false,
  isMuted = false,
}: VideoElementProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal || isMuted}
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded text-sm">
        {label} {isLocal && '(Vous)'}
      </div>
    </div>
  );
}
