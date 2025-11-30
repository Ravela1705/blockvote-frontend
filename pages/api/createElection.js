import { ethers } from 'ethers';

// --- CONFIGURATION ---
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;

// --- HARDCODED NEW ABI (Bypasses Env Variable Issues) ---
const CONTRACT_ABI = [
  {
    "inputs": [
      { "internalType": "string", "name": "_name", "type": "string" },
      { "internalType": "string[]", "name": "_candidateNames", "type": "string[]" },
      { "internalType": "uint256", "name": "_durationSeconds", "type": "uint256" },
      { "internalType": "uint256", "name": "_targetYear", "type": "uint256" },
      { "internalType": "string", "name": "_targetSection", "type": "string" }
    ],
    "name": "createElection",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "electionId", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "name", "type": "string" },
      { "indexed": false, "internalType": "uint256", "name": "startTime", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "endTime", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "targetYear", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "targetSection", "type": "string" }
    ],
    "name": "ElectionCreated",
    "type": "event"
  }
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    console.log("--- Creating Election (Hardcoded ABI) ---");

    // 1. Connect to Blockchain
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    // 2. Get Data
    const { title, candidates, durationHours, targetYear, targetSection } = req.body;
    
    if (!title || !candidates || !durationHours || !targetYear || !targetSection) {
         return res.status(400).json({ error: 'Missing required fields (Year/Section).' });
    }

    const durationSeconds = durationHours * 60 * 60;
    
    console.log(`Sending: Title="${title}", Year=${targetYear}, Sec="${targetSection}"`);

    // 3. Send Transaction
    // Gas override to ensure it goes through on Amoy
    const gasOverrides = { 
        maxPriorityFeePerGas: ethers.utils.parseUnits('30', 'gwei'), 
        maxFeePerGas: ethers.utils.parseUnits('100', 'gwei') 
    };

    const tx = await contract.createElection(
        title, 
        candidates, 
        durationSeconds, 
        Number(targetYear), 
        targetSection, 
        gasOverrides
    );

    console.log("Tx Sent:", tx.hash);
    const receipt = await tx.wait();
    
    // 4. Get ID from Event
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