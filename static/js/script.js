document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements for Kaza Tracker
    const summaryDisplay = document.getElementById('summary-display');
    const waqtCompletedInput = document.getElementById('waqt-completed');
    const noteInput = document.getElementById('note');
    const updateKazaBtn = document.getElementById('update-kaza-btn');
    const kazaLogTableBody = document.querySelector('#kaza-log-table tbody');
    const birthdateInput = document.getElementById('birthdate');
    const balighAgeSelect = document.getElementById('baligh-age');
    const calculateBtn = document.getElementById('calculate-btn');
    const initialResultDiv = document.getElementById('initial-result');
    
    // DOM Elements for Prayer Times
    const prayerTimesListDiv = document.getElementById('prayer-times-list');
    const countdownDiv = document.getElementById('countdown');
    const nextPrayerNameDiv = document.getElementById('next-prayer-name');

    // Global variables
    let kazaLog = [];
    let currentRemaining = 0;
    let prayerTimes = {};
    let countdownInterval;

    // ==========================================================
    // ############ PRAYER TIME FUNCTIONS (NEW) ############
    // ==========================================================

    const fetchPrayerTimes = async () => {
        try {
            const response = await fetch('/get_prayer_times');
            const result = await response.json();
            if (result.code === 200) {
                prayerTimes = result.data.timings;
                displayPrayerTimes();
                startCountdown();
            } else {
                prayerTimesListDiv.innerHTML = `<p class="error-text">নামাজের সময় আনতে সমস্যা হয়েছে।</p>`;
            }
        } catch (error) {
            console.error("Error fetching prayer times:", error);
            prayerTimesListDiv.innerHTML = `<p class="error-text">সার্ভার থেকে নামাজের সময় আনা সম্ভব হয়নি।</p>`;
        }
    };

    const displayPrayerTimes = () => {
        const prayerOrder = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        const prayerNamesBN = {'Fajr': 'ফজর', 'Dhuhr': 'যোহর', 'Asr': 'আসর', 'Maghrib': 'মাগরিব', 'Isha': 'ইশা'};
        
        prayerTimesListDiv.innerHTML = ''; // Clear loading text
        prayerOrder.forEach(name => {
            const time = prayerTimes[name];
            const item = document.createElement('div');
            item.className = 'prayer-item';
            item.id = `prayer-${name}`;
            item.innerHTML = `<span class="prayer-name">${prayerNamesBN[name]}</span> <span class="prayer-time">${time}</span>`;
            prayerTimesListDiv.appendChild(item);
        });
    };
    
    const startCountdown = () => {
        if (countdownInterval) clearInterval(countdownInterval);

        countdownInterval = setInterval(() => {
            const prayerOrder = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
            const prayerNamesBN = {'Fajr': 'ফজর', 'Dhuhr': 'যোহর', 'Asr': 'আসর', 'Maghrib': 'মাগরিব', 'Isha': 'ইশা'};
            const now = new Date();
            let nextPrayerTime = null;
            let nextPrayerName = '';

            for (const prayer of prayerOrder) {
                const [hour, minute] = prayerTimes[prayer].split(':');
                const prayerTimeToday = new Date();
                prayerTimeToday.setHours(parseInt(hour), parseInt(minute), 0, 0);

                if (prayerTimeToday > now) {
                    nextPrayerTime = prayerTimeToday;
                    nextPrayerName = prayer;
                    break;
                }
            }
            
            // If all prayers for today are done, next prayer is Fajr tomorrow
            if (!nextPrayerTime) {
                const [hour, minute] = prayerTimes['Fajr'].split(':');
                const fajrTomorrow = new Date();
                fajrTomorrow.setDate(fajrTomorrow.getDate() + 1);
                fajrTomorrow.setHours(parseInt(hour), parseInt(minute), 0, 0);
                nextPrayerTime = fajrTomorrow;
                nextPrayerName = 'Fajr';
            }

            const diff = nextPrayerTime - now;
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            countdownDiv.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            nextPrayerNameDiv.textContent = prayerNamesBN[nextPrayerName];
            
            // Highlight current prayer
            document.querySelectorAll('.prayer-item').forEach(item => item.classList.remove('current'));
            const currentPrayerItem = document.getElementById(`prayer-${nextPrayerName}`);
            if(currentPrayerItem) currentPrayerItem.classList.add('current');

        }, 1000);
    };

    // ==========================================================
    // ############ KAZA TRACKER FUNCTIONS (EXISTING) ############
    // ==========================================================

    const loadKazaData = async () => {
        try {
            const response = await fetch('/get_kaza_data');
            const result = await response.json();
            if (result.status === 'success' && result.data.length > 0) {
                kazaLog = result.data;
                const lastEntry = kazaLog[kazaLog.length - 1];
                currentRemaining = lastEntry['Remaining After'];
                updateSummary();
                populateLogTable();
            } else {
                summaryDisplay.innerHTML = '<p>কোনো হিসাব পাওয়া যায়নি। অনুগ্রহ করে প্রাথমিক হিসাব করুন।</p>';
            }
        } catch (error) {
            console.error('Error fetching Kaza data:', error);
        }
    };

    const updateSummary = () => {
        summaryDisplay.innerHTML = `<p>আপনার মোট বাকি কাজা নামাজ: <strong>${currentRemaining} ওয়াক্ত</strong></p>`;
    };

    const populateLogTable = () => {
        kazaLogTableBody.innerHTML = '';
        for (let i = kazaLog.length - 1; i >= 0; i--) {
            const entry = kazaLog[i];
            kazaLogTableBody.innerHTML += `<tr><td>${entry.Date}</td><td>${entry['Prayers Completed']}</td><td>${entry['Remaining After']}</td><td>${entry.Note}</td></tr>`;
        }
    };
    
    const saveData = async (dataToSave) => {
        try {
            const response = await fetch('/save_kaza_data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToSave) });
            const result = await response.json();
            if (result.status === 'success') {
                alert('আপনার হিসাব সফলভাবে গুগল শীটে সেভ হয়েছে।');
                loadKazaData();
            } else {
                alert(`ডেটা সেভ করতে সমস্যা হয়েছে: ${result.message}`);
            }
        } catch (error) {
            console.error('Error saving data:', error);
        }
    };
    
    calculateBtn.addEventListener('click', () => {
        const birthdate = new Date(birthdateInput.value);
        if (isNaN(birthdate.getTime())) { alert('দয়া করে একটি সঠিক জন্ম তারিখ দিন।'); return; }
        const balighAge = parseInt(balighAgeSelect.value);
        const balighDate = new Date(birthdate);
        balighDate.setFullYear(birthdate.getFullYear() + balighAge);
        const today = new Date();
        if (balighDate > today) { alert('আলহামদুলিল্লাহ, আপনার এখনো নামাজ ফরয হওয়ার বয়স হয়নি।'); return; }
        const totalWaqt = Math.ceil(Math.abs(today - balighDate) / (1000 * 60 * 60 * 24)) * 5;
        initialResultDiv.innerHTML = `<p>আপনার মোট কাজা প্রায়: <strong>${totalWaqt} ওয়াক্ত</strong></p><button id="save-initial-btn" data-waqt="${totalWaqt}">এই হিসাবটি সেভ করুন</button>`;
        initialResultDiv.style.display = 'block';
    });

    document.addEventListener('click', (event) => {
        if (event.target && event.target.id === 'save-initial-btn') {
            if (kazaLog.length > 0 && !confirm("আপনার ইতোমধ্যে একটি হিসাব আছে। আপনি কি নতুন করে শুরু করতে চান?")) return;
            const data = { date: new Date().toLocaleDateString('bn-BD'), completed: 0, remaining: parseInt(event.target.dataset.waqt), note: 'প্রাথমিক হিসাব' };
            saveData(data);
        }
    });

    updateKazaBtn.addEventListener('click', () => {
        const completed = parseInt(waqtCompletedInput.value);
        if (isNaN(completed) || completed <= 0) { alert('দয়া করে আদায় করা নামাজের সঠিক সংখ্যা দিন।'); return; }
        if (currentRemaining < completed && !confirm(`আপনার বাকি আছে ${currentRemaining} ওয়াক্ত, কিন্তু আপনি ${completed} ওয়াক্ত লিখেছেন। হিসাব কি সম্পন্ন হয়ে গেছে?`)) return;
        const data = { date: new Date().toLocaleDateString('bn-BD'), completed: completed, remaining: Math.max(0, currentRemaining - completed), note: noteInput.value };
        saveData(data);
        waqtCompletedInput.value = '';
        noteInput.value = '';
    });

    // ==========================================================
    // ############ INITIAL FUNCTION CALLS ############
    // ==========================================================
    loadKazaData();
    fetchPrayerTimes();
});
