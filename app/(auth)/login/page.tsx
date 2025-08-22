'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [pwdEmail, setPwdEmail] = useState('');
    const [password, setPassword] = useState('');
    const [hint, setHint] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            if (data.session) router.replace('/dashboard');
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
            if (session) router.replace('/dashboard');
        });
        return () => sub.subscription.unsubscribe();
    }, [router]);

    async function onMagic(e: FormEvent) {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo:
                    typeof window !== 'undefined'
                        ? `${window.location.origin}/login`
                        : 'http://localhost:3000/login',
            },
        });
        setLoading(false);
        setHint(error ? `发送失败: ${error.message}` : '邮件已发送，请在邮箱完成登录。');
    }

    async function onPassword(e: FormEvent) {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email: pwdEmail,
            password,
        });
        setLoading(false);
        setHint(error ? `登录失败: ${error.message}` : null);
        if (!error) router.replace('/dashboard');
    }

    return (
        <main style={{ maxWidth: 420, margin: '60px auto' }}>
            <h2>管理端登录</h2>

            <section style={{ marginTop: 16, padding: 16, border: '1px solid #eee', borderRadius: 8 }}>
                <h4>邮箱魔法链接</h4>
                <form onSubmit={onMagic}>
                    <input
                        type="email"
                        placeholder="邮箱"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{ width: '100%', padding: 10, margin: '8px 0' }}
                    />
                    <button disabled={loading} style={{ padding: '10px 16px' }}>
                        {loading ? '发送中…' : '发送登录邮件'}
                    </button>
                </form>
            </section>

            <section style={{ marginTop: 16, padding: 16, border: '1px solid #eee', borderRadius: 8 }}>
                <h4>密码登录（可选）</h4>
                <form onSubmit={onPassword}>
                    <input
                        type="email"
                        placeholder="邮箱"
                        value={pwdEmail}
                        onChange={(e) => setPwdEmail(e.target.value)}
                        style={{ width: '100%', padding: 10, margin: '8px 0' }}
                    />
                    <input
                        type="password"
                        placeholder="密码"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ width: '100%', padding: 10, margin: '8px 0' }}
                    />
                    <button disabled={loading} style={{ padding: '10px 16px' }}>
                        {loading ? '登录中…' : '登录'}
                    </button>
                </form>
            </section>

            {hint && <p style={{ marginTop: 12 }}>{hint}</p>}
        </main>
    );
}
