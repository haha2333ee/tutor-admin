"use client";

import { useEffect } from "react";
import { useGuestbookStore, GuestbookMessage } from "@/store/guestbookStore";

export default function GuestbookPage() {
    const {
        items, total, page, q, loading,
        editing,
        setPage, setQ,
        fetchList, openCreate, openEdit, closeEdit,
        submitForm, removeRow,
    } = useGuestbookStore();

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
            alert(err?.message || "保存失败");
        }
    }

    async function onRemove(row: GuestbookMessage) {
        if (!confirm(`确定删除留言 #${row.id} ？`)) return;
        try {
            await removeRow(row);
        } catch (err: any) {
            alert(err?.message || "删除失败");
        }
    }

    return (
        <div>
            <h1 className="text-2xl font-bold">Guestbook 留言管理</h1>

            {/* 工具条：搜索 + 新建 */}
            <div className="mt-4 flex gap-2 items-center">
                <input
                    className="border px-3 py-2 rounded w-80"
                    placeholder="搜索 contact_value / demand_content / source…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
                <button
                    onClick={openCreate}
                    className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                    新建留言
                </button>
                {loading && <span className="text-gray-500 text-sm">加载中…</span>}
            </div>

            {/* 列表 */}
            <div className="mt-4 overflow-x-auto bg-white border rounded">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 text-left">
                    <tr>
                        <th className="px-3 py-2">id</th>
                        <th className="px-3 py-2">created_at</th>
                        <th className="px-3 py-2">status</th>
                        <th className="px-3 py-2">contact_type</th>
                        <th className="px-3 py-2">contact_value</th>
                        <th className="px-3 py-2">demand_content</th>
                        <th className="px-3 py-2">source</th>
                        <th className="px-3 py-2">操作</th>
                    </tr>
                    </thead>
                    <tbody>
                    {items.map((m) => (
                        <tr key={m.id} className="border-t align-top">
                            <td className="px-3 py-2">{m.id}</td>
                            <td className="px-3 py-2">{new Date(m.created_at).toLocaleString()}</td>
                            <td className="px-3 py-2">{m.status ?? "-"}</td>
                            <td className="px-3 py-2">{m.contact_type ?? "-"}</td>
                            <td className="px-3 py-2 max-w-[240px] truncate" title={m.contact_value ?? ""}>
                                {m.contact_value ?? "-"}
                            </td>
                            <td className="px-3 py-2 max-w-[360px] truncate" title={m.demand_content ?? ""}>
                                {m.demand_content ?? "-"}
                            </td>
                            <td className="px-3 py-2">{m.source ?? "-"}</td>
                            <td className="px-3 py-2">
                                <button
                                    onClick={() => openEdit(m)}
                                    className="px-2 py-1 rounded border hover:bg-gray-50"
                                >
                                    编辑
                                </button>
                                <button
                                    onClick={() => onRemove(m)}
                                    className="ml-2 px-2 py-1 rounded border text-red-600 hover:bg-red-50"
                                >
                                    删除
                                </button>
                            </td>
                        </tr>
                    ))}
                    {items.length === 0 && !loading && (
                        <tr>
                            <td className="px-3 py-6 text-center text-gray-500" colSpan={8}>
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

            {/* 弹窗：新建/编辑 */}
            {editing && (
                <div className="fixed inset-0 bg-black/20 flex items-center justify-center">
                    <form onSubmit={onSubmit} className="bg-white rounded p-4 w-[720px] shadow">
                        <h3 className="text-lg font-semibold mb-3">
                            {editing === "create" ? "新建留言" : `编辑留言 #${(editing as GuestbookMessage).id}`}
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">status（smallint，可空）</label>
                                <input
                                    name="status"
                                    type="number"
                                    defaultValue={editing === "create" ? "" : String((editing as GuestbookMessage).status ?? "")}
                                    placeholder="如：0/1/2（留空为 NULL）"
                                    className="border rounded px-3 py-2 w-full mb-3"
                                />

                                <label className="block text-sm text-gray-600 mb-1">contact_type</label>
                                <input
                                    name="contact_type"
                                    defaultValue={editing === "create" ? "" : (editing as GuestbookMessage).contact_type ?? ""}
                                    placeholder="如：email / phone / wechat"
                                    className="border rounded px-3 py-2 w-full mb-3"
                                />

                                <label className="block text-sm text-gray-600 mb-1">contact_value</label>
                                <input
                                    name="contact_value"
                                    defaultValue={editing === "create" ? "" : (editing as GuestbookMessage).contact_value ?? ""}
                                    placeholder="联系方式值"
                                    className="border rounded px-3 py-2 w-full mb-3"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-600 mb-1">source（对应 sites.primary_domain）</label>
                                <input
                                    name="source"
                                    defaultValue={editing === "create" ? "" : (editing as GuestbookMessage).source ?? ""}
                                    placeholder="如：example.com 或 https://www.example.com"
                                    className="border rounded px-3 py-2 w-full mb-3"
                                />

                                <label className="block text-sm text-gray-600 mb-1">demand_content</label>
                                <textarea
                                    name="demand_content"
                                    defaultValue={editing === "create" ? "" : (editing as GuestbookMessage).demand_content ?? ""}
                                    rows={5}
                                    placeholder="需求内容"
                                    className="border rounded px-3 py-2 w-full"
                                />
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
