// frontend/src/app/public-transfer/[code]/page.tsx

"use client"

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Download, Lock, AlertCircle, Loader2, Eye, EyeOff, FileText, Calendar, Shield, CheckCircle } from 'lucide-react'
import transferLinkAPI from '@/core/services/api/transferLink.service'

interface TransferLinkData {
  id: string
  shortCode: string
  fileName: string
  fileSize: number
  fileMimeType: string
  password?: string
  expiresAt?: string
  maxDownloads?: number
  downloads: number
  createdAt: string
}

export default function PublicTransferPage() {
  const params = useParams()
  const code = (params?.code as string) || ''

  const [link, setLink] = useState<TransferLinkData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [isProtected, setIsProtected] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // Charger les infos du lien
  useEffect(() => {
    const loadLink = async () => {
      try {
        setLoading(true)
        const linkData = await transferLinkAPI.getPublicTransferInfo(code)
        setLink({
          ...linkData,
          fileSize: Number(linkData.fileSize),
          expiresAt: linkData.expiresAt
            ? new Date(linkData.expiresAt).toISOString()
            : undefined,
        } as any)
        setIsProtected(!!linkData.password)

        // Vérifier que le lien est valide
        const isValid = await transferLinkAPI.validateTransferLink(code)
        if (!isValid) {
          setError('Ce lien a expiré ou a atteint sa limite de téléchargements')
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Erreur lors du chargement du lien'
        )
      } finally {
        setLoading(false)
      }
    }

    loadLink()
  }, [code])

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerifying(true)
    setError('')

    try {
      const isValid = await transferLinkAPI.verifyTransferPassword(code, password)
      if (isValid) {
        setVerified(true)
      } else {
        setError('Mot de passe incorrect')
        setPassword('')
      }
    } catch (err) {
      setError('Erreur lors de la vérification du mot de passe')
    } finally {
      setVerifying(false)
    }
  }

  const handleDownload = async () => {
    try {
      setDownloading(true)
      window.location.href = `http://localhost:4000/api/public-links/${code}/file`
    } catch (err) {
      setError('Erreur lors du téléchargement')
    } finally {
      setTimeout(() => setDownloading(false), 2000)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('video/')) return '🎥'
    if (mimeType.startsWith('image/')) return '🖼️'
    if (mimeType.startsWith('audio/')) return '🎵'
    if (mimeType.includes('pdf')) return '📕'
    if (mimeType.includes('zip') || mimeType.includes('rar')) return '📦'
    return '📄'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg">
          <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-700 font-medium">Chargement du lien de partage...</p>
        </div>
      </div>
    )
  }

  if (error && !link) {
    return (
      <div className="min-h-screen bg-linear-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border-t-4 border-red-500">
          <div className="flex justify-center mb-6">
            <div className="bg-red-100 rounded-full p-4">
              <AlertCircle className="w-12 h-12 text-red-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-center mb-4 text-gray-900">Oups !</h1>
          <p className="text-gray-600 text-center mb-8 leading-relaxed">{error}</p>
          <a
            href="/"
            className="block w-full px-6 py-3 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-center font-semibold transition-all transform hover:scale-105 shadow-lg"
          >
            Retour à l'accueil
          </a>
        </div>
      </div>
    )
  }

  if (!link) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <p className="text-gray-600 text-lg">Lien introuvable</p>
      </div>
    )
  }

  // Si protégé par mot de passe et non vérifié
  if (isProtected && !verified) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border-t-4 border-blue-500">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-100 rounded-full p-4 animate-pulse">
              <Lock className="w-12 h-12 text-blue-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-center mb-3 text-gray-900">
            Accès sécurisé
          </h1>
          <p className="text-gray-600 text-center mb-8 leading-relaxed">
            Ce fichier est protégé. Entrez le mot de passe pour y accéder.
          </p>

          {/* Info du fichier */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 mb-6 border border-blue-100">
            <div className="flex items-center gap-3">
              <div className="text-3xl">{getFileIcon(link.fileMimeType)}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate text-sm">{link.fileName}</p>
                <p className="text-xs text-gray-600">{formatFileSize(link.fileSize)}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleVerifyPassword} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError('')
                  }}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-medium placeholder-gray-400 transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={verifying || !password.trim()}
              className="w-full px-6 py-3 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 shadow-lg"
            >
              {verifying ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Vérification en cours...
                </>
              ) : (
                <>
                  <Shield size={20} />
                  Vérifier le mot de passe
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-center text-gray-500">
              🔐 Vos données sont protégées et transférées de manière sécurisée
            </p>
          </div>
        </div>
      </div>
    )
  }

  const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date()
  const isMaxDownloadsReached = link.maxDownloads && link.downloads >= link.maxDownloads
  const canDownload = !isExpired && !isMaxDownloadsReached

  // Page de téléchargement
  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full border-t-4 border-green-500">
        {/* Header */}
        <div className="text-center mb-8">
          {verified && (
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full mb-4 font-medium">
              <CheckCircle size={18} />
              Accès autorisé
            </div>
          )}
          <h1 className="text-4xl font-bold text-gray-900 mb-3">📁 Fichier partagé</h1>
          <p className="text-gray-600">Téléchargez votre fichier en toute sécurité</p>
        </div>

        {/* Infos du fichier */}
        <div className="bg-linear-to-br from-blue-50 to-indigo-50 rounded-xl p-6 mb-6 border border-blue-100">
          <div className="flex items-start gap-4 mb-4">
            <div className="text-4xl">{getFileIcon(link.fileMimeType)}</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 break-all text-lg mb-1">{link.fileName}</p>
              <p className="text-sm font-semibold text-blue-600">{formatFileSize(link.fileSize)}</p>
            </div>
          </div>

          {/* Métadonnées */}
          <div className="space-y-2 pt-4 border-t border-blue-200">
            {isProtected && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Shield size={16} className="text-blue-600" />
                <span className="font-medium">Protégé par mot de passe</span>
              </div>
            )}
            {link.expiresAt && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Calendar size={16} className="text-indigo-600" />
                <span>Expire le <strong>{new Date(link.expiresAt).toLocaleDateString('fr-FR', { 
                  day: 'numeric', 
                  month: 'long', 
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</strong></span>
              </div>
            )}
            {link.maxDownloads && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Download size={16} className="text-purple-600" />
                <span>Téléchargements : <strong>{link.downloads} / {link.maxDownloads}</strong></span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <FileText size={16} className="text-green-600" />
              <span>Créé le <strong>{new Date(link.createdAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long', 
                year: 'numeric'
              })}</strong></span>
            </div>
          </div>
        </div>

        {/* Messages d'erreur/avertissement */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        {isMaxDownloadsReached && (
          <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg">
            <p className="text-sm text-yellow-700 font-medium">
              ⚠️ La limite de téléchargements a été atteinte
            </p>
          </div>
        )}

        {isExpired && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
            <p className="text-sm text-red-700 font-medium">❌ Ce lien a expiré</p>
          </div>
        )}

        {/* Bouton de téléchargement */}
        <button
          onClick={handleDownload}
          disabled={!canDownload || downloading}
          className="w-full px-6 py-4 bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3 shadow-xl"
        >
          {downloading ? (
            <>
              <Loader2 size={24} className="animate-spin" />
              Téléchargement en cours...
            </>
          ) : (
            <>
              <Download size={24} />
              Télécharger le fichier
            </>
          )}
        </button>

        {/* Code d'accès */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-center text-gray-500 mb-2">Code d'accès</p>
          <p className="text-center font-mono font-bold text-gray-700 text-lg tracking-wider bg-gray-100 py-2 px-4 rounded-lg">
            {code}
          </p>
        </div>

        {/* Info P2P */}
        <div className="mt-6 p-4 bg-linear-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
          <p className="text-xs text-center text-gray-700 leading-relaxed">
            <strong className="text-green-700">🔒 Transfert sécurisé P2P</strong>
            <br />
            Le fichier est transféré directement en peer-to-peer. Aucun serveur n'a accès à vos données.
          </p>
        </div>
      </div>
    </div>
  )
}