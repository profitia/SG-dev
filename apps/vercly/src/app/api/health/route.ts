import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "vercly-app",
    description: "internal company verification dashboard",
    timestamp: new Date().toISOString(),
  });
}