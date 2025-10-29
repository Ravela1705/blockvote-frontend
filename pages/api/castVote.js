// NO firebase-admin import here!
import { createClient } from '@supabase/supabase-js' // Supabase for DB and Auth check
import { ethers } from 'ethers'; // Using Ethers v5

// --- Supabase Admin Client ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseServiceKey) {
    console.error("CRITICAL ERROR: Supabase URL or Service Role Key missing in API route (castVote).")
    throw new Error("Server configuration error: Supabase credentials missing.")
}
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
// --- End Supabase ---


// --- Blockchain Config ---
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
let CONTRACT_ABI;
try {
    const abiString = process.env.NEXT_PUBLIC_CONTRACT_ABI;
    console.log("Raw NEXT_PUBLIC_CONTRACT_ABI string:", abiString?.substring(0, 100), "...");
    if (!abiString) throw new Error("NEXT_PUBLIC_CONTRACT_ABI environment variable is not set or empty.");
    CONTRACT_ABI = JSON.parse(abiString);
    console.log("Successfully parsed CONTRACT_ABI.");
} catch (e) {
    console.error("Error parsing CONTRACT_ABI:", e.message);
    console.error("Problematic ABI string (first 100 chars):", process.env.NEXT_PUBLIC_CONTRACT_ABI?.substring(0, 100));
    throw new Error("Could not parse contract ABI. Check Vercel environment variable format.");
}
let provider, wallet, contract;
try {
    provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    console.log("Connected to blockchain and contract in castVote.");
} catch(e){
    console.error("Error connecting to blockchain in castVote:", e);
    throw new Error("Could not connect to blockchain.");
}
// --- End Blockchain Config ---


// --- API Handler ---
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  let userId = null; // Define userId outside try block for logging scope
  try {
    // --- Verify Supabase JWT Token ---
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) { return res.status(401).json({ error: 'Authentication required.' }); }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError) { console.error("Supabase token verification error:", userError); return res.status(401).json({ error: `Authentication failed: ${userError.message}` }); }
    if (!user) { return res.status(401).json({ error: 'Authentication failed: Invalid token or user not found.' }); }
    userId = user.id;
    console.log("Verified Supabase user:", userId, user.email);
    // --- End Verification ---


    // 3. Get vote data
    const { electionId, candidateId } = req.body;
    if (electionId === undefined || candidateId === undefined) return res.status(400).json({ error: 'electionId and candidateId are required.' });
    console.log(`Received vote for Election ${electionId}, Candidate ${candidateId} from User ${userId}`);

    // 4. Check Supabase DB
    const { data: voterData, error: dbError } = await supabaseAdmin
        .from('voters')
        .select('has_voted_election_1')
        .eq('id', userId)
        .single();

    if (dbError && dbError.code !== 'PGRST116') { // Ignore row not found error here, handle below
        console.error("Supabase DB select error:", dbError);
        return res.status(500).json({ error: 'Database error checking voter status.' });
    }
    if (!voterData) { // If row not found
        console.error("Voter document not found:", userId);
        return res.status(404).json({ error: 'Voter registration record not found in database.' });
    }
    if (voterData.has_voted_election_1 === true) {
      console.warn("User has already voted:", userId);
      return res.status(400).json({ error: 'You have already voted.' });
    }
    console.log("User is eligible to vote.");

    // 5. Send vote to Blockchain
    const gasOverrides = { maxPriorityFeePerGas: ethers.utils.parseUnits('30', 'gwei'), maxFeePerGas: ethers.utils.parseUnits('100', 'gwei') };
    console.log(`Submitting vote to contract ${CONTRACT_ADDRESS} with gas overrides...`);
    const tx = await contract.recordVote(electionId, candidateId, gasOverrides);
    console.log("Transaction sent, waiting for confirmation...");
    await tx.wait();
    console.log(`Vote successful! Hash: ${tx.hash}`);

    // 6. Update Supabase DB
    const { error: updateError } = await supabaseAdmin
        .from('voters')
        .update({ has_voted_election_1: true, vote_hash_election_1: tx.hash })
        .eq('id', userId);

     if (updateError) { console.error("CRITICAL: Failed to update voter status in Supabase after successful vote:", updateError); }
     else { console.log("Supabase 'voters' table updated for user:", userId); }

    // 7. Send success
    res.status(200).json({ success: true, transactionHash: tx.hash });

  } catch (error) { // Catch errors from blockchain or token verification
    console.error('Error in castVote API execution:', error);
    let errorMessage = 'An unknown server error occurred during voting.';
    let statusCode = 500;
     if (error instanceof Error && error.code) { /* ... keep blockchain error handling ... */
         switch(error.code) { case ethers.errors.CALL_EXCEPTION: case 'CALL_EXCEPTION': errorMessage = "Vote failed on-chain."; console.error("Blockchain CALL_EXCEPTION:", error.reason); break; case 'UNPREDICTABLE_GAS_LIMIT': errorMessage = "Cannot estimate gas."; console.error("Blockchain UNPREDICTABLE_GAS_LIMIT:", error); break; case 'NETWORK_ERROR': errorMessage = "Network error communicating with blockchain."; console.error("Blockchain NETWORK_ERROR:", error); break; default: errorMessage = `Server error (${error.code}). Please try again.`; }
     } else if (error instanceof Error) { errorMessage = error.message; }
     console.error(`Error context - User ID: ${userId || 'N/A'}`);
    res.status(statusCode).json({ error: errorMessage, code: error?.code });
  }
}