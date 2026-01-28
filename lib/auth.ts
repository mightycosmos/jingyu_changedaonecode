
export interface User {
  id: string;
  email?: string;
}

/**
 * 현재 로그인한 사용자 정보를 가져옵니다.
 */
export async function getCurrentUser(): Promise<User | null> {
  // 로컬 개발을 위해 고정된 게스트 사용자 반환
  return {
    id: 'local-guest-user-id',
    email: 'guest@example.com',
  };
}

/**
 * 현재 세션 정보를 가져옵니다.
 */
export async function getSession() {
  return {
    user: {
      id: 'local-guest-user-id',
      email: 'guest@example.com',
    },
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  };
}

/**
 * 이메일과 비밀번호로 로그인합니다.
 */
export async function signIn(email: string, password: string) {
  return {
    user: { id: 'local-guest-user-id', email },
    session: { access_token: 'mock-token' },
  };
}

/**
 * 이메일과 비밀번호로 회원가입합니다.
 */
export async function signUp(email: string, password: string) {
  return {
    user: { id: 'local-guest-user-id', email },
    session: { access_token: 'mock-token' },
  };
}

/**
 * 로그아웃합니다.
 */
export async function signOut() {
  console.log('Signed out locally');
}

/**
 * 인증 상태 변경을 구독합니다.
 */
export function onAuthStateChange(callback: (user: User | null) => void) {
  // 즉시 게스트 사용자 전달
  callback({
    id: 'local-guest-user-id',
    email: 'guest@example.com',
  });

  // 가짜 해제 함수 반환
  return {
    data: {
      subscription: {
        unsubscribe: () => { },
      },
    },
  };
}

