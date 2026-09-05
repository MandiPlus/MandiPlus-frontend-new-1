'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Loader from '@/shared/components/Loader';
import { useAdmin } from '../context/AdminContext';
import AdminLoginForm from './AdminLoginForm';
import {
  getFirstAllowedAdminPath,
  getSectionForAdminPath,
} from '../access';

export default function AdminAccessGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, loading, accessProfile, canAccessSection } = useAdmin();

  const isCrmRoute = pathname === '/crm' || pathname.startsWith('/crm/');

  useEffect(() => {
    if (loading) return;

    if (pathname === '/admin/impersonate') {
      return;
    }

    if (pathname === '/admin/login' || pathname === '/admin/signup') {
      if (isAuthenticated && accessProfile) {
        router.replace(getFirstAllowedAdminPath(accessProfile));
      }
      return;
    }

    // On CRM routes, we render the login page in-place when not authenticated
    if (!isAuthenticated) {
      if (!isCrmRoute) {
        const redirectUrl = pathname ? `/admin/login?redirect=${encodeURIComponent(pathname)}` : '/admin/login';
        router.replace(redirectUrl);
      }
      return;
    }

    const section = getSectionForAdminPath(pathname);
    if (section && !canAccessSection(section)) {
      router.replace(getFirstAllowedAdminPath(accessProfile));
    }
  }, [accessProfile, canAccessSection, isAuthenticated, isCrmRoute, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size={50} color="border-purple-700" />
      </div>
    );
  }

  // Show in-place login form on /crm when not logged in
  if (isCrmRoute && !isAuthenticated) {
    return (
      <AdminLoginForm
        title="MandiPlus CRM Sign in"
        subtitle="Sign in to access the CRM portal"
        defaultRedirect={pathname}
      />
    );
  }

  if (
    pathname !== '/admin/login' &&
    pathname !== '/admin/signup' &&
    pathname !== '/admin/impersonate' &&
    !isAuthenticated
  ) {
    return null;
  }

  const section = getSectionForAdminPath(pathname);
  if (
    pathname !== '/admin/login' &&
    pathname !== '/admin/signup' &&
    pathname !== '/admin/impersonate' &&
    section &&
    !canAccessSection(section)
  ) {
    return null;
  }

  return <>{children}</>;
}
