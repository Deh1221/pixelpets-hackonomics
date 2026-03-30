# PixelPets: Documentation, Development, Building, Deployment 
## OVERVIEW
**PixelPets** is an educational web application designed for students to learn **financial literacy** through virtual pet care. Players manage digital pets while **tracking expenses**, completing educational tasks to **earn money**, **setting budgets**, and **achieving goals**.
## Key Features:
- Virtual Pet Care System with real-time stat tracking and mood dynamics
- Financial Management Dashboard with budget visualization and expense tracking
- Educational Task System with AI-powered quizzes that reward in-game currency
- Achievement System with 16+ achievements to motivate engagement
- Global Leaderboards tracking wealth, pet levels, and login streaks
- Multi-pet Support with individual stats and care requirements
- Theme Customization with light/dark mode options

## LICENSE
This project is licensed under the MIT License, so see the LICENSE file for details.

## SETUP & INSTALLATION
### 1️⃣ PREREQUISITES
Before you begin, ensure you have the following:
- Node.js (v16 or higher) - [Download here](https://nodejs.org/)
- npm or yarn package manager
- A GitHub account (for version control)
- A Supabase account - [Sign up here](https://supabase.com)
- A Gemini API key (for quiz generation) - [Get here](https://aistudio.google.com/api-keys)
### 2️⃣ CLONE THE REPOSITORY
```bash
git clone https://github.com/BluePhoenix79/pixelpets.git
cd pixelpets
```
### 3️⃣ INSTALL DEPENDENCIES
```bash
npm install
```
Install Supabase client:
```bash
npm install @supabase/supabase-js
```
Install Chart.js:
```bash
npm install chart.js react-chartjs-2
```
Install React Router:
```bash
npm install react-router-dom
```
### 4️⃣ SET UP SUPABASE DATABASE
- CREATE REQUIRED TABLES
- Log into your Supabase project and run these SQL commands:
Pets Table:
```bash
CREATE TABLE pets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species TEXT NOT NULL CHECK (species IN ('dog', 'cat', 'bird', 'fish', 'mouse')),
  hunger INTEGER DEFAULT 50 CHECK (hunger >= 0 AND hunger <= 100),
  happiness INTEGER DEFAULT 50 CHECK (happiness >= 0 AND happiness <= 100),
  energy INTEGER DEFAULT 50 CHECK (energy >= 0 AND energy <= 100),
  cleanliness INTEGER DEFAULT 50 CHECK (cleanliness >= 0 AND cleanliness <= 100),
  health INTEGER DEFAULT 50 CHECK (health >= 0 AND health <= 100),
  love INTEGER DEFAULT 50 CHECK (love >= 0 AND love <= 100),
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  deleted BOOLEAN DEFAULT FALSE
);
```
User Finances Table:
```bash
CREATE TABLE user_finances (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC DEFAULT 50,
  total_earned NUMERIC DEFAULT 50,
  total_spent NUMERIC DEFAULT 0,
  show_on_leaderboard BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```
Expenses Table:
```bash
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
  expense_type TEXT NOT NULL,
  item_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```
Tasks Table:
```bash
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  reward_amount NUMERIC NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```
Achievements Table:
```bash
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  completed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);
```
User Streak Table:
```bash
CREATE TABLE user_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 1,
  last_login_date DATE DEFAULT CURRENT_DATE,
  login_dates TEXT[] DEFAULT ARRAY[CURRENT_DATE::TEXT],
  show_on_leaderboard BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT NOW()
);
```
Savings Goals Table:
```bash
CREATE TABLE savings_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
  target_amount NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```
User Profiles Table:
```bash
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  theme TEXT DEFAULT 'system',
  show_on_leaderboard BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### CREATE DATABASE TRIGGER (OPTIONAL BUT RECOMMENDED)
This automatically creates finance and profile records when a user signs up:
-- Function to handle new user
```bash
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_finances (user_id, balance, total_earned, total_spent)
  VALUES (NEW.id, 50, 50, 0);
  
  INSERT INTO public.user_streaks (user_id, current_streak, last_login_date)
  VALUES (NEW.id, 1, CURRENT_DATE);
  
  INSERT INTO public.user_profiles (user_id, username)
  VALUES (NEW.id, 'Trainer_' || SUBSTR(NEW.id::TEXT, 1, 8));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

-- Trigger on user creation
```bash
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

CREATE RPC FUNCTIONS
Function to safely increase balance:
```bash
CREATE OR REPLACE FUNCTION increase_balance(
  user_id_in UUID,
  amount_in NUMERIC
)
RETURNS TABLE(user_id UUID, balance NUMERIC, total_earned NUMERIC, total_spent NUMERIC)
AS $$
BEGIN
  RETURN QUERY
  UPDATE user_finances
  SET balance = balance + amount_in,
      total_earned = total_earned + amount_in
  WHERE user_id = user_id_in
  RETURNING user_finances.user_id, user_finances.balance, 
            user_finances.total_earned, user_finances.total_spent;
END;
$$ LANGUAGE plpgsql;
```
Function to safely decrease balance:
```bash
CREATE OR REPLACE FUNCTION decrease_balance(
  user_id_in UUID,
  amount_in NUMERIC
)
RETURNS TABLE(user_id UUID, balance NUMERIC, total_earned NUMERIC, total_spent NUMERIC)
AS $$
BEGIN
  RETURN QUERY
  UPDATE user_finances
  SET balance = balance - amount_in,
      total_spent = total_spent + amount_in
  WHERE user_id = user_id_in
  RETURNING user_finances.user_id, user_finances.balance,
            user_finances.total_earned, user_finances.total_spent;
END;
$$ LANGUAGE plpgsql;
```
Function to get leaderboard by balance:
```bash
CREATE OR REPLACE FUNCTION get_leaderboard_balance(limit_count INT DEFAULT 50)
RETURNS TABLE(user_id UUID, username TEXT, balance NUMERIC, show_on_leaderboard BOOLEAN)
AS $$
BEGIN
  RETURN QUERY
  SELECT uf.user_id, up.username, uf.balance, uf.show_on_leaderboard
  FROM user_finances uf
  JOIN user_profiles up ON uf.user_id = up.user_id
  WHERE uf.show_on_leaderboard = TRUE
  ORDER BY uf.balance DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
```
Function to get leaderboard by pet level:
```bash
CREATE OR REPLACE FUNCTION get_leaderboard_level(limit_count INT DEFAULT 50)
RETURNS TABLE(pet_id UUID, pet_name TEXT, level INTEGER, xp INTEGER, 
              owner_username TEXT, show_on_leaderboard BOOLEAN)
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, p.level, p.xp, up.username, up.show_on_leaderboard
  FROM pets p
  JOIN user_profiles up ON p.owner_id = up.user_id
  WHERE up.show_on_leaderboard = TRUE AND p.deleted = FALSE
  ORDER BY (p.level * 100 + p.xp) DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
```
Function to get leaderboard by streak:
```bash
CREATE OR REPLACE FUNCTION get_leaderboard_streak(limit_count INT DEFAULT 50)
RETURNS TABLE(user_id UUID, username TEXT, current_streak INTEGER, show_on_leaderboard BOOLEAN)
AS $$
BEGIN
  RETURN QUERY
  SELECT us.user_id, up.username, us.current_streak, us.show_on_leaderboard
  FROM user_streaks us
  JOIN user_profiles up ON us.user_id = up.user_id
  WHERE us.show_on_leaderboard = TRUE
  ORDER BY us.current_streak DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
```

SET UP ROW LEVEL SECURITY (RLS)
- Enable RLS on all tables:
```bash
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
```
Pets policies:
```bash
CREATE POLICY "Users can view their own pets"
ON pets FOR SELECT USING (auth.uid() = owner_id OR deleted = FALSE);

CREATE POLICY "Users can create their own pets"
ON pets FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own pets"
ON pets FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own pets"
ON pets FOR DELETE USING (auth.uid() = owner_id);
```
User finances policies:
```bash
CREATE POLICY "Users can view their own finances"
ON user_finances FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own finances"
ON user_finances FOR UPDATE USING (auth.uid() = user_id);
```
User profiles policies:
```bash
CREATE POLICY "Users can view all profiles"
ON user_profiles FOR SELECT USING (TRUE);

CREATE POLICY "Users can update their own profile"
ON user_profiles FOR UPDATE USING (auth.uid() = user_id);
```
Expenses policies:
```bash
CREATE POLICY "Users can view their own expenses"
ON expenses FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own expenses"
ON expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
```
Tasks policies:
```bash
CREATE POLICY "Users can view their own tasks"
ON tasks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tasks"
ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
ON tasks FOR UPDATE USING (auth.uid() = user_id);
```
Achievements policies:
```bash
CREATE POLICY "Users can view their own achievements"
ON achievements FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own achievements"
ON achievements FOR INSERT WITH CHECK (auth.uid() = user_id);
```
Streaks policies:
```bash
CREATE POLICY "Users can view their own streak"
ON user_streaks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own streak"
ON user_streaks FOR UPDATE USING (auth.uid() = user_id);
```
Savings goals policies:
```bash
CREATE POLICY "Users can view their own goals"
ON savings_goals FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own goals"
ON savings_goals FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
ON savings_goals FOR UPDATE USING (auth.uid() = user_id);
```
### 5️⃣ CONFIGURE ENVIRONMENT VARIABLES
Create a .env.local file in the project root:
```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_APP_NAME=PixelPets
VITE_APP_VERSION=1.0.0
```
Then update src/lib/supabase.ts:
```bash
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})
```
### 6️⃣ RUN THE APP LOCALLY
Create vite.config.ts:
```bash
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  }
})
```
Update package.json:
```bash
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext ts,tsx"
  }
}
```
Start the development server:
```bash
npm run dev
```
Open http://localhost:3000 in your browser.
## DEPLOYMENT
### 1️⃣ BUILD FOR PRODUCTION
```bash
npm run build
```
This creates an optimized production build in the dist/ folder.

### 2️⃣ DEPLOY TO HOSTING PLATFORM
#### OPTION A: VERCEL (RECOMMENDED)
Install Vercel CLI:
```bash
npm install -g vercel
```
Deploy:
```bash
vercel
```
#### OPTION B: NETLIFY
Create netlify.toml:
```bash
[build]
publish = "dist"
command = "npm run build"

[[redirects]]
from = "/*"
to = "/index.html"
status = 200
```
Deploy:
```bash
npm install -g netlify-cli
netlify deploy --prod
```
#### OPTION C: GITHUB PAGES
Add to package.json:
```bash
{
  "scripts": {
    "deploy": "vite build && gh-pages -d dist"
  }
}
```
Install and deploy:
```bash
npm install gh-pages --save-dev
npm run deploy
```
### 3️⃣ CONFIGURE SUPABASE FOR PRODUCTION
- Go to Supabase Dashboard > Settings > API
- Update Site URL to your production domain
- Update Redirect URLs to include your deployed domain
- Configure email templates if using email authentication
- Set up email confirmations if required
- Enable SMTP for production emails

### 4️⃣ ENVIRONMENT VARIABLES IN PRODUCTION
- Set environment variables in your hosting platform:
- Vercel: Project Settings > Environment Variables
- Netlify: Site Settings > Build & Deploy > Environment
- GitHub Pages: Add secrets to repository and use them in deployment workflow


### 5️⃣ SETUP GOOGLE OAUTH
- Go to Supabase Dashboard > Authentication > Sign In/Providers
- Find Google and enable the provider
- Go to Google Cloud Console and create a new project
- Go to APIs & Services and create an API key, following the steps
- Get the Client ID & Client Secret and paste it into Supabase
- Save

### TROUBLESHOOTING
#### ISSUE: "No user found" error
Solution:
- Check Supabase authentication settings
- Verify email confirmation is disabled (or emails are being sent)
- Check browser console for specific errors
- Ensure user table exists in Supabase


#### ISSUE: Finance data not loading
Solution:
- Verify user_finances table exists
- Check RLS policies are correct
- Ensure database trigger is set up
- Try calling ensureFinance() manually

#### ISSUE: AI Quizzes not generating
Solution:
- Verify Gemini API key is valid
- Check API rate limits haven't been exceeded
- Ensure request format matches Gemini specification
- Add fallback local games (already implemented)

### CONTRIBUTING
Contributions are welcome! To contribute:
- Fork the repository
- Create a feature branch: git checkout -b feature/example
- Commit changes: git commit -m 'Add example'
- Push to branch: git push origin feature/example
- Open a Pull Request

### CONTACT & SUPPORT
If you have any questions or issues:
- Open an issue on GitHub: https://github.com/BluePhoenix79/pixelpets
- Email: shlokrandalpura@gmail.com or pranavsai.reddi@gmail.com 
- Supabase Docs: https://supabase.com/docs
- React Docs: https://react.dev
- Vite Docs: https://vitejs.dev

