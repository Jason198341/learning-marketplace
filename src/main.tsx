/// <reference types="vite/client" />
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { useAuthStore } from './store/authStore';

// Initialize Supabase auth state with timeout
async function initializeApp() {
  try {
    // Initialize auth state from Supabase session with 3 second timeout
    const timeout = new Promise<void>((resolve) => {
      setTimeout(() => {
        console.warn('[Init] Auth initialization timeout - proceeding without auth');
        useAuthStore.setState({ isLoading: false });
        resolve();
      }, 3000);
    });

    await Promise.race([
      useAuthStore.getState().initialize(),
      timeout
    ]);
  } catch (error) {
    console.error('[Init] Failed to initialize:', error);
    useAuthStore.setState({ isLoading: false });
  }
}

initializeApp().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}).catch((error) => {
  console.error('App initialization failed:', error);
  // Render anyway even if init fails
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
