// frontend/src/app/dashboard/transfer-history/components/TransferCharts.tsx

"use client"

import React, { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { transferAPI } from '@/core/services/api/transfer.service'

interface TransferHistoryItem {
  id: string
  status: string
  transferType: string
  fileSizeBytes: number
  avgSpeed?: number
  duration?: number
  createdAt: string
}

interface ChartsProps {
  transfers: TransferHistoryItem[]
  loading: boolean
}

const COLORS = {
  SUCCESS: '#10b981',
  FAILED: '#ef4444',
  PARTIAL: '#f59e0b',
  CANCELLED: '#3b82f6',
  REJECTED: '#ea580c',
  'P2P_DIRECT': '#3b82f6',
  'P2P_MULTI_SOURCE': '#8b5cf6',
  'PUBLIC_LINK': '#ec4899',
  'GROUP_TRANSFER': '#14b8a6',
}

export default function TransferCharts({ transfers, loading }: ChartsProps) {
  const [dailyData, setDailyData] = useState<any[]>([])
  const [statusData, setStatusData] = useState<any[]>([])
  const [typeData, setTypeData] = useState<any[]>([])
  const [speedData, setSpeedData] = useState<any[]>([])

  useEffect(() => {
    if (transfers.length === 0) return

    // 1. Daily transfers chart
    const dailyMap: Record<string, { count: number; size: number }> = {}
    transfers.forEach((t) => {
      const date = new Date(t.createdAt).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      if (!dailyMap[date]) {
        dailyMap[date] = { count: 0, size: 0 }
      }
      dailyMap[date].count++
      dailyMap[date].size += t.fileSizeBytes || 0
    })

    const daily = Object.entries(dailyMap)
      .map(([date, data]) => ({
        date,
        transferts: data.count,
        tailleGB: (data.size / (1024 * 1024 * 1024)).toFixed(2),
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    setDailyData(daily)

    // 2. Status distribution
    const statusMap: Record<string, number> = {}
    transfers.forEach((t) => {
      statusMap[t.status] = (statusMap[t.status] || 0) + 1
    })

    const status = Object.entries(statusMap).map(([name, value]) => ({
      name,
      value,
      color: COLORS[name as keyof typeof COLORS] || '#6b7280',
    }))

    setStatusData(status)

    // 3. Transfer type distribution
    const typeMap: Record<string, number> = {}
    transfers.forEach((t) => {
      typeMap[t.transferType] = (typeMap[t.transferType] || 0) + 1
    })

    const type = Object.entries(typeMap).map(([name, value]) => ({
      name,
      value,
      color: COLORS[name as keyof typeof COLORS] || '#6b7280',
    }))

    setTypeData(type)

    // 4. Speed distribution (top speeds)
    const speedArray = transfers
      .filter((t) => t.avgSpeed)
      .slice(0, 10)
      .map((t, idx) => ({
        rank: `#${idx + 1}`,
        vitesse: t.avgSpeed?.toFixed(2) || 0,
      }))

    setSpeedData(speedArray)
  }, [transfers])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (transfers.length === 0) {
    return (
      <div className="text-center py-12 text-slate-600">
        <p>Pas assez de données pour afficher les graphiques</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Daily Transfers Chart */}
      {dailyData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Transferts par Jour</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="transferts"
                stroke="#3b82f6"
                dot={{ fill: '#3b82f6' }}
                name="Nombre de transferts"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Status Distribution */}
      {statusData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Distribution des Statuts</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Transfer Type Distribution */}
      {typeData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Types de Transferts</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={typeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="value" fill="#8b5cf6" name="Nombre" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Speed Ranking */}
      {speedData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Top 10 Vitesses</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={speedData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="rank" type="category" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
                formatter={(value) => `${value} Mbps`}
              />
              <Bar dataKey="vitesse" fill="#f59e0b" name="Vitesse (Mbps)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
