import { AdminProvider } from '@/features/admin/context/AdminContext';
import AdminAccessGate from '@/features/admin/components/AdminAccessGate';
import { WhatsAppCallHandler } from '@/features/admin/components/WhatsAppCallHandler';

export default function WhatsAppChatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminProvider>
      <AdminAccessGate>
        {children}
        <WhatsAppCallHandler />
      </AdminAccessGate>
    </AdminProvider>
  );
}
