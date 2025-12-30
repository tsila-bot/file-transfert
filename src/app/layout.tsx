// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import AuthInitializer from '@/components/AuthInitializer';

export const metadata: Metadata = {
  title: 'P2P Transfer',
  description: 'Transferts de fichiers sécurisés',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <AuthInitializer />
        {children}
      </body>
    </html>
  );
}
