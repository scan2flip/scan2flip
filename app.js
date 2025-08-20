// State Management
let state = {
    user: {
        tier: 'freemium', // freemium, pro, powerPro
        dailyScansRemaining: 5,
        monthlyScansRemaining: 150,
        scanPacks: 0,
        email: null
    },
    inventory: [],
    expenses: [],
    watchlist: [],
    flopList: [],
    mileageTrips: [],
    scanHistory: [],
    currentScan: null,
    goldMineFinds: []
};

// Constants
const IRS_MILEAGE_RATE = 0.67; // 2024 IRS standard mileage rate

// Initialize app
function initApp() {
    loadState();
    updateUI();
    markCurrentPage();
    checkDailyReset();
}

// Mark current page as active in navigation
function markCurrentPage() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('href') === currentPage) {
            item.classList.add('active');
        }
    });
}

// State Management Functions
function saveState() {
    localStorage.setItem('scan2flip_state', JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem('scan2flip_state');
    if (saved) {
        state = JSON.parse(saved);
    }
}

function checkDailyReset() {
    const lastReset = localStorage.getItem('scan2flip_last_reset');
    const today = new Date().toDateString();
    if (lastReset !== today && state.user.tier === 'freemium') {
        state.user.dailyScansRemaining = 5;
        localStorage.setItem('scan2flip_last_reset', today);
        saveState();
    }
}

// UI Update Functions
function updateUI() {
    const { user } = state;
    const scanCountEl = document.getElementById('scanCount');
    const scanCounter = document.getElementById('scanCounter');
    
    if (scanCountEl && scanCounter) {
        if (user.tier === 'freemium') {
            scanCountEl.textContent = `${user.dailyScansRemaining}/5 Daily`;
            scanCounter.classList.toggle('low', user.dailyScansRemaining <= 1);
        } else {
            scanCountEl.textContent = `${user.monthlyScansRemaining} Scans`;
            scanCounter.classList.toggle('low', user.monthlyScansRemaining <= 50);
        }
    }
    
    const packBadge = document.getElementById('scanPackBadge');
    if (packBadge) {
        if (user.scanPacks > 0) {
            packBadge.style.display = 'flex';
            const packCount = document.getElementById('packCount');
            if (packCount) packCount.textContent = user.scanPacks * 500;
        } else {
            packBadge.style.display = 'none';
        }
    }
}

// Toast Notifications
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}

// Modal Functions
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

// Scan Pack Purchase
async function purchaseScanPack() {
    showToast('Processing payment...', 'success');
    setTimeout(() => {
        state.user.scanPacks++;
        closeModal('scanPackModal');
        updateUI();
        saveState();
        showToast('500 scans added to your account!', 'success');
        if (typeof confetti !== 'undefined') {
            confetti({ 
                particleCount: 100, 
                spread: 70, 
                origin: { y: 0.6 } 
            });
        }
    }, 2000);
}

// Upgrade Functions
async function upgradeToTier(tier, scans) {
    showToast('Redirecting to payment...', 'success');
    setTimeout(() => {
        state.user.tier = tier;
        state.user.monthlyScansRemaining = scans;
        updateUI();
        saveState();
        showToast(`Welcome to ${tier.charAt(0).toUpperCase() + tier.slice(1)}!`, 'success');
        if (typeof confetti !== 'undefined') {
            confetti({ 
                particleCount: 200, 
                spread: 100, 
                origin: { y: 0.6 } 
            });
        }
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    }, 2000);
}

function upgradeToPro() {
    upgradeToTier('pro', 2000);
}

function upgradeToPowerPro() {
    upgradeToTier('powerPro', 3500);
}

// Export Functions
function exportData() {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scan2flip_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported successfully!', 'success');
}

// Logout
function logout() {
    if (confirm('Are you sure you want to sign out?')) {
        localStorage.clear();
        window.location.href = 'index.html';
    }
}

// Gold Strike Animation
function showGoldStrike() {
    const goldNotification = document.createElement('div');
    goldNotification.className = 'gold-strike-notification';
    goldNotification.innerHTML = `
        <div class="gold-strike-content">
            <div class="gold-strike-icon">⚡</div>
            <div class="gold-strike-text">YOU'VE STRUCK GOLD!</div>
            <div class="gold-strike-subtext">Added to Gold Mine</div>
        </div>`;
    document.body.appendChild(goldNotification);
    
    if (typeof confetti !== 'undefined') {
        confetti({ 
            particleCount: 100, 
            spread: 70, 
            origin: { y: 0.6 }, 
            colors: ['#FFD700', '#FFA500', '#FFD700'] 
        });
    }
    
    setTimeout(() => {
        goldNotification.classList.add('fade-out');
        setTimeout(() => document.body.removeChild(goldNotification), 500);
    }, 3000);
}

// Gold Mine Functions
function addToGoldMine(item) {
    if (!state.goldMineFinds) state.goldMineFinds = [];
    state.goldMineFinds.push({ 
        ...item, 
        foundBy: state.user.email || 'Anonymous', 
        timestamp: Date.now() 
    });
    saveState();
}

// Calculate Distance (for mileage tracking)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Radius of the Earth in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Settings placeholder
function showSettings() {
    showToast('Settings coming soon!', 'success');
}

// Helper to check if user can access a feature
function requireTier(requiredTier, featureName) {
    const tierLevels = { 'freemium': 0, 'pro': 1, 'powerPro': 2 };
    const userLevel = tierLevels[state.user.tier] || 0;
    const requiredLevel = tierLevels[requiredTier] || 0;
    
    if (userLevel < requiredLevel) {
        showToast(`${featureName} is a ${requiredTier === 'powerPro' ? 'Power Pro' : 'Pro'} feature. Upgrade to unlock!`, 'error');
        setTimeout(() => {
            window.location.href = 'upgrade.html';
        }, 1500);
        return false;
    }
    return true;
}