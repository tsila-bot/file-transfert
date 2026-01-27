"use client"
import React from 'react'
import { motion } from 'framer-motion'
import { Clock, HardDrive, Zap } from 'lucide-react'
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
      case 'completed': return 'from-emerald-500 to-teal-400'
      case 'failed': return 'from-rose-500 to-red-400'
      case 'paused': return 'from-amber-500 to-yellow-400'
      case 'active': return 'from-indigo-500 to-violet-500'
      default: return 'from-slate-500 to-gray-400'
    }
  }
  return (
    <div className="space-y-3 w-full">
      {/* Progress Bar Track */}
      <div className="relative w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
        <motion.div
          className={`absolute top-0 left-0 h-full bg-gradient-to-r ${getStatusColor()}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 50, damping: 15 }}
        />
        
        {/* Shimmer effect for active state */}
        {status === 'active' && (
          <motion.div
            className="absolute top-0 left-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
          />
        )}
      </div>
      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
        {/* Size */}
        <div className="flex flex-col">
          <span className="flex items-center gap-1 text-slate-400 mb-0.5">
            <HardDrive size={10} />
            <span>Size</span>
          </span>
          <span className="font-medium text-slate-700">
            {formatBytes(bytesReceived)} <span className="text-slate-300">/</span> {formatBytes(bytesTotal)}
          </span>
        </div>
        {/* Speed - Center aligned */}
        <div className="flex flex-col items-center">
          <span className="flex items-center gap-1 text-slate-400 mb-0.5">
            <Zap size={10} />
            <span>Speed</span>
          </span>
          <span className="font-medium text-slate-700">
            {speed > 0 ? formatSpeed(speed) : '-'}
          </span>
        </div>
        {/* ETA - Right aligned */}
        <div className="flex flex-col items-end">
          <span className="flex items-center gap-1 text-slate-400 mb-0.5">
            <Clock size={10} />
            <span>ETA</span>
          </span>
          <span className="font-medium text-slate-700">
            {eta > 0 ? formatTime(eta) : '-'}
          </span>
        </div>
      </div>
    </div>
  )
}