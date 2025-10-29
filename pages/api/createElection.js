// REMOVED: import * as admin from 'firebase-admin';
import { ethers } from 'ethers'; // Using Ethers v5
// REMOVED: Firebase Admin initialization logic

// --- Blockchain Config (Stays the same) ---
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
let CONTRACT_ABI;
try {
    CONTRACT_ABI = JSON.parse(process.env.NEXT_PUBLIC_CONTRACT_ABI);
} catch (e) {
    console.error("Error parsing CONTRACT_ABI from .env.local:", e);
    throw new Error("Could not parse contract ABI. Check .env.local format.");
}
let provider, wallet, contract;
try {
    provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider); // Use the ADMIN key
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    console.log("Connected to blockchain and contract in createElection.");
} catch(e){
    console.error("Error connecting to blockchain in createElection:", e);
    throw new Error("Could not connect to blockchain.");
}
// --- End Blockchain Config ---

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // TODO: Add proper admin verification here later (e.g., check Supabase token)

  try {
    const { title, candidates, durationHours } = req.body;

    // Validation
    if (!title || !candidates || !Array.isArray(candidates) || candidates.length < 2 || !durationHours) {
        return res.status(400).json({ error: 'Missing required fields: title (string), candidates (array, min 2), durationHours (number).' });
    }
    if (typeof durationHours !== 'number' || durationHours <= 0) {
         return res.status(400).json({ error: 'durationHours must be a positive number.' });
    }
     if (candidates.some(c => typeof c !== 'string' || c.trim() === '')) {
         return res.status(400).json({ error: 'All candidate names must be non-empty strings.' });
     }

    const durationSeconds = durationHours * 60 * 60;

    console.log(`Creating election '${title}' with candidates [${candidates.join(', ')}] for ${durationHours} hours (${durationSeconds} seconds)...`);

    // Add gas overrides
    const gasOverrides = {
        maxPriorityFeePerGas: ethers.utils.parseUnits('30', 'gwei'),
        maxFeePerGas: ethers.utils.parseUnits('100', 'gwei')
    };
    console.log("Using gas overrides:", gasOverrides);

    const tx = await contract.createElection(
        title,
        candidates,
        durationSeconds,
        gasOverrides // Pass the overrides object here
    );

    console.log("Transaction sent, waiting for confirmation...");
    const receipt = await tx.wait();

    let electionId = "N/A (Check transaction events)";
    if (receipt.events) {
        const event = receipt.events.find(e => e.event === 'ElectionCreated');
        if (event && event.args && event.args.electionId) {
             electionId = ethers.BigNumber.isBigNumber(event.args.electionId)
                ? event.args.electionId.toString()
                : event.args.electionId;
        }
    }

    console.log(`Election created successfully! Transaction Hash: ${tx.hash}, Election ID (from event): ${electionId}`);

    res.status(200).json({
      success: true,
      transactionHash: tx.hash,
      electionId: electionId,
      message: `Election '${title}' created successfully.`
    });

  } catch (error) {
    console.error('Error in createElection API:', error);
    let errorMessage = 'An unknown server error occurred.';
     if (error && typeof error === 'object' ) {
         if ('message' in error) errorMessage = error.message;

         if (errorMessage.includes('gas price below minimum')) {
             errorMessage = "Transaction failed: Network gas price is too high. The gas settings in the API route might need adjustment.";
         }
         else if ('code' in error && (error.code === ethers.errors.CALL_EXCEPTION || error.code === 'CALL_EXCEPTION')) {
            errorMessage = "Election creation failed on-chain. Check contract state or permissions.";
             console.error("Blockchain CALL_EXCEPTION details:", error.reason, error.transaction);
        } else if ('code' in error && error.code === 'UNPREDICTABLE_GAS_LIMIT') {
             errorMessage = "Cannot estimate gas. Possible contract error or input issue.";
             console.error("Blockchain UNPREDICTABLE_GAS_LIMIT details:", error);
        }
     }
    res.status(500).json({ error: errorMessage, details: error?.toString() });
  }
}