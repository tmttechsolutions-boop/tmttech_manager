require('dotenv').config({ path: '.env.local' });

async function testButtonsDirectly() {
    const phone = '553788123971'; // Thales
    const text = 'Como posso te ajudar hoje?';
    const buttonsArray = ['Agendar Horário', 'Duvidas'];
    const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'tmttech_manager';

    const url = `${process.env.EVOLUTION_API_URL}/message/sendButtons/${instanceName}`;

    // Evolution v2 expects a simpler array format often documented as:
    // "buttons": [ { "buttonId": "id1", "buttonText": { "displayText": "Option 1" }, "type": 1 } ]
    // or simply just looking at their v2 docs for sendButtons... let's try another variation

    const formattedButtons = buttonsArray.map((btnTitle, index) => ({
        type: "reply",
        reply: {
            id: `btn-${index}`,
            title: btnTitle.substring(0, 20)
        }
    }));

    const payloadAlternative = {
        number: phone,
        options: { delay: 1200, presence: "composing" },
        title: "TMT Tech",
        description: text,
        footerText: "Selecione uma opção",
        buttons: formattedButtons
    };

    console.log("Sending payload to:", url);
    console.log(JSON.stringify(payloadAlternative, null, 2));

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': process.env.EVOLUTION_API_KEY.trim()
            },
            body: JSON.stringify(payloadAlternative)
        });

        const data = await response.json().catch(() => ({}));
        console.log(`\nStatus: ${response.status}`);
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

testButtonsDirectly();
