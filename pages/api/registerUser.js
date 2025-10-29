import * as admin from 'firebase-admin'; // Still needed for Firestore

// --- Firebase Admin Initialization (Only for Firestore) ---
// We keep this part to interact with the database, assuming it works for Firestore.
let adminApp;
const initializeFirebaseAdmin = () => {
    const existingApp = admin.apps.find(app => app.name === '[DEFAULT]');
    if (existingApp) {
        console.log("Firebase Admin SDK [DEFAULT] app already exists.");
        adminApp = existingApp; return adminApp;
    }
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


// --- NEW: Firebase Auth REST API Details ---
const FIREBASE_WEB_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY; // Get key from env
const FIREBASE_AUTH_SIGNUP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_WEB_API_KEY}`;
// --- End NEW Section ---


// --- API Handler ---
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    let db; // We only need Firestore from admin SDK now
    try {
        const app = initializeFirebaseAdmin(); // Ensure initialized
        db = admin.firestore(app); // Get firestore
        if (!db) throw new Error("Failed to get Firestore service.");
    } catch (e) {
        console.error("Failed during Firebase service initialization in handler:", e.message);
        return res.status(500).json({ error: 'Server configuration error (Firebase init).' });
    }

    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    try {
        // --- NEW: Use REST API to Create User ---
        console.log("Attempting to create user via REST API:", email);
        const restApiResponse = await fetch(FIREBASE_AUTH_SIGNUP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                password: password,
                returnSecureToken: false // We don't need the token here
            })
        });

        const restApiData = await restApiResponse.json();

        if (!restApiResponse.ok) {
            // Handle errors from the REST API
            const errorMsg = restApiData?.error?.message || 'Unknown Firebase Auth REST API error.';
            console.error('Firebase Auth REST API Error:', errorMsg, restApiData);
             // Map common error messages
             if (errorMsg === 'EMAIL_EXISTS') {
                throw new Error('This email address is already registered.');
             } else if (errorMsg === 'WEAK_PASSWORD : Password should be at least 6 characters') {
                 throw new Error('Password must be at least 6 characters long.');
             }
            throw new Error(`Firebase Auth REST API failed: ${errorMsg}`);
        }

        const userId = restApiData.localId; // Get the user ID from the REST response
        if (!userId) {
             throw new Error('Firebase Auth REST API did not return a user ID.');
        }
        console.log("User created successfully via REST API:", userId);
        // --- End NEW Section ---


        // 2. Add the user to our "voters" list in Firestore (using Admin SDK)
        console.log("Adding user to Firestore:", userId);
        await db.collection('voters').doc(userId).set({
            email: email, // Save email for reference
            hasVoted_election_1: false
        });
        console.log("User added to Firestore successfully.");

        // 3. Send a success message back
        // We don't have the full userRecord anymore, just the ID
        res.status(200).json({ success: true, uid: userId });

    } catch (error) {
        console.error('Error in registerUser execution:', error);
        let errorMessage = 'An unknown error occurred during registration.';
        let statusCode = 500;
        if (error instanceof Error) {
            errorMessage = error.message;
            // Set status code based on common errors
             if (errorMessage.includes("already registered") || errorMessage.includes("Password")) {
                 statusCode = 400;
             }
        }
        res.status(statusCode).json({ error: errorMessage });
    }
}