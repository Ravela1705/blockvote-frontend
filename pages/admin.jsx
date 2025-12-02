import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import {
  Plus, Trash2, Loader2, AlertTriangle, CheckCircle, ListPlus, Clock,
  Shield, BarChart3, List, LogOut, RefreshCw, X
} from 'lucide-react';

const LoadingSpinner = () => <Loader2 size={16} className="animate-spin" />;
const ALL_SECTIONS = Array.from({length: 26}, (_, i) => String.fromCharCode(65 + i)); // A-Z

// --- Admin Login ---
const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault(); setLoading(true); setError('');
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
        } catch (err) { setError("Invalid login credentials."); }
        setLoading(false);
    };

    return (
        <div className="flex items-center justify-center min-h-screen w-full bg-gray-950 text-white">
            <div className="w-full max-w-md p-8 bg-gray-900 rounded-2xl shadow-2xl border border-gray-800">
                <h2 className="text-3xl font-bold text-center mb-6">Admin Panel</h2>
                {error && <div className="p-3 mb-4 text-red-400 bg-red-900/20 border border-red-800 rounded">{error}</div>}
                <form onSubmit={handleLogin} className="space-y-4">
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 bg-gray-800 rounded text-white" placeholder="Email" required />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 bg-gray-800 rounded text-white" placeholder="Password" required />
                    <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 rounded hover:bg-indigo-700 font-bold">{loading ? '...' : 'Login'}</button>
                </form>
            </div>
        </div>
    );
};

// --- PAIR-BASED Create Election ---
const CreateElectionView = () => {
    const [electionTitle, setElectionTitle] = useState('');
    const [candidates, setCandidates] = useState(['', '']);
    const [duration, setDuration] = useState(24);

    // --- Pair Logic ---
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

    const removePair = (index) => setTargetPairs(targetPairs.filter((_, i) => i !== index));
    const handleCandidateChange = (i, v) => { const n = [...candidates]; n[i] = v; setCandidates(n); };
    const addCand = () => setCandidates([...candidates, '']);
    const removeCand = (i) => { if(candidates.length > 2) setCandidates(candidates.filter((_, idx) => idx !== i)); };

    const handleCreate = async (e) => {
        e.preventDefault(); setLoading(true); setMessage({type:'',text:''});
        const filled = candidates.map(c => c.trim()).filter(c => c !== '');

        if (targetPairs.length === 0) { setMessage({ type: 'error', text: 'Add at least one Target Group.' }); setLoading(false); return; }

        const yearsArray = targetPairs.map(p => Number(p.year));
        const sectionsArray = targetPairs.map(p => p.section);

        try {
            const res = await fetch('/api/createElection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: electionTitle.trim(),
                    candidates: filled,
                    durationHours: Number(duration),
                    targetYears: yearsArray,
                    targetSections: sectionsArray
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setMessage({ type: 'success', text: `Election Created! ID: ${data.electionId}` });
            setElectionTitle(''); setCandidates(['','']); setTargetPairs([]);
        } catch (err) { setMessage({ type: 'error', text: err.message }); }
        setLoading(false);
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="text-3xl font-bold mb-6 text-white">Create Targeted Election</h2>
            {message.text && <div className={`p-4 mb-6 rounded ${message.type === 'success' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>{message.text}</div>}

            <form onSubmit={handleCreate} className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-6">
                <div><label className="block text-gray-300 mb-2">Title</label><input type="text" value={electionTitle} onChange={e=>setElectionTitle(e.target.value)} className="w-full p-3 bg-gray-900 rounded text-white" placeholder="e.g. Hackathon Registration" required /></div>

                {/* --- Target Audience Pairs --- */}
                <div className="p-4 bg-gray-900 rounded border border-gray-700">
                    <label className="block text-gray-300 mb-2">Target Audience Rules</label>
                    <div className="flex gap-2 mb-3">
                        <select value={tempYear} onChange={e=>setTempYear(e.target.value)} className="p-2 bg-gray-800 text-white rounded border border-gray-600 flex-1">
                            {[1,2,3,4].map(y=><option key={y} value={y}>{y} Year</option>)}
                        </select>
                        <select value={tempSection} onChange={e=>setTempSection(e.target.value)} className="p-2 bg-gray-800 text-white rounded border border-gray-600 flex-1">
                            {ALL_SECTIONS.map(s=><option key={s} value={s}>Section {s}</option>)}
                        </select>
                        <button type="button" onClick={addPair} className="px-4 py-2 bg-indigo-600 rounded text-white text-sm font-bold">Add Group</button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {targetPairs.map((p, i) => (
                            <div key={i} className="flex items-center gap-2 bg-gray-800 border border-gray-600 px-3 py-1 rounded-full text-sm text-indigo-300">
                                <span>Year {p.year} - Sec {p.section}</span>
                                <button type="button" onClick={()=>removePair(i)} className="text-red-400 hover:text-white"><X size={14}/></button>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-gray-300 mb-2">Candidates</label>
                    <div className="space-y-2">{candidates.map((c,i) => (
                        <div key={i} className="flex gap-2"><input value={c} onChange={e=>handleCandidateChange(i,e.target.value)} className="flex-1 p-3 bg-gray-900 rounded text-white" placeholder={`Candidate ${i+1}`} required />
                        {candidates.length>2 && <button type="button" onClick={()=>removeCand(i)} className="text-red-400"><Trash2 size={18}/></button>}</div>
                    ))}</div>
                    <button type="button" onClick={addCand} className="mt-2 text-sm text-indigo-400 flex items-center gap-1"><Plus size={14}/> Add Candidate</button>
                </div>

                <div><label className="block text-gray-300 mb-2">Duration (Hours)</label><input type="number" value={duration} onChange={e=>setDuration(e.target.value)} min="1" className="w-full p-3 bg-gray-900 rounded text-white" required /></div>

                <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded font-bold text-white hover:opacity-90">{loading?'Creating...':'Create Election'}</button>
            </form>
        </motion.div>
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
            // Updated: Added Auth Header to fix empty results for admin
            const res = await fetch('/api/getElections', { headers: { 'Authorization': `Bearer ${session.access_token}` } });
            const d = await res.json();
            setElections(d.allElections || []);
        } catch(e) { console.error(e); }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    if(loading) return <div className="p-10 text-center"><LoadingSpinner /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center"><h2 className="text-2xl font-bold">Results</h2><button onClick={fetchData} className="px-4 py-2 bg-indigo-600 rounded">Refresh</button></div>
            {elections.map(e => (
                <div key={e.id} className="bg-gray-800 p-6 rounded border border-gray-700">
                    <div className="flex justify-between mb-4">
                        <h3 className="text-xl font-bold">{e.title}</h3>
                        <div className="text-right text-xs text-gray-400">
                            {e.targetYears.map((y, i) => (
                                <span key={i} className="block">Year {y} - Sec {e.targetSections[i]}</span>
                            ))}
                        </div>
                    </div>
                    {e.candidates.map(c => (
                        <div key={c.id} className="flex justify-between mb-2 text-gray-300"><span>{c.name}</span><span className="font-bold text-white">{c.votes} votes</span></div>
                    ))}
                    <div className="mt-4 pt-4 border-t border-gray-700 text-right font-bold">Total: {e.totalVotes}</div>
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

    useEffect(() => {
        const check = async (user) => {
            const { data } = await supabase.from('admins').select('id').eq('id', user.id).single();
            setIsAdmin(!!data);
        };
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if(session) check(session.user);
            setLoading(false);
        });
    }, []);

    if(loading) return <div className="h-screen bg-gray-950 flex items-center justify-center text-white"><LoadingSpinner /></div>;
    if(!session || !isAdmin) return session && !isAdmin ? <div className="h-screen bg-gray-950 flex items-center justify-center text-white">Access Denied</div> : <AdminLogin />;

    return (
        <div className="flex h-screen bg-gray-950 text-white font-inter">
            <div className="w-64 bg-gray-900 p-5 border-r border-gray-800 flex flex-col">
                <h1 className="text-2xl font-bold mb-8">Admin</h1>
                <button onClick={()=>setView('create')} className={`text-left p-3 rounded mb-2 ${view==='create'?'bg-indigo-600':'hover:bg-gray-800'}`}>Create</button>
                <button onClick={()=>setView('results')} className={`text-left p-3 rounded mb-2 ${view==='results'?'bg-indigo-600':'hover:bg-gray-800'}`}>Results</button>
                <button onClick={()=>supabase.auth.signOut()} className="mt-auto text-red-400 flex items-center gap-2"><LogOut size={16}/> Logout</button>
            </div>
            <div className="flex-1 p-10 overflow-y-auto">{view==='create'?<CreateElectionView/>:<ViewResultsView/>}</div>
        </div>
    );
}