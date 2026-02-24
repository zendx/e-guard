import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isMutationMethod(method: string): boolean {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

function setSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  );
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");

  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  return response;
}

function reject(message: string, status = 403): NextResponse {
  return setSecurityHeaders(
    NextResponse.json({ error: message }, { status }),
  );
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api") && isMutationMethod(request.method)) {
    const secFetchSite = request.headers.get("sec-fetch-site");
    if (secFetchSite && !["same-origin", "same-site", "none"].includes(secFetchSite)) {
      return reject("Cross-site requests are not allowed.");
    }

    const origin = request.headers.get("origin");
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");

    if (origin && host) {
      const expectedOrigin = `${protocol}://${host}`;
      if (origin !== expectedOrigin) {
        return reject("Invalid request origin.");
      }
    }
  }

  return setSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
