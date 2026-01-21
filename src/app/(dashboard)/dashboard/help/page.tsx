'use client';

import { FaQuestionCircle, FaBook, FaHeadset, FaBug, FaLightbulb } from 'react-icons/fa';

export default function HelpPage() {
  const faqs = [
    {
      question: 'Comment fonctionne le transfert P2P ?',
      answer:
        'Le transfert P2P établit une connexion directe entre deux utilisateurs. Les fichiers ne passent jamais par nos serveurs, ce qui garantit une sécurité maximale.',
    },
    {
      question: 'Quelle est la taille maximale de fichier ?',
      answer:
        "Il n'y a pas de limite de taille. Vous pouvez transférer des fichiers de n'importe quelle taille tant que vous avez une connexion internet stable.",
    },
    {
      question: 'Comment garantissez-vous la sécurité des fichiers ?',
      answer:
        'Nous utilisons le chiffrement de bout en bout (E2E). Seul le destinataire peut décrypter les fichiers reçus.',
    },
    {
      question: 'Puis-je annuler un transfert en cours ?',
      answer:
        'Oui, vous pouvez annuler un transfert à tout moment en cliquant sur le bouton "Annuler" dans la barre de progression.',
    },
  ];

  const resources = [
    {
      icon: FaBook,
      title: 'Guide complet',
      description:
        'Consultez notre guide détaillé pour apprendre à utiliser tous les fonctionnalités',
    },
    {
      icon: FaHeadset,
      title: 'Support client',
      description: 'Contactez notre équipe de support disponible 24/7',
    },
    {
      icon: FaBug,
      title: 'Signaler un bug',
      description: 'Aidez-nous à améliorer en signalant les problèmes',
    },
    {
      icon: FaLightbulb,
      title: 'Suggestions',
      description: 'Partagez vos idées pour améliorer le service',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Aide & Support</h1>
        <p className="text-gray-600 mt-2">Trouvez les réponses à vos questions</p>
      </div>

      {/* Ressources */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {resources.map((resource, i) => {
          const Icon = resource.icon;
          return (
            <div
              key={i}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer"
            >
              <Icon size={32} className="text-indigo-600 mb-3" />
              <h3 className="font-bold text-gray-800 mb-2">{resource.title}</h3>
              <p className="text-sm text-gray-600">{resource.description}</p>
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <FaQuestionCircle /> Questions fréquemment posées
        </h2>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <details
              key={i}
              className="group border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition cursor-pointer"
            >
              <summary className="font-semibold text-gray-800 flex items-center justify-between">
                {faq.question}
                <span className="text-indigo-600 group-open:rotate-180 transition">▼</span>
              </summary>
              <p className="text-gray-600 mt-3 text-sm">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>

      {/* Formulaire de contact */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-indigo-900 mb-4">Contactez-nous</h3>
        <div className="flex gap-4">
          <input
            type="email"
            placeholder="Votre email"
            className="flex-1 px-4 py-2 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
