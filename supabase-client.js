// supabase-client.js - Database connection
import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js@2';

// Replace these with YOUR codes from Supabase
const SUPABASE_URL = 'https://ojloefpjdodetbdmhgab.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qbG9lZnBqZG9kZXRiZG1oZ2FiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5OTM2MjEsImV4cCI6MjA3MTU2OTYyMX0.hoQWOAOqjUUvroSLIcU594E8dgAwNux5aGHc5aikU2o';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Simple database functions
export class Scan2FlipDB {
    
    static async createUserProfile(userId, email) {
        const { data, error } = await supabase
            .from('user_profiles')
            .insert([{
                id: userId,
                email: email,
                subscription_tier: 'free'
            }])
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
    
    static async addToInventory(userId, item) {
        const { data, error } = await supabase
            .from('inventory')
            .insert([{
                user_id: userId,
                name: item.name,
                image_url: item.image,
                source: item.source || 'Scanned Item',
                purchase_date: item.purchaseDate || new Date().toISOString().split('T')[0],
                purchase_cost: item.cost,
                notes: item.notes || '',
                status: item.status || 'Unlisted'
            }])
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
}