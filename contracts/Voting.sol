// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19; // Use a recent, stable version

// Import Ownable for access control (makes sure only admin can create elections/record votes)
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Voting Contract
 * @dev A smart contract for managing simple elections where an admin (owner)
 * creates elections and records votes submitted via a backend server.
 * Voters do not interact directly with this contract.
 */
contract Voting is Ownable {

    // --- Structs ---

    struct Candidate {
        uint256 id;         // Unique ID within the election (e.g., 1, 2, 3...)
        string name;       // Name of the candidate
        uint256 voteCount; // Number of votes received
    }

    struct Election {
        uint256 id;                  // Unique ID for the election
        string name;                // Name of the election (e.g., "Student President 2025")
        uint256 startTime;           // Unix timestamp when voting starts
        uint256 endTime;             // Unix timestamp when voting ends
        mapping(uint256 => Candidate) candidates; // Mapping from candidate ID to Candidate struct
        uint256 candidateCount;      // Total number of candidates in this election
        uint256 totalVotes;          // Total votes cast in this election
    }

    // --- State Variables ---

    // Counter to generate unique election IDs
    uint256 private _electionIdCounter;

    // Mapping from election ID to Election struct
    mapping(uint256 => Election) public elections;

    // --- Events ---

    event ElectionCreated(
        uint256 indexed electionId,
        string name,
        uint256 startTime,
        uint256 endTime
    );

    event VoteRecorded(
        uint256 indexed electionId,
        uint256 indexed candidateId
    );


    // --- Constructor ---

    /**
     * @dev Sets the contract deployer as the initial owner.
     * @param initialOwner The address designated as the contract owner (admin).
     */
    constructor(address initialOwner) Ownable(initialOwner) {
        // _electionIdCounter starts at 0 automatically
    }

    // --- Admin Functions (Owner Only) ---

    /**
     * @dev Creates a new election. (Updated Signature!)
     * Only the owner (our server) can call this function.
     * Calculates startTime and endTime based on current time + duration.
     * @param _name The title for the election.
     * @param _candidateNames A list of names for all candidates.
     * @param _durationSeconds The duration of the election in seconds.
     */
    function createElection(
        string memory _name,
        string[] memory _candidateNames,
        uint256 _durationSeconds // Changed from _startTime, _endTime
    ) external onlyOwner {
        // Validation
        require(_durationSeconds > 0, "Voting: Duration must be positive");
        require(_candidateNames.length >= 2, "Voting: Must have at least two candidates");

        // Calculate start and end times based on current block time
        uint256 startTime = block.timestamp; // Election starts now
        uint256 endTime = block.timestamp + _durationSeconds; // Ends after duration

        _electionIdCounter++;
        uint256 newElectionId = _electionIdCounter;

        Election storage newElection = elections[newElectionId];
        newElection.id = newElectionId;
        newElection.name = _name;
        newElection.startTime = startTime; // Use calculated start time
        newElection.endTime = endTime;     // Use calculated end time
        newElection.candidateCount = _candidateNames.length;
        // newElection.totalVotes starts at 0

        // Add candidates (IDs start from 1)
        for (uint256 i = 0; i < _candidateNames.length; i++) {
            // Ensure candidate name is not empty
             require(bytes(_candidateNames[i]).length > 0, "Voting: Candidate name cannot be empty");
            uint256 candidateId = i + 1; // Start candidate IDs from 1
            newElection.candidates[candidateId] = Candidate({
                id: candidateId,
                name: _candidateNames[i],
                voteCount: 0
            });
        }

        // Use calculated start/end times in the event
        emit ElectionCreated(newElectionId, _name, startTime, endTime);
    }


    /**
     * @dev Records a vote for a specific candidate in an ongoing election.
     * Only the owner (our server) can call this function.
     * Assumes the server has already verified the voter's eligibility and single-vote status.
     * @param _electionId The ID of the election.
     * @param _candidateId The ID of the candidate receiving the vote.
     */
    function recordVote(uint256 _electionId, uint256 _candidateId) external onlyOwner {
        // Check if election exists
        require(_electionId > 0 && _electionId <= _electionIdCounter, "Voting: Invalid election ID");

        Election storage currentElection = elections[_electionId];

        // Check if the election is currently active
        require(block.timestamp >= currentElection.startTime, "Voting: Election has not started yet");
        require(block.timestamp < currentElection.endTime, "Voting: Election has already ended");

        // Check if candidate exists within this election
        require(_candidateId > 0 && _candidateId <= currentElection.candidateCount, "Voting: Invalid candidate ID");

        // Increment the candidate's vote count
        currentElection.candidates[_candidateId].voteCount++;
        // Increment total votes for the election
        currentElection.totalVotes++;

        emit VoteRecorded(_electionId, _candidateId);
    }

    // --- Read Functions (Public) ---

    /**
     * @dev Gets the list of candidates and their vote counts for a specific election.
     * @param _electionId The ID of the election.
     * @return An array of Candidate structs for the election.
     */
    function getElectionCandidates(uint256 _electionId)
        external
        view
        returns (Candidate[] memory)
    {
        require(_electionId > 0 && _electionId <= _electionIdCounter, "Voting: Invalid election ID");
        Election storage currentElection = elections[_electionId];

        Candidate[] memory candidateList = new Candidate[](currentElection.candidateCount);

        for (uint256 i = 0; i < currentElection.candidateCount; i++) {
            uint256 candidateId = i + 1; // Candidate IDs start from 1
            candidateList[i] = currentElection.candidates[candidateId];
        }

        return candidateList;
    }

     /**
     * @dev Gets the total number of elections created.
     * @return The current election ID counter.
     */
    function getElectionCount() external view returns (uint256) {
        return _electionIdCounter;
    }

    /**
     * @dev Gets basic details for a specific election.
     * @param _electionId The ID of the election.
     * @return name The name/title of the election.
     * @return startTime The Unix timestamp when the election started/will start.
     * @return endTime The Unix timestamp when the election ended/will end.
     */
    function getElectionDetails(uint256 _electionId)
        external
        view
        returns (
            string memory name,
            uint256 startTime,
            uint256 endTime
        )
    {
        require(_electionId > 0 && _electionId <= _electionIdCounter, "Voting: Invalid election ID");
        Election storage electionData = elections[_electionId];
        return (
            electionData.name,
            electionData.startTime,
            electionData.endTime
        );
    }

}