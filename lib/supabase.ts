import { createClient } from '@supabase/supabase-js';
import { FullSummaryV2 } from '@/types/fullSummaryV2';

// Supabase 클라이언트 생성 (브라우저 환경)
export function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인하세요.');
  }

  return createClient(supabaseUrl, supabasePublishableKey);
}

// 서버 사이드에서 사용할 클라이언트 (시크릿 키 사용)
export function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error('Supabase 서버 환경 변수가 설정되지 않았습니다.');
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
