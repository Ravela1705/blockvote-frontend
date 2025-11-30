import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // 1. Allow only GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 2. Safely Check Environment Variables (Inside handler to prevent crash-on-load)
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl) {
            console.error("CRITICAL: Missing NEXT_PUBLIC_SUPABASE_URL in Vercel env variables.");
            return res.status(500).json({ error: "Server Configuration Error: Missing Supabase URL." });
        }
        if (!supabaseServiceKey) {
            console.error("CRITICAL: Missing SUPABASE_SERVICE_ROLE_KEY in Vercel env variables.");
            return res.status(500).json({ error: "Server Configuration Error: Missing Supabase Service Role Key." });
        }

        // 3. Initialize Supabase Admin Client
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        // 4. Verify User Authentication (JWT)
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Authentication required. Missing header.' });
        }
        
        const token = authHeader.split('Bearer ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Authentication required. Missing token.' });
        }

        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

        if (userError || !user) {
            console.error("Token verification failed:", userError?.message);
            return res.status(401).json({ error: 'Invalid or expired token.' });
        }

        const userId = user.id;

        // 5. Fetch User Profile & Voting History from DB
        // We assume 'votes_cast' is a JSONB column and others are text/int
        const { data: voterData, error: dbError } = await supabaseAdmin
            .from('voters')
            .select('votes_cast, roll_number, academic_year, section, branch')
            .eq('id', userId)
            .single();

        if (dbError) {
            // Handle case where user exists in Auth but not in 'voters' table yet
            if (dbError.code === 'PGRST116') {
                console.warn(`User ${userId} not found in 'voters' table.`);
                return res.status(404).json({ error: 'Voter profile not found. Please register properly.' });
            }
            // Handle other DB errors
            console.error("Database error in getVoteDetails:", dbError);
            throw new Error(dbError.message);
        }

        // 6. Return Data
        return res.status(200).json({
            votes_cast: voterData?.votes_cast || {},
            profile: {
                rollNumber: voterData?.roll_number || 'N/A',
                year: voterData?.academic_year || 'N/A',
                section: voterData?.section || 'N/A',
                branch: voterData?.branch || 'N/A'
            }
        });

    } catch (error) {
        console.error('Unhandled error in getVoteDetails API:', error);
        return res.status(500).json({ 
            error: error.message || 'Internal Server Error' 
        });
    }
}