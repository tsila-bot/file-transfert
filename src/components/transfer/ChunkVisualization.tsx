"use client"

import React from 'react'

interface Props {
  received: number
  total: number
  status?: string
}

export default function ChunkVisualization({ received, total, status = 'active' }: Props) {
  const maxCells = 100
  const cells = Math.min(maxCells, total || 1)
  const receivedCells = total > 0 ? Math.round((received / total) * cells) : 0

  const getCellColor = (index: number) => {
    if (index < receivedCells) {
      switch (status) {
        case 'completed': return 'bg-green-500'
        case 'failed': return 'bg-red-500'
        case 'paused': return 'bg-yellow-500'
        default: return 'bg-blue-500'
      }
    }
    return 'bg-gray-200'
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  return (
    <div className="w-full space-y-1">
      <div className="grid grid-cols-20 gap-px">
        {Array.from({ length: cells }).map((_, i) => (
          <div
            key={i}
            className={`h-2 ${getCellColor(i)} rounded-sm transition-colors duration-200`}
            title={`Chunk ${Math.floor((i / cells) * total)}`}
          />
        ))}
      </div>

      <div className="flex justify-between text-xs text-gray-500">
        <div>
          {formatNumber(received)} / {formatNumber(total)} chunks
        </div>
        <div>
          {total > 0 ? `${((received / total) * 100).toFixed(1)}%` : '0%'}
        </div>
      </div>
    </div>
  )
}
