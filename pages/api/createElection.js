import { ethers } from 'ethers';
import { Buffer } from 'buffer';

const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  console.log("--- DEBUG START: Create Election ---");

  try {
    // 1. Decode and Log ABI Structure
    const abiBase64 = process.env.NEXT_PUBLIC_CONTRACT_ABI;
    if (!abiBase64) throw new Error("Missing NEXT_PUBLIC_CONTRACT_ABI");

    const abiString = Buffer.from(abiBase64, 'base64').toString('utf-8');
    const parsedABI = JSON.parse(abiString);

    // FIND THE FUNCTION IN THE ABI
    const functionDef = parsedABI.find(item => item.name === 'createElection' && item.type === 'function');
    
    if (functionDef) {
        console.log("DEBUG: ABI 'createElection' inputs found:", functionDef.inputs.length);
        console.log("DEBUG: Input Names:", functionDef.inputs.map(i => i.name));
        
        // CRITICAL CHECK
        if (functionDef.inputs.length === 3) {
            console.error("CRITICAL ERROR: The Loaded ABI is OLD (3 inputs). It needs 5 inputs.");
            return res.status(500).json({ error: "Configuration Error: Vercel has the OLD ABI. Please update Env Vars." });
        }
    } else {
        console.error("DEBUG: 'createElection' function NOT found in ABI.");
    }

    // 2. Connect to Contract
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, parsedABI, wallet);

    // 3. Prepare Data
    const { title, candidates, durationHours, targetYear, targetSection } = req.body;
    console.log("DEBUG: Received Data ->", { title, candidates, durationHours, targetYear, targetSection });

    if (!title || !candidates || !durationHours || !targetYear || !targetSection) {
         return res.status(400).json({ error: 'Missing required fields.' });
    }

    const durationSeconds = durationHours * 60 * 60;
    const gasOverrides = { maxPriorityFeePerGas: ethers.utils.parseUnits('30', 'gwei'), maxFeePerGas: ethers.utils.parseUnits('100', 'gwei') };

    // 4. Send Transaction
    console.log("DEBUG: Sending transaction with 5 arguments...");
    const tx = await contract.createElection(
        title, 
        candidates, 
        durationSeconds, 
        Number(targetYear), 
        targetSection, 
        gasOverrides
    );

    console.log("DEBUG: Transaction Sent:", tx.hash);
    const receipt = await tx.wait();
    
    let electionId = "N/A";
    if (receipt.events) { 
        const event = receipt.events.find(e => e.event === 'ElectionCreated'); 
        if (event?.args?.electionId) electionId = event.args.electionId.toString(); 
    }

    res.status(200).json({ success: true, transactionHash: tx.hash, electionId });

  } catch (error) {
    console.error('Create Election Error:', error);
    res.status(500).json({ error: error.message, details: error });
  }
}