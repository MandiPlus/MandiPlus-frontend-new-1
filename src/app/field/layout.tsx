import ProtectedRoute from '@/features/auth/components/ProtectedRoute';
import FieldShell from '@/features/field/components/FieldShell';

export default function FieldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <FieldShell>{children}</FieldShell>
    </ProtectedRoute>
  );
}
