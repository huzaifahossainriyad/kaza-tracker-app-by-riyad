document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const birthdateInput = document.getElementById('birthdate');
    const balighAgeSelect = document.getElementById('baligh-age');
    const calculateBtn = document.getElementById('calculate-btn');
    const resultCard = document.getElementById('result-card');
    const resultDiv = document.getElementById('result');

    // Event listener for the calculate button
    calculateBtn.addEventListener('click', () => {
        const birthdate = new Date(birthdateInput.value);
        const balighAge = parseInt(balighAgeSelect.value);

        if (isNaN(birthdate.getTime())) {
            resultDiv.innerHTML = '<p style="color: red;">দয়া করে একটি সঠিক জন্ম তারিখ দিন।</p>';
            resultCard.style.display = 'block';
            return;
        }

        const balighDate = new Date(birthdate);
        balighDate.setFullYear(birthdate.getFullYear() + balighAge);

        const today = new Date();

        if (balighDate > today) {
            resultDiv.innerHTML = '<p>আলহামদুলিল্লাহ, আপনার এখনো নামাজ ফরয হওয়ার বয়স হয়নি।</p>';
            resultCard.style.display = 'block';
            return;
        }

        const diffTime = Math.abs(today - balighDate);
        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const totalWaqt = totalDays * 5; // 5 waqt per day

        // Display the result
        resultDiv.innerHTML = `
            <p>নামাজ ফরয হওয়ার পর থেকে আজ পর্যন্ত মোট পার হওয়া দিন (আনুমানিক): <strong>${totalDays} দিন</strong></p>
            <p>মোট কাজা হওয়া ওয়াক্ত (আনুমানিক): <strong>${totalWaqt} ওয়াক্ত</strong></p>
            <p style="font-size: 0.9em; color: #555;">(বিঃদ্রঃ এটি একটি আনুমানিক হিসাব। চন্দ্রবর্ষ অনুযায়ী দিনের সংখ্যা কিছুটা কম বা বেশি হতে পারে।)</p>
        `;

        resultCard.style.display = 'block';
    });
});