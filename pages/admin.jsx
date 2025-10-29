import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Loader2, AlertTriangle, CheckCircle, ListPlus, Clock } from 'lucide-react';

// --- Reusable Components ---
const LoadingSpinner = () => <Loader2 size={16} className="animate-spin" />;

// --- Admin View Component ---
const AdminView = () => {
    const [electionTitle, setElectionTitle] = useState('');
    const [candidates, setCandidates] = useState(['', '']); // Start with two candidate fields
    const [duration, setDuration] = useState(24); // Default duration in hours
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleCandidateChange = (index, value) => {
        const newCandidates = [...candidates];
        newCandidates[index] = value;
        setCandidates(newCandidates);
    };

    const addCandidateField = () => {
        setCandidates([...candidates, '']);
    };

    const removeCandidateField = (index) => {
        if (candidates.length > 2) { // Keep at least two candidates
            const newCandidates = candidates.filter((_, i) => i !== index);
            setCandidates(newCandidates);
        }
    };

    const handleCreateElection = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        const filledCandidates = candidates.map(c => c.trim()).filter(c => c !== '');

        if (filledCandidates.length < 2) {
            setMessage({ type: 'error', text: 'Please enter at least two candidate names.' });
            setLoading(false);
            return;
        }
        if (duration <= 0) {
             setMessage({ type: 'error', text: 'Duration must be a positive number of hours.' });
             setLoading(false);
             return;
        }


        try {
            const response = await fetch('/api/createElection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: electionTitle.trim(),
                    candidates: filledCandidates,
                    durationHours: Number(duration) // Ensure it's sent as a number
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create election.');
            }

            setMessage({ type: 'success', text: `Election created! Tx Hash: ${data.transactionHash.substring(0,10)}... Election ID: ${data.electionId}` });
            // Optionally clear the form
            // setElectionTitle('');
            // setCandidates(['', '']);
            // setDuration(24);

        } catch (err) {
            let errorMessage = 'An unknown error occurred.';
            if (err instanceof Error) {
                errorMessage = err.message;
            }
             setMessage({ type: 'error', text: errorMessage });
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 font-inter">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto"
            >
                <h1 className="text-3xl font-bold mb-6 text-center">Admin Panel - Create Election</h1>

                {message.text && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 mb-6 rounded-lg ${message.type === 'success' ? 'bg-green-800 border-green-600' : 'bg-red-800 border-red-600'} border text-white flex items-start gap-2`}
                    >
                        {message.type === 'success' ? <CheckCircle className="shrink-0 mt-1" /> : <AlertTriangle className="shrink-0 mt-1" />}
                        <span>{message.text}</span>
                    </motion.div>
                )}


                <form onSubmit={handleCreateElection} className="bg-gray-800 p-6 rounded-lg border border-gray-700/50 shadow-lg space-y-6">
                    {/* Election Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="electionTitle">
                            Election Title
                        </label>
                        <input
                            type="text"
                            id="electionTitle"
                            value={electionTitle}
                            onChange={(e) => setElectionTitle(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-900 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="e.g., Student Body President 2026"
                            required
                        />
                    </div>

                    {/* Candidates */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Candidates (Minimum 2)
                        </label>
                        <div className="space-y-3">
                            {candidates.map((candidate, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={candidate}
                                        onChange={(e) => handleCandidateChange(index, e.target.value)}
                                        className="flex-1 px-4 py-3 bg-gray-900 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder={`Candidate ${index + 1} Name`}
                                        required={index < 2} // Only first two are strictly required by form
                                    />
                                    {candidates.length > 2 && (
                                        <button
                                            type="button"
                                            onClick={() => removeCandidateField(index)}
                                            className="p-2 text-gray-400 hover:text-red-400"
                                            title="Remove Candidate"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={addCandidateField}
                            className="mt-3 flex items-center gap-2 px-3 py-2 text-sm text-indigo-300 border border-indigo-300/50 rounded-lg hover:bg-indigo-900/50 transition-colors"
                        >
                            <Plus size={16} />
                            <span>Add Candidate</span>
                        </button>
                    </div>

                     {/* Duration */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="duration">
                            Election Duration (Hours)
                        </label>
                         <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <input
                                type="number"
                                id="duration"
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                min="1" // Minimum 1 hour
                                step="1"
                                className="w-full pl-10 pr-4 py-3 bg-gray-900 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                required
                            />
                        </div>
                    </div>


                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-5 py-3 text-white font-semibold bg-linear-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? <LoadingSpinner /> : <ListPlus size={20} />}
                        <span>{loading ? 'Creating Election...' : 'Create Election'}</span>
                    </button>
                </form>
            </motion.div>
        </div>
    );
};

export default AdminView; // Export the component as default for the page
