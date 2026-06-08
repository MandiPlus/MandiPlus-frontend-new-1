'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/features/admin/context/AdminContext';
import { adminApi } from '@/features/admin/api/admin.api';
import Link from 'next/link';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [resetMode, setResetMode] = useState(false);
    const [resetStep, setResetStep] = useState<'REQUEST' | 'CONFIRM'>('REQUEST');
    const [resetUsername, setResetUsername] = useState('');
    const [resetOtp, setResetOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetMessage, setResetMessage] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const { login, isAuthenticated } = useAdmin();
    const router = useRouter();

    // --- FIX: Wrap redirect in useEffect ---
    useEffect(() => {
        if (isAuthenticated) {
            router.replace('/admin/dashboard'); // Use replace to prevent "back" button loops
        }
    }, [isAuthenticated, router]);

    // Prevent flashing the login form if already redirecting
    if (isAuthenticated) {
        return null;
    }
    // ---------------------------------------

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Please enter both email and password');
            return;
        }

        setIsLoading(true);
        try {
            await login(email, password);
        } catch (err: any) {
            setError(err?.message || 'Invalid username or password');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRequestResetOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setResetMessage('');
        const username = (resetUsername || email).trim();
        if (!username) {
            setError('Please enter your username');
            return;
        }

        setResetLoading(true);
        try {
            const response = await adminApi.requestAdminPasswordResetOtp(username);
            if (!response.success) {
                throw new Error(response.message || 'Failed to send OTP');
            }
            setResetUsername(username);
            setResetStep('CONFIRM');
            setResetMessage(
                response.data?.maskedMobileNumber
                    ? `OTP sent to ${response.data.maskedMobileNumber}`
                    : 'OTP sent to your registered mobile number',
            );
        } catch (err: any) {
            setError(err?.message || 'Failed to send OTP');
        } finally {
            setResetLoading(false);
        }
    };

    const handleConfirmReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setResetMessage('');

        if (!resetOtp.trim()) {
            setError('Please enter OTP');
            return;
        }
        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setResetLoading(true);
        try {
            const response = await adminApi.resetAdminPassword({
                username: resetUsername.trim(),
                otp: resetOtp.trim(),
                newPassword,
            });
            if (!response.success) {
                throw new Error(response.message || 'Failed to reset password');
            }
            setPassword('');
            setEmail(resetUsername.trim());
            setResetMode(false);
            setResetStep('REQUEST');
            setResetOtp('');
            setNewPassword('');
            setConfirmPassword('');
            setResetMessage('');
            setError('');
        } catch (err: any) {
            setError(err?.message || 'Failed to reset password');
        } finally {
            setResetLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Admin Sign in
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Or{' '}
                        <Link href="/" className="font-medium text-green-600 hover:text-green-500">
                            return to home page
                        </Link>
                    </p>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Need limited dashboard access?{' '}
                        <Link href="/admin/signup" className="font-medium text-green-600 hover:text-green-500">
                            Request an account
                        </Link>
                    </p>
                </div>
                <div className="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    {error && (
                        <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
                            <div className="flex">
                                <div className="shrink-0">
                                    <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {!resetMode ? (
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Username</label>
                            <div className="mt-1">
                                <input
                                    id="email"
                                    name="email"
                                    type="text"
                                    autoComplete="username"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                            <div className="mt-1">
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${isLoading ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
                            >
                                {isLoading ? 'Signing in...' : 'Sign in'}
                            </button>
                        </div>
                        <div className="text-center">
                            <button
                                type="button"
                                onClick={() => {
                                    setResetMode(true);
                                    setResetUsername(email);
                                    setError('');
                                    setResetMessage('');
                                }}
                                className="text-sm font-medium text-green-700 hover:text-green-800"
                            >
                                Forgot password?
                            </button>
                        </div>
                    </form>
                    ) : (
                    <form
                        className="space-y-6"
                        onSubmit={
                            resetStep === 'REQUEST'
                                ? handleRequestResetOtp
                                : handleConfirmReset
                        }
                    >
                        {resetMessage ? (
                            <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
                                {resetMessage}
                            </div>
                        ) : null}

                        <div>
                            <label htmlFor="resetUsername" className="block text-sm font-medium text-gray-700">Username</label>
                            <div className="mt-1">
                                <input
                                    id="resetUsername"
                                    name="resetUsername"
                                    type="text"
                                    autoComplete="username"
                                    required
                                    value={resetUsername}
                                    onChange={(e) => setResetUsername(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                    disabled={resetLoading || resetStep === 'CONFIRM'}
                                />
                            </div>
                        </div>

                        {resetStep === 'CONFIRM' ? (
                            <>
                                <div>
                                    <label htmlFor="resetOtp" className="block text-sm font-medium text-gray-700">OTP</label>
                                    <div className="mt-1">
                                        <input
                                            id="resetOtp"
                                            name="resetOtp"
                                            type="text"
                                            inputMode="numeric"
                                            required
                                            value={resetOtp}
                                            onChange={(e) => setResetOtp(e.target.value)}
                                            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                            disabled={resetLoading}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">New Password</label>
                                    <div className="mt-1">
                                        <input
                                            id="newPassword"
                                            name="newPassword"
                                            type="password"
                                            autoComplete="new-password"
                                            required
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                            disabled={resetLoading}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirm Password</label>
                                    <div className="mt-1">
                                        <input
                                            id="confirmPassword"
                                            name="confirmPassword"
                                            type="password"
                                            autoComplete="new-password"
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                            disabled={resetLoading}
                                        />
                                    </div>
                                </div>
                            </>
                        ) : null}

                        <div>
                            <button
                                type="submit"
                                disabled={resetLoading}
                                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${resetLoading ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
                            >
                                {resetLoading
                                    ? 'Please wait...'
                                    : resetStep === 'REQUEST'
                                        ? 'Send OTP'
                                        : 'Reset password'}
                            </button>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            {resetStep === 'CONFIRM' ? (
                                <button
                                    type="button"
                                    onClick={handleRequestResetOtp}
                                    disabled={resetLoading}
                                    className="font-medium text-green-700 hover:text-green-800 disabled:opacity-60"
                                >
                                    Resend OTP
                                </button>
                            ) : <span />}
                            <button
                                type="button"
                                onClick={() => {
                                    setResetMode(false);
                                    setResetStep('REQUEST');
                                    setError('');
                                    setResetMessage('');
                                }}
                                className="font-medium text-gray-600 hover:text-gray-800"
                            >
                                Back to sign in
                            </button>
                        </div>
                    </form>
                    )}
                </div>
            </div>
        </div>
    );
}
