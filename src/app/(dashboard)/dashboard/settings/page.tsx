'use client';

import { FaCog, FaBell, FaLock, FaPalette, FaUser, FaDatabase } from 'react-icons/fa';
import { useState } from 'react';

export default function SettingsPage() {
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false,
  });

  const sections = [
    {
      icon: FaUser,
      title: 'Profil',
      description: 'Gérez vos informations personnelles',
      items: [
        { label: 'Nom complet', value: 'Jean Dupont' },
        { label: 'Email', value: 'jean.dupont@example.com' },
        { label: 'Téléphone', value: '+33 6 12 34 56 78' },
      ],
    },
    {
      icon: FaLock,
      title: 'Sécurité',
      description: 'Gérez votre sécurité et vos mots de passe',
      items: [
        { label: 'Mot de passe', value: '••••••••', action: 'Modifier' },
        { label: 'Authentification 2FA', value: 'Activée', action: 'Gérer' },
      ],
    },
    {
      icon: FaBell,
      title: 'Notifications',
      description: 'Configurez vos préférences de notification',
      toggles: [
        { label: 'Notifications par email', key: 'email' },
        { label: 'Notifications push', key: 'push' },
        { label: 'Notifications SMS', key: 'sms' },
      ],
    },
    {
      icon: FaPalette,
      title: 'Apparence',
      description: "Personnalisez l'apparence de l'application",
      options: [
        { label: 'Thème', value: 'Clair', options: ['Clair', 'Sombre', 'Auto'] },
        { label: 'Langue', value: 'Français', options: ['Français', 'English', 'Español'] },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Paramètres</h1>
        <p className="text-gray-600 mt-2">Configurez votre compte et vos préférences</p>
      </div>

      {/* Sections de paramètres */}
      <div className="space-y-6">
        {sections.map((section, i) => {
          const Icon = section.icon;
          return (
            <div key={i} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="flex items-center gap-4 px-6 py-4 bg-gray-50 border-b">
                <Icon size={24} className="text-indigo-600" />
                <div>
                  <h3 className="font-bold text-gray-800">{section.title}</h3>
                  <p className="text-sm text-gray-600">{section.description}</p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* Champs simples */}
                {section.items &&
                  section.items.map((item, j) => (
                    <div
                      key={j}
                      className="flex items-center justify-between py-3 border-b last:border-b-0"
                    >
                      <span className="text-gray-700 font-medium">{item.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-600">{item.value}</span>
                        {/* {item.action && (
                          <button className="px-4 py-1 text-indigo-600 hover:bg-indigo-50 rounded font-medium text-sm">
                            {item.action}
                          </button>
                        )} */}
                      </div>
                    </div>
                  ))}

                {/* Toggles */}
                {section.toggles &&
                  section.toggles.map((toggle, j) => (
                    <div
                      key={j}
                      className="flex items-center justify-between py-3 border-b last:border-b-0"
                    >
                      <span className="text-gray-700 font-medium">{toggle.label}</span>
                      <button
                        onClick={() =>
                          setNotifications({
                            ...notifications,
                            [toggle.key]: !notifications[toggle.key as keyof typeof notifications],
                          })
                        }
                        className={`w-12 h-6 rounded-full transition ${
                          notifications[toggle.key as keyof typeof notifications]
                            ? 'bg-indigo-600'
                            : 'bg-gray-300'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full transition-transform ${
                            notifications[toggle.key as keyof typeof notifications]
                              ? 'translate-x-6'
                              : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  ))}

                {/* Selecteurs */}
                {section.options &&
                  section.options.map((option, j) => (
                    <div key={j} className="py-3 border-b last:border-b-0">
                      <label className="block text-gray-700 font-medium mb-2">{option.label}</label>
                      <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        {option.options.map((opt) => (
                          <option key={opt} selected={opt === option.value}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stockage */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-4 mb-4">
          <FaDatabase size={24} className="text-indigo-600" />
          <h3 className="font-bold text-gray-800">Espace de stockage</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between mb-2">
              <span className="text-gray-700 font-medium">Utilisé : 2.5 GB / 10 GB</span>
              <span className="text-gray-600">25%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="bg-indigo-500 h-3 rounded-full" style={{ width: '25%' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
        <h3 className="font-bold text-red-900 mb-4">Zone dangereuse</h3>
        <button className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
          Supprimer mon compte
        </button>
      </div>
    </div>
  );
}
