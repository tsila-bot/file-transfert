// components/forms/RegisterForm/RegisterForm.tsx
"use client";

import { useAuthStore } from "@/stores/authStore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mail, Lock, User, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function RegisterForm() {
    const router = useRouter();
    const { register, error, isLoading, clearError } = useAuthStore();

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        name: '',
        agreed: false
    });

    const [showPassword, setShowPassword] = useState(false);
    const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

    const validatePassword = (password: string) => {
        const errors: string[] = [];

        if (password.length < 8) {
            errors.push('Au moins 8 caractères');
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('Une majuscule');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('Une minuscule');
        }
        if (!/[0-9]/.test(password)) {
            errors.push('Un chiffre');
        }
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Un caractère spécial');
        }

        setPasswordErrors(errors);
        return errors.length === 0;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));

        if (name === 'password') {
            validatePassword(value);
        }

        if (error) {
            clearError();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            alert('Les mots de passe ne correspondent pas');
            return;
        }

        if (!validatePassword(formData.password)) {
            return;
        }

        try {
            await register({
                email: formData.email,
                password: formData.password,
                name: formData.name,
            });
            router.push('/dashboard');
        } catch (error) {
            // L'erreur est déjà gérée dans le store
        }
    };

    return (
        <div className="w-full max-w-md space-y-8">
            {/* Title Section */}
            <div className="text-left">
                <h2 className="text-3xl font-bold text-white tracking-tight mb-2">
                    Create account
                </h2>
                <p className="text-gray-400">
                    Join your team and start collaborating securely.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2"
                    >
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </motion.div>
                )}

                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                        Full Name
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <User className="h-5 w-5 text-gray-500" />
                        </div>
                        <input
                            id="name"
                            name="name"
                            type="text"
                            required
                            className="block w-full pl-11 pr-3 py-3 border border-gray-700 rounded-lg bg-[#252937] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent transition-all"
                            placeholder="John Doe"
                            value={formData.name}
                            onChange={handleChange}
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                        Email address
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <Mail className="h-5 w-5 text-gray-500" />
                        </div>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            className="block w-full pl-11 pr-3 py-3 border border-gray-700 rounded-lg bg-[#252937] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent transition-all"
                            placeholder="name@company.com"
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                            Password
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-gray-500" />
                            </div>
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                required
                                className="block w-full pl-11 pr-10 py-3 border border-gray-700 rounded-lg bg-[#252937] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent transition-all"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={handleChange}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400 transition-colors"
                            >
                                {showPassword ? '👁️' : '👁️‍🗨️'}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                            Confirm
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-gray-500" />
                            </div>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type={showPassword ? 'text' : 'password'}
                                required
                                className="block w-full pl-11 pr-3 py-3 border border-gray-700 rounded-lg bg-[#252937] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:border-transparent transition-all"
                                placeholder="••••••••"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                </div>

                {formData.password && passwordErrors.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm"
                    >
                        <p className="text-gray-300 font-medium mb-2">Password requirements:</p>
                        <ul className="space-y-1">
                            {passwordErrors.map((err, index) => (
                                <li key={index} className="text-amber-400 flex items-center text-xs">
                                    <span className="mr-2">✗</span>
                                    {err}
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                )}

                <div className="flex items-start">
                    <div className="flex items-center h-5">
                        <input
                            id="agreed"
                            name="agreed"
                            type="checkbox"
                            required
                            className="h-4 w-4 text-[#8B5CF6] focus:ring-[#8B5CF6] bg-[#252937] border-gray-600 rounded cursor-pointer"
                            checked={formData.agreed}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="ml-3 text-sm">
                        <label htmlFor="agreed" className="font-medium text-gray-300 cursor-pointer select-none">
                            I agree to the{' '}
                            <a href="#" className="text-[#8B5CF6] hover:text-[#9D6FEF]">Terms of Service</a>
                            {' '}and{' '}
                            <a href="#" className="text-[#8B5CF6] hover:text-[#9D6FEF]">Privacy Policy</a>
                        </label>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isLoading || !formData.agreed || passwordErrors.length > 0}
                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-[#8B5CF6] hover:bg-[#7C3AED] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8B5CF6] focus:ring-offset-[#1a1d2e] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            Create account
                            <ArrowRight className="ml-2 w-4 h-4" />
                        </>
                    )}
                </button>

                <div className="mt-6 text-center text-sm">
                    <span className="text-gray-400">
                        Already have an account?{' '}
                    </span>
                    <Link
                        href="/login"
                        className="font-medium text-[#8B5CF6] hover:text-[#9D6FEF] transition-colors"
                    >
                        Sign in
                    </Link>
                </div>
            </form>
        </div>
    );
}