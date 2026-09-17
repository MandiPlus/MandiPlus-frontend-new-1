import type { Metadata } from "next";
import PublicClaimDocumentsPage from "@/features/claims/components/PublicClaimDocumentsPage";

export const metadata: Metadata = {
  title: "Claim Documents · MandiPlus",
  description: "Securely upload documents for your MandiPlus claim.",
  robots: { index: false, follow: false },
};

export default async function ClaimDocumentsLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicClaimDocumentsPage token={token} />;
}
