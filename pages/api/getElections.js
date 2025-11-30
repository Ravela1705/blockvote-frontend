import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

// --- CONFIGURATION ---
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// --- HARDCODED ABI ---
const CONTRACT_ABI = [
  { "inputs": [{"internalType": "uint256", "name": "_electionId", "type": "uint256"}], "name": "getElectionDetails", "outputs": [{"internalType": "string", "name": "name", "type": "string"}, {"internalType": "uint256", "name": "startTime", "type": "uint256"}, {"internalType": "uint256", "name": "endTime", "type": "uint256"}, {"internalType": "uint256", "name": "targetYear", "type": "uint256"}, {"internalType": "string", "name": "targetSection", "type": "string"}], "stateMutability": "view", "type": "function" },
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

    // --- CHECK USER ROLE ---
    // Try to find them in voters table
    const { data: voterData, error: dbError } = await supabaseAdmin
        .from('voters')
        .select('academic_year, section')
        .eq('id', user.id)
        .single();

    // If dbError exists (PGRST116), it means user is NOT a voter. Assume Admin.
    const isAdmin = !!dbError || !voterData; 
    
    const userYear = voterData?.academic_year;
    const userSection = voterData?.section;

    // --- FETCH FROM BLOCKCHAIN ---
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    const countBN = await contract.getElectionCount();
    const electionCount = countBN.toNumber();
    const allElections = [];

    for (let i = 1; i <= electionCount; i++) {
        try {
            const details = await contract.getElectionDetails(i);
            const candidatesData = await contract.getElectionCandidates(i);
            
            // --- FILTERING ---
            // If it is a student, check if they match. If Admin, show everything.
            if (!isAdmin) {
                const tYear = details.targetYear.toNumber();
                const tSec = details.targetSection;
                if (tYear !== userYear || tSec !== userSection) continue; // Skip mismatch
            }

            const candidates = candidatesData.map(c => ({
                id: c.id.toNumber(),
                name: c.name,
                votes: c.voteCount.toNumber(),
            }));
            const totalVotes = candidates.reduce((acc, c) => acc + c.votes, 0);
            
            const now = Math.floor(Date.now() / 1000);
            const start = details.startTime.toNumber();
            const end = details.endTime.toNumber();
            let status = now >= end ? 'Ended' : now >= start ? 'Active' : 'Upcoming';

            allElections.push({
                id: i,
                title: details.name,
                startTime: start,
                endTime: end,
                targetYear: details.targetYear.toNumber(),
                targetSection: details.targetSection,
                status,
                candidates,
                totalVotes
            });
        } catch (e) { console.error(`Error fetching election ${i}`, e); }
    }

    res.status(200).json({ allElections: allElections.reverse() });

  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: 'Failed to fetch elections.' });
  }
}