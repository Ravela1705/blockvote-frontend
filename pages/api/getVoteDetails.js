import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: "Config missing." });

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) return res.status(401).json({ error: 'Token missing.' });

        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) return res.status(401).json({ error: 'Invalid token.' });

        // --- FETCH PROFILE with NAME & EMAIL ---
        const { data: voterData, error: dbError } = await supabaseAdmin
            .from('voters')
            .select('votes_cast, roll_number, academic_year, section, branch, full_name, email') // Added full_name, email
            .eq('id', user.id)
            .single();

        if (dbError) {
            if (dbError.code === 'PGRST116') return res.status(404).json({ error: 'Profile not found.' });
            throw dbError;
        }

        return res.status(200).json({
            votes_cast: voterData?.votes_cast || {},
            profile: {
                name: voterData?.full_name || 'Student', // Send Name
                email: voterData?.email || user.email,   // Send Email
                rollNumber: voterData?.roll_number,
                year: voterData?.academic_year,
                section: voterData?.section,
                branch: voterData?.branch
            }
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}