import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Tạo Supabase client cho Server Components, Server Actions và Route Handlers. Luôn tạo mới mỗi request. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Được gọi từ Server Component (không ghi được cookie). proxy.ts sẽ lo việc làm mới session.
        }
      },
    },
  });
}
