import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home as HomeIcon, Vote, BarChart3, ShieldCheck, Users, Menu, FileText,
  Sparkles, Loader2, HelpCircle, LogIn, LogOut, UserPlus, AlertTriangle, CheckCircle, RefreshCw, GraduationCap
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/router';

// --- 1. SUPABASE CLIENT ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!supabaseUrl || !supabaseAnonKey) console.error("CRITICAL ERROR: Supabase credentials missing.");
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- 2. GEMINI API ---
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

const callGemini = async (prompt) => {
    if (!GEMINI_API_KEY) return "Gemini API key not set.";
     try { const payload = { contents: [{ parts: [{ text: prompt }] }] }; const response = await fetch(GEMINI_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const result = await response.json(); return result.candidates?.[0]?.content?.parts?.[0]?.text || "No response."; } catch (error) { return `Error: ${error.message}`; }
};

// --- Reusable Components ---
const LoadingSpinner = () => <Loader2 size={16} className="animate-spin" />;
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
    e.preventDefault(); setLoading(true); setError(''); setSuccessMessage('');
    try {
        if (isRegistering) {
            if (rollNumber.length !== 13) throw new Error("Roll Number must be exactly 13 characters.");
            const authResponse = await supabase.auth.signUp({ email, password });
            if (authResponse.error) throw authResponse.error;
            const user = authResponse.data?.user;
            if (!user) throw new Error("Signup failed.");
            
            const backendResponse = await fetch('/api/registerUser', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, email: user.email, rollNumber, section, branch, year: Number(year) }),
            });
            if (!backendResponse.ok) { await supabase.auth.signOut(); throw new Error((await backendResponse.json()).error); }
            setSuccessMessage("Registration successful! Check email."); setLoading(false);
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
        }
    } catch (err) { setError(err.message); setLoading(false); }
  };

  return ( 
    <div className="flex items-center justify-center min-h-screen w-full bg-gray-950"> 
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md p-8 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl my-10"> 
            <h1 className="text-3xl font-bold text-white mb-4 text-center">BlockVote</h1> 
            <p className="text-gray-400 text-center mb-6">{isRegistering ? 'Student Registration' : 'Student Login'}</p> 
            <form onSubmit={handleAuth} className="space-y-4"> 
                {isRegistering && ( <>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-sm text-gray-300">Branch</label><select value={branch} onChange={(e) => setBranch(e.target.value)} className="w-full p-3 bg-gray-800 text-white rounded">{BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                        <div><label className="text-sm text-gray-300">Year</label><select value={year} onChange={(e) => setYear(e.target.value)} className="w-full p-3 bg-gray-800 text-white rounded"><option value="1">1st</option><option value="2">2nd</option><option value="3">3rd</option><option value="4">4th</option></select></div>
                    </div>
                    <div><label className="text-sm text-gray-300">Roll No</label><input type="text" value={rollNumber} onChange={(e) => setRollNumber(e.target.value.toUpperCase())} className="w-full p-3 bg-gray-800 text-white rounded" placeholder="AP22..." maxLength={13} required /></div>
                    <div><label className="text-sm text-gray-300">Section</label><select value={section} onChange={(e) => setSection(e.target.value)} className="w-full p-3 bg-gray-800 text-white rounded">{SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                </> )}
                <div><label className="text-sm text-gray-300">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 bg-gray-800 text-white rounded" required /></div> 
                <div><label className="text-sm text-gray-300">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 bg-gray-800 text-white rounded" required /></div> 
                {error && <div className="text-red-400 text-sm">{error}</div>} 
                {successMessage && <div className="text-green-400 text-sm">{successMessage}</div>} 
                <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 text-white rounded font-bold">{loading ? <LoadingSpinner /> : (isRegistering ? 'Register' : 'Login')}</button> 
            </form> 
            <p className="text-center text-sm text-gray-400 mt-6"><button onClick={() => setIsRegistering(!isRegistering)} className="text-indigo-400 hover:underline">{isRegistering ? 'Login' : 'Register'}</button></p> 
        </motion.div> 
    </div> 
  );
};

// --- Sub Components ---
const Sidebar = ({ view, setView, isMobileMenuOpen, setIsMobileMenuOpen }) => {
    const navItems = [ { name: 'Dashboard', icon: HomeIcon, view: 'home' }, { name: 'Elections', icon: Vote, view: 'elections' }, { name: 'Results', icon: BarChart3, view: 'results' }, { name: 'Verify', icon: ShieldCheck, view: 'verification' }, ];
    return ( <> <div className="hidden lg:flex lg:col lg:w-64 h-full bg-gray-900 border-r border-gray-700 p-5 flex-col"><h1 className="text-2xl font-bold text-white mb-8">BlockVote</h1><nav className="flex flex-col gap-2">{navItems.map(item => <button key={item.name} onClick={() => setView(item.view)} className={`flex items-center w-full px-4 py-3 ${view===item.view ? 'bg-indigo-600' : 'hover:bg-gray-800'} text-white rounded`}>{item.name}</button>)}</nav></div> </> );
};

const DashboardHome = ({ allElections, voterData, userProfile }) => (
    <div className="p-8 space-y-6">
      <div className="p-6 bg-indigo-900 rounded-lg shadow-lg">
        <h3 className="text-2xl font-bold text-white">Welcome Back!</h3>
        {userProfile ? <p className="text-indigo-200 mt-2 font-mono">{userProfile.rollNumber} | Year {userProfile.year} | {userProfile.branch} - Sec {userProfile.section}</p> : <p className="text-gray-400">Loading profile...</p>}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-800 p-6 rounded"><p className="text-gray-400">Eligible Elections</p><p className="text-3xl font-bold text-white">{allElections.length}</p></div>
        <div className="bg-gray-800 p-6 rounded"><p className="text-gray-400">Votes Cast</p><p className="text-3xl font-bold text-white">{voterData ? Object.keys(voterData).length : 0}</p></div>
      </div>
    </div>
);

const ElectionView = ({ allElections, voterData, onVoteCasted }) => {
    const [selectedCandidate, setSelectedCandidate] = useState({});
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState({});

    const handleVote = async (elecId, candId) => {
        setLoading(true); setMsg({});
        const { data: { session } } = await supabase.auth.getSession();
        try {
            const res = await fetch('/api/castVote', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }, body: JSON.stringify({ electionId: elecId, candidateId: candId }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setMsg({ [elecId]: { type: 'success', text: `Success! Hash: ${data.transactionHash.substring(0,8)}...` } });
            onVoteCasted();
        } catch (e) { setMsg({ [elecId]: { type: 'error', text: e.message } }); }
        setLoading(false);
    };

    if (!allElections.length) return <div className="p-8 text-gray-400">No matching elections found for your class.</div>;

    return (
        <div className="p-8 space-y-6">
            {allElections.map(e => (
                <div key={e.id} className="bg-gray-800 p-6 rounded border border-gray-700">
                    <div className="flex justify-between mb-4"><h2 className="text-xl font-bold text-white">{e.title}</h2><span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">{e.status}</span></div>
                    {msg[e.id] && <div className={`p-2 mb-4 rounded ${msg[e.id].type==='success'?'bg-green-800':'bg-red-800'} text-white text-sm`}>{msg[e.id].text}</div>}
                    <div className="space-y-2">
                        {e.candidates.map(c => (
                            <button key={c.id} onClick={() => setSelectedCandidate({...selectedCandidate, [e.id]: c.id})} disabled={e.status!=='Active' || voterData?.[e.id]} className={`w-full text-left p-3 rounded border ${selectedCandidate[e.id]===c.id ? 'bg-indigo-900 border-indigo-500' : 'bg-gray-700 border-gray-600'} text-white`}>{c.name}</button>
                        ))}
                    </div>
                    <button onClick={() => handleVote(e.id, selectedCandidate[e.id])} disabled={!selectedCandidate[e.id] || loading || voterData?.[e.id]} className="w-full mt-4 py-2 bg-indigo-600 text-white rounded font-bold disabled:opacity-50">{voterData?.[e.id] ? 'Voted' : loading ? 'Submitting...' : 'Vote'}</button>
                </div>
            ))}
        </div>
    );
};

const ResultsView = ({ allElections, onRefresh }) => {
    const [selectedId, setSelectedId] = useState(null);
    const [analysis, setAnalysis] = useState('');
    const [loading, setLoading] = useState(false);
    const selected = allElections.find(e => e.id === Number(selectedId));

    const getAiAnalysis = async () => {
        if (!selected) return;
        setLoading(true); setAnalysis('');
        const results = selected.candidates.map(c => `${c.name}: ${c.votes}`).join(', ');
        const text = await callGemini(`Analyze election: ${selected.title}. Results: ${results}. Winner?`);
        setAnalysis(text); setLoading(false);
    };

    return (
        <div className="p-8">
            <div className="flex justify-between mb-4"><h2 className="text-2xl text-white font-bold">Results</h2><button onClick={onRefresh} className="bg-indigo-600 px-3 rounded text-white text-sm">Refresh</button></div>
            <select className="w-full p-3 bg-gray-800 text-white rounded mb-6" onChange={(e) => setSelectedId(e.target.value)}><option value="">Select Election</option>{allElections.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}</select>
            {selected && (
                <div className="bg-gray-800 p-6 rounded">
                    <h3 className="text-xl text-white font-bold mb-4">{selected.title}</h3>
                    {selected.candidates.map(c => (
                        <div key={c.id} className="mb-3"><div className="flex justify-between text-gray-300"><span>{c.name}</span><span>{c.votes} votes</span></div><div className="w-full bg-gray-700 h-2 rounded"><div className="bg-indigo-500 h-2 rounded" style={{width: `${selected.totalVotes ? (c.votes/selected.totalVotes)*100 : 0}%`}}></div></div></div>
                    ))}
                    <button onClick={getAiAnalysis} disabled={loading} className="mt-4 text-cyan-400 flex items-center gap-2"><Sparkles size={16}/> {loading?'Generating...':'AI Analysis'}</button>
                    {analysis && <p className="mt-4 p-4 bg-gray-900 rounded text-gray-300 text-sm">{analysis}</p>}
                </div>
            )}
        </div>
    );
};

const VerificationView = ({ voterData }) => {
    const [hash, setHash] = useState('');
    return (
        <div className="p-8">
            <h2 className="text-2xl text-white font-bold mb-4">Verify Vote</h2>
            <p className="text-gray-400 mb-4">Select an election to retrieve your receipt.</p>
            <select className="w-full p-3 bg-gray-800 text-white rounded mb-4" onChange={(e) => setHash(e.target.value)}><option value="">Select Election</option>{voterData && Object.entries(voterData).map(([id, h]) => <option key={id} value={h}>Election ID: {id}</option>)}</select>
            {hash && (
                <div className="bg-gray-800 p-4 rounded break-all text-indigo-300 font-mono text-sm">
                    {hash}
                    <button onClick={() => window.open(`https://www.oklink.com/amoy/tx/${hash}`, '_blank')} className="block mt-4 bg-indigo-600 text-white px-4 py-2 rounded">Verify on Blockchain</button>
                </div>
            )}
        </div>
    );
};

// --- MAIN APP ---
export default function App() {
    const [view, setView] = useState('home');
    const [session, setSession] = useState(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [allElections, setAllElections] = useState([]);
    const [voterData, setVoterData] = useState(null);
    const [userProfile, setUserProfile] = useState(null); 
    const router = useRouter();

    const loadAppData = useCallback(async (user) => {
        if (!user) return;
        try {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            const token = currentSession?.access_token;
            if (!token) return;

            const [elRes, vRes] = await Promise.all([
                fetch('/api/getElections', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/getVoteDetails', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            if (elRes.ok) setAllElections((await elRes.json()).allElections || []);
            if (vRes.ok) {
                const vData = await vRes.json();
                setVoterData(vData.votes_cast || {});
                setUserProfile(vData.profile || null);
            }
        } catch (e) { console.error(e); }
    }, []);

    const checkRole = async (user) => {
        const { data: voter } = await supabase.from('voters').select('id').eq('id', user.id).single();
        if (voter) { loadAppData(user); }
        else {
            const { data: admin } = await supabase.from('admins').select('id').eq('id', user.id).single();
            if (admin) { router.push('/admin'); }
            else { await supabase.auth.signOut(); setSession(null); }
        }
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session); setLoadingAuth(false);
            if(session?.user) checkRole(session.user);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if(session?.user) checkRole(session.user);
        });
        return () => subscription?.unsubscribe();
    }, []);

    if (loadingAuth) return <div className="h-screen bg-gray-950 flex items-center justify-center text-white"><LoadingSpinner/></div>;
    if (!session) return <LoginView />;

    return (
        <div className="flex h-screen bg-gray-950 text-white font-inter">
            <Sidebar view={view} setView={setView} />
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="h-16 border-b border-gray-700 flex items-center justify-between px-8"><h2 className="text-xl font-bold capitalize">{view}</h2><button onClick={() => supabase.auth.signOut()} className="text-sm text-gray-400 hover:text-white">Logout</button></header>
                <main className="flex-1 overflow-y-auto">
                    <AnimatePresence mode="wait">
                        <motion.div key={view} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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