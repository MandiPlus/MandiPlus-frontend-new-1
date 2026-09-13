'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAdmin } from '@/features/admin/context/AdminContext';
import { getFirstAllowedAdminPath } from '@/features/admin/access';
import AdminLoginForm from '@/features/admin/components/AdminLoginForm';

function LoginPageContent() {
  const { isAuthenticated, accessProfile } = useAdmin();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || undefined;

  useEffect(() => {
    if (isAuthenticated) {
      if (redirectTarget) {
        router.replace(redirectTarget);
      } else if (accessProfile) {
        router.replace(getFirstAllowedAdminPath(accessProfile));
      } else {
        router.replace('/admin/dashboard');
      }
    }
  }, [accessProfile, isAuthenticated, redirectTarget, router]);

  if (isAuthenticated) {
    return null;
  }

  return (
    <AdminLoginForm
      title="Admin Sign in"
      defaultRedirect={redirectTarget}
      showBackToHome={true}
      showSignupLink={true}
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
