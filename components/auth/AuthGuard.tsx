"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, onAuthStateChange, User } from "@/lib/auth";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [user, setUser] = useState<User | null>({
    id: 'local-guest-user-id',
    email: 'guest@example.com',
  });
  const [loading, setLoading] = useState(false);

  // 테스트 단계를 위해 인증 로직 비활성화
  return <>{children}</>;
}

