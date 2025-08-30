// api/scan.js - FINAL PRODUCTION VERSION
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
    if (req.method === 'OPTIONS') { return res.status(200).end(); }

    try {
        const form = formidable({ uploadDir: '/tmp', keepExtensions: true, maxFileSize: 10 * 1024 * 1024 });
        const { files } = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => err ? reject(err) : resolve({ files }));
        });
        const imageFile = files.image?.[0] || files.image;
        if (!imageFile) { return res.status(400).json({ error: 'No image file provided' }); }

        let imageUrl = '';
        if (IMGBB_API_KEY) {
            const imgbbFormData = new FormData();
            imgbbFormData.append('image', fs.createReadStream(imageFile.filepath));
            const imgbbResponse = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, imgbbFormData, { headers: imgbbFormData.getHeaders(), timeout: 30000 });
            imageUrl = imgbbResponse.data.data.url;
        }

        let productName = 'Unknown Product';
        if (DECODO_USERNAME && DECODO_PASSWORD && imageUrl) {
            try {
                const auth = Buffer.from(`${DECODO_USERNAME}:${DECODO_PASSWORD}`).toString('base64');
                const decodoResponse = await axios.post('https://scraper-api.decodo.com/v2/scrape', { target: 'google_lens', query: imageUrl, parse: true }, { headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }, timeout: 30000 });
                const organicResults = decodoResponse.data?.results?.[0]?.content?.results?.results?.organic;
                
                if (organicResults && organicResults.length > 0) {
                    let bestTitle = organicResults[0].title || 'Unknown Product';
                    // **FINAL, SIMPLIFIED CLEANING LOGIC**
                    productName = bestTitle.split('|')[0].trim();
                }
            } catch (error) { console.error('Decodo API error:', error.message); }
        }
        
        if (productName.toLowerCase().startsWith('unknown product')) {
            fs.unlinkSync(imageFile.filepath);
            return res.status(422).json({ error: 'Low confidence in automated result.' });
        }

        const ebayData = await getEbayData(productName, EBAY_APP_ID);
        const powerScore = calculatePowerScore(ebayData);
        const imageBase64 = fs.readFileSync(imageFile.filepath, { encoding: 'base64' });
        
        const result = {
            productName: productName,
            imageUrl: `data:${imageFile.mimetype || 'image/jpeg'};base64,${imageBase64}`,
            powerScore: powerScore,
            soldListings: ebayData.soldListings,
            sellThroughRate: ebayData.sellThroughRate,
            activeListings: ebayData.totalActive,
            timestamp: new Date().toISOString()
        };

        fs.unlinkSync(imageFile.filepath);
        res.status(200).json(result);

    } catch (error) {
        console.error('Handler Error:', error);
        res.status(500).json({ error: error.message });
    }
}

// **REDESIGNED EBAY DATA FUNCTION**
async function getEbayData(productName, appId) {
    if (!appId) return { soldListings: {}, sellThroughRate: 0, totalActive: 0 };

    try {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        // eBay Finding API requires UTC format, which toISOString() provides.
        const endTimeFrom = ninetyDaysAgo.toISOString();

        // 1. Get SOLD listings from the last 90 days
        const soldResponse = await axios.get('https://svcs.ebay.com/services/search/FindingService/v1', {
            params: {
                'OPERATION-NAME': 'findCompletedItems',
                'SERVICE-VERSION': '1.0.0',
                'SECURITY-APPNAME': appId,
                'RESPONSE-DATA-FORMAT': 'JSON',
                'keywords': productName,
                'itemFilter(0).name': 'SoldItemsOnly',
                'itemFilter(0).value': 'true',
                'itemFilter(1).name': 'EndTimeFrom',
                'itemFilter(1).value': endTimeFrom
            }
        });
        const soldItems = soldResponse.data.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];
        const totalSold = soldItems.length;

        // 2. Get ACTIVE listings
        const activeResponse = await axios.get('https://svcs.ebay.com/services/search/FindingService/v1', {
            params: {
                'OPERATION-NAME': 'findItemsAdvanced',
                'SERVICE-VERSION': '1.0.0',
                'SECURITY-APPNAME': appId,
                'RESPONSE-DATA-FORMAT': 'JSON',
                'keywords': productName
            }
        });
        const activeItems = activeResponse.data.findItemsAdvancedResponse?.[0]?.searchResult?.[0]?.item || [];
        const totalActive = activeItems.length;

        // 3. Categorize sold items by Condition ID
        const categorizedSold = { 'New': [], 'Used': [], 'For parts': [] };
        soldItems.forEach(item => {
            const conditionId = parseInt(item.condition?.[0]?.conditionId?.[0] || '3000');
            const price = parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || 0);
            if (price > 0) {
                if (conditionId <= 1500) { categorizedSold['New'].push(price); } 
                else if (conditionId === 7000) { categorizedSold['For parts'].push(price); } 
                else { categorizedSold['Used'].push(price); }
            }
        });

        // 4. Calculate averages for each condition
        const conditionAnalysis = {};
        for (const [condition, prices] of Object.entries(categorizedSold)) {
            if (prices.length > 0) {
                conditionAnalysis[condition] = {
                    avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
                    count: prices.length
                };
            }
        }

        // 5. Calculate true Sell-Through Rate
        const sellThroughRate = (totalSold + totalActive > 0) ? (totalSold / (totalSold + totalActive)) * 100 : 0;

        return {
            soldListings: conditionAnalysis,
            sellThroughRate: sellThroughRate,
            totalActive: totalActive,
            totalSold: totalSold
        };

    } catch (error) {
        console.error(`eBay API failed for "${productName}":`, error.message);
        return { soldListings: {}, sellThroughRate: 0, totalActive: 0, totalSold: 0 };
    }
}

// **UPDATED POWER SCORE CALCULATION**
function calculatePowerScore(ebayData) {
    const sellThroughRate = ebayData.sellThroughRate || 0;
    const soldData = ebayData.soldListings || {};
    
    const primaryCondition = soldData['Used'] || soldData['New'] || { avgPrice: 0, count: 0 };
    const avgPrice = primaryCondition.avgPrice;
    const totalSold = ebayData.totalSold || 0; // Use total sold for volume, not just one condition
    
    let score = 0;
    if (avgPrice > 100) score += 40; else if (avgPrice > 60) score += 35; else if (avgPrice > 30) score += 25; else if (avgPrice > 15) score += 15; else score += 8;
    if (sellThroughRate > 60) score += 40; else if (sellThroughRate > 40) score += 32; else if (sellThroughRate > 20) score += 24; else if (sellThroughRate > 10) score += 16; else score += 8;
    if (totalSold > 50) score += 20; else if (totalSold > 25) score += 16; else if (totalSold > 10) score += 12; else if (totalSold > 5) score += 8; else score += 4;
    
    // Bonus for a strong "For parts" market, indicating part-out potential
    if (soldData['For parts'] && soldData['For parts'].avgPrice > 20) {
        score += 10;
    }
    
    return Math.min(Math.round(score), 100);
}