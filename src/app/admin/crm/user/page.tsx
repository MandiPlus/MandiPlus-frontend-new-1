"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function AdminCrmUserRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    router.replace("/crm/user?" + searchParams.toString());
  }, [router, searchParams]);

  return (
    <div className="p-6 text-sm text-gray-500 flex items-center justify-center">
      Redirecting to CRM user detail...
    </div>
  );
}

export default function AdminCrmUserRedirect() {
  return (
    <Suspense fallback={null}>
      <AdminCrmUserRedirectContent />
    </Suspense>
  );
}
