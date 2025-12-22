// app/page.tsx
'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 px-4">
      <div className="max-w-xl w-full bg-white rounded-xl shadow-lg p-8 text-center space-y-6">
        <h1 className="text-4xl font-bold text-gray-800">
          Bienvenue sur <span className="text-blue-600">P2P Transfer</span>
        </h1>

        <p className="text-gray-600">
          Transférez vos fichiers de manière rapide, sécurisée et sans limite.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
          {/* Bouton Connexion */}
          <Link
            href="/login"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition"
          >
            Se connecter
          </Link>

          {/* Bouton Inscription */}
          <Link
            href="/register"
            className="border border-blue-600 text-blue-600 hover:bg-blue-50 font-medium py-3 px-6 rounded-lg transition"
          >
            Créer un compte
          </Link>
        </div>

        {/* Accès invité */}
        <div className="pt-4 border-t text-sm">
          <Link
            href="/guest"
            className="text-gray-600 hover:text-gray-800"
          >
            Continuer en tant qu’invité →
          </Link>
        </div>
      </div>
    </main>
  );
}
