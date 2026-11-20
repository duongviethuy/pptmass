import type { Prayer } from "@/lib/pptmass-types";
import { createClient } from "@/lib/supabase/server";

export type PrayerRow = {
  id: string;
  title: string;
  content: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
};

export type ListPrayersResult = {
  prayers: Prayer[];
  tableMissing: boolean;
  error?: string;
};

export function mapPrayerRow(row: PrayerRow): Prayer {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
  };
}

/** Lấy danh sách các kinh từ Supabase (gọi bên trong <Suspense>). */
export async function listPrayers(limit = 200): Promise<ListPrayersResult> {
  "use cache: private";

  const supabase = await createClient();
  const { data, error } = await supabase.from("prayers").select("*").order("title", { ascending: true }).limit(limit);

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") {
      return { prayers: [], tableMissing: true };
    }
    console.error("[prayers] Failed to list prayers:", error.code, error.message);
    return { prayers: [], tableMissing: false, error: error.message };
  }

  return {
    prayers: (data ?? []).map((row) => mapPrayerRow(row as PrayerRow)),
    tableMissing: false,
  };
}
