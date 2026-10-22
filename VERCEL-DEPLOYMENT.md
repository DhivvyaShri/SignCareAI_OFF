# Vercel frontend deployment

1. Push the project root (the folder containing `package.json`) to a Git repository.
2. Import that repository in Vercel.
3. Use Vite, build command `npm run build`, output directory `dist`.
4. Deploy the Flask API separately on a Python host.
5. In Vercel → Project Settings → Environment Variables, set `VITE_API_URL` to the backend's public HTTPS URL (for example, `https://your-api-host.example.com`, replacing it with the actual URL).
6. Redeploy the frontend. A deployed page cannot access your laptop's `127.0.0.1` backend.
7. Open `<backend-url>/health` and check `model_loaded` and `word_model_loaded`. A healthy API does not mean either model has been trained.

The frontend can still demonstrate text cards and manual messaging without trained model files. Camera prediction needs a reachable backend and the corresponding trained model.
