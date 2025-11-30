import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

// --- CONFIGURATION ---
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// --- HARDCODED NEW ABI (To ensure stability) ---
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
    "inputs": [{"internalType": "uint256", "name": "_electionId", "type": "uint256"}],
    "name": "getElectionCandidates",
    "outputs": [{
      "components": [
        {"internalType": "uint256", "name": "id", "type": "uint256"},
        {"internalType": "string", "name": "name", "type": "string"},
        {"internalType": "uint256", "name": "voteCount", "type": "uint256"}
      ],
      "internalType": "struct Voting.Candidate[]",
      "name": "",
      "type": "tuple[]"
    }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getElectionCount",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    // 1. Init Supabase Admin
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Supabase credentials missing.");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Verify User Token
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Invalid Token' });

    // 3. Get User Demographics
    const { data: voterData, error: dbError } = await supabaseAdmin
        .from('voters')
        .select('academic_year, section')
        .eq('id', user.id)
        .single();
    
    // Note: If user is Admin, voterData might be null. That's okay, Admins see all.
    const userYear = voterData?.academic_year;
    const userSection = voterData?.section;
    const isAdmin = !voterData; // Simplistic check: if not in voters, treat as admin/viewer

    // 4. Connect to Blockchain
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    const countBN = await contract.getElectionCount();
    const electionCount = countBN.toNumber();
    const allElections = [];

    for (let i = 1; i <= electionCount; i++) {
        try {
            const details = await contract.getElectionDetails(i);
            const candidatesData = await contract.getElectionCandidates(i);
            
            const targetYear = details.targetYear.toNumber();
            const targetSection = details.targetSection;

            // --- FILTERING LOGIC ---
            // If it's a student (not admin), ONLY show matching elections
            if (!isAdmin) {
                if (targetYear !== userYear || targetSection !== userSection) {
                    continue; // Skip this election
                }
            }
            // -----------------------

            const formattedCandidates = candidatesData.map(c => ({
                id: c.id.toNumber(),
                name: c.name,
                votes: c.voteCount.toNumber(),
            }));
            
            const totalVotes = formattedCandidates.reduce((acc, c) => acc + c.votes, 0);
            const now = Math.floor(Date.now() / 1000);
            const startTime = details.startTime.toNumber();
            const endTime = details.endTime.toNumber();

            let status = 'Upcoming';
            if (now >= startTime && now < endTime) status = 'Active';
            else if (now >= endTime) status = 'Ended';

            allElections.push({
                id: i,
                title: details.name,
                startTime,
                endTime,
                targetYear,
                targetSection,
                status,
                candidates: formattedCandidates,
                totalVotes
            });
        } catch (innerErr) {
            console.error(`Error fetching election ${i}:`, innerErr);
        }
    }

    res.status(200).json({ allElections: allElections.reverse() });

  } catch (error) {
    console.error("API Error:", error.message);
    res.status(500).json({ error: 'Failed to fetch elections.' });
  }
}