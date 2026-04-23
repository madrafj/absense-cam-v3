import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'models/*.json', 
        'models/*.shard*', 
        'sample-face.jpg', 
        'favicon.ico', 
        'logo192.png', 
        'logo512.png', 
        'favicon.svg'
      ],
      manifest: {
        name: 'Absense Cam V3',
        short_name: 'AbsenseCam',
        description: 'Real-time Facial Recognition Attendance System',
        theme_color: '#570df8',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'logo192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'logo512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    host: true
  }
})
