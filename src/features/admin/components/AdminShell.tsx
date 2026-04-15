'use client';

import { usePathname } from 'next/navigation';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === '/admin/login' || pathname === '/admin/signup') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />
      <div className="lg:pl-64 flex flex-col flex-1">
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
