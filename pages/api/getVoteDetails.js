import { createClient } from '@supabase/supabase-js'

// --- Supabase Admin Client ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("CRITICAL ERROR: Supabase credentials missing in getVoteDetails.")
    throw new Error("Server config error: Supabase credentials missing.")
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
// --- End Supabase ---

export default async function handler(req, res) {
  if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Verify Supabase JWT Token
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Authentication required.' });
    
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) { 
        console.error("Token verification error:", userError); 
        return res.status(401).json({ error: 'Invalid token' }); 
    }

    const userId = user.id;

    // 2. Get the user's voter registration document
    // --- UPDATED: Select 'votes_cast' AND profile details (roll_number, year, section, branch) ---
    const { data: voterData, error: dbError } = await supabaseAdmin
        .from('voters')
        .select('votes_cast, roll_number, academic_year, section, branch') 
        .eq('id', userId)
        .single();

    if (dbError) {
        // If the error code is PGRST116, it means no row was found (user not in voters table yet)
        if (dbError.code === 'PGRST116') {
            return res.status(404).json({ error: 'Voter profile not found. Please contact admin.' });
        }
        console.error("Supabase DB select error:", dbError);
        throw new Error(`Supabase DB error: ${dbError.message}`);
    }

    // 3. Send back their vote details + Profile Info
    res.status(200).json({
      votes_cast: voterData?.votes_cast || {},
      // --- NEW: Return Profile Data for the Dashboard ---
      profile: {
          rollNumber: voterData?.roll_number || 'N/A',
          year: voterData?.academic_year || 'N/A',
          section: voterData?.section || 'N/A',
          branch: voterData?.branch || 'N/A'
      }
    });

  } catch (error) {
    console.error('Error in getVoteDetails:', error);
    res.status(500).json({ error: error.message || 'An unknown server error occurred.' });
  }
}