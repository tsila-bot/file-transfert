"use client"
import React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, AlertCircle, PauseCircle, Activity } from 'lucide-react'
interface Props {
  received: number
  total: number
  status?: string
}
export default function ChunkVisualization({ received, total, status = 'active' }: Props) {
  const maxCells = 100
  // Ensure we don't divide by zero and have at least 1 cell if total is 0
  const safeTotal = total || 1
  const cells = Math.min(maxCells, safeTotal)
  
  // Calculate how many cells should be filled
  const progressRatio = safeTotal > 0 ? received / safeTotal : 0
  const receivedCells = Math.round(progressRatio * cells)
  const getStatusColor = () => {
    switch (status) {
      case 'completed': return 'bg-emerald-500 shadow-emerald-200'
      case 'failed': return 'bg-rose-500 shadow-rose-200'
      case 'paused': return 'bg-amber-500 shadow-amber-200'
      default: return 'bg-indigo-500 shadow-indigo-200'
    }
  }
  const getEmptyColor = () => 'bg-slate-100'
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }
  const getStatusIcon = () => {
    switch (status) {
      case 'completed': return <CheckCircle2 size={14} className="text-emerald-600" />
      case 'failed': return <AlertCircle size={14} className="text-rose-600" />
      case 'paused': return <PauseCircle size={14} className="text-amber-600" />
      default: return <Activity size={14} className="text-indigo-600" />
    }
  }
  return (
    <div className="w-full space-y-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
      {/* Grid Visualization */}
      <div className="relative">
        <div className="grid grid-cols-20 gap-px bg-slate-200/50 p-px rounded overflow-hidden">
          {Array.from({ length: cells }).map((_, i) => {
            const isFilled = i < receivedCells
            return (
              <motion.div
                key={i}
                initial={false}
                animate={{
                  scale: isFilled ? 1 : 0.9,
                  opacity: isFilled ? 1 : 0.5,
                }}
                className={`h-1.5 sm:h-2 rounded-[1px] transition-colors duration-300 ${
                  isFilled ? getStatusColor() : getEmptyColor()
                }`}
                title={`Chunk ${Math.floor((i / cells) * safeTotal)}`}
              />
            )
          })}
        </div>
      </div>
      {/* Stats Footer */}
      <div className="flex justify-between items-center text-xs">
        <div className="flex items-center gap-1.5 font-medium text-slate-600 bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100">
          {getStatusIcon()}
          <span>
            {formatNumber(received)} <span className="text-slate-400">/</span> {formatNumber(total)} <span className="text-slate-400 font-normal">chunks</span>
          </span>
        </div>
        
        <div className={`font-bold px-2 py-1 rounded-md ${
          status === 'completed' ? 'text-emerald-600 bg-emerald-50' : 
          status === 'failed' ? 'text-rose-600 bg-rose-50' :
          'text-indigo-600 bg-indigo-50'
        }`}>
          {safeTotal > 0 ? `${((received / safeTotal) * 100).toFixed(1)}%` : '0%'}
        </div>
      </div>
    </div>
  )
}