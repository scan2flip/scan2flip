// scan-service.js
// Client-side service for handling image scanning and product identification

class ScanService {
    constructor() {
        // Auto-detect environment
        this.apiBaseUrl = this.getApiBaseUrl();
        this.currentScanId = null;
    }

    getApiBaseUrl() {
        // Check if we're in production (Vercel) or local development
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3000/api'; // Local Express server
        } else {
            return '/api'; // Vercel serverless functions
        }
    }

    // Main method to process an image
    async scanImage(imageFile, scanMethod = 'image') {
        try {
            this.currentScanId = this.generateScanId();
            
            // Store the scan start time
            const scanStartTime = Date.now();
            
            // Try barcode detection first if it's a modern item
            let barcodeResult = null;
            if (scanMethod === 'barcode' || scanMethod === 'image') {
                barcodeResult = await this.tryBarcodeDetection(imageFile);
            }
            
            // If barcode detection worked, get product info by UPC
            if (barcodeResult && barcodeResult.barcode) {
                console.log('Barcode detected:', barcodeResult.barcode);
                return await this.getProductByBarcode(barcodeResult.barcode, imageFile);
            }
            
            // Fallback to Google Lens hack
            console.log('Using Google Lens identification...');
            return await this.identifyWithGoogleLens(imageFile, scanMethod);
            
        } catch (error) {
            console.error('Scan failed:', error);
            throw new Error(`Scan failed: ${error.message}`);
        }
    }

    // Try to detect barcode from image
    async tryBarcodeDetection(imageFile) {
        try {
            // Use ZXing library for barcode detection
            const { BrowserMultiFormatReader } = await import('https://unpkg.com/@zxing/library@latest/esm/index.js');
            
            const codeReader = new BrowserMultiFormatReader();
            
            // Create image element from file
            const imageUrl = URL.createObjectURL(imageFile);
            const img = new Image();
            
            return new Promise((resolve) => {
                img.onload = async () => {
                    try {
                        const result = await codeReader.decodeFromImageElement(img);
                        URL.revokeObjectURL(imageUrl);
                        resolve({
                            barcode: result.getText(),
                            format: result.getBarcodeFormat()
                        });
                    } catch (error) {
                        console.log('No barcode detected, proceeding with image recognition');
                        URL.revokeObjectURL(imageUrl);
                        resolve(null);
                    }
                };
                img.src = imageUrl;
            });
            
        } catch (error) {
            console.log('Barcode detection failed:', error);
            return null;
        }
    }

    // Get product info by barcode/UPC
    async getProductByBarcode(barcode, imageFile) {
        try {
            // Use a free UPC database API
            const upcResponse = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);
            const upcData = await upcResponse.json();
            
            if (upcData.items && upcData.items.length > 0) {
                const product = upcData.items[0];
                const productName = product.title || product.brand + ' ' + product.model;
                
                // Get eBay data for the product
                const ebayData = await this.getEbayData(productName);
                
                return this.formatScanResult({
                    productName: productName,
                    imageUrl: URL.createObjectURL(imageFile),
                    barcode: barcode,
                    scanMethod: 'barcode',
                    brand: product.brand,
                    category: product.category,
                    ebayData: ebayData
                });
            }
            
            // If UPC lookup fails, fall back to Google Lens
            return await this.identifyWithGoogleLens(imageFile, 'barcode_fallback');
            
        } catch (error) {
            console.error('Barcode lookup failed:', error);
            return await this.identifyWithGoogleLens(imageFile, 'barcode_fallback');
        }
    }

    // Use Google Lens hack for identification
    async identifyWithGoogleLens(imageFile, scanMethod) {
        const formData = new FormData();
        formData.append('image', imageFile);
        formData.append('scanMethod', scanMethod);
        formData.append('scanId', this.currentScanId);

        // Standardize endpoint - both use /api/scan now
        const endpoint = `${this.apiBaseUrl}/scan`;

        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const result = await response.json();
        return this.formatScanResult(result);
    }

    // Get eBay market data
    async getEbayData(productName) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/ebay-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ productName })
            });

            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('eBay data fetch failed:', error);
        }

        // Return mock data as fallback
        return {
            soldListings: [
                { price: 45, condition: 'Used' },
                { price: 38, condition: 'Used' },
                { price: 52, condition: 'Used' }
            ],
            totalSold: 3,
            activeListings: 8,
            avgPrice: 45
        };
    }

    // Format the scan result for the frontend
    formatScanResult(rawResult) {
        // Handle both API formats (backend returns formatted data now)
        return {
            scanId: this.currentScanId,
            name: rawResult.productName || rawResult.name,
            image: rawResult.imageUrl || rawResult.image,
            barcode: rawResult.barcode || null,
            scanMethod: rawResult.scanMethod || 'image',
            soldListings: rawResult.soldListings || [],
            activeListings: rawResult.activeListings || 10,
            powerScore: rawResult.powerScore || this.calculatePowerScore(rawResult.soldListings || [], rawResult.activeListings || 10),
            valuableParts: rawResult.valuableParts || [],
            category: rawResult.category || null,
            brand: rawResult.brand || null,
            timestamp: rawResult.timestamp || new Date().toISOString()
        };
    }

    // Calculate Power Score™
    calculatePowerScore(soldListings, activeListings) {
        if (!soldListings.length) return 20; // Default low score

        const avgPrice = soldListings.reduce((sum, item) => sum + item.price, 0) / soldListings.length;
        const totalSold = soldListings.length;
        const sellThroughRate = totalSold / (totalSold + activeListings) * 100;

        // Power Score algorithm
        let score = 0;

        // Price component (40% of score)
        if (avgPrice > 100) score += 40;
        else if (avgPrice > 50) score += 30;
        else if (avgPrice > 25) score += 20;
        else score += 10;

        // Sell-through rate component (40% of score)  
        if (sellThroughRate > 80) score += 40;
        else if (sellThroughRate > 60) score += 30;
        else if (sellThroughRate > 40) score += 20;
        else score += 10;

        // Volume component (20% of score)
        if (totalSold > 50) score += 20;
        else if (totalSold > 20) score += 15;
        else if (totalSold > 10) score += 10;
        else score += 5;

        return Math.min(Math.round(score), 100);
    }

    // Detect valuable parts (simplified AI)
    detectValuableParts(productName) {
        const name = productName.toLowerCase();
        const parts = [];

        // Gaming consoles
        if (name.includes('playstation') || name.includes('xbox') || name.includes('nintendo')) {
            parts.push({
                name: 'Original Controller',
                avgPrice: 35,
                sellThrough: 85
            });
        }

        // VCRs and old electronics
        if (name.includes('vcr') || name.includes('cassette') || name.includes('player')) {
            parts.push({
                name: 'Original Remote Control', 
                avgPrice: 28,
                sellThrough: 95
            });
        }

        // Cameras
        if (name.includes('camera') || name.includes('canon') || name.includes('nikon')) {
            parts.push({
                name: 'Battery & Charger',
                avgPrice: 22,
                sellThrough: 78
            });
        }

        return parts;
    }

    // Generate unique scan ID
    generateScanId() {
        return 'scan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Save scan to local storage and eventually Supabase
    async saveScan(scanResult, purchaseCost = null) {
        try {
            // Save to localStorage for now
            let scanHistory = JSON.parse(localStorage.getItem('scan2flip-scans')) || [];
            
            const scanRecord = {
                ...scanResult,
                purchaseCost: purchaseCost,
                savedAt: new Date().toISOString()
            };

            scanHistory.unshift(scanRecord); // Add to beginning
            
            // Keep only last 100 scans
            if (scanHistory.length > 100) {
                scanHistory = scanHistory.slice(0, 100);
            }

            localStorage.setItem('scan2flip-scans', JSON.stringify(scanHistory));

            // TODO: Also save to Supabase when user is authenticated
            // await Scan2FlipDB.saveScan(currentUser.uid, scanRecord);

            return scanRecord;
        } catch (error) {
            console.error('Failed to save scan:', error);
            throw error;
        }
    }
}

// Global scan service instance
window.ScanService = new ScanService();

// Export for module usage
export default ScanService;