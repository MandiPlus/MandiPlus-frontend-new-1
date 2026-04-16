import { AdminProvider } from '@/features/admin/context/AdminContext';
import AdminAccessGate from '@/features/admin/components/AdminAccessGate';

export default function WhatsAppChatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminProvider>
      <AdminAccessGate>{children}</AdminAccessGate>
    </AdminProvider>
  );
}
