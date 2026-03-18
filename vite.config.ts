import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        strictPort: true,
        host: '0.0.0.0'
    },
    build: {
        chunkSizeWarningLimit: 1200,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        // Extract the largest libraries into their own chunks
                        if (id.includes('@phosphor-icons')) {
                            return 'icons';
                        }
                        if (id.includes('jspdf') || id.includes('html2canvas')) {
                            return 'pdf-vendor';
                        }
                        // Group remaining dependencies into a standard vendor chunk
                        return 'vendor';
                    }
                }
            }
        }
    }
})
