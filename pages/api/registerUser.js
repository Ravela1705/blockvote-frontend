import * as admin from 'firebase-admin'; // Corrected this line!

// Function to safely initialize Firebase Admin SDK
const initializeFirebaseAdmin = () => {
    // Check if the default app is already initialized
    if (admin.apps.length > 0) {
        console.log("Firebase Admin SDK already initialized.");
        return admin.app(); // Return the existing default app
    }

    // Load Service Account from Environment Variable
    let serviceAccount;
    try {
        if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
            throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set.");
        }
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        // Basic check for required fields in the parsed JSON
        if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
             throw new Error("Parsed service account JSON is missing required fields (project_id, client_email, private_key).");
        }

    } catch (e) {
        console.error("CRITICAL ERROR: Could not parse or validate FIREBASE_SERVICE_ACCOUNT_JSON:", e.message);
        // In a real app, you might want to alert monitoring here
        throw new Error("Could not parse Firebase service account JSON. Check .env.local format and Vercel environment variables.");
    }

    // Initialize the Admin SDK
    try {
        console.log("Initializing Firebase Admin SDK...");
        const app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            // Optionally specify databaseURL if needed, though usually inferred
            // databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
        });
        console.log("Firebase Admin SDK Initialized Successfully.");
        return app;
    } catch (initError) {
        console.error("CRITICAL ERROR: Firebase Admin SDK Initialization Failed:", initError);
        // Throw error or handle initialization failure
         throw new Error('Firebase Admin SDK could not be initialized.');
    }
};

// --- Get Firebase Services ---
// Ensure initialization happens before getting services
let auth, db;
try {
    const app = initializeFirebaseAdmin(); // Call the init function
    auth = admin.auth(app); // Get auth from the initialized app
    db = admin.firestore(app); // Get firestore from the initialized app
} catch (e) {
     console.error("Failed to get Firebase services after initialization attempt:", e.message);
     // If initialization failed, auth and db will be undefined.
     // The handler should ideally check for this, but throwing might be okay for now.
}


export default async function handler(req, res) {
  // We only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Check if auth/db failed to initialize
  if (!auth || !db) {
      console.error("Firebase services not available in handler.");
      return res.status(500).json({ error: 'Server configuration error. Firebase services unavailable.' });
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
    let errorMessage = 'An unknown error occurred during registration.';
    if (error && typeof error === 'object' ) {
        if ('message' in error) errorMessage = error.message;
        // Check for specific Firebase Auth error codes
        if ('code' in error) {
            if (error.code === 'auth/email-already-exists') {
                errorMessage = 'This email address is already registered.';
            } else if (error.code === 'auth/invalid-password') {
                errorMessage = 'Password must be at least 6 characters long.';
            } else if (error.code === 'auth/internal-error' && errorMessage.includes("configuration")) {
                 // Catch the specific error we were seeing
                 errorMessage = "Server configuration error communicating with Firebase Authentication.";
                 console.error("Potential Firebase Admin SDK config issue detected.");
            }
        }
    }
    // Return status 500 for server errors, 400 for client errors like duplicate email
    const statusCode = (errorMessage.includes("already registered") || errorMessage.includes("Password")) ? 400 : 500;
    res.status(statusCode).json({ error: errorMessage, details: error?.code }); // Send back code for debugging
  }
}