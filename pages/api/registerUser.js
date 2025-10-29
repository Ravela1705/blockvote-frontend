import * as admin from 'firebase-admin';

// --- Initialization Logic ---
let adminApp; // Store the initialized app instance

const initializeFirebaseAdmin = () => {
    // Use find to check if an app with the default name already exists
    const existingApp = admin.apps.find(app => app.name === '[DEFAULT]');
    if (existingApp) {
        console.log("Firebase Admin SDK [DEFAULT] app already exists.");
        adminApp = existingApp; // Use the existing default app
        return adminApp;
    }

    // Load Service Account from Environment Variable
    let serviceAccount;
    try {
        if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON not set.");
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) throw new Error("Parsed service account JSON missing fields.");
    } catch (e) {
        console.error("CRITICAL ERROR parsing FIREBASE_SERVICE_ACCOUNT_JSON:", e.message);
        throw new Error("Could not parse Firebase service account JSON.");
    }

    // Initialize the Admin SDK
    try {
        console.log(`Initializing Firebase Admin SDK for project: ${serviceAccount.project_id}...`);
        adminApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            // Explicitly setting projectId, although it should be inferred
            projectId: serviceAccount.project_id,
        }, '[DEFAULT]'); // Explicitly name it [DEFAULT]
        console.log("Firebase Admin SDK Initialized Successfully as [DEFAULT].");
        return adminApp;
    } catch (initError) {
        console.error("CRITICAL ERROR: Firebase Admin SDK Initialization Failed:", initError);
        throw new Error('Firebase Admin SDK could not be initialized.');
    }
};

// --- API Handler ---
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    let auth, db;
    try {
        const app = initializeFirebaseAdmin(); // Ensure initialized
        auth = admin.auth(app);
        db = admin.firestore(app);
        if (!auth || !db) throw new Error("Failed to get Firebase services.");

        // *** ADDED LOGGING ***
        console.log(`Firebase App Name: ${app.name}`);
        console.log(`Firebase App Project ID: ${app.options.projectId}`);
        // *** END LOGGING ***

    } catch (e) {
        console.error("Failed during Firebase service initialization in handler:", e.message);
        return res.status(500).json({ error: 'Server configuration error (Firebase init).' });
    }

    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    try {
        console.log("Attempting to create user:", email, `using Project ID: ${admin.app().options.projectId}`); // Log Project ID again
        const userRecord = await auth.createUser({ email, password, emailVerified: true });
        console.log("User created successfully:", userRecord.uid);

        console.log("Adding user to Firestore:", userRecord.uid);
        await db.collection('voters').doc(userRecord.uid).set({ email, hasVoted_election_1: false });
        console.log("User added to Firestore successfully.");

        res.status(200).json({ success: true, uid: userRecord.uid });
    } catch (error) {
        console.error('Error in registerUser execution:', error);
        let errorMessage = 'An unknown error occurred during registration.';
        let statusCode = 500;
        if (error instanceof Error && error.code) {
             switch (error.code) {
                case 'auth/email-already-exists': errorMessage = 'This email address is already registered.'; statusCode = 400; break;
                case 'auth/invalid-password': errorMessage = 'Password must be at least 6 characters long.'; statusCode = 400; break;
                case 'auth/internal-error':
                     if (error.message && error.message.includes("configuration")) { errorMessage = "Server configuration error communicating with Firebase Authentication."; console.error("Persistent 'no configuration' error detected."); }
                     else { errorMessage = `Firebase Auth internal error: ${error.message}`; }
                    break;
                 // Added specific check for the error we are seeing
                 case 'auth/configuration-not-found':
                    errorMessage = "Firebase Auth configuration not found. Check Vercel env vars and SDK initialization.";
                    console.error("CONFIRMATION: Received auth/configuration-not-found error code.");
                    break;
                 default: errorMessage = `Firebase Auth error (${error.code}): ${error.message}`;
            }
        } else if (error instanceof Error) { errorMessage = error.message; }
        res.status(statusCode).json({ error: errorMessage, code: error?.code });
    }
}