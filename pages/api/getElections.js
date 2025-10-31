import { ethers } from 'ethers';
import { Buffer } from 'buffer'; // Use Buffer for Base64 decoding on the server

// --- Blockchain Config ---
// All this code runs on the server, where we know it works.
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
let CONTRACT_ABI;
let contract;

// --- Helper: Get Contract Instance ---
// We create this once when the API route initializes
try {
    const abiBase64 = process.env.NEXT_PUBLIC_CONTRACT_ABI;
    if (!abiBase64) throw new Error("Contract ABI env var missing");
    
    // Use Buffer for robust decoding on the server
    const abiString = Buffer.from(abiBase64, 'base64').toString('utf-8');
    CONTRACT_ABI = JSON.parse(abiString);
    
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    // We only need a read-only contract for this, but using the admin wallet is fine
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider); 
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    
    console.log("getElections API: Connected to blockchain.");
} catch (e) {
    console.error("CRITICAL ERROR getting contract instance in getElections API:", e.message);
}
// --- End Config ---


// --- Helper: Fetch All Election Data ---
const fetchAllElectionData = async () => {
    if (!contract) throw new Error("Contract not initialized");

    try {
        const electionCountBN = await contract.getElectionCount();
        const electionCount = electionCountBN.toNumber();
        if (electionCount === 0) return []; // No elections found

        const electionPromises = [];
        for (let i = 1; i <= electionCount; i++) {
            const electionPromise = (async () => {
                try {
                    const details = await contract.getElectionDetails(i);
                    const candidatesData = await contract.getElectionCandidates(i);
                    
                    const name = details[0];
                    const startTime = details[1].toNumber();
                    const endTime = details[2].toNumber();

                    const formattedCandidates = candidatesData.map(c => {
                        const voteCountBN = ethers.BigNumber.isBigNumber(c.voteCount) ? c.voteCount : ethers.BigNumber.from(c.voteCount || 0);
                        return {
                            id: ethers.BigNumber.isBigNumber(c.id) ? c.id.toNumber() : c.id,
                            name: c.name,
                            votes: voteCountBN.toNumber(),
                        };
                    });
                    
                    let totalVotes = formattedCandidates.reduce((acc, c) => acc + c.votes, 0);

                    const now = Math.floor(Date.now() / 1000);
                    let status = 'Upcoming';
                    if (now >= startTime && now < endTime) status = 'Active';
                    else if (now >= endTime) status = 'Ended';

                    return {
                        id: i,
                        title: name,
                        startTime: startTime,
                        endTime: endTime,
                        status: status,
                        candidates: formattedCandidates,
                        totalVotes: totalVotes
                    };
                } catch (err) {
                    console.error(`Failed to fetch data for election ID ${i}:`, err);
                    return null;
                }
            })();
            electionPromises.push(electionPromise);
        }

        const resolvedElections = await Promise.all(electionPromises);
        const validElections = resolvedElections.filter(e => e !== null);
        console.log("getElections API: Fetched all elections:", validElections.length);
        return validElections.reverse(); // Show latest elections first
    } catch (err) {
        console.error("Failed to fetch election count:", err);
        return [];
    }
};

// --- API Handler ---
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // NOTE: This endpoint is public. For a real app, you might want to
  // verify the user is logged in (via Supabase token) before returning data.
  // But for now, election data is not secret.

  try {
    const elections = await fetchAllElectionData();
    res.status(200).json({ allElections: elections });
  } catch (error) {
    console.error("Error in getElections handler:", error.message);
    res.status(500).json({ error: 'Failed to fetch election data.' });
  }
}