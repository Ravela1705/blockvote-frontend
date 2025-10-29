import { ethers } from 'ethers'; // Using Ethers v5
// No Firebase Admin needed

// --- Blockchain Config ---
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
let CONTRACT_ABI;
try {
    const abiBase64 = process.env.NEXT_PUBLIC_CONTRACT_ABI; // Get raw base64 string
    console.log("Raw NEXT_PUBLIC_CONTRACT_ABI (Base64):", abiBase64?.substring(0, 50), "..."); // Log start
    if (!abiBase64) throw new Error("NEXT_PUBLIC_CONTRACT_ABI environment variable is not set or empty.");

    // --- *** NEW: Decode Base64 *** ---
    const abiString = Buffer.from(abiBase64, 'base64').toString('utf-8');
    // --- *** END NEW *** ---

    console.log("Decoded ABI string:", abiString?.substring(0, 100), "..."); // Log decoded start
    CONTRACT_ABI = JSON.parse(abiString); // Parse the decoded string
    console.log("Successfully parsed decoded CONTRACT_ABI.");
} catch (e) {
    console.error("Error decoding/parsing CONTRACT_ABI:", e.message);
    console.error("Problematic Base64 ABI string (first 50 chars):", process.env.NEXT_PUBLIC_CONTRACT_ABI?.substring(0, 50));
    throw new Error("Could not decode/parse contract ABI. Check Vercel environment variable format (should be Base64).");
}
let provider, wallet, contract;
try {
    provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    console.log("Connected to blockchain and contract in createElection.");
} catch(e){
    console.error("Error connecting to blockchain in createElection:", e);
    throw new Error("Could not connect to blockchain.");
}
// --- End Blockchain Config ---


// --- API Handler (Rest is the same) ---
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const { title, candidates, durationHours } = req.body;
    // Validation... (same as before)
    if (!title || !candidates || !Array.isArray(candidates) || candidates.length < 2 || !durationHours) { return res.status(400).json({ error: 'Missing required fields.' }); }
    if (typeof durationHours !== 'number' || durationHours <= 0) { return res.status(400).json({ error: 'durationHours must be positive.' }); }
    if (candidates.some(c => typeof c !== 'string' || c.trim() === '')) { return res.status(400).json({ error: 'Candidate names must be non-empty strings.' }); }

    const durationSeconds = durationHours * 60 * 60;
    console.log(`Creating election '${title}'...`);
    const gasOverrides = { maxPriorityFeePerGas: ethers.utils.parseUnits('30', 'gwei'), maxFeePerGas: ethers.utils.parseUnits('100', 'gwei') };
    console.log("Using gas overrides:", gasOverrides);
    const tx = await contract.createElection(title, candidates, durationSeconds, gasOverrides);
    console.log("Transaction sent, waiting...");
    const receipt = await tx.wait();
    let electionId = "N/A";
    if (receipt.events) { const event = receipt.events.find(e => e.event === 'ElectionCreated'); if (event?.args?.electionId) { electionId = ethers.BigNumber.isBigNumber(event.args.electionId) ? event.args.electionId.toString() : event.args.electionId; } }
    console.log(`Election created! Hash: ${tx.hash}, ID: ${electionId}`);
    res.status(200).json({ success: true, transactionHash: tx.hash, electionId: electionId, message: `Election '${title}' created.` });
  } catch (error) { // Error handling... (same as before)
    console.error('Error in createElection API execution:', error); let errorMessage = 'Unknown server error.'; let statusCode = 500; if (error instanceof Error && error.code) { switch(error.code) { case ethers.errors.CALL_EXCEPTION: case 'CALL_EXCEPTION': errorMessage = "Election creation failed on-chain."; console.error("Blockchain CALL_EXCEPTION:", error.reason); break; case 'UNPREDICTABLE_GAS_LIMIT': errorMessage = "Cannot estimate gas."; console.error("Blockchain UNPREDICTABLE_GAS_LIMIT:", error); break; default: errorMessage = `Blockchain error (${error.code})`; } } else if (error instanceof Error) { errorMessage = error.message; } res.status(statusCode).json({ error: errorMessage, code: error?.code });
  }
}