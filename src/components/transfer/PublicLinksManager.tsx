// frontend/src/components/transfer/PublicLinksManager.tsx

"use client"

import React, { useState, useEffect } from 'react'
import { Copy, Trash2, ExternalLink, Loader2, AlertCircle, Check } from 'lucide-react'
import transferLinkAPI, { TransferLink } from '@/core/services/api/transferLink.service'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function PublicLinksManager() {
  const [links, setLinks] = useState<TransferLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [deleting, setDeleting] = useState<string>('')
  const [copied, setCopied] = useState<string>('')

  // Charger les liens
  useEffect(() => {
    loadLinks()
  }, [])

  const loadLinks = async () => {
    try {
      setLoading(true)
      const result = await transferLinkAPI.getUserTransferLinks()
      setLinks(result.links)
      setError('')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erreur lors du chargement des liens'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async (url: string, linkId: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(linkId)
      setTimeout(() => setCopied(''), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleDelete = async (linkId: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce lien?')) return

    try {
      setDeleting(linkId)
      await transferLinkAPI.deleteTransferLink(linkId)
      setLinks(links.filter((l) => l.id !== linkId))
    } catch (err) {
      setError('Erreur lors de la suppression du lien')
    } finally {
      setDeleting('')
    }
  }

  const isExpired = (expiresAt?: string | Date) => {
    return expiresAt
      ? new Date(expiresAt) < new Date()
      : false
  }

  const isLimitReached = (link: TransferLink) => {
    return link.maxDownloads ? link.downloads >= link.maxDownloads : false
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">🔗 Mes liens publiques</h2>
        <button
          onClick={loadLinks}
          className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Actualiser
        </button>
      </div>

      {/* Erreur */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
          <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Liste des liens */}
      {links.length === 0 ? (
        <div className="text-center p-8 bg-gray-50 rounded-lg">
          <p className="text-gray-600">Aucun lien public créé</p>
          <p className="text-sm text-gray-500 mt-1">
            Créez un lien pour partager des fichiers publiquement
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map((link) => {
            const expired = isExpired(link.expiresAt)
            const limitReached = isLimitReached(link)

            return (
              <div
                key={link.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                {/* Infos du fichier */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {link.fileName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {(Number(link.fileSize) / 1024 / 1024).toFixed(2)} MB • Code:{' '}
                      <code className="bg-gray-100 px-1 rounded text-xs font-mono">
                        {link.shortCode}
                      </code>
                    </p>
                  </div>

                  {/* Status badges */}
                  <div className="flex gap-2 shrink-0">
                    {expired && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded font-medium">
                        Expiré
                      </span>
                    )}
                    {limitReached && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded font-medium">
                        Limite atteinte
                      </span>
                    )}
                    {link.password && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                        🔒 Protégé
                      </span>
                    )}
                  </div>
                </div>

                {/* Métadonnées */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs text-gray-600">
                  <div>
                    <span className="font-medium">Créé</span>
                    <p>{format(new Date(link.createdAt), 'dd MMM yyyy', { locale: fr })}</p>
                  </div>
                  {link.expiresAt && (
                    <div>
                      <span className="font-medium">Expire</span>
                      <p className={expired ? 'text-red-600' : ''}>
                        {format(new Date(link.expiresAt), 'dd MMM yyyy', {
                          locale: fr,
                        })}
                      </p>
                    </div>
                  )}
                  {link.maxDownloads && (
                    <div>
                      <span className="font-medium">Téléchargements</span>
                      <p className={limitReached ? 'text-red-600' : ''}>
                        {link.downloads} / {link.maxDownloads}
                      </p>
                    </div>
                  )}
                  {!link.expiresAt && !link.maxDownloads && (
                    <div>
                      <span className="font-medium">Illimité</span>
                      <p>∞</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      handleCopy(link.shareUrl, link.id)
                    }
                    className="flex-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {copied === link.id ? (
                      <>
                        <Check size={16} />
                        Copié!
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        Copier le lien
                      </>
                    )}
                  </button>

                  <a
                    href={link.shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                    title="Ouvrir dans un nouvel onglet"
                  >
                    <ExternalLink size={16} />
                  </a>

                  <button
                    onClick={() => handleDelete(link.id)}
                    disabled={deleting === link.id}
                    className="px-3 py-2 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors disabled:opacity-50"
                    title="Supprimer le lien"
                  >
                    {deleting === link.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
