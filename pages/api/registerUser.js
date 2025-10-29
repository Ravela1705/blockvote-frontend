import * as admin from 'firebase-admin';

// --- Initialization Logic ---
// We still need admin for Firestore access
let adminApp;
const initializeFirebaseAdmin = () => {
    const existingApp = admin.apps.find(app => app.name === '[DEFAULT]');
    if (existingApp) { console.log("Firebase Admin SDK [DEFAULT] app already exists."); adminApp = existingApp; return adminApp; }
    let serviceAccount;
    try {
        if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON not set.");
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) throw new Error("Parsed service account JSON missing fields.");
    } catch (e) { console.error("CRITICAL ERROR parsing FIREBASE_SERVICE_ACCOUNT_JSON:", e.message); throw new Error("Could not parse Firebase service account JSON."); }
    try {
        console.log(`Initializing Firebase Admin SDK for project: ${serviceAccount.project_id}...`);
        adminApp = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) }, '[DEFAULT]');
        console.log("Firebase Admin SDK Initialized Successfully as [DEFAULT].");
        return adminApp;
    } catch (initError) { console.error("CRITICAL ERROR: Firebase Admin SDK Initialization Failed:", initError); throw new Error('Firebase Admin SDK could not be initialized.'); }
};
// --- End Initialization ---


// --- API Handler ---
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    let auth, db;
    try {
        const app = initializeFirebaseAdmin(); // Ensure initialized
        auth = admin.auth(app); // Needed for token verification
        db = admin.firestore(app); // Needed for database write
        if (!auth || !db) throw new Error("Failed to get Firebase services.");
    } catch (e) {
        console.error("Failed during Firebase service initialization in handler:", e.message);
        return res.status(500).json({ error: 'Server configuration error (Firebase init).' });
    }

    // --- *** UPDATED LOGIC *** ---
    // Expect UID and email from client after successful client-side auth
    // Expect Authorization header with ID token
    const { uid, email } = req.body;
    const token = req.headers.authorization?.split('Bearer ')[1];

    if (!uid || !email) {
        return res.status(400).json({ error: 'User ID and email are required.' });
    }
    if (!token) {
        return res.status(401).json({ error: 'Authorization token required.' });
    }
    // --- *** END UPDATED LOGIC *** ---


    try {
        // --- *** NEW: Verify Token *** ---
        // Verify the ID token passed from the client to ensure the request is legitimate
        console.log("Verifying ID token for UID:", uid);
        const decodedToken = await auth.verifyIdToken(token);

        // Check if the UID in the token matches the UID passed in the body
        if (decodedToken.uid !== uid) {
            console.error("Token UID mismatch:", decodedToken.uid, "vs", uid);
            return res.status(403).json({ error: 'Forbidden: Token does not match user ID.' });
        }
        console.log("ID token verified successfully for:", decodedToken.email);
        // --- *** END NEW *** ---

        // 2. Add the user to our "voters" list in Firestore
        // This part remains largely the same, but uses the UID from the verified token
        console.log("Adding user to Firestore:", decodedToken.uid);
        await db.collection('voters').doc(decodedToken.uid).set({
            email: email, // Save the email provided (should match token email)
            hasVoted_election_1: false
        });
        console.log("User added to Firestore successfully.");

        // 3. Send a success message back
        res.status(200).json({ success: true, uid: decodedToken.uid });

    } catch (error) {
        console.error('Error in registerUser (Firestore write):', error);
        let errorMessage = 'Failed to complete registration on server.';
        let statusCode = 500;
        // Check if it's a token verification error
        if (error instanceof Error && error.code?.startsWith('auth/')) {
            errorMessage = `Authentication error: ${error.message}`;
            statusCode = 401; // Or 403 Forbidden
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }
        res.status(statusCode).json({ error: errorMessage, code: error?.code });
    }
}