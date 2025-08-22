"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { supabase } from "@/lib/supabase/client";

/* ========== Types ========== */
export type GuestbookMessage = {
    id: number;
    created_at: string;       // timestamptz
    status: number | null;    // smallint
    contact_type: string | null;
    contact_value: string | null;
    demand_content: string | null;
    source: string | null;    // FK -> sites.primary_domain
};

const PAGE_SIZE = 10;

/* ========== Helpers ========== */
function normalizeDomain(input: string) {
    const s = (input || "").trim().toLowerCase();
    if (!s) return null;
    const stripProto = s.replace(/^https?:\/\//, "");
    const stripWww = stripProto.replace(/^www\./, "");
    return stripWww.split("/")[0] || null;
}
function toSmallInt(v: FormDataEntryValue | null): number | null {
    const raw = String(v ?? "").trim();
    if (raw === "") return null;
    const n = Number(raw);
    if (Number.isNaN(n)) return null;
    return Math.max(-32768, Math.min(32767, Math.trunc(n)));
}

/* ========== Store ========== */
type Store = {
    // list state
    items: GuestbookMessage[];
    total: number;
    page: number;
    q: string;
    loading: boolean;

    // editing modal
    editing: GuestbookMessage | "create" | null;

    // actions
    setPage: (p: number) => void;
    setQ: (q: string) => void;

    fetchList: () => Promise<void>;
    openCreate: () => void;
    openEdit: (row: GuestbookMessage) => void;
    closeEdit: () => void;
    submitForm: (fd: FormData) => Promise<void>;
    removeRow: (row: GuestbookMessage) => Promise<void>;
};

export const useGuestbookStore = create<Store>()(
    persist(
        (set, get) => ({
            items: [],
            total: 0,
            page: 1,
            q: "",
            loading: false,

            editing: null,

            setPage: (p) => set({ page: Math.max(1, p) }),
            setQ: (q) => set({ q, page: 1 }),

            fetchList: async () => {
                const { page, q } = get();
                const from = (page - 1) * PAGE_SIZE;
                const to = from + PAGE_SIZE - 1;

                set({ loading: true });
                try {
                    let query = supabase
                        .from("guestbook_messages")
                        .select(
                            "id, created_at, status, contact_type, contact_value, demand_content, source",
                            { count: "exact" }
                        )
                        .order("created_at", { ascending: false })
                        .range(from, to);

                    const keyword = (q ?? "").trim();
                    if (keyword) {
                        // 在联系值 / 需求内容 / 来源域名中模糊搜索
                        query = query.or(
                            `contact_value.ilike.%${keyword}%,demand_content.ilike.%${keyword}%,source.ilike.%${keyword}%`
                        );
                    }

                    const { data, error, count } = await query;
                    if (error) throw error;

                    set({
                        items: (data ?? []) as GuestbookMessage[],
                        total: count ?? 0,
                    });
                } finally {
                    set({ loading: false });
                }
            },

            openCreate: () => set({ editing: "create" }),
            openEdit: (row) => set({ editing: row }),
            closeEdit: () => set({ editing: null }),

            submitForm: async (fd: FormData) => {
                const editing = get().editing;
                const isCreate = editing === "create";
                const row = editing && editing !== "create" ? (editing as GuestbookMessage) : null;

                const status = toSmallInt(fd.get("status"));
                const contact_type = (String(fd.get("contact_type") || "").trim() || null) as string | null;
                const contact_value = (String(fd.get("contact_value") || "").trim() || null) as string | null;
                const demand_content = (String(fd.get("demand_content") || "").trim() || null) as string | null;
                const source = normalizeDomain(String(fd.get("source") || ""));

                // 可根据业务选择是否强制要求 source（受 FK 约束，建议存在时一定规范化）
                // if (!source) throw new Error("source 为必填项");

                set({ loading: true });
                try {
                    if (isCreate) {
                        const { error } = await supabase.from("guestbook_messages").insert({
                            status, contact_type, contact_value, demand_content, source,
                        });
                        if (error) throw error;
                        set({ page: 1 }); // 新建后回第一页
                    } else if (row) {
                        const { error } = await supabase
                            .from("guestbook_messages")
                            .update({ status, contact_type, contact_value, demand_content, source })
                            .eq("id", row.id);
                        if (error) throw error;
                    }

                    set({ editing: null });
                    await get().fetchList();
                } finally {
                    set({ loading: false });
                }
            },

            removeRow: async (row) => {
                set({ loading: true });
                try {
                    const { error } = await supabase.from("guestbook_messages").delete().eq("id", row.id);
                    if (error) throw error;

                    // 如果删到本页为空，自动回退一页
                    const remains = get().items.length - 1;
                    if (remains <= 0 && get().page > 1) set({ page: get().page - 1 });

                    await get().fetchList();
                } finally {
                    set({ loading: false });
                }
            },
        }),
        {
            name: "guestbook-store",
            storage: createJSONStorage(() => sessionStorage),
            partialize: (s) => ({
                items: s.items,
                total: s.total,
                page: s.page,
                q: s.q,
                editing: s.editing ? (typeof s.editing === "object" ? { ...s.editing } : s.editing) : null,
            }),
        }
    )
);
