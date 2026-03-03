import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

// Rota Interna Segura para o Flow Builder
// Uso: POST /api/webhook/status
// Body: { telefone: "553799999999", status: "confirmado" } ou "cancelado"
export async function POST(req) {
    try {
        const supabase = createSupabaseClient(true); // Precisamos usar o Service Role (true) para contornar o RLS e garantir edição via API externa
        const bodyText = await req.text();

        let data = {};
        try {
            data = JSON.parse(bodyText);
        } catch {
            return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
        }

        let { telefone, status } = data;

        if (!telefone || !status) {
            return NextResponse.json({ error: 'Campos telefone e status são obrigatórios' }, { status: 400 });
        }

        // 1. Normaliza o Telefone (Regra do 9º Dígito do Brasil)
        if (typeof telefone === 'string') {
            telefone = telefone.replace(/\D/g, '');
            if (telefone.startsWith('55') && telefone.length === 12) {
                telefone = telefone.substring(0, 4) + '9' + telefone.substring(4);
            }
        }

        // 2. Busca o Lead dono desse telefone (pegamos o id interno dele)
        const { data: lead, error: leadError } = await supabase
            .from('leads')
            .select('id')
            .eq('telefone', telefone)
            .maybeSingle();

        if (leadError || !lead) {
            console.error(`[WEBHOOK STATUS] Erro ao achar Lead para telefone: ${telefone}`);
            return NextResponse.json({ error: 'Lead não encontrado no banco de dados' }, { status: 404 });
        }

        // 3. Atualiza o Agendamento MAIS RECENTE PENDENTE desse Lead
        // Como o webhook é pra hoje, pegamos qualquer agendamento não-cancelado dele que seja de hoje em diante
        const hojeIso = new Date().toISOString().split('T')[0];

        const { data: agendamentos, error: agFetchError } = await supabase
            .from('agendamentos')
            .select('id, status, date_time')
            .eq('lead_id', lead.id)
            .gte('date_time', hojeIso)
            .not('status', 'eq', 'cancelado') // evita cancelar oq ja ta cancelado
            .order('date_time', { ascending: true }) // pega o evento mais imediato dele
            .limit(1);

        if (agFetchError || !agendamentos || agendamentos.length === 0) {
            console.log(`[WEBHOOK STATUS] Nenhum agendamento ativo encontrado para lead ${lead.id}`);
            return NextResponse.json({ error: 'Nenhum agendamento futuro/pendente encontrado para este usuário' }, { status: 404 });
        }

        const targetAgendamento = agendamentos[0];

        // Se o agendamento já tiver o status desejado (ex: usuario clicou Confirmar 2x)
        if (targetAgendamento.status === status) {
            return NextResponse.json({ message: 'Agendamento já estava neste status', agendamento_id: targetAgendamento.id }, { status: 200 });
        }

        // 4. Executa o Update Seguro
        const { error: updateError } = await supabase
            .from('agendamentos')
            .update({ status: status })
            .eq('id', targetAgendamento.id);

        if (updateError) {
            console.error(`[WEBHOOK STATUS] Erro ao atualizar Agendamento ${targetAgendamento.id}:`, updateError);
            return NextResponse.json({ error: 'Falha ao atualizar status' }, { status: 500 });
        }

        console.log(`[WEBHOOK STATUS] ✅ Status alterado para '${status}' no Agendamento ${targetAgendamento.id} do Lead ${lead.id}`);

        return NextResponse.json({
            message: 'Status atualizado com sucesso!',
            agendamento_id: targetAgendamento.id,
            novo_status: status
        }, { status: 200 });

    } catch (error) {
        console.error('[WEBHOOK STATUS] Erro Interno Crítico:', error);
        return NextResponse.json({ error: 'Erro de processamento interno do Webhook' }, { status: 500 });
    }
}
