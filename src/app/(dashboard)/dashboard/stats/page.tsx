'use client';

import { FaChartBar, FaChartPie, FaCalendar } from 'react-icons/fa';

export default function StatsPage() {
  const stats = [
    { label: 'Fichiers transférés', value: '156', trend: '+12% ce mois' },
    { label: 'Données transférées', value: '125 GB', trend: '+8% ce mois' },
    { label: 'Utilisateurs connectés', value: '34', trend: '+5 cette semaine' },
    { label: 'Transferts réussis', value: '98%', trend: '+2% ce mois' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Statistiques</h1>
        <p className="text-gray-600 mt-2">Analysez votre activité de transfert</p>
      </div>

      {/* Sélecteur de période */}
      <div className="flex items-center gap-4">
        <span className="text-gray-700 font-medium">Période :</span>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">
          <FaCalendar /> 7 derniers jours
        </button>
        <button className="px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50">
          30 derniers jours
        </button>
        <button className="px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50">
          Cette année
        </button>
      </div>

      {/* Grille de statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm font-medium">{stat.label}</p>
            <p className="text-3xl font-bold text-gray-800 mt-2">{stat.value}</p>
            <p className="text-sm text-green-600 mt-2">{stat.trend}</p>
          </div>
        ))}
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <FaChartBar size={24} className="text-indigo-600" />
            <h3 className="text-lg font-bold text-gray-800">Transferts par jour</h3>
          </div>
          <div className="h-64 flex items-end justify-center gap-2">
            {[40, 60, 45, 70, 55, 80, 65].map((height, i) => (
              <div
                key={i}
                className="w-8 bg-indigo-500 rounded-t"
                style={{ height: `${height}%` }}
              ></div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <FaChartPie size={24} className="text-indigo-600" />
            <h3 className="text-lg font-bold text-gray-800">Type de fichiers</h3>
          </div>
          <div className="space-y-3">
            {[
              { name: 'Documents', percent: 45, color: 'bg-blue-500' },
              { name: 'Images', percent: 30, color: 'bg-purple-500' },
              { name: 'Vidéos', percent: 15, color: 'bg-green-500' },
              { name: 'Autres', percent: 10, color: 'bg-gray-500' },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-700 font-medium">{item.name}</span>
                  <span className="text-gray-600">{item.percent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`${item.color} h-2 rounded-full`}
                    style={{ width: `${item.percent}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
