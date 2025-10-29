import * as admin from 'firebase-admin';

// --- NEW: Load Service Account from Environment Variable ---
let serviceAccount;
try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set.");
    }
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
} catch (e) {
    console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_JSON in getVoteDetails:", e);
    throw new Error("Could not parse Firebase service account JSON. Check .env.local format and Vercel environment variables.");
}
// --- End NEW section ---


// Initialize Firebase Admin (if it's not already)
if (!admin.apps.length) {
   try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount), // Use parsed serviceAccount
    });
    console.log("Firebase Admin SDK Initialized Successfully in getVoteDetails.");
  } catch (initError) {
    console.error("Firebase Admin SDK Initialization Failed in getVoteDetails:", initError);
     throw new Error('Firebase Admin SDK could not be initialized in getVoteDetails.');
  }
} else {
     console.log("Firebase Admin SDK already initialized.");
}

const auth = admin.auth();
const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Get the user's ID Token
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    // 2. Verify token
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // 3. Get the user's voter registration document
    const voterDocRef = db.collection('voters').doc(userId);
    const voterDoc = await voterDocRef.get();

    if (!voterDoc.exists) {
      // It's okay if the doc doesn't exist yet, just means they haven't registered/voted
       return res.status(200).json({
          hasVoted: false,
          hash: null
       });
      // return res.status(404).json({ error: 'Voter registration not found.' });
    }

    // 4. Send back their vote details
    const data = voterDoc.data();
    res.status(200).json({
      hasVoted: data.hasVoted_election_1 || false, // Default to false if field missing
      hash: data.voteHash_election_1 || null // Send the hash, or null if it doesn't exist
    });

  } catch (error) {
    console.error('Error in getVoteDetails:', error);
    let errorMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    res.status(500).json({ error: errorMessage });
  }
}