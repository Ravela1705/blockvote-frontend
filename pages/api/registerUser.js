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

    // NEW: Receive extra data (Roll No, Section)
    const { userId, email, rollNumber, section } = req.body;

    if (!userId || !email || !rollNumber || !section) {
        return res.status(400).json({ error: 'User ID, Email, Roll Number, and Section are required.' });
    }

    // --- NEW: Roll Number Validation Logic ---
    const cleanRollNo = rollNumber.trim().toUpperCase();
    const cleanSection = section.trim().toUpperCase();

    // 1. Check Length (Must be 13 digits)
    if (cleanRollNo.length !== 13) {
        return res.status(400).json({ error: 'Roll Number must be exactly 13 characters.' });
    }

    // 2. Determine Year based on Prefix
    // Logic: AP22 -> 4th, AP23 -> 3rd, AP24 -> 2nd, AP25 -> 1st
    let academicYear = 0;
    
    if (cleanRollNo.startsWith('AP221100')) {
        academicYear = 4;
    } else if (cleanRollNo.startsWith('AP231100')) {
        academicYear = 3;
    } else if (cleanRollNo.startsWith('AP241100')) {
        academicYear = 2;
    } else if (cleanRollNo.startsWith('AP251100')) {
        academicYear = 1;
    } else {
        return res.status(400).json({ error: 'Invalid Roll Number format. Must start with AP22, AP23, AP24, or AP25.' });
    }
    // ------------------------------------------

    try {
        console.log(`Registering: ${email}, Year: ${academicYear}, Section: ${cleanSection}`);

        const { data, error } = await supabaseAdmin
            .from('voters')
            .insert([
                {
                    id: userId,
                    email: email,
                    roll_number: cleanRollNo,    // Save Roll No
                    academic_year: academicYear, // Save Calculated Year
                    section: cleanSection,       // Save Section
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