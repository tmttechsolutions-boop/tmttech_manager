import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Rota Interna Segura para o Flow Builder
// Uso: POST /api/webhook/status
// Body: { telefone: "553799999999", status: "confirmado" } ou "cancelado"
export async function POST(req) {
    try {
        const EXTERNAL_URL = process.env.EXTERNAL_SUPABASE_URL;
        const EXTERNAL_KEY = process.env.EXTERNAL_SUPABASE_ANON_KEY;

        if (!EXTERNAL_URL || !EXTERNAL_KEY) {
            throw new Error("Credenciais do banco de dados externo não configuradas.");
        }

        const supabaseExternal = createClient(EXTERNAL_URL, EXTERNAL_KEY);
        const bodyText = await req.text();
        console.log(`[WEBHOOK STATUS] Recebido: ${bodyText}`);

        let data = {};
        try {
            data = JSON.parse(bodyText);
        } catch {
            console.error(`[WEBHOOK STATUS] JSON INVÁLIDO: ${bodyText}`);
            return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
        }

        let { telefone, status } = data;

        if (!telefone || !status) {
            return NextResponse.json({ error: 'Campos telefone e status são obrigatórios' }, { status: 400 });
        }

        // 1. Normaliza o Telefone (Remove letras e caracteres)
        if (typeof telefone === 'string') {
            telefone = telefone.replace(/\D/g, '');
        }

        // Remove código do país (55) pra buscar na tabela do SaaS que geralmente guarda só DDD+Numero
        let searchPhone = telefone;
        if (searchPhone.startsWith('55') && searchPhone.length >= 12) {
            searchPhone = searchPhone.substring(2);
        }

        // NOVO: A base SaaS guarda os numeros as vezes com 8 digitos (ex: (37) 98822-3013) 
        // e as vezes com 9 (ex: (37) 99822-3013). O WhatsApp manda 9.
        let searchVariations = [searchPhone];
        if (searchPhone.length === 11) {
            searchVariations.push(searchPhone.substring(0, 2) + searchPhone.substring(3));
        }

        // 2. Busca na tabela de "clients" todos
        const { data: clients, error: clientError } = await supabaseExternal
            .from('clients')
            .select('id, phone');

        if (clientError || !clients || clients.length === 0) {
            console.error(`[WEBHOOK STATUS] Erro ao achar Clients no SaaS`);
            return NextResponse.json({ error: 'Nenhum Cliente cadastrado no SaaS' }, { status: 404 });
        }

        // Encontra o exato testando as variacoes
        const targetClient = clients.find(c => {
            const dbPhone = c.phone.replace(/\D/g, '');
            return searchVariations.some(v => v.endsWith(dbPhone) || dbPhone.endsWith(v));
        });

        if (!targetClient) {
            console.log(`[WEBHOOK STATUS] Nenhum cliente real com telefone ${telefone} encontrado`);
            return NextResponse.json({ error: 'Nenhum cliente com este telefone encontrado' }, { status: 404 });
        }

        // 3. Atualiza o Agendamento MAIS RECENTE PENDENTE desse Cliente no SaaS
        const agora = new Date();
        agora.setHours(agora.getHours() - 3); // Fuso do Brasil (GMT-3) pra rodar certo na Vercel

        const hojeIso = agora.toISOString().split('T')[0];
        const horaAtual = agora.toISOString().split('T')[1].substring(0, 5); // Ex: "14:30"

        const { data: appointments, error: appFetchError } = await supabaseExternal
            .from('appointments')
            .select('id, status, appointment_date, appointment_time')
            .eq('client_id', targetClient.id)
            .gte('appointment_date', hojeIso)
            // Se for hoje, só pegamos horários do futuro. Se for data futura, pega qualquer um.
            // O Supabase tem uma limitação com OR e GTE combinados via API simples, 
            // então vamos buscar todos futuros não cancelados e filtrar no Javascript.
            .not('status', 'eq', 'cancelado')
            .order('appointment_date', { ascending: true })
            .order('appointment_time', { ascending: true });

        // Se for hoje, só pegamos horários do futuro. Se for data futura, pega qualquer um.
        // O Supabase tem uma limitação com OR e GTE combinados via API simples, 
        // então vamos buscar todos futuros não cancelados e filtrar no Javascript.
        const futureUpcomingAppts = appointments.filter(app => {
            if (app.appointment_date === hojeIso) {
                return app.appointment_time >= horaAtual;
            }
            return true; // Se for dia seguinte, serve qualquer horario futuro
        });

        if (futureUpcomingAppts.length === 0) {
            console.log(`[WEBHOOK STATUS] Nenhum agendamento pendente/futuro encontrado para cliente ${targetClient.id}`);
            return NextResponse.json({ error: 'Nenhum agendamento futuro/pendente encontrado' }, { status: 404 });
        }

        const targetAppt = futureUpcomingAppts[0];

        if (targetAppt.status === status) {
            return NextResponse.json({ message: 'Agendamento já estava neste status', agendamento_id: targetAppt.id }, { status: 200 });
        }

        // 4. Executa o Update Seguro
        const { error: updateError } = await supabaseExternal
            .from('appointments')
            .update({ status: status })
            .eq('id', targetAppt.id);

        if (updateError) {
            console.error(`[WEBHOOK STATUS] Erro ao atualizar Agendamento ${targetAppt.id}:`, updateError);
            return NextResponse.json({ error: 'Falha ao atualizar status' }, { status: 500 });
        }

        console.log(`[WEBHOOK STATUS] ✅ Status alterado para '${status}' no Agendamento ${targetAppt.id} do Client ${targetClient.id}`);

        return NextResponse.json({
            message: 'Status atualizado com sucesso!',
            agendamento_id: targetAppt.id,
            novo_status: status
        }, { status: 200 });

    } catch (error) {
        console.error('[WEBHOOK STATUS] Erro Interno Crítico:', error);
        return NextResponse.json({ error: 'Erro de processamento interno do Webhook' }, { status: 500 });
    }
}
