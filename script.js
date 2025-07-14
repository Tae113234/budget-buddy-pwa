document.addEventListener('DOMContentLoaded', () => {
    // === Elements ===
    const currentMonthDisplay = document.getElementById('current-month');
    const addTransactionScreen = document.getElementById('add-transaction-screen');
    const summaryScreen = document.getElementById('summary-screen');
    const budgetScreen = document.getElementById('budget-screen');

    const navAddBtn = document.getElementById('nav-add');
    const navSummaryBtn = document = document.getElementById('nav-summary');
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

    const budgetCategorySelect = document.getElementById('budget-category-input'); // ใช้ตาม id ใน index.html
    const budgetAmountInput = document.getElementById('budget-amount-input');     // ใช้ตาม id ใน index.html
    const setBudgetBtn = document.getElementById('set-budget-btn');
    const currentBudgetsList = document.getElementById('current-budgets');

    const confirmationOverlay = document.getElementById('confirmation-overlay');
    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmationMessage = document.getElementById('confirmation-message');
    const confirmYesBtn = document.getElementById('confirm-yes-btn');
    const confirmNoBtn = document.getElementById('confirm-no-btn');

    const confettiContainer = document.getElementById('confetti-container');

    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const summaryMonthDisplay = document.getElementById('summary-month-display');


    // === Global Variables ===
    let transactions = [];
    let budgets = {};
    let isEditingTransaction = false;
    let editingTransactionId = null;
    let isEditingBudget = false;
    let editingBudgetCategory = null;
    let currentViewDate = new Date(); // สำหรับหน้าสรุปรายรับ-รายจ่าย
    let myChart = null; // สำหรับเก็บ instance ของ Chart.js


    // === Utility Functions ===

    // แสดง Notification
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.classList.add('notification', type);
        notification.textContent = message;
        document.body.appendChild(notification);

        // Force reflow for animation
        void notification.offsetWidth;

        notification.classList.add('show');

        setTimeout(() => {
            notification.classList.remove('show');
            notification.addEventListener('transitionend', () => {
                notification.remove();
            }, { once: true });
        }, 3000);
    }

    // แสดง Confirmation Dialog
    let resolveConfirmationPromise;
    function showConfirmationDialog(message) {
        confirmationMessage.textContent = message;
        confirmationOverlay.classList.add('show');
        return new Promise(resolve => {
            resolveConfirmationPromise = resolve;
        });
    }

    function hideConfirmationDialog() {
        confirmationOverlay.classList.remove('show');
    }

    confirmYesBtn.addEventListener('click', () => {
        resolveConfirmationPromise(true);
        hideConfirmationDialog();
    });

    confirmNoBtn.addEventListener('click', () => {
        resolveConfirmationPromise(false);
        hideConfirmationDialog();
    });

    // Confetti Effect
    function triggerConfetti() {
        const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'];
        const numParticles = 50;

        for (let i = 0; i < numParticles; i++) {
            const particle = document.createElement('div');
            particle.classList.add('confetti-particle');
            particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

            // Randomize start position
            const startX = Math.random() * window.innerWidth;
            const startY = -20; // Start above the viewport
            particle.style.left = `${startX}px`;
            particle.style.top = `${startY}px`;

            // Randomize end position and rotation
            const endX = startX + (Math.random() - 0.5) * 400; // Spread horizontally
            const rotateDeg = Math.random() * 720; // Random rotation

            particle.style.setProperty('--confetti-end-x', `${endX}px`);
            particle.style.setProperty('--confetti-rotate-deg', `${rotateDeg}deg`);

            // Randomize animation duration and delay
            const duration = 2 + Math.random() * 2; // 2 to 4 seconds
            const delay = Math.random() * 0.5; // 0 to 0.5 seconds
            particle.style.animationDuration = `${duration}s`;
            particle.style.animationDelay = `${delay}s`;

            confettiContainer.appendChild(particle);

            // Remove particle after animation to clean up DOM
            particle.addEventListener('animationend', () => {
                particle.remove();
            });
        }
    }


    // === Screen Navigation ===
    function showScreen(screenId) {
        document.querySelectorAll('section').forEach(screen => {
            screen.classList.remove('active-screen');
            screen.classList.add('hidden-screen');
        });
        document.getElementById(screenId).classList.add('active-screen');
        document.getElementById(screenId).classList.remove('hidden-screen');

        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById('nav-' + screenId.replace('-transaction-screen', '-add').replace('-screen', '')).classList.add('active');

        // Update content when screen changes
        if (screenId === 'summary-screen') {
            displaySummaryMonth(currentViewDate);
            updateSummary();
        } else if (screenId === 'budget-screen') {
            renderBudgets();
            clearBudgetForm(); // Clear budget form when navigating to budget screen
        } else if (screenId === 'add-transaction-screen') {
            renderTransactions(); // Refresh transaction list when going back to add screen
            clearTransactionForm(); // Clear transaction form when navigating to add screen
        }
    }


    // === Transaction Functions ===
    function saveTransactions() {
        localStorage.setItem('transactions', JSON.stringify(transactions));
    }

    function loadTransactions() {
        const storedTransactions = localStorage.getItem('transactions');
        console.log("Raw value from localStorage ('transactions'):", storedTransactions); // <--- เพิ่มบรรทัดนี้
        if (storedTransactions) {
            transactions = JSON.parse(storedTransactions);
        }
    }

    function clearTransactionForm() {
        amountInput.value = '';
        descriptionInput.value = '';
        categorySelect.value = 'food';
        transactionDateInput.value = new Date().toISOString().split('T')[0]; // Reset to current date
        expenseRadio.checked = true;
        addTransactionBtn.textContent = 'เพิ่มรายการ';
        isEditingTransaction = false;
        editingTransactionId = null;
    }

    function getCategoryThaiName(category) {
        const categories = {
            food: 'อาหาร',
            transport: 'เดินทาง',
            shopping: 'ช้อปปิ้ง',
            utilities: 'ค่าใช้จ่ายบ้าน',
            entertainment: 'บันเทิง',
            salary: 'เงินเดือน',
            freelance: 'ฟรีแลนซ์',
            gift: 'ของขวัญ',
            investment: 'ลงทุน',
            other: 'อื่น ๆ'
        };
        return categories[category] || category;
    }


    function renderTransactions() {
        transactionList.innerHTML = ''; // Clear existing list

        if (transactions.length === 0) {
            transactionList.innerHTML = '<li class="no-data">ยังไม่มีรายการบันทึก</li>';
            return;
        }

        // Sort transactions by date in descending order (latest first)
        const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

        let currentDateGroup = null; // To keep track of the current date for grouping
        let currentUl = null; // The <ul> element for the current date group

        sortedTransactions.forEach(t => {
            // Format date to local Thai string (e.g., 1 มกราคม 2567)
            // Add 'T00:00:00' to ensure consistent date parsing for UTC vs local time
            const transactionDate = new Date(t.date + 'T00:00:00').toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Check if a new date group needs to be created
            if (transactionDate !== currentDateGroup) {
                currentDateGroup = transactionDate;

                const dateGroupDiv = document.createElement('div');
                dateGroupDiv.classList.add('transaction-date-group');

                const dateHeading = document.createElement('h4');
                dateHeading.textContent = transactionDate;
                dateGroupDiv.appendChild(dateHeading);

                currentUl = document.createElement('ul'); // Create a new <ul> for this date group
                dateGroupDiv.appendChild(currentUl);

                transactionList.appendChild(dateGroupDiv); // Append the whole date group div to the main list container
            }

            const li = document.createElement('li');
            li.dataset.id = t.id;
            li.classList.add('transaction-item', t.type);

            const transactionContent = `
                <div class="transaction-details">
                    <span class="transaction-category">${getCategoryThaiName(t.category)}</span>
                    <span class="transaction-description">${t.description}</span>
                    <span class="transaction-date">${new Date(t.date).toLocaleDateString('th-TH')}</span>
                </div>
                <span class="transaction-amount">${t.type === 'income' ? '+' : '-'} ${t.amount.toLocaleString('th-TH')} บาท</span>
                <div class="transaction-actions">
                    <button class="edit-btn" data-id="${t.id}" title="แก้ไข"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn" data-id="${t.id}" title="ลบ"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;
            li.innerHTML = transactionContent;
            currentUl.appendChild(li); // Append the transaction item to the current date group's <ul>
        });

        // Add event listeners using event delegation to the parent ul (transactionList)
        // This listener is added once and handles clicks on its children
        // It checks if the clicked element (e.target) or its closest parent is an edit/delete button
        transactionList.removeEventListener('click', handleTransactionActions); // Remove old listener to prevent duplicates
        transactionList.addEventListener('click', handleTransactionActions); // Add new listener
        updateSummary(); // Update summary after rendering transactions
    }

    // New handler function for delegated events
    function handleTransactionActions(e) {
        const target = e.target;
        const transactionItem = target.closest('.transaction-item'); // Find the closest parent <li> with class 'transaction-item'

        if (!transactionItem) return; // If click wasn't on a transaction item, do nothing

        const id = transactionItem.dataset.id; // Get the ID from the <li>'s data-id attribute

        if (target.closest('.edit-btn')) { // Check if the clicked element or its parent is the edit button
            editTransaction(id);
        } else if (target.closest('.delete-btn')) { // Check if the clicked element or its parent is the delete button
            deleteTransaction(id);
        }
    }


    addTransactionBtn.addEventListener('click', () => {
        const amount = parseFloat(amountInput.value);
        const description = descriptionInput.value.trim();
        const category = categorySelect.value;
        const date = transactionDateInput.value;
        const type = incomeRadio.checked ? 'income' : 'expense';

        if (isNaN(amount) || amount <= 0 || description === '' || date === '') {
            showNotification('กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง', 'error');
            return;
        }

        if (isEditingTransaction) {
            // Update existing transaction
            const index = transactions.findIndex(t => t.id == editingTransactionId); // Use == for loose comparison if IDs can be number/string
            if (index !== -1) {
                transactions[index] = { id: editingTransactionId, amount, description, category, date, type };
                showNotification('แก้ไขรายการเรียบร้อย!', 'success');
            }
        } else {
            // Add new transaction
            const newTransaction = {
                id: Date.now(), // Use Date.now() as a number for ID
                amount,
                description,
                category,
                date,
                type
            };
            transactions.push(newTransaction);
            showNotification('เพิ่มรายการใหม่เรียบร้อย!', 'success');
            triggerConfetti(); // เรียกใช้ Confetti เมื่อเพิ่มรายการใหม่
        }

        saveTransactions();
        renderTransactions();
        clearTransactionForm();
    });

    function editTransaction(id) {
        const transactionToEdit = transactions.find(t => t.id == id); // Use == for loose comparison
        if (transactionToEdit) {
            amountInput.value = transactionToEdit.amount;
            descriptionInput.value = transactionToEdit.description;
            categorySelect.value = transactionToEdit.category;
            transactionDateInput.value = transactionToEdit.date; // Date is already in 'YYYY-MM-DD' format
            if (transactionToEdit.type === 'income') {
                incomeRadio.checked = true;
            } else {
                expenseRadio.checked = true;
            }
            addTransactionBtn.textContent = 'บันทึกการแก้ไข';
            isEditingTransaction = true;
            editingTransactionId = id;
            showNotification('กำลังแก้ไขรายการ...', 'info');
        }
    }

    async function deleteTransaction(id) {
        const confirmed = await showConfirmationDialog('คุณแน่ใจที่จะลบรายการนี้หรือไม่?');
        if (confirmed) {
            transactions = transactions.filter(t => t.id != id); // Use != for loose comparison
            saveTransactions();
            renderTransactions();
            showNotification('ลบรายการเรียบร้อย!', 'success');
        } else {
            showNotification('ยกเลิกการลบรายการ!', 'info');
        }
    }


    // === Summary Functions ===

    function displayCurrentHeaderMonth() {
        const options = { year: 'numeric', month: 'long' };
        currentMonthDisplay.textContent = new Date().toLocaleDateString('th-TH', options);
    }

    function displaySummaryMonth(date) {
        const options = { year: 'numeric', month: 'long' };
        summaryMonthDisplay.textContent = date.toLocaleDateString('th-TH', options);
    }

    function changeMonth(offset) {
        currentViewDate.setMonth(currentViewDate.getMonth() + offset);
        displaySummaryMonth(currentViewDate);
        updateSummary();
    }

    function updateSummary() {
        let totalIncome = 0;
        let totalExpense = 0;
        const categoryExpenses = {};
        const currentMonth = currentViewDate.getMonth();
        const currentYear = currentViewDate.getFullYear();

        console.log("All transactions before filtering:", transactions);
        console.log("Current view date for summary:", currentViewDate);

        // Filter transactions for the current month/year
        const filteredTransactions = transactions.filter(t => {
            const transactionDate = new Date(t.date + 'T00:00:00'); // Ensure date is parsed correctly in local timezone
            return transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear;
        });

        console.log("Filtered Transactions inside updateSummary:", filteredTransactions);

        filteredTransactions.forEach(t => {
            if (t.type === 'income') {
                totalIncome += t.amount;
            } else {
                totalExpense += t.amount;
                // Accumulate expenses by category
                if (categoryExpenses[t.category]) {
                    categoryExpenses[t.category] += t.amount;
                } else {
                    categoryExpenses[t.category] = t.amount;
                }
            }
        });

        const currentBalance = totalIncome - totalExpense;

        totalIncomeDisplay.textContent = totalIncome.toLocaleString('th-TH') + ' บาท';
        totalExpenseDisplay.textContent = totalExpense.toLocaleString('th-TH') + ' บาท';
        currentBalanceDisplay.textContent = currentBalance.toLocaleString('th-TH') + ' บาท';

        // Update the chart
        updateChart(categoryExpenses);

        // Update budget status (this will re-render budgets with current month's expenses)
        renderBudgets();
    }

    function updateChart(categoryExpenses) {
        const categories = Object.keys(categoryExpenses).map(cat => getCategoryThaiName(cat));
        const amounts = Object.values(categoryExpenses);

        if (myChart) {
            myChart.destroy(); // Destroy existing chart instance
        }

        if (amounts.length === 0 || amounts.every(amount => amount === 0)) {
            categoryChartCanvas.classList.add('hidden'); // Hide canvas
            noChartDataMessage.classList.remove('hidden-message'); // Show message
            return;
        } else {
            categoryChartCanvas.classList.remove('hidden'); // Show canvas
            noChartDataMessage.classList.add('hidden-message'); // Hide message
        }

        const data = {
            labels: categories,
            datasets: [{
                data: amounts,
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#6C757D', '#28A745', '#DC3545', '#17A2B8'
                ],
                hoverOffset: 4
            }]
        };

        const ctx = categoryChartCanvas.getContext('2d');
        myChart = new Chart(ctx, { // Assign to myChart variable
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            font: {
                                family: 'Kanit', // ใช้ฟอนต์ Kanit ในกราฟ
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
                                    label += context.parsed.toLocaleString('th-TH') + ' บาท';
                                }
                                return label;
                            }
                        },
                        bodyFont: {
                            family: 'Kanit',
                        },
                        titleFont: {
                            family: 'Kanit',
                        }
                    }
                }
            }
        });
    }


    // === Budget Functions ===
    function saveBudgets() {
        localStorage.setItem('budgets', JSON.stringify(budgets));
    }

    function loadBudgets() {
        const storedBudgets = localStorage.getItem('budgets');
        return storedBudgets ? JSON.parse(storedBudgets) : {};
    }

    function clearBudgetForm() {
        budgetAmountInput.value = '';
        budgetCategorySelect.value = 'food';
        setBudgetBtn.textContent = 'บันทึกงบประมาณ';
        isEditingBudget = false;
        editingBudgetCategory = null;
    }

    function renderBudgets() {
        currentBudgetsList.innerHTML = ''; // Clear existing list

        // Get expenses for the current month to compare against budget
        const currentMonthExpenses = {};
        const currentMonth = currentViewDate.getMonth();
        const currentYear = currentViewDate.getFullYear();

        transactions.filter(t => {
            const transactionDate = new Date(t.date + 'T00:00:00');
            return t.type === 'expense' &&
                   transactionDate.getMonth() === currentMonth &&
                   transactionDate.getFullYear() === currentYear;
        }).forEach(t => {
            if (currentMonthExpenses[t.category]) {
                currentMonthExpenses[t.category] += t.amount;
            } else {
                currentMonthExpenses[t.category] = t.amount;
            }
        });

        const budgetKeys = Object.keys(budgets);

        if (budgetKeys.length === 0) {
            currentBudgetsList.innerHTML = '<li class="no-data">ยังไม่ได้ตั้งงบประมาณ</li>';
            return;
        }


        budgetKeys.forEach(category => {
            if (budgets.hasOwnProperty(category)) {
                const budgetAmount = budgets[category];
                const expensesForCategory = currentMonthExpenses[category] || 0;
                const remainingBudget = budgetAmount - expensesForCategory;

                const li = document.createElement('li');
                li.classList.add('budget-item');
                li.dataset.category = category;

                const statusClass = remainingBudget < 0 ? 'over-budget' : (remainingBudget <= budgetAmount * 0.2 ? 'warning-budget' : ''); // Added warning status
                const statusText = remainingBudget < 0 ?
                                   `เกินงบประมาณ ${Math.abs(remainingBudget).toLocaleString('th-TH')} บาท` :
                                   `คงเหลือ ${remainingBudget.toLocaleString('th-TH')} บาท`;

                li.innerHTML = `
                    <div class="budget-info">
                        <span class="budget-category-name">${getCategoryThaiName(category)}</span>
                        <div class="budget-status ${statusClass}">
                            <span>งบประมาณ: ${budgetAmount.toLocaleString('th-TH')} บาท</span> |
                            <span>ใช้ไป: ${expensesForCategory.toLocaleString('th-TH')} บาท</span> |
                            <span>${statusText}</span>
                        </div>
                    </div>
                    <div class="budget-actions">
                        <button class="edit-budget-btn" data-category="${category}" title="แก้ไข"><i class="fas fa-edit"></i></button>
                        <button class="delete-budget-btn" data-category="${category}" title="ลบ"><i class="fas fa-trash-alt"></i></button>
                    </div>
                `;
                currentBudgetsList.appendChild(li);
            }
        });

        // Add event listeners for edit/delete buttons using delegation for budgets
        currentBudgetsList.removeEventListener('click', handleBudgetActions); // Prevent multiple listeners
        currentBudgetsList.addEventListener('click', handleBudgetActions);
    }

    // New handler for budget actions
    function handleBudgetActions(e) {
        const target = e.target;
        const budgetItem = target.closest('.budget-item');

        if (!budgetItem) return;

        const category = budgetItem.dataset.category;

        if (target.closest('.edit-budget-btn')) {
            editBudget(category);
        } else if (target.closest('.delete-budget-btn')) {
            deleteBudget(category);
        }
    }


    function editBudget(category) {
        budgetCategorySelect.value = category;
        budgetAmountInput.value = budgets[category];
        setBudgetBtn.textContent = 'บันทึกการแก้ไขงบประมาณ';
        isEditingBudget = true;
        editingBudgetCategory = category;
        showNotification(`กำลังแก้ไขงบประมาณสำหรับ ${getCategoryThaiName(category)}...`, 'info');
    }

    async function deleteBudget(category) {
        const confirmed = await showConfirmationDialog(`คุณแน่ใจที่จะลบงบประมาณสำหรับ ${getCategoryThaiName(category)} นี้หรือไม่?`);
        if (confirmed) {
            delete budgets[category];
            saveBudgets();
            renderBudgets();
            showNotification('ลบงบประมาณเรียบร้อย!', 'success');
        } else {
            showNotification('ยกเลิกการลบงบประมาณ!', 'info');
        }
    }

    setBudgetBtn.addEventListener('click', async () => {
        const category = budgetCategorySelect.value;
        const amount = parseFloat(budgetAmountInput.value);

        if (isNaN(amount) || amount < 0) {
            showNotification('กรุณากรอกจำนวนเงินงบประมาณที่ถูกต้อง', 'error');
            return;
        }

        if (isEditingBudget) {
            // If editing, check if category is being changed and if new category exists
            if (category !== editingBudgetCategory && budgets.hasOwnProperty(category)) {
                const confirmed = await showConfirmationDialog(`หมวดหมู่ "${getCategoryThaiName(category)}" มีงบประมาณอยู่แล้ว ต้องการอัปเดตหรือไม่?`);
                if (!confirmed) {
                    showNotification('ยกเลิกการแก้ไขงบประมาณ!', 'info');
                    return;
                }
                // If confirmed and category changed, delete old budget first
                delete budgets[editingBudgetCategory];
            } else if (category === editingBudgetCategory && budgets[category] === amount) {
                // If no changes, just notify
                showNotification('ไม่มีการเปลี่ยนแปลงงบประมาณ', 'info');
                clearBudgetForm();
                return;
            }
            budgets[category] = amount;
            showNotification(`อัปเดตงบประมาณสำหรับ ${getCategoryThaiName(category)} เรียบร้อย!`, 'success');
            triggerConfetti();

        } else {
            // Adding new budget
            if (budgets.hasOwnProperty(category)) {
                const confirmed = await showConfirmationDialog(`หมวดหมู่ "${getCategoryThaiName(category)}" มีงบประมาณอยู่แล้ว ต้องการอัปเดตหรือไม่?`);
                if (confirmed) {
                    budgets[category] = amount;
                    showNotification(`อัปเดตงบประมาณสำหรับ ${getCategoryThaiName(category)} เรียบร้อย!`, 'success');
                    triggerConfetti(); // เรียกใช้ Confetti
                } else {
                    showNotification('ยกเลิกการตั้งงบประมาณ!', 'info');
                    return;
                }
            } else {
                budgets[category] = amount;
                showNotification(`ตั้งงบประมาณสำหรับ ${getCategoryThaiName(category)} เรียบร้อย!`, 'success');
                triggerConfetti(); // เรียกใช้ Confetti
            }
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
displayCurrentHeaderMonth(); // แสดงเดือนปัจจุบันในหัวข้อ
loadTransactions();          // โหลดรายการจาก localStorage
renderTransactions();        // ✅ แสดงรายการทันทีหลังโหลด
budgets = loadBudgets();     // โหลดข้อมูลงบประมาณจาก localStorage
transactionDateInput.value = new Date().toISOString().split('T')[0]; // ตั้งวันที่เริ่มต้นเป็นวันนี้
displaySummaryMonth(currentViewDate); // แสดงเดือนในหน้าสรุป
showScreen('add-transaction-screen'); // เริ่มต้นที่หน้าบันทึกรายการ
 // Start with the add transaction screen
});