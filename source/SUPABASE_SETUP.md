# إعداد تسجيل الدخول والمزامنة لـ NASSQ

تحتاج النسخة المنشورة إلى مشروع Supabase تملكه. لا تُضمّن مفتاح service_role في التطبيق.

## 1. إعداد مفاتيح النشر
أضف `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` إلى GitHub repository variables أو secrets. يجب تمريرهما إلى بيئة خطوة البناء في GitHub Actions. المفتاح العام فقط آمن للواجهة مع RLS مفعّل.

## 2. إنشاء جدول البيانات وسياسات العزل
نفّذ التالي في Supabase → SQL Editor:

```sql
create table if not exists public.user_app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.user_app_data enable row level security;
drop policy if exists "Users can read their own app data" on public.user_app_data;
create policy "Users can read their own app data" on public.user_app_data for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert their own app data" on public.user_app_data;
create policy "Users can insert their own app data" on public.user_app_data for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their own app data" on public.user_app_data;
create policy "Users can update their own app data" on public.user_app_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update on public.user_app_data to authenticated;
```


## 3. الجدول الأسبوعي المشترك بين نَسّق وصحن
صفحة «الجدول الموحد» تستخدم جدول `public.shared_schedule`. إنشاء `user_app_data` وحده لا يكفي. نفّذ هذا أيضًا في SQL Editor:

```sql
create table if not exists public.shared_schedule (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('task', 'appointment', 'meal')),
  title text not null,
  details text not null default '',
  starts_at timestamptz not null,
  meal_type text not null default '',
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  ingredients text not null default '',
  source_app text not null default '',
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  progress_notes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists shared_schedule_user_time_idx
  on public.shared_schedule (user_id, starts_at);

alter table public.shared_schedule enable row level security;
drop policy if exists "Users can read own shared schedule" on public.shared_schedule;
drop policy if exists "Users can insert own shared schedule" on public.shared_schedule;
drop policy if exists "Users can update own shared schedule" on public.shared_schedule;
drop policy if exists "Users can delete own shared schedule" on public.shared_schedule;
create policy "Users can read own shared schedule" on public.shared_schedule
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own shared schedule" on public.shared_schedule
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own shared schedule" on public.shared_schedule
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete own shared schedule" on public.shared_schedule
  for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.shared_schedule to authenticated;
```

المخطط يستخدم `id` نصيًا ليتوافق مع التطبيقين ومعرّفات الوجبات المشتركة. إذا كان الجدول موجودًا بالفعل، لا تحذفه ولا تعِد إنشاءه؛ راجع الأعمدة وسياسات RLS فقط. تأكد أيضًا أن التطبيقين يستخدمان مشروع Supabase نفسه والحساب نفسه.

## 4. البريد وGoogle
في Authentication → URL Configuration أضف الرابطين التاليين إلى قائمة Redirect URLs (مع المسار كاملًا):
- `https://mohammedtareqabugosh-maker.github.io/Kimi-weekly/`
- `https://mohammedtareqabugosh-maker.github.io/kimi-jadwali/?template=blank`
اختر أحدهما كـ Site URL، وأبقِ الرابطين في Redirect URLs. في Authentication → Providers فعّل Email. لتفعيل Google أنشئ OAuth client في Google Cloud Console، ثم أدخل Client ID وClient Secret في مزوّد Google داخل Supabase، وأضف عنوان callback الذي يعرضه Supabase إلى Google Cloud Console.

## 5. البيانات
عند أول تسجيل دخول تُنسخ بيانات المتصفح القديمة إلى مساحة حساب معزولة إذا لم يسبق ربطها بحساب آخر. تُحمّل بيانات السحابة إن كانت أحدث، وتُرفع تغييرات التطبيق إلى صف خاص بالمستخدم. لا يمكن اعتبار المصادقة الحية مكتملة قبل إدخال مفاتيح المشروع وتطبيق SQL وضبط Google OAuth ثم اختبارها.
