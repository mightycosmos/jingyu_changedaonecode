"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, Settings, LogOut, User as UserIcon } from "lucide-react";
import { getCurrentUser, signOut, User } from "@/lib/auth";

interface HeaderProps {
  title?: string;
  showSearch?: boolean;
}

export default function Header({ title = "대시보드", showSearch = true }: HeaderProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // 로그아웃 후 완전한 페이지 리로드를 위해 window.location 사용
      window.location.href = "/login";
    } catch (error) {
      console.error("Error signing out:", error);
      // 에러가 발생해도 로그인 페이지로 이동
      window.location.href = "/login";
    }
  };

  return (
    <header className="h-16 bg-background border-b border-border flex items-center justify-between px-6 z-10">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
      </div>

      <div className="flex items-center gap-4">
        {showSearch && (
          <div className="relative group">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="검색..."
              className="pl-10 pr-4 py-2 w-80 bg-surface border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm text-white placeholder:text-gray-500 transition-all"
            />
          </div>
        )}

        <button className="p-2 hover:bg-white/5 rounded-xl transition-colors relative group">
          <Bell className="w-5 h-5 text-gray-400 group-hover:text-white" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full border-2 border-background"></span>
        </button>

        <button className="p-2 hover:bg-white/5 rounded-xl transition-colors group">
          <Settings className="w-5 h-5 text-gray-400 group-hover:text-white" />
        </button>

        {/* 사용자 메뉴 */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-primary" />
            </div>
            {!loading && user && (
              <span className="text-sm text-gray-700 max-w-[120px] truncate">
                {user.email}
              </span>
            )}
          </button>

          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 mt-3 w-56 bg-surface rounded-2xl shadow-2xl border border-border py-2 z-20 overflow-hidden">
                {user && (
                  <div className="px-4 py-3 border-b border-border bg-white/5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">내 계정</p>
                    <p className="text-sm font-medium text-white truncate">
                      {user.email}
                    </p>
                  </div>
                )}
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-400 hover:bg-red-500/10 hover:text-red-500 transition-all font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  로그아웃
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

