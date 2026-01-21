'use client';

import { FaFileAlt, FaCalendar, FaTrash, FaDownload, FaUndo } from 'react-icons/fa';

export default function ArchivedFilesPage() {
  const archivedFiles = [
    { id: 1, name: 'vieux_document.pdf', size: '1.5 MB', date: '2023-12-15' },
    { id: 2, name: 'ancien_projet.docx', size: '0.8 MB', date: '2023-11-20' },
    { id: 3, name: 'archive_2023.zip', size: '156 MB', date: '2023-10-10' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Fichiers archivés</h1>
        <p className="text-gray-600 mt-2">Fichiers archivés que vous pouvez restaurer</p>
      </div>

      {/* Tableau des fichiers archivés */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Fichier</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Taille</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Archivé le
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {archivedFiles.map((file) => (
              <tr key={file.id} className="hover:bg-gray-50 transition opacity-75">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <FaFileAlt className="text-gray-400" />
                    <span className="font-medium text-gray-600">{file.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600">{file.size}</td>
                <td className="px-6 py-4 text-gray-600 flex items-center gap-2">
                  <FaCalendar size={14} /> {file.date}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      title="Restaurer"
                    >
                      <FaUndo />
                    </button>
                    <button className="p-2 text-red-600 hover:bg-red-50 rounded" title="Supprimer">
                      <FaTrash />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
