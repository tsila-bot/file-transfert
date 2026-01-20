'use client';

import { ReactNode } from 'react';
import { FaCloudUploadAlt, FaHistory, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

interface TransfertsPage {
  children?: ReactNode;
}

export default function TransfertPage({ children }: TransfertsPage) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Transfert de fichiers</h1>
        <p className="text-gray-600 mt-2">Transférez vos fichiers en toute sécurité via P2P</p>
      </div>

      {/* Zone de drop/upload */}
      <div className="border-4 border-dashed border-indigo-300 rounded-lg p-12 text-center bg-indigo-50 hover:bg-indigo-100 transition cursor-pointer">
        <FaCloudUploadAlt size={48} className="text-indigo-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-800 mb-2">Glissez-déposez vos fichiers ici</h3>
        <p className="text-gray-600 mb-4">ou cliquez pour sélectionner des fichiers</p>
        <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          Sélectionner des fichiers
        </button>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Transferts réussis</p>
              <p className="text-3xl font-bold text-green-600">245</p>
            </div>
            <FaCheckCircle size={32} className="text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Transferts échoués</p>
              <p className="text-3xl font-bold text-red-600">3</p>
            </div>
            <FaTimesCircle size={32} className="text-red-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Données transférées</p>
              <p className="text-3xl font-bold text-blue-600">125 GB</p>
            </div>
            <FaHistory size={32} className="text-blue-600" />
          </div>
        </div>
      </div>

      {/* Infos */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h3 className="font-bold text-green-900 mb-2">✅ Avantages du P2P</h3>
        <ul className="text-green-800 text-sm space-y-1">
          <li>✓ Transfert direct sans serveur intermédiaire</li>
          <li>✓ Chiffrement de bout en bout</li>
          <li>✓ Aucune limite de taille</li>
          <li>✓ Vitesse maximale</li>
        </ul>
      </div>
    </div>
  );
}
