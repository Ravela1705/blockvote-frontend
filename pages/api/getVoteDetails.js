import { createClient } from '@supabase/supabase-js'

// --- Supabase Admin Client ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseServiceKey) throw new Error("Server config error: Supabase credentials missing.")
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
// --- End Supabase ---


export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    // --- Verify Supabase JWT Token ---
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Authentication required.' });

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
        console.error("Supabase token verification error:", userError);
        return res.status(401).json({ error: `Authentication failed: ${userError?.message || 'Invalid token'}` });
    }
    const userId = user.id;
    console.log("Verified Supabase user for getVoteDetails:", userId);
    // --- End Verification ---


    // 3. Get the user's voter registration document from Supabase DB
    const { data: voterData, error: dbError } = await supabaseAdmin
        .from('voters')
        .select('has_voted_election_1, vote_hash_election_1') // Select needed columns
        .eq('id', userId) // Find the row where 'id' matches user's ID
        .single(); // Expect only one row

    if (dbError && dbError.code !== 'PGRST116') { // Ignore 'PGRST116' (Row not found)
        console.error("Supabase DB select error:", dbError);
        throw new Error(`Supabase DB error: ${dbError.message}`);
    }

    // 4. Send back their vote details
    res.status(200).json({
      hasVoted: voterData?.has_voted_election_1 || false,
      hash: voterData?.vote_hash_election_1 || null
    });

  } catch (error) {
    console.error('Error in getVoteDetails:', error);
    res.status(500).json({ error: error.message || 'An unknown server error occurred.' });
  }
}