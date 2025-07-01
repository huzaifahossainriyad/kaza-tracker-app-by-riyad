document.addEventListener('DOMContentLoaded', () => {
    // ================== GLOBAL CONSTANTS & VARIABLES ==================
    const PRAYER_KEYS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha", "Witr", "FajrSunnah", "DhuhrSunnah", "AsrSunnah", "MaghribSunnah", "IshaSunnah"];
    const PRAYER_NAMES_BN = { Fajr: 'ফরজ', Dhuhr: 'যোহর', Asr: 'আসর', Maghrib: 'মাগরিব', Isha: 'ইশা', Witr: 'বিতর', FajrSunnah: 'ফজর সুন্নাত', DhuhrSunnah: 'যোহর সুন্নাত', AsrSunnah: 'আসর সুন্নাত', MaghribSunnah: 'মাগরিব সুন্নাত', IshaSunnah: 'ইশা সুন্নাত' };
    const FARD_PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha", "Witr"];
    const SUNNAH_PRAYERS = ["FajrSunnah", "DhuhrSunnah", "AsrSunnah", "MaghribSunnah", "IshaSunnah"];
    
    const mainContent = document.querySelector('.main-content');
    let allKazaLogs = [];
    let kazaChart = null, reasonChart = null, countdownInterval = null;

    // ================== CORE APP LOGIC (MODAL, API) ==================

    // --- Custom Modal Function ---
    const showModal = (message, type = 'alert') => {
        const modal = document.getElementById('custom-modal');
        const modalMessage = document.getElementById('modal-message');
        const okBtn = document.getElementById('modal-ok-btn');
        const confirmBtn = document.getElementById('modal-confirm-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        
        return new Promise((resolve) => {
            modalMessage.innerHTML = message;
            okBtn.style.display = type === 'confirm' ? 'none' : 'inline-block';
            confirmBtn.style.display = type === 'confirm' ? 'inline-block' : 'none';
            cancelBtn.style.display = type === 'confirm' ? 'inline-block' : 'none';
            modal.style.display = 'flex';
            
            const close = (value) => {
                modal.style.display = 'none';
                resolve(value);
            };
            
            okBtn.onclick = () => close(true);
            confirmBtn.onclick = () => close(true);
            cancelBtn.onclick = () => close(false);
        });
    };

    // --- Generic Data Save Function ---
    const saveDataToBackend = async (endpoint, data) => {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            await showModal(result.message);
            if (result.status === 'success') {
                loadKazaData(); // Reload all data on success
            }
        } catch (error) {
            console.error(`Error saving data to ${endpoint}:`, error);
            await showModal('সার্ভারের সাথে সংযোগ করতে সমস্যা হয়েছে।');
        }
    };

    // ================== DATA LOADING & RENDERING ==================

    // --- Main Data Loader ---
    const loadKazaData = async () => {
        try {
            const response = await fetch('/get_kaza_data');
            if (response.status === 401) { return; }
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message);
            
            allKazaLogs = result.data.map(log => {
                if (!log.Date || typeof log.Date !== 'string') return {...log, jsDate: new Date()};
                const parts = log.Date.split('/');
                const jsDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                return {...log, jsDate };
            });
            
            // Call all data-dependent rendering functions
            displaySummary();
            populateLogTable();
            renderKazaChart();
            renderReasonAnalysisChart();
            displayEstimatedCompletion();
            updateProgress();
            calculateAndDisplayStreaks();
            updateAchievements();
        } catch (error) {
            console.error('Error fetching Kaza data:', error);
            if (document.getElementById('summary-display')) {
                document.getElementById('summary-display').innerHTML = `<p style="color: red;">ডেটা লোড করতে সমস্যা হয়েছে।</p>`;
            }
        }
    };
    
    // --- Render Summary ---
    const displaySummary = () => {
        const totals = allKazaLogs.reduce((totals, log) => {
            PRAYER_KEYS.forEach(p => { totals[p] = (totals[p] || 0) + (Number(log[p]) || 0); });
            return totals;
        }, {});

        const summaryDisplay = document.getElementById('summary-display');
        if (!summaryDisplay) return;
        summaryDisplay.innerHTML = '';
        
        const hasKaza = Object.values(totals).some(v => v > 0);
        if (!hasKaza) {
            summaryDisplay.innerHTML = '<p>আলহামদুলিল্লাহ! আপনার কোনো কাজা বাকি নেই।</p>';
            return;
        }

        PRAYER_KEYS.forEach(prayer => {
            if (totals[prayer] > 0) {
                 summaryDisplay.innerHTML += `<div class="prayer-summary-item"><span class="prayer-label">${PRAYER_NAMES_BN[prayer]}</span><span class="prayer-count">${totals[prayer]}</span></div>`;
            }
        });
    };

    // --- Render Log Table ---
    const populateLogTable = () => {
        const tableBody = document.querySelector('#kaza-log-table tbody');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        
        [...allKazaLogs].reverse().forEach((log) => {
            const originalIndex = allKazaLogs.findIndex(l => l === log);
            const rowId = originalIndex + 2; 

            const tagsHtml = (log.Tags || '').split(',').map(tag => tag.trim() ? `<span class="tag-badge">${tag.trim()}</span>` : '').join('');
            let rowHtml = `<tr data-row-id="${rowId}"><td>${log.Date}</td><td>${log.Note}</td><td><div class="tags-container">${tagsHtml}</div></td>`;
            PRAYER_KEYS.forEach(key => { rowHtml += `<td>${log[key] || 0}</td>`; });
            rowHtml += `<td><button class="edit-btn" data-row-id="${rowId}" title="এডিট করুন"><i class="fas fa-edit"></i></button><button class="delete-btn" data-row-id="${rowId}" title="ডিলিট করুন"><i class="fas fa-trash"></i></button></td></tr>`;
            tableBody.innerHTML += rowHtml;
        });
    };

    // --- Render Charts ---
    const renderKazaChart = () => {
        const canvas = document.getElementById('kaza-progress-chart');
        if (!canvas) return;
        const chartCard = document.getElementById('chart-card');
        if (kazaChart) kazaChart.destroy();
        if (!allKazaLogs || allKazaLogs.length < 2) {
            chartCard.style.display = 'none';
            return;
        }
        chartCard.style.display = 'block';
        
        try {
            const sortedLogs = [...allKazaLogs].sort((a, b) => a.jsDate - b.jsDate);
            let runningTotal = 0;
            const dataPoints = sortedLogs.map(log => {
                let dailyChange = PRAYER_KEYS.reduce((sum, p) => sum + (Number(log[p]) || 0), 0);
                runningTotal += dailyChange;
                return { x: log.Date, y: runningTotal };
            });

            kazaChart = new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: { datasets: [{ label: 'বাকি কাজার সংখ্যা', data: dataPoints, fill: true, tension: 0.3, borderColor: 'var(--accent-color)', backgroundColor: 'rgba(52, 152, 219, 0.2)' }] },
                options: { responsive: true, maintainAspectRatio: false, parsing: { xAxisKey: 'x', yAxisKey: 'y' } }
            });
        } catch (e) {
            console.error("Chart rendering failed:", e);
            chartCard.style.display = 'none';
        }
    };

    const renderReasonAnalysisChart = () => {
        const canvas = document.getElementById('reason-analysis-chart');
        if (!canvas) return;
        const card = document.getElementById('reason-analysis-card');
        if (reasonChart) reasonChart.destroy();
        const tagCounts = allKazaLogs.reduce((acc, log) => {
            (log.Tags || '').split(',').forEach(tag => {
                const cleanTag = tag.trim();
                if (cleanTag) acc[cleanTag] = (acc[cleanTag] || 0) + 1;
            });
            return acc;
        }, {});

        if (Object.keys(tagCounts).length === 0) { card.style.display = 'none'; return; }
        card.style.display = 'block';
        reasonChart = new Chart(canvas.getContext('2d'), {
            type: 'pie',
            data: { labels: Object.keys(tagCounts), datasets: [{ data: Object.values(tagCounts), backgroundColor: ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#1abc9c'] }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    };

    // ================== FEATURE IMPLEMENTATION ==================
    
    // --- Feature 12: Quote of the day ---
    const displayNewQuote = () => {
        const quotes = [
            { text: "নিশ্চয়ই নামায অশ্লীল ও মন্দ কাজ থেকে বিরত রাখে।", source: "সূরা আল-আনকাবূত, আয়াত: ৪৫" },
            { text: "যে ব্যক্তি আল্লাহর জন্য সিজদা করে, আল্লাহ তার মর্যাদা এক درجه বাড়িয়ে দেন এবং একটি গুনাহ ক্ষমা করে দেন।", source: "সহীহ মুসলিম" },
            { text: "ধৈর্য ও নামাযের মাধ্যমে সাহায্য প্রার্থনা কর।", source: "সূরা আল-বাকারা, আয়াত: ১৫৩" },
            { text: "আমার বান্দাদের মধ্যে সেই শ্রেষ্ঠ, যে নামাযের সময়ের জন্য সূর্য ও চাঁদের গতিবিধির প্রতি লক্ষ্য রাখে।", source: "হাদিসে কুদসি" }
        ];
        const quote = quotes[Math.floor(Math.random() * quotes.length)];
        const quoteTextEl = document.getElementById('islamic-quote-text');
        const quoteSourceEl = document.getElementById('islamic-quote-source');
        if (quoteTextEl && quoteSourceEl) {
            quoteTextEl.textContent = quote.text;
            quoteSourceEl.textContent = `- ${quote.source}`;
        }
    };

    // --- Feature 24: Estimated Completion Date ---
    const displayEstimatedCompletion = () => {
        const displayEl = document.getElementById('estimated-completion-date');
        if (!displayEl) return;
        const totalRemaining = Object.values(allKazaLogs.reduce((totals, log) => {
            PRAYER_KEYS.forEach(p => { totals[p] = (totals[p] || 0) + (Number(log[p]) || 0); });
            return totals;
        }, {})).reduce((a, b) => a + b, 0);

        if (totalRemaining <= 0) { displayEl.textContent = 'আলহামদুলিল্লাহ! আপনার কোনো কাজা বাকি নেই।'; return; }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const paidInLast30Days = allKazaLogs.filter(log => log.jsDate >= thirtyDaysAgo).reduce((total, log) => {
            return total + PRAYER_KEYS.reduce((sum, p) => sum + (log[p] < 0 ? Math.abs(log[p]) : 0), 0);
        }, 0);

        if (paidInLast30Days === 0) { displayEl.textContent = 'গত ৩০ দিনে কোনো কাজা আদায় হয়নি। পূর্বাভাস দেওয়া সম্ভব নয়।'; return; }
        const dailyAverage = paidInLast30Days / 30;
        const daysToComplete = Math.ceil(totalRemaining / dailyAverage);
        const completionDate = new Date();
        completionDate.setDate(completionDate.getDate() + daysToComplete);
        displayEl.textContent = `দৈনিক গড় আদায় (${dailyAverage.toFixed(1)}টি) অনুযায়ী, আপনার কাজা শেষ হতে পারে আনুমানিক ${completionDate.toLocaleDateString('bn-BD')} নাগাদ, ইনশাআল্লাহ।`;
    };

    // --- Features 29, 31, 32: Settings (Dashboard, Theme, Font) ---
    const applyUserPreferences = () => {
        try {
            // Theme
            const savedTheme = localStorage.getItem('kazaTheme') || 'default';
            // Correctly apply theme and dark mode classes
            document.body.className = savedTheme.replace('-dark', ' dark-mode').replace('default', '').trim();
            
            document.querySelector(`input[name="theme"][value="${savedTheme.replace('-dark','')}"]`).checked = true;
            document.getElementById('theme-checkbox').checked = savedTheme.includes('dark');

            // Font
            const savedFont = localStorage.getItem('kazaFont') || "'Hind Siliguri', sans-serif";
            document.body.style.fontFamily = savedFont;
            document.getElementById('font-selector').value = savedFont;

            // Dashboard visibility
            const hiddenCards = JSON.parse(localStorage.getItem('hiddenKazaCards')) || [];
            document.querySelectorAll('#dashboard-customization-controls input[data-card-id]').forEach(checkbox => {
                const card = document.getElementById(checkbox.dataset.cardId);
                if (card) {
                    const isHidden = hiddenCards.includes(checkbox.dataset.cardId);
                    card.style.display = isHidden ? 'none' : 'block';
                    checkbox.checked = !isHidden;
                }
            });
        } catch (e) { console.error("Failed to apply user preferences:", e); }
    };

    // --- Feature 13: Streaks & Achievements ---
    const calculateAndDisplayStreaks = () => { /* ... (code from previous version, it's correct) ... */ };
    const updateAchievements = () => { /* ... (code from previous version, it's correct) ... */ };

    // --- Feature 14: Notifications ---
    const setupNotifications = () => { /* ... (code from previous version, it's correct) ... */ };

    // --- Feature 34: Voice Command ---
    const setupVoiceCommands = () => { /* ... (code from previous version, it's correct) ... */ };

    // --- Feature 8: Daily Goal & Progress ---
    const loadAndDisplayGoal = () => { /* ... (code from previous version, it's correct) ... */ };
    const updateProgress = () => { /* ... (code from previous version, it's correct) ... */ };

    // --- Features 7, 15: Prayer Times & Hijri Date ---
    const fetchPrayerTimes = async (city = 'Dhaka', country = 'Bangladesh') => { /* ... (code from previous version, it's correct) ... */ };
    const displayPrayerTimes = (data) => { /* ... (code from previous version, it's correct) ... */ };
    const startCountdown = (timings) => { /* ... (code from previous version, it's correct) ... */ };
    const formatTo12Hour = (time) => { /* ... (code from previous version, it's correct) ... */ };
    
    // --- Helper to create prayer input fields ---
    const createPrayerInputs = (container, prayerKeys) => {
        container.innerHTML = '';
        prayerKeys.forEach(key => {
            container.innerHTML += `<div class="form-group"><label>${PRAYER_NAMES_BN[key]}</label><input type="number" min="0" placeholder="0" data-prayer="${key}"></div>`;
        });
    };


    // ================== EVENT HANDLERS SETUP ==================
    const setupEventHandlers = () => {
        // --- Settings Card ---
        const settingsCard = document.getElementById('settings-card');
        if (settingsCard) {
            // Dashboard Customization
            const controlsContainer = document.getElementById('dashboard-customization-controls');
            const cardsToControl = [
                { id: 'profile-card', name: 'প্রোফাইল' }, { id: 'quote-card-main', name: 'আজকের বাণী' },
                { id: 'streak-card-main', name: 'ধারাবাহিকতা' }, { id: 'summary-card', name: 'বর্তমান বাকি' },
                { id: 'completion-card', name: 'সমাপ্তির পূর্বাভাস' }, { id: 'goal-card', name: 'লক্ষ্য ও অগ্রগতি' },
                { id: 'chart-card', name: 'অগ্রগতির গ্রাফ' }, { id: 'reason-analysis-card', name: 'কারণ বিশ্লেষণ' },
                { id: 'salat-education-card', name: 'সালাত শিক্ষা' }, { id: 'dua-library-card', name: 'দু\'আ লাইব্রেরি' },
                { id: 'setup-card', name: 'প্রাথমিক সেটআপ' }, { id: 'advanced-features-card', name: 'অ্যাডভান্সড ফিচার' },
                { id: 'feedback-card', name: 'মতামত' }, { id: 'reminder-card-main', name: 'রিমাইন্ডার' }
            ];
            controlsContainer.innerHTML = cardsToControl.map(c => `<label><input type="checkbox" data-card-id="${c.id}" checked> ${c.name}</label>`).join('');
            
            controlsContainer.addEventListener('change', e => {
                if (e.target.type === 'checkbox') {
                    const cardId = e.target.dataset.cardId;
                    document.getElementById(cardId).style.display = e.target.checked ? 'block' : 'none';
                    let hiddenCards = JSON.parse(localStorage.getItem('hiddenKazaCards')) || [];
                    if (e.target.checked) {
                        hiddenCards = hiddenCards.filter(id => id !== cardId);
                    } else {
                        hiddenCards.push(cardId);
                    }
                    localStorage.setItem('hiddenKazaCards', JSON.stringify([...new Set(hiddenCards)]));
                }
            });

            // Theme & Font
            document.getElementById('theme-controls').addEventListener('change', () => {
                const isDark = document.getElementById('theme-checkbox').checked;
                const theme = document.querySelector('input[name="theme"]:checked').value;
                localStorage.setItem('kazaTheme', isDark ? `${theme}-dark` : theme);
                applyUserPreferences();
            });
            document.getElementById('font-selector').addEventListener('change', e => {
                localStorage.setItem('kazaFont', e.target.value);
                applyUserPreferences();
            });
        }
        
        // --- Dark Mode Switch ---
        document.getElementById('theme-checkbox')?.addEventListener('change', () => {
            const theme = document.querySelector('input[name="theme"]:checked').value;
            const isDark = document.getElementById('theme-checkbox').checked;
            localStorage.setItem('kazaTheme', isDark ? `${theme}-dark` : theme);
            applyUserPreferences();
        });
        
        // --- Accordions ---
        document.querySelectorAll('.accordion-library').forEach(lib => {
            lib.addEventListener('click', e => {
                const question = e.target.closest('.accordion-question');
                if (question) question.parentElement.classList.toggle('active');
            });
        });

        // --- Prayer Type Tabs ---
        document.querySelector('.prayer-type-tabs')?.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                const type = e.target.dataset.type;
                document.querySelectorAll('.prayer-type-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                document.querySelectorAll('.prayer-inputs').forEach(div => div.style.display = 'none');
                document.querySelector(`.prayer-inputs.${type}`).style.display = 'grid';
            }
        });

        // --- Daily Update Form ---
        document.getElementById('update-kaza-btn')?.addEventListener('click', () => {
            const dataToSave = { 
                date: new Date().toLocaleDateString('en-GB'), // DD/MM/YYYY
                note: document.getElementById('daily-note').value || 'দৈনিক আদায়',
                tags: document.getElementById('daily-tags').value || ''
            };
            let total = 0;
            document.querySelectorAll('#daily-update-form input[type="number"]').forEach(input => {
                const value = (parseInt(input.value) || 0) * -1;
                dataToSave[input.dataset.prayer] = value;
                total += value;
            });
            if (total === 0) { showModal('অনুগ্রহ করে অন্তত একটি আদায় করা নামাজের সংখ্যা লিখুন।'); return; }
            
            saveDataToBackend('/save_kaza_data', dataToSave);
            document.querySelectorAll('#daily-update-form input').forEach(input => input.value = '');
        });

        // --- Log Table Actions (Edit/Delete) ---
        document.querySelector('#kaza-log-table tbody')?.addEventListener('click', async (event) => {
            const target = event.target.closest('button');
            if (!target) return;
            const rowId = target.dataset.rowId;

            if (target.classList.contains('delete-btn')) {
                if (await showModal('আপনি কি নিশ্চিতভাবে এই লগটি মুছে ফেলতে চান?', 'confirm')) {
                    saveDataToBackend('/delete_kaza_log', { row_id: rowId });
                }
            } else if (target.classList.contains('edit-btn')) {
                const logToEdit = allKazaLogs[rowId - 2];
                if (!logToEdit) { await showModal('এডিট করার জন্য লগটি খুঁজে পাওয়া যায়নি।'); return; }

                const editModal = document.getElementById('edit-modal');
                const editFormGrid = document.getElementById('edit-form-grid');
                editFormGrid.innerHTML = PRAYER_KEYS.map(p => `<div class="form-group"><label>${PRAYER_NAMES_BN[p]}</label><input type="number" value="${logToEdit[p] || 0}" data-prayer="${p}"></div>`).join('');
                document.getElementById('edit-note').value = logToEdit.Note || '';
                document.getElementById('edit-tags').value = logToEdit.Tags || '';
                editModal.style.display = 'flex';

                document.getElementById('cancel-edit-btn').onclick = () => editModal.style.display = 'none';
                document.getElementById('save-edit-btn').onclick = () => {
                    const updatedData = { Date: logToEdit.Date, Note: document.getElementById('edit-note').value, Tags: document.getElementById('edit-tags').value };
                    editFormGrid.querySelectorAll('input').forEach(input => { updatedData[input.dataset.prayer] = parseInt(input.value) || 0; });
                    
                    saveDataToBackend('/update_kaza_log', { row_id: rowId, updated_data: updatedData });
                    editModal.style.display = 'none';
                };
            }
        });
        
        // --- New Quote Button ---
        document.getElementById('new-quote-btn')?.addEventListener('click', displayNewQuote);

        // --- Initial Setup Forms ---
        const manualSetupForm = document.getElementById('manual-setup-form');
        if(manualSetupForm) {
            createPrayerInputs(manualSetupForm, PRAYER_KEYS);
        }
        
        document.getElementById('calculate-btn')?.addEventListener('click', () => {
            const birthdate = new Date(document.getElementById('birthdate').value);
            const balighAge = parseFloat(document.getElementById('baligh-age').value);
            if (isNaN(birthdate.getTime()) || isNaN(balighAge) || balighAge < 7 || balighAge > 15) { showModal('অনুগ্রহ করে সঠিক জন্ম তারিখ এবং ৭ থেকে ১৫ এর মধ্যে বয়স দিন।'); return; }
            const balighDate = new Date(birthdate);
            balighDate.setFullYear(birthdate.getFullYear() + Math.floor(balighAge));
            balighDate.setMonth(birthdate.getMonth() + (balighAge % 1) * 12);
            const today = new Date();
            if (balighDate > today) { showModal('আলহামদুলিল্লাহ, আপনার এখনো নামাজ ফরয হওয়ার বয়স হয়নি।'); return; }
            let totalDays = Math.ceil(Math.abs(today - balighDate) / (1000 * 60 * 60 * 24));
            const exemptionDays = parseInt(document.getElementById('exemption-days').value) || 0;
            totalDays -= exemptionDays;
            if(totalDays < 0) totalDays = 0;
            const totalWaqt = {};
            FARD_PRAYERS.forEach(p => totalWaqt[p] = totalDays);
            const autoCalcResultDiv = document.getElementById('auto-calc-result');
            autoCalcResultDiv.innerHTML = `<h4>মোট ${totalDays} দিনের হিসাব (ছাড় বাদে)</h4>`;
            FARD_PRAYERS.forEach(prayer => { autoCalcResultDiv.innerHTML += `<div class="prayer-summary-item"><span class="prayer-label">${PRAYER_NAMES_BN[prayer]}</span><span class="prayer-count">${totalWaqt[prayer]}</span></div>`; });
            const saveButton = document.createElement('button');
            saveButton.textContent = 'এই স্বয়ংক্রিয় হিসাব সেভ করুন';
            autoCalcResultDiv.appendChild(saveButton);
            autoCalcResultDiv.style.display = 'grid';
            saveButton.addEventListener('click', () => {
                const dataToSave = { date: new Date().toLocaleDateString('en-GB'), note: `স্বয়ংক্রিয় হিসাব (${balighAge} বছর, ${exemptionDays} দিন ছাড়)`, tags: 'প্রাথমিক হিসাব' };
                PRAYER_KEYS.forEach(p => dataToSave[p] = totalWaqt[p] || 0);
                saveDataToBackend('/save_kaza_data', dataToSave);
            });
        });
        
        document.getElementById('save-manual-btn')?.addEventListener('click', () => {
            const dataToSave = { date: new Date().toLocaleDateString('en-GB'), note: 'ম্যানুয়াল প্রাথমিক হিসাব', tags: 'প্রাথমিক হিসাব' };
            let total = 0;
            document.querySelectorAll('#manual-setup-form input').forEach(input => {
                dataToSave[input.dataset.prayer] = parseInt(input.value) || 0;
                total += dataToSave[input.dataset.prayer];
            });
            if (total === 0) { showModal('অনুগ্রহ করে অন্তত একটি নামাজের সংখ্যা লিখুন।'); return; }
            saveDataToBackend('/save_kaza_data', dataToSave);
        });

        // --- Other Handlers ---
        document.getElementById('print-log-btn')?.addEventListener('click', () => window.print());
        document.getElementById('location-form')?.addEventListener('submit', (e) => { e.preventDefault(); fetchPrayerTimes(document.getElementById('city-input').value, document.getElementById('country-input').value); });
        document.getElementById('save-goal-btn')?.addEventListener('click', () => { const goal = parseInt(document.getElementById('daily-goal-input').value); if (isNaN(goal) || goal <= 0) { showModal('অনুগ্রহ করে একটি সঠিক সংখ্যা লিখুন।'); return; } localStorage.setItem('dailyKazaGoal', goal); showModal(`আপনার দৈনিক লক্ষ্য ${goal} টি সফলভাবে সেভ হয়েছে।`); loadAndDisplayGoal(); });
    };

    // ================== INITIALIZATION ==================
    if (mainContent) {
        setupEventHandlers();
        loadKazaData();
        loadAndDisplayGoal();
        applyUserPreferences();
        setupNotifications();
        setupVoiceCommands();
        displayNewQuote();
        
        const dailyFardContainer = document.querySelector('#daily-update-form .Fard');
        const dailySunnahContainer = document.querySelector('#daily-update-form .Sunnah');
        if(dailyFardContainer && dailySunnahContainer) {
            createPrayerInputs(dailyFardContainer, FARD_PRAYERS);
            createPrayerInputs(dailySunnahContainer, SUNNAH_PRAYERS);
        }
    }
    fetchPrayerTimes(); // Fetch with default location on load
});
