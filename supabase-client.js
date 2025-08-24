// supabase-client.js - Database connection with Market Intelligence
import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js@2';

// Your Supabase credentials
const SUPABASE_URL = 'https://ojloefpjdodetbdmhgab.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qbG9lZnBqZG9kZXRiZG1oZ2FiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5OTM2MjEsImV4cCI6MjA3MTU2OTYyMX0.hoQWOAOqjUUvroSLIcU594E8dgAwNux5aGHc5aikU2o';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Enhanced database functions with Market Intelligence
export class Scan2FlipDB {
    
    // User Profile Operations
    static async createUserProfile(userId, email, settings = {}) {
        const profile = {
            id: userId,
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

    // This is the function that was missing!
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
    
    // Market Intelligence - Detailed Scan Logging
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
            user_action: scanData.user_action || 'scanned_only', // 'kept', 'passed', 'scanned_only'
            user_tier: userTier,
            scan_method: scanData.scan_method || 'photo',
            source_store: scanData.source_store || 'Unknown',
            day_of_week: now.getDay() + 1, // 1-7, Sunday = 1
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
    
    // Helper function to detect seasonal items
    static detectSeasonalItem(category, name) {
        const seasonalKeywords = [
            'halloween', 'christmas', 'valentine', 'easter', 'thanksgiving',
            'costume', 'decoration', 'ornament', 'lights', 'pumpkin',
            'santa', 'elf', 'reindeer', 'snowman', 'tree', 'wreath',
            'candy', 'chocolate', 'gift', 'present', 'holiday'
        ];
        
        const searchText = `${category} ${name}`.toLowerCase();
        return seasonalKeywords.some(keyword => searchText.includes(keyword));
    }
    
    // Helper function to get seasonal category
    static getSeasonalCategory(category, name) {
        const searchText = `${category} ${name}`.toLowerCase();
        
        if (searchText.includes('halloween') || searchText.includes('costume') || searchText.includes('pumpkin')) {
            return 'Halloween';
        }
        if (searchText.includes('christmas') || searchText.includes('santa') || searchText.includes('ornament')) {
            return 'Christmas';
        }
        if (searchText.includes('valentine')) {
            return 'Valentine';
        }
        if (searchText.includes('easter')) {
            return 'Easter';
        }
        if (searchText.includes('thanksgiving')) {
            return 'Thanksgiving';
        }
        
        return null;
    }
    
    // Regular Inventory Operations (unchanged)
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
    
    // Market Intelligence Analytics
    static async getTrendingItems(limit = 10) {
        const { data, error } = await supabase
            .from('market_trends')
            .select('*')
            .in('trend_status', ['accelerating', 'emerging'])
            .order('scan_velocity_24h', { ascending: false })
            .limit(limit);
            
        if (error) throw error;
        return data || [];
    }
    
    static async getGoldRushAlerts() {
        const { data, error } = await supabase
            .rpc('detect_gold_rush');
            
        if (error) throw error;
        return data || [];
    }
    
    static async getRegionalTrends(region) {
        const { data, error } = await supabase
            .from('detailed_scans')
            .select('item, market_data, created_at')
            .eq('location->city', region)
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        return data || [];
    }
    
    static async getSeasonalTrends() {
        const { data, error } = await supabase
            .from('seasonal_patterns')
            .select('*')
            .order('trigger_date', { ascending: true });
            
        if (error) throw error;
        return data || [];
    }
    
    // Power Alerts for Power Pro Users
    static async createPowerAlert(alertData) {
        const { data, error } = await supabase
            .from('power_alerts')
            .insert([alertData])
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async getPowerAlerts(userTier, region = null) {
        let query = supabase
            .from('power_alerts')
            .select('*')
            .eq('status', 'sent')
            .contains('target_tier', [userTier])
            .gte('expires_at', new Date().toISOString());
            
        if (region) {
            query = query.or(`target_regions.is.empty,target_regions.cs.{${region}}`);
        }
        
        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(10);
            
        if (error) throw error;
        return data || [];
    }
    
    // Admin Dashboard Functions
    static async getAdminDashboardStats() {
        const { data, error } = await supabase
            .from('admin_dashboard_stats')
            .select('*')
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async getDetailedScansForAdmin(limit = 100, offset = 0) {
        const { data, error } = await supabase
            .from('detailed_scans')
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
            
        if (error) throw error;
        return data || [];
    }
    
    static async getMarketTrendsForAdmin() {
        const { data, error } = await supabase
            .from('market_trends')
            .select('*')
            .order('scan_velocity_24h', { ascending: false })
            .limit(50);
            
        if (error) throw error;
        return data || [];
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
}

// Enhanced Data Migration with Market Intelligence
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
                
                // Archive old localStorage data
                localStorage.setItem('scan2flip-inventory-backup', localStorage.getItem('scan2flip-inventory'));
                localStorage.removeItem('scan2flip-inventory');
                console.log('Inventory migration completed');
            }
            
            // Migrate expenses (if any)
            const localExpenses = JSON.parse(localStorage.getItem('scan2flip-expenses') || '[]');
            if (localExpenses.length > 0) {
                console.log(`Migrating ${localExpenses.length} expenses...`);
                
                for (const expense of localExpenses) {
                    try {
                        await Scan2FlipDB.addExpense(userId, expense);
                    } catch (error) {
                        console.error('Error migrating expense:', error);
                    }
                }
                
                localStorage.setItem('scan2flip-expenses-backup', localStorage.getItem('scan2flip-expenses'));
                localStorage.removeItem('scan2flip-expenses');
                console.log('Expenses migration completed');
            }
            
            // Migrate mileage (if any)
            const localMileage = JSON.parse(localStorage.getItem('scan2flip-mileage') || '[]');
            if (localMileage.length > 0) {
                console.log(`Migrating ${localMileage.length} mileage entries...`);
                
                for (const mileage of localMileage) {
                    try {
                        await Scan2FlipDB.addMileage(userId, mileage);
                    } catch (error) {
                        console.error('Error migrating mileage:', error);
                    }
                }
                
                localStorage.setItem('scan2flip-mileage-backup', localStorage.getItem('scan2flip-mileage'));
                localStorage.removeItem('scan2flip-mileage');
                console.log('Mileage migration completed');
            }
            
            return { success: true, message: 'Migration completed successfully' };
            
        } catch (error) {
            console.error('Migration error:', error);
            return { success: false, error: error.message };
        }
    }
}

// Real-time subscription helpers
export class RealtimeManager {
    
    static subscribeToInventoryChanges(userId, callback) {
        return supabase
            .channel('inventory-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'inventory',
                    filter: `user_id=eq.${userId}`
                },
                callback
            )
            .subscribe();
    }
    
    static subscribeToMarketTrends(callback) {
        return supabase
            .channel('market-trends')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'market_trends'
                },
                callback
            )
            .subscribe();
    }
    
    static subscribeToPowerAlerts(callback) {
        return supabase
            .channel('power-alerts')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'power_alerts'
                },
                callback
            )
            .subscribe();
    }
    
    static unsubscribe(subscription) {
        supabase.removeChannel(subscription);
    }
}