// api/scan.js - Complete version with Decodo Google Lens
import formidable from 'formidable';
import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';

export const config = {
    api: {
        bodyParser: false,
    },
};

const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
const EBAY_APP_ID = process.env.EBAY_APP_ID;
const DECODO_USERNAME = process.env.DECODO_USERNAME;
const DECODO_PASSWORD = process.env.DECODO_PASSWORD;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const form = formidable({
            uploadDir: '/tmp',
            keepExtensions: true,
            maxFileSize: 10 * 1024 * 1024,
        });

        const { fields, files } = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) reject(err);
                else resolve({ fields, files });
            });
        });

        const imageFile = files.image?.[0] || files.image;
        if (!imageFile) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        // Step 1: Upload to ImgBB
        let imageUrl = '';
        if (IMGBB_API_KEY) {
            const imgbbFormData = new FormData();
            imgbbFormData.append('image', fs.createReadStream(imageFile.filepath));

            const imgbbResponse = await axios.post(
                `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
                imgbbFormData,
                { headers: imgbbFormData.getHeaders(), timeout: 30000 }
            );
            
            imageUrl = imgbbResponse.data.data.url;
            console.log('Image uploaded to ImgBB:', imageUrl);
        }

        // Step 2: Use Decodo Google Lens to identify product
        let productName = 'Unknown Product';
        
        if (DECODO_USERNAME && DECODO_PASSWORD && imageUrl) {
            try {
                const auth = Buffer.from(`${DECODO_USERNAME}:${DECODO_PASSWORD}`).toString('base64');
                
                console.log('Calling Decodo with image URL:', imageUrl);
                
                const decodoResponse = await axios.post(
                    'https://scraper-api.decodo.com/v2/scrape',
                    {
                        target: 'google_lens',
                        query: imageUrl,
                        headless: 'html',
                        parse: true
                    },
                    {
                        headers: {
                            'Authorization': `Basic ${auth}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 30000
                    }
                );

                console.log('Decodo status:', decodoResponse.status);
                console.log('Decodo response structure:', JSON.stringify(decodoResponse.data, null, 2));
                
                const organicResults = decodoResponse.data?.results?.[0]?.content?.results?.results?.organic;

                if (organicResults && organicResults.length > 0) {
                    const firstResult = organicResults[0];
                    
                    // **FINALIZED BLOCK STARTS HERE**
                    // This simpler, safer cleaning logic is recommended.
                    let cleanedName = firstResult.title || 'Unknown Product';
                    
                    // Only remove the most problematic patterns
                    cleanedName = cleanedName.split('|')[0];      // Remove after pipe
                    cleanedName = cleanedName.split(' - ')[0];    // Remove after dash with spaces
                    cleanedName = cleanedName.replace(/\s+at\s+.*$/i, ''); // Remove "at [Store]"
                    cleanedName = cleanedName.replace(/^(Buy|Shop)\s+/i, ''); // Remove leading Buy/Shop
                    
                    productName = cleanedName.trim();
                    // **FINALIZED BLOCK ENDS HERE**
                    
                    console.log('Extracted product name:', productName);
                } else {
                    console.log('No organic results found in the expected path of the Decodo response');
                    productName = "Unknown Product"; 
                }
                
            } catch (error) {
                console.error('Decodo API error:', error.response?.status, error.response?.data || error.message);
                productName = "Unknown Product"; 
            }
        }

        // Step 3: Get eBay data
        const ebayData = await getEbayData(productName, EBAY_APP_ID);

        // Step 4: Calculate Power Score
        const partsData = detectValuableParts(productName);
        const powerScore = calculatePowerScore(ebayData, partsData);

        // Step 5: Return results
        const imageBase64 = fs.readFileSync(imageFile.filepath, { encoding: 'base64' });
        
        const result = {
            scanId: `scan_${Date.now()}`,
            productName: productName,
            imageUrl: `data:${imageFile.mimetype || 'image/jpeg'};base64,${imageBase64}`,
            powerScore: powerScore,
            soldListings: ebayData.soldListings || [],
            activeListings: ebayData.activeListings || 10,
            valuableParts: partsData || [],
            timestamp: new Date().toISOString()
        };

        fs.unlinkSync(imageFile.filepath);
        res.status(200).json(result);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
}

// Get eBay data
async function getEbayData(productName, appId) {
    if (!appId || productName.toLowerCase().startsWith('unknown product')) {
        return getMockData(productName);
    }
    
    try {
        const url = 'https://svcs.ebay.com/services/search/FindingService/v1';
        
        const params = {
            'OPERATION-NAME': 'findCompletedItems',
            'SERVICE-VERSION': '1.0.0',
            'SECURITY-APPNAME': appId,
            'RESPONSE-DATA-FORMAT': 'JSON',
            'REST-PAYLOAD': 'true',
            'keywords': productName,
            'paginationInput.entriesPerPage': '20',
            'itemFilter(0).name': 'SoldItemsOnly',
            'itemFilter(0).value': 'true'
        };
        
        const response = await axios.get(url, {
            params: params,
            timeout: 8000
        });

        const data = response.data;
        if (data.findCompletedItemsResponse && data.findCompletedItemsResponse[0]) {
            const searchResult = data.findCompletedItemsResponse[0].searchResult?.[0];
            const items = searchResult?.item || [];
            
            const soldListings = items.map(item => {
                const price = parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || 0);
                const condition = item.condition?.[0]?.conditionDisplayName?.[0] || 'Used';
                
                return {
                    price: price,
                    condition: mapCondition(condition)
                };
            }).filter(item => item.price > 0);

            const avgPrice = soldListings.length > 0 
                ? soldListings.reduce((sum, item) => sum + item.price, 0) / soldListings.length 
                : 0;

            return {
                soldListings: soldListings,
                activeListings: 15,
                avgPrice: avgPrice,
                totalSold: soldListings.length
            };
        }
        
        throw new Error('No data in eBay response');
        
    } catch (error) {
        console.error('eBay API failed:', error.message);
        return getMockData(productName);
    }
}

// Mock data fallback
function getMockData(productName) {
    const basePrice = 30 + Math.random() * 70;
    const numListings = 5 + Math.floor(Math.random() * 10);
    
    const soldListings = [];
    for (let i = 0; i < numListings; i++) {
        const variation = (Math.random() - 0.5) * 0.4;
        const price = Math.max(10, basePrice * (1 + variation));
        
        soldListings.push({
            price: Math.round(price * 100) / 100,
            condition: ['Used', 'Used', 'New', 'For parts or not working'][Math.floor(Math.random() * 4)]
        });
    }
    
    return {
        soldListings: soldListings,
        activeListings: Math.floor(Math.random() * 20) + 5,
        avgPrice: soldListings.reduce((sum, item) => sum + item.price, 0) / soldListings.length,
        totalSold: soldListings.length
    };
}

// Map conditions
function mapCondition(ebayCondition) {
    const conditionMap = {
        'New': 'New',
        'New with tags': 'New',
        'New without tags': 'New',
        'Like New': 'Used',
        'Used': 'Used',
        'Very Good': 'Used',
        'Good': 'Used',
        'Acceptable': 'Used',
        'For parts or not working': 'For parts or not working'
    };
    
    return conditionMap[ebayCondition] || 'Used';
}

// Detect valuable parts
function detectValuableParts(productName) {
    const productLower = productName.toLowerCase();
    
    if (productLower.includes('playstation') || productLower.includes('xbox')) {
        return [
            { name: 'Original Controller', avgPrice: 35, sellThrough: 85 },
            { name: 'Power Cable', avgPrice: 15, sellThrough: 90 }
        ];
    }
    
    if (productLower.includes('nintendo') || productLower.includes('game boy')) {
        return [
            { name: 'Original Box', avgPrice: 45, sellThrough: 75 },
            { name: 'Manual/Instructions', avgPrice: 20, sellThrough: 95 }
        ];
    }
    
    if (productLower.includes('onitsuka') || productLower.includes('tiger')) {
        return [
            { name: 'Original Box', avgPrice: 15, sellThrough: 80 },
            { name: 'Extra Laces', avgPrice: 8, sellThrough: 70 }
        ];
    }
    
    return [];
}

// Calculate Power Score
function calculatePowerScore(ebayData, partsData) {
    const avgPrice = ebayData.avgPrice || 0;
    const soldListings = ebayData.totalSold || 0;
    const activeListings = ebayData.activeListings || 10;
    const sellThroughRate = soldListings > 0 
        ? (soldListings / (soldListings + activeListings)) * 100 
        : 0;
    
    let score = 0;
    
    if (avgPrice > 100) score += 40;
    else if (avgPrice > 60) score += 35;
    else if (avgPrice > 30) score += 25;
    else if (avgPrice > 15) score += 15;
    else score += 8;
    
    if (sellThroughRate > 80) score += 40;
    else if (sellThroughRate > 60) score += 32;
    else if (sellThroughRate > 40) score += 24;
    else if (sellThroughRate > 20) score += 16;
    else score += 8;
    
    if (soldListings > 50) score += 10;
    else if (soldListings > 25) score += 8;
    else if (soldListings > 10) score += 6;
    else if (soldListings > 5) score += 4;
    else score += 2;
    
    if (partsData && partsData.length > 0) {
        const avgPartPrice = partsData.reduce((sum, part) => sum + part.avgPrice, 0) / partsData.length;
        if (avgPartPrice > 30) score += 10;
        else if (avgPartPrice > 20) score += 8;
        else if (avgPartPrice > 10) score += 6;
        else score += 4;
    }
    
    return Math.min(Math.round(score), 100);
}