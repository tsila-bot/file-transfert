// app/(auth)/layout.tsx
'use client';

import { motion } from 'framer-motion';
import { Share2, Zap, Shield, Command } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export default function AuthLayout({
  children,
  title,
  subtitle
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen w-full flex bg-[#1a1d2e] overflow-hidden">
      {/* Left Panel - Branding & Marketing */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#8B5CF6] via-[#9D6FEF] to-[#A97FE8] relative overflow-hidden flex-col justify-between p-12 text-white">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <motion.svg
            className="w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            animate={{
              scale: [1, 1.05, 1],
              rotate: [0, 1, 0]
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear"
            }}
          >
            <path d="M0 0 L100 100 L100 0 Z" fill="currentColor" />
            <circle cx="20" cy="80" r="30" fill="currentColor" />
          </motion.svg>
        </div>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-transparent" />

        {/* Logo Area */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl" aria-label="SyncSpace logo">
            <Share2 className="w-7 h-7 text-white" aria-hidden="true" />
          </div>
          <span className="text-2xl font-bold tracking-tight">SyncSpace</span>
        </div>

        {/* Main Content */}
        <div className="relative z-10 max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-5xl font-bold mb-6 leading-tight">
              Collaborate with your team at the speed of thought.
            </h1>
            <p className="text-purple-100 text-lg mb-10 leading-relaxed">
              Secure P2P file transfer, real-time chat, and instant collaboration tools designed for modern teams.
            </p>
          </motion.div>

          {/* Feature List */}
          <div className="space-y-5">
            {[
              { icon: Zap, text: "Unlimited file size transfers" },
              { icon: Shield, text: "End-to-end encryption" },
              { icon: Command, text: "Built for power users" }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className="flex items-center gap-4 text-white"
              >
                <div className="p-2 bg-white/15 rounded-lg backdrop-blur-sm">
                  <feature.icon className="w-6 h-6" aria-hidden="true" />
                </div>
                <span className="text-base">{feature.text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between text-sm text-purple-100">
          <span>© 2025 SyncSpace Inc. All rights reserved.</span>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-[#1a1d2e]">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md space-y-8"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="p-3 bg-purple-600/20 rounded-xl">
              <Share2 className="w-8 h-8 text-[#8B5CF6]" aria-hidden="true" />
            </div>
          </div>

          {/* Title Section */}
          <div className="text-left">
            <h2 className="text-3xl font-bold text-white tracking-tight mb-2">
              {title}
            </h2>
            <p className="text-gray-400">
              {subtitle}
            </p>
          </div>

          {children}
        </motion.div>
      </div>
    </div>
  );
}