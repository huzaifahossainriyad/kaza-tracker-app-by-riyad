document.addEventListener('DOMContentLoaded', () => {
    // Prayer names constant for easy access
    const PRAYER_NAMES = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha", "Witr"];
    const PRAYER_NAMES_BN = { Fajr: 'ফজর', Dhuhr: 'যোহর', Asr: 'আসর', Maghrib: 'মাগরিব', Isha: 'ইশা', Witr: 'বিতর' };

    // --- DOM Element Selections ---
    const summaryDisplay = document.getElementById('summary-display');
    const dailyUpdateForm = document.getElementById('daily-update-form');
    const dailyNoteInput = document.getElementById('daily-note');
    const updateKazaBtn = document.getElementById('update-kaza-btn');
    const kazaLogTableBody = document.querySelector('#kaza-log-table tbody');
    
    // Auto calculator elements
    const birthdateInput = document.getElementById('birthdate');
    const balighAgeInput = document.getElementById('baligh-age');
    const calculateBtn = document.getElementById('calculate-btn');
    const autoCalcResultDiv = document.getElementById('auto-calc-result');

    // Manual setup elements
    const manualSetupForm = document.getElementById('manual-setup-form');
    const saveManualBtn = document.getElementById('save-manual-btn');
    
    // Prayer time elements
    const prayerTimesListDiv = document.getElementById('prayer-times-list');
    const countdownDiv = document.getElementById('countdown');
    const nextPrayerNameDiv = document.getElementById('next-prayer-name');
    
    // Global state
    let countdownInterval;

    // --- Kaza Data Management ---

    const loadKazaData = async () => {
        try {
            const response = await fetch('/get_kaza_data');
            const result = await response.json();

            if (result.status !== 'success') {
                throw new Error(result.message);
            }

            const logs = result.data;
            const currentTotals = calculateCurrentTotals(logs);

            displaySummary(currentTotals);
            populateLogTable(logs);
            
        } catch (error) {
            console.error('Error fetching Kaza data:', error);
            summaryDisplay.innerHTML = `<p style="color: red;">ডেটা লোড করতে সমস্যা হয়েছে।</p>`;
        }
    };

    const calculateCurrentTotals = (logs) => {
        const totals = { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0, Witr: 0 };
        if (!logs || logs.length === 0) {
            return totals;
        }
        
        // Sum up all entries for each prayer
        logs.forEach(log => {
            PRAYER_NAMES.forEach(prayer => {
                totals[prayer] += Number(log[prayer]) || 0;
            });
        });
        return totals;
    };

    const displaySummary = (totals) => {
        summaryDisplay.innerHTML = ''; // Clear loading text
        if (Object.values(totals).every(v => v === 0)) {
             summaryDisplay.innerHTML = '<p>কোনো হিসাব পাওয়া যায়নি। অনুগ্রহ করে নিচে থেকে প্রাথমিক হিসাব সেটআপ করুন।</p>';
             return;
        }
        PRAYER_NAMES.forEach(prayer => {
            const item = `
                <div class="prayer-summary-item">
                    <span class="prayer-label">${PRAYER_NAMES_BN[prayer]}</span>
                    <span class="prayer-count">${totals[prayer]}</span>
                </div>`;
            summaryDisplay.innerHTML += item;
        });
    };
    
    const populateLogTable = (logs) => {
        kazaLogTableBody.innerHTML = '';
        // Show logs in reverse order (newest first)
        [...logs].reverse().forEach(log => {
            const row = `<tr>
                <td>${log.Date}</td>
                <td>${log.Note}</td>
                <td>${log.Fajr}</td>
                <td>${log.Dhuhr}</td>
                <td>${log.Asr}</td>
                <td>${log.Maghrib}</td>
                <td>${log.Isha}</td>
                <td>${log.Witr}</td>
            </tr>`;
            kazaLogTableBody.innerHTML += row;
        });
    };

    const saveData = async (dataToSave) => {
        try {
            const response = await fetch('/save_kaza_data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToSave) });
            const result = await response.json();
            
            if (result.status === 'success') {
                alert('আপনার হিসাব সফলভাবে গুগল শীটে সেভ হয়েছে।');
                loadKazaData(); // Reload all data to reflect changes
            } else {
                alert(`ডেটা সেভ করতে সমস্যা হয়েছে: ${result.message}`);
            }
        } catch (error) {
            console.error('Error saving data:', error);
            alert('সার্ভারের সাথে সংযোগ করতে সমস্যা হয়েছে।');
        }
    };

    // --- Event Handlers ---

    calculateBtn.addEventListener('click', () => {
        const birthdate = new Date(birthdateInput.value);
        const balighAge = parseFloat(balighAgeInput.value);

        if (isNaN(birthdate.getTime()) || isNaN(balighAge) || balighAge < 7 || balighAge > 15) {
            alert('অনুগ্রহ করে সঠিক জন্ম তারিখ এবং ৭ থেকে ১৫ এর মধ্যে বয়স দিন।');
            return;
        }

        const balighDate = new Date(birthdate);
        balighDate.setFullYear(birthdate.getFullYear() + Math.floor(balighAge));
        balighDate.setMonth(birthdate.getMonth() + (balighAge % 1) * 12);

        const today = new Date();
        if (balighDate > today) {
            alert('আলহামদুলিল্লাহ, আপনার এখনো নামাজ ফরয হওয়ার বয়স হয়নি।');
            return;
        }

        const totalDays = Math.ceil(Math.abs(today - balighDate) / (1000 * 60 * 60 * 24));
        const totalWaqt = { Fajr: totalDays, Dhuhr: totalDays, Asr: totalDays, Maghrib: totalDays, Isha: totalDays, Witr: totalDays };

        autoCalcResultDiv.innerHTML = '';
        PRAYER_NAMES.forEach(prayer => {
            autoCalcResultDiv.innerHTML += `
                <div class="prayer-summary-item">
                    <span class="prayer-label">${PRAYER_NAMES_BN[prayer]}</span>
                    <span class="prayer-count">${totalWaqt[prayer]}</span>
                </div>`;
        });
        
        const saveButton = document.createElement('button');
        saveButton.id = 'save-auto-calc-btn';
        saveButton.textContent = 'এই স্বয়ংক্রিয় হিসাব সেভ করুন';
        autoCalcResultDiv.appendChild(saveButton);
        autoCalcResultDiv.style.display = 'grid';
        
        saveButton.addEventListener('click', () => {
            const dataToSave = { ...totalWaqt, date: new Date().toLocaleDateString('bn-BD'), note: `স্বয়ংক্রিয় হিসাব (${balighAge} বছর)` };
            saveData(dataToSave);
        });
    });
    
    saveManualBtn.addEventListener('click', () => {
        const dataToSave = { date: new Date().toLocaleDateString('bn-BD'), note: 'ম্যানুয়াল প্রাথমিক হিসাব' };
        let total = 0;
        manualSetupForm.querySelectorAll('input').forEach(input => {
            const prayer = input.dataset.prayer;
            const value = parseInt(input.value) || 0;
            dataToSave[prayer] = value;
            total += value;
        });

        if (total === 0) {
            alert('অনুগ্রহ করে অন্তত একটি নামাজের সংখ্যা লিখুন।');
            return;
        }
        saveData(dataToSave);
    });

    updateKazaBtn.addEventListener('click', () => {
        const dataToSave = { date: new Date().toLocaleDateString('bn-BD'), note: dailyNoteInput.value || 'দৈনিক আদায়' };
        let total = 0;
        dailyUpdateForm.querySelectorAll('input').forEach(input => {
            const prayer = input.dataset.prayer;
            // Daily updates are saved as negative numbers
            const value = (parseInt(input.value) || 0) * -1;
            dataToSave[prayer] = value;
            total += value;
        });

        if (total === 0) {
            alert('অনুগ্রহ করে অন্তত একটি আদায় করা নামাজের সংখ্যা লিখুন।');
            return;
        }
        saveData(dataToSave);
        // Clear inputs after submission
        dailyUpdateForm.querySelectorAll('input').forEach(input => input.value = '');
        dailyNoteInput.value = '';
    });


    // --- Prayer Time Functions (from previous step) ---
    const fetchPrayerTimes = async () => {
        try {
            const response = await fetch('/get_prayer_times');
            const result = await response.json();
            if (result.code === 200) {
                const prayerTimes = result.data.timings;
                displayPrayerTimes(prayerTimes);
                startCountdown(prayerTimes);
            }
        } catch (error) {
            console.error("Error fetching prayer times:", error);
        }
    };
    const displayPrayerTimes = (times) => {
        prayerTimesListDiv.innerHTML = '';
        ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].forEach(name => {
            prayerTimesListDiv.innerHTML += `<div class="prayer-item" id="prayer-${name}"><span class="prayer-name">${PRAYER_NAMES_BN[name]}</span> <span class="prayer-time">${times[name]}</span></div>`;
        });
    };
    const startCountdown = (times) => {
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = setInterval(() => {
            const now = new Date();
            let nextPrayerTime, nextPrayerName;
            for (const prayer of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
                const [h, m] = times[prayer].split(':');
                const pTime = new Date();
                pTime.setHours(parseInt(h), parseInt(m), 0, 0);
                if (pTime > now) {
                    nextPrayerTime = pTime;
                    nextPrayerName = prayer;
                    break;
                }
            }
            if (!nextPrayerTime) {
                const [h, m] = times['Fajr'].split(':');
                const pTime = new Date();
                pTime.setDate(pTime.getDate() + 1);
                pTime.setHours(parseInt(h), parseInt(m), 0, 0);
                nextPrayerTime = pTime;
                nextPrayerName = 'Fajr';
            }
            const diff = nextPrayerTime - now;
            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            countdownDiv.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            nextPrayerNameDiv.textContent = PRAYER_NAMES_BN[nextPrayerName];
            document.querySelectorAll('.prayer-item').forEach(i => i.classList.remove('current'));
            document.getElementById(`prayer-${nextPrayerName}`)?.classList.add('current');
        }, 1000);
    };

    // --- Initial Function Calls ---
    loadKazaData();
    fetchPrayerTimes();
});

