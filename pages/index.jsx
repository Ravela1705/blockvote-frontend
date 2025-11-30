import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home as HomeIcon, Vote, BarChart3, ShieldCheck, Menu, FileText,
  Sparkles, Loader2, LogIn, LogOut, UserPlus, AlertTriangle, CheckCircle, RefreshCw, GraduationCap
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/router';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const callGemini = async (prompt) => {
    if (!GEMINI_API_KEY) return "Gemini Key Missing";
     try { const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }); return (await r.json()).candidates?.[0]?.content?.parts?.[0]?.text || "No response"; } catch (e) { return "Error generating analysis."; }
};

const LoadingSpinner = () => <Loader2 size={16} className="animate-spin" />;
const SECTIONS = Array.from({length: 26}, (_, i) => String.fromCharCode(65 + i));
const BRANCHES = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'BBA', 'BSC'];

const LoginView = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(''); // New State
  const [rollNumber, setRollNumber] = useState('');
  const [section, setSection] = useState('A');
  const [branch, setBranch] = useState('CSE');
  const [year, setYear] = useState('4'); 
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault(); setLoading(true); setError(''); setSuccess('');
    try {
        if (isRegistering) {
            if (rollNumber.length !== 13) throw new Error("Roll No must be 13 chars.");
            const { data, error: upErr } = await supabase.auth.signUp({ email, password });
            if (upErr) throw upErr;
            if (!data.user) throw new Error("Signup failed.");
            
            const res = await fetch('/api/registerUser', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: data.user.id, email: data.user.email, fullName, rollNumber, section, branch, year: Number(year) }),
            });
            if (!res.ok) { await supabase.auth.signOut(); throw new Error((await res.json()).error); }
            setSuccess("Registered! Check email."); 
        } else {
            const { error: inErr } = await supabase.auth.signInWithPassword({ email, password });
            if (inErr) throw inErr;
        }
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  return ( 
    <div className="flex items-center justify-center min-h-screen w-full bg-gray-950"> 
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md p-8 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl my-10"> 
            <h1 className="text-3xl font-bold text-white mb-4 text-center">BlockVote</h1> 
            <form onSubmit={handleAuth} className="space-y-4"> 
                {isRegistering && ( <>
                    <div><label className="text-sm text-gray-300">Full Name</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full p-3 bg-gray-800 text-white rounded" placeholder="John Doe" required /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-sm text-gray-300">Branch</label><select value={branch} onChange={(e) => setBranch(e.target.value)} className="w-full p-3 bg-gray-800 text-white rounded">{BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                        <div><label className="text-sm text-gray-300">Year</label><select value={year} onChange={(e) => setYear(e.target.value)} className="w-full p-3 bg-gray-800 text-white rounded"><option value="1">1st</option><option value="2">2nd</option><option value="3">3rd</option><option value="4">4th</option></select></div>
                    </div>
                    <div><label className="text-sm text-gray-300">Roll No</label><input type="text" value={rollNumber} onChange={(e) => setRollNumber(e.target.value.toUpperCase())} className="w-full p-3 bg-gray-800 text-white rounded" maxLength={13} required /></div>
                    <div><label className="text-sm text-gray-300">Section</label><select value={section} onChange={(e) => setSection(e.target.value)} className="w-full p-3 bg-gray-800 text-white rounded">{SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                </> )}
                <div><label className="text-sm text-gray-300">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 bg-gray-800 text-white rounded" required /></div> 
                <div><label className="text-sm text-gray-300">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 bg-gray-800 text-white rounded" required /></div> 
                {error && <div className="text-red-400 text-sm">{error}</div>} {success && <div className="text-green-400 text-sm">{success}</div>} 
                <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 text-white rounded font-bold">{loading ? <LoadingSpinner /> : (isRegistering ? 'Register' : 'Login')}</button> 
            </form> 
            <p className="text-center text-sm text-gray-400 mt-6"><button onClick={() => setIsRegistering(!isRegistering)} className="text-indigo-400 hover:underline">{isRegistering ? 'Login' : 'Register'}</button></p> 
        </motion.div> 
    </div> 
  );
};

const DashboardHome = ({ allElections, voterData, userProfile }) => (
    <div className="p-8 space-y-6">
      <div className="p-6 bg-indigo-900 rounded-lg shadow-lg">
        <h3 className="text-2xl font-bold text-white">Welcome, {userProfile?.name || 'Student'}!</h3>
        <p className="text-indigo-300 text-sm mb-2">{userProfile?.email}</p>
        {userProfile ? <p className="text-indigo-200 font-mono text-sm">{userProfile.rollNumber} | Year {userProfile.year} | {userProfile.branch} - Sec {userProfile.section}</p> : <p className="text-gray-400">Loading...</p>}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-800 p-6 rounded"><p className="text-gray-400">Eligible Elections</p><p className="text-3xl font-bold text-white">{allElections.length}</p></div>
        <div className="bg-gray-800 p-6 rounded"><p className="text-gray-400">Votes Cast</p><p className="text-3xl font-bold text-white">{voterData ? Object.keys(voterData).length : 0}</p></div>
      </div>
    </div>
);

const ElectionView = ({ allElections, voterData, onVoteCasted }) => {
    const [sel, setSel] = useState({});
    const [load, setLoad] = useState(false);
    const [msg, setMsg] = useState({});

    const vote = async (eid, cid) => {
        setLoad(true); setMsg({});
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/castVote', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }, body: JSON.stringify({ electionId: eid, candidateId: cid }) });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error);
            setMsg({ [eid]: { type: 'success', text: `Hash: ${d.transactionHash.substring(0,10)}...` } });
            onVoteCasted();
        } catch (e) { setMsg({ [eid]: { type: 'error', text: e.message } }); } finally { setLoad(false); }
    };

    if (!allElections.length) return <div className="p-8 text-gray-400">No elections found.</div>;
    return (
        <div className="p-8 space-y-6">
            {allElections.map(e => (
                <div key={e.id} className="bg-gray-800 p-6 rounded border border-gray-700">
                    <div className="flex justify-between mb-4"><h2 className="text-xl font-bold text-white">{e.title}</h2><span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">{e.status}</span></div>
                    {msg[e.id] && <div className={`p-2 mb-4 rounded text-white text-sm ${msg[e.id].type==='success'?'bg-green-800':'bg-red-800'}`}>{msg[e.id].text}</div>}
                    <div className="space-y-2">{e.candidates.map(c => <button key={c.id} onClick={() => setSel({...sel, [e.id]: c.id})} disabled={e.status!=='Active'||voterData?.[e.id]} className={`w-full text-left p-3 rounded border ${sel[e.id]===c.id ? 'bg-indigo-900 border-indigo-500' : 'bg-gray-700 border-gray-600'} text-white`}>{c.name}</button>)}</div>
                    <button onClick={() => vote(e.id, sel[e.id])} disabled={!sel[e.id]||load||voterData?.[e.id]} className="w-full mt-4 py-2 bg-indigo-600 text-white rounded font-bold disabled:opacity-50">{voterData?.[e.id]?'Voted':load?'...':'Vote'}</button>
                </div>
            ))}
        </div>
    );
};

const ResultsView = ({ allElections, onRefresh }) => {
    const [sid, setSid] = useState(null);
    const [ai, setAi] = useState('');
    const [load, setLoad] = useState(false);
    const sel = allElections.find(e => e.id === Number(sid));

    const genAi = async () => {
        if(!sel) return; setLoad(true); setAi('');
        const res = sel.candidates.map(c => `${c.name}:${c.votes}`).join(',');
        setAi(await callGemini(`Election: ${sel.title}. Results: ${res}. Analyze.`));
        setLoad(false);
    };

    return (
        <div className="p-8">
            <div className="flex justify-between mb-4"><h2 className="text-2xl text-white font-bold">Results</h2><button onClick={onRefresh} className="bg-indigo-600 px-3 rounded text-white text-sm">Refresh</button></div>
            <select className="w-full p-3 bg-gray-800 text-white rounded mb-6" onChange={(e) => setSid(e.target.value)}><option value="">Select</option>{allElections.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}</select>
            {sel && (
                <div className="bg-gray-800 p-6 rounded">
                    <h3 className="text-xl text-white font-bold mb-4">{sel.title}</h3>
                    {sel.candidates.map(c => (<div key={c.id} className="mb-3"><div className="flex justify-between text-gray-300"><span>{c.name}</span><span>{c.votes}</span></div><div className="w-full bg-gray-700 h-2 rounded"><div className="bg-indigo-500 h-2 rounded" style={{width: `${sel.totalVotes?(c.votes/sel.totalVotes)*100:0}%`}}></div></div></div>))}
                    <button onClick={genAi} disabled={load} className="mt-4 text-cyan-400 flex items-center gap-2"><Sparkles size={16}/> {load?'...':'AI Analysis'}</button>
                    {ai && <p className="mt-4 p-4 bg-gray-900 rounded text-gray-300 text-sm">{ai}</p>}
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
            <select className="w-full p-3 bg-gray-800 text-white rounded mb-4" onChange={(e) => setHash(e.target.value)}><option value="">Select Election</option>{voterData && Object.entries(voterData).map(([id, h]) => <option key={id} value={h}>ID: {id}</option>)}</select>
            {hash && (<div className="bg-gray-800 p-4 rounded text-indigo-300 font-mono text-sm">{hash}<button onClick={() => window.open(`https://www.oklink.com/amoy/tx/${hash}`, '_blank')} className="block mt-4 bg-indigo-600 text-white px-4 py-2 rounded">Check on Blockchain</button></div>)}
        </div>
    );
};

export default function App() {
    const [view, setView] = useState('home');
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({ elections: [], votes: null, profile: null });
    const router = useRouter();

    const loadData = useCallback(async (user) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if(!token) return;
            const [eRes, vRes] = await Promise.all([ fetch('/api/getElections', { headers: { 'Authorization': `Bearer ${token}` } }), fetch('/api/getVoteDetails', { headers: { 'Authorization': `Bearer ${token}` } }) ]);
            const eData = await eRes.json();
            const vData = await vRes.json();
            setData({ elections: eData.allElections||[], votes: vData.votes_cast||{}, profile: vData.profile||null });
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session); setLoading(false);
            if(session?.user) checkRole(session.user);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if(session?.user) checkRole(session.user);
        });
        return () => subscription?.unsubscribe();
    }, []);

    const checkRole = async (user) => {
        const { data: voter } = await supabase.from('voters').select('id').eq('id', user.id).single();
        if (voter) loadData(user);
        else {
            const { data: admin } = await supabase.from('admins').select('id').eq('id', user.id).single();
            if (admin) router.push('/admin');
            else { await supabase.auth.signOut(); setSession(null); }
        }
    };

    if (loading) return <div className="h-screen bg-gray-950 flex items-center justify-center text-white"><LoadingSpinner/></div>;
    if (!session) return <LoginView />;

    return (
        <div className="flex h-screen bg-gray-950 text-white font-inter">
            <div className="hidden lg:flex flex-col w-64 bg-gray-900 border-r border-gray-700 p-5"><h1 className="text-2xl font-bold mb-8">BlockVote</h1><nav className="flex flex-col gap-2">{['Dashboard','Elections','Results','Verify'].map(n => <button key={n} onClick={() => setView(n.toLowerCase())} className={`px-4 py-3 text-left rounded ${view===n.toLowerCase()?'bg-indigo-600':'hover:bg-gray-800'}`}>{n}</button>)}</nav></div>
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 border-b border-gray-700 flex items-center justify-between px-8"><h2 className="text-xl font-bold capitalize">{view}</h2><button onClick={() => supabase.auth.signOut()} className="text-sm text-gray-400 hover:text-white">Logout</button></header>
                <main className="flex-1 overflow-y-auto"><AnimatePresence mode="wait"><motion.div key={view} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>{view==='home'?<DashboardHome allElections={data.elections} voterData={data.votes} userProfile={data.profile}/>:view==='elections'?<ElectionView allElections={data.elections} voterData={data.votes} onVoteCasted={()=>loadData(session.user)}/>:view==='results'?<ResultsView allElections={data.elections} onRefresh={()=>loadData(session.user)}/>:<VerificationView voterData={data.votes}/>}</motion.div></AnimatePresence></main>
            </div>
        </div>
    );
}