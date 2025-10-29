import * as admin from 'firebase-admin';
import { ethers } from 'ethers'; // Using Ethers v5

// --- NEW: Load Service Account from Environment Variable ---
let serviceAccount;
try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set.");
    }
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
} catch (e) {
    console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_JSON:", e);
    throw new Error("Could not parse Firebase service account JSON. Check .env.local format.");
}
// --- End NEW section ---


// Initialize Firebase Admin (if it's not already)
if (!admin.apps.length) {
   try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount), // Use parsed serviceAccount
    });
    console.log("Firebase Admin SDK Initialized Successfully.");
  } catch (initError) {
    console.error("Firebase Admin SDK Initialization Failed:", initError);
     throw new Error('Firebase Admin SDK could not be initialized.');
  }
} else {
     console.log("Firebase Admin SDK already initialized.");
}

const auth = admin.auth();
const db = admin.firestore();

// --- Blockchain Config ---
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
    wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    console.log("Connected to blockchain and contract.");
} catch(e){
    console.error("Error connecting to blockchain:", e);
    throw new Error("Could not connect to blockchain. Check RPC_URL, PRIVATE_KEY, ADDRESS, or ABI in .env.local");
}
// --- End Config ---


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Get the user's ID Token
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) { return res.status(401).json({ error: 'Authentication required.' }); }

    // 2. Verify token
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;
    console.log("Verified user:", userId);

    // 3. Get vote data
    const { electionId, candidateId } = req.body;
    if (electionId === undefined || candidateId === undefined) {
        return res.status(400).json({ error: 'electionId and candidateId are required.' });
    }
    console.log(`Received vote for Election ${electionId}, Candidate ${candidateId} from User ${userId}`);

    // 4. Check Firestore
    const voterDocRef = db.collection('voters').doc(userId);
    const voterDoc = await voterDocRef.get();
    if (!voterDoc.exists) {
      console.error("Voter document not found for user:", userId);
      return res.status(404).json({ error: 'Voter registration not found.' });
    }
    if (voterDoc.data().hasVoted_election_1 === true) {
      console.warn("User has already voted:", userId);
      return res.status(400).json({ error: 'You have already voted.' });
    }
    console.log("User is eligible to vote.");

    // 5. Send vote to Blockchain
    console.log(`Submitting vote to contract ${CONTRACT_ADDRESS}...`);
    const tx = await contract.recordVote(electionId, candidateId);
    console.log("Transaction sent, waiting for confirmation...");
    await tx.wait();
    console.log(`Vote successful! Hash: ${tx.hash}`);

    // 6. Update Firestore
    await voterDocRef.update({
      hasVoted_election_1: true,
      voteHash_election_1: tx.hash
    });
    console.log("Firestore updated for user:", userId);

    // 7. Send success
    res.status(200).json({ success: true, transactionHash: tx.hash });

  } catch (error) {
    console.error('Error in castVote API:', error);
    let errorMessage = 'An unknown server error occurred during voting.';
    if (error && typeof error === 'object' ) {
         if ('message' in error) errorMessage = error.message;
         if ('code' in error && (error.code === ethers.errors.CALL_EXCEPTION || error.code === 'CALL_EXCEPTION')) {
            errorMessage = "Vote failed on-chain. Possible reasons: Election ended, invalid candidate, or contract issue.";
            console.error("Blockchain CALL_EXCEPTION details:", error.reason, error.transaction);
        } else if ('code' in error && error.code === 'UNPREDICTABLE_GAS_LIMIT') {
             errorMessage = "Cannot estimate gas. Possible contract error or network issue.";
             console.error("Blockchain UNPREDICTABLE_GAS_LIMIT details:", error);
        } else if ('code' in error && error.code === 'NETWORK_ERROR') {
             errorMessage = "Network error communicating with the blockchain.";
             console.error("Blockchain NETWORK_ERROR details:", error);
        }
    }
    res.status(500).json({ error: errorMessage, details: error?.toString() });
  }
}