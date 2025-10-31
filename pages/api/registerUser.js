import { createClient } from '@supabase/supabase-js'

// Create Supabase client with the SERVICE_ROLE_KEY for admin actions
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("CRITICAL ERROR: Supabase URL or Service Role Key missing in API route.")
    throw new Error("Server configuration error: Supabase credentials missing.")
}

// Note: Creating a new client in each API route is standard for serverless
// Ensure SERVICE_ROLE_KEY is kept secret and only used on the server
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Get userId and email from the request body (sent by client after signup)
    const { userId, email } = req.body;

    if (!userId || !email) {
        return res.status(400).json({ error: 'User ID and email are required.' });
    }

    try {
        console.log("API: Adding user to Supabase 'voters' table:", userId, email);

        // Insert the user into the 'voters' table using the Admin client
        const { data, error } = await supabaseAdmin
            .from('voters')
            .insert([
                {
                    id: userId, // Use the user ID from Supabase Auth as the primary key
                    email: email,
                    votes_cast: {} // --- UPDATED: Initialize the new JSONB column as an empty object ---
                }
            ])
            .select(); // Optionally select to confirm insertion

        if (error) {
            // Handle potential errors, e.g., duplicate primary key (user already exists)
            console.error('Supabase DB insert error:', error);
            // Check for unique violation (Postgres code 23505)
            if (error.code === '23505') {
                 // This might happen if the API is called twice, which is okay.
                 console.warn(`User ${userId} already exists in voters table.`);
                 // Consider returning success even if they already exist
                 return res.status(200).json({ success: true, uid: userId, message: 'User already exists in DB.' });
            }
            throw new Error(`Supabase DB error: ${error.message}`);
        }

        console.log("User added to Supabase 'voters' table successfully:", data);

        // Send a success message back
        res.status(200).json({ success: true, uid: userId });

    } catch (error) {
        console.error('Error in registerUser API (DB write):', error);
        res.status(500).json({ error: error.message || 'Failed to complete registration on server.' });
    }
}