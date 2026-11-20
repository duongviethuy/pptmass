-- Chạy script này trong Supabase Dashboard -> SQL Editor để tạo hoặc cập nhật các bảng dữ liệu.

-- ==========================================
-- 1. BẢNG BÀI HÁT (public.songs)
-- ==========================================
create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  notes text,
  pdf_url text,
  is_public boolean not null default true,
  categories text[] not null default '{}',
  topics text[] not null default '{}',
  parts jsonb not null default '[]'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_by_name text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.songs add column if not exists is_public boolean not null default true;
alter table public.songs add column if not exists pdf_url text;

create index if not exists songs_updated_at_idx on public.songs (updated_at desc);
create index if not exists songs_visibility_idx on public.songs (is_public, created_by);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_songs_updated_at on public.songs;
create trigger set_songs_updated_at
  before update on public.songs
  for each row
  execute function public.handle_updated_at();

alter table public.songs enable row level security;

drop policy if exists "Authenticated users can read songs" on public.songs;
drop policy if exists "Users can read public or own songs" on public.songs;
create policy "Users can read public or own songs"
  on public.songs
  for select
  to authenticated
  using (is_public = true or auth.uid() = created_by);

drop policy if exists "Authenticated users can insert songs" on public.songs;
drop policy if exists "Users can insert own songs" on public.songs;
create policy "Users can insert own songs"
  on public.songs
  for insert
  to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "Authenticated users can update songs" on public.songs;
drop policy if exists "Users can update own songs" on public.songs;
create policy "Users can update own songs"
  on public.songs
  for update
  to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

drop policy if exists "Authenticated users can delete songs" on public.songs;
drop policy if exists "Users can delete own songs" on public.songs;
create policy "Users can delete own songs"
  on public.songs
  for delete
  to authenticated
  using (auth.uid() = created_by);

-- ==========================================
-- 2. BẢNG PHÂN QUYỀN ADMIN (public.admin_users)
-- ==========================================
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "Users can check own admin role" on public.admin_users;
create policy "Users can check own admin role"
  on public.admin_users
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ==========================================
-- 3. BẢNG CÁC KINH (public.prayers) — chỉ Admin được thêm/sửa/xóa
-- ==========================================
create table if not exists public.prayers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prayers_updated_at_idx on public.prayers (updated_at desc);

drop trigger if exists set_prayers_updated_at on public.prayers;
create trigger set_prayers_updated_at
  before update on public.prayers
  for each row
  execute function public.handle_updated_at();

alter table public.prayers enable row level security;

drop policy if exists "Authenticated users can read prayers" on public.prayers;
create policy "Authenticated users can read prayers"
  on public.prayers
  for select
  to authenticated
  using (true);

drop policy if exists "Admins can insert prayers" on public.prayers;
create policy "Admins can insert prayers"
  on public.prayers
  for insert
  to authenticated
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

drop policy if exists "Admins can update prayers" on public.prayers;
create policy "Admins can update prayers"
  on public.prayers
  for update
  to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

drop policy if exists "Admins can delete prayers" on public.prayers;
create policy "Admins can delete prayers"
  on public.prayers
  for delete
  to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));

-- ==========================================
-- 4. STORAGE BUCKET ẢNH THÁNH LỄ (storage.buckets: mass-images)
-- ==========================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mass-images',
  'mass-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

drop policy if exists "Public read mass images" on storage.objects;
create policy "Public read mass images"
  on storage.objects
  for select
  to public
  using (bucket_id = 'mass-images');

drop policy if exists "Authenticated users can upload mass images" on storage.objects;
create policy "Authenticated users can upload mass images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'mass-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own mass images" on storage.objects;
create policy "Users can delete own mass images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'mass-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ==========================================
-- 5. BẢNG SECTION ĐÃ LƯU CÁ NHÂN (public.saved_sections)
--    Chỉ người tạo mới có quyền xem, sử dụng, chỉnh sửa và xóa.
-- ==========================================
create table if not exists public.saved_sections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null check (kind in ('image', 'text', 'song', 'prayer')),
  section_data jsonb not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_sections_owner_updated_idx on public.saved_sections (created_by, updated_at desc);

drop trigger if exists set_saved_sections_updated_at on public.saved_sections;
create trigger set_saved_sections_updated_at
  before update on public.saved_sections
  for each row
  execute function public.handle_updated_at();

alter table public.saved_sections enable row level security;

drop policy if exists "Users can read own saved sections" on public.saved_sections;
create policy "Users can read own saved sections"
  on public.saved_sections
  for select
  to authenticated
  using (auth.uid() = created_by);

drop policy if exists "Users can insert own saved sections" on public.saved_sections;
create policy "Users can insert own saved sections"
  on public.saved_sections
  for insert
  to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "Users can update own saved sections" on public.saved_sections;
create policy "Users can update own saved sections"
  on public.saved_sections
  for update
  to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

drop policy if exists "Users can delete own saved sections" on public.saved_sections;
create policy "Users can delete own saved sections"
  on public.saved_sections
  for delete
  to authenticated
  using (auth.uid() = created_by);

-- ==========================================
-- 6. BẢNG BÀI TRÌNH CHIẾU THÁNH LỄ (public.slides)
--    Mỗi bài slide thuộc riêng tư của người tạo.
--    Hình ảnh đi kèm lưu trên Bunny Storage theo cấu trúc: mass-images/{created_by}/{id}/{ten-anh}
-- ==========================================
create table if not exists public.slides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  celebration_date date,
  aspect_ratio text not null default '16:9' check (aspect_ratio in ('16:9', '4:3')),
  theme_id text not null default 'pure-white' check (theme_id in ('pure-white', 'warm-light', 'lenten-violet', 'feast-red', 'custom')),
  custom_theme jsonb,
  sections jsonb not null default '[]'::jsonb,
  section_count integer not null default 0 check (section_count >= 0),
  slide_count integer not null default 0 check (slide_count >= 0),
  cover_image_url text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists slides_owner_updated_idx on public.slides (created_by, updated_at desc);
create index if not exists slides_owner_date_idx on public.slides (created_by, celebration_date desc);

drop trigger if exists set_slides_updated_at on public.slides;
create trigger set_slides_updated_at
  before update on public.slides
  for each row
  execute function public.handle_updated_at();

alter table public.slides enable row level security;

drop policy if exists "Users can read own slides" on public.slides;
create policy "Users can read own slides"
  on public.slides
  for select
  to authenticated
  using (auth.uid() = created_by);

drop policy if exists "Users can insert own slides" on public.slides;
create policy "Users can insert own slides"
  on public.slides
  for insert
  to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "Users can update own slides" on public.slides;
create policy "Users can update own slides"
  on public.slides
  for update
  to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

drop policy if exists "Users can delete own slides" on public.slides;
create policy "Users can delete own slides"
  on public.slides
  for delete
  to authenticated
  using (auth.uid() = created_by);
