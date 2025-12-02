import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient'; 
import { 
  Plus, Trash2, Loader2, AlertTriangle, CheckCircle, ListPlus, Clock, 
  Shield, BarChart3, List, LogOut, RefreshCw, X
} from 'lucide-react';

const LoadingSpinner = () => <Loader2 size={16} className="animate-spin" />;
const ALL_SECTIONS = Array.from({length: 26}, (_, i) => String.fromCharCode(65 + i)); 

// --- Admin Login Component ---
const AdminLogin = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            // --- FIX: Explicitly trigger success handler ---
            if (data.session) {
                onLoginSuccess(data.session);
            }
        } catch (err) {
            setError("Invalid login credentials.");
        }
        setLoading(false);
    };

    return (
        <div className="flex items-center justify-center min-h-screen w-full bg-gray-950 text-white">
            <div className="w-full max-w-md p-8 bg-gray-900 rounded-lg border border-gray-800 shadow-xl">
                <div className="flex justify-center mb-4"><Shield size={48} className="text-indigo-500"/></div>
                <h2 className="text-2xl font-bold text-center mb-6">Admin Panel Login</h2>
                {error && <div className="p-3 mb-4 bg-red-900/30 text-red-400 rounded border border-red-800 text-sm">{error}</div>}
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Email Address</label>
                        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-3 bg-gray-800 rounded text-white border border-gray-700 focus:border-indigo-500 focus:outline-none transition-colors" placeholder="admin@university.edu" required />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Password</label>
                        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-3 bg-gray-800 rounded text-white border border-gray-700 focus:border-indigo-500 focus:outline-none transition-colors" placeholder="••••••••" required />
                    </div>
                    <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 rounded font-bold hover:bg-indigo-700 transition-colors flex justify-center items-center gap-2">
                        {loading ? <LoadingSpinner /> : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// ... (CreateElectionView and ViewResultsView remain the same as previous version) ...
// ... Copy CreateElectionView and ViewResultsView from the previous response here ...
const CreateElectionView = () => {
    const [electionTitle, setElectionTitle] = useState('');
    const [candidates, setCandidates] = useState(['', '']);
    const [duration, setDuration] = useState(24);
    const [tempYear, setTempYear] = useState('1');
    const [tempSection, setTempSection] = useState('A');
    const [targetPairs, setTargetPairs] = useState([]); 
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const addPair = () => {
        if (!targetPairs.find(p => p.year === tempYear && p.section === tempSection)) {
            setTargetPairs([...targetPairs, { year: tempYear, section: tempSection }]);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault(); setLoading(true); setMessage({});
        const filled = candidates.map(c => c.trim()).filter(c => c !== '');
        
        if (targetPairs.length === 0) { setMessage({ type: 'error', text: 'Add at least one Target Group.' }); setLoading(false); return; }

        try {
            const res = await fetch('/api/createElection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    title: electionTitle, candidates: filled, durationHours: duration,
                    targetYears: targetPairs.map(p => Number(p.year)),
                    targetSections: targetPairs.map(p => p.section)
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setMessage({ type: 'success', text: `Created! ID: ${data.electionId}` });
            setElectionTitle(''); setCandidates(['','']); setTargetPairs([]);
        } catch (err) { setMessage({ type: 'error', text: err.message }); }
        setLoading(false);
    };

    return (
        <div>
            <h2 className="text-3xl font-bold mb-6 text-white">Create Election</h2>
            {message.text && <div className={`p-4 mb-6 rounded ${message.type==='success'?'bg-green-900':'bg-red-900'}`}>{message.text}</div>}
            <form onSubmit={handleCreate} className="bg-gray-800 p-6 rounded border border-gray-700 space-y-6">
                <div><label className="block mb-2 text-gray-300">Title</label><input value={electionTitle} onChange={e=>setElectionTitle(e.target.value)} className="w-full p-3 bg-gray-900 rounded text-white" required /></div>
                
                <div className="p-4 bg-gray-900 rounded border border-gray-600">
                    <label className="block mb-2 text-gray-400">Target Audience</label>
                    <div className="flex gap-2 mb-3">
                        <select value={tempYear} onChange={e=>setTempYear(e.target.value)} className="p-2 bg-gray-800 border border-gray-600 rounded flex-1 text-white">{[1,2,3,4].map(y=><option key={y} value={y}>Year {y}</option>)}</select>
                        <select value={tempSection} onChange={e=>setTempSection(e.target.value)} className="p-2 bg-gray-800 border border-gray-600 rounded flex-1 text-white">{ALL_SECTIONS.map(s=><option key={s} value={s}>Sec {s}</option>)}</select>
                        <button type="button" onClick={addPair} className="px-4 bg-indigo-600 rounded text-white">Add</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {targetPairs.map((p, i) => (
                            <div key={i} className="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded-full text-sm text-white">
                                <span>Y{p.year} - {p.section}</span>
                                <button type="button" onClick={()=>setTargetPairs(targetPairs.filter((_, idx)=>idx!==i))} className="text-red-400 hover:text-red-300"><X size={14}/></button>
                            </div>
                        ))}
                    </div>
                </div>

                <div><label className="block mb-2 text-gray-300">Candidates</label>{candidates.map((c,i) => (<div key={i} className="flex gap-2 mb-2"><input value={c} onChange={e=>{const n=[...candidates];n[i]=e.target.value;setCandidates(n)}} className="flex-1 p-3 bg-gray-900 rounded text-white" required /><button type="button" onClick={()=>candidates.length>2&&setCandidates(candidates.filter((_,x)=>x!==i))} className="text-red-400"><Trash2/></button></div>))}<button type="button" onClick={()=>setCandidates([...candidates,''])} className="text-indigo-400 text-sm hover:text-indigo-300">+ Add Candidate</button></div>
                
                <div><label className="block mb-2 text-gray-300">Duration (Hours)</label><input type="number" value={duration} onChange={e=>setDuration(e.target.value)} min="1" className="w-full p-3 bg-gray-900 rounded text-white" required /></div>
                <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 rounded font-bold text-white hover:bg-indigo-500 transition-colors">{loading?'Creating...':'Create Election'}</button>
            </form>
        </div>
    );
};

const ViewResultsView = () => {
    const [elections, setElections] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if(!session) return;
        try {
            const res = await fetch('/api/getElections', { headers: { 'Authorization': `Bearer ${session.access_token}` } });
            const d = await res.json();
            setElections(d.allElections || []);
        } catch(e) { console.error(e); }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    if(loading) return <div className="p-10 text-center text-white"><LoadingSpinner /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-white">Results</h2><button onClick={fetchData} className="px-4 py-2 bg-indigo-600 rounded text-sm text-white flex items-center gap-2 hover:bg-indigo-500 transition-colors"><RefreshCw size={16}/> Refresh</button></div>
            {elections.length === 0 && <p className="text-gray-500">No elections found.</p>}
            {elections.map(e => (
                <div key={e.id} className="bg-gray-800 p-6 rounded border border-gray-700">
                    <div className="flex justify-between mb-4">
                        <h3 className="text-xl font-bold text-white">{e.title}</h3>
                        <div className="text-right text-xs text-gray-400">
                            {e.targetYears.map((y,i) => <span key={i} className="block">Year {y} - Sec {e.targetSections[i]}</span>)}
                        </div>
                    </div>
                    {e.candidates.map(c => (<div key={c.id} className="flex justify-between mb-2 text-gray-300"><span>{c.name}</span><span className="font-bold text-white">{c.votes}</span></div>))}
                    <div className="mt-4 pt-4 border-t border-gray-700 text-right font-bold text-white">Total: {e.totalVotes}</div>
                </div>
            ))}
        </div>
    );
};

export default function AdminPage() {
    const [session, setSession] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [view, setView] = useState('create');
    const [loading, setLoading] = useState(true);

    // Function to verify admin status
    const checkAdminStatus = async (userSession) => {
        if (!userSession?.user) {
            setIsAdmin(false);
            setLoading(false);
            return;
        }
        const { data, error } = await supabase.from('admins').select('id').eq('id', userSession.user.id).single();
        if (data) {
            setIsAdmin(true);
        } else {
            setIsAdmin(false);
        }
        setLoading(false);
    };

    useEffect(() => {
        // 1. Initial Check
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            checkAdminStatus(session);
        });

        // 2. Listen for Auth Changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            checkAdminStatus(session);
        });

        return () => subscription?.unsubscribe();
    }, []);

    // --- FIX: Explicit Login Success Handler ---
    // This function is passed to the Login component to force an immediate state update
    const handleLoginSuccess = async (newSession) => {
        setSession(newSession);
        setLoading(true); // Show loading while we verify admin status
        await checkAdminStatus(newSession);
    };

    if(loading) return <div className="h-screen bg-gray-950 flex items-center justify-center text-white"><LoadingSpinner /></div>;

    // If not logged in or not an admin, show Login
    if(!session || !isAdmin) {
        return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
    }

    // Admin Dashboard
    return (
        <div className="flex h-screen bg-gray-950 text-white font-inter">
            <div className="w-64 bg-gray-900 p-5 border-r border-gray-800 flex flex-col">
                <h1 className="text-2xl font-bold mb-8 flex items-center gap-2"><Shield className="text-indigo-500"/> Admin</h1>
                <button onClick={()=>setView('create')} className={`text-left p-3 rounded mb-2 flex items-center gap-2 ${view==='create'?'bg-indigo-600 text-white':'text-gray-400 hover:bg-gray-800 hover:text-white'}`}><ListPlus size={18}/> Create</button>
                <button onClick={()=>setView('results')} className={`text-left p-3 rounded mb-2 flex items-center gap-2 ${view==='results'?'bg-indigo-600 text-white':'text-gray-400 hover:bg-gray-800 hover:text-white'}`}><BarChart3 size={18}/> Results</button>
                <button onClick={()=>supabase.auth.signOut()} className="mt-auto text-red-400 flex items-center gap-2 hover:text-red-300 transition-colors"><LogOut size={18}/> Logout</button>
            </div>
            <div className="flex-1 p-10 overflow-y-auto">{view==='create'?<CreateElectionView/>:<ViewResultsView/>}</div>
        </div>
    );
}