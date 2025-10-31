import { createClient } from '@supabase/supabase-js'
import { ethers } from 'ethers'; // Using Ethers v5

// --- Supabase Admin Client ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseServiceKey) throw new Error("Server config error: Supabase credentials missing.")
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
// --- End Supabase ---

// --- Blockchain Config ---
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
let CONTRACT_ABI; try { const abiString = process.env.NEXT_PUBLIC_CONTRACT_ABI; if (!abiString) throw new Error("ABI env var not set."); CONTRACT_ABI = JSON.parse(Buffer.from(abiString, 'base64').toString('utf-8')); console.log("Parsed ABI."); } catch (e) { console.error("Error parsing ABI:", e.message); throw new Error("Could not parse ABI."); }
let provider, wallet, contract;
try { provider = new ethers.providers.JsonRpcProvider(RPC_URL); wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider); contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet); console.log("Connected to blockchain."); } catch(e){ console.error("Blockchain connection error:", e); throw new Error("Could not connect to blockchain."); }
// --- End Config ---


export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  let userId = null;
  try {
    // --- Verify Supabase JWT Token ---
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) { return res.status(401).json({ error: 'Authentication required.' }); }
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) { console.error("Token verification error:", userError); return res.status(401).json({ error: `Authentication failed: ${userError?.message || 'Invalid token'}` }); }
    userId = user.id;
    console.log("Verified Supabase user:", userId, user.email);
    // --- End Verification ---


    // 3. Get vote data
    const { electionId, candidateId } = req.body;
    if (electionId === undefined || candidateId === undefined) return res.status(400).json({ error: 'electionId and candidateId are required.' });
    console.log(`Received vote for Election ${electionId}, Candidate ${candidateId} from User ${userId}`);

    // 4. Check Supabase DB
    // --- UPDATED: Select the new 'votes_cast' column ---
    const { data: voterData, error: dbError } = await supabaseAdmin
        .from('voters')
        .select('votes_cast') // <-- Select the new JSONB column
        .eq('id', userId)
        .single();

    if (dbError && dbError.code !== 'PGRST116') { // Ignore row not found
        console.error("Supabase DB select error:", dbError);
        return res.status(500).json({ error: 'Database error checking voter status.' });
    }
    if (!voterData) {
        console.error("Voter document not found:", userId);
        return res.status(404).json({ error: 'Voter registration record not found in database.' });
    }

    // --- UPDATED: Check if the electionId key exists in the 'votes_cast' object ---
    const votesCast = voterData.votes_cast || {}; // Default to empty object if null
    if (votesCast[electionId]) {
      console.warn(`User ${userId} has already voted in election ${electionId}.`);
      return res.status(400).json({ error: 'You have already voted in this election.' });
    }
    // --- END UPDATED ---

    console.log("User is eligible to vote.");

    // 5. Send vote to Blockchain
    const gasOverrides = { maxPriorityFeePerGas: ethers.utils.parseUnits('30', 'gwei'), maxFeePerGas: ethers.utils.parseUnits('100', 'gwei') };
    console.log(`Submitting vote to contract ${CONTRACT_ADDRESS}...`);
    const tx = await contract.recordVote(electionId, candidateId, gasOverrides);
    console.log("Transaction sent, waiting for confirmation...");
    await tx.wait();
    console.log(`Vote successful! Hash: ${tx.hash}`);

    // 6. Update Supabase DB
    // --- UPDATED: Add the new vote to the 'votes_cast' JSONB object ---
    const updatedVotes = {
        ...votesCast, // Keep all existing votes
        [electionId]: tx.hash // Add the new vote for this election ID
    };

    const { error: updateError } = await supabaseAdmin
        .from('voters')
        .update({
            votes_cast: updatedVotes // Store the new object
        })
        .eq('id', userId);
    // --- END UPDATED ---

     if (updateError) { console.error("CRITICAL: Failed to update voter status in Supabase:", updateError); }
     else { console.log("Supabase 'voters' table updated for user:", userId); }

    // 7. Send success
    res.status(200).json({ success: true, transactionHash: tx.hash });

  } catch (error) { // Catch errors
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