document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const summaryDisplay = document.getElementById('summary-display');
    const waqtCompletedInput = document.getElementById('waqt-completed');
    const noteInput = document.getElementById('note');
    const updateKazaBtn = document.getElementById('update-kaza-btn');
    const kazaLogTableBody = document.querySelector('#kaza-log-table tbody');

    const birthdateInput = document.getElementById('birthdate');
    const balighAgeSelect = document.getElementById('baligh-age');
    const calculateBtn = document.getElementById('calculate-btn');
    const initialResultDiv = document.getElementById('initial-result');
    
    // Global variable to hold user's kaza data log
    let kazaLog = [];
    let currentRemaining = 0;

    // --- Data Fetching and Display ---

    const loadKazaData = async () => {
        try {
            const response = await fetch('/get_kaza_data');
            const result = await response.json();

            if (result.status === 'success' && result.data.length > 0) {
                kazaLog = result.data;
                // Get the last entry to find the current remaining waqt
                const lastEntry = kazaLog[kazaLog.length - 1];
                currentRemaining = lastEntry['Remaining After'];
                updateSummary();
                populateLogTable();
            } else {
                summaryDisplay.innerHTML = '<p>কোনো হিসাব পাওয়া যায়নি। অনুগ্রহ করে প্রাথমিক হিসাব করুন।</p>';
            }
        } catch (error) {
            console.error('Error fetching Kaza data:', error);
            summaryDisplay.innerHTML = '<p style="color: red;">ডেটা লোড করতে সমস্যা হয়েছে।</p>';
        }
    };

    const updateSummary = () => {
        summaryDisplay.innerHTML = `
            <p>আপনার মোট বাকি কাজা নামাজ: <strong>${currentRemaining} ওয়াক্ত</strong></p>
        `;
    };

    const populateLogTable = () => {
        kazaLogTableBody.innerHTML = ''; // Clear existing table
        // Show logs in reverse order (newest first)
        for (let i = kazaLog.length - 1; i >= 0; i--) {
            const entry = kazaLog[i];
            const row = `<tr>
                <td>${entry.Date}</td>
                <td>${entry['Prayers Completed']}</td>
                <td>${entry['Remaining After']}</td>
                <td>${entry.Note}</td>
            </tr>`;
            kazaLogTableBody.innerHTML += row;
        }
    };

    // --- Data Calculation and Saving ---

    const saveData = async (dataToSave) => {
        try {
            const response = await fetch('/save_kaza_data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSave),
            });
            const result = await response.json();
            
            if (result.status === 'success') {
                alert('আপনার হিসাব সফলভাবে গুগল শীটে সেভ হয়েছে।');
                // Reload data to show updated log
                loadKazaData();
            } else {
                alert(`ডেটা সেভ করতে সমস্যা হয়েছে: ${result.message}`);
            }
        } catch (error) {
            console.error('Error saving data:', error);
            alert('সার্ভারের সাথে সংযোগ করতে সমস্যা হয়েছে।');
        }
    };
    
    // Handler for initial calculation
    calculateBtn.addEventListener('click', () => {
        const birthdate = new Date(birthdateInput.value);
        const balighAge = parseInt(balighAgeSelect.value);

        if (isNaN(birthdate.getTime())) {
            alert('দয়া করে একটি সঠিক জন্ম তারিখ দিন।');
            return;
        }
        // ... (calculation logic is the same as before) ...
        const balighDate = new Date(birthdate);
        balighDate.setFullYear(birthdate.getFullYear() + balighAge);
        const today = new Date();
        if (balighDate > today) {
            alert('আলহামদুলিল্লাহ, আপনার এখনো নামাজ ফরয হওয়ার বয়স হয়নি।');
            return;
        }
        const diffTime = Math.abs(today - balighDate);
        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const totalWaqt = totalDays * 5;

        // Display result and a save button
        initialResultDiv.innerHTML = `
            <p>আপনার মোট কাজা প্রায়: <strong>${totalWaqt} ওয়াক্ত</strong></p>
            <button id="save-initial-btn" data-waqt="${totalWaqt}">এই হিসাবটি সেভ করুন</button>
        `;
        initialResultDiv.style.display = 'block';
    });

    // Event delegation for the "save-initial-btn"
    document.addEventListener('click', (event) => {
        if (event.target && event.target.id === 'save-initial-btn') {
            if (kazaLog.length > 0) {
                if (!confirm("আপনার ইতোমধ্যে একটি হিসাব আছে। আপনি কি নতুন করে শুরু করতে চান? এতে আগের লগ ঠিকই থাকবে, কিন্তু একটি নতুন প্রাথমিক হিসাব যোগ হবে।")) {
                    return;
                }
            }
            const totalWaqt = parseInt(event.target.dataset.waqt);
            const today = new Date().toLocaleDateString('bn-BD'); // Bengali date format

            const data = {
                date: today,
                completed: 0,
                remaining: totalWaqt,
                note: 'প্রাথমিক হিসাব'
            };
            saveData(data);
        }
    });

    // Handler for updating kaza count
    updateKazaBtn.addEventListener('click', () => {
        const completed = parseInt(waqtCompletedInput.value);
        if (isNaN(completed) || completed <= 0) {
            alert('দয়া করে আদায় করা নামাজের সঠিক সংখ্যা দিন।');
            return;
        }
        
        if (currentRemaining < completed) {
            if (!confirm(`আপনার বাকি আছে ${currentRemaining} ওয়াক্ত, কিন্তু আপনি ${completed} ওয়াক্ত লিখেছেন। হিসাব কি সম্পন্ন হয়ে গেছে?`)){
                return;
            }
        }

        const newRemaining = Math.max(0, currentRemaining - completed);
        const today = new Date().toLocaleDateString('bn-BD');

        const data = {
            date: today,
            completed: completed,
            remaining: newRemaining,
            note: noteInput.value
        };
        saveData(data);
        
        // Clear input fields after saving
        waqtCompletedInput.value = '';
        noteInput.value = '';
    });


    // Initial load of data when the page is ready
    loadKazaData();
});
