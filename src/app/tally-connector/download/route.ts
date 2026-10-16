import { NextResponse } from "next/server";
import { tallyConnectorUrl } from "@/features/pos-app/releases";

/** mandiplus.com/tally-connector/download — the short link: straight to the newest connector zip. */
export function GET() {
  return NextResponse.redirect(tallyConnectorUrl(), { status: 302, headers: { "Cache-Control": "no-store" } });
}
