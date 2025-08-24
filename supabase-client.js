// supabase-client.js - Clean version for new project
import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js@2';

// Your NEW Supabase credentials
const SUPABASE_URL = 'https://ebzhjsgkyqzrviyqwvhg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViemhqc2dreXF6cnZpeXF3dmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwMDkwOTYsImV4cCI6MjA3MTU4NTA5Nn0.ZPVbWV2hfNMukSrFFXiKpgqkV6JkYY9cLfuo2f0lL_4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Database functions with TEXT IDs (Firebase compatible)
export class Scan2FlipDB {
    
    // User Profile Operations
    static async createUserProfile(userId, email, settings = {}) {
        const profile = {
            id: userId, // Firebase UID as TEXT
            email,
            subscription_tier: 'free',
            home_currency: 'USD',
            home_market: 'US',
            display_currency: 'USD',
            min_profit_margin: 0.50,
            ...settings
        };
        
        const { data, error } = await supabase
            .from('user_profiles')
            .insert([profile])
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async getUserProfile(userId) {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async updateUserProfile(userId, updates) {
        const { data, error } = await supabase
            .from('user_profiles')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }

    // EULA acceptance (this was missing before!)
    static async acceptEula(userId, version) {
        const { data, error } = await supabase
            .from('user_profiles')
            .update({
                eula_accepted: true,
                eula_version: version,
                eula_accepted_date: new Date().toISOString(),
                data_sharing_consent: true,
                market_intelligence_enabled: true
            })
            .eq('id', userId)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    // Inventory Operations
    static async addToInventory(userId, item) {
        const inventoryItem = {
            user_id: userId,
            name: item.name,
            image_url: item.image,
            source: item.source || 'Scanned Item',
            purchase_date: item.purchaseDate || new Date().toISOString().split('T')[0],
            purchase_cost: item.cost,
            notes: item.notes || '',
            status: item.status || 'Unlisted'
        };
        
        const { data, error } = await supabase
            .from('inventory')
            .insert([inventoryItem])
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async getUserInventory(userId) {
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        return data || [];
    }
    
    static async updateInventoryItem(itemId, updates) {
        const { data, error } = await supabase
            .from('inventory')
            .update(updates)
            .eq('id', itemId)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async deleteInventoryItem(itemId) {
        const { data, error } = await supabase
            .from('inventory')
            .delete()
            .eq('id', itemId);
            
        if (error) throw error;
        return data;
    }
    
    // Expense Operations
    static async addExpense(userId, expenseData) {
        const expense = {
            user_id: userId,
            ...expenseData
        };
        
        const { data, error } = await supabase
            .from('expenses')
            .insert([expense])
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async getUserExpenses(userId, startDate = null, endDate = null) {
        let query = supabase
            .from('expenses')
            .select('*')
            .eq('user_id', userId)
            .order('expense_date', { ascending: false });
            
        if (startDate) query = query.gte('expense_date', startDate);
        if (endDate) query = query.lte('expense_date', endDate);
        
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }
    
    // Mileage Operations
    static async addMileage(userId, mileageData) {
        const mileage = {
            user_id: userId,
            ...mileageData
        };
        
        const { data, error } = await supabase
            .from('mileage')
            .insert([mileage])
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async getUserMileage(userId, startDate = null, endDate = null) {
        let query = supabase
            .from('mileage')
            .select('*')
            .eq('user_id', userId)
            .order('trip_date', { ascending: false });
            
        if (startDate) query = query.gte('trip_date', startDate);
        if (endDate) query = query.lte('trip_date', endDate);
        
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }
    
    // Analytics/Stats Operations
    static async getMonthlyProfit(userId, year = new Date().getFullYear(), month = new Date().getMonth()) {
        const startDate = new Date(year, month, 1).toISOString().split('T')[0];
        const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('inventory')
            .select('sold_price, purchase_cost, sold_fees')
            .eq('user_id', userId)
            .eq('status', 'Sold')
            .gte('sold_date', startDate)
            .lte('sold_date', endDate);
            
        if (error) throw error;
        
        return data.reduce((total, item) => {
            return total + (item.sold_price - item.purchase_cost - (item.sold_fees || 0));
        }, 0);
    }
    
    static async getWinRate(userId) {
        const { data, error } = await supabase
            .from('inventory')
            .select('status, sold_price, purchase_cost, sold_fees')
            .eq('user_id', userId)
            .in('status', ['Sold', 'Listed']);
            
        if (error) throw error;
        
        const soldItems = data.filter(item => item.status === 'Sold');
        const profitableSales = soldItems.filter(item => 
            (item.sold_price - item.purchase_cost - (item.sold_fees || 0)) > 0
        ).length;
        const totalPurchasedItems = data.length;
        
        return totalPurchasedItems > 0 ? (profitableSales / totalPurchasedItems) * 100 : 0;
    }

    // Market Intelligence - Log detailed scans
    static async logDetailedScan(userId, scanData, userTier) {
        const now = new Date();
        const detailedScan = {
            user_id: userId,
            location: {
                city: scanData.location?.city || 'Unknown',
                state: scanData.location?.state || 'Unknown',
                zip: scanData.location?.zip || '',
                store_type: scanData.source_store || 'Unknown'
            },
            item: {
                barcode: scanData.barcode || '',
                name: scanData.name || 'Unknown Item',
                category: scanData.category || 'Unknown',
                brand: scanData.brand || 'Unknown',
                image_url: scanData.image || '',
                condition: scanData.condition || 'Unknown'
            },
            market_data: {
                avg_sold_price: scanData.avgSalePrice || 0,
                sell_through_rate: scanData.sellThroughRate || 0,
                power_score: scanData.powerScore || 0,
                platform_prices: scanData.platformPrices || {},
                ebay_listings: scanData.soldListings?.length || 0
            },
            user_action: scanData.user_action || 'scanned_only',
            user_tier: userTier,
            scan_method: scanData.scan_method || 'photo',
            source_store: scanData.source_store || 'Unknown',
            day_of_week: now.getDay() + 1,
            hour_of_day: now.getHours(),
            is_seasonal_item: this.detectSeasonalItem(scanData.category, scanData.name),
            seasonal_category: this.getSeasonalCategory(scanData.category, scanData.name)
        };
        
        const { data, error } = await supabase
            .from('detailed_scans')
            .insert([detailedScan])
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    // Helper functions for seasonal detection
    static detectSeasonalItem(category, name) {
        const seasonalKeywords = [
            'halloween', 'christmas', 'valentine', 'easter', 'thanksgiving',
            'costume', 'decoration', 'ornament', 'lights', 'pumpkin',
            'santa', 'elf', 'reindeer', 'snowman', 'tree', 'wreath'
        ];
        
        const searchText = `${category} ${name}`.toLowerCase();
        return seasonalKeywords.some(keyword => searchText.includes(keyword));
    }
    
    static getSeasonalCategory(category, name) {
        const searchText = `${category} ${name}`.toLowerCase();
        
        if (searchText.includes('halloween') || searchText.includes('costume')) {
            return 'Halloween';
        }
        if (searchText.includes('christmas') || searchText.includes('santa')) {
            return 'Christmas';
        }
        if (searchText.includes('valentine')) return 'Valentine';
        if (searchText.includes('easter')) return 'Easter';
        if (searchText.includes('thanksgiving')) return 'Thanksgiving';
        
        return null;
    }
}

// Data migration helper
export class DataMigration {
    static async migrateLocalStorageToSupabase(userId) {
        try {
            // Migrate inventory
            const localInventory = JSON.parse(localStorage.getItem('scan2flip-inventory') || '[]');
            if (localInventory.length > 0) {
                console.log(`Migrating ${localInventory.length} inventory items...`);
                
                for (const item of localInventory) {
                    try {
                        const migratedItem = {
                            name: item.name,
                            image: item.image,
                            source: item.source,
                            purchaseDate: item.purchaseDate,
                            cost: item.cost,
                            notes: item.notes,
                            status: item.status
                        };
                        
                        await Scan2FlipDB.addToInventory(userId, migratedItem);
                    } catch (error) {
                        console.error('Error migrating inventory item:', error);
                    }
                }
                
                localStorage.setItem('scan2flip-inventory-backup', localStorage.getItem('scan2flip-inventory'));
                localStorage.removeItem('scan2flip-inventory');
                console.log('Inventory migration completed');
            }
            
            return { success: true, message: 'Migration completed successfully' };
            
        } catch (error) {
            console.error('Migration error:', error);
            return { success: false, error: error.message };
        }
    }
}