if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // === Elements ===
    const currentMonthDisplay = document.getElementById('current-month');
    const addTransactionScreen = document.getElementById('add-transaction-screen');
    const summaryScreen = document.getElementById('summary-screen');
    const budgetScreen = document.getElementById('budget-screen');

    const navAddBtn = document.getElementById('nav-add');
    const navSummaryBtn = document.getElementById('nav-summary');
    const navBudgetBtn = document.getElementById('nav-budget');

    const amountInput = document.getElementById('amount');
    const descriptionInput = document.getElementById('description');
    const categorySelect = document.getElementById('category');
    const transactionDateInput = document.getElementById('transaction-date');
    const expenseRadio = document.getElementById('expense');
    const incomeRadio = document.getElementById('income');
    const addTransactionBtn = document.getElementById('add-transaction-btn');
    const transactionList = document.getElementById('transaction-list');

    const totalIncomeDisplay = document.getElementById('total-income');
    const totalExpenseDisplay = document.getElementById('total-expense');
    const currentBalanceDisplay = document.getElementById('current-balance');
    let categoryChartCanvas = document.getElementById('category-chart'); // เปลี่ยนเป็น let เพื่อให้ destroy ได้
    const noChartDataMessage = document.getElementById('no-chart-data');

    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const summaryMonthDisplay = document.getElementById('summary-month-display');

    const budgetCategoryInput = document.getElementById('budget-category-input');
    const budgetAmountInput = document.getElementById('budget-amount-input');
    const setBudgetBtn = document.getElementById('set-budget-btn');
    const currentBudgetsList = document.getElementById('current-budgets');

    const confirmationOverlay = document.getElementById('confirmation-overlay');
    const confirmationMessage = document.getElementById('confirmation-message');
    const confirmYesBtn = document.getElementById('confirm-yes-btn');
    const confirmNoBtn = document.getElementById('confirm-no-btn');

    const confettiContainer = document.getElementById('confetti-container');

    // === Global Variables ===
    let transactions = [];
    let budgets = {}; // Store budgets as an object: { category: amount }
    let currentViewDate = new Date(); // สำหรับหน้าสรุป, เริ่มต้นที่เดือนปัจจุบัน
    let categoryChartInstance = null; // เก็บ instance ของ Chart.js

    // === Constants ===
    const CATEGORY_NAMES_TH = {
        food: 'อาหาร',
        transport: 'เดินทาง',
        shopping: 'ช้อปปิ้ง',
        utilities: 'ค่าใช้จ่ายบ้าน',
        entertainment: 'บันเทิง',
        other: 'อื่น ๆ'
    };

    // === Helper Functions ===

    // แสดงการแจ้งเตือน
    function showNotification(message, type = 'info', duration = 3000) {
        let notification = document.querySelector('.notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.classList.add('notification');
            document.body.appendChild(notification);
        }
        notification.textContent = message;
        notification.className = `notification show ${type}`; // Reset classes and add new ones

        setTimeout(() => {
            notification.classList.remove('show');
        }, duration);
    }


    // Function to show confirmation modal
    function showConfirmation(message) {
        confirmationMessage.textContent = message;
        confirmationOverlay.classList.add('show');
        return new Promise(resolve => {
            const onConfirm = () => {
                confirmationOverlay.classList.remove('show');
                confirmYesBtn.removeEventListener('click', onConfirm);
                confirmNoBtn.removeEventListener('click', onCancel);
                resolve(true);
            };
            const onCancel = () => {
                confirmationOverlay.classList.remove('show');
                confirmYesBtn.removeEventListener('click', onConfirm);
                confirmNoBtn.removeEventListener('click', onCancel);
                resolve(false);
            };
            confirmYesBtn.addEventListener('click', onConfirm);
            confirmNoBtn.addEventListener('click', onCancel);
        });
    }

    // Function to trigger confetti animation
    function triggerConfetti() {
        if (!confettiContainer) return; // เพิ่มการตรวจสอบ null/undefined

        const colors = ['#f00', '#0f0', '#00f', '#ff0', '#0ff', '#f0f']; // More vibrant colors
        const numParticles = 50; // More particles for a stronger effect

        for (let i = 0; i < numParticles; i++) {
            const particle = document.createElement('div');
            particle.classList.add('confetti-particle');
            particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

            // Randomize starting position at the top
            const startX = Math.random() * window.innerWidth;
            particle.style.left = `${startX}px`;
            particle.style.top = `-${Math.random() * 50}px`; // Start slightly above viewport

            // Randomize animation duration and delay
            const duration = 1.5 + Math.random() * 1.5; // 1.5 to 3 seconds
            const delay = Math.random() * 0.8; // 0 to 0.8 seconds delay
            particle.style.animationDuration = `${duration}s`;
            particle.style.animationDelay = `${delay}s`;

            // Randomize end position (x) and rotation
            const endX = startX + (Math.random() - 0.5) * 400; // Spread horizontally
            const rotateDeg = Math.random() * 720; // Rotate up to 720 degrees
            particle.style.setProperty('--confetti-end-x', `${endX}px`);
            particle.style.setProperty('--confetti-rotate-deg', `${rotateDeg}deg`);

            confettiContainer.appendChild(particle);

            // Remove particle after animation ends to prevent DOM bloat
            particle.addEventListener('animationend', () => {
                particle.remove();
            });
        }
    }


    // แปลชื่อหมวดหมู่เป็นภาษาไทย
    function getCategoryThaiName(categoryKey) {
        return CATEGORY_NAMES_TH[categoryKey] || categoryKey; // Fallback to key if not found
    }

    // แปลชื่อหมวดหมู่ภาษาไทยกลับเป็นคีย์ (สำหรับบันทึก)
    function getCategoryKey(thaiName) {
        for (const key in CATEGORY_NAMES_TH) {
            if (CATEGORY_NAMES_TH[key] === thaiName) {
                return key;
            }
        }
        return thaiName; // Fallback to thaiName if not found (shouldn't happen with fixed categories)
    }

    // จัดรูปแบบตัวเลขให้เป็นสกุลเงินบาท
    function formatCurrency(amount) {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            minimumFractionDigits: 2
        }).format(amount);
    }

    // บันทึกรายการลง Local Storage
    function saveTransactions() {
        localStorage.setItem('transactions', JSON.stringify(transactions));
    }

    // โหลดรายการจาก Local Storage
    function loadTransactions() {
        const storedTransactions = localStorage.getItem('transactions');
        if (storedTransactions) {
            transactions = JSON.parse(storedTransactions);
            // Sort transactions by date (descending) after loading
            transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        } else {
            transactions = [];
        }
        renderTransactions();
    }

    // บันทึกงบประมาณลง Local Storage
    function saveBudgets() {
        localStorage.setItem('budgets', JSON.stringify(budgets));
    }

    // โหลดงบประมาณจาก Local Storage
    function loadBudgets() {
        const storedBudgets = localStorage.getItem('budgets');
        return storedBudgets ? JSON.parse(storedBudgets) : {};
    }

    // ล้างฟอร์ม
    function clearForm() {
        amountInput.value = '';
        descriptionInput.value = '';
        categorySelect.value = 'food';
        transactionDateInput.value = new Date().toISOString().split('T')[0]; // ตั้งค่าเป็นวันปัจจุบัน
        expenseRadio.checked = true;
    }

    // ล้างฟอร์มงบประมาณ
    function clearBudgetForm() {
        budgetCategoryInput.value = 'food';
        budgetAmountInput.value = '';
    }

    // === Render Functions ===

    // แสดงรายการธุรกรรม
    function renderTransactions() {
        if (!transactionList) return; // Defensive check
        transactionList.innerHTML = ''; // Clear current list

        if (transactions.length === 0) {
            const noTransactionItem = document.createElement('li');
            noTransactionItem.textContent = 'ยังไม่มีรายการ';
            noTransactionItem.classList.add('transaction-item', 'no-transactions');
            transactionList.appendChild(noTransactionItem);
            return;
        }

        // Group transactions by date
        const groupedTransactions = transactions.reduce((acc, transaction) => {
            const date = transaction.date; // Date is already in YYYY-MM-DD format
            if (!acc[date]) {
                acc[date] = [];
            }
            acc[date].push(transaction);
            return acc;
        }, {});

        // Sort dates in descending order
        const sortedDates = Object.keys(groupedTransactions).sort((a, b) => new Date(b) - new Date(a));

        sortedDates.forEach(date => {
            const dateGroup = document.createElement('div');
            dateGroup.classList.add('transaction-date-group');
            // Format date for display (e.g., 1 มกราคม 2568)
            const displayDate = new Date(date).toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            dateGroup.innerHTML = `<h4>${displayDate}</h4>`;
            transactionList.appendChild(dateGroup);

            groupedTransactions[date].forEach(transaction => {
                const item = document.createElement('li');
                item.classList.add('transaction-item', transaction.type); // Add expense/income class

                const details = document.createElement('div');
                details.classList.add('transaction-details');
                details.innerHTML = `
                    <div class="transaction-description">${transaction.description}</div>
                    <div class="transaction-category">${getCategoryThaiName(transaction.category)}</div>
                `;

                const amountSpan = document.createElement('span');
                amountSpan.classList.add('transaction-amount');
                const sign = transaction.type === 'expense' ? '-' : '+';
                amountSpan.textContent = `${sign}${formatCurrency(transaction.amount)}`;

                const actionsDiv = document.createElement('div');
                actionsDiv.classList.add('transaction-actions');

                const editBtn = document.createElement('button');
                editBtn.classList.add('edit-btn');
                editBtn.innerHTML = '<i class="fas fa-edit"></i>';
                editBtn.addEventListener('click', () => editTransaction(transaction.id));

                const deleteBtn = document.createElement('button');
                deleteBtn.classList.add('delete-btn');
                deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                deleteBtn.addEventListener('click', async () => {
                    const confirmed = await showConfirmation('คุณต้องการลบรายการนี้ใช่หรือไม่?');
                    if (confirmed) {
                        deleteTransaction(transaction.id);
                        showNotification('ลบรายการเรียบร้อยแล้ว!', 'success');
                    } else {
                        showNotification('ยกเลิกการลบรายการ!', 'info');
                    }
                });

                actionsDiv.appendChild(editBtn);
                actionsDiv.appendChild(deleteBtn);

                item.appendChild(details);
                item.appendChild(amountSpan);
                item.appendChild(actionsDiv);

                transactionList.appendChild(item);
            });
        });
        updateSummary(); // Call updateSummary after rendering transactions
    }


    // แสดงเดือนปัจจุบันใน header ของแอป
    function displayCurrentHeaderMonth() {
        const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
                            "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
        const currentDate = new Date();
        const currentMonthIndex = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        if (currentMonthDisplay) { // ตรวจสอบว่า element มีอยู่จริง
            currentMonthDisplay.innerHTML = `${monthNames[currentMonthIndex]} ${currentYear}`;
        } else {
            console.error("Element with ID 'current-month' not found in the DOM.");
        }
    }


    // อัปเดตข้อมูลสรุปและกราฟ
    function updateSummary() {
        let totalIncome = 0;
        let totalExpense = 0;
        const categoryExpenses = {}; // { category: amount }

        // Filter transactions for the currently viewed month in summary screen
        const filteredTransactions = transactions.filter(t => {
            const transactionDate = new Date(t.date);
            return transactionDate.getFullYear() === currentViewDate.getFullYear() &&
                   transactionDate.getMonth() === currentViewDate.getMonth();
        });

        filteredTransactions.forEach(transaction => {
            if (transaction.type === 'income') {
                totalIncome += transaction.amount;
            } else {
                totalExpense += transaction.amount;
                // Aggregate expenses by category for chart
                if (!categoryExpenses[transaction.category]) {
                    categoryExpenses[transaction.category] = 0;
                }
                categoryExpenses[transaction.category] += transaction.amount;
            }
        });

        if (totalIncomeDisplay) {
            totalIncomeDisplay.textContent = formatCurrency(totalIncome);
        }
        if (totalExpenseDisplay) {
            totalExpenseDisplay.textContent = formatCurrency(totalExpense);
        }
        if (currentBalanceDisplay) {
            currentBalanceDisplay.textContent = formatCurrency(totalIncome - totalExpense);
            if (totalIncome - totalExpense < 0) {
                currentBalanceDisplay.style.color = '#dc3545'; // Red for negative balance
            } else {
                currentBalanceDisplay.style.color = '#6a0dad'; // Purple for positive balance
            }
        }
        renderCategoryChart(categoryExpenses);
    }

    // แสดงเดือนสำหรับหน้าสรุป
    function displaySummaryMonth(date) {
        const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
                            "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
        if (summaryMonthDisplay) { // Defensive check
            summaryMonthDisplay.textContent = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        }
        updateSummary();
    }

    // เปลี่ยนเดือนในหน้าสรุป
    function changeMonth(delta) {
        currentViewDate.setMonth(currentViewDate.getMonth() + delta);
        displaySummaryMonth(currentViewDate);
    }

    // สร้างหรืออัปเดตกราฟวงกลม (Pie Chart)
    function renderCategoryChart(categoryExpenses) {
        // Destroy existing chart if it exists
        if (categoryChartInstance) {
            categoryChartInstance.destroy();
        }

        const categoryLabels = Object.keys(categoryExpenses).map(key => getCategoryThaiName(key));
        const categoryData = Object.values(categoryExpenses);
        const hasData = categoryData.some(amount => amount > 0);

        if (noChartDataMessage && categoryChartCanvas) { // Defensive check
            if (hasData) {
                noChartDataMessage.classList.add('hidden-message');
                categoryChartCanvas.style.display = 'block';
            } else {
                noChartDataMessage.classList.remove('hidden-message');
                categoryChartCanvas.style.display = 'none';
            }
        }


        if (!categoryChartCanvas || !hasData) { // เพิ่มการตรวจสอบ categoryChartCanvas
            return; // ไม่ต้องสร้างกราฟถ้าไม่มีข้อมูลหรือ canvas ไม่พร้อม
        }


        const backgroundColors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
            '#C9CBCE', '#A3C4BC', '#D7BDE2', '#AF7AC5', '#5DADE2', '#48C9B0'
        ];

        categoryChartInstance = new Chart(categoryChartCanvas, {
            type: 'pie',
            data: {
                labels: categoryLabels,
                datasets: [{
                    data: categoryData,
                    backgroundColor: backgroundColors,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // อนุญาตให้ปรับขนาดตาม container
                plugins: {
                    legend: {
                        position: 'right', // ย้าย legend ไปทางขวา
                        labels: {
                            font: {
                                family: 'Kanit' // ใช้ font Kanit สำหรับ legend
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += formatCurrency(context.parsed);
                                }
                                return label;
                            }
                        },
                        bodyFont: {
                            family: 'Kanit' // ใช้ font Kanit สำหรับ tooltip
                        },
                        titleFont: {
                            family: 'Kanit'
                        }
                    }
                }
            }
        });
    }

    // แสดงงบประมาณปัจจุบัน
    function renderBudgets() {
        if (!currentBudgetsList) return; // Defensive check
        currentBudgetsList.innerHTML = '';
        const allCategories = Object.keys(CATEGORY_NAMES_TH);

        if (Object.keys(budgets).length === 0) {
            const noBudgetItem = document.createElement('li');
            noBudgetItem.textContent = 'ยังไม่มีงบประมาณตั้งค่า';
            noBudgetItem.classList.add('budget-item', 'no-budgets');
            currentBudgetsList.appendChild(noBudgetItem);
            return;
        }

        allCategories.forEach(categoryKey => {
            const budgetedAmount = budgets[categoryKey] || 0;
            if (budgetedAmount === 0) return; // ไม่แสดงหมวดหมู่ที่งบประมาณเป็น 0 หรือไม่ได้ตั้ง

            const spentAmount = transactions
                .filter(t => t.type === 'expense' && t.category === categoryKey &&
                             new Date(t.date).getMonth() === new Date().getMonth() &&
                             new Date(t.date).getFullYear() === new Date().getFullYear())
                .reduce((sum, t) => sum + t.amount, 0);

            const remainingAmount = budgetedAmount - spentAmount;

            const item = document.createElement('li');
            item.classList.add('budget-item');

            const infoDiv = document.createElement('div');
            infoDiv.classList.add('budget-info');

            const categoryName = document.createElement('div');
            categoryName.classList.add('budget-category-name');
            categoryName.textContent = getCategoryThaiName(categoryKey);

            const amountDisplay = document.createElement('div');
            amountDisplay.classList.add('budget-amount-display');
            amountDisplay.textContent = `งบประมาณ: ${formatCurrency(budgetedAmount)} | ใช้ไป: ${formatCurrency(spentAmount)}`;

            const statusSpan = document.createElement('span');
            statusSpan.classList.add('budget-status');
            if (remainingAmount < 0) {
                statusSpan.textContent = `เกินงบ: ${formatCurrency(Math.abs(remainingAmount))}`;
                statusSpan.classList.add('over-budget');
            } else if (remainingAmount < budgetedAmount * 0.2 && budgetedAmount > 0) { // น้อยกว่า 20% ของงบประมาณ
                statusSpan.textContent = `เหลืองบ: ${formatCurrency(remainingAmount)} (ใกล้หมด)`;
                statusSpan.classList.add('warning-budget');
            }
            else {
                statusSpan.textContent = `เหลืองบ: ${formatCurrency(remainingAmount)}`;
            }

            infoDiv.appendChild(categoryName);
            infoDiv.appendChild(amountDisplay);
            infoDiv.appendChild(statusSpan);

            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('budget-actions');

            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('delete-budget-btn');
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.addEventListener('click', async () => {
                const confirmed = await showConfirmation(`คุณต้องการลบงบประมาณสำหรับหมวดหมู่ "${getCategoryThaiName(categoryKey)}" ใช่หรือไม่?`);
                if (confirmed) {
                    delete budgets[categoryKey];
                    saveBudgets();
                    renderBudgets();
                    showNotification(`ลบงบประมาณสำหรับ ${getCategoryThaiName(categoryKey)} เรียบร้อย!`, 'success');
                } else {
                    showNotification('ยกเลิกการลบงบประมาณ!', 'info');
                }
            });

            actionsDiv.appendChild(deleteBtn);

            item.appendChild(infoDiv);
            item.appendChild(actionsDiv);
            currentBudgetsList.appendChild(item);
        });
    }


    // === Core Logic Functions ===

    // เพิ่มรายการ
    addTransactionBtn.addEventListener('click', () => {
        const amount = parseFloat(amountInput.value);
        const description = descriptionInput.value.trim();
        const category = categorySelect.value;
        const date = transactionDateInput.value;
        const type = expenseRadio.checked ? 'expense' : 'income';

        if (isNaN(amount) || amount <= 0 || description === '' || date === '') {
            showNotification('กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง', 'error');
            return;
        }

        const newTransaction = {
            id: Date.now(), // Unique ID
            amount,
            description,
            category,
            date,
            type
        };

        transactions.unshift(newTransaction); // Add to the beginning for latest first
        saveTransactions();
        renderTransactions();
        clearForm();
        showNotification('เพิ่มรายการเรียบร้อยแล้ว!', 'success');
    });

    // แก้ไขรายการ
    function editTransaction(id) {
        const transactionToEdit = transactions.find(t => t.id === id);
        if (!transactionToEdit) {
            showNotification('ไม่พบรายการที่จะแก้ไข', 'error');
            return;
        }

        // Fill the form with transaction data
        amountInput.value = transactionToEdit.amount;
        descriptionInput.value = transactionToEdit.description;
        categorySelect.value = transactionToEdit.category;
        transactionDateInput.value = transactionToEdit.date; // YYYY-MM-DD format
        if (transactionToEdit.type === 'expense') {
            expenseRadio.checked = true;
        } else {
            incomeRadio.checked = true;
        }

        // Change button text and behavior
        addTransactionBtn.textContent = 'อัปเดตรายการ';
        addTransactionBtn.onclick = async () => {
            const confirmed = await showConfirmation('คุณต้องการอัปเดตรายการนี้ใช่หรือไม่?');
            if (!confirmed) {
                showNotification('ยกเลิกการอัปเดตรายการ!', 'info');
                // Restore original button state
                addTransactionBtn.textContent = 'เพิ่มรายการ';
                addTransactionBtn.onclick = null; // Remove this specific handler
                addTransactionBtn.addEventListener('click', () => addTransactionBtn.click()); // Re-add general handler
                clearForm();
                return;
            }

            const updatedAmount = parseFloat(amountInput.value);
            const updatedDescription = descriptionInput.value.trim();
            const updatedCategory = categorySelect.value;
            const updatedDate = transactionDateInput.value;
            const updatedType = expenseRadio.checked ? 'expense' : 'income';

            if (isNaN(updatedAmount) || updatedAmount <= 0 || updatedDescription === '' || updatedDate === '') {
                showNotification('กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง', 'error');
                return;
            }

            transactionToEdit.amount = updatedAmount;
            transactionToEdit.description = updatedDescription;
            transactionToEdit.category = updatedCategory;
            transactionToEdit.date = updatedDate;
            transactionToEdit.type = updatedType;

            saveTransactions();
            renderTransactions(); // Re-render to show updated list
            clearForm(); // Clear the form
            showNotification('อัปเดตรายการเรียบร้อยแล้ว!', 'success');

            // Restore original button state
            addTransactionBtn.textContent = 'เพิ่มรายการ';
            addTransactionBtn.onclick = null; // Remove this specific handler
            // Ensure the primary button's original click listener is re-attached if it was removed.
            // A more robust solution involves using event listeners and removing them by reference.
            // For simplicity, we'll just rely on the DOMContentLoaded listener and assume it handles re-adding.
            // Or, if using an anonymous function for the main add listener, you might need to re-bind it.
            // A better way for this particular setup would be to use a named function for addTransactionBtn's main click.
            // For now, if the original listener is defined via addEventListener, it remains.
            // If it was defined as .onclick, this would override it, so we need to reset it.
            // The initial listener is defined with addEventListener, so it should be fine.
        };
        showNotification('โปรดแก้ไขข้อมูลแล้วกด "อัปเดตรายการ"');
    }


    // ลบรายการ
    function deleteTransaction(id) {
        transactions = transactions.filter(transaction => transaction.id !== id);
        saveTransactions();
        renderTransactions();
    }


    // จัดการการเปลี่ยนหน้าจอ
    function showScreen(screenId) {
        // ซ่อนทุกหน้าจอ
        addTransactionScreen.classList.remove('active-screen');
        summaryScreen.classList.remove('active-screen');
        budgetScreen.classList.remove('active-screen');

        // ลบ active class ออกจากปุ่ม nav ทั้งหมด
        navAddBtn.classList.remove('active');
        navSummaryBtn.classList.remove('active');
        navBudgetBtn.classList.remove('active');

        // แสดงหน้าจอที่เลือกและเพิ่ม active class ให้ปุ่ม nav ที่เกี่ยวข้อง
        if (screenId === 'add-transaction-screen') {
            addTransactionScreen.classList.add('active-screen');
            navAddBtn.classList.add('active');
        } else if (screenId === 'summary-screen') {
            summaryScreen.classList.add('active-screen');
            navSummaryBtn.classList.add('active');
            currentViewDate = new Date(); // รีเซ็ตเป็นเดือนปัจจุบันเมื่อเข้าหน้าสรุป
            displaySummaryMonth(currentViewDate); // อัปเดตข้อมูลสรุปและกราฟสำหรับเดือนปัจจุบัน
        } else if (screenId === 'budget-screen') {
            budgetScreen.classList.add('active-screen');
            navBudgetBtn.classList.add('active');
            renderBudgets(); // แสดงงบประมาณเมื่อเข้าหน้า
        }
    }

    // ตั้งค่างบประมาณ
    setBudgetBtn.addEventListener('click', async () => {
        const category = budgetCategoryInput.value;
        const amount = parseFloat(budgetAmountInput.value);

        if (isNaN(amount) || amount < 0) {
            showNotification('กรุณากรอกจำนวนเงินงบประมาณที่ถูกต้อง', 'error');
            return;
        }

        if (budgets[category] && budgets[category] > 0) {
            // If budget for this category already exists, ask for confirmation to overwrite
            const confirmed = await showConfirmation(`มีงบประมาณสำหรับ ${getCategoryThaiName(category)} อยู่แล้ว (${formatCurrency(budgets[category])}) คุณต้องการตั้งค่าใหม่เป็น ${formatCurrency(amount)} ใช่หรือไม่?`);
            if (confirmed) {
                budgets[category] = amount;
                showNotification(`อัปเดตงบประมาณสำหรับ ${getCategoryThaiName(category)} เรียบร้อย!`, 'success');
                triggerConfetti(); // เรียกใช้ Confetti
            } else {
                showNotification('ยกเลิกการตั้งงบประมาณ!', 'info');
                return; // ออกจากฟังก์ชัน setBudgetBtn.addEventListener
            }
        } else {
            budgets[category] = amount;
            showNotification(`ตั้งงบประมาณสำหรับ ${getCategoryThaiName(category)} เรียบร้อย!`, 'success');
            triggerConfetti(); // เรียกใช้ Confetti
        }

        saveBudgets();
        renderBudgets();
        clearBudgetForm();
    });


    // ปุ่ม Navigation
    navAddBtn.addEventListener('click', () => showScreen('add-transaction-screen'));
    navSummaryBtn.addEventListener('click', () => showScreen('summary-screen'));
    navBudgetBtn.addEventListener('click', () => showScreen('budget-screen'));

    // Event Listeners for Month Navigation
    prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    nextMonthBtn.addEventListener('click', () => changeMonth(1));


    // === Initial Load ===
    displayCurrentHeaderMonth(); // Display current month in header
    loadTransactions(); // Load transactions and render them initially
    budgets = loadBudgets(); // Load budgets

    // ตั้งค่าเริ่มต้นของช่องเลือกวันที่ให้เป็นวันปัจจุบัน
    transactionDateInput.value = new Date().toISOString().split('T')[0];

    // Display initial month for summary (before showing screen if it's summary)
    displaySummaryMonth(currentViewDate);

    showScreen('add-transaction-screen'); // Start with the add transaction screen
});