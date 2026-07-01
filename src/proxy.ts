import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next 16 "proxy" convention (formerly middleware). Refreshes the Supabase
// session and gates page routes to the allowed email.
export function proxy(request: NextRequest) {
  return updateSession(request);
}

// Gate page routes only. Exclude API (Telegram webhook must stay public), the
// login/auth routes, Next internals, and static assets.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|login|auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
