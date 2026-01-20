"use client"

import React from 'react'

interface Props {
  percentage: number
  speed?: number
  eta?: number
  bytesReceived?: number
  bytesTotal?: number
  status?: string
}

export default function ProgressBar({
  percentage,
  speed = 0,
  eta = 0,
  bytesReceived = 0,
  bytesTotal = 0,
  status = 'active'
}: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(percentage * 100) / 100))

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatSpeed = (speed: number) => {
    if (speed === 0) return '0 B/s'
    const k = 1024
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s']
    const i = Math.floor(Math.log(speed) / Math.log(k))
    return parseFloat((speed / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatTime = (seconds: number) => {
    if (seconds === 0 || !isFinite(seconds)) return '--'
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
  }

  const getStatusColor = () => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'failed': return 'bg-red-500'
      case 'paused': return 'bg-yellow-500'
      case 'active': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="space-y-2">
      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
        <div
          className={`h-4 transition-all duration-300 ${getStatusColor()}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-gray-600">
        <div className="font-medium">{pct}%</div>
        <div>{formatBytes(bytesReceived)} / {formatBytes(bytesTotal)}</div>
        <div className="text-right">
          {speed > 0 ? formatSpeed(speed) : '0 B/s'}
        </div>
      </div>

      {eta > 0 && (
        <div className="text-xs text-gray-500 text-center">
          ETA: {formatTime(eta)}
        </div>
      )}
    </div>
  )
}
