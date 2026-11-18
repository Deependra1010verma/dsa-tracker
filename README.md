DSA Tracker

A full-stack MERN application for tracking Data Structures and Algorithms (DSA) practice, managing coding problems, and organizing revisions using spaced repetition.

Built with React, TypeScript, Vite, Node.js, and MongoDB.

Features

- Problem Tracking: Organize DSA questions by topics.
- Progress Management: Track problems as Solved, Unsolved, Revisit, or Skipped.
- Notes Management: Save short and detailed notes for individual problems.
- External Links: Store coding problem links from external platforms.
- Topic Progress: Monitor preparation progress across DSA topics.
- Spaced Repetition: Automatically schedule revisions after 1, 3, 7, 15, and 30 days.
- Revision Queue: Identify questions that are due for revision.
- Dashboard Access: Simple login gate for personal use.

Live Demo

"DSA Tracker — Live Application" (https://dsa-deependra.vercel.app/)

Note: The application is currently designed for single-user personal use.

Tech Stack

Layer| Technologies
Frontend| React, TypeScript, Vite
Backend| Node.js, API routes
Database| MongoDB
Deployment| Vercel / Railway

Project Structure

dsa-tracker/
├── api/
│   └── [...path].ts       # Vercel serverless API
├── public/                # Public assets
├── scripts/               # Utility scripts
├── src/
│   ├── api/               # Shared MongoDB models and API logic
│   └── ...                # React frontend
├── .env.example
├── package.json
├── README.md
└── LICENSE

Getting Started

Prerequisites

- Node.js and npm
- MongoDB (local or cloud)
- Git

1. Clone the Repository

git clone https://github.com/Deependra1010verma/dsa-tracker.git
cd dsa-tracker

2. Install Dependencies

npm install

3. Configure Environment Variables

Create a ".env" file in the project root.

MONGODB_URI=mongodb://127.0.0.1:27017/dsa-tracker
PORT=4000

Never commit real database credentials or passwords to GitHub.

4. Start the Application

npm run dev

Follow the terminal output to access the application locally.

Deployment

Vercel

Configure the following environment variables in your Vercel project:

MONGODB_URI=your_mongodb_connection_string
USERNAME=your_login_username
PASSWORD=your_login_password

The application uses:

- "dist/web" as the configured build output.
- "api/[...path].ts" as the Vercel serverless API entrypoint.
- "/api/*" routes for backend requests.

Railway

The application can also be deployed using Railway with the appropriate environment variables and build configuration.

Contributing

Contributions, bug reports, and feature suggestions are welcome.

To contribute:

1. Fork the repository.
2. Create a feature branch.
3. Implement and test your changes.
4. Commit your changes.
5. Open a pull request describing your contribution.

Please avoid committing credentials, secrets, or personal data.

Future Improvements

Potential areas for future development:

- Automated testing and continuous integration.
- Improved accessibility and mobile responsiveness.
- Better analytics and progress visualization.
- Enhanced revision scheduling and reminders.
- Improved documentation and contributor experience.

These are proposed improvements, not currently implemented features.

License

This project is licensed under the MIT License. See the "LICENSE" (LICENSE) file for details.

Maintainer

Deependra Verma

GitHub: "@Deependra1010verma" (https://github.com/Deependra1010verma)

Contributions and constructive feedback are welcome.
