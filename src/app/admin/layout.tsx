import { AdminProvider } from '@/features/admin/context/AdminContext';
import AdminAccessGate from '@/features/admin/components/AdminAccessGate';
import AdminShell from '@/features/admin/components/AdminShell';
import { WhatsAppCallHandler } from '@/features/admin/components/WhatsAppCallHandler';
import { Toaster } from 'react-hot-toast';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AdminProvider>
            <AdminAccessGate>
                <AdminShell>
                    <Toaster position="top-right" />
                    {children}
                </AdminShell>
                <WhatsAppCallHandler />
            </AdminAccessGate>
        </AdminProvider>
    );
}
