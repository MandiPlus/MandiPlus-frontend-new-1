import { AdminProvider } from '@/features/admin/context/AdminContext';
import AdminSidebar from '@/features/admin/components/AdminSidebar';
import AdminHeader from '@/features/admin/components/AdminHeader';
import { Toaster } from 'react-hot-toast';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AdminProvider>
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
                <Toaster position="top-right" />
            </div>
        </AdminProvider>
    );
}
