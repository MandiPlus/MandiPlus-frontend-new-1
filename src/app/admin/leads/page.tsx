"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminLeadsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/leads");
  }, [router]);

  return (
    <div className="p-6 text-sm text-gray-500 flex items-center justify-center">
      Redirecting to MandiPlus Leads...
    </div>
  );
}
