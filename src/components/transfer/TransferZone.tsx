"use client"

import React, { useCallback, useState, useMemo } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import '@/core/P2P/receiveHandler'
import { getTransferManager } from '@/core/P2P/TransferManager'
import { useInitializeTransferStore, useTransferStore } from '@/stores/transferStore'
import { usePeerStore } from '@/stores/peerStore'
import ProgressBar from '@/components/transfer/ProgressBar'
import ChunkVisualization from '@/components/transfer/ChunkVisualization'

export default function TransferZone() {
	useInitializeTransferStore()

	const [, forceRerender] = useState(0)

	// Select the Map from the store (stable reference when unchanged),
	// then derive an array with useMemo to avoid returning a new array each render
	const transfersMap = useTransferStore((s) => s.transfers)
	const transfers = useMemo(() => Array.from(transfersMap.values()), [transfersMap])

	const [selectedPeer, setSelectedPeer] = useState<string | null>(null)
	const peerStore = usePeerStore()

	// Sync selectedPeer with global active selection
	React.useEffect(() => {
		const active = peerStore.activePeerIds.length > 0 ? peerStore.activePeerIds[0] : null
		setSelectedPeer(active)
	}, [peerStore.activePeerIds])
	const [password, setPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [compress, setCompress] = useState(true)

	// État pour le dialog de mot de passe
	const [passwordDialog, setPasswordDialog] = useState<{ fileId: string; peerId: string; show: boolean }>({
		fileId: '',
		peerId: '',
		show: false,
	})
	const [passwordInput, setPasswordInput] = useState('')
	const [showPasswordDialog, setShowPasswordDialog] = useState(false)
	const [passwordDialogError, setPasswordDialogError] = useState('')

	const manager = getTransferManager()
	const [connectedPeers, setConnectedPeers] = useState(() => manager.getConnectedPeers())

	React.useEffect(() => {
		const refresh = () => setConnectedPeers(manager.getConnectedPeers())
		manager.on('peer:added', refresh)
		manager.on('peer:removed', refresh)
		return () => {
			try {
				manager.off('peer:added', refresh)
				manager.off('peer:removed', refresh)
			} catch { }
		}
	}, [manager])

	const onDrop = useCallback(async (e: React.DragEvent) => {
		e.preventDefault()
		const files = Array.from(e.dataTransfer.files)
		if (files.length === 0) return
		const file = files[0]

		// Guard against directories or zero-byte entries
		if (file.size === 0) {
			console.warn('Dropped file has size 0 — it may be a directory or inaccessible file', file.name)
			alert('Fichier invalide ou vide. Veuillez sélectionner un fichier réel (non-dossier).')
			return
		}

		const targetPeer = selectedPeer ?? connectedPeers[0]?.peerId
		if (!targetPeer) {
			alert('Aucun pair connecté. Veuillez sélectionner un pair connecté.')
			return
		}

		// Check if peer's data channels are ready
		const connection = manager.getPeerConnection(targetPeer)
		if (!connection || !connection.areDataChannelsReady()) {
			alert('Connexion en cours d\'établissement. Veuillez patienter que les canaux de données soient prêts.')
			return
		}

		try {
			await manager.sendFile(file, targetPeer, {
				encrypt: true, // ✅ Chiffrement activé par défaut
				password: password || undefined,
			})
			forceRerender((v) => v + 1)
		} catch (err) {
			console.error('Failed to send file:', err)
			alert('Échec envoi fichier: ' + (err as Error).message)
		}
	}, [manager, password, selectedPeer, connectedPeers])
	const onFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		if (file.size === 0) {
			console.warn('Selected file has size 0 — ignoring', file.name)
			alert('Fichier invalide ou vide. Veuillez sélectionner un fichier réel (non-dossier).')
			e.target.value = ''
			return
		}

		const targetPeer = selectedPeer ?? connectedPeers[0]?.peerId
		if (!targetPeer) {
			alert('Aucun pair connecté. Veuillez sélectionner un pair connecté.')
			return
		}

		// Check if peer's data channels are ready
		const connection = manager.getPeerConnection(targetPeer)
		if (!connection || !connection.areDataChannelsReady()) {
			alert('Connexion en cours d\'établissement. Veuillez patienter que les canaux de données soient prêts.')
			return
		}

		try {
			await manager.sendFile(file, targetPeer, {
				encrypt: true, // ✅ Chiffrement activé par défaut
				password: password || undefined,
			})
			forceRerender((v) => v + 1)
		} catch (err) {
			console.error('Failed to send file:', err)
			alert('Échec envoi fichier: ' + (err as Error).message)
		}
	}, [manager, password, selectedPeer, connectedPeers])

	// Fonction pour accepter un transfert (avec ou sans mot de passe)
	const handleAcceptTransfer = useCallback(
		async (fileId: string, peerId: string) => {
			const transfer = transfers.find((t) => t.id === fileId)

			// Si le transfert est protégé par mot de passe, afficher le dialog
			if (transfer?.metadata?.encrypted && transfer?.metadata?.passwordProtected) {
				setPasswordDialog({ fileId, peerId, show: true })
				setPasswordInput('')
				setPasswordDialogError('')
				return
			}

			// Sinon, accepter directement
			try {
				manager.acceptTransfer(fileId, peerId)
				forceRerender((v) => v + 1)
			} catch (err) {
				console.error('Failed to accept transfer', err)
				alert('Erreur: ' + (err as Error).message)
			}
		},
		[transfers, manager]
	)

	// Fonction pour soumettre le mot de passe
	const handleSubmitPassword = useCallback(
		async (fileId: string, peerId: string, password: string) => {
			if (!password.trim()) {
				setPasswordDialogError('Veuillez entrer un mot de passe')
				return
			}

			try {
				await manager.acceptTransferWithPassword(fileId, peerId, password)
				setPasswordDialog({ fileId: '', peerId: '', show: false })
				setPasswordInput('')
				setPasswordDialogError('')
				forceRerender((v) => v + 1)
			} catch (err) {
				console.error('Failed to accept transfer with password', err)
				setPasswordDialogError('Mot de passe incorrect ou erreur de déchiffrement')
			}
		},
		[manager]
	)

	// Fonction pour fermer le dialog
	const handleClosePasswordDialog = useCallback(() => {
		setPasswordDialog({ fileId: '', peerId: '', show: false })
		setPasswordInput('')
		setPasswordDialogError('')
	}, [])

	return (
		<>
			<div className="p-4 text-black relative">
			<h2 className="text-lg font-semibold mb-2">Transfert de fichiers</h2>

			<div className="mb-3">
				<label className="block text-sm">Choisir un pair</label>
				<select
					value={selectedPeer ?? ''}
					onChange={(e) => setSelectedPeer(e.target.value || null)}
					className="border rounded p-2 w-full text-black"
				>
					<option value="">-- Sélectionner un pair --</option>
					{connectedPeers.map((p) => (
						<option key={p.peerId} value={p.peerId}>{p.peerName} ({p.peerId})</option>
					))}
				</select>
			</div>

			<div
				onDragOver={(e) => e.preventDefault()}
				onDrop={onDrop}
				className="border-dashed border-2 border-gray-300 rounded p-6 text-center mb-3"
			>
				Glisser-déposer un fichier ici ou
				<div className="mt-2">
					<input type="file" onChange={onFileInput} />
				</div>
			</div>

			<div className="flex gap-3 items-center mb-4">
				<label className="text-sm">Mot de passe (optionnel)</label>
				<div className="relative flex items-center">
					<input
						type={showPassword ? 'text' : 'password'}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className="border rounded p-2 pr-10 text-black"
					/>
					<button
						type="button"
						onClick={() => setShowPassword(!showPassword)}
						className="absolute right-3 text-gray-600 hover:text-gray-800 transition-colors"
						title={showPassword ? 'Masquer' : 'Afficher'}
					>
						{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
					</button>
				</div>
				<label className="flex items-center gap-2 ml-4">
					<input type="checkbox" checked={compress} onChange={(e) => setCompress(e.target.checked)} />
					<span className="text-sm">Compression</span>
				</label>
			</div>

			<div>
				<h3 className="font-medium mb-2">Transfers en cours</h3>
				<div className="space-y-3">
					{transfers.length === 0 && <div>Aucun transfert</div>}
					{transfers.map((t) => (
						<div key={t.id} className="border p-4 rounded-lg shadow-sm bg-white">
							<div className="flex justify-between items-start mb-3">
								<div className="flex-1">
									<div className="font-semibold text-lg">{t.fileName}</div>
									<div className="text-sm text-gray-600">
										{t.peerName} • {t.direction === 'send' ? 'Envoi' : 'Réception'} • {t.status}
									</div>
									<div className="text-xs text-gray-500 mt-1">
										{new Date(t.startedAt).toLocaleTimeString()}
										{t.completedAt && ` - ${new Date(t.completedAt).toLocaleTimeString()}`}
									</div>
								</div>
								<div className="text-right">
									<div className="text-2xl font-bold text-blue-600">{t.progress.percentage}%</div>
									<div className="text-xs text-gray-500">
										{Math.round(t.fileSize / 1024 / 1024)} MB
									</div>
								</div>
							</div>

							<ProgressBar
								percentage={t.progress.percentage}
								speed={t.progress.speed}
								eta={t.progress.eta}
								bytesReceived={t.progress.bytesReceived}
								bytesTotal={t.progress.bytesTotal}
								status={t.status}
							/>

							{/* Status-specific messages */}
							{t.status === 'failed' && t.error && (
								<div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
									❌ {t.error}
								</div>
							)}

							{t.status === 'completed' && (
								<div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
									✅ Transfert terminé avec succès
								</div>
							)}

							{/* Actions: show accept/reject when this client is the receiver and transfer is pending */}
							{t.direction === 'receive' && t.status === 'pending' && (
								<div className="mt-3 flex gap-2">
									<button
										className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
										onClick={() => handleAcceptTransfer(t.id, t.peerId)}
									>
										{t.metadata?.encrypted && t.metadata?.passwordProtected ? '🔒 Accepter' : 'Accepter'}
									</button>
									<button
										className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
										onClick={() => {
											try {
												manager.rejectTransfer(t.id, t.peerId, 'Refus manuel')
											} catch (err) {
												console.error('Failed to reject transfer', err)
											}
										}}
									>
										Refuser
									</button>
								</div>
							)}

							{/* Chunk visualization for active transfers */}
							{(t.status === 'active' || t.status === 'paused') && (
								<div className="mt-3">
									<ChunkVisualization
										received={t.progress.chunksReceived}
										total={t.progress.chunksTotal}
										status={t.status}
									/>
								</div>
							)}
						</div>
					))}
				</div>
			</div>
		</div>

		{/* Dialog pour demander le mot de passe */}
		{passwordDialog.show && (
			<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
				<div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
					<h3 className="text-lg font-semibold mb-4 text-gray-900">🔒 Fichier protégé par mot de passe</h3>

					<p className="text-gray-600 mb-4 text-sm">
						Ce fichier est chiffré avec un mot de passe. Veuillez entrer le mot de passe pour le recevoir.
					</p>

					{passwordDialogError && (
						<div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
							❌ {passwordDialogError}
						</div>
					)}

					<div className="relative flex items-center mb-2">
						<input
							type={showPasswordDialog ? 'text' : 'password'}
							placeholder="Entrez le mot de passe..."
							value={passwordInput}
							onChange={(e) => {
								setPasswordInput(e.target.value)
								setPasswordDialogError('')
							}}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									handleSubmitPassword(passwordDialog.fileId, passwordDialog.peerId, passwordInput)
								}
							}}
							className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
							autoFocus
						/>
						<button
							type="button"
							onClick={() => setShowPasswordDialog(!showPasswordDialog)}
							className="absolute right-3 text-gray-600 hover:text-gray-800 transition-colors"
							title={showPasswordDialog ? 'Masquer' : 'Afficher'}
						>
							{showPasswordDialog ? <EyeOff size={18} /> : <Eye size={18} />}
						</button>
					</div>

					<div className="flex gap-3 justify-end">
						<button
							onClick={handleClosePasswordDialog}
							className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
						>
							Annuler
						</button>
						<button
							onClick={() => handleSubmitPassword(passwordDialog.fileId, passwordDialog.peerId, passwordInput)}
							className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
						>
							Accepter
						</button>
					</div>
				</div>
			</div>
		)}
		</>
	)
}
