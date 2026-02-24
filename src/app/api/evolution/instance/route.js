import { NextResponse } from 'next/server';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

export async function POST(req) {
    try {
        const { empresaId, action } = await req.json();

        if (!empresaId) {
            return NextResponse.json({ error: 'ID da Empresa não fornecido.' }, { status: 400 });
        }

        // Nome único para a instância no servidor da Evolution API
        const instanceName = `tmttech_${empresaId}`;

        if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
            // Modo SIMULAÇÃO se as chaves não estiverem configuradas
            console.log(`[SIMULAÇÃO API] Requisição para Evolution: Ação=${action}, Instancia=${instanceName}`);
            if (action === 'create_and_qr') {
                return NextResponse.json({
                    simulated: true,
                    message: "Modo Simulação. As variáveis EVOLUTION_API não estão configuradas.",
                    base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" // pixel transparente simulando QR
                });
            }
        }

        // 1. AÇÃO: CRIAR INSTÂNCIA E OBTER QR CODE
        if (action === 'create_and_qr') {
            // Passo A: Tentar criar a instância (se já existir, a API retorna erro, mas podemos ignorar e pedir o QR)
            try {
                await fetch(`${EVOLUTION_API_URL}/instance/create`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': EVOLUTION_API_KEY
                    },
                    body: JSON.stringify({
                        instanceName: instanceName,
                        qrcode: true, // Já pede pra retornar o QR Code na criação
                        integration: "WHATSAPP-BAILEYS"
                    })
                });
            } catch (e) {
                console.log("Instância pode já existir, prosseguindo para buscar QR Code...");
            }

            // Passo B: Buscar o status da conexão atual / QR Code
            const connectResponse = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
                method: 'GET',
                headers: {
                    'apikey': EVOLUTION_API_KEY
                }
            });

            if (!connectResponse.ok) {
                throw new Error("Falha ao se conectar à Evolution API.");
            }

            const connectData = await connectResponse.json();

            // Retorna a Base64 desenhável do QR Code
            return NextResponse.json({
                instanceName: connectData.instance?.instanceName,
                base64: connectData.base64,
                state: connectData.instance?.state // 'connecting', 'open', 'close'
            }, { status: 200 });
        }

        // 2. AÇÃO: VERIFICAR STATUS
        if (action === 'status') {
            const statusResponse = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
                method: 'GET',
                headers: {
                    'apikey': EVOLUTION_API_KEY
                }
            });

            if (!statusResponse.ok) {
                return NextResponse.json({ state: 'disconnected' }, { status: 200 });
            }

            const statusData = await statusResponse.json();
            return NextResponse.json({
                state: statusData.instance?.state || 'disconnected'
            }, { status: 200 });
        }

        return NextResponse.json({ error: 'Ação Inválida' }, { status: 400 });

    } catch (error) {
        console.error('Erro na Rota Evolution:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
