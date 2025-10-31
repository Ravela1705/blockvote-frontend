import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home as HomeIcon, Vote, BarChart3, ShieldCheck, Users, Menu, X, FileText,
  Sparkles, Loader2, HelpCircle, LogIn, LogOut, UserPlus, AlertTriangle, CheckCircle, RefreshCw, ChevronDown
} from 'lucide-react';
// Import Supabase client
import { createClient } from '@supabase/supabase-js'
// Import ethers
import { ethers } from 'ethers'; // For blockchain interaction
// Import Buffer for robust Base64 decoding
import { Buffer } from 'buffer';

// --- 1. SUPABASE CLIENT INITIALIZATION ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("CRITICAL ERROR: Supabase URL or Anon Key is missing. Check .env.local and Vercel environment variables.")
}
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// --- 2. GEMINI API CONFIGURATION ---
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

// Gemini API Helper Function
const callGemini = async (prompt, retries = 3, delay = 1000) => {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_KEY" || !GEMINI_API_KEY.trim()) { // Check placeholder or empty
         console.warn("Gemini API key not set in environment variables (NEXT_PUBLIC_GEMINI_API_KEY).");
         return "Gemini API key not set.";
    }
     try { const payload = { contents: [{ parts: [{ text: prompt }] }] }; const response = await fetch(GEMINI_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (!response.ok) { if ((response.status === 429 || response.status >= 500) && retries > 0) { await new Promise(resolve => setTimeout(resolve, delay)); return callGemini(prompt, retries - 1, delay * 2); } throw new Error(`API Error: ${response.statusText}`); } const result = await response.json(); const candidate = result.candidates?.[0]; if (candidate?.content?.parts?.[0]?.text) return candidate.content.parts[0].text; console.warn("Unexpected Gemini response:", result); return "Could not generate response."; } catch (error) { console.error("Error calling Gemini:", error); if (retries > 0) { await new Promise(resolve => setTimeout(resolve, delay)); return callGemini(prompt, retries - 1, delay * 2); } return `Error: ${error.message}.`; }
};

// --- 3. BLOCKCHAIN HELPER ---
/**
 * Gets a read-only provider and contract instance.
 * Decodes the ABI from Base64.
 */
const getContract = () => {
    try {
        const abiBase64 = process.env.NEXT_PUBLIC_CONTRACT_ABI;
        if (!abiBase64) throw new Error("Contract ABI env var missing (NEXT_PUBLIC_CONTRACT_ABI)");
        
        // --- *** THIS IS THE FIX *** ---
        // Use Buffer for robust decoding. This works in both Node.js (server)
        // and the browser (because we imported it at the top of the file).
        const abiString = Buffer.from(abiBase64, 'base64').toString('utf-8');
        // --- *** END FIX *** ---
          
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
        return null; // Return null if setup fails
    }
};

// --- Reusable Components ---
const LoadingSpinner = () => <Loader2 size={16} className="animate-spin" />;

// --- Login View (Using Supabase) ---
const LoginView = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
        let authResponse;
        if (isRegistering) {
            console.log("Attempting Supabase sign up for:", email);
            authResponse = await supabase.auth.signUp({ email, password });
            console.log("Supabase signup response:", authResponse);
            if (authResponse.error) throw authResponse.error;
            
            const user = authResponse.data?.user;
            if (!user) {
                 if(authResponse.error?.message.includes("confirmation")) {
                    setSuccessMessage("Registration submitted! Please check email.");
                    setLoading(false);
                    return;
                 }
                 throw new Error("Signup failed silently or user data was not returned.");
            }

            console.log("Calling backend DB record for:", user.id);
            const backendResponse = await fetch('/api/registerUser', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, email: user.email }),
            });
            const backendData = await backendResponse.json();
            if (!backendResponse.ok) {
                console.error("Backend DB creation failed:", backendData.error);
                await supabase.auth.signOut();
                throw new Error(backendData.error || 'Failed registration.');
            }
            console.log("Backend DB creation successful.");

            if(authResponse.data.session) {
                setSuccessMessage("Registration successful! Logging in...");
            } else {
                 setSuccessMessage("Registration successful! Please check your email to confirm your account.");
                 setLoading(false);
            }
            
        } else {
            console.log("Attempting Supabase sign in for:", email);
            authResponse = await supabase.auth.signInWithPassword({ email, password });
            console.log("Supabase signin response:", authResponse);
            if (authResponse.error) throw authResponse.error;
        }
    } catch (err) {
        console.error("Supabase Auth Error:", err);
        let errorMessage = err.message || 'Unknown error.';
        if (errorMessage.includes("already registered") || errorMessage.includes("unique constraint")) { errorMessage = "Email already registered."; } else if (errorMessage.includes("Invalid login credentials")) { errorMessage = "Invalid email or password."; } else if (errorMessage.includes("Password should be at least 6 characters")) { errorMessage = "Password minimum 6 characters."; } else if (errorMessage.includes("valid email")) { errorMessage = "Please enter a valid email."; } else if (errorMessage.includes("NetworkError")) { errorMessage = "Network error."; }
        setError(errorMessage);
    }
    if (error || successMessage.includes("check your email")) {
        setLoading(false);
    }
  };

  return ( <div className="flex items-center justify-center min-h-screen w-full bg-gray-950"> <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md p-8 m-4 bg-gray-900 border border-gray-700/50 rounded-lg shadow-2xl"> <h1 className="text-3xl font-bold text-white mb-4 text-center flex items-center justify-center"><FileText className="text-indigo-400 mr-2" />BlockVote</h1> <p className="text-gray-400 text-center mb-6">{isRegistering ? 'Create voter account' : 'Student Voter Login'}</p> <form onSubmit={handleAuth}> <div className="mb-4"><label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="email">Student ID (Email)</label><input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 bg-gray-800 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g., 12345@college.edu" required /></div> <div className="mb-6"><label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="password">Password</label><input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 bg-gray-800 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="••••••••" required /></div> {error && ( <div className="p-3 mb-4 text-sm text-red-200 bg-red-900/50 border border-red-700 rounded-lg flex items-center"><AlertTriangle className="w-4 h-4 mr-2" /> {error}</div> )} {successMessage && ( <div className="p-3 mb-4 text-sm text-green-200 bg-green-900/50 border border-green-700 rounded-lg flex items-center"><CheckCircle className="w-4 h-4 mr-2" /> {successMessage}</div> )} <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 px-5 py-3 text-white font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-colors disabled:opacity-50"> {loading ? <LoadingSpinner /> : (isRegistering ? <UserPlus size={20} /> : <LogIn size={20} />)} <span>{loading ? 'Working...' : (isRegistering ? 'Register' : 'Login')}</span> </button> </form> <p className="text-center text-sm text-gray-400 mt-6">{isRegistering ? 'Already have account?' : "Don't have account?"}<button onClick={() => { setIsRegistering(!isRegistering); setError(''); setSuccessMessage(''); }} className="font-medium text-indigo-400 hover:text-indigo-300 ml-1">{isRegistering ? 'Login' : 'Register (Demo)'}</button></p> </motion.div> </div> );
};

// --- Other Components (Sidebar, Header...) ---
const Sidebar = ({ view, setView, isMobileMenuOpen, setIsMobileMenuOpen }) => {
    const navItems = [ { name: 'home', icon: HomeIcon, view: 'home' }, { name: 'elections', icon: Vote, view: 'elections' }, { name: 'results', icon: BarChart3, view: 'results' }, { name: 'verification', icon: ShieldCheck, view: 'verification' }, ];
    const NavLink = ({ item }) => ( <button onClick={() => { setView(item.view); if (isMobileMenuOpen) setIsMobileMenuOpen(false); }} className={`flex items-center w-full px-4 py-3 text-left ${view === item.view ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'} transition-colors duration-200 rounded-lg`} > <item.icon size={20} className="mr-3" /> <span className="font-medium">{item.name}</span> </button> );
    return ( <> {/* Mobile Menu */} <AnimatePresence>{isMobileMenuOpen && ( <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileMenuOpen(false)} /> )}</AnimatePresence> <motion.div initial={{ x: '-100%' }} animate={{ x: isMobileMenuOpen ? '0%' : '-100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="fixed top-0 left-0 h-full w-64 bg-gray-900 border-r border-gray-700/50 p-4 z-40 lg:hidden"> <h1 className="text-2xl font-bold text-white mb-6 flex items-center"><FileText className="text-indigo-400 mr-2" />BlockVote</h1> <nav className="flex flex-col gap-2">{navItems.map(item => <NavLink key={item.name} item={item} />)}</nav> </motion.div> {/* Desktop Sidebar */} <div className="hidden lg:flex lg:flex-col lg:w-64 h-full min-h-screen bg-gray-900 border-r border-gray-700/50 p-5"> <h1 className="text-3xl font-bold text-white mb-8 flex items-center"><FileText className="text-indigo-400 mr-2" />BlockVote</h1> <nav className="flex flex-col gap-2">{navItems.map(item => <NavLink key={item.name} item={item} />)}</nav> <div className="mt-auto text-gray-500 text-xs"><p>© 2025 BlockVote. All rights reserved.</p></div> </div> </> );
};
const Header = ({ view, setIsMobileMenuOpen, userEmail }) => {
    const viewTitles = { home: 'Dashboard', elections: 'Active Elections', results: 'Live Results', verification: 'Verify Vote' };
    const handleLogout = async () => { console.log("Logout button clicked"); const { error } = await supabase.auth.signOut(); if (error) console.error("Error signing out:", error); };
    return ( <header className="flex items-center justify-between w-full h-20 px-4 md:px-8 border-b border-gray-700/50"> <div className="flex items-center gap-2"> <button className="lg:hidden p-2 -ml-2 text-gray-300 hover:text-white" onClick={() => setIsMobileMenuOpen(true)}> <Menu size={24} /> </button> <h2 className="text-xl md:text-2xl font-semibold text-white">{viewTitles[view]}</h2> </div> <div className="flex items-center gap-4"> <span className="hidden sm:block text-sm text-gray-400">{userEmail}</span> <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gray-700 rounded-lg shadow-md hover:bg-gray-600 transition-all duration-300 ease-in-out" > <LogOut size={18} /> <span>Logout</span> </button> </div> </header> );
};

// --- ElectionView (Multi-Election) ---
const ElectionView = ({ allElections, voterData, onVoteCasted }) => {
    const [selectedCandidate, setSelectedCandidate] = useState({});
    const [voteLoading, setVoteLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '', electionId: null });

    const handleVote = async (electionId, candidateId) => {
        setVoteLoading(true); setMessage({ type: '', text: '', electionId: electionId });
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) { setMessage({ type: 'error', text: "Auth error.", electionId: electionId }); setVoteLoading(false); return; }
        const token = session.access_token;
        try {
            const response = await fetch('/api/castVote', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ electionId, candidateId }), });
            const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Vote failed.');
            setMessage({ type: 'success', text: `Success! Vote recorded. TX Hash: ${data.transactionHash.substring(0, 10)}...`, electionId: electionId });
            if (onVoteCasted) onVoteCasted(); 
        } catch (err) { let errorMessage = err.message || 'Unknown error.'; setMessage({ type: 'error', text: errorMessage, electionId: electionId }); }
        setVoteLoading(false);
    };

    if (!allElections || allElections.length === 0) {
        return <div className="p-8 text-center text-gray-400">No elections are available at this time.</div>;
    }

    return (
        <div className="p-4 md:p-8 space-y-8">
            {allElections.map((election) => {
                const hasVoted = voterData && voterData[election.id];
                const isVoteDisabled = voteLoading || hasVoted || election.status !== 'Active';
                const currentSelection = selectedCandidate[election.id];

                return (
                    <motion.div key={election.id} className="bg-gray-800 p-6 rounded-lg border border-gray-700/50 shadow-lg" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} >
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-semibold text-white">{election.title} (ID: {election.id})</h2>
                            <div className={`p-2 px-3 rounded-full text-sm font-medium ${ election.status === 'Active' ? 'bg-green-900/50 text-green-300' : election.status === 'Ended' ? 'bg-red-900/50 text-red-300' : 'bg-yellow-900/50 text-yellow-300' }`}> Status: {election.status} </div>
                        </div>
                        {election.status === 'Active' && <p className="text-xs text-gray-400 mb-4">Ends: {new Date(election.endTime * 1000).toLocaleString()}</p>}
                        {election.status === 'Upcoming' && <p className="text-xs text-gray-400 mb-4">Starts: {new Date(election.startTime * 1000).toLocaleString()}</p>}
                        {election.status === 'Ended' && <p className="text-xs text-gray-400 mb-4">Ended: {new Date(election.endTime * 1000).toLocaleString()}</p>}

                        {message.electionId === election.id && message.text && ( <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`p-4 mb-4 rounded-lg ${message.type === 'success' ? 'bg-green-800 border-green-600' : 'bg-red-800 border-red-600'} border text-white`} > {message.type === 'success' ? <CheckCircle className="inline mr-2" /> : <AlertTriangle className="inline mr-2" />} {message.text} </motion.div> )}
                        <div className="flex flex-col gap-3">
                            {(election.candidates || []).map(candidate => (
                                <button key={candidate.id} onClick={() => setSelectedCandidate({ ...selectedCandidate, [election.id]: candidate.id })} disabled={election.status !== 'Active'} className={`w-full text-left p-4 rounded-lg transition-all ${ currentSelection === candidate.id && election.status === 'Active' ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' : 'bg-gray-700 text-gray-200 hover:bg-gray-600' } disabled:opacity-50 disabled:cursor-not-allowed`} >
                                    {candidate.name}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => { if(currentSelection) { handleVote(election.id, currentSelection) } }} disabled={!currentSelection || isVoteDisabled} className="w-full mt-5 px-5 py-3 text-white font-semibold bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" >
                            {voteLoading && message.electionId === election.id ? <LoadingSpinner /> : (hasVoted ? <CheckCircle /> : <Vote size={18} />)}
                            <span> {hasVoted ? 'Voted Successfully' : voteLoading && message.electionId === election.id ? 'Submitting...' : election.status !== 'Active' ? `Election ${election.status}` : !currentSelection ? 'Select a Candidate' : 'Cast Your Vote'} </span>
                        </button>
                    </motion.div>
                );
            })}
        </div>
    );
};

// --- DashboardHome (Multi-Election) ---
const DashboardHome = ({ allElections, voterData }) => {
    const totalElections = allElections.length;
    const totalCandidates = allElections.reduce((acc, election) => acc + (election.candidates ? election.candidates.length : 0), 0);
    const votesCastByUser = voterData ? Object.keys(voterData).length : 0;
    const cards = [
        { title: 'Total Elections', value: totalElections, icon: FileText, color: 'text-blue-400' },
        { title: 'Total Candidates', value: totalCandidates, icon: Users, color: 'text-green-400' },
        { title: 'My Votes Cast', value: votesCastByUser, icon: CheckCircle, color: 'text-purple-400' },
    ];
    return (
     <div className="p-4 md:p-8">
      <motion.div className="mb-8 p-6 bg-gradient-to-r from-gray-800 to-gray-800/50 border border-gray-700/50 rounded-lg shadow-lg" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <h3 className="text-2xl font-bold text-white mb-2">Welcome to BlockVote</h3>
        <p className="text-gray-300">The secure, transparent, and decentralized voting platform.</p>
      </motion.div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card, i) => (
          <motion.div key={card.title} className="bg-gray-800 p-6 rounded-lg border border-gray-700/50 shadow-lg" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + i * 0.1 }}>
            <div className="flex items-center justify-between"><span className={`font-semibold text-gray-400`}>{card.title}</span><card.icon size={24} className={card.color} /></div>
            <p className="text-3xl font-bold text-white mt-4">{card.value}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};


// --- ResultsView (Multi-Election) ---
const ResultsView = ({ allElections, onRefresh }) => {
    const [selectedElectionId, setSelectedElectionId] = useState(null);
    const [analysis, setAnalysis] = useState('');
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);
    
    const selectedElection = allElections.find(e => e.id === selectedElectionId);

    useEffect(() => {
        if (!selectedElectionId && allElections.length > 0) {
            setSelectedElectionId(allElections[0].id); // Default to latest (which is first in reversed list)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allElections]); // Only depend on allElections

    const getAiAnalysis = async () => {
        if (!selectedElection) return;
        setLoadingAnalysis(true); setAnalysis('');
        const resultsString = selectedElection.candidates.map(c => `${c.name}: ${c.votes} votes`).join(', ');
        const prompt = `You are a neutral election observer. Provide a one-paragraph summary for the election '${selectedElection.title}' with the following results: ${resultsString}. State who the winner is (or if it's a tie) and the total votes cast.`;
        const geminiResponse = await callGemini(prompt);
        setAnalysis(geminiResponse); setLoadingAnalysis(false);
    };

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-semibold text-white">Live Results</h3>
                <button onClick={onRefresh} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                    <RefreshCw size={16} />
                    <span>Refresh All</span>
                </button>
            </div>
            
            <div className="mb-6">
                <label htmlFor="election-select" className="block text-sm font-medium text-gray-300 mb-2">Select Election:</label>
                <select
                    id="election-select"
                    value={selectedElectionId || ''}
                    onChange={(e) => {
                        setSelectedElectionId(Number(e.target.value));
                        setAnalysis('');
                    }}
                    className="w-full px-4 py-3 bg-gray-800 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="" disabled>-- Select an election --</option>
                    {allElections.map(election => (
                        <option key={election.id} value={election.id}>{election.title} (ID: {election.id})</option>
                    ))}
                </select>
            </div>

            {selectedElection ? (
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700/50 shadow-lg">
                    <h4 className="text-xl font-semibold text-white mb-4">{selectedElection.title}</h4>
                    <div className="mb-6 space-y-4">
                        {selectedElection.candidates.length === 0 && <p className="text-gray-400 text-center">No candidates found.</p>}
                        {(selectedElection.candidates || []).map(candidate => {
                            const percentage = selectedElection.totalVotes > 0 ? (candidate.votes / selectedElection.totalVotes) * 100 : 0;
                            return (
                                <div key={candidate.id}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-semibold text-white">{candidate.name}</span>
                                        <span className="text-gray-300">{candidate.votes} Votes</span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-4">
                                        <motion.div className="bg-gradient-to-r from-purple-500 to-indigo-600 h-4 rounded-full" initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 1, ease: 'easeOut' }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="border-t border-gray-700 pt-4 flex justify-between">
                        <span className="text-lg font-bold text-white">Total Votes</span>
                        <span className="text-lg font-bold text-white">{selectedElection.totalVotes}</span>
                    </div>
                </div>
            ) : (
                <div className="text-center text-gray-400 p-6">{allElections.length > 0 ? 'Select election to view results.' : 'No results available.'}</div>
            )}

            <div className="mt-8">
                <button
                    onClick={getAiAnalysis}
                    disabled={loadingAnalysis || !selectedElection || (selectedElection && selectedElection.totalVotes === 0)}
                    className="flex items-center justify-center gap-2 px-5 py-3 text-white font-semibold bg-gradient-to-r from-teal-500 to-cyan-600 rounded-lg hover:from-teal-600 hover:to-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loadingAnalysis ? <LoadingSpinner /> : <Sparkles size={18} />}
                    <span>{loadingAnalysis ? 'Generating...' : '✨ Generate AI Analysis'}</span>
                </button>
                <AnimatePresence>
                    {analysis && ( <motion.div initial={{ opacity: 0, height: 0, y: 10 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0, y: 10 }} transition={{ duration: 0.3 }} className="mt-4 p-4 bg-gray-900 border border-gray-700 rounded-lg" > <p className="text-gray-200 whitespace-pre-wrap">{analysis}</p> </motion.div> )}
                </AnimatePresence>
            </div>
        </div>
    );
};


// --- VerificationView (Multi-Election) ---
const VerificationView = ({ voterData }) => {
    const [explanation, setExplanation] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedElectionId, setSelectedElectionId] = useState('');
    const [txHash, setTxHash] = useState('');
    
    const votedElectionIds = voterData ? Object.keys(voterData) : [];

    const handleSelectChange = (e) => {
        const electionId = e.target.value;
        setSelectedElectionId(electionId);
        if (electionId && voterData[electionId]) {
            setTxHash(voterData[electionId]);
        } else {
            setTxHash('');
        }
    };

    const handleVerify = () => { /* ... */ if (!txHash.startsWith('0x') || txHash.length !== 66) { console.warn("Invalid TX Hash format"); return; } const url = `https://www.oklink.com/amoy/tx/${txHash}`; window.open(url, '_blank'); };
    const getExplanation = async () => { /* ... */ setLoading(true); setExplanation(''); const prompt = ` In simple terms, what is a 'transaction hash' (or 'TX Hash') in the context of a blockchain voting app? Explain why a user would use it to verify their vote. Keep it to 2-3 sentences, easy for a non-technical person to understand. `; const generatedText = await callGemini(prompt); setExplanation(generatedText); setLoading(false); };

    return (
        <div className="p-4 md:p-8">
            <motion.div
                className="bg-gray-800 p-6 md:p-8 rounded-lg border border-gray-700/50 shadow-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-semibold text-white">Verify Your Vote</h3>
                    <button onClick={getExplanation} disabled={loading} className="flex items-center gap-2 px-3 py-2 text-sm text-cyan-300 border border-cyan-300/50 rounded-lg hover:bg-cyan-900/50 transition-colors disabled:opacity-50" >
                        {loading ? <LoadingSpinner /> : <HelpCircle size={16} />} 
                        <span>{loading ? 'Loading...' : 'What is a TX Hash?'}</span>
                    </button>
                </div>

                <p className="text-gray-300 mb-6">
                    Select an election you voted in to retrieve your unique, tamper-proof transaction hash.
                </p>

                <div className="mb-4">
                    <label htmlFor="vote-select" className="block text-sm font-medium text-gray-300 mb-2">Select Election:</label>
                    <select
                        id="vote-select"
                        value={selectedElectionId}
                        onChange={handleSelectChange}
                        className="w-full px-4 py-3 bg-gray-900 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">-- Select your vote --</option>
                        {votedElectionIds.length > 0 ? (
                            votedElectionIds.map(electionId => (
                                <option key={electionId} value={electionId}>Vote for Election ID: {electionId}</option>
                            ))
                        ) : (
                            <option value="" disabled>You have not cast any votes.</option>
                        )}
                    </select>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={txHash}
                            onChange={(e) => setTxHash(e.target.value)}
                            placeholder="Select an election to load hash"
                            className="w-full px-4 py-3 bg-gray-900 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <button
                        onClick={handleVerify}
                        disabled={!txHash}
                        className="px-6 py-3 text-white font-semibold bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                        Verify on Blockchain
                    </button>
                </div>

                <AnimatePresence> {explanation && ( <motion.div initial={{ opacity: 0, height: 0, y: 10 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0, y: 10 }} transition={{ duration: 0.3 }} className="mt-6 p-4 bg-gray-900 border border-gray-700 rounded-lg" > <p className="text-gray-200 whitespace-pre-wrap">{explanation}</p> </motion.div> )} </AnimatePresence>
            </motion.div>
        </div>
    );
};


/** Main App Component */
export default function App() {
    const [view, setView] = useState('home');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [session, setSession] = useState(null);
    const [loadingAuth, setLoadingAuth] = useState(true);

    const [allElections, setAllElections] = useState([]);
    const [voterData, setVoterData] = useState(null);
    const [appLoading, setAppLoading] = useState(true);

    // --- *** UPDATED: Use new /api/getElections route *** ---
    const fetchAllElectionData = async () => {
        console.log("Fetching ALL election data from API...");
        try {
            // We moved the blockchain logic to its own API route
            const response = await fetch('/api/getElections');
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to fetch elections from API");
            }
            const data = await response.json();
            console.log("Fetched all elections:", data.allElections);
            return data.allElections || []; // Return elections array
        } catch (err) {
            console.error("Failed to fetch election data:", err);
            return []; // Return empty on error
        }
    };
    // --- *** END UPDATE *** ---


    const fetchVoterData = async () => {
        console.log("Fetching voter data...");
        if (!supabase) return null;
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) { console.error("Session error:", sessionError); return null; }
        const token = session.access_token;

        try {
            const response = await fetch('/api/getVoteDetails', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch vote details.');
            const data = await response.json(); // Should return { votes_cast: {...} }
            console.log("Fetched voter data:", data.votes_cast);
            return data.votes_cast;
        } catch (err) {
            console.error("Error fetching voter data:", err);
            return null;
        }
    };

    const loadAppData = useCallback(async (sessionUser) => {
        if (!sessionUser) {
             console.log("loadAppData: No user, skipping fetch.");
             setAppLoading(false);
             return;
        }
        console.log("loadAppData: User found, fetching data...");
        setAppLoading(true);
        try {
            const [elections, votes] = await Promise.all([
                fetchAllElectionData(),
                fetchVoterData()
            ]);
            setAllElections(elections);
            setVoterData(votes);
        } catch (error) {
            console.error("Error loading app data:", error);
        } finally {
            setAppLoading(false);
        }
    }, []);

    useEffect(() => {
        // Run once on mount
        supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
            console.log("Initial session check:", initialSession?.user?.email);
            if (loadingAuth) {
                setSession(initialSession);
                setLoadingAuth(false);
            }
        }).catch(error => {
            console.error("Error getting initial session:", error);
            if (loadingAuth) setLoadingAuth(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (_event, currentSession) => {
            console.log("Auth state changed:", _event, currentSession?.user?.email);
            setSession(currentSession);
            if (_event === 'SIGNED_OUT') {
                setView('home');
                setAllElections([]);
                setVoterData(null);
            }
            if (loadingAuth) setLoadingAuth(false);
          }
        );

        return () => { 
            console.log("Unsubscribing auth listener");
            subscription?.unsubscribe(); 
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Effect to load data *after* session is confirmed
    useEffect(() => {
        if (!loadingAuth) {
            if (session?.user) {
                loadAppData(session.user);
            } else {
                 setAllElections([]);
                 setVoterData(null);
                 setAppLoading(false);
            }
        }
    }, [session, loadingAuth, loadAppData]);


    // Render Logic
    if (loadingAuth) {
        return ( <div className="flex items-center justify-center h-screen w-full bg-gray-950"><LoadingSpinner /><span className="ml-2 text-white">Loading Auth...</span></div> );
    }

    if (!session?.user) {
        return <LoginView />;
    }
    
    if (appLoading) {
         return ( <div className="flex items-center justify-center h-screen w-full bg-gray-950"><LoadingSpinner /><span className="ml-2 text-white">Loading App Data...</span></div> );
    }


    // --- Logged-in App ---
    const renderView = () => {
        switch (view) {
        case 'home':
            return <DashboardHome allElections={allElections} voterData={voterData} />;
        case 'elections':
            return <ElectionView allElections={allElections} voterData={voterData} onVoteCasted={loadAppData} />;
        case 'results':
            return <ResultsView allElections={allElections} onRefresh={loadAppData} />;
        case 'verification':
            return <VerificationView voterData={voterData} />;
        default:
            return <DashboardHome allElections={allElections} voterData={voterData} />;
        }
    };

    return (
        <div className="flex h-screen w-full bg-gray-950 text-white font-inter">
            <Sidebar view={view} setView={setView} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <Header view={view} setIsMobileMenuOpen={setIsMobileMenuOpen} userEmail={session.user.email} />
                <main className="flex-1 overflow-y-auto">
                    <AnimatePresence mode="wait">
                        <motion.div key={view} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.25 }}>
                            {renderView()}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
}