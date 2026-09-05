import { Suspense } from "react";

import CustomerProfilePage from "@/features/customer-app/CustomerProfilePage";

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <CustomerProfilePage />
    </Suspense>
  );
}
