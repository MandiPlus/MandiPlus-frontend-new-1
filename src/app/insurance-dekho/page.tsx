import { Suspense } from "react";

import CustomerPapersPage from "@/features/customer-app/CustomerPapersPage";

export default function InsuranceDekhoPage() {
  return (
    <Suspense fallback={null}>
      <CustomerPapersPage defaultTab="policy" />
    </Suspense>
  );
}
