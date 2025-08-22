"use client";

import { useEffect } from "react";
import { useSitesStore, Site } from "@/store/sitesStore";

export default function SitesPage() {
    const {
        items, total, page, q, loading,
        editing, config, configLoading,
        setPage, setQ,
        fetchList, openCreate, openEdit, closeEdit,
        submitForm, removeRow,
    } = useSitesStore();

    const totalPages = Math.max(1, Math.ceil(total / 10));

    useEffect(() => {
        fetchList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, q]);

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        try {
            await submitForm(fd);
        } catch (err: any) {
            const msg: string = err?.message || "";
            if (/unique/i.test(msg) && /primary_domain/i.test(msg)) {
                alert("保存失败：primary_domain 已存在（唯一约束冲突）");
            } else {
                alert(msg || "保存失败");
            }
        }
    }

    async function onRemove(row: Site) {
        if (!confirm(`确定删除站点：${row.primary_domain ?? row.id} ？`)) return;
        try {
            await removeRow(row);
        } catch (err: any) {
            alert(err?.message || "删除失败");
        }
    }

    return (
        <div>
            <h1 className="text-2xl font-bold">Sites 管理</h1>

            {/* 工具条：搜索 + 新建 */}
            <div className="mt-4 flex gap-2 items-center">
                <input
                    className="border px-3 py-2 rounded w-72"
                    placeholder="搜索 primary_domain / slug / property_id…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
                <button
                    onClick={openCreate}
                    className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                    新建站点
                </button>
                {loading && <span className="text-gray-500 text-sm">加载中…</span>}
            </div>

            {/* 列表 */}
            <div className="mt-4 overflow-x-auto bg-white border rounded">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 text-left">
                    <tr>
                        <th className="px-3 py-2">id</th>
                        <th className="px-3 py-2">public_id</th>
                        <th className="px-3 py-2">primary_domain</th>
                        <th className="px-3 py-2">property_id</th>
                        <th className="px-3 py-2">slug</th>
                        <th className="px-3 py-2">default_locale</th>
                        <th className="px-3 py-2">is_enabled</th>
                        <th className="px-3 py-2">created_at</th>
                        <th className="px-3 py-2">操作</th>
                    </tr>
                    </thead>
                    <tbody>
                    {items.map((s) => (
                        <tr key={s.id} className="border-t">
                            <td className="px-3 py-2">{s.id}</td>
                            <td className="px-3 py-2">{s.public_id ?? "-"}</td>
                            <td className="px-3 py-2">{s.primary_domain ?? "-"}</td>
                            <td className="px-3 py-2">{s.property_id ?? "-"}</td>
                            <td className="px-3 py-2">{s.slug ?? "-"}</td>
                            <td className="px-3 py-2">{s.default_locale ?? "-"}</td>
                            <td className="px-3 py-2">{(s.is_enabled ?? 0) ? "✔︎" : "✖︎"}</td>
                            <td className="px-3 py-2">
                                {new Date(s.created_at).toLocaleString()}
                            </td>
                            <td className="px-3 py-2">
                                <button
                                    onClick={() => openEdit(s)}
                                    className="px-2 py-1 rounded border hover:bg-gray-50"
                                >
                                    编辑
                                </button>
                                <button
                                    onClick={() => onRemove(s)}
                                    className="ml-2 px-2 py-1 rounded border text-red-600 hover:bg-red-50"
                                >
                                    删除
                                </button>
                            </td>
                        </tr>
                    ))}
                    {items.length === 0 && !loading && (
                        <tr>
                            <td className="px-3 py-6 text-center text-gray-500" colSpan={9}>
                                暂无数据
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>

            {/* 分页 */}
            <div className="mt-3 flex items-center gap-3">
                <button
                    className="px-3 py-1 border rounded disabled:opacity-50"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                >
                    上一页
                </button>
                <span className="text-sm text-gray-600">
          第 {page} / {totalPages} 页（共 {total} 条）
        </span>
                <button
                    className="px-3 py-1 border rounded disabled:opacity-50"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                >
                    下一页
                </button>
            </div>

            {/* 弹窗：新建/编辑（含 site_config） */}
            {editing && (
                <div className="fixed inset-0 bg-black/20 flex items-center justify-center">
                    <form onSubmit={onSubmit} className="bg-white rounded p-4 w-[820px] shadow">
                        <h3 className="text-lg font-semibold mb-3">
                            {editing === "create" ? "新建站点" : `编辑站点 #${(editing as Site).id}`}
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            {/* 左列：sites */}
                            <div>
                                <h4 className="font-semibold mb-2">站点信息（sites）</h4>

                                <label className="block text-sm text-gray-600 mb-1">primary_domain *</label>
                                <input
                                    name="primary_domain"
                                    required
                                    defaultValue={editing === "create" ? "" : (editing as Site).primary_domain ?? ""}
                                    placeholder="gradbridge.xyz / https://www.gradbridge.xyz"
                                    className="border rounded px-3 py-2 w-full mb-3"
                                />

                                <label className="block text-sm text-gray-600 mb-1">property_id（GA4）</label>
                                <input
                                    name="property_id"
                                    defaultValue={editing === "create" ? "" : (editing as Site).property_id ?? ""}
                                    placeholder="例如：500856747"
                                    className="border rounded px-3 py-2 w-full mb-3"
                                />

                                <label className="block text-sm text-gray-600 mb-1">slug</label>
                                <input
                                    name="slug"
                                    defaultValue={editing === "create" ? "" : (editing as Site).slug ?? ""}
                                    placeholder="可选，例如 main"
                                    className="border rounded px-3 py-2 w-full mb-3"
                                />

                                <label className="block text-sm text-gray-600 mb-1">default_locale</label>
                                <input
                                    name="default_locale"
                                    defaultValue={editing === "create" ? "" : (editing as Site).default_locale ?? ""}
                                    placeholder="如 zh-CN / en-US（可选）"
                                    className="border rounded px-3 py-2 w-full mb-3"
                                />

                                <label className="inline-flex items-center gap-2 mb-4">
                                    <input
                                        type="checkbox"
                                        name="is_enabled"
                                        defaultChecked={editing === "create" ? true : !!((editing as Site).is_enabled ?? 0)}
                                    />
                                    <span>启用</span>
                                </label>
                            </div>

                            {/* 右列：site_config */}
                            <div>
                                <h4 className="font-semibold mb-2">站点配置（site_config）</h4>

                                <label className="block text-sm text-gray-600 mb-1">locale</label>
                                <input
                                    name="cfg_locale"
                                    defaultValue={config.locale ?? ""}
                                    className="border rounded px-3 py-2 w-full mb-3"
                                />

                                <label className="block text-sm text-gray-600 mb-1">wechat_number</label>
                                <input
                                    name="cfg_wechat"
                                    defaultValue={config.wechat_number ?? ""}
                                    className="border rounded px-3 py-2 w-full mb-3"
                                />

                                <label className="block text-sm text-gray-600 mb-1">qq_number</label>
                                <input
                                    name="cfg_qq"
                                    defaultValue={config.qq_number ?? ""}
                                    className="border rounded px-3 py-2 w-full mb-3"
                                />

                                <label className="block text-sm text-gray-600 mb-1">email</label>
                                <input
                                    name="cfg_email"
                                    defaultValue={config.email ?? ""}
                                    className="border rounded px-3 py-2 w-full mb-3"
                                />

                                <label className="block text-sm text-gray-600 mb-1">company_name</label>
                                <input
                                    name="cfg_company"
                                    defaultValue={config.company_name ?? ""}
                                    className="border rounded px-3 py-2 w-full mb-3"
                                />

                                <label className="block text-sm text-gray-600 mb-1">site_seo（JSON）</label>
                                <textarea
                                    name="cfg_seo"
                                    defaultValue={config.site_seo}
                                    rows={6}
                                    placeholder='如：{"title":"首页","description":"..."}'
                                    className="border rounded px-3 py-2 w-full font-mono text-xs"
                                />
                                {configLoading && (
                                    <p className="text-xs text-gray-500 mt-1">加载站点配置中…</p>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                type="button"
                                onClick={closeEdit}
                                className="px-3 py-2 border rounded"
                            >
                                取消
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                                保存
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
