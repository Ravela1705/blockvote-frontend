import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { userId, email, rollNumber, section, year, branch, fullName } = req.body; // Added fullName

    if (!userId || !email || !rollNumber || !section || !year || !branch || !fullName) {
        return res.status(400).json({ error: 'All fields (Name, Roll No, Section, Year, Branch) are required.' });
    }

    const cleanRollNo = rollNumber.trim().toUpperCase();
    const cleanSection = section.trim().toUpperCase();
    const cleanBranch = branch.trim().toUpperCase();
    const numericYear = Number(year);

    if (cleanRollNo.length !== 13) return res.status(400).json({ error: 'Roll Number must be exactly 13 characters.' });

    let expectedPrefix = numericYear === 4 ? "AP22" : numericYear === 3 ? "AP23" : numericYear === 2 ? "AP24" : "AP25";
    if (!cleanRollNo.startsWith(expectedPrefix)) {
        return res.status(400).json({ error: `Roll Number mismatch! ${numericYear} Year must start with ${expectedPrefix}.` });
    }

    try {
        const { error } = await supabaseAdmin.from('voters').insert([{
            id: userId,
            email: email,
            full_name: fullName, // Save Name
            roll_number: cleanRollNo,
            academic_year: numericYear,
            section: cleanSection,
            branch: cleanBranch,
            votes_cast: {}
        }]);

        if (error) {
            if (error.code === '23505') return res.status(200).json({ success: true, message: 'User exists.' });
            throw error;
        }
        res.status(200).json({ success: true, uid: userId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}