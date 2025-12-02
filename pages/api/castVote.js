import { createClient } from '@supabase/supabase-js'
import { ethers } from 'ethers';

const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const CONTRACT_ABI = [
  { "inputs": [{"internalType": "uint256", "name": "_electionId", "type": "uint256"}], "name": "getElectionDetails", "outputs": [{"internalType": "string", "name": "name", "type": "string"}, {"internalType": "uint256", "name": "startTime", "type": "uint256"}, {"internalType": "uint256", "name": "endTime", "type": "uint256"}, {"internalType": "uint256[]", "name": "targetYears", "type": "uint256[]"}, {"internalType": "string[]", "name": "targetSections", "type": "string[]"}], "stateMutability": "view", "type": "function" },
  { "inputs": [{"internalType": "uint256", "name": "_electionId", "type": "uint256"}, {"internalType": "uint256", "name": "_candidateId", "type": "uint256"}], "name": "recordVote", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Auth required.' });
    const { data: { user }, error: uErr } = await supabaseAdmin.auth.getUser(token);
    if (uErr || !user) return res.status(401).json({ error: 'Invalid token.' });

    const { electionId, candidateId } = req.body;
    const { data: voterData, error: dbErr } = await supabaseAdmin.from('voters').select('votes_cast, academic_year, section').eq('id', user.id).single();
    if (dbErr || !voterData) return res.status(404).json({ error: 'Voter record not found.' });

    const votesCast = voterData.votes_cast || {};
    if (votesCast[electionId]) return res.status(400).json({ error: 'Already voted.' });

    // VERIFY ELIGIBILITY (Loop through pair arrays)
    const details = await contract.getElectionDetails(electionId);
    const targetYears = details.targetYears.map(y => y.toNumber());
    const targetSections = details.targetSections;

    let isEligible = false;
    for (let k = 0; k < targetYears.length; k++) {
        if (targetYears[k] === voterData.academic_year && targetSections[k] === voterData.section) {
            isEligible = true;
            break;
        }
    }

    if (!isEligible) return res.status(403).json({ error: `Not eligible.` });

    const gasOverrides = { maxPriorityFeePerGas: ethers.utils.parseUnits('30', 'gwei'), maxFeePerGas: ethers.utils.parseUnits('100', 'gwei') };
    const tx = await contract.recordVote(electionId, candidateId, gasOverrides);
    await tx.wait();

    const updatedVotes = { ...votesCast, [electionId]: tx.hash };
    await supabaseAdmin.from('voters').update({ votes_cast: updatedVotes }).eq('id', user.id);

    res.status(200).json({ success: true, transactionHash: tx.hash });

  } catch (error) { console.error('CastVote Error:', error); res.status(500).json({ error: error.message }); }
}