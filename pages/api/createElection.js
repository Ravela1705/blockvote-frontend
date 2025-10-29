import * as admin from 'firebase-admin';
import { ethers } from 'ethers'; // Using Ethers v5

// --- NEW Initialization Logic (Same as registerUser.js) ---
const initializeFirebaseAdmin = () => {
    if (admin.apps.length > 0) {
        console.log("Firebase Admin SDK already initialized.");
        return admin.app();
    }
    let serviceAccount;
    try {
        if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
            throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set.");
        }
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
         if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
             throw new Error("Parsed service account JSON is missing required fields.");
        }
    } catch (e) {
        console.error("CRITICAL ERROR: Could not parse or validate FIREBASE_SERVICE_ACCOUNT_JSON:", e.message);
        throw new Error("Could not parse Firebase service account JSON.");
    }
    try {
        console.log("Initializing Firebase Admin SDK...");
        const app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        console.log("Firebase Admin SDK Initialized Successfully.");
        return app;
    } catch (initError) {
        console.error("CRITICAL ERROR: Firebase Admin SDK Initialization Failed:", initError);
         throw new Error('Firebase Admin SDK could not be initialized.');
    }
};
let auth, db; // We don't really need db here, but keep consistent
try {
    const app = initializeFirebaseAdmin();
    auth = admin.auth(app); // We might add admin auth later
    db = admin.firestore(app);
} catch (e) {
     console.error("Failed to get Firebase services after initialization attempt:", e.message);
}
// --- End Initialization Logic ---


// --- Blockchain Config (No changes needed here) ---
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

   // Check if auth/db failed to initialize (though less critical here)
  if (!auth) { // db not strictly needed for createElection
      console.error("Firebase auth service not available in handler.");
      // Allow proceeding but log warning, as admin auth isn't implemented yet
      // return res.status(500).json({ error: 'Server configuration error. Firebase services unavailable.' });
  }

  // TODO: Add proper admin verification here later
  // (e.g., check if the caller's token belongs to a known admin user)

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

    // Add gas overrides here too!
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