import * as admin from 'firebase-admin';

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

export default async function handler(req, res) {
  // We only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // 1. Create the user in Firebase Auth
    console.log("Attempting to create user:", email);
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      emailVerified: true, // Auto-verify for our demo
    });
    console.log("User created successfully:", userRecord.uid);

    // 2. Add the user to our "voters" list in Firestore
    console.log("Adding user to Firestore:", userRecord.uid);
    await db.collection('voters').doc(userRecord.uid).set({
      email: email,
      hasVoted_election_1: false, // We'll hardcode one election for now
    });
    console.log("User added to Firestore successfully.");

    // 3. Send a success message back
    res.status(200).json({ success: true, uid: userRecord.uid });
  } catch (error) {
    console.error('Error in registerUser:', error);
    let errorMessage = 'An unknown error occurred.';
    if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = error.message;
        if ('code' in error && error.code === 'auth/email-already-exists') {
            errorMessage = 'This email address is already registered.';
        } else if ('code' in error && error.code === 'auth/invalid-password') {
            errorMessage = 'Password must be at least 6 characters long.';
        }
    }
    res.status(500).json({ error: errorMessage, details: error });
  }
}