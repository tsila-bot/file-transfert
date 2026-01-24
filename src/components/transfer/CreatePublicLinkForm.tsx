"use client"

import React, { useState } from 'react'
import { Upload, Copy, Check, Loader2, AlertCircle, Eye, EyeOff, Calendar, Download } from 'lucide-react'
import transferLinkAPI from '@/core/services/api/transferLink.service'
import { format, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'

interface CreatePublicLinkFormProps {
  onSuccess?: () => void
}

export default function CreatePublicLinkForm({ onSuccess }: CreatePublicLinkFormProps) {
  const [step, setStep] = useState<'upload' | 'config' | 'result'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [copied, setCopied] = useState(false)

  // Configuration
  const [usePassword, setUsePassword] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [useExpiration, setUseExpiration] = useState(true)
  const [expiresIn, setExpiresIn] = useState('7')
  const [useDownloadLimit, setUseDownloadLimit] = useState(false)
  const [maxDownloads, setMaxDownloads] = useState('5')

  // Résultat
  const [createdLink, setCreatedLink] = useState<{
    id: string
    shortCode: string
    shareUrl: string
    fileName: string
    fileSize: number
    expiresAt?: string
    maxDownloads?: number
  } | null>(null)

  // Gestion du drag & drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      setFile(files[0])
      setStep('config')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (files && files.length > 0) {
      setFile(files[0])
      setStep('config')
    }
  }

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    setError('')

    try {
      // Étape 1: Uploader le fichier au serveur backend
      const formData = new FormData()
      formData.append('file', file)

      const uploadResponse = await fetch('http://localhost:4000/api/public-links/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`)
      }

      const uploadData = await uploadResponse.json()
      
      if (!uploadData.success) {
        throw new Error(uploadData.message || 'Upload failed')
      }

      // Étape 2: Créer le lien public avec l'URL du fichier uploadé
      const expiresAt = useExpiration
        ? addDays(new Date(), parseInt(expiresIn)).toISOString()
        : undefined

      const linkData = {
        fileUrl: uploadData.data.fileUrl,
        fileName: uploadData.data.fileName,
        fileSize: uploadData.data.fileSize,
        fileMimeType: uploadData.data.fileMimeType,
        password: usePassword ? password : undefined,
        expiresAt,
        maxDownloads: useDownloadLimit ? parseInt(maxDownloads) : undefined,
      }

      const link = await transferLinkAPI.createTransferLink(linkData)

      setCreatedLink({
        id: link.id,
        shortCode: link.shortCode,
        shareUrl: link.shareUrl,
        fileName: uploadData.data.fileName,
        fileSize: uploadData.data.fileSize,
        expiresAt,
        maxDownloads: useDownloadLimit ? parseInt(maxDownloads) : undefined,
      })

      setStep('result')
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
    setStep('upload')
    setFile(null)
    setCreatedLink(null)
    setPassword('')
    setError('')
    setUsePassword(false)
    setUseExpiration(true)
    setUseDownloadLimit(false)
    setExpiresIn('7')
    setMaxDownloads('5')
  }

  // STEP 1: Upload
  if (step === 'upload') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Étape 1: Sélectionner un fichier</h2>
          <p className="text-gray-600">Choisissez le fichier à partager publiquement</p>
        </div>

        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
            dragActive
              ? 'border-blue-600 bg-blue-50'
              : 'border-gray-300 bg-gray-50 hover:border-blue-400'
          }`}
        >
          <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-lg font-medium text-gray-900 mb-1">Déposer votre fichier ici</p>
          <p className="text-sm text-gray-600 mb-4">ou</p>

          <label>
            <input
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept="*/*"
            />
            <button
              type="button"
              onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Sélectionner un fichier
            </button>
          </label>
        </div>
      </div>
    )
  }

  // STEP 2: Configuration
  if (step === 'config' && file) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Étape 2: Configurer le lien</h2>
          <p className="text-gray-600">Définissez les options de sécurité et d'accès</p>
        </div>

        {/* Infos du fichier */}
        <div className="bg-linear-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
          <div className="flex items-center gap-4">
            <div className="text-4xl">📄</div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-600">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
        </div>

        {/* Erreur */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleCreateLink} className="space-y-6">
          {/* Protection par mot de passe */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="usePassword"
                checked={usePassword}
                onChange={(e) => setUsePassword(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 cursor-pointer"
              />
              <label htmlFor="usePassword" className="font-medium text-gray-900 cursor-pointer">
                🔒 Protéger par mot de passe
              </label>
            </div>

            {usePassword && (
              <div className="ml-8 p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Entrez un mot de passe..."
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-gray-900"
                    required={usePassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Expiration */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="useExpiration"
                checked={useExpiration}
                onChange={(e) => setUseExpiration(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 cursor-pointer"
              />
              <label htmlFor="useExpiration" className="font-medium text-gray-900 cursor-pointer flex items-center gap-2">
                <Calendar size={18} />
                Définir une date d'expiration
              </label>
            </div>

            {useExpiration && (
              <div className="ml-8 p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Le lien expire dans
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(e.target.value)}
                    min="1"
                    max="365"
                    className="w-20 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-gray-900"
                  />
                  <select
                    disabled
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-900"
                  >
                    <option>jours</option>
                  </select>
                  <div className="px-4 py-2 bg-blue-50 rounded-lg text-sm text-gray-600 whitespace-nowrap">
                    {format(addDays(new Date(), parseInt(expiresIn)), 'dd MMM yyyy', { locale: fr })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Limite de téléchargement */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="useDownloadLimit"
                checked={useDownloadLimit}
                onChange={(e) => setUseDownloadLimit(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 cursor-pointer"
              />
              <label htmlFor="useDownloadLimit" className="font-medium text-gray-900 cursor-pointer flex items-center gap-2">
                <Download size={18} />
                Limiter le nombre de téléchargements
              </label>
            </div>

            {useDownloadLimit && (
              <div className="ml-8 p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre maximum de téléchargements
                </label>
                <input
                  type="number"
                  value={maxDownloads}
                  onChange={(e) => setMaxDownloads(e.target.value)}
                  min="1"
                  max="100"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-gray-900"
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Création...
                </>
              ) : (
                '✨ Créer le lien'
              )}
            </button>
          </div>
        </form>
      </div>
    )
  }

  // STEP 3: Résultat
  if (step === 'result' && createdLink) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Lien créé avec succès!</h2>
          <p className="text-gray-600">Partagez ce lien pour permettre à d'autres de télécharger le fichier</p>
        </div>

        {/* Infos du lien */}
        <div className="bg-linear-to-br from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200 space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Fichier</p>
            <p className="font-semibold text-gray-900 break-all">{createdLink.fileName}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Code d'accès</p>
            <code className="bg-white px-4 py-2 rounded font-mono text-blue-600 font-bold text-lg">
              {createdLink.shortCode}
            </code>
          </div>

          {createdLink.expiresAt && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Expire le</p>
              <p className="text-gray-900">
                {format(new Date(createdLink.expiresAt), 'dd MMMM yyyy à HH:mm', { locale: fr })}
              </p>
            </div>
          )}

          {createdLink.maxDownloads && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Téléchargements maximum</p>
              <p className="text-gray-900">{createdLink.maxDownloads}</p>
            </div>
          )}
        </div>

        {/* URL du lien */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Lien public</label>
          <div className="flex gap-3">
            <div className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-gray-600 break-all">
              {createdLink.shareUrl}
            </div>
            <button
              onClick={handleCopyLink}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {copied ? (
                <>
                  <Check size={18} />
                  Copié!
                </>
              ) : (
                <>
                  <Copy size={18} />
                  Copier
                </>
              )}
            </button>
          </div>
        </div>

        {/* Actions finales */}
        <div className="flex gap-3 pt-6">
          <button
            onClick={handleReset}
            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            ➕ Créer un autre lien
          </button>
          {onSuccess && (
            <button
              onClick={() => {
                handleReset()
                onSuccess()
              }}
              className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg font-medium transition-colors"
            >
              📋 Voir mes liens
            </button>
          )}
        </div>
      </div>
    )
  }

  return null
}
