import * as admin from 'firebase-admin';

// Import our secret key
const serviceAccount = require('../../serviceAccountKey.json');

// Initialize Firebase Admin (if it's not already)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const auth = admin.auth();
const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Get the user's ID Token from the "Authorization" header
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    // 2. Verify the token to securely get the user's ID
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // 3. Get the user's voter registration document
    const voterDocRef = db.collection('voters').doc(userId);
    const voterDoc = await voterDocRef.get();

    if (!voterDoc.exists) {
      return res.status(404).json({ error: 'Voter registration not found.' });
    }

    // 4. Send back their vote details (the hash)
    const data = voterDoc.data();
    res.status(200).json({ 
      hasVoted: data.hasVoted_election_1,
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
