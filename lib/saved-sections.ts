import { getCurrentUser } from "@/lib/auth";
import type { MassSection, SavedSection, SectionKind } from "@/lib/pptmass-types";
import { createClient } from "@/lib/supabase/server";

export type SavedSectionRow = {
  id: string;
  title: string;
  kind: SectionKind;
  section_data: MassSection;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
};

export type ListSavedSectionsResult = {
  sections: SavedSection[];
  tableMissing: boolean;
  error?: string;
};

export function mapSavedSectionRow(row: SavedSectionRow): SavedSection {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    sectionData: {
      ...row.section_data,
      savedSectionId: row.id,
    },
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Lấy danh sách section đã lưu của chính người đang đăng nhập (gọi bên trong <Suspense>). */
export async function listSavedSections(limit = 200): Promise<ListSavedSectionsResult> {
  "use cache: private";

  const user = await getCurrentUser();
  if (!user) {
    return { sections: [], tableMissing: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_sections")
    .select("*")
    .eq("created_by", user.id)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") {
      return { sections: [], tableMissing: true };
    }
    console.error("[saved-sections] Failed to list saved sections:", error.code, error.message);
    return { sections: [], tableMissing: false, error: error.message };
  }

  return {
    sections: (data ?? []).map((row) => mapSavedSectionRow(row as SavedSectionRow)),
    tableMissing: false,
  };
}
