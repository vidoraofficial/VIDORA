import { getApp, getApps, initializeApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key)

if (missing.length) {
  throw new Error(
    `VIDORA Firebase configuration is incomplete. Missing: ${missing.join(', ')}`,
  )
}

const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig)

export const auth = getAuth(firebaseApp)

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn('[VIDORA] Firebase persistence setup failed:', error)
})

export { firebaseApp }