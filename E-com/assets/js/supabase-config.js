// Supabase Configuration
const SUPABASE_URL = "https://lijqtcwaqejjymrpxtcx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpanF0Y3dhcWVqanltcnB4dGN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODEyODUsImV4cCI6MjA4NjU1NzI4NX0.nJAFKRh5xtrovXNo6rVoDJ0l2wRe10PfAe5LYee3jkE";

// Initialize the Supabase client safely
(function () {
    // The Supabase CDN v2 script defines a global 'supabase' object that contains 'createClient'.
    // We need to use that to create our client instance.

    // 1. Capture the library reference
    const lib = window.supabase;

    if (lib && typeof lib.createClient === 'function') {
        // lib is the Supabase library. Create the client instance.
        const client = lib.createClient(SUPABASE_URL, SUPABASE_KEY);

        // 2. Store the client instance in window.supabase
        // Note: This overwrites the library reference, which is usually fine if we only need one client.
        window.supabase = client;

        // 3. Optional: store it in a more specific name to avoid confusion
        window.supabaseClient = client;

        console.log("Supabase: Client initialized successfully and assigned to window.supabase");
    } else if (lib && typeof lib.from === 'function') {
        // window.supabase is already a client instance
        console.log("Supabase: Client instance already exists");
    } else {
        // Check if maybe it's under 'Supabase' (some older versions or specific setups)
        const altLib = window.Supabase;
        if (altLib && typeof altLib.createClient === 'function') {
            window.supabase = altLib.createClient(SUPABASE_URL, SUPABASE_KEY);
            window.supabaseClient = window.supabase;
            console.log("Supabase: Client initialized using global 'Supabase' object");
        } else {
            console.error("Supabase: Library not found. Please ensure the Supabase CDN script is loaded before this config.");
        }
    }
})();
