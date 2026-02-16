
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://lijqtcwaqejjymrpxtcx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpanF0Y3dhcWVqanltcnB4dGN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODEyODUsImV4cCI6MjA4NjU1NzI4NX0.nJAFKRh5xtrovXNo6rVoDJ0l2wRe10PfAe5LYee3jkE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkColumns() {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching orders:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns in orders table:', Object.keys(data[0]));
    } else {
        console.log('No orders found to check columns.');
        // If no data, try inserting a dummy row then delete it? No, risky.
        // Or check via rpc if possible? No.
        // I'll assume if no orders, I might just add the columns blindly if SQL lets me.
    }
}

checkColumns();
