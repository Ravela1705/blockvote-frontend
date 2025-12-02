import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// HARDCODED ABI FOR STABILITY
const CONTRACT_ABI = [
  { "inputs": [{"internalType": "uint256", "name": "_electionId", "type": "uint256"}], "name": "getElectionDetails", "outputs": [{"internalType": "string", "name": "name", "type": "string"}, {"internalType": "uint256", "name": "startTime", "type": "uint256"}, {"internalType": "uint256", "name": "endTime", "type": "uint256"}, {"internalType": "uint256[]", "name": "targetYears", "type": "uint256[]"}, {"internalType": "string[]", "name": "targetSections", "type": "string[]"}], "stateMutability": "view", "type": "function" },
  { "inputs": [{"internalType": "uint256", "name": "_electionId", "type": "uint256"}], "name": "getElectionCandidates", "outputs": [{"components": [{"internalType": "uint256", "name": "id", "type": "uint256"}, {"internalType": "string", "name": "name", "type": "string"}, {"internalType": "uint256", "name": "voteCount", "type": "uint256"}], "internalType": "struct Voting.Candidate[]", "name": "", "type": "tuple[]"}], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "getElectionCount", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function" }
];

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Auth required' });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Invalid Token' });

    // Check Role
    const { data: voterData, error: dbError } = await supabaseAdmin.from('voters').select('academic_year, section').eq('id', user.id).single();
    const isAdmin = !!dbError || !voterData; // If not in voters table, treat as Admin
    const userYear = voterData?.academic_year;
    const userSection = voterData?.section;

    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    const countBN = await contract.getElectionCount();
    const count = countBN.toNumber();
    const elections = [];

    for (let i = 1; i <= count; i++) {
        try {
            const details = await contract.getElectionDetails(i);
            const targetYears = details.targetYears.map(y => y.toNumber());
            const targetSections = details.targetSections;

            // FILTERING LOGIC
            if (!isAdmin) {
                let isEligible = false;
                for (let k = 0; k < targetYears.length; k++) {
                    if (targetYears[k] === userYear && targetSections[k] === userSection) {
                        isEligible = true;
                        break;
                    }
                }
                if (!isEligible) continue; // Skip if no specific pair matches
            }

            const cands = await contract.getElectionCandidates(i);
            const formattedCands = cands.map(c => ({ id: c.id.toNumber(), name: c.name, votes: c.voteCount.toNumber() }));
            const total = formattedCands.reduce((a, c) => a + c.votes, 0);
            const now = Math.floor(Date.now() / 1000);
            const start = details.startTime.toNumber();
            const end = details.endTime.toNumber();
            const status = now >= end ? 'Ended' : now >= start ? 'Active' : 'Upcoming';

            elections.push({
                id: i, title: details.name, startTime: start, endTime: end,
                targetYears, targetSections, status, candidates: formattedCands, totalVotes: total
            });
        } catch (e) { console.error(`Err ${i}`, e); }
    }

    res.status(200).json({ allElections: elections.reverse() });
  } catch (error) { console.error("API Error:", error); res.status(500).json({ error: 'Failed' }); }
}