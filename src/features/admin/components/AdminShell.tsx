'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('mandiplus_sidebar_collapsed');
    if (saved !== null) {
      setIsCollapsed(saved === 'true');
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('mandiplus_sidebar_collapsed', String(next));
      return next;
    });
  };

  if (
    pathname === '/admin/login' ||
    pathname === '/admin/signup' ||
    pathname === '/admin/impersonate' ||
    pathname?.startsWith('/admin/channel-partners/customer/') ||
    pathname?.startsWith('/admin/channel-partners/partner/')
  ) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar isCollapsed={isCollapsed} onToggleCollapse={toggleCollapse} />
      <div
        className={`${
          isCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        } flex flex-col flex-1 transition-all duration-300 ease-in-out`}
      >
        <AdminHeader />
        <main className="flex-1 pb-8">
          <div className="w-full px-2 sm:px-3 lg:px-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
