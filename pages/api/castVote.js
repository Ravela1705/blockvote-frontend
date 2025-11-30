import { createClient } from '@supabase/supabase-js'
import { ethers } from 'ethers';

// --- CONFIGURATION ---
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// --- HARDCODED NEW ABI (To fix the reading error) ---
const CONTRACT_ABI = [
  {
    "inputs": [{"internalType": "uint256", "name": "_electionId", "type": "uint256"}],
    "name": "getElectionDetails",
    "outputs": [
      {"internalType": "string", "name": "name", "type": "string"},
      {"internalType": "uint256", "name": "startTime", "type": "uint256"},
      {"internalType": "uint256", "name": "endTime", "type": "uint256"},
      {"internalType": "uint256", "name": "targetYear", "type": "uint256"},
      {"internalType": "string", "name": "targetSection", "type": "string"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_electionId", "type": "uint256"},
      {"internalType": "uint256", "name": "_candidateId", "type": "uint256"}
    ],
    "name": "recordVote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    // 1. Init Supabase
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Supabase config missing.");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Init Blockchain
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    // 3. Verify User Token
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Auth required.' });
    const { data: { user }, error: uErr } = await supabaseAdmin.auth.getUser(token);
    if (uErr || !user) return res.status(401).json({ error: 'Invalid token.' });

    const { electionId, candidateId } = req.body;
    if (!electionId || !candidateId) return res.status(400).json({ error: 'Missing electionId or candidateId' });

    // 4. Fetch User Data (Profile + Votes)
    const { data: voterData, error: dbErr } = await supabaseAdmin
        .from('voters')
        .select('votes_cast, academic_year, section')
        .eq('id', user.id)
        .single();

    if (dbErr || !voterData) return res.status(404).json({ error: 'Voter record not found.' });

    // 5. Check Double Voting
    const votesCast = voterData.votes_cast || {};
    if (votesCast[electionId]) return res.status(400).json({ error: 'Already voted in this election.' });

    // 6. Verify Eligibility (Fetch Election Rules from Chain)
    // --- THIS WAS CRASHING BEFORE, NOW FIXED ---
    const details = await contract.getElectionDetails(electionId);
    
    // Safely convert BigNumber to Number
    const targetYear = details.targetYear.toNumber();
    const targetSection = details.targetSection;

    // Compare
    if (voterData.academic_year !== targetYear || voterData.section !== targetSection) {
        return res.status(403).json({ error: `Not eligible. Election is for Year ${targetYear} Sec ${targetSection}.` });
    }

    // 7. Submit Vote to Blockchain
    const gasOverrides = { maxPriorityFeePerGas: ethers.utils.parseUnits('30', 'gwei'), maxFeePerGas: ethers.utils.parseUnits('100', 'gwei') };
    const tx = await contract.recordVote(electionId, candidateId, gasOverrides);
    
    console.log("Vote TX Sent:", tx.hash);
    await tx.wait();

    // 8. Update Supabase
    const updatedVotes = { ...votesCast, [electionId]: tx.hash };
    await supabaseAdmin.from('voters').update({ votes_cast: updatedVotes }).eq('id', user.id);

    res.status(200).json({ success: true, transactionHash: tx.hash });

  } catch (error) {
    console.error('CastVote Error:', error);
    // Return the actual error message for debugging
    res.status(500).json({ error: error.message || 'Server error.' });
  }
}