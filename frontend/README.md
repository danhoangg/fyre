# 🔥 Fyre

**Share your culinary creations with friends.**

Fyre is a social media platform designed for food enthusiasts to share and discover recipes, cooking techniques, and delicious dishes. Whether you're a home chef experimenting with new flavors or simply want to show off what you cooked for dinner, Fyre is where your culinary journey comes to life.

## ✨ Features

- **Share Your Creations**: Post photos and recipes of dishes you've cooked
- **User Profiles**: Create your personalized culinary profile to showcase your cooking journey
- **Social Feed**: Discover what your friends are cooking and get inspired
- **Recipe Storage**: Save and organize your favorite recipes in one place
- **Authentication**: Secure user accounts with email-based authentication
- **Image Uploads**: Upload high-quality photos of your culinary masterpieces

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) with App Router
- **Language**: TypeScript
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **UI Components**: Custom component library with Radix UI primitives
- **Styling**: Tailwind CSS
- **Analytics**: Built-in analytics tracking

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- Firebase project set up
- Environment variables configured

### Installation

1. Clone the repository:
```bash
git clone https://github.com/danhoangg/fyre>
cd fyre
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory with your Firebase configuration:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
NEXT_PUBLIC_FIREBASE_PRIVATE_KEY=your_private_key
NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL=your_client_email
NEXT_PUBLIC_NODE_ENV=production_or_development
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## 📁 Project Structure

```
src/
├── app/              # Next.js app router pages and API routes
│   ├── (auth)/       # Authentication pages (login, signup)
│   ├── (home)/       # Main app pages (feed, account, create post)
│   └── api/          # API endpoints
├── components/       # Reusable UI components
├── context/          # React context providers
├── hooks/            # Custom React hooks
├── lib/              # Utility libraries and Firebase config
└── services/         # Business logic and service layer
```

## 🎨 Key Features in Detail

### User Authentication
- Email-based signup and login
- Secure session management
- Username availability checking
- User profile management

### Post Creation
- Upload images of your cooking
- Add recipes and descriptions
- Share with your network

### Social Features
- View posts from friends
- Browse user profiles
- Personalized feeds

### Storage
- Data stored in collections via Firestotre
- Secure image upload and storage via Firebase Storage

## 🔗 Links

- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
