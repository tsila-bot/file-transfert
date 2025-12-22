// app/(dashboard)/dashboard/page.tsx

'use client';

import { PeerManager } from '@/components/peers/PeerManager';
import { PeerList } from '@/components/peers/PeerList';

export default function DashboardPage() {
    return (
        <div className="p-6">
            {/* Gestionnaire de peers (invisible) */}
            <PeerManager />

            <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Liste des pairs en ligne */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg shadow p-4">
                        <h2 className="text-xl font-semibold mb-4">Utilisateurs en ligne</h2>
                        <PeerList />
                    </div>
                </div>

                {/* Zone principale */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold mb-4">Zone de transfert</h2>
                        {/* TODO: Composant de transfert */}
                    </div>
                </div>
            </div>
        </div>
    );
}