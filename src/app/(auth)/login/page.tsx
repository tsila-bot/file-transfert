// app/(auth)/login/page.tsx
'use client';

import { useState, useEffect } from 'react';
import LoginForm from '@/components/forms/LoginForm/LoginForm';

export default function LoginPage() {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1d2e]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8B5CF6] mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return <LoginForm />;
}