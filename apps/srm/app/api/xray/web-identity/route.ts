import { supplierWebIdentityHandler } from "../../../../src/server/supplier-web-identity";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return supplierWebIdentityHandler(request); }
