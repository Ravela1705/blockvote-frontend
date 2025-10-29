import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers'; // Using Ethers v5

// --- Supabase Admin Client (Same as before) ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseServiceKey) throw new Error("Server config error: Supabase credentials missing.")
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
// --- End Supabase ---


// --- Blockchain Config ---
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
let CONTRACT_ABI;
try {
    const abiBase64 = process.env.NEXT_PUBLIC_CONTRACT_ABI; // Get raw base64 string
    console.log("Raw NEXT_PUBLIC_CONTRACT_ABI (Base64):", abiBase64?.substring(0, 50), "..."); // Log start
    if (!abiBase64) throw new Error("NEXT_PUBLIC_CONTRACT_ABI environment variable is not set or empty.");

    // --- *** NEW: Decode Base64 *** ---
    const abiString = Buffer.from(abiBase64, 'base64').toString('utf-8');
    // --- *** END NEW *** ---

    console.log("Decoded ABI string:", abiString?.substring(0, 100), "..."); // Log decoded start
    CONTRACT_ABI = JSON.parse(abiString); // Parse the decoded string
    console.log("Successfully parsed decoded CONTRACT_ABI.");
} catch (e) {
    console.error("Error decoding/parsing CONTRACT_ABI:", e.message);
    console.error("Problematic Base64 ABI string (first 50 chars):", process.env.NEXT_PUBLIC_CONTRACT_ABI?.substring(0, 50));
    throw new Error("Could not decode/parse contract ABI. Check Vercel environment variable format (should be Base64).");
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


// --- API Handler (Rest is the same) ---
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  let userId = null;
  try {
    // Verify Supabase Token... (same as before)
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) { return res.status(401).json({ error: 'Auth required.' }); }
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) { console.error("Token verification error:", userError); return res.status(401).json({ error: `Auth failed: ${userError?.message || 'Invalid token'}` }); }
    userId = user.id;
    console.log("Verified Supabase user:", userId);

    // Get vote data... (same as before)
    const { electionId, candidateId } = req.body;
    if (electionId === undefined || candidateId === undefined) return res.status(400).json({ error: 'electionId and candidateId required.' });
    console.log(`Vote for Election ${electionId}, Candidate ${candidateId} from User ${userId}`);

    // Check Supabase DB... (same as before)
    const { data: voterData, error: dbError } = await supabaseAdmin.from('voters').select('has_voted_election_1').eq('id', userId).single();
    if (dbError && dbError.code !== 'PGRST116') { console.error("DB select error:", dbError); return res.status(500).json({ error: 'DB error checking voter status.' }); }
    if (!voterData) { console.error("Voter not found:", userId); return res.status(404).json({ error: 'Voter record not found.' }); }
    if (voterData.has_voted_election_1 === true) { console.warn("User already voted:", userId); return res.status(400).json({ error: 'Already voted.' }); }
    console.log("User eligible.");

    // Send vote to Blockchain... (same as before)
    const gasOverrides = { maxPriorityFeePerGas: ethers.utils.parseUnits('30', 'gwei'), maxFeePerGas: ethers.utils.parseUnits('100', 'gwei') };
    console.log(`Submitting vote to contract ${CONTRACT_ADDRESS}...`);
    const tx = await contract.recordVote(electionId, candidateId, gasOverrides);
    console.log("Tx sent, waiting...");
    await tx.wait();
    console.log(`Vote successful! Hash: ${tx.hash}`);

    // Update Supabase DB... (same as before)
    const { error: updateError } = await supabaseAdmin.from('voters').update({ has_voted_election_1: true, vote_hash_election_1: tx.hash }).eq('id', userId);
    if (updateError) { console.error("CRITICAL: Failed Supabase update:", updateError); } else { console.log("Supabase updated:", userId); }

    // Send success... (same as before)
    res.status(200).json({ success: true, transactionHash: tx.hash });

  } catch (error) { // Error handling... (same as before)
    console.error('Error in castVote API:', error); let errorMessage = 'Unknown server error.'; let statusCode = 500; if (error instanceof Error && error.code) { switch(error.code) { case ethers.errors.CALL_EXCEPTION: case 'CALL_EXCEPTION': errorMessage = "Vote failed on-chain."; console.error("Blockchain CALL_EXCEPTION:", error.reason); break; case 'UNPREDICTABLE_GAS_LIMIT': errorMessage = "Cannot estimate gas."; console.error("Blockchain UNPREDICTABLE_GAS_LIMIT:", error); break; case 'NETWORK_ERROR': errorMessage = "Blockchain network error."; console.error("Blockchain NETWORK_ERROR:", error); break; default: errorMessage = `Server error (${error.code}).`; } } else if (error instanceof Error) { errorMessage = error.message; } console.error(`Error context - User ID: ${userId || 'N/A'}`); res.status(statusCode).json({ error: errorMessage, code: error?.code });
  }
}