"use client";

/**
 * 아동 목록 검색·필터 + 렌더링
 * 상태 필터가 "전체"일 때만 종료된 아이를 접어서 따로 보여주고,
 * 특정 상태를 선택하면 그 상태만 평평하게 보여줍니다.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Child } from "@/lib/types";

const STATUS_LABEL: Record<Child["status"], string> = {
  active: "이용중",
  waiting: "대기",
  ended: "종료",
};

export type ChildListItem = { child: Child; count: number; latest?: string };

export default function ChildListSection({ items }: { items: ChildListItem[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Child["status"]>("all");
  const [serviceFilter, setServiceFilter] = useState("all");

  const serviceOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach(({ child }) => { if (child.serviceType) set.add(child.serviceType); });
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(({ child }) => {
      if (q) {
        const haystack = [child.name, child.guardianName, child.guardianPhone].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (serviceFilter !== "all" && child.serviceType !== serviceFilter) return false;
      if (statusFilter !== "all" && child.status !== statusFilter) return false;
      return true;
    });
  }, [items, search, serviceFilter, statusFilter]);

  const showSplit = statusFilter === "all";
  const main = showSplit ? filtered.filter((r) => r.child.status !== "ended") : filtered;
  const ended = showSplit ? filtered.filter((r) => r.child.status === "ended") : [];

  // 같은 보호자 연락처를 쓰는 아이 수 (형제자매 그룹 크기) — 목록에서 바로 보이게
  const siblingCountByPhone = useMemo(() => {
    const map = new Map<string, number>();
    for (const { child } of items) {
      if (!child.guardianPhone) continue;
      map.set(child.guardianPhone, (map.get(child.guardianPhone) ?? 0) + 1);
    }
    return map;
  }, [items]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        <input
          className="input flex-1 min-w-[160px]"
          placeholder="이름·보호자명·연락처 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="all">전체 상태</option>
          <option value="active">이용중</option>
          <option value="waiting">대기</option>
          <option value="ended">종료</option>
        </select>
        {serviceOptions.length > 0 && (
          <select className="input w-auto" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
            <option value="all">전체 서비스</option>
            {serviceOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      {main.length === 0 && ended.length === 0 && (
        <p className="text-sm text-ink/50 py-6 text-center">조건에 맞는 아동이 없습니다.</p>
      )}

      <ul className="space-y-4">
        {main.map((item) => (
          <ChildCard key={item.child.id} {...item} siblingCount={siblingCountByPhone.get(item.child.guardianPhone ?? "") ?? 1} />
        ))}
      </ul>

      {ended.length > 0 && (
        <details className="mt-8">
          <summary className="text-sm text-ink/50 cursor-pointer select-none">
            종료된 아이 ({ended.length}명)
          </summary>
          <ul className="space-y-4 mt-4">
            {ended.map((item) => (
              <ChildCard key={item.child.id} {...item} siblingCount={siblingCountByPhone.get(item.child.guardianPhone ?? "") ?? 1} dimmed />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ChildCard({ child, count, latest, siblingCount = 1, dimmed }: ChildListItem & { siblingCount?: number; dimmed?: boolean }) {
  return (
    <li>
      <Link href={`/admin/children/${child.id}`} className={`card block hover:border-sage-400 transition-colors ${dimmed ? "opacity-60" : ""}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-lg">{child.name}</p>
              <span className="text-[10px] bg-sage-100 text-sage-700 rounded-full px-2 py-0.5 font-medium shrink-0">
                {STATUS_LABEL[child.status]}
              </span>
              {siblingCount > 1 && (
                <span className="text-[10px] bg-sky-100 text-sky-700 rounded-full px-2 py-0.5 font-medium shrink-0">
                  형제자매 {siblingCount}명
                </span>
              )}
            </div>
            <p className="text-sm text-ink/60 mt-0.5">
              {child.grade} · 검사 {count}건
              {latest && ` · 최근 ${latest}`}
            </p>
            {(child.guardianName || child.guardianPhone) && (
              <p className="text-xs text-ink/40 mt-0.5">
                {child.guardianName}{child.guardianName && child.guardianPhone && " · "}{child.guardianPhone}
              </p>
            )}
            {child.serviceType && (
              <p className="text-xs text-ink/40 mt-0.5">{child.serviceType} · 등록일 {child.createdAt}</p>
            )}
          </div>
          <span className="text-sage-400 text-xl shrink-0">›</span>
        </div>
      </Link>
    </li>
  );
}
