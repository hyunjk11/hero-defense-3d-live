// Supabase 프로젝트 (cart-race와 같은 프로젝트). publishable 키는 공개 클라이언트 키이며 접근 제어는 RLS(supabase/schema.sql)로 합니다.
export const SUPABASE = {
  // Archived adapter only; the Functions client does not import this file.
  url: '',
  key: '',
  tables: { profiles: 'hd3d_profiles', progress: 'hd3d_progress' },
  saveDebounceMs: 3000,
  retryMs: [3000, 10000, 30000, 60000],
};
