"use client"

import React from 'react'

interface Props {
  received: number
  total: number
}

export default function ChunkVisualization({ received, total }: Props) {
  const maxCells = 50
  const cells = Math.min(maxCells, total || 0)
  const receivedCells = total > 0 ? Math.round((received / total) * cells) : 0

  return (
    <div className="w-full">
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: cells }).map((_, i) => (
          <div
            key={i}
            className={`h-3 ${i < receivedCells ? 'bg-green-500' : 'bg-gray-300'} rounded-sm`}
            title={`${i < receivedCells ? 'reçu' : 'manquant'}`}
          />
        ))}
      </div>
      <div className="text-xs text-gray-500 mt-1">{received}/{total} chunks</div>
    </div>
  )
}
