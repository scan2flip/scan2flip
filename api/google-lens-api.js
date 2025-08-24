const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const multer = require('multer');
const FormData = require('form-data');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: '/tmp/' }); // Vercel uses /tmp for temp storage

// Use environment variables for API keys
const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
const EBAY_APP_ID = process.env.EBAY_APP_ID;

app.use(cors());

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.post('/api/scan', upload.single('image'), async (req, res) => {
    try {
        console.log('Scan request received:', req.body);
        
        const { scanMethod } = req.body;
        const imageFile = req.file;

        if (!imageFile) {
            return res.status(400).json({ error: 'No image file provided.' });
        }

        let productName = '';
        let barcode = null;

        // Step 1: Try barcode detection if method is barcode
        if (scanMethod === 'barcode' || scanMethod === 'camera') {
            try {
                barcode = await mockBarcodeDetection(imageFile.path);
                if (barcode) {
                    console.log('Barcode detected:', barcode);
                    const upcResult = await lookupUPC(barcode);
                    if (upcResult) {
                        productName = upcResult.title;
                    }
                }
            } catch (error) {
                console.log('Barcode detection failed, trying image recognition');
            }
        }

        // Step 2: Fallback to Google Lens if no barcode or barcode lookup failed
        if (!productName) {
            console.log('Using Google Lens for product identification');
            
            if (IMGBB_API_KEY) {
                // Upload image to ImgBB for Google Lens
                const formData = new FormData();
                formData.append('image', fs.createReadStream(imageFile.path));

                const imgbbRes = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, formData, {
                    headers: formData.getHeaders(),
                });
                const imageUrl = imgbbRes.data.data.url;

                // Query Google Lens
                productName = await queryGoogleLens(imageUrl);
            } else {
                console.log('No IMGBB_API_KEY, using mock identification');
                productName = await mockGoogleLensIdentification();
            }
        }

        if (!productName) {
            productName = 'Unknown Product';
        }

        console.log('Product identified as:', productName);

        // Step 3: Get eBay market data
        const ebayData = await getEbayData(productName);
        
        // Step 4: Get parts data
        const partsData = await getPartsData(productName);

        // Step 5: Calculate Power Score
        const powerScore = calculatePowerScore(ebayData, partsData);

        // Step 6: Format response
        const result = {
            productName: productName,
            imageUrl: `data:image/jpeg;base64,${fs.readFileSync(imageFile.path).toString('base64')}`,
            barcode: barcode,
            scanMethod: barcode ? 'barcode' : 'image',
            powerScore: powerScore,
            soldListings: ebayData.soldListings,
            activeListings: ebayData.activeListings || 10,
            valuableParts: partsData,
            timestamp: new Date().toISOString()
        };

        // Clean up temporary file
        fs.unlinkSync(imageFile.path);

        console.log('Scan completed successfully');
        res.json(result);

    } catch (error) {
        console.error('API Error:', error);
        
        // Clean up temp file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            error: 'Failed to process scan',
            message: error.message 
        });
    }
});

// Helper Functions

async function mockBarcodeDetection(imagePath) {
    // Mock barcode detection - in production, use a library like @zxing/library
    // Return null if no barcode detected, or actual barcode string
    return new Promise(resolve => {
        setTimeout(() => {
            // 30% chance of detecting a mock barcode
            resolve(Math.random() < 0.3 ? '123456789012' : null);
        }, 500);
    });
}

async function lookupUPC(barcode) {
    // Mock UPC lookup - in production, use upcitemdb.com API
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

async function queryGoogleLens(imageUrl) {
    try {
        const lensUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`;
        
        const response = await axios.get(lensUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        
        // Try multiple selectors to find product name
        let productName = $('h3[data-item-name]').first().text().trim() ||
                         $('[data-test-id="product-title"]').first().text().trim() ||
                         $('h1').first().text().trim() ||
                         '';

        return productName || null;
        
    } catch (error) {
        console.error('Google Lens query failed:', error);
        return null;
    }
}

async function mockGoogleLensIdentification() {
    const products = [
        'Vintage Nintendo Game Boy',
        'Panasonic PV-V4022 VCR', 
        'Canon AE-1 Camera',
        'Sony Walkman WM-10',
        'Apple iPod Classic'
    ];
    
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(products[Math.floor(Math.random() * products.length)]);
        }, 1500);
    });
}

async function getEbayData(productName) {
    // Mock eBay data - in production, use eBay Finding API
    return new Promise(resolve => {
        setTimeout(() => {
            const basePrice = 30 + Math.random() * 70; // $30-$100
            const numListings = 5 + Math.floor(Math.random() * 10); // 5-15 listings
            
            const soldListings = [];
            for (let i = 0; i < numListings; i++) {
                const variation = (Math.random() - 0.5) * 0.3; // ±15%
                const price = basePrice * (1 + variation);
                const conditions = ['New', 'Used', 'Used', 'Used', 'For parts or not working'];
                
                soldListings.push({
                    price: Math.round(price * 100) / 100,
                    condition: conditions[Math.floor(Math.random() * conditions.length)]
                });
            }
            
            resolve({
                soldListings: soldListings,
                activeListings: Math.floor(Math.random() * 15) + 5,
                avgPrice: soldListings.reduce((sum, item) => sum + item.price, 0) / soldListings.length
            });
        }, 1200);
    });
}

async function getPartsData(productName) {
    // Mock valuable parts detection
    const partsMap = {
        'nintendo': [
            { name: 'Original Box', avgPrice: 45, sellThrough: 75 },
            { name: 'Manual', avgPrice: 20, sellThrough: 95 }
        ],
        'vcr': [
            { name: 'Original Remote', avgPrice: 28, sellThrough: 95 }
        ],
        'camera': [
            { name: 'Original Lens Cap', avgPrice: 15, sellThrough: 80 },
            { name: 'Battery Pack', avgPrice: 25, sellThrough: 85 }
        ]
    };
    
    return new Promise(resolve => {
        const productLower = productName.toLowerCase();
        let parts = [];
        
        for (const [key, value] of Object.entries(partsMap)) {
            if (productLower.includes(key)) {
                parts = value;
                break;
            }
        }
        
        // Add some randomization
        if (parts.length === 0 && Math.random() < 0.3) {
            parts = [{ name: 'Original Packaging', avgPrice: 20, sellThrough: 70 }];
        }
        
        setTimeout(() => resolve(parts), 800);
    });
}

function calculatePowerScore(ebayData, partsData) {
    const avgPrice = ebayData.avgPrice || 40;
    const soldListings = ebayData.soldListings.length;
    const activeListings = ebayData.activeListings || 10;
    const sellThroughRate = soldListings / (soldListings + activeListings) * 100;
    
    let score = 0;
    
    // Price component
    if (avgPrice > 100) score += 40;
    else if (avgPrice > 50) score += 30;
    else if (avgPrice > 25) score += 20;
    else score += 10;
    
    // Demand component
    if (sellThroughRate > 80) score += 40;
    else if (sellThroughRate > 60) score += 30;
    else if (sellThroughRate > 40) score += 20;
    else score += 10;
    
    // Parts bonus
    if (partsData.length > 0) score += 20;
    
    return Math.min(Math.round(score), 100);
}

// For local development
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Google Lens API server running on port ${PORT}`);
        console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
}

// Export for Vercel
module.exports = app;