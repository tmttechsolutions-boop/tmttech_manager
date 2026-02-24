import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export default async function LoginPage({ searchParams }) {
    const params = await searchParams;
    const message = params?.message;

    const signIn = async (formData) => {
        'use server'

        const email = formData.get('email')
        const password = formData.get('password')
        const supabase = await createClient()

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            return redirect('/login?message=Não foi possível validar as credenciais')
        }

        return redirect('/')
    }

    const signUp = async (formData) => {
        'use server'

        const email = formData.get('email')
        const password = formData.get('password')
        const nomeEmpresa = formData.get('nomeEmpresa')
        const supabase = await createClient()

        const { data: authData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
        })

        if (signUpError) {
            return redirect('/login?message=' + signUpError.message)
        }

        // Se criou o usuário, registra o Tenant (A Empresa)
        if (authData?.user) {
            const { error: insertError } = await supabase.from('empresas').insert({
                nome: nomeEmpresa || 'Minha Empresa',
                auth_user_id: authData.user.id
            });

            if (insertError) {
                console.error("Erro ao criar empresa", insertError);
            }
        }

        return redirect('/login?message=Conta criada com sucesso! Verifique seu email para confirmar ou faça login.')
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ width: '48px', height: '48px', background: 'var(--brand-purple)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>
                        🚀
                    </div>
                    <h1 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>TMT Tech Manager</h1>
                    <p className="text-muted" style={{ fontSize: '0.9rem' }}>Faça login na sua agência</p>
                </div>

                {message && (
                    <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', marginBottom: '24px', fontSize: '0.85rem', textAlign: 'center' }}>
                        {message}
                    </div>
                )}

                <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    <div className="form-group">
                        <label>Nome da Barbearia (Apenas Cadastro)</label>
                        <input
                            type="text"
                            name="nomeEmpresa"
                            className="form-input"
                            placeholder="Ex: Barbearia do João"
                        />
                    </div>

                    <div className="form-group">
                        <label>E-mail Corporativo</label>
                        <input
                            type="email"
                            name="email"
                            required
                            className="form-input"
                            placeholder="seu@email.com"
                        />
                    </div>

                    <div className="form-group">
                        <label>Senha de Acesso</label>
                        <input
                            type="password"
                            name="password"
                            required
                            className="form-input"
                            placeholder="••••••••"
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                        <button formAction={signIn} className="brand-button" style={{ flex: 1, padding: '12px' }}>
                            Entrar
                        </button>
                        <button formAction={signUp} className="brand-button" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px' }}>
                            Criar Conta
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
