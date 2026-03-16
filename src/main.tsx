import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './context/AuthContext.tsx'
import { SoundProvider } from './components/providers/SoundProvider.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <AuthProvider>
            <SoundProvider>
                <App />
            </SoundProvider>
        </AuthProvider>
    </React.StrictMode>,
)
