import { NextResponse } from "next/server";
import { dashboardAppUrl } from "@/features/pos-app/releases";

/** mandiplus.com/dashboard-app/download — the short link: straight to the newest Windows exe. */
export function GET() {
  return NextResponse.redirect(dashboardAppUrl(), { status: 302, headers: { "Cache-Control": "no-store" } });
}
