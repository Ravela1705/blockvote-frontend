import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseServiceKey) throw new Error("Config missing.")
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Auth required.' });
    
    const { data: { user }, error: uErr } = await supabaseAdmin.auth.getUser(token);
    if (uErr || !user) return res.status(401).json({ error: 'Invalid token.' });

    // Fetch Profile Info + Voting History
    const { data: voterData, error: dbError } = await supabaseAdmin
        .from('voters')
        .select('votes_cast, roll_number, academic_year, section') // Added fields
        .eq('id', user.id)
        .single();

    if (dbError && dbError.code !== 'PGRST116') throw new Error(dbError.message);

    res.status(200).json({
      votes_cast: voterData?.votes_cast || {},
      // Return profile data so frontend can show "Welcome, AP22..."
      profile: {
          rollNumber: voterData?.roll_number,
          year: voterData?.academic_year,
          section: voterData?.section
      }
    });

  } catch (error) {
    console.error('Error in getVoteDetails:', error);
    res.status(500).json({ error: error.message });
  }
}