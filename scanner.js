// Scanner functionality
async function performScan() {
    const { user } = state;
    
    if (user.tier === 'freemium' && user.dailyScansRemaining <= 0) {
        showToast('Daily scan limit reached. Upgrade to Pro for more scans!', 'error');
        setTimeout(() => window.location.href = 'upgrade.html', 1500);
        return;
    }
    
    if (user.tier !== 'freemium' && user.monthlyScansRemaining <= 0 && user.scanPacks <= 0) {
        openModal('scanPackModal');
        return;
    }
    
    const scanChoice = await showScanOptions();
    
    if (scanChoice === 'camera') {
        startCameraScanning();
    } else if (scanChoice === 'barcode') {
        startBarcodeScanning();
    }
}

async function showScanOptions() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Choose Scan Method</h3>
                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button class="btn btn-primary" style="flex: 1;" onclick="resolveScan('barcode')">
                        <svg width="24" height="24" fill="currentColor" style="margin-bottom: 0.5rem;"><path d="M2 6h2v12H2zm3 0h1v12H5zm2 0h1v12H7zm3 0h2v12h-2zm3 0h1v12h-1zm2 0h2v12h-2zm3 0h1v12h-1zm2 0h2v12h-2z"/></svg>
                        <div>Scan Barcode</div>
                    </button>
                    <button class="btn btn-secondary" style="flex: 1;" onclick="resolveScan('camera')">
                        <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        <div>Snap Photo</div>
                    </button>
                </div>
                <button class="btn btn-secondary" style="width: 100%; margin-top: 1rem;" onclick="resolveScan(null)">Cancel</button>
            </div>`;
        document.body.appendChild(modal);
        window.resolveScan = (choice) => {
            document.body.removeChild(modal);
            resolve(choice);
        };
    });
}

async function startBarcodeScanning() {
    showManualBarcodeEntry();
}

function showManualBarcodeEntry() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Enter Barcode</h3>
            <p style="color: var(--text-secondary); margin-bottom: 1rem;">Enter UPC/ISBN code:</p>
            <input type="text" id="manual-barcode" class="form-input" placeholder="e.g. 096619119449" value="036000291452">
            <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                <button class="btn btn-secondary" style="flex: 1;" onclick="cancelManualEntry()">Cancel</button>
                <button class="btn btn-primary" style="flex: 1;" onclick="submitManualBarcode()">Search</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    setTimeout(() => document.getElementById('manual-barcode').focus(), 100);
    window.cancelManualEntry = () => document.body.removeChild(modal);
    window.submitManualBarcode = () => {
        const barcode = document.getElementById('manual-barcode').value;
        if (barcode) {
            document.body.removeChild(modal);
            processBarcodeResult(barcode);
        }
    };
}

async function startCameraScanning() {
    showToast('Camera photo scanning coming soon!', 'success');
}

async function processBarcodeResult(barcode) {
    const scanButton = document.getElementById('scanButton');
    if (scanButton) {
        scanButton.innerHTML = '<div class="loading-spinner"></div>';
    }
    
    const mockData = {
        '096619119449': { name: 'Nintendo Switch Pro Controller', category: 'Gaming', powerScore: 88, avgPrice: 59.99, sellThrough: 82, worthPaying: 35, daysToSell: 7 },
        '036000291452': { name: 'Sony SLV-D370P VCR/DVD Combo', category: 'Electronics', powerScore: 35, avgPrice: 25, sellThrough: 20, worthPaying: 8, daysToSell: 45, partOut: [
            { name: 'Remote Control (RMT-V501C)', powerScore: 94, value: 45, sellThrough: 92 }, 
            { name: 'Power Cord', powerScore: 72, value: 15, sellThrough: 75 }, 
            { name: 'AV Cables (Original)', powerScore: 65, value: 12, sellThrough: 68 }, 
            { name: 'DVD Laser Assembly', powerScore: 81, value: 35, sellThrough: 78 }
        ]},
        'default': { name: 'Unknown Item', category: 'General', powerScore: 50, avgPrice: 20, sellThrough: 50, worthPaying: 10, daysToSell: 14 }
    };
    
    const result = mockData[barcode] || mockData['default'];
    
    setTimeout(() => {
        // Store result and redirect to results page
        state.currentScan = result;
        state.scanHistory.push({ ...result, timestamp: Date.now() });
        
        // Deduct scan
        const { user } = state;
        if (user.tier === 'freemium') {
            user.dailyScansRemaining--;
        } else if (user.monthlyScansRemaining > 0) {
            user.monthlyScansRemaining--;
        } else {
            user.scanPacks--;
        }
        
        saveState();
        
        // Redirect to results page
        window.location.href = 'results.html';
    }, 1500);
}