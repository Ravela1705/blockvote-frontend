import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Server configuration error: Supabase credentials missing.")
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { userId, email, rollNumber, section, year, branch } = req.body;

    // 1. Basic Validation
    if (!userId || !email || !rollNumber || !section || !year || !branch) {
        return res.status(400).json({ error: 'All fields (Roll No, Section, Year, Branch) are required.' });
    }

    const cleanRollNo = rollNumber.trim().toUpperCase();
    const cleanSection = section.trim().toUpperCase();
    const cleanBranch = branch.trim().toUpperCase();
    const numericYear = Number(year);

    // 2. Validate Roll Number Format (13 chars)
    if (cleanRollNo.length !== 13) {
        return res.status(400).json({ error: 'Roll Number must be exactly 13 characters.' });
    }

    // 3. Logic Check: Does Roll No match the Year selected?
    // This prevents a 1st year student from registering as a 4th year to vote in their election.
    let expectedPrefix = "";
    if (numericYear === 4) expectedPrefix = "AP22";
    else if (numericYear === 3) expectedPrefix = "AP23";
    else if (numericYear === 2) expectedPrefix = "AP24";
    else if (numericYear === 1) expectedPrefix = "AP25";

    if (!cleanRollNo.startsWith(expectedPrefix)) {
        return res.status(400).json({ 
            error: `Roll Number mismatch! ${numericYear === 1 ? '1st' : numericYear === 2 ? '2nd' : numericYear === 3 ? '3rd' : '4th'} Year students must have a Roll No starting with ${expectedPrefix}.` 
        });
    }

    try {
        console.log(`Registering: ${email} | ${cleanRollNo} | ${cleanBranch} | Year ${numericYear} | Sec ${cleanSection}`);

        const { data, error } = await supabaseAdmin
            .from('voters')
            .insert([
                {
                    id: userId,
                    email: email,
                    roll_number: cleanRollNo,
                    academic_year: numericYear, // Store the Year explicitly
                    section: cleanSection,
                    branch: cleanBranch,        // Store the Branch
                    votes_cast: {}
                }
            ])
            .select();

        if (error) {
            console.error('Supabase DB insert error:', error);
            if (error.code === '23505') {
                 return res.status(200).json({ success: true, message: 'User already exists.' });
            }
            throw new Error(error.message);
        }

        res.status(200).json({ success: true, uid: userId });

    } catch (error) {
        console.error('Error in registerUser API:', error);
        res.status(500).json({ error: error.message });
    }
}