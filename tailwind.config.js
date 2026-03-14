/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#10b981', // emerald-500
                    dark: '#059669', // emerald-600
                    light: '#d1fae5', // emerald-100
                },
                secondary: {
                    DEFAULT: '#2563eb', // blue-600
                    light: '#dbeafe', // blue-100
                },
                accent: {
                    purple: '#8b5cf6', // violet-500
                    purpleLight: '#ede9fe', // violet-100
                    orange: '#f59e0b', // amber-500
                    orangeLight: '#fef3c7', // amber-100
                    red: '#ef4444', // red-500
                    redLight: '#fee2e2', // red-100
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
