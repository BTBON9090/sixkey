# 六脉神键 (Six Pulse Keyboard)

A high-fidelity prototype of a custom 6-key mobile keyboard layout designed for one-handed typing.

## 🚀 How to Deploy

### Step 1: Download & Initialize
1. Download all files from this project to a local folder.
2. Open a terminal in that folder.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Initialize a Git repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

### Step 2: Push to GitHub
1. Create a new repository on [GitHub](https://github.com/new).
2. Follow the instructions to push your local code:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```

### Step 3: Deploy to Netlify
1. Log in to [Netlify](https://app.netlify.com/).
2. Click **"Add new site"** > **"Import from existing project"**.
3. Select **GitHub** and choose your `six-pulse-keyboard` repository.
4. Netlify will automatically detect the settings:
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
5. Click **Deploy**.

## 🛠️ Local Development
To run the app locally on your machine:

```bash
npm run dev
```

## 📱 Features
- **6-Key Layout**: Optimized for ambiguous typing with magnifier selection.
- **Pinyin Engine**: Supports phrase matching (e.g., `pu'rui` -> 普瑞).
- **One-Handed Mode**: Toggle left/right alignment.
- **Gesture Control**: Slide on keys to select specific letters.
