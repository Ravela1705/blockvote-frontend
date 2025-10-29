import * as admin from 'firebase-admin';
import { ethers } from 'ethers'; // Using Ethers v5

// --- Initialization Logic (Same as registerUser.js) ---
let adminApp;
const initializeFirebaseAdmin = () => {
    if (admin.apps.length > 0) { console.log("Firebase Admin SDK already initialized."); adminApp = admin.app(); return adminApp; }
    let serviceAccount;
    try {
        if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON not set.");
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) throw new Error("Parsed service account JSON missing fields.");
    } catch (e) { console.error("CRITICAL ERROR parsing FIREBASE_SERVICE_ACCOUNT_JSON:", e.message); throw new Error("Could not parse Firebase service account JSON."); }
    try {
        console.log("Initializing Firebase Admin SDK...");
        adminApp = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        console.log("Firebase Admin SDK Initialized Successfully.");
        return adminApp;
    } catch (initError) { console.error("CRITICAL ERROR: Firebase Admin SDK Initialization Failed:", initError); throw new Error('Firebase Admin SDK could not be initialized.'); }
};
// --- End Initialization ---


// --- Blockchain Config (No changes needed here) ---
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
let CONTRACT_ABI;
try { CONTRACT_ABI = JSON.parse(process.env.NEXT_PUBLIC_CONTRACT_ABI); } catch (e) { console.error("Error parsing CONTRACT_ABI:", e); throw new Error("Could not parse contract ABI."); }
let provider, wallet, contract;
try {
    provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    console.log("Connected to blockchain and contract.");
} catch(e){ console.error("Error connecting to blockchain:", e); throw new Error("Could not connect to blockchain."); }
// --- End Config ---


// --- API Handler ---
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  let auth; // Not strictly needed for create, but initialize for consistency
  try {
      const app = initializeFirebaseAdmin(); // Ensure initialized
      auth = admin.auth(app); // Get auth service instance
      if (!auth) throw new Error("Failed to get Firebase auth service.");
  } catch (e) {
      console.error("Failed during Firebase service initialization in handler:", e.message);
      // Allow proceeding but log warning, as admin auth isn't implemented yet
      console.warn("Could not get Firebase Auth service, proceeding without admin check.");
      // return res.status(500).json({ error: 'Server configuration error (Firebase init).' });
  }

  // TODO: Add proper admin verification here later
  // For now, assume caller is admin

  try {
    const { title, candidates, durationHours } = req.body;

    // Validation
    if (!title || !candidates || !Array.isArray(candidates) || candidates.length < 2 || !durationHours) { return res.status(400).json({ error: 'Missing required fields: title (string), candidates (array, min 2), durationHours (number).' }); }
    if (typeof durationHours !== 'number' || durationHours <= 0) { return res.status(400).json({ error: 'durationHours must be a positive number.' }); }
    if (candidates.some(c => typeof c !== 'string' || c.trim() === '')) { return res.status(400).json({ error: 'All candidate names must be non-empty strings.' }); }

    const durationSeconds = durationHours * 60 * 60;

    console.log(`Creating election '${title}' with candidates [${candidates.join(', ')}] for ${durationHours} hours (${durationSeconds} seconds)...`);

    // Add gas overrides
    const gasOverrides = { maxPriorityFeePerGas: ethers.utils.parseUnits('30', 'gwei'), maxFeePerGas: ethers.utils.parseUnits('100', 'gwei') };
    console.log("Using gas overrides:", gasOverrides);

    const tx = await contract.createElection(title, candidates, durationSeconds, gasOverrides);
    console.log("Transaction sent, waiting for confirmation...");
    const receipt = await tx.wait();

    let electionId = "N/A (Check transaction events)";
    if (receipt.events) {
        const event = receipt.events.find(e => e.event === 'ElectionCreated');
        if (event && event.args && event.args.electionId) {
             electionId = ethers.BigNumber.isBigNumber(event.args.electionId) ? event.args.electionId.toString() : event.args.electionId;
        }
    }
    console.log(`Election created successfully! Tx Hash: ${tx.hash}, Election ID: ${electionId}`);

    res.status(200).json({ success: true, transactionHash: tx.hash, electionId: electionId, message: `Election '${title}' created successfully.` });

  } catch (error) {
    console.error('Error in createElection API execution:', error);
    let errorMessage = 'An unknown server error occurred.';
    let statusCode = 500;
     if (error instanceof Error && error.code) {
         switch(error.code) {
            case ethers.errors.CALL_EXCEPTION:
            case 'CALL_EXCEPTION':
                errorMessage = "Election creation failed on-chain. Check contract state or permissions.";
                console.error("Blockchain CALL_EXCEPTION details:", error.reason, error.transaction);
                break;
            case 'UNPREDICTABLE_GAS_LIMIT':
                 errorMessage = "Cannot estimate gas. Possible contract error or input issue.";
                 console.error("Blockchain UNPREDICTABLE_GAS_LIMIT details:", error);
                 break;
             // Add other specific blockchain errors if needed
             default:
                 errorMessage = `Blockchain error (${error.code}): ${error.message}`;
         }
     } else if (error instanceof Error) {
         errorMessage = error.message;
     }
    res.status(statusCode).json({ error: errorMessage, code: error?.code });
  }
}