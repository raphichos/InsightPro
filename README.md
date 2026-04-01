# InsightPro - Advanced Data Analytics Dashboard

InsightPro is a professional-grade, high-performance data visualization and analytics platform. It empowers businesses to transform raw data into actionable intelligence through interactive visualizations and AI-driven analysis.

## | Key Features

- **Multi-Format Data Ingestion**: Seamlessly upload and process CSV, Excel (XLSX), and JSON data sources.
- **Interactive Visualizations**: High-fidelity charts including Bar, Line, Area, and Pie charts powered by Recharts.
- **AI-Powered Insights**: Integrated with Gemini 3.1 Pro to provide deep contextual analysis and strategic recommendations based on your data.
- **Professional PDF Reporting**: Export high-quality, A4-formatted PDF reports of your dashboard for stakeholder presentations.
- **Modern Dark Interface**: A sleek, high-contrast dark theme designed for clarity and reduced eye strain during long analysis sessions.
- **Responsive Design**: Fully optimized for desktop and mobile viewing.

## | Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS v4
- **Charts**: Recharts
- **Animations**: Framer Motion
- **PDF Generation**: jsPDF & html2canvas
- **AI Engine**: Google Gemini 3.1 Pro

## | Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## | License

This project is licensed under the MIT License.