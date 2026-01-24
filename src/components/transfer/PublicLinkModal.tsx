// frontend/src/components/transfer/PublicLinkModal.tsx

"use client"

import React, { useState, useEffect } from 'react'
import { Copy, X, Loader2, Check, AlertCircle } from 'lucide-react'
import transferLinkAPI from '@/core/services/api/transferLink.service'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface PublicLinkModalProps {
  fileName: string
  fileSize: number
  fileMimeType: string
  onClose: () => void
  onLinkCreated?: (link: { shortCode: string; shareUrl: string }) => void
}

export default function PublicLinkModal({
  fileName,
  fileSize,
  fileMimeType,
  onClose,
  onLinkCreated,
}: PublicLinkModalProps) {
  const [step, setStep] = useState<'config' | 'result'>('config')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [copied, setCopied] = useState(false)

  // Configuration du lien
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [expiresIn, setExpiresIn] = useState('7') // 7 days
  const [maxDownloads, setMaxDownloads] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const [useExpiration, setUseExpiration] = useState(true)
  const [useDownloadLimit, setUseDownloadLimit] = useState(false)

  // Résultat du lien créé
  const [createdLink, setCreatedLink] = useState<{
    shortCode: string
    shareUrl: string
  } | null>(null)

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const expiresAt = useExpiration
        ? new Date(Date.now() + parseInt(expiresIn) * 24 * 60 * 60 * 1000).toISOString()
        : undefined

      const linkData = {
        fileUrl: '', // À remplir avec l'URL réelle du fichier lors du transfert
        fileName,
        fileSize,
        fileMimeType,
        password: usePassword ? password : undefined,
        expiresAt,
        maxDownloads: useDownloadLimit ? parseInt(maxDownloads) : undefined,
      }

      const link = await transferLinkAPI.createTransferLink(linkData)

      setCreatedLink({
        shortCode: link.shortCode,
        shareUrl: link.shareUrl,
      })

      setStep('result')
      onLinkCreated?.(link as any)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la création du lien'
      setError(message)
      console.error('Failed to create transfer link:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = async () => {
    if (!createdLink) return

    try {
      await navigator.clipboard.writeText(createdLink.shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleReset = () => {
    setStep('config')
    setCreatedLink(null)
    setPassword('')
    setError('')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            {step === 'config' ? 'Créer un lien de partage' : 'Lien créé!'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'config' ? (
            <form onSubmit={handleCreateLink} className="space-y-4">
              {/* Infos du fichier */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-gray-700">Fichier</p>
                <p className="text-sm text-gray-600 truncate">{fileName}</p>
                <p className="text-xs text-gray-500">
                  {(fileSize / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              {/* Protéger avec mot de passe */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usePassword}
                    onChange={(e) => setUsePassword(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Protéger avec mot de passe
                  </span>
                </label>

                {usePassword && (
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mot de passe"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? '🔒' : '👁️'}
                    </button>
                  </div>
                )}
              </div>

              {/* Expiration */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useExpiration}
                    onChange={(e) => setUseExpiration(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Expirer après
                  </span>
                </label>

                {useExpiration && (
                  <select
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="1">1 jour</option>
                    <option value="7">7 jours</option>
                    <option value="30">30 jours</option>
                    <option value="90">90 jours</option>
                  </select>
                )}
              </div>

              {/* Limite de téléchargement */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useDownloadLimit}
                    onChange={(e) => setUseDownloadLimit(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Limiter les téléchargements
                  </span>
                </label>

                {useDownloadLimit && (
                  <input
                    type="number"
                    value={maxDownloads}
                    onChange={(e) => setMaxDownloads(e.target.value)}
                    placeholder="Nombre maximum"
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                )}
              </div>

              {/* Erreur */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
                  <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Création...
                    </>
                  ) : (
                    'Créer le lien'
                  )}
                </button>
              </div>
            </form>
          ) : (
            // Étape résultat
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Check size={24} className="text-green-600" />
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm font-medium text-gray-700 mb-1">Lien de partage créé!</p>
                <p className="text-xs text-gray-500">
                  Partagez ce lien avec d'autres pour qu'ils accèdent au fichier
                </p>
              </div>

              {/* Afficher le lien */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 mb-2">Code court:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-white border border-gray-300 rounded px-2 py-1 text-gray-900 break-all">
                    {createdLink?.shortCode}
                  </code>
                  <button
                    onClick={handleCopyLink}
                    className="p-2 hover:bg-gray-200 rounded"
                    title="Copier"
                  >
                    {copied ? (
                      <Check size={16} className="text-green-600" />
                    ) : (
                      <Copy size={16} className="text-gray-600" />
                    )}
                  </button>
                </div>
              </div>

              {/* URL complète */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 mb-2">Lien complet:</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={createdLink?.shareUrl || ''}
                    readOnly
                    className="flex-1 text-xs bg-white border border-gray-300 rounded px-2 py-1 text-gray-900 break-all"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="p-2 hover:bg-gray-200 rounded"
                    title="Copier"
                  >
                    {copied ? (
                      <Check size={16} className="text-green-600" />
                    ) : (
                      <Copy size={16} className="text-gray-600" />
                    )}
                  </button>
                </div>
              </div>

              {/* Actions finales */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleReset}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Créer un autre
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
