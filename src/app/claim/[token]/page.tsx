import type { Metadata } from "next";
import PublicClaimCapturePage from "@/features/claims/components/PublicClaimCapturePage";

export const metadata: Metadata = {
  title: "Claim Evidence · MandiPlus",
  robots: { index: false, follow: false },
};

export default async function ClaimCaptureLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicClaimCapturePage token={token} />;
}
