'use client';

import { ReactNode } from 'react';

interface CallLayoutProps {
  localVideo: ReactNode;
  remoteVideo: ReactNode;
  info: ReactNode;
  controls: ReactNode;
}

export function CallLayout({
  localVideo,
  remoteVideo,
  info,
  controls,
}: CallLayoutProps) {
  return (
    <div className="space-y-6">
      {/* Videos Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-96 lg:h-full min-h-96">
          {remoteVideo}
        </div>
        <div className="h-64 lg:h-96">
          {localVideo}
        </div>
      </div>

      {/* Info and Controls */}
      <div className="space-y-4">
        {info}
        {controls}
      </div>
    </div>
  );
}
