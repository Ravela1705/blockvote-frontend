import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient'; 
import { 
  Plus, Trash2, Loader2, AlertTriangle, CheckCircle, ListPlus, Clock, 
  LogIn, User, Shield, BarChart3, List, LogOut, RefreshCw, Users 
} from 'lucide-react';

const LoadingSpinner = () => <Loader2 size={16} className="animate-spin" />;
const SECTIONS = Array.from({length: 26}, (_, i) => String.fromCharCode(65 + i)); // A-Z

// --- Admin Login ---
const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
        } catch (err) { setError("Invalid login credentials."); }
        setLoading(false);
    };

    return (
        <div className="flex items-center justify-center min-h-screen w-full bg-gray-950 text-white">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md p-8 bg-gray-900 rounded-2xl shadow-2xl border border-gray-800">
                <div className="flex justify-center mb-6"><Shield className="w-12 h-12 text-indigo-500" /></div>
                <h2 className="text-3xl font-bold text-center text-white mb-2">Admin Panel</h2>
                {error && <div className="p-3 mb-4 text-sm text-red-200 bg-red-900/50 border border-red-700 rounded-lg flex items-center"><AlertTriangle className="w-4 h-4 mr-2" /> {error}</div>}
                <form onSubmit={handleLogin}>
                    <div className="mb-4"><label className="block mb-2 text-sm text-gray-300">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 bg-gray-800 border-gray-700 rounded-lg text-white" required /></div>
                    <div className="mb-6"><label className="block mb-2 text-sm text-gray-300">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 bg-gray-800 border-gray-700 rounded-lg text-white" required /></div>
                    <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex justify-center">{loading ? <LoadingSpinner /> : 'Login'}</button>
                </form>
            </motion.div>
        </div>
    );
};

// --- Create Election View ---
const CreateElectionView = () => {
    const [electionTitle, setElectionTitle] = useState('');
    const [candidates, setCandidates] = useState(['', '']);
    const [duration, setDuration] = useState(24);
    const [targetYear, setTargetYear] = useState('4');
    const [targetSection, setTargetSection] = useState('A'); 

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleCandidateChange = (index, value) => { const newCandidates = [...candidates]; newCandidates[index] = value; setCandidates(newCandidates); };
    const addCandidateField = () => { setCandidates([...candidates, '']); };
    const removeCandidateField = (index) => { if (candidates.length > 2) { const newCandidates = candidates.filter((_, i) => i !== index); setCandidates(newCandidates); } };

    const handleCreateElection = async (e) => {
        e.preventDefault();
        setLoading(true); setMessage({ type: '', text: '' });
        const filledCandidates = candidates.map(c => c.trim()).filter(c => c !== '');
        
        try {
            const response = await fetch('/api/createElection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    title: electionTitle.trim(), 
                    candidates: filledCandidates, 
                    durationHours: Number(duration),
                    targetYear: Number(targetYear),
                    targetSection: targetSection 
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to create election.');
            setMessage({ type: 'success', text: `Election created successfully! ID: ${data.electionId}` });
            setElectionTitle(''); setCandidates(['', '']); 
        } catch (err) { setMessage({ type: 'error', text: err.message || 'Error occurred.' }); }
        setLoading(false);
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="text-3xl font-bold mb-6 text-white">Create New Election</h2>
            {message.text && <div className={`p-4 mb-6 rounded-lg ${message.type === 'success' ? 'bg-green-800 border-green-600' : 'bg-red-800 border-red-600'} border text-white`}>{message.text}</div>}
            
            <form onSubmit={handleCreateElection} className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Election Title</label>
                    <input type="text" value={electionTitle} onChange={(e) => setElectionTitle(e.target.value)} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white" placeholder="e.g., Class Representative" required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Target Year</label>
                        <select value={targetYear} onChange={(e) => setTargetYear(e.target.value)} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white">
                            <option value="1">1st Year (AP25)</option>
                            <option value="2">2nd Year (AP24)</option>
                            <option value="3">3rd Year (AP23)</option>
                            <option value="4">4th Year (AP22)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Target Section</label>
                        <select value={targetSection} onChange={(e) => setTargetSection(e.target.value)} className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white">
                            {SECTIONS.map(sec => <option key={sec} value={sec}>Section {sec}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Candidates</label>
                    <div className="space-y-3">
                        {candidates.map((candidate, index) => (
                            <div key={index} className="flex gap-2">
                                <input type="text" value={candidate} onChange={(e) => handleCandidateChange(index, e.target.value)} className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white" placeholder={`Candidate ${index + 1}`} required />
                                {candidates.length > 2 && <button type="button" onClick={() => removeCandidateField(index)} className="p-2 text-red-400"><Trash2 size={18} /></button>}
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={addCandidateField} className="mt-3 text-sm text-indigo-300 flex items-center gap-2"><Plus size={16} /> Add Candidate</button>
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Duration (Hours)</label>
                    <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} min="1" className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white" required />
                </div>

                <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold">
                    {loading ? 'Creating...' : 'Create Election'}
                </button>
            </form>
        </motion.div>
    );
};

// --- UPDATED: View Results View ---
const ViewResultsView = () => {
    const [allElections, setAllElections] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAllElectionData = useCallback(async () => {
        setLoading(true); 
        try {
            // --- FIX START: Add Authorization Header ---
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            
            if (!token) {
                console.error("No admin session found.");
                return;
            }

            const response = await fetch('/api/getElections', {
                headers: {
                    'Authorization': `Bearer ${token}` // <--- THIS WAS MISSING
                }
            });
            // --- FIX END ---

            const data = await response.json();
            setAllElections(data.allElections || []);
        } catch (err) { console.error(err); }
        setLoading(false);
    }, []);

    useEffect(() => { fetchAllElectionData(); }, [fetchAllElectionData]);

    if (loading) return <div className="text-center p-8"><LoadingSpinner /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-white">Election Results</h2>
                <button onClick={fetchAllElectionData} className="px-4 py-2 bg-indigo-600 rounded-lg text-white flex items-center gap-2"><RefreshCw size={16} /> Refresh</button>
            </div>
            {allElections.length === 0 && <p className="text-gray-400">No elections found.</p>}
            {allElections.map(election => (
                <div key={election.id} className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <div className="flex justify-between">
                        <h3 className="text-xl font-bold text-white">{election.title}</h3>
                        <span className="text-sm bg-gray-700 px-3 py-1 rounded-full text-indigo-300">
                            Year {election.targetYear} - Sec {election.targetSection}
                        </span>
                    </div>
                    <div className="mt-4 space-y-3">
                        {election.candidates.map(c => (
                            <div key={c.id} className="flex justify-between text-gray-300">
                                <span>{c.name}</span>
                                <span className="font-bold text-white">{c.votes} votes</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-700 text-right text-white font-bold">Total: {election.totalVotes}</div>
                </div>
            ))}
        </div>
    );
};

const AdminDashboard = ({ adminEmail }) => {
    const [view, setView] = useState('results');
    return (
        <div className="flex min-h-screen bg-gray-950 text-white">
            <nav className="w-64 bg-gray-900 border-r border-gray-800 p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-10"><Shield className="text-indigo-500" /><span className="text-xl font-bold">Admin</span></div>
                <button onClick={() => setView('results')} className={`w-full text-left p-3 rounded mb-2 ${view==='results'?'bg-indigo-600':''}`}>View Results</button>
                <button onClick={() => setView('create')} className={`w-full text-left p-3 rounded ${view==='create'?'bg-indigo-600':''}`}>Create Election</button>
                <div className="mt-auto pt-4 border-t border-gray-800">
                    <p className="text-xs text-gray-500">{adminEmail}</p>
                    <button onClick={() => supabase.auth.signOut()} className="mt-2 text-red-400 text-sm flex items-center gap-2"><LogOut size={14}/> Logout</button>
                </div>
            </nav>
            <main className="flex-1 p-10 overflow-y-auto">
                {view === 'create' ? <CreateElectionView /> : <ViewResultsView />}
            </main>
        </div>
    );
};

export default function AdminPage() {
    const [session, setSession] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAdmin = async (user) => {
            if (!user) { setIsAdmin(false); return; }
            const { data } = await supabase.from('admins').select('id').eq('id', user.id).single();
            setIsAdmin(!!data);
        };
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            setSession(session);
            await checkAdmin(session?.user);
            setLoading(false);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session);
            await checkAdmin(session?.user);
        });
        return () => subscription?.unsubscribe();
    }, []);

    if (loading) return <div className="flex h-screen items-center justify-center bg-gray-950 text-white"><LoadingSpinner /></div>;
    if (!session || !isAdmin) return session && !isAdmin ? <div className="h-screen flex items-center justify-center bg-gray-950 text-white">Access Denied</div> : <AdminLogin />;
    return <AdminDashboard adminEmail={session.user.email} />;
}