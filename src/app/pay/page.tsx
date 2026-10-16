import { Suspense } from "react";

import CustomerPapersPage from "@/features/customer-app/CustomerPapersPage";

export default function PayPage() {
  return (
    <Suspense fallback={null}>
      <CustomerPapersPage defaultTab="pending" />
    </Suspense>
  );
}
