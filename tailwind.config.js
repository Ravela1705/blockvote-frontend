    /** @type {import('tailwindcss').Config} */
    module.exports = {
      content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        // If you create an 'app' directory, add this:
        // "./app/**/*.{js,ts,jsx,tsx,mdx}", 
      ],
      theme: {
        extend: {
          fontFamily: {
            // This makes 'Inter' the default font, as we used in the code
            inter: ['"Inter"', 'sans-serif'],
          },
        },
      },
      plugins: [],
    };
    
