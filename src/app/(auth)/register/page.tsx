// app/(auth)/register/page.tsx
'use client';

import { useState, useEffect } from 'react';
import RegisterForm from '@/components/forms/RegisterForm/RegisterForm';

export default function RegisterPage() {
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

  return <RegisterForm />;
}