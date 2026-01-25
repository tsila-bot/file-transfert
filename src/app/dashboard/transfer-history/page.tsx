// frontend/src/app/dashboard/transfer-history/page.tsx

"use client"

import React, { useState, useEffect } from 'react'
import {
  Download,
  Upload,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Pause,
  TrendingUp,
  Calendar,
  Filter,
  DownloadCloud,
  FileText,
  Zap,
} from 'lucide-react'
import { transferAPI, TransferHistoryItem } from '@/core/services/api/transfer.service'
import { useAuthStore } from '@/stores/authStore'
import TransferCharts from './components/TransferCharts'

interface PaginationData {
  transfers: TransferHistoryItem[]
  total: number
}

interface TransferStats {
  totalTransfers: number
  totalSize: number
  successfulTransfers: number
  failedTransfers: number
  partialTransfers: number
  cancelledTransfers: number
  p2pTransfers: number
  groupTransfers: number
  publicLinkTransfers: number
  averageSpeed?: number
  sentTransfers?: number
  sentSize?: number
  receivedTransfers?: number
  receivedSize?: number
}

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  SUCCESS: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    icon: <CheckCircle className="w-5 h-5" />,
  },
  FAILED: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    icon: <XCircle className="w-5 h-5" />,
  },
  PARTIAL: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    icon: <AlertCircle className="w-5 h-5" />,
  },
  CANCELLED: {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    icon: <Pause className="w-5 h-5" />,
  },
}

const TRANSFER_TYPE_LABELS: Record<string, string> = {
  P2P_DIRECT: 'P2P Direct',
  P2P_MULTI_SOURCE: 'P2P Multi-Source',
  PUBLIC_LINK: 'Lien Public',
  GROUP_TRANSFER: 'Transfer Groupe',
}

export default function TransferHistoryPage() {
  // Auth
  const currentUser = useAuthStore((state) => state.user)
  const currentUserId = currentUser?.id

  // État
  const [transfers, setTransfers] = useState<TransferHistoryItem[]>([])
  const [stats, setStats] = useState<TransferStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)

  // Filtres
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [filterType, setFilterType] = useState<string>('ALL')
  const [dateRangeStart, setDateRangeStart] = useState<string>('')
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  // Charger l'historique
  useEffect(() => {
    loadTransfers()
    loadStats()
  }, [page, pageSize, filterStatus, filterType, dateRangeStart, dateRangeEnd])

  const loadTransfers = async () => {
    try {
      setLoading(true)
      const skip = (page - 1) * pageSize

      const response = await transferAPI.getUserTransferHistory(skip, pageSize)

      // Appliquer les filtres côté client (au besoin)
      let filtered = response.transfers || []

      if (filterStatus !== 'ALL') {
        filtered = filtered.filter((t: TransferHistoryItem) => t.status === filterStatus)
      }

      if (filterType !== 'ALL') {
        filtered = filtered.filter((t: TransferHistoryItem) => t.transferType === filterType)
      }

      if (dateRangeStart) {
        filtered = filtered.filter((t: TransferHistoryItem) => new Date(t.createdAt) >= new Date(dateRangeStart))
      }

      if (dateRangeEnd) {
        filtered = filtered.filter((t: TransferHistoryItem) => new Date(t.createdAt) <= new Date(dateRangeEnd))
      }

      setTransfers(filtered)
      setTotal(response.total)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement')
      setTransfers([])
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const data = await transferAPI.getUserTransferStats()
      setStats(data)
    } catch (err) {
      console.error('Erreur chargement stats:', err)
    }
  }

  const formatFileSize = (bytes: bigint | number) => {
    const size = typeof bytes === 'bigint' ? Number(bytes) : bytes
    if (size === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(size) / Math.log(k))
    return Math.round((size / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatSpeed = (speedMbps?: number) => {
    if (!speedMbps) return '-'
    return speedMbps.toFixed(2) + ' Mbps'
  }

  const getTransferDirection = (transfer: TransferHistoryItem): 'sent' | 'received' => {
    if (!currentUserId) return 'received'
    return transfer.senderId === currentUserId ? 'sent' : 'received'
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds === 0) return '-'
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ${minutes % 60}m`
  }

  const handleExportCSV = () => {
    if (transfers.length === 0) return

    const headers = ['Date', 'Fichier', 'Taille', 'Type', 'Direction', 'Pair', 'Statut', 'Vitesse', 'Durée']
    const rows = transfers.map((t: TransferHistoryItem) => [
      new Date(t.createdAt).toLocaleString(),
      t.fileHash || 'N/A',
      formatFileSize(t.fileSizeBytes),
      TRANSFER_TYPE_LABELS[t.transferType] || t.transferType,
      getTransferDirection(t) === 'sent' ? 'Envoyé' : 'Reçu',
      t.peerName || 'N/A',
      t.status,
      formatSpeed(t.avgSpeed),
      formatDuration(t.duration),
    ])

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.setAttribute('href', URL.createObjectURL(blob))
    link.setAttribute('download', `transfer-history-${new Date().toISOString()}.csv`)
    link.click()
  }

  const handleResetFilters = () => {
    setFilterStatus('ALL')
    setFilterType('ALL')
    setDateRangeStart('')
    setDateRangeEnd('')
    setPage(1)
  }

  const totalPages = Math.ceil(total / pageSize)
  const successRate = stats ? Math.round((stats.successfulTransfers / stats.totalTransfers) * 100) || 0 : 0

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Historique des Transferts</h1>
          <p className="text-slate-600">Consultez et analysez vos transferts de fichiers</p>
        </div>

        {/* Graphiques */}
        <div className="mb-8">
          <TransferCharts transfers={transfers} loading={loading} />
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total Transferts</p>
                  <p className="text-3xl font-bold text-slate-900">{stats.totalTransfers}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-500 opacity-30" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Taux de Succès</p>
                  <p className="text-3xl font-bold text-green-600">{successRate}%</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500 opacity-30" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total Transféré</p>
                  <p className="text-2xl font-bold text-slate-900">{formatFileSize(stats.totalSize)}</p>
                </div>
                <DownloadCloud className="w-8 h-8 text-purple-500 opacity-30" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Vitesse Moyenne</p>
                  <p className="text-2xl font-bold text-slate-900">{formatSpeed(stats.averageSpeed)}</p>
                </div>
                <Zap className="w-8 h-8 text-orange-500 opacity-30" />
              </div>
            </div>

            {/* Envoyés */}
            {stats.sentTransfers !== undefined && (
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-600">
                <div>
                  <p className="text-sm text-slate-600 mb-2">Envoyés</p>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-blue-600">{stats.sentTransfers}</p>
                    <p className="text-xs text-slate-500">{formatFileSize(stats.sentSize || 0)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Reçus */}
            {stats.receivedTransfers !== undefined && (
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-600">
                <div>
                  <p className="text-sm text-slate-600 mb-2">Reçus</p>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-green-600">{stats.receivedTransfers}</p>
                    <p className="text-xs text-slate-500">{formatFileSize(stats.receivedSize || 0)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtres
            </h2>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {showFilters ? 'Masquer' : 'Afficher'}
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
              {/* Statut */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Statut</label>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value)
                    setPage(1)
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ALL">Tous</option>
                  <option value="SUCCESS">✓ Succès</option>
                  <option value="FAILED">✗ Échoué</option>
                  <option value="PARTIAL">⚠ Partiel</option>
                  <option value="CANCELLED">⊘ Annulé</option>
                </select>
              </div>

              {/* Type de transfert */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
                <select
                  value={filterType}
                  onChange={(e) => {
                    setFilterType(e.target.value)
                    setPage(1)
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ALL">Tous</option>
                  <option value="P2P_DIRECT">P2P Direct</option>
                  <option value="P2P_MULTI_SOURCE">P2P Multi-Source</option>
                  <option value="PUBLIC_LINK">Lien Public</option>
                  <option value="GROUP_TRANSFER">Transfer Groupe</option>
                </select>
              </div>

              {/* Date début */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Du</label>
                <input
                  type="date"
                  value={dateRangeStart}
                  onChange={(e) => {
                    setDateRangeStart(e.target.value)
                    setPage(1)
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Date fin */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Au</label>
                <input
                  type="date"
                  value={dateRangeEnd}
                  onChange={(e) => {
                    setDateRangeEnd(e.target.value)
                    setPage(1)
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Reset */}
              <div className="flex items-end">
                <button
                  onClick={handleResetFilters}
                  className="w-full px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium transition"
                >
                  Réinitialiser
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tableau */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-slate-600">Chargement...</span>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-600">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <p>{error}</p>
            </div>
          ) : transfers.length === 0 ? (
            <div className="p-6 text-center text-slate-600">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Aucun transfert trouvé</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Fichier</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Taille</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Direction</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Pair</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Statut</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Vitesse</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Durée</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {transfers.map((transfer) => {
                      const statusColor = STATUS_COLORS[transfer.status] || STATUS_COLORS.CANCELLED
                      return (
                        <tr key={transfer.id} className="hover:bg-slate-50 transition">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {new Date(transfer.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">
                            {transfer.fileName || transfer.fileHash || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {formatFileSize(transfer.fileSizeBytes)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                              {TRANSFER_TYPE_LABELS[transfer.transferType] || transfer.transferType}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {(() => {
                              const direction = getTransferDirection(transfer)
                              const isReceived = direction === 'received'
                              return (
                                <div className="flex items-center gap-2">
                                  {isReceived ? (
                                    <>
                                      <Download className="w-4 h-4 text-green-600" />
                                      <span className="text-green-700 font-medium">Reçu</span>
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-4 h-4 text-blue-600" />
                                      <span className="text-blue-700 font-medium">Envoyé</span>
                                    </>
                                  )}
                                </div>
                              )
                            })()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {transfer.peerName || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${statusColor.bg}`}>
                              <span className={statusColor.text}>{statusColor.icon}</span>
                              <span className={`text-sm font-medium ${statusColor.text}`}>{transfer.status}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {formatSpeed(transfer.avgSpeed)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {formatDuration(transfer.duration)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">
                    Page {page} de {totalPages} • Total: {total} transferts
                  </span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setPage(1)
                    }}
                    className="ml-4 px-3 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
                  >
                    ← Précédent
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
                  >
                    Suivant →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
