import { NextResponse, type NextRequest } from "next/server";
import { apkUrl } from "@/features/pos-app/releases";

/**
 * mandiplus.com/pos-app/download — the short link to share on WhatsApp. It hands the browser
 * straight to the newest APK; `?app=daybook` gets the owner's Daybook app instead.
 */
export function GET(request: NextRequest) {
  const flavor = request.nextUrl.searchParams.get("app") === "daybook" ? "daybook" : "pos";
  return NextResponse.redirect(apkUrl(flavor), { status: 302, headers: { "Cache-Control": "no-store" } });
}
