// app/page.tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function Home() {
    const router = useRouter();
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            router.replace(data.session ? '/dashboard' : '/login');
        });
    }, [router]);
    return null;
}
