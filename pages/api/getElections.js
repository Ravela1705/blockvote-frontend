import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { Buffer } from 'buffer';

// --- Configuration ---
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Server config error: Supabase credentials missing.");
}

// Init Supabase Admin (to fetch user demographics)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Init Blockchain
let contract;
try {
    const abiBase64 = process.env.NEXT_PUBLIC_CONTRACT_ABI;
    if (!abiBase64) throw new Error("Contract ABI env var missing");
    const abiString = Buffer.from(abiBase64, 'base64').toString('utf-8');
    const CONTRACT_ABI = JSON.parse(abiString);
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
} catch (e) {
    console.error("Blockchain init error:", e.message);
}

// --- Helper: Fetch and Filter Elections ---
const fetchAndFilterElections = async (userYear, userSection) => {
    if (!contract) return [];

    try {
        const electionCountBN = await contract.getElectionCount();
        const electionCount = electionCountBN.toNumber();
        if (electionCount === 0) return [];

        const electionPromises = [];
        for (let i = 1; i <= electionCount; i++) {
            electionPromises.push((async () => {
                try {
                    // Fetch details from Blockchain
                    // Returns: [name, startTime, endTime, targetYear, targetSection]
                    const details = await contract.getElectionDetails(i);
                    
                    const targetYear = details.targetYear.toNumber();
                    const targetSection = details.targetSection;

                    // --- FILTERING LOGIC ---
                    // If the user's Year/Section doesn't match the election's target, skip it.
                    // (Note: You might want Admins to see everything. If so, skip this check for admins)
                    if (targetYear !== userYear || targetSection !== userSection) {
                        return null; // Hidden from this user
                    }
                    // -----------------------

                    const candidatesData = await contract.getElectionCandidates(i);
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

                    return {
                        id: i,
                        title: details.name,
                        startTime,
                        endTime,
                        targetYear,
                        targetSection,
                        status,
                        candidates: formattedCandidates,
                        totalVotes
                    };
                } catch (err) {
                    console.error(`Error fetching election ${i}:`, err.message);
                    return null;
                }
            })());
        }

        const resolved = await Promise.all(electionPromises);
        return resolved.filter(e => e !== null).reverse(); // Remove nulls (hidden elections)
    } catch (err) {
        console.error("Fetch error:", err);
        return [];
    }
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    // 1. Verify User Token
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Invalid Token' });

    // 2. Get User Demographics (Year & Section)
    const { data: voterData, error: dbError } = await supabaseAdmin
        .from('voters')
        .select('academic_year, section')
        .eq('id', user.id)
        .single();
    
    if (dbError || !voterData) {
        // If user is an Admin, they might not be in 'voters' table. 
        // You might want to let admins see all. For now, we return empty if not found.
        return res.status(200).json({ allElections: [] }); 
    }

    console.log(`Fetching elections for Year: ${voterData.academic_year}, Section: ${voterData.section}`);

    // 3. Fetch & Filter
    const elections = await fetchAndFilterElections(voterData.academic_year, voterData.section);
    
    res.status(200).json({ allElections: elections });

  } catch (error) {
    console.error("API Error:", error.message);
    res.status(500).json({ error: 'Failed to fetch elections.' });
  }
}