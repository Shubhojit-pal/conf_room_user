import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './context/AuthContext.tsx'
import { SoundProvider } from './components/providers/SoundProvider.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <AuthProvider>
            <ThemeProvider>
                <SoundProvider>
                    <App />
                </SoundProvider>
            </ThemeProvider>
        </AuthProvider>
    </React.StrictMode>,
)
