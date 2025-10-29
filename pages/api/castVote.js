import { createClient } from '@supabase/supabase-js'
import { ethers } from 'ethers'; // Using Ethers v5

// --- Supabase Admin Client ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseServiceKey) throw new Error("Server config error: Supabase credentials missing.")
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
// --- End Supabase ---

// --- Blockchain Config (No changes needed here) ---
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
let CONTRACT_ABI; try { CONTRACT_ABI = JSON.parse(process.env.NEXT_PUBLIC_CONTRACT_ABI); } catch (e) { throw new Error("Could not parse contract ABI."); }
let provider, wallet, contract;
try { provider = new ethers.providers.JsonRpcProvider(RPC_URL); wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider); contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet); console.log("Connected to blockchain."); } catch(e){ console.error("Blockchain connection error:", e); throw new Error("Could not connect to blockchain."); }
// --- End Config ---


export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  let userId = null;
  try {
    // --- *** NEW: Verify Supabase JWT Token *** ---
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) { return res.status(401).json({ error: 'Authentication required.' }); }

    // Use Supabase Admin client to verify the token and get user data
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError) {
        console.error("Supabase token verification error:", userError);
        return res.status(401).json({ error: `Authentication failed: ${userError.message}` });
    }
    if (!user) {
        return res.status(401).json({ error: 'Authentication failed: Invalid token or user not found.' });
    }
    userId = user.id; // Get the authenticated user's ID
    console.log("Verified Supabase user:", userId, user.email);
    // --- *** END NEW *** ---


    // 3. Get vote data
    const { electionId, candidateId } = req.body;
    if (electionId === undefined || candidateId === undefined) return res.status(400).json({ error: 'electionId and candidateId are required.' });
    console.log(`Received vote for Election ${electionId}, Candidate ${candidateId} from User ${userId}`);

    // 4. Check Supabase DB to see if they've already voted
    const { data: voterData, error: dbError } = await supabaseAdmin
        .from('voters')
        .select('has_voted_election_1') // Select the specific column
        .eq('id', userId) // Find the row where 'id' matches the authenticated user's ID
        .single(); // Expect only one row

    if (dbError || !voterData) {
        console.error("Supabase DB select error or voter not found:", dbError);
        // If voter not found, it means they didn't complete registration properly
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
        .update({
            has_voted_election_1: true,
            vote_hash_election_1: tx.hash // Save the hash
        })
        .eq('id', userId); // Update the row matching the user ID

     if (updateError) {
        // Log the error but maybe don't fail the whole request?
        // Depends on desired behavior if DB update fails after successful vote.
        console.error("CRITICAL: Failed to update voter status in Supabase after successful vote:", updateError);
        // Potentially return success but include a warning
        // return res.status(500).json({ error: 'Vote recorded on blockchain, but failed to update database record.' });
     } else {
        console.log("Supabase 'voters' table updated for user:", userId);
     }


    // 7. Send success
    res.status(200).json({ success: true, transactionHash: tx.hash });

  } catch (error) { // Catch errors from blockchain or token verification
    console.error('Error in castVote API execution:', error);
    let errorMessage = 'An unknown server error occurred during voting.';
    let statusCode = 500;
     if (error instanceof Error && error.code) { /* ... keep blockchain error handling ... */
         switch(error.code) { case ethers.errors.CALL_EXCEPTION: case 'CALL_EXCEPTION': errorMessage = "Vote failed on-chain."; console.error("Blockchain CALL_EXCEPTION:", error.reason); break; case 'UNPREDICTABLE_GAS_LIMIT': errorMessage = "Cannot estimate gas."; console.error("Blockchain UNPREDICTABLE_GAS_LIMIT:", error); break; case 'NETWORK_ERROR': errorMessage = "Network error communicating with blockchain."; console.error("Blockchain NETWORK_ERROR:", error); break; default: errorMessage = `Blockchain error (${error.code})`; }
     } else if (error instanceof Error) { errorMessage = error.message; }
     // Ensure userId is included in error context if available
     console.error(`Error context - User ID: ${userId || 'N/A'}`);
    res.status(statusCode).json({ error: errorMessage, code: error?.code });
  }
}