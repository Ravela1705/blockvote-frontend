import { createClient } from '@supabase/supabase-js'
import { ethers } from 'ethers';
import { Buffer } from 'buffer';

// --- Supabase Config ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseServiceKey) throw new Error("Supabase config missing.")
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// --- Blockchain Config ---
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
let contract;

try { 
    const abiString = Buffer.from(process.env.NEXT_PUBLIC_CONTRACT_ABI, 'base64').toString('utf-8');
    const CONTRACT_ABI = JSON.parse(abiString);
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL); 
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider); 
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet); 
} catch(e){ console.error("Blockchain init error:", e); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    // 1. Verify User
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Auth required.' });
    const { data: { user }, error: uErr } = await supabaseAdmin.auth.getUser(token);
    if (uErr || !user) return res.status(401).json({ error: 'Invalid token.' });

    const { electionId, candidateId } = req.body;
    if (!electionId || !candidateId) return res.status(400).json({ error: 'Missing electionId or candidateId' });

    // 2. Fetch Voter Data (votes_cast + demographics)
    const { data: voterData, error: dbErr } = await supabaseAdmin
        .from('voters')
        .select('votes_cast, academic_year, section') // Get demographics too
        .eq('id', user.id)
        .single();

    if (dbErr || !voterData) return res.status(404).json({ error: 'Voter record not found.' });

    // 3. Check Double Voting
    const votesCast = voterData.votes_cast || {};
    if (votesCast[electionId]) return res.status(400).json({ error: 'Already voted in this election.' });

    // 4. --- NEW: Verify Eligibility (Year & Section) ---
    // We fetch the election rules from the blockchain to be 100% sure
    const electionDetails = await contract.getElectionDetails(electionId);
    const targetYear = electionDetails.targetYear.toNumber();
    const targetSection = electionDetails.targetSection;

    if (voterData.academic_year !== targetYear || voterData.section !== targetSection) {
        console.warn(`Eligibility Mismatch! User: ${voterData.academic_year}-${voterData.section}, Election requires: ${targetYear}-${targetSection}`);
        return res.status(403).json({ error: 'You are not eligible to vote in this election (Year/Section mismatch).' });
    }
    // ---------------------------------------------------

    // 5. Submit Vote to Blockchain
    const gasOverrides = { maxPriorityFeePerGas: ethers.utils.parseUnits('30', 'gwei'), maxFeePerGas: ethers.utils.parseUnits('100', 'gwei') };
    const tx = await contract.recordVote(electionId, candidateId, gasOverrides);
    await tx.wait();

    // 6. Update Supabase
    const updatedVotes = { ...votesCast, [electionId]: tx.hash };
    await supabaseAdmin.from('voters').update({ votes_cast: updatedVotes }).eq('id', user.id);

    res.status(200).json({ success: true, transactionHash: tx.hash });

  } catch (error) {
    console.error('CastVote Error:', error);
    res.status(500).json({ error: error.message || 'Server error.' });
  }
}