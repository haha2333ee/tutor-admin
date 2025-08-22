// lib/supabase/client.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 同步创建客户端，避免顶层 await 警告
export const supabase = createClient(url, anon, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
});

// 如需在组件中查看会话，请在组件/函数内调用：
// const { data } = await supabase.auth.getSession();
// console.log("session?", !!data.session);
