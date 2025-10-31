import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient'; // Import Supabase client
import { ethers } from 'ethers'; // Import ethers
import { Buffer } from 'buffer'; // Import Buffer
import { 
  Plus, Trash2, Loader2, AlertTriangle, CheckCircle, ListPlus, Clock, 
  LogIn, User, Shield, BarChart3, List, LogOut, 
  RefreshCw // <-- *** FIX: Imported RefreshCw ***
} from 'lucide-react';

// --- Reusable Components ---
const LoadingSpinner = () => <Loader2 size={16} className="animate-spin" />;

// --- Blockchain Helper ---
const getContract = () => {
    try {
        const abiBase64 = process.env.NEXT_PUBLIC_CONTRACT_ABI;
        if (!abiBase64) throw new Error("Contract ABI env var missing (NEXT_PUBLIC_CONTRACT_ABI)");
        const abiString = Buffer.from(abiBase64, 'base64').toString('utf-8');
        const contractABI = JSON.parse(abiString);
        const provider = new ethers.providers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
        const contract = new ethers.Contract(
            process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
            contractABI,
            provider
        );
        return contract;
    } catch (e) {
        console.error("CRITICAL ERROR getting contract instance:", e.message);
        return null;
    }
};

// --- Admin Login View ---
const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            // The onAuthStateChange listener in the main component will handle the redirect
        } catch (err) {
            setError("Invalid login credentials.");
            console.error("Admin Login Error:", err);
        }
        setLoading(false);
    };

    return (
        <div className="flex items-center justify-center min-h-screen w-full bg-gray-950 text-white">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md p-8 bg-gray-900 rounded-2xl shadow-2xl shadow-indigo-500/10 border border-gray-800"
            >
                <div className="flex justify-center mb-6">
                    <Shield className="w-12 h-12 text-indigo-500" />
                </div>
                <h2 className="text-3xl font-bold text-center text-white mb-2">Admin Panel</h2>
                <p className="text-center text-gray-400 mb-8">Please log in to continue.</p>

                {error && (
                    <div className="p-3 mb-4 text-sm text-red-200 bg-red-900/50 border border-red-700 rounded-lg flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-2" /> {error}
                    </div>
                )}

                <form onSubmit={handleLogin}>
                    <div className="mb-4">
                        <label className="block mb-2 text-sm font-medium text-gray-300">Admin Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            required
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block mb-2 text-sm font-medium text-gray-300">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-indigo-500/30 transform hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center disabled:opacity-50"
                    >
                        {loading ? <LoadingSpinner /> : <LogIn className="w-5 h-5 mr-2" />}
                        Login
                    </button>
                </form>
                {/* Removed the confusing note about student registration */}
            </motion.div>
        </div>
    );
};

// --- View: Create Election ---
const CreateElectionView = () => {
    const [electionTitle, setElectionTitle] = useState('');
    const [candidates, setCandidates] = useState(['', '']);
    const [duration, setDuration] = useState(24);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleCandidateChange = (index, value) => {
        const newCandidates = [...candidates];
        newCandidates[index] = value;
        setCandidates(newCandidates);
    };
    const addCandidateField = () => { setCandidates([...candidates, '']); };
    const removeCandidateField = (index) => { if (candidates.length > 2) { const newCandidates = candidates.filter((_, i) => i !== index); setCandidates(newCandidates); } };

    const handleCreateElection = async (e) => {
        e.preventDefault();
        setLoading(true); setMessage({ type: '', text: '' });
        const filledCandidates = candidates.map(c => c.trim()).filter(c => c !== '');
        if (filledCandidates.length < 2) { setMessage({ type: 'error', text: 'Please enter at least two candidate names.' }); setLoading(false); return; }
        if (duration <= 0) { setMessage({ type: 'error', text: 'Duration must be a positive number of hours.' }); setLoading(false); return; }

        try {
            const response = await fetch('/api/createElection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: electionTitle.trim(), candidates: filledCandidates, durationHours: Number(duration) }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to create election.');
            setMessage({ type: 'success', text: `Election created! Tx Hash: ${data.transactionHash.substring(0,10)}... Election ID: ${data.electionId}` });
            setElectionTitle(''); setCandidates(['', '']); setDuration(24);
        } catch (err) {
            let errorMessage = 'An unknown error occurred.';
            if (err instanceof Error) { errorMessage = err.message; }
            setMessage({ type: 'error', text: errorMessage });
        }
        setLoading(false);
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="text-3xl font-bold mb-6 text-white">Create New Election</h2>
            {message.text && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`p-4 mb-6 rounded-lg ${message.type === 'success' ? 'bg-green-800 border-green-600' : 'bg-red-800 border-red-600'} border text-white flex items-start gap-2`}>
                    {message.type === 'success' ? <CheckCircle className="flex-shrink-0 mt-1" /> : <AlertTriangle className="flex-shrink-0 mt-1" />}
                    <span>{message.text}</span>
                </motion.div>
            )}
            <form onSubmit={handleCreateElection} className="bg-gray-800 p-6 rounded-lg border border-gray-700/50 shadow-lg space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="electionTitle">Election Title</label>
                    <input type="text" id="electionTitle" value={electionTitle} onChange={(e) => setElectionTitle(e.target.value)} className="w-full px-4 py-3 bg-gray-900 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g., Student Body President 2026" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Candidates (Minimum 2)</label>
                    <div className="space-y-3">
                        {candidates.map((candidate, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <input type="text" value={candidate} onChange={(e) => handleCandidateChange(index, e.target.value)} className="flex-1 px-4 py-3 bg-gray-900 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder={`Candidate ${index + 1} Name`} required={index < 2} />
                                {candidates.length > 2 && ( <button type="button" onClick={() => removeCandidateField(index)} className="p-2 text-gray-400 hover:text-red-400" title="Remove Candidate"><Trash2 size={18} /></button> )}
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={addCandidateField} className="mt-3 flex items-center gap-2 px-3 py-2 text-sm text-indigo-300 border border-indigo-300/50 rounded-lg hover:bg-indigo-900/50 transition-colors"><Plus size={16} /><span>Add Candidate</span></button>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="duration">Election Duration (Hours)</label>
                    <div className="relative"><Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" /><input type="number" id="duration" value={duration} onChange={(e) => setDuration(e.target.value)} min="1" step="1" className="w-full pl-10 pr-4 py-3 bg-gray-900 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required /></div>
                </div>
                <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 px-5 py-3 text-white font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-colors disabled:opacity-50">
                    {loading ? <LoadingSpinner /> : <ListPlus size={20} />}
                    <span>{loading ? 'Creating Election...' : 'Create Election'}</span>
                </button>
            </form>
        </motion.div>
    );
};

// --- View: View Results ---
const ViewResultsView = () => {
    const [allElections, setAllElections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchAllElectionData = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const response = await fetch('/api/getElections'); // Call our own API
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to fetch elections.');
            }
            const data = await response.json();
            setAllElections(data.allElections || []);
        } catch (err) {
            console.error("Failed to fetch all elections:", err);
            setError(err.message || 'Could not load election data.');
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchAllElectionData(); // Fetch on component mount
    }, [fetchAllElectionData]);

    if (loading) {
        return <div className="p-8 flex justify-center items-center"><LoadingSpinner /> <span className="ml-2">Loading All Elections...</span></div>;
    }
    if (error) {
        return <div className="p-8 text-center text-red-400">{error}</div>;
    }
    if (allElections.length === 0) {
        return <div className="p-8 text-center text-gray-400">No elections found. Create one!</div>;
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-white">Election History & Results</h2>
                <button onClick={fetchAllElectionData} disabled={loading} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    <span>Refresh</span>
                </button>
            </div>

            {allElections.map(election => (
                <div key={election.id} className="bg-gray-800 p-6 rounded-lg border border-gray-700/50 shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-white">{election.title} (ID: {election.id})</h3>
                        <div className={`p-2 px-3 rounded-full text-sm font-medium ${ election.status === 'Active' ? 'bg-green-900/50 text-green-300' : election.status === 'Ended' ? 'bg-red-900/50 text-red-300' : 'bg-yellow-900/50 text-yellow-300' }`}>
                            Status: {election.status}
                        </div>
                    </div>
                    
                    <p className="text-xs text-gray-400 mb-1">Started: {new Date(election.startTime * 1000).toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mb-6">Ends: {new Date(election.endTime * 1000).toLocaleString()}</p>

                    <div className="mb-6 space-y-4">
                        {(election.candidates || []).map(candidate => {
                            const percentage = election.totalVotes > 0 ? (candidate.votes / election.totalVotes) * 100 : 0;
                            return (
                                <div key={candidate.id}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-semibold text-white">{candidate.name} (ID: {candidate.id})</span>
                                        <span className="text-gray-300">{candidate.votes} Votes</span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-4">
                                        <motion.div 
                                          className="bg-gradient-to-r from-purple-500 to-indigo-600 h-4 rounded-full" 
                                          initial={{ width: 0 }} 
                                          animate={{ width: `${percentage}%` }} 
                                          transition={{ duration: 1, ease: 'easeOut' }} 
                                        />
                                    </div>
                                </div>
                            );
                        })}
                         {(!election.candidates || election.candidates.length === 0) && <p className="text-gray-400">No candidates found for this election.</p>}
                    </div>
                    <div className="border-t border-gray-700 pt-4 flex justify-between">
                        <span className="text-lg font-bold text-white">Total Votes</span>
                        <span className="text-lg font-bold text-white">{election.totalVotes}</span>
                    </div>
                </div>
            ))}
        </motion.div>
    );
};


// --- Main Admin Dashboard ---
const AdminDashboard = ({ adminEmail }) => {
    const [view, setView] = useState('results'); // Default to 'results'

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    return (
        <div className="flex min-h-screen w-full bg-gray-950 text-white font-inter">
            {/* Sidebar */}
            <nav className="w-64 h-screen bg-gray-900 border-r border-gray-800 flex flex-col p-5">
                <div className="flex items-center space-x-2 mb-10">
                    <Shield className="w-8 h-8 text-indigo-500" />
                    <span className="text-2xl font-bold text-white">Admin</span>
                </div>
                <ul className="space-y-2">
                    <li>
                        <button onClick={() => setView('results')} className={`flex items-center w-full px-4 py-3 rounded-lg transition-colors duration-200 ${view === 'results' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}><BarChart3 className="w-5 h-5 mr-3" /><span>View Results</span></button>
                    </li>
                    <li>
                        <button onClick={() => setView('create')} className={`flex items-center w-full px-4 py-3 rounded-lg transition-colors duration-200 ${view === 'create' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}><ListPlus className="w-5 h-5 mr-3" /><span>Create Election</span></button>
                    </li>
                </ul>
                <div className="mt-auto">
                    <p className="text-xs text-gray-500 mb-2">Logged in as:</p>
                    <p className="text-sm text-indigo-300 break-words mb-4">{adminEmail}</p>
                    <button onClick={handleLogout} className="flex items-center w-full px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors">
                        <LogOut className="w-5 h-5 mr-3" />
                        <span>Logout</span>
                    </button>
                </div>
            </nav>
            
            {/* Main Content */}
            <main className="flex-1 h-screen overflow-y-auto p-10">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={view}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        {view === 'create' && <CreateElectionView />}
                        {view === 'results' && <ViewResultsView />}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
};

// --- Main Page Component ---
export default function AdminPage() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        // --- *** THIS IS THE NEW, CORRECT LOGIC *** ---
        // This function checks if the logged-in user is in our new 'admins' table
        const checkAdmin = async (user) => {
            if (!user) {
                setIsAdmin(false);
                return;
            }
            try {
                // Query the 'admins' table for a row where the id matches the logged-in user's id
                const { data, error } = await supabase
                    .from('admins')
                    .select('id')
                    .eq('id', user.id)
                    .single(); // Get just one row
                
                if (error && error.code !== 'PGRST116') { // PGRST116 = row not found
                    console.error("Error checking admin status:", error);
                    setIsAdmin(false);
                } else if (data) {
                    // User was found in the 'admins' table!
                    console.log("Admin verified:", data);
                    setIsAdmin(true);
                } else {
                    // User was not found in 'admins' table
                    console.log("User is not an admin.");
                    setIsAdmin(false);
                }
            } catch (err) {
                console.error("Error during admin check:", err);
                setIsAdmin(false);
            }
        };
        // --- *** END NEW LOGIC *** ---

        
        // 1. Get initial session and check admin status
        supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
            console.log("Admin Page: Initial session check", initialSession?.user?.email);
            setSession(initialSession);
            await checkAdmin(initialSession?.user); // Wait for the admin check
            setLoading(false);
        });

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (_event, currentSession) => {
            console.log("Admin Page: Auth state changed", _event, currentSession?.user?.email);
            setSession(currentSession);
            await checkAdmin(currentSession?.user); // Wait for the admin check
            setLoading(false);
          }
        );

        return () => { subscription?.unsubscribe(); };
    }, []);

    if (loading) {
        return <div className="flex items-center justify-center h-screen w-full bg-gray-950"><LoadingSpinner /><span className="ml-2 text-white">Loading Admin...</span></div>;
    }

    if (!session || !isAdmin) {
        // If there is a session but it's not the admin, show access denied
        if (session && !isAdmin) {
            return (
                <div className="flex flex-col items-center justify-center h-screen w-full bg-gray-950 text-white">
                    <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                    <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
                    <p className="text-gray-400">You are not authorized to view this page.</p>
                    <button onClick={async () => await supabase.auth.signOut()} className="mt-6 px-4 py-2 bg-indigo-600 rounded-lg">Logout</button>
                </div>
            );
        }
        // If no session, show the login
        return <AdminLogin />;
    }

    // If session exists AND user is admin, show the dashboard
    return <AdminDashboard adminEmail={session.user.email} />;
}