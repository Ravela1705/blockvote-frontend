import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home as HomeIcon, Vote, BarChart3, ShieldCheck, Users, Menu, FileText,
  Sparkles, Loader2, HelpCircle, LogIn, LogOut, UserPlus, AlertTriangle, CheckCircle, RefreshCw, GraduationCap
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/router'; // Import Router for redirection

// --- 1. SUPABASE CLIENT ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("CRITICAL ERROR: Supabase credentials missing.")
}
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// --- 2. GEMINI API ---
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

const callGemini = async (prompt) => {
    if (!GEMINI_API_KEY) return "Gemini API key not set.";
     try { const payload = { contents: [{ parts: [{ text: prompt }] }] }; const response = await fetch(GEMINI_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const result = await response.json(); return result.candidates?.[0]?.content?.parts?.[0]?.text || "No response."; } catch (error) { return `Error: ${error.message}`; }
};

// --- Reusable Components ---
const LoadingSpinner = () => <Loader2 size={16} className="animate-spin" />;

// --- Helper Data ---
const SECTIONS = Array.from({length: 26}, (_, i) => String.fromCharCode(65 + i)); // A-Z
const BRANCHES = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'BBA', 'BSC'];

// --- Login View ---
const LoginView = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [rollNumber, setRollNumber] = useState('');
  const [section, setSection] = useState('A');
  const [branch, setBranch] = useState('CSE');
  const [year, setYear] = useState('4'); 

  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccessMessage('');

    try {
        if (isRegistering) {
            if (rollNumber.length !== 13) throw new Error("Roll Number must be exactly 13 characters.");
            
            const authResponse = await supabase.auth.signUp({ email, password });
            if (authResponse.error) throw authResponse.error;
            
            const user = authResponse.data?.user;
            if (!user) throw new Error("Signup failed. Check email confirmation.");

            const backendResponse = await fetch('/api/registerUser', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: user.id, 
                    email: user.email,
                    rollNumber: rollNumber,
                    section: section,
                    branch: branch,
                    year: Number(year)
                }),
            });
            const backendData = await backendResponse.json();
            if (!backendResponse.ok) {
                await supabase.auth.signOut();
                throw new Error(backendData.error || 'Registration failed.');
            }

            setSuccessMessage("Registration successful! Please check your email to confirm.");
            setLoading(false);
            
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
        }
    } catch (err) {
        setError(err.message || 'Authentication error.');
        setLoading(false);
    }
  };

  return ( 
    <div className="flex items-center justify-center min-h-screen w-full bg-gray-950"> 
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md p-8 bg-gray-900 border border-gray-700/50 rounded-lg shadow-2xl my-10"> 
            <h1 className="text-3xl font-bold text-white mb-4 text-center flex items-center justify-center"><FileText className="text-indigo-400 mr-2" />BlockVote</h1> 
            <p className="text-gray-400 text-center mb-6">{isRegistering ? 'Student Registration' : 'Student Login'}</p> 
            
            <form onSubmit={handleAuth} className="space-y-4"> 
                {isRegistering && (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Branch</label>
                                <select value={branch} onChange={(e) => setBranch(e.target.value)} className="w-full px-4 py-3 bg-gray-800 text-white border border-gray-700 rounded-lg">
                                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Year</label>
                                <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full px-4 py-3 bg-gray-800 text-white border border-gray-700 rounded-lg">
                                    <option value="1">1st Year (AP25)</option>
                                    <option value="2">2nd Year (AP24)</option>
                                    <option value="3">3rd Year (AP23)</option>
                                    <option value="4">4th Year (AP22)</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">University Roll No</label>
                            <input type="text" value={rollNumber} onChange={(e) => setRollNumber(e.target.value.toUpperCase())} className="w-full px-4 py-3 bg-gray-800 text-white border border-gray-700 rounded-lg" placeholder="AP22110010001" maxLength={13} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Section</label>
                            <select value={section} onChange={(e) => setSection(e.target.value)} className="w-full px-4 py-3 bg-gray-800 text-white border border-gray-700 rounded-lg">
                                {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
                            </select>
                        </div>
                    </>
                )}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 bg-gray-800 text-white border border-gray-700 rounded-lg" placeholder="student@srmap.edu.in" required />
                </div> 
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 bg-gray-800 text-white border border-gray-700 rounded-lg" placeholder="••••••••" required />
                </div> 
                {error && <div className="p-3 text-sm text-red-200 bg-red-900/50 border border-red-700 rounded-lg flex items-center"><AlertTriangle className="w-4 h-4 mr-2" /> {error}</div>} 
                {successMessage && <div className="p-3 text-sm text-green-200 bg-green-900/50 border border-green-700 rounded-lg flex items-center"><CheckCircle className="w-4 h-4 mr-2" /> {successMessage}</div>} 
                <button type="submit" disabled={loading} className="w-full py-3 text-white font-semibold bg-indigo-600 rounded-lg hover:bg-indigo-700 flex justify-center items-center gap-2"> 
                    {loading ? <LoadingSpinner /> : (isRegistering ? <UserPlus size={20} /> : <LogIn size={20} />)} 
                    <span>{loading ? 'Processing...' : (isRegistering ? 'Register' : 'Login')}</span> 
                </button> 
            </form> 
            
            <p className="text-center text-sm text-gray-400 mt-6">
                {isRegistering ? 'Already registered?' : "Don't have an account?"}
                <button onClick={() => { setIsRegistering(!isRegistering); setError(''); setSuccessMessage(''); }} className="font-medium text-indigo-400 hover:text-indigo-300 ml-1">
                    {isRegistering ? 'Login' : 'Register Here'}
                </button>
            </p> 
        </motion.div> 
    </div> 
  );
};

// --- Sidebar ---
const Sidebar = ({ view, setView, isMobileMenuOpen, setIsMobileMenuOpen }) => {
    const navItems = [ { name: 'Dashboard', icon: HomeIcon, view: 'home' }, { name: 'Elections', icon: Vote, view: 'elections' }, { name: 'Results', icon: BarChart3, view: 'results' }, { name: 'Verify', icon: ShieldCheck, view: 'verification' }, ];
    const NavLink = ({ item }) => ( <button onClick={() => { setView(item.view); if (isMobileMenuOpen) setIsMobileMenuOpen(false); }} className={`flex items-center w-full px-4 py-3 text-left ${view === item.view ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'} transition-colors duration-200 rounded-lg`} > <item.icon size={20} className="mr-3" /> <span className="font-medium">{item.name}</span> </button> );
    return ( <> <AnimatePresence>{isMobileMenuOpen && ( <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} /> )}</AnimatePresence> <motion.div initial={{ x: '-100%' }} animate={{ x: isMobileMenuOpen ? '0%' : '-100%' }} className="fixed top-0 left-0 h-full w-64 bg-gray-900 border-r border-gray-700/50 p-4 z-40 lg:hidden"> <h1 className="text-2xl font-bold text-white mb-6 flex items-center"><FileText className="text-indigo-400 mr-2" />BlockVote</h1> <nav className="flex flex-col gap-2">{navItems.map(item => <NavLink key={item.name} item={item} />)}</nav> </motion.div> <div className="hidden lg:flex lg:flex-col lg:w-64 h-full min-h-screen bg-gray-900 border-r border-gray-700/50 p-5"> <h1 className="text-3xl font-bold text-white mb-8 flex items-center"><FileText className="text-indigo-400 mr-2" />BlockVote</h1> <nav className="flex flex-col gap-2">{navItems.map(item => <NavLink key={item.name} item={item} />)}</nav> <div className="mt-auto text-gray-500 text-xs"><p>© 2025 BlockVote.</p></div> </div> </> );
};

// --- Header ---
const Header = ({ view, setIsMobileMenuOpen, userEmail }) => {
    const viewTitles = { home: 'Student Dashboard', elections: 'Active Elections', results: 'Live Results', verification: 'Verify Vote' };
    return ( <header className="flex items-center justify-between w-full h-20 px-4 md:px-8 border-b border-gray-700/50"> <div className="flex items-center gap-2"> <button className="lg:hidden p-2 -ml-2 text-gray-300" onClick={() => setIsMobileMenuOpen(true)}> <Menu size={24} /> </button> <h2 className="text-xl md:text-2xl font-semibold text-white">{viewTitles[view]}</h2> </div> <div className="flex items-center gap-4"> <span className="hidden sm:block text-sm text-gray-400">{userEmail}</span> <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gray-700 rounded-lg hover:bg-gray-600" > <LogOut size={18} /> <span>Logout</span> </button> </div> </header> );
};

// --- ElectionView ---
const ElectionView = ({ allElections, voterData, onVoteCasted }) => {
    const [selectedCandidate, setSelectedCandidate] = useState({});
    const [voteLoading, setVoteLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '', electionId: null });

    const handleVote = async (electionId, candidateId) => {
        setVoteLoading(true); setMessage({ type: '', text: '', electionId });
        const { data: { session } } = await supabase.auth.getSession();
        try {
            const response = await fetch('/api/castVote', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }, 
                body: JSON.stringify({ electionId, candidateId }), 
            });
            const data = await response.json(); 
            if (!response.ok) throw new Error(data.error);
            setMessage({ type: 'success', text: `Vote recorded! Hash: ${data.transactionHash.substring(0, 10)}...`, electionId });
            if (onVoteCasted) onVoteCasted(); 
        } catch (err) { setMessage({ type: 'error', text: err.message, electionId }); }
        setVoteLoading(false);
    };

    if (!allElections || allElections.length === 0) return <div className="p-8 text-center text-gray-400">No elections found for your Year/Section.</div>;

    return (
        <div className="p-4 md:p-8 space-y-8">
            {allElections.map((election) => {
                const hasVoted = voterData && voterData[election.id];
                const currentSelection = selectedCandidate[election.id];
                return (
                    <motion.div key={election.id} className="bg-gray-800 p-6 rounded-lg border border-gray-700/50 shadow-lg" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-white">{election.title}</h2>
                            <div className="text-right">
                                <span className={`px-2 py-1 rounded text-xs ${election.status==='Active'?'bg-green-900 text-green-300':'bg-red-900 text-red-300'}`}>{election.status}</span>
                                <div className="text-xs text-gray-400 mt-1">Year {election.targetYear} - Sec {election.targetSection}</div>
                            </div>
                        </div>
                        {message.electionId === election.id && message.text && <div className={`p-3 mb-4 rounded text-sm text-white ${message.type==='success'?'bg-green-800':'bg-red-800'}`}>{message.text}</div>}
                        <div className="space-y-3">
                            {election.candidates.map(c => (
                                <button key={c.id} onClick={() => setSelectedCandidate({ ...selectedCandidate, [election.id]: c.id })} disabled={election.status!=='Active' || hasVoted} className={`w-full text-left p-3 rounded border ${currentSelection===c.id ? 'bg-indigo-900 border-indigo-500' : 'bg-gray-700 border-gray-600 hover:bg-gray-600'} text-white transition-all`}>
                                    {c.name}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => handleVote(election.id, currentSelection)} disabled={!currentSelection || voteLoading || hasVoted} className="w-full mt-4 py-3 bg-indigo-600 text-white rounded font-bold disabled:opacity-50">
                            {hasVoted ? 'Vote Cast' : voteLoading && message.electionId===election.id ? 'Submitting...' : 'Confirm Vote'}
                        </button>
                    </motion.div>
                );
            })}
        </div>
    );
};

// --- DashboardHome ---
const DashboardHome = ({ allElections, voterData, userProfile }) => {
    const votesCastByUser = voterData ? Object.keys(voterData).length : 0;
    
    return (
     <div className="p-4 md:p-8 space-y-6">
      <motion.div className="p-6 bg-gradient-to-r from-indigo-900 to-purple-900 border border-indigo-700 rounded-lg shadow-lg flex items-center justify-between" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div>
            <h3 className="text-2xl font-bold text-white mb-1">Welcome Back!</h3>
            {userProfile ? (
                <div className="text-indigo-200 space-y-1">
                    <p className="flex items-center gap-2 text-sm"><FileText size={16}/> Roll No: <span className="font-mono font-bold text-white">{userProfile.rollNumber}</span></p>
                    <p className="flex items-center gap-2 text-sm"><GraduationCap size={16}/> Year {userProfile.year} | {userProfile.branch} | Section {userProfile.section}</p>
                </div>
            ) : (
                <p className="text-gray-300">Loading profile...</p>
            )}
        </div>
        <ShieldCheck className="text-indigo-400 w-16 h-16 opacity-50" />
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <div className="flex justify-between"><span className="text-gray-400">Eligible Elections</span><Vote className="text-blue-400" /></div>
            <p className="text-3xl font-bold text-white mt-2">{allElections.length}</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <div className="flex justify-between"><span className="text-gray-400">Votes Cast</span><CheckCircle className="text-green-400" /></div>
            <p className="text-3xl font-bold text-white mt-2">{votesCastByUser}</p>
        </div>
      </div>
    </div>
  );
};

// --- ResultsView ---
const ResultsView = ({ allElections, onRefresh }) => {
    const [selectedId, setSelectedId] = useState(null);
    const [analysis, setAnalysis] = useState('');
    const [loading, setLoading] = useState(false);
    
    const selected = allElections.find(e => e.id === Number(selectedId));

    const getAiAnalysis = async () => {
        if (!selected) return;
        setLoading(true); setAnalysis('');
        const results = selected.candidates.map(c => `${c.name}: ${c.votes}`).join(', ');
        const text = await callGemini(`Analyze election results: ${selected.title}. Results: ${results}. Winner? Summary?`);
        setAnalysis(text); setLoading(false);
    };

    return (
        <div className="p-8">
            <div className="flex justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Live Results</h3>
                <button onClick={onRefresh} className="px-3 py-1 bg-indigo-600 rounded text-sm flex items-center gap-2"><RefreshCw size={14}/> Refresh</button>
            </div>
            <select className="w-full p-3 bg-gray-800 text-white rounded mb-6 border border-gray-700" onChange={(e) => {setSelectedId(e.target.value); setAnalysis('');}}>
                <option value="">Select Election</option>
                {allElections.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
            {selected && (
                <div className="bg-gray-800 p-6 rounded border border-gray-700">
                    <h4 className="text-xl font-bold text-white mb-4">{selected.title}</h4>
                    {selected.candidates.map(c => (
                        <div key={c.id} className="mb-3">
                            <div className="flex justify-between text-gray-300 mb-1"><span>{c.name}</span><span>{c.votes} votes</span></div>
                            <div className="w-full bg-gray-700 h-2 rounded"><div className="bg-indigo-500 h-2 rounded" style={{width: `${selected.totalVotes ? (c.votes/selected.totalVotes)*100 : 0}%`}}></div></div>
                        </div>
                    ))}
                    <button onClick={getAiAnalysis} disabled={loading} className="mt-6 flex items-center gap-2 text-cyan-400 hover:text-cyan-300"><Sparkles size={16}/> {loading?'Analyzing...':'AI Analysis'}</button>
                    {analysis && <p className="mt-4 p-4 bg-gray-900 rounded text-gray-300 text-sm">{analysis}</p>}
                </div>
            )}
        </div>
    );
};

// --- VerificationView ---
const VerificationView = ({ voterData }) => {
    const [hash, setHash] = useState('');
    return (
        <div className="p-8">
            <h3 className="text-2xl font-bold text-white mb-4">Verify Vote</h3>
            <p className="text-gray-400 mb-6">Select an election to see your transaction hash.</p>
            <select className="w-full p-3 bg-gray-800 text-white rounded mb-4 border border-gray-700" onChange={(e) => setHash(e.target.value)}>
                <option value="">Select Election</option>
                {voterData && Object.entries(voterData).map(([id, h]) => <option key={id} value={h}>Election ID: {id}</option>)}
            </select>
            {hash && (
                <div className="bg-gray-800 p-4 rounded border border-gray-700 break-all font-mono text-sm text-indigo-300">
                    {hash}
                    <button onClick={() => window.open(`https://www.oklink.com/amoy/tx/${hash}`, '_blank')} className="block mt-2 text-white bg-indigo-600 px-4 py-2 rounded w-max">View on Blockchain</button>
                </div>
            )}
        </div>
    );
};

// --- MAIN APP ---
export default function App() {
    const [view, setView] = useState('home');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [session, setSession] = useState(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    
    const [allElections, setAllElections] = useState([]);
    const [voterData, setVoterData] = useState(null);
    const [userProfile, setUserProfile] = useState(null); 
    const router = useRouter();

    // --- NEW: Check User Role & Redirect if Admin ---
    const checkUserRoleAndRedirect = async (user) => {
        // 1. Check if they are in 'voters' table
        const { data: voter, error } = await supabase
            .from('voters')
            .select('id')
            .eq('id', user.id)
            .single();

        if (voter) {
            // Is Student -> Load Data
            loadAppData(user);
        } else {
            // Not a student? Check if Admin
            const { data: admin } = await supabase
                .from('admins')
                .select('id')
                .eq('id', user.id)
                .single();
            
            if (admin) {
                // Is Admin -> Redirect to /admin
                console.log("Admin detected on student page. Redirecting...");
                router.push('/admin');
            } else {
                // Ghost User (neither) -> Logout
                console.warn("User has no role. Logging out.");
                await supabase.auth.signOut();
                setSession(null);
            }
        }
    };

    const loadAppData = useCallback(async (user) => {
        if (!user) return;
        try {
            const elRes = await fetch('/api/getElections', { headers: { 'Authorization': `Bearer ${session?.access_token}` } });
            const elData = await elRes.json();
            setAllElections(elData.allElections || []);

            const vRes = await fetch('/api/getVoteDetails', { headers: { 'Authorization': `Bearer ${session?.access_token}` } });
            const vData = await vRes.json();
            setVoterData(vData.votes_cast || {});
            setUserProfile(vData.profile || null);
        } catch (e) { console.error(e); }
    }, [session]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session); 
            setLoadingAuth(false);
            if(session?.user) checkUserRoleAndRedirect(session.user);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if(session?.user) checkUserRoleAndRedirect(session.user);
        });
        return () => subscription?.unsubscribe();
    }, []); // Removed 'loadAppData' from dependency to avoid loop

    if (loadingAuth) return <div className="h-screen bg-gray-950 flex items-center justify-center"><LoadingSpinner/></div>;
    if (!session) return <LoginView />;

    return (
        <div className="flex h-screen w-full bg-gray-950 text-white font-inter">
            <Sidebar view={view} setView={setView} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <Header view={view} setIsMobileMenuOpen={setIsMobileMenuOpen} userEmail={session.user.email} />
                <main className="flex-1 overflow-y-auto">
                    <AnimatePresence mode="wait">
                        <motion.div key={view} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}>
                            {view === 'home' && <DashboardHome allElections={allElections} voterData={voterData} userProfile={userProfile} />}
                            {view === 'elections' && <ElectionView allElections={allElections} voterData={voterData} onVoteCasted={() => loadAppData(session.user)} />}
                            {view === 'results' && <ResultsView allElections={allElections} onRefresh={() => loadAppData(session.user)} />}
                            {view === 'verification' && <VerificationView voterData={voterData} />}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
}