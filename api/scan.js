// api/scan.js - Complete Vercel serverless function
export default async function handler(req, res) {
    // Enable CORS for frontend requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // We only accept POST requests with form data
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        console.log("Received scan request from frontend...");

        // --- STEP 1: Mock image processing ---
        // In production, you'd parse multipart form data here
        const scanMethod = 'image'; // Would come from form data
        
        // --- STEP 2: Try barcode detection first ---
        let barcode = null;
        let productName = '';
        
        if (Math.random() < 0.3) { // 30% chance of barcode detection
            barcode = '123456789012';
            console.log('Barcode detected:', barcode);
            
            // Mock UPC lookup
            const upcResult = await mockUPCLookup(barcode);
            if (upcResult) {
                productName = upcResult.title;
            }
        }

        // --- STEP 3: Fallback to Google Lens if no barcode ---
        if (!productName) {
            console.log('Using Google Lens identification...');
            productName = await mockGoogleLensApi();
        }

        if (!productName) {
            return res.status(404).json({ error: 'Could not identify item' });
        }

        console.log(`Product identified as: "${productName}"`);

        // --- STEP 4: Get eBay market data ---
        const ebayData = await mockEbayApi(productName);
        
        // --- STEP 5: Get valuable parts data ---
        const partsData = await mockPartsApi(productName);

        // --- STEP 6: Calculate Power Score ---
        const powerScore = calculatePowerScore(ebayData, partsData);

        // --- STEP 7: Format response for frontend ---
        const result = {
            productName: productName,
            imageUrl: `https://placehold.co/300x300/e2e8f0/334155?text=${encodeURIComponent(productName)}`,
            barcode: barcode,
            scanMethod: barcode ? 'barcode' : 'image',
            powerScore: powerScore,
            soldListings: ebayData.soldListings || [],
            activeListings: ebayData.activeListings || 10,
            valuableParts: partsData || [],
            timestamp: new Date().toISOString()
        };

        console.log('Scan completed successfully');
        res.status(200).json(result);

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ 
            error: 'Failed to process scan',
            message: error.message 
        });
    }
}

// --- Mock Functions ---

async function mockUPCLookup(barcode) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                title: 'Nintendo Game Boy DMG-01',
                brand: 'Nintendo',
                category: 'Video Games & Consoles'
            });
        }, 800);
    });
}

async function mockGoogleLensApi() {
    const products = [
        'Vintage Nintendo Game Boy',
        'Panasonic PV-V4022 VCR',
        'Canon AE-1 Camera', 
        'Sony Walkman WM-10',
        'Apple iPod Classic 160GB',
        'Atari 2600 Console',
        'Polaroid SX-70 Camera',
        'Commodore 64 Computer'
    ];
    
    return new Promise(resolve => {
        setTimeout(() => {
            const randomProduct = products[Math.floor(Math.random() * products.length)];
            resolve(randomProduct);
        }, 1500);
    });
}

async function mockEbayApi(productName) {
    return new Promise(resolve => {
        setTimeout(() => {
            // Generate realistic market data
            const basePrice = 25 + Math.random() * 100; // $25-$125
            const numListings = 4 + Math.floor(Math.random() * 12); // 4-16 listings
            
            const soldListings = [];
            const conditions = ['New', 'Used', 'Used', 'Used', 'For parts or not working'];
            
            for (let i = 0; i < numListings; i++) {
                const variation = (Math.random() - 0.5) * 0.4; // ±20% price variation
                const price = Math.max(5, basePrice * (1 + variation));
                const condition = conditions[Math.floor(Math.random() * conditions.length)];
                
                soldListings.push({
                    price: Math.round(price * 100) / 100,
                    condition: condition,
                    title: `${productName} - ${condition}`,
                    endTime: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
                });
            }
            
            const avgPrice = soldListings.reduce((sum, item) => sum + item.price, 0) / soldListings.length;
            const activeListings = Math.floor(Math.random() * 20) + 5;
            
            resolve({
                soldListings: soldListings,
                activeListings: activeListings,
                avgPrice: avgPrice,
                totalSold: soldListings.length
            });
        }, 1200);
    });
}

async function mockPartsApi(productName) {
    const partsTemplates = {
        'nintendo': [
            { name: 'Original Box', avgPrice: 45, sellThrough: 75 },
            { name: 'Manual/Instructions', avgPrice: 20, sellThrough: 95 },
            { name: 'Battery Cover', avgPrice: 15, sellThrough: 80 }
        ],
        'vcr': [
            { name: 'Original Remote Control', avgPrice: 28, sellThrough: 95 },
            { name: 'AV Cables', avgPrice: 12, sellThrough: 70 }
        ],
        'camera': [
            { name: 'Original Lens Cap', avgPrice: 18, sellThrough: 85 },
            { name: 'Camera Strap', avgPrice: 15, sellThrough: 70 },
            { name: 'Battery Pack', avgPrice: 25, sellThrough: 80 }
        ],
        'walkman': [
            { name: 'Original Headphones', avgPrice: 35, sellThrough: 85 },
            { name: 'Battery Cover', avgPrice: 12, sellThrough: 75 }
        ],
        'ipod': [
            { name: 'Original Dock', avgPrice: 22, sellThrough: 80 },
            { name: 'USB Cable', avgPrice: 15, sellThrough: 90 }
        ],
        'atari': [
            { name: 'Original Controllers', avgPrice: 30, sellThrough: 85 },
            { name: 'Power Adapter', avgPrice: 18, sellThrough: 75 }
        ]
    };
    
    return new Promise(resolve => {
        setTimeout(() => {
            const productLower = productName.toLowerCase();
            let parts = [];
            
            // Find matching parts template
            for (const [key, value] of Object.entries(partsTemplates)) {
                if (productLower.includes(key)) {
                    parts = value;
                    break;
                }
            }
            
            // Add default parts if nothing found but still 40% chance
            if (parts.length === 0 && Math.random() < 0.4) {
                parts = [
                    { name: 'Original Packaging', avgPrice: 20, sellThrough: 70 },
                    { name: 'Power Adapter', avgPrice: 15, sellThrough: 75 }
                ];
            }
            
            // Add price variation and limit to 1-3 parts
            const selectedParts = parts
                .slice(0, Math.floor(Math.random() * 3) + 1)
                .map(part => ({
                    name: part.name,
                    avgPrice: Math.round((part.avgPrice * (0.8 + Math.random() * 0.4)) * 100) / 100,
                    sellThrough: Math.max(60, Math.min(98, part.sellThrough + (Math.random() - 0.5) * 20))
                }));
            
            resolve(selectedParts);
        }, 1000);
    });
}

function calculatePowerScore(ebayData, partsData) {
    const avgPrice = ebayData.avgPrice || 40;
    const soldListings = ebayData.totalSold || ebayData.soldListings?.length || 0;
    const activeListings = ebayData.activeListings || 10;
    const sellThroughRate = soldListings / (soldListings + activeListings) * 100;
    
    let score = 0;
    
    // Price component (40% of total score)
    if (avgPrice > 100) score += 40;
    else if (avgPrice > 60) score += 35;
    else if (avgPrice > 30) score += 25;
    else if (avgPrice > 15) score += 15;
    else score += 8;
    
    // Sell-through rate component (40% of total score)
    if (sellThroughRate > 80) score += 40;
    else if (sellThroughRate > 60) score += 32;
    else if (sellThroughRate > 40) score += 24;
    else if (sellThroughRate > 20) score += 16;
    else score += 8;
    
    // Volume component (10% of total score)
    if (soldListings > 50) score += 10;
    else if (soldListings > 25) score += 8;
    else if (soldListings > 10) score += 6;
    else if (soldListings > 5) score += 4;
    else score += 2;
    
    // Parts bonus (10% of total score)
    if (partsData && partsData.length > 0) {
        const avgPartPrice = partsData.reduce((sum, part) => sum + part.avgPrice, 0) / partsData.length;
        if (avgPartPrice > 30) score += 10;
        else if (avgPartPrice > 20) score += 8;
        else if (avgPartPrice > 10) score += 6;
        else score += 4;
    }
    
    return Math.min(Math.round(score), 100);
}