"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    // 테스트 단계를 위해 항상 대시보드로 이동
    router.push("/dashboard");
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">Aone</h1>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return null;
}

