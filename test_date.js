const appointments = [
    { appointment_date: '2026-02-27', appointment_time: '17:30' }
];
const now = new Date('2026-02-27T18:26:00Z'); // Mocking 15:26 BRT
const twoHoursFromNow = new Date(now.getTime() + (2 * 60 * 60 * 1000));
const twoHoursAndFifteenFromNow = new Date(now.getTime() + (2.25 * 60 * 60 * 1000));

appointments.forEach(ag => {
    const agDateTime = new Date(`${ag.appointment_date}T${ag.appointment_time}-03:00`);
    console.log('agDateTime:', agDateTime.toISOString());
    console.log('twoHoursFromNow:', twoHoursFromNow.toISOString());
    console.log('twoHoursAndFifteen:', twoHoursAndFifteenFromNow.toISOString());
    if (agDateTime > twoHoursFromNow && agDateTime <= twoHoursAndFifteenFromNow) {
        console.log('IN WINDOW');
    } else {
        console.log('OUT OF WINDOW');
    }
});
