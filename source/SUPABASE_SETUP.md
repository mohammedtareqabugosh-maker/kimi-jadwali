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

## 3. البريد وGoogle
في Authentication → URL Configuration أضف الرابطين التاليين إلى قائمة Redirect URLs (مع المسار كاملًا):
- `https://mohammedtareqabugosh-maker.github.io/Kimi-weekly/`
- `https://mohammedtareqabugosh-maker.github.io/kimi-jadwali/?template=blank`
اختر أحدهما كـ Site URL، وأبقِ الرابطين في Redirect URLs. في Authentication → Providers فعّل Email. لتفعيل Google أنشئ OAuth client في Google Cloud Console، ثم أدخل Client ID وClient Secret في مزوّد Google داخل Supabase، وأضف عنوان callback الذي يعرضه Supabase إلى Google Cloud Console.

## 4. البيانات
عند أول تسجيل دخول تُنسخ بيانات المتصفح القديمة إلى مساحة حساب معزولة إذا لم يسبق ربطها بحساب آخر. تُحمّل بيانات السحابة إن كانت أحدث، وتُرفع تغييرات التطبيق إلى صف خاص بالمستخدم. لا يمكن اعتبار المصادقة الحية مكتملة قبل إدخال مفاتيح المشروع وتطبيق SQL وضبط Google OAuth ثم اختبارها.
