-- ============================================================
-- ПОЧИНКА ДОСТУПА: политики RLS для сайта модерации
-- ============================================================
-- Проблема: на таблицах включён RLS без политик, поэтому сайт
-- не видит отчёты, роли, неактивы и панельки.
--
-- Как применить: Supabase Dashboard -> SQL Editor -> New query ->
-- вставить весь этот файл -> Run.
--
-- Политика: авторизованные пользователи сайта (authenticated)
-- получают полный доступ к таблицам сайта. Анонимы — ничего.
-- Это строже, чем было раньше (раньше anon мог всё).
-- VK-бот работает через service_role и обходит RLS — он не пострадает.
-- ============================================================

-- Таблицы сайта: полный доступ для authenticated
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'reports',
    'user_stats',
    'activity_log',
    'admin_logs',
    'staff_access',
    'app_settings',
    'moderator_careers',
    'moderator_report_reviews',
    'moderator_promotion_alerts',
    'vk_links',
    'vk_link_codes'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS site_select ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS site_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS site_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS site_delete ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY site_select ON public.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format(
      'CREATE POLICY site_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t);
    EXECUTE format(
      'CREATE POLICY site_update ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t);
    EXECUTE format(
      'CREATE POLICY site_delete ON public.%I FOR DELETE TO authenticated USING (true)', t);
  END LOOP;
END $$;

-- Таблицы только для бота (service_role обходит RLS автоматически).
-- Для них достаточно включить RLS без политик — сайт их не трогает.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'vk_report_sessions',
    'vk_group_bindings',
    'vk_staff_roles',
    'vk_moderation_actions',
    'vk_google_sheet_events',
    'vk_application_decisions',
    'vk_ai_memory',
    'vk_ai_messages',
    'vk_ai_image_generations'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Профили (legacy-таблицы, используются ботом/старым кодом)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS site_all ON public.profiles;
    CREATE POLICY site_all ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Profiles') THEN
    ALTER TABLE public."Profiles" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS site_all ON public."Profiles";
    CREATE POLICY site_all ON public."Profiles" FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Проверка: выведет все политики
SELECT tablename, policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
