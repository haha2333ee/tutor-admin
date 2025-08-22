"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { supabase } from "@/lib/supabase/client";

/* ===== Types ===== */
export type Site = {
    id: number;
    created_at: string;
    public_id: string | null;
    primary_domain: string | null;
    property_id: string | null;
    slug: string | null;
    default_locale: string | null;
    is_enabled: number | null; // bigint: 1/0/null
};

export type SiteConfig = {
    locale: string | null;
    wechat_number: string | null;
    qq_number: string | null;
    email: string | null;
    company_name: string | null;
    site_seo: string; // 编辑时用字符串；保存时转 JSON/null
};

const EMPTY_CONFIG: SiteConfig = {
    locale: "",
    wechat_number: "",
    qq_number: "",
    email: "",
    company_name: "",
    site_seo: "",
};

const PAGE_SIZE = 10;

/* ===== Helpers ===== */
function normalizeDomain(input: string) {
    const s = input.trim().toLowerCase();
    const stripProto = s.replace(/^https?:\/\//, "");
    const stripWww = stripProto.replace(/^www\./, "");
    return stripWww.split("/")[0];
}

function safeParseJSON(s: string): any | null | { __INVALID__: true; raw: string } {
    const t = (s ?? "").trim();
    if (!t) return null; // 空字符串当 NULL
    try {
        return JSON.parse(t);
    } catch {
        return { __INVALID__: true, raw: s };
    }
}

/* ===== Store ===== */
type Store = {
    // list
    items: Site[];
    total: number;
    page: number;
    q: string;
    loading: boolean;

    // edit / config
    editing: Site | "create" | null;
    config: SiteConfig;
    configLoading: boolean;

    // actions
    setPage: (p: number) => void;
    setQ: (q: string) => void;

    fetchList: () => Promise<void>;
    openCreate: () => void;
    openEdit: (row: Site) => Promise<void>;
    closeEdit: () => void;
    submitForm: (fd: FormData) => Promise<void>;
    removeRow: (row: Site) => Promise<void>;
};

export const useSitesStore = create<Store>()(
    persist(
        (set, get) => ({
            items: [],
            total: 0,
            page: 1,
            q: "",
            loading: false,

            editing: null,
            config: { ...EMPTY_CONFIG },
            configLoading: false,

            setPage: (p) => set({ page: Math.max(1, p) }),
            setQ: (q) => set({ q, page: 1 }),

            fetchList: async () => {
                const { page, q } = get();
                const from = (page - 1) * PAGE_SIZE;
                const to = from + PAGE_SIZE - 1;

                set({ loading: true });
                try {
                    let query = supabase
                        .from("sites")
                        .select(
                            "id, created_at, public_id, primary_domain, property_id, slug, default_locale, is_enabled",
                            { count: "exact" }
                        )
                        .order("created_at", { ascending: false })
                        .range(from, to);

                    const keyword = (q ?? "").trim();
                    if (keyword) {
                        query = query.or(
                            `primary_domain.ilike.%${keyword}%,slug.ilike.%${keyword}%,property_id.ilike.%${keyword}%`
                        );
                    }

                    const { data, error, count } = await query;
                    if (error) throw error;

                    set({
                        items: (data ?? []) as Site[],
                        total: count ?? 0,
                    });
                } finally {
                    set({ loading: false });
                }
            },

            openCreate: () => set({ editing: "create", config: { ...EMPTY_CONFIG } }),

            openEdit: async (row) => {
                set({ editing: row, config: { ...EMPTY_CONFIG }, configLoading: true });
                try {
                    if (!row.public_id) return;
                    const { data, error } = await supabase
                        .from("site_config")
                        .select("locale, wechat_number, qq_number, email, company_name, site_seo")
                        .eq("site_id", row.public_id)
                        .maybeSingle();
                    if (error) throw error;

                    if (data) {
                        set({
                            config: {
                                locale: data.locale ?? "",
                                wechat_number: data.wechat_number ?? "",
                                qq_number: data.qq_number ?? "",
                                email: data.email ?? "",
                                company_name: data.company_name ?? "",
                                site_seo: data.site_seo ? JSON.stringify(data.site_seo, null, 2) : "",
                            },
                        });
                    }
                } finally {
                    set({ configLoading: false });
                }
            },

            closeEdit: () => set({ editing: null }),

            submitForm: async (fd: FormData) => {
                const state = get();
                const isCreate = state.editing === "create";
                const editing = state.editing && state.editing !== "create" ? (state.editing as Site) : null;

                const primary_domain_raw = String(fd.get("primary_domain") || "");
                const primary_domain = primary_domain_raw ? normalizeDomain(primary_domain_raw) : null;
                const property_id = (String(fd.get("property_id") || "").trim() || null) as string | null;
                const slug = (String(fd.get("slug") || "").trim() || null) as string | null;
                const default_locale = (String(fd.get("default_locale") || "").trim() || null) as string | null;
                const is_enabled = fd.get("is_enabled") === "on" ? 1 : 0;

                const cfg: SiteConfig = {
                    locale: (String(fd.get("cfg_locale") || "").trim() || null) as string | null,
                    wechat_number: (String(fd.get("cfg_wechat") || "").trim() || null) as string | null,
                    qq_number: (String(fd.get("cfg_qq") || "").trim() || null) as string | null,
                    email: (String(fd.get("cfg_email") || "").trim() || null) as string | null,
                    company_name: (String(fd.get("cfg_company") || "").trim() || null) as string | null,
                    site_seo: String(fd.get("cfg_seo") || ""),
                };

                if (!primary_domain) {
                    throw new Error("primary_domain 为必填项");
                }

                // 校验 site_seo JSON
                const parsedSEO = safeParseJSON(cfg.site_seo);
                if (parsedSEO && (parsedSEO as any).__INVALID__) {
                    throw new Error("site_seo 不是合法的 JSON");
                }

                set({ loading: true });
                try {
                    // 1) upsert sites
                    let currentPublicId: string | null = editing?.public_id ?? null;

                    if (isCreate) {
                        const { data, error } = await supabase
                            .from("sites")
                            .insert({
                                primary_domain,
                                property_id,
                                slug,
                                default_locale,
                                is_enabled,
                            })
                            .select("id, public_id")
                            .maybeSingle();
                        if (error) throw error;
                        currentPublicId = data?.public_id ?? null;
                        set({ page: 1 }); // 新建后回第一页
                    } else if (editing) {
                        const { error } = await supabase
                            .from("sites")
                            .update({
                                primary_domain,
                                property_id,
                                slug,
                                default_locale,
                                is_enabled,
                            })
                            .eq("id", editing.id);
                        if (error) throw error;
                    }

                    // 2) upsert site_config（需 public_id）
                    if (currentPublicId) {
                        const { error: cfgErr } = await supabase
                            .from("site_config")
                            .upsert(
                                {
                                    site_id: currentPublicId,
                                    locale: cfg.locale,
                                    wechat_number: cfg.wechat_number,
                                    qq_number: cfg.qq_number,
                                    email: cfg.email,
                                    company_name: cfg.company_name,
                                    site_seo: parsedSEO, // json or null
                                },
                                { onConflict: "site_id" }
                            );
                        if (cfgErr) throw cfgErr;
                    }

                    // 关闭弹窗并刷新列表
                    set({ editing: null });
                    await get().fetchList();
                } catch (e: any) {
                    // 往外抛，页面可定制提示
                    throw e;
                } finally {
                    set({ loading: false });
                }
            },

            removeRow: async (row: Site) => {
                set({ loading: true });
                try {
                    if (row.public_id) {
                        await supabase.from("site_config").delete().eq("site_id", row.public_id);
                    }
                    const { error } = await supabase.from("sites").delete().eq("id", row.id);
                    if (error) throw error;

                    // 若当前页删空则回退一页
                    const remains = get().items.length - 1;
                    if (remains <= 0 && get().page > 1) {
                        set({ page: get().page - 1 });
                    }

                    await get().fetchList();
                } finally {
                    set({ loading: false });
                }
            },
        }),
        {
            name: "sites-store",
            storage: createJSONStorage(() => sessionStorage),
            partialize: (s) => ({
                // 持久化这些字段：页面与检索状态、弹窗基本态
                items: s.items,
                total: s.total,
                page: s.page,
                q: s.q,
                editing: s.editing ? (typeof s.editing === "object" ? { ...s.editing } : s.editing) : null,
                config: s.config,
            }),
        }
    )
);
