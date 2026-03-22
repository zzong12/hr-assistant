"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, User } from "lucide-react";
import { NexusLogo } from "@/components/NexusLogo";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "登录失败");
        return;
      }

      router.push(redirect);
      router.refresh();
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative z-10 w-full max-w-sm mx-4">
      {/* Brand */}
      <div className="text-center mb-8">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="relative w-full h-full rounded-2xl gradient-primary flex items-center justify-center border border-white/10 shadow-lg">
            <NexusLogo className="w-10 h-10 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Nexus HR</h1>
        <p className="text-sm text-text-tertiary mt-2">AI 招聘工作台</p>
      </div>

      {/* Login Card */}
      <form
        onSubmit={handleSubmit}
        className="glass-panel rounded-2xl p-8 space-y-6"
      >
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-xl border border-destructive/20 animate-fade-in">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground/80" htmlFor="username">
            用户名
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoFocus
              required
            className="w-full h-11 rounded-xl border border-input bg-background/70 pl-10 pr-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground/80" htmlFor="password">
            密码
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
            className="w-full h-11 rounded-xl border border-input bg-background/70 pl-10 pr-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full h-11 rounded-xl gradient-primary text-white font-semibold text-sm transition-colors duration-200 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "登 录"
          )}
        </button>

        <p className="text-center text-xs text-muted-foreground/60">
          Powered by AI Agent Architecture
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  const [showDragBar, setShowDragBar] = useState(false);

  useEffect(() => {
    const api = (window as unknown as { electronAPI?: { isElectron?: boolean; platform?: string } }).electronAPI;
    if (api?.isElectron && api.platform === "darwin") {
      setShowDragBar(true);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {showDragBar && (
        <div className="fixed top-0 left-0 right-0 h-12 z-50 electron-drag-region" />
      )}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/8 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-primary/6 blur-[100px]" />

      <Suspense fallback={
        <div className="relative z-10 w-full max-w-sm mx-4 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
