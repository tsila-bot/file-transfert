'use client';

import { FaChartLine, FaArrowUp, FaArrowDown, FaFileAlt, FaUsers, FaClock } from 'react-icons/fa';

export default function HomePage() {
  const stats = [
    {
      title: 'Fichiers transférés',
      value: '156',
      icon: FaFileAlt,
      color: 'bg-blue-100',
      textColor: 'text-blue-600',
    },
    {
      title: 'Fichiers reçus',
      value: '89',
      icon: FaArrowDown,
      color: 'bg-green-100',
      textColor: 'text-green-600',
    },
    {
      title: 'Utilisateurs connectés',
      value: '34',
      icon: FaUsers,
      color: 'bg-purple-100',
      textColor: 'text-purple-600',
    },
  ];

  const recentActivities = [
    {
      id: 1,
      action: 'Fichier transféré',
      description: 'document.pdf envoyé à John Doe',
      time: 'Il y a 2h',
      icon: FaArrowUp,
      color: 'text-blue-500',
    },
    {
      id: 2,
      action: 'Fichier reçu',
      description: 'photo.jpg reçu de Jane Smith',
      time: 'Il y a 4h',
      icon: FaArrowDown,
      color: 'text-green-500',
    },
    {
      id: 3,
      action: 'Transfert échoué',
      description: 'video.mp4 transfert interrompu',
      time: 'Il y a 6h',
      icon: FaClock,
      color: 'text-red-500',
    },
  ];

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div>
        <h1 className="text-4xl font-bold text-gray-800">Bienvenue! 👋</h1>
        <p className="text-gray-600 mt-2 text-lg">
          Transférez vos fichiers de manière sécurisée et rapide en P2P
        </p>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-800 mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-4 rounded-lg`}>
                  <Icon size={28} className={stat.textColor} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grille principale */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activité récente */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Activité récente</h2>
          <div className="space-y-4">
            {recentActivities.map((activity) => {
              const Icon = activity.icon;
              return (
                <div
                  key={activity.id}
                  className="flex items-center justify-between py-4 border-b last:border-b-0"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg bg-gray-100`}>
                      <Icon size={20} className={activity.color} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{activity.action}</p>
                      <p className="text-sm text-gray-600">{activity.description}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{activity.time}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section d'informations */}
        <div className="space-y-6">
          {/* Conseil */}
          <div className="bg-indigo-50 border-l-4 border-indigo-600 rounded-lg p-6">
            <h3 className="font-bold text-indigo-900 mb-2">💡 Conseil</h3>
            <p className="text-indigo-800 text-sm">
              Utilisez le P2P pour envoyer des fichiers volumineux. Vos données ne transitent jamais
              par nos serveurs.
            </p>
          </div>

          {/* Espace de stockage */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="font-bold text-gray-800 mb-4">Espace de stockage</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Utilisé</span>
                <span className="font-semibold">2.5 GB / 10 GB</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-indigo-600 h-3 rounded-full" style={{ width: '25%' }}></div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <button className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold transition">
            ➕ Nouveau transfert
          </button>
        </div>
      </div>

      {/* Section fonctionnalités */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-blue-900 mb-2">🔒 Sécurisé</h3>
          <p className="text-blue-800 text-sm">
            Chiffrement de bout en bout pour tous vos fichiers
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-bold text-green-900 mb-2">⚡ Rapide</h3>
          <p className="text-green-800 text-sm">Transfert direct P2P sans limitation de vitesse</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h3 className="font-bold text-purple-900 mb-2">♾️ Sans limite</h3>
          <p className="text-purple-800 text-sm">Transférez des fichiers de taille illimitée</p>
        </div>
      </div>
    </div>
  );
}
