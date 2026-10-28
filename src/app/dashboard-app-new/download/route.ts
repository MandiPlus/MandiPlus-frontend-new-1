import { NextResponse } from "next/server";
import { dashboardAppNewUrl } from "@/features/pos-app/releases";

/** mandiplus.com/dashboard-app-new/download — straight to the newest MandiPlus Dashboard New exe. */
export function GET() {
  return NextResponse.redirect(dashboardAppNewUrl(), { status: 302, headers: { "Cache-Control": "no-store" } });
}
