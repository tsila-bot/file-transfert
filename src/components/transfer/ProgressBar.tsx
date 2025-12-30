"use client"

import React from 'react'

interface Props {
  percentage: number
  speed?: number
  eta?: number
}

export default function ProgressBar({ percentage, speed = 0, eta = 0 }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(percentage * 100) / 100))

  return (
    <div>
      <div className="w-full bg-gray-200 rounded h-3 overflow-hidden">
        <div className="bg-blue-500 h-3" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-600 mt-1">
        <div>{pct}%</div>
        <div>{speed ? `${(speed / 1024).toFixed(1)} KB/s` : '0 KB/s'}</div>
        <div>{eta ? `${Math.round(eta)}s` : '—'}</div>
      </div>
    </div>
  )
}
