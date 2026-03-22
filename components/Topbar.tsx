"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

const TITLE_MAP: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "对话助手", subtitle: "用自然语言驱动招聘流程" },
  "/jobs": { title: "职位管理", subtitle: "职位全生命周期管理" },
  "/scoring-rules": { title: "评分参考", subtitle: "标准化评估维度与规则" },
  "/candidates": { title: "候选人", subtitle: "候选人库与匹配分析" },
  "/interviews": { title: "面试管理", subtitle: "面试安排、题库与反馈" },
  "/history": { title: "历史记录", subtitle: "会话沉淀与复盘" },
  "/settings": { title: "设置", subtitle: "系统与集成配置" },
};

export function Topbar() {
  const pathname = usePathname();

  const pageMeta = useMemo(() => {
    const entry = Object.entries(TITLE_MAP).find(([key]) =>
      key === "/" ? pathname === "/" : pathname.startsWith(key)
    );
    return entry?.[1] || TITLE_MAP["/"];
  }, [pathname]);

  return (
    <header className="h-[var(--topbar-height)] border-b border-border-primary bg-bg-primary/90 backdrop-blur-sm px-6 flex items-center justify-between page-drag-header">
      <div>
        <h1 className="text-sm font-semibold text-text-primary tracking-tight">{pageMeta.title}</h1>
        <p className="text-xs text-text-tertiary mt-0.5">{pageMeta.subtitle}</p>
      </div>
    </header>
  );
}
