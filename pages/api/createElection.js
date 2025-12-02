import { ethers } from 'ethers';

// --- CONFIG ---
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;

// --- NEW ABI FOR ARRAYS ---
const CONTRACT_ABI = [
  {
    "inputs": [
      { "internalType": "string", "name": "_name", "type": "string" },
      { "internalType": "string[]", "name": "_candidateNames", "type": "string[]" },
      { "internalType": "uint256", "name": "_durationSeconds", "type": "uint256" },
      { "internalType": "uint256[]", "name": "_targetYears", "type": "uint256[]" }, // Array
      { "internalType": "string[]", "name": "_targetSections", "type": "string[]" }   // Array
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
      { "indexed": false, "internalType": "uint256[]", "name": "targetYears", "type": "uint256[]" },
      { "indexed": false, "internalType": "string[]", "name": "targetSections", "type": "string[]" }
    ],
    "name": "ElectionCreated",
    "type": "event"
  }
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    const { title, candidates, durationHours, targetYears, targetSections } = req.body;
    
    // Updated Validation
    if (!title || !candidates || !durationHours || !targetYears.length || !targetSections.length) {
         return res.status(400).json({ error: 'Missing required fields (Years/Sections).' });
    }

    const durationSeconds = durationHours * 60 * 60;
    
    console.log(`Creating Election: ${title} for Years: [${targetYears}] Sections: [${targetSections}]`);

    const gasOverrides = { 
        maxPriorityFeePerGas: ethers.utils.parseUnits('30', 'gwei'), 
        maxFeePerGas: ethers.utils.parseUnits('100', 'gwei') 
    };

    const tx = await contract.createElection(
        title, 
        candidates, 
        durationSeconds, 
        targetYears,    // Passing Array
        targetSections, // Passing Array
        gasOverrides
    );

    await tx.wait();
    
    // We can't easily get the ID from logs without complex parsing, but on success we assume it worked.
    // Ideally we parse the logs, but for now sending success is enough.
    res.status(200).json({ success: true, transactionHash: tx.hash, electionId: "Created" });

  } catch (error) {
    console.error('Create Election Error:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
}