import { ethers } from 'ethers';

const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;

// Decode ABI logic...
let CONTRACT_ABI;
try {
    const abiBase64 = process.env.NEXT_PUBLIC_CONTRACT_ABI;
    const abiString = Buffer.from(abiBase64, 'base64').toString('utf-8');
    CONTRACT_ABI = JSON.parse(abiString);
} catch (e) {
    throw new Error("ABI Decode Error");
}

let contract;
try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
} catch(e){
    throw new Error("Blockchain Connection Error");
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    // 1. Extract new fields from request body
    const { title, candidates, durationHours, targetYear, targetSection } = req.body;

    // 2. Validate inputs
    if (!title || !candidates || candidates.length < 2 || !durationHours || !targetYear || !targetSection) {
         return res.status(400).json({ error: 'Missing required fields (Year/Section).' }); 
    }

    const durationSeconds = durationHours * 60 * 60;
    
    // 3. Call Smart Contract with NEW arguments
    const gasOverrides = { maxPriorityFeePerGas: ethers.utils.parseUnits('30', 'gwei'), maxFeePerGas: ethers.utils.parseUnits('100', 'gwei') };
    
    // NOTE: This MUST match your new Solidity function signature
    const tx = await contract.createElection(
        title, 
        candidates, 
        durationSeconds, 
        targetYear,    // Passing Year
        targetSection, // Passing Section
        gasOverrides
    );

    const receipt = await tx.wait();
    
    // Extract ID...
    let electionId = "N/A";
    if (receipt.events) { 
        const event = receipt.events.find(e => e.event === 'ElectionCreated'); 
        if (event?.args?.electionId) electionId = event.args.electionId.toString(); 
    }

    res.status(200).json({ success: true, transactionHash: tx.hash, electionId });

  } catch (error) {
    console.error('Create Election Error:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
}