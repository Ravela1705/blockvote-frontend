import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home as HomeIcon, Vote, BarChart3, ShieldCheck, Users, Menu, X, FileText,
  Sparkles, Loader2, HelpCircle, LogIn, LogOut, UserPlus, AlertTriangle, CheckCircle, RefreshCw
} from 'lucide-react';
// Import Supabase client
import { supabase } from '../lib/supabaseClient';
// Import ethers - needed for ResultsView decoding too
import { ethers } from 'ethers';

// --- Supabase initialization, Gemini Config, callGemini, LoadingSpinner (SAME AS BEFORE) ---
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
const callGemini = async (prompt, retries = 3, delay = 1000) => { /* ... */ if (!GEMINI_API_KEY || GEMINI_API_KEY === "AIzaSyDluI5_VUwSkC3A_7guSNI1XrQTBmqzY-Y") { console.warn("Gemini API key not set."); return "Gemini API key not set."; } try { const payload = { contents: [{ parts: [{ text: prompt }] }] }; const response = await fetch(GEMINI_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (!response.ok) { if ((response.status === 429 || response.status >= 500) && retries > 0) { await new Promise(resolve => setTimeout(resolve, delay)); return callGemini(prompt, retries - 1, delay * 2); } throw new Error(`API Error: ${response.statusText}`); } const result = await response.json(); const candidate = result.candidates?.[0]; if (candidate?.content?.parts?.[0]?.text) return candidate.content.parts[0].text; console.warn("Unexpected Gemini response:", result); return "Could not generate response."; } catch (error) { console.error("Error calling Gemini:", error); if (retries > 0) { await new Promise(resolve => setTimeout(resolve, delay)); return callGemini(prompt, retries - 1, delay * 2); } return `Error: ${error.message}.`; } };
const LoadingSpinner = () => <Loader2 size={16} className="animate-spin" />;


// --- Login View (SAME AS BEFORE) ---
const LoginView = () => { /* ... */ const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [isRegistering, setIsRegistering] = useState(false); const [error, setError] = useState(''); const [successMessage, setSuccessMessage] = useState(''); const [loading, setLoading] = useState(false); const handleAuth = async (e) => { e.preventDefault(); setLoading(true); setError(''); setSuccessMessage(''); try { let authResponse; if (isRegistering) { console.log("Attempting Supabase sign up for:", email); authResponse = await supabase.auth.signUp({ email, password }); console.log("Supabase signup response:", authResponse); if (authResponse.error) throw authResponse.error; if (!authResponse.data?.user && !authResponse.data?.session) { if(authResponse.error?.message.includes("confirmation")) { setSuccessMessage("Registration submitted! Please check email."); setLoading(false); return; } throw new Error("Signup failed silently."); } const user = authResponse.data?.session?.user || authResponse.data?.user; if (!user) throw new Error("User registration failed."); console.log("Calling backend DB record for:", user.id); const backendResponse = await fetch('/api/registerUser', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, email: user.email }), }); const backendData = await backendResponse.json(); if (!backendResponse.ok) { console.error("Backend DB creation failed:", backendData.error); await supabase.auth.signOut(); throw new Error(backendData.error || 'Failed registration.'); } console.log("Backend DB creation successful."); setSuccessMessage("Registration successful! Logging in..."); } else { console.log("Attempting Supabase sign in for:", email); authResponse = await supabase.auth.signInWithPassword({ email, password }); console.log("Supabase signin response:", authResponse); if (authResponse.error) throw authResponse.error; } } catch (err) { console.error("Supabase Auth Error:", err); let errorMessage = err.message || 'Unknown error.'; if (errorMessage.includes("already registered") || errorMessage.includes("unique constraint")) { errorMessage = "Email already registered."; } else if (errorMessage.includes("Invalid login credentials")) { errorMessage = "Invalid email or password."; } else if (errorMessage.includes("Password should be at least 6 characters")) { errorMessage = "Password minimum 6 characters."; } else if (errorMessage.includes("valid email")) { errorMessage = "Please enter a valid email."; } else if (errorMessage.includes("NetworkError")) { errorMessage = "Network error."; } setError(errorMessage); } if (error || successMessage.includes("check your email")) { setLoading(false); } }; return ( <div className="flex items-center justify-center min-h-screen w-full bg-gray-950"> <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md p-8 m-4 bg-gray-900 border border-gray-700/50 rounded-lg shadow-2xl"> <h1 className="text-3xl font-bold text-white mb-4 text-center flex items-center justify-center"><FileText className="text-indigo-400 mr-2" />BlockVote</h1> <p className="text-gray-400 text-center mb-6">{isRegistering ? 'Create voter account' : 'Student Voter Login'}</p> <form onSubmit={handleAuth}> <div className="mb-4"><label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="email">Student ID (Email)</label><input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 bg-gray-800 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g., 12345@college.edu" required /></div> <div className="mb-6"><label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="password">Password</label><input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 bg-gray-800 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="••••••••" required /></div> {error && ( <div className="p-3 mb-4 text-sm text-red-200 bg-red-900/50 border border-red-700 rounded-lg flex items-center"><AlertTriangle className="w-4 h-4 mr-2" /> {error}</div> )} {successMessage && ( <div className="p-3 mb-4 text-sm text-green-200 bg-green-900/50 border border-green-700 rounded-lg flex items-center"><CheckCircle className="w-4 h-4 mr-2" /> {successMessage}</div> )} <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 px-5 py-3 text-white font-semibold bg-linear-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-colors disabled:opacity-50"> {loading ? <LoadingSpinner /> : (isRegistering ? <UserPlus size={20} /> : <LogIn size={20} />)} <span>{loading ? 'Working...' : (isRegistering ? 'Register' : 'Login')}</span> </button> </form> <p className="text-center text-sm text-gray-400 mt-6">{isRegistering ? 'Already have account?' : "Don't have account?"}<button onClick={() => { setIsRegistering(!isRegistering); setError(''); setSuccessMessage(''); }} className="font-medium text-indigo-400 hover:text-indigo-300 ml-1">{isRegistering ? 'Login' : 'Register (Demo)'}</button></p> </motion.div> </div> ); };


// --- Other Components (Sidebar, Header...) ---
const Sidebar = ({ view, setView, isMobileMenuOpen, setIsMobileMenuOpen }) => { /* ... same as before ... */ const navItems = [ { name: 'home', icon: HomeIcon, view: 'home' }, { name: 'elections', icon: Vote, view: 'elections' }, { name: 'results', icon: BarChart3, view: 'results' }, { name: 'verification', icon: ShieldCheck, view: 'verification' }, ]; const NavLink = ({ item }) => ( <button onClick={() => { setView(item.view); if (isMobileMenuOpen) setIsMobileMenuOpen(false); }} className={`flex items-center w-full px-4 py-3 text-left ${view === item.view ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'} transition-colors duration-200 rounded-lg`} > <item.icon size={20} className="mr-3" /> <span className="font-medium">{item.name}</span> </button> ); return ( <> {/* Mobile Menu */} <AnimatePresence>{isMobileMenuOpen && ( <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileMenuOpen(false)} /> )}</AnimatePresence> <motion.div initial={{ x: '-100%' }} animate={{ x: isMobileMenuOpen ? '0%' : '-100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="fixed top-0 left-0 h-full w-64 bg-gray-900 border-r border-gray-700/50 p-4 z-40 lg:hidden"> <h1 className="text-2xl font-bold text-white mb-6 flex items-center"><FileText className="text-indigo-400 mr-2" />BlockVote</h1> <nav className="flex flex-col gap-2">{navItems.map(item => <NavLink key={item.name} item={item} />)}</nav> </motion.div> {/* Desktop Sidebar */} <div className="hidden lg:flex lg:flex-col lg:w-64 h-full min-h-screen bg-gray-900 border-r border-gray-700/50 p-5"> <h1 className="text-3xl font-bold text-white mb-8 flex items-center"><FileText className="text-indigo-400 mr-2" />BlockVote</h1> <nav className="flex flex-col gap-2">{navItems.map(item => <NavLink key={item.name} item={item} />)}</nav> <div className="mt-auto text-gray-500 text-xs"><p>© 2025 BlockVote. All rights reserved.</p></div> </div> </> ); };
const Header = ({ view, setIsMobileMenuOpen, userEmail }) => { /* ... same as before ... */ const viewTitles = { home: 'Dashboard', elections: 'Active Elections', results: 'Live Results', verification: 'Verify Vote' }; const handleLogout = async () => { const { error } = await supabase.auth.signOut(); if (error) console.error("Error signing out:", error); }; return ( <header className="flex items-center justify-between w-full h-20 px-4 md:px-8 border-b border-gray-700/50"> <div className="flex items-center gap-2"> <button className="lg:hidden p-2 -ml-2 text-gray-300 hover:text-white" onClick={() => setIsMobileMenuOpen(true)}> <Menu size={24} /> </button> <h2 className="text-xl md:text-2xl font-semibold text-white">{viewTitles[view]}</h2> </div> <div className="flex items-center gap-4"> <span className="hidden sm:block text-sm text-gray-400">{userEmail}</span> <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gray-700 rounded-lg shadow-md hover:bg-gray-600 transition-all duration-300 ease-in-out" > <LogOut size={18} /> <span>Logout</span> </button> </div> </header> ); };


// --- UPDATED Election View (Uses Base64 Decode for ABI) ---
const ElectionView = () => {
    const [election, setElection] = useState(null);
    const [candidates, setCandidates] = useState([]);
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [voteLoading, setVoteLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [electionStatus, setElectionStatus] = useState('Loading...');

    const fetchElectionData = async () => {
        console.log("Fetching election data...");
        setLoading(true); setMessage({ type: '', text: '' }); setElectionStatus('Loading...'); setElection(null); setCandidates([]);
        try {
            // --- *** NEW: Decode ABI from Base64 *** ---
            let contractABI;
            const abiBase64 = process.env.NEXT_PUBLIC_CONTRACT_ABI;
            if (!abiBase64) throw new Error("Contract ABI env var missing");
            try {
                const abiString = Buffer.from(abiBase64, 'base64').toString('utf-8');
                contractABI = JSON.parse(abiString);
                console.log("Decoded ABI for ElectionView.");
            } catch (e) {
                console.error("Error decoding/parsing ABI in ElectionView:", e);
                throw new Error("Could not decode/parse contract ABI.");
            }
            // --- *** END NEW *** ---

            const provider = new ethers.providers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
            const contract = new ethers.Contract( process.env.NEXT_PUBLIC_CONTRACT_ADDRESS, contractABI, provider ); // Use decoded ABI

            const electionCountBN = await contract.getElectionCount();
            const electionCount = electionCountBN.toNumber();
            console.log("Total elections:", electionCount);
            if (electionCount === 0) { setElectionStatus('No elections found.'); setLoading(false); return; }

            const latestElectionId = electionCount;
            console.log("Fetching latest election ID:", latestElectionId);

            const details = await contract.getElectionDetails(latestElectionId);
            const name = details[0]; const startTime = details[1].toNumber(); const endTime = details[2].toNumber();
            console.log("Details:", name, startTime, endTime);

            const candidatesData = await contract.getElectionCandidates(latestElectionId);
            const formattedCandidates = candidatesData.map(c => ({
                id: ethers.BigNumber.isBigNumber(c.id) ? c.id.toNumber() : parseInt(c.id, 10), name: c.name,
            }));
            console.log("Candidates:", formattedCandidates);

            const now = Math.floor(Date.now() / 1000); let status = 'Upcoming';
            if (now >= startTime && now < endTime) status = 'Active'; else if (now >= endTime) status = 'Ended';
            console.log("Status:", status); setElectionStatus(status);

            setElection({ id: latestElectionId, title: name, startTime: startTime, endTime: endTime });
            setCandidates(formattedCandidates);
        } catch (err) { console.error("Fetch election error:", err); setMessage({ type: 'error', text: 'Could not load election.' }); setElectionStatus('Error loading'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchElectionData(); }, []);

    const handleVote = async (electionId, candidateId) => { /* ... same as before ... */ setVoteLoading(true); setMessage({ type: '', text: '' }); const { data: { session }, error: sessionError } = await supabase.auth.getSession(); if (sessionError || !session) { setMessage({ type: 'error', text: "Auth error." }); console.error("Session error:", sessionError); setVoteLoading(false); return; } const token = session.access_token; try { const response = await fetch('/api/castVote', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ electionId, candidateId }), }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Vote failed.'); setMessage({ type: 'success', text: `Success! Vote recorded. TX Hash: ${data.transactionHash.substring(0, 10)}...` }); } catch (err) { let errorMessage = err.message || 'Unknown error.'; setMessage({ type: 'error', text: errorMessage }); } setVoteLoading(false); };

    if (loading) return <div className="p-8 flex justify-center items-center"><LoadingSpinner /> <span className="ml-2">Loading Election...</span></div>;
    if (!election) return <div className="p-8 text-center text-gray-400">{electionStatus}</div>;

    const isVoteDisabled = voteLoading || message.type === 'success' || electionStatus !== 'Active';

    // Rest of ElectionView JSX is unchanged...
    return ( <div className="p-4 md:p-8"> <div className="flex justify-between items-center mb-4"> <h2 className="text-2xl font-semibold text-white">{election.title}</h2> <button onClick={fetchElectionData} disabled={loading} className="p-2 text-gray-400 hover:text-white disabled:opacity-50"> <RefreshCw size={18} className={loading ? 'animate-spin' : ''}/> </button> </div> <div className={`mb-6 p-3 rounded-lg border text-center ${ electionStatus === 'Active' ? 'bg-green-900/50 border-green-700 text-green-300' : electionStatus === 'Ended' ? 'bg-red-900/50 border-red-700 text-red-300' : 'bg-yellow-900/50 border-yellow-700 text-yellow-300' }`}> Status: {electionStatus} {electionStatus === 'Active' && election.endTime && ( <span className="text-xs ml-2">(Ends: {new Date(election.endTime * 1000).toLocaleString()})</span> )} {electionStatus === 'Upcoming' && election.startTime && ( <span className="text-xs ml-2">(Starts: {new Date(election.startTime * 1000).toLocaleString()})</span> )} </div> {message.text && ( <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={`p-4 mb-6 rounded-lg ${message.type === 'success' ? 'bg-green-800 border-green-600' : 'bg-red-800 border-red-600'} border text-white`} > {message.type === 'success' ? <CheckCircle className="inline mr-2" /> : <AlertTriangle className="inline mr-2" />} {message.text} </motion.div> )} <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> <motion.div key={election.id} className="bg-gray-800 p-6 rounded-lg border border-gray-700/50 shadow-lg" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} > <h3 className="text-xl font-semibold text-white mb-4">Candidates</h3> {candidates.length === 0 && <p className="text-gray-400">Loading candidates...</p>} <div className="flex flex-col gap-3"> {candidates.map(candidate => ( <button key={candidate.id} onClick={() => setSelectedCandidate({ election: election.id, candidate: candidate.id })} disabled={electionStatus !== 'Active'} className={`w-full text-left p-4 rounded-lg transition-all ${ selectedCandidate?.candidate === candidate.id && electionStatus === 'Active' ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' : 'bg-gray-700 text-gray-200 hover:bg-gray-600' } disabled:opacity-50 disabled:cursor-not-allowed`} > {candidate.name} </button> ))} </div> <button onClick={() => { if(selectedCandidate) { handleVote(selectedCandidate.election, selectedCandidate.candidate) } }} disabled={!selectedCandidate || selectedCandidate.election !== election.id || isVoteDisabled} className="w-full mt-5 px-5 py-3 text-white font-semibold bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" > {voteLoading ? <LoadingSpinner /> : (message.type === 'success' ? <CheckCircle /> : <Vote size={18} />)} <span> {message.type === 'success' ? 'Voted Successfully' : voteLoading ? 'Submitting...' : electionStatus !== 'Active' ? `Election ${electionStatus}` : !selectedCandidate ? 'Select a Candidate' : 'Cast Your Vote'} </span> </button> </motion.div> </div> </div> );
};


// --- Other Views (DashboardHome, ResultsView, VerificationView) ---
// DashboardHome: No changes needed
const DashboardHome = () => { /* ... */ const cards = [ { title: 'Active Elections', value: '1', icon: Vote, color: 'text-blue-400' }, { title: 'Total Candidates', value: '2', icon: Users, color: 'text-green-400' }, { title: 'Chain Secured', value: 'Polygon Amoy', icon: ShieldCheck, color: 'text-purple-400' }, ]; return ( <div className="p-4 md:p-8"> <motion.div className="mb-8 p-6 bg-linear-to-r from-gray-800 to-gray-800/50 border border-gray-700/50 rounded-lg shadow-lg" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}> <h3 className="text-2xl font-bold text-white mb-2">Welcome to BlockVote</h3> <p className="text-gray-300">The secure, transparent, and decentralized voting platform.</p> </motion.div> <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"> {cards.map((card, i) => ( <motion.div key={card.title} className="bg-gray-800 p-6 rounded-lg border border-gray-700/50 shadow-lg" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + i * 0.1 }}> <div className="flex items-center justify-between"><span className={`font-semibold text-gray-400`}>{card.title}</span><card.icon size={24} className={card.color} /></div> <p className="text-3xl font-bold text-white mt-4">{card.value}</p> </motion.div> ))} </div> </div> ); };

// UPDATED ResultsView (Uses Base64 Decode for ABI)
const ResultsView = () => {
    const [results, setResults] = useState({ title: 'Student Body President', candidates: [], totalVotes: 0 }); // Default empty
    const [analysis, setAnalysis] = useState('');
    const [loading, setLoading] = useState(false); // Only true during fetch
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);
    const [fetchError, setFetchError] = useState(''); // State for fetch errors

    const fetchResults = async () => {
        setLoading(true); setFetchError(''); setAnalysis(''); // Clear previous errors/analysis
        try {
            // --- *** NEW: Decode ABI from Base64 *** ---
            let contractABI;
            const abiBase64 = process.env.NEXT_PUBLIC_CONTRACT_ABI;
            if (!abiBase64) throw new Error("Contract ABI env var missing");
            try {
                const abiString = Buffer.from(abiBase64, 'base64').toString('utf-8');
                contractABI = JSON.parse(abiString);
                console.log("Decoded ABI for ResultsView.");
            } catch (e) {
                console.error("Error decoding/parsing ABI in ResultsView:", e);
                throw new Error("Could not decode/parse contract ABI.");
            }
            // --- *** END NEW *** ---

            const provider = new ethers.providers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
            const contract = new ethers.Contract( process.env.NEXT_PUBLIC_CONTRACT_ADDRESS, contractABI, provider ); // Use decoded ABI

            // Fetch latest election ID
            const electionCountBN = await contract.getElectionCount();
            const electionCount = electionCountBN.toNumber();
            if (electionCount === 0) throw new Error("No elections found to fetch results.");
            const latestElectionId = electionCount;
            console.log("Fetching results for election ID:", latestElectionId);

             // Fetch details to get title (optional, could hardcode title if only one election)
             // const details = await contract.getElectionDetails(latestElectionId);
             // const title = details[0];
             const title = "Student Body President"; // Hardcode for now

            // Fetch candidates and votes
            const candidatesData = await contract.getElectionCandidates(latestElectionId);
            let totalVotes = 0;
            const candidates = candidatesData.map(c => {
                const voteCountBN = ethers.BigNumber.isBigNumber(c.voteCount) ? c.voteCount : ethers.BigNumber.from(c.voteCount || 0);
                const voteCount = voteCountBN.toNumber();
                totalVotes += voteCount;
                return { id: ethers.BigNumber.isBigNumber(c.id) ? c.id.toNumber() : c.id, name: c.name, votes: voteCount };
            });

            setResults({ title: title, candidates: candidates, totalVotes: totalVotes });
        } catch (err) {
            console.error("Failed to fetch results:", err);
            setFetchError(`Error: ${err.message || 'Could not load results.'}`); // Set specific error message
            setResults({ title: 'Error Loading', candidates: [], totalVotes: 0 }); // Reset results on error
        } finally {
             setLoading(false);
        }
    };

     // Fetch results on component mount
     useEffect(() => {
        fetchResults();
     }, []);


    const getAiAnalysis = async () => { /* ... same as before ... */ setLoadingAnalysis(true); setAnalysis(''); const resultsString = results.candidates.map(c => `${c.name}: ${c.votes} votes`).join(', '); const prompt = `You are a neutral election observer. Provide a one-paragraph summary for the election '${results.title}' with the following results: ${resultsString}. State who the winner is (or if it's a tie) and the total votes cast.`; const geminiResponse = await callGemini(prompt); setAnalysis(geminiResponse); setLoadingAnalysis(false); };

    // Rest of ResultsView JSX is unchanged...
    return ( <div className="p-4 md:p-8"> <div className="flex justify-between items-center mb-6"> <h3 className="text-2xl font-semibold text-white">{results.title} - Live Results</h3> <button onClick={fetchResults} disabled={loading} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50" > {loading ? <LoadingSpinner /> : <RefreshCw size={16} />} <span>{loading ? 'Refreshing...' : 'Refresh Results'}</span> </button> </div> {fetchError && ( <div className="p-4 mb-6 rounded-lg bg-red-800 border-red-600 border text-white"><AlertTriangle className="inline mr-2" />{fetchError}</div> )} {loading ? ( <div className="flex justify-center items-center p-12"><LoadingSpinner /></div> ) : ( <div className="bg-gray-800 p-6 rounded-lg border border-gray-700/50 shadow-lg"> <div className="mb-6 space-y-4"> {results.candidates.length === 0 && !fetchError && <p className="text-gray-400 text-center">No candidates found for this election.</p>} {results.candidates.map(candidate => { const percentage = results.totalVotes > 0 ? (candidate.votes / results.totalVotes) * 100 : 0; return ( <div key={candidate.id}> <div className="flex justify-between items-center mb-1"> <span className="font-semibold text-white">{candidate.name}</span> <span className="text-gray-300">{candidate.votes} Votes</span> </div> <div className="w-full bg-gray-700 rounded-full h-4"> <motion.div className="bg-linear-to-r from-purple-500 to-indigo-600 h-4 rounded-full" initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 1, ease: 'easeOut' }} /> </div> </div> ); })} </div> <div className="border-t border-gray-700 pt-4 flex justify-between"> <span className="text-lg font-bold text-white">Total Votes</span> <span className="text-lg font-bold text-white">{results.totalVotes}</span> </div> </div> )} <div className="mt-8"> <button onClick={getAiAnalysis} disabled={loadingAnalysis || loading || results.totalVotes === 0 || fetchError} className="flex items-center justify-center gap-2 px-5 py-3 text-white font-semibold bg-linear-to-r from-teal-500 to-cyan-600 rounded-lg hover:from-teal-600 hover:to-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" > {loadingAnalysis ? <LoadingSpinner /> : <Sparkles size={18} />} <span>{loadingAnalysis ? 'Generating...' : '✨ Generate AI Analysis'}</span> </button> <AnimatePresence> {analysis && ( <motion.div initial={{ opacity: 0, height: 0, y: 10 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0, y: 10 }} transition={{ duration: 0.3 }} className="mt-4 p-4 bg-gray-900 border border-gray-700 rounded-lg" > <p className="text-gray-200 whitespace-pre-wrap">{analysis}</p> </motion.div> )} </AnimatePresence> </div> </div> );
};

// VerificationView: No ABI needed, only calls backend API
const VerificationView = () => { /* ... same as before ... */ const [explanation, setExplanation] = useState(''); const [loading, setLoading] = useState(false); const [hashLoading, setHashLoading] = useState(true); const [txHash, setTxHash] = useState(''); useEffect(() => { const fetchVoteDetails = async () => { setHashLoading(true); const { data: { session }, error: sessionError } = await supabase.auth.getSession(); if (sessionError || !session) { console.error("Session error:", sessionError); setHashLoading(false); return; } const token = session.access_token; try { const response = await fetch('/api/getVoteDetails', { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }); if (!response.ok) throw new Error('Failed to fetch vote details.'); const data = await response.json(); if (data.hash) setTxHash(data.hash); } catch (err) { console.error(err); } setHashLoading(false); }; fetchVoteDetails(); }, []); const handleVerify = () => { if (!txHash.startsWith('0x') || txHash.length !== 66) { console.warn("Invalid TX Hash format"); return; } const url = `https://www.oklink.com/amoy/tx/${txHash}`; window.open(url, '_blank'); }; const getExplanation = async () => { setLoading(true); setExplanation(''); const prompt = ` In simple terms, what is a 'transaction hash' (or 'TX Hash') in the context of a blockchain voting app? Explain why a user would use it to verify their vote. Keep it to 2-3 sentences, easy for a non-technical person to understand. `; const generatedText = await callGemini(prompt); setExplanation(generatedText); setLoading(false); }; return ( <div className="p-4 md:p-8"> <motion.div className="bg-gray-800 p-6 md:p-8 rounded-lg border border-gray-700/50 shadow-lg" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} > <div className="flex items-center justify-between mb-4"> <h3 className="text-2xl font-semibold text-white">Verify Your Vote</h3> <button onClick={getExplanation} disabled={loading} className="flex items-center gap-2 px-3 py-2 text-sm text-cyan-300 border border-cyan-300/50 rounded-lg hover:bg-cyan-900/50 transition-colors disabled:opacity-50" > {loading ? <LoadingSpinner /> : <HelpCircle size={16} />} <span>{loading ? 'Loading...' : 'What is a TX Hash?'}</span> </button> </div> <p className="text-gray-300 mb-6"> Your unique transaction hash is your public, tamper-proof receipt. It is automatically loaded below if you have voted. </p> <div className="flex flex-col sm:flex-row gap-4"> <div className="relative flex-1"> <input type="text" value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder={hashLoading ? "Loading your vote hash..." : "No vote hash found. Cast your vote!"} className="w-full px-4 py-3 bg-gray-900 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" disabled={hashLoading} /> {hashLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-gray-400" />} </div> <button onClick={handleVerify} disabled={!txHash || hashLoading} className="px-6 py-3 text-white font-semibold bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50" > Verify </button> </div> <AnimatePresence> {explanation && ( <motion.div initial={{ opacity: 0, height: 0, y: 10 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0, y: 10 }} transition={{ duration: 0.3 }} className="mt-6 p-4 bg-gray-900 border border-gray-700 rounded-lg" > <p className="text-gray-200 whitespace-pre-wrap">{explanation}</p> </motion.div> )} </AnimatePresence> </motion.div> </div> ); };


/** Main App Component (Using Supabase Session) */
export default function App() { /* ... same Supabase auth listener as before ... */
    const [view, setView] = useState('home'); const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); const [session, setSession] = useState(null); const [loadingAuth, setLoadingAuth] = useState(true); useEffect(() => { supabase.auth.getSession().then(({ data: { session: initialSession } }) => { console.log("Initial session check:", initialSession?.user?.email); if (loadingAuth) { setSession(initialSession); setLoadingAuth(false); } }).catch(error => { console.error("Error initial session:", error); if (loadingAuth) setLoadingAuth(false); }); const { data: { subscription } } = supabase.auth.onAuthStateChange( (_event, currentSession) => { console.log("Auth state changed:", _event, currentSession?.user?.email); setSession(currentSession); if (_event === 'SIGNED_OUT') setView('home'); if (loadingAuth) setLoadingAuth(false); } ); return () => { console.log("Unsubscribing auth listener"); subscription?.unsubscribe(); setLoadingAuth(false); }; }, [loadingAuth]); // Removed loadingAuth dependency here
     if (loadingAuth) { return ( <div className="flex items-center justify-center h-screen w-full bg-gray-950"><LoadingSpinner /><span className="ml-2 text-white">Loading Auth...</span></div> ); } if (!session?.user) { console.log("No Supabase session, showing LoginView."); return <LoginView />; } console.log("User logged in:", session.user.email, "Rendering main app..."); const renderView = () => { switch (view) { case 'home': return <DashboardHome />; case 'elections': return <ElectionView />; case 'results': return <ResultsView />; case 'verification': return <VerificationView />; default: return <DashboardHome />; } }; return ( <div className="flex h-screen w-full bg-gray-950 text-white font-inter"> <Sidebar view={view} setView={setView} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} /> <div className="flex-1 flex flex-col h-full overflow-hidden"> <Header view={view} setIsMobileMenuOpen={setIsMobileMenuOpen} userEmail={session.user.email} /> <main className="flex-1 overflow-y-auto"> <AnimatePresence mode="wait"> <motion.div key={view} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.25 }}> {renderView()} </motion.div> </AnimatePresence> </main> </div> </div> );
}