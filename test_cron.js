const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envKeys = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => {
    if (line.includes('=')) {
        const idx = line.indexOf('=');
        acc[line.substring(0, idx).trim()] = line.substring(idx + 1).trim().replace('\r', '');
    }
    return acc;
}, {});

const EXTERNAL_URL = envKeys.EXTERNAL_SUPABASE_URL;
const EXTERNAL_KEY = envKeys.EXTERNAL_SUPABASE_ANON_KEY;
const supabaseExternal = createClient(EXTERNAL_URL, EXTERNAL_KEY);

function parseAppointmentDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    return new Date(`${dateStr}T${timeStr}-03:00`);
}

async function run() {
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + (2 * 60 * 60 * 1000));
    const twoHoursAndFifteenFromNow = new Date(now.getTime() + (2.25 * 60 * 60 * 1000));
    const todayStr = now.toISOString().split('T')[0];

    console.log("NOW (local Node):", now.toString());
    console.log("NOW (UTC ISO):", now.toISOString());
    console.log("twoHoursFromNow (ISO):", twoHoursFromNow.toISOString());
    console.log("twoHoursAndFifteenFromNow (ISO):", twoHoursAndFifteenFromNow.toISOString());
    console.log("todayStr:", todayStr);

    const { data: appointments, error: appError } = await supabaseExternal
        .from('appointments')
        .select('*, clients(name, phone)')
        .eq('status', 'pendente')
        .eq('reminder_sent', false)
        .gte('appointment_date', todayStr);

    if (appError) {
        console.error("DB Error:", appError);
        return;
    }
    console.log(`Found ${appointments.length} pending appointments >= ${todayStr}`);

    for (const ag of appointments) {
        if (!ag.clients || !ag.clients.phone) {
            console.log(`- Ag [${ag.id}] Pulo: Sem telefone`);
            continue;
        }
        const agDateTime = parseAppointmentDateTime(ag.appointment_date, ag.appointment_time);

        const isTimeMatch = agDateTime > twoHoursFromNow && agDateTime <= twoHoursAndFifteenFromNow;

        console.log(`- Ag [${ag.id}] ${ag.appointment_date} ${ag.appointment_time}`);
        console.log(`  Parsed Date: ${agDateTime.toISOString()}`);
        console.log(`  TimeMatch: ${isTimeMatch}`);

        if (agDateTime < now) {
            let diffMins = (now - agDateTime) / 60000;
            console.log(`  > PAST by ${diffMins.toFixed(1)} mins`);
        } else {
            let diffHr = (agDateTime - now) / 3600000;
            console.log(`  > FUTURE by ${diffHr.toFixed(2)} hours`);
        }
    }
}
run();
