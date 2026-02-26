require('dotenv').config({ path: '.env.local' });

async function testButtonsDirectly() {
    const phone = '553788123971'; // Thales
    const text = 'Como posso te ajudar hoje?';
    const buttonsArray = ['Agendar Horário', 'Duvidas'];
    const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'tmttech_manager';

    const url = `${process.env.EVOLUTION_API_URL}/message/sendButtons/${instanceName}`;

    // Evolution v2 sometimes requires this exact format depending on the sub-version
    const payload = {
        number: phone,
        options: { delay: 1200, presence: "composing" },
        // Instead of root properties, use interactive message format
        message: {
            text: text,
            footer: "Selecione uma opção",
            buttons: buttonsArray.map((btnTitle, index) => ({
                id: `btn-${index}`,
                text: btnTitle.substring(0, 20)
            }))
        }
    };

    console.log("Sending payload to:", url);
    console.log(JSON.stringify(payload, null, 2));

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': process.env.EVOLUTION_API_KEY.trim()
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));
        console.log(`\nStatus: ${response.status}`);
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

testButtonsDirectly();
