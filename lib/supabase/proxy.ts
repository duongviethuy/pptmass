import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_ROUTES = ["/login", "/sign-up"];
const PUBLIC_PREFIXES = ["/auth"];

/** Làm mới session Supabase trên mỗi request và chuyển hướng lạc quan (optimistic) theo trạng thái đăng nhập. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Quan trọng: gọi ngay sau khi tạo client, không chèn logic nào ở giữa.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  const isAuthRoute = AUTH_ROUTES.includes(pathname);
  const isPublic = isAuthRoute || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!isSignedIn && !isPublic) return redirectKeepingCookies(request, response, "/login");
  if (isSignedIn && isAuthRoute) return redirectKeepingCookies(request, response, "/");

  return response;
}

function redirectKeepingCookies(request: NextRequest, source: NextResponse, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  source.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
