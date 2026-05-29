import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16 renamed Middleware → Proxy. next-intl's middleware factory works
// unchanged as the default export here (runs on the Node.js runtime).
export default createMiddleware(routing);

export const config = {
  // Skip Next internals, Vercel internals, and anything with a file extension.
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
