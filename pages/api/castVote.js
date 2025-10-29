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

  let auth, db;
  try {
      const app = initializeFirebaseAdmin(); // Ensure initialized
      auth = admin.auth(app);
      db = admin.firestore(app);
      if (!auth || !db) throw new Error("Failed to get Firebase services.");
  } catch (e) {
      console.error("Failed during Firebase service initialization in handler:", e.message);
      return res.status(500).json({ error: 'Server configuration error (Firebase init).' });
  }

  try {
    // 1. Get Token
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) { return res.status(401).json({ error: 'Authentication required.' }); }

    // 2. Verify token
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;
    console.log("Verified user:", userId);

    // 3. Get vote data
    const { electionId, candidateId } = req.body;
    if (electionId === undefined || candidateId === undefined) { return res.status(400).json({ error: 'electionId and candidateId are required.' }); }
    console.log(`Received vote for Election ${electionId}, Candidate ${candidateId} from User ${userId}`);

    // 4. Check Firestore
    const voterDocRef = db.collection('voters').doc(userId);
    const voterDoc = await voterDocRef.get();
    if (!voterDoc.exists) { console.error("Voter document not found:", userId); return res.status(404).json({ error: 'Voter registration not found.' }); }
    if (voterDoc.data().hasVoted_election_1 === true) { console.warn("User already voted:", userId); return res.status(400).json({ error: 'You have already voted.' }); }
    console.log("User is eligible to vote.");

    // 5. Send vote to Blockchain
    const gasOverrides = { maxPriorityFeePerGas: ethers.utils.parseUnits('30', 'gwei'), maxFeePerGas: ethers.utils.parseUnits('100', 'gwei') };
    console.log(`Submitting vote to contract ${CONTRACT_ADDRESS} with gas overrides...`);
    const tx = await contract.recordVote(electionId, candidateId, gasOverrides);
    console.log("Transaction sent, waiting for confirmation...");
    await tx.wait();
    console.log(`Vote successful! Hash: ${tx.hash}`);

    // 6. Update Firestore
    await voterDocRef.update({ hasVoted_election_1: true, voteHash_election_1: tx.hash });
    console.log("Firestore updated for user:", userId);

    // 7. Send success
    res.status(200).json({ success: true, transactionHash: tx.hash });

  } catch (error) {
    console.error('Error in castVote API execution:', error);
    let errorMessage = 'An unknown server error occurred during voting.';
    let statusCode = 500;
     if (error instanceof Error && error.code) {
         switch(error.code) {
            case ethers.errors.CALL_EXCEPTION:
            case 'CALL_EXCEPTION':
                errorMessage = "Vote failed on-chain. Possible reasons: Election ended, invalid candidate, or contract issue.";
                console.error("Blockchain CALL_EXCEPTION details:", error.reason, error.transaction);
                break;
            case 'UNPREDICTABLE_GAS_LIMIT':
                 errorMessage = "Cannot estimate gas. Possible contract error or network issue.";
                 console.error("Blockchain UNPREDICTABLE_GAS_LIMIT details:", error);
                 break;
            case 'NETWORK_ERROR':
                 errorMessage = "Network error communicating with the blockchain.";
                 console.error("Blockchain NETWORK_ERROR details:", error);
                 break;
            default:
                 errorMessage = `Blockchain error (${error.code}): ${error.message}`;
         }
     } else if (error instanceof Error) {
         errorMessage = error.message;
     }
    res.status(statusCode).json({ error: errorMessage, code: error?.code });
  }
}