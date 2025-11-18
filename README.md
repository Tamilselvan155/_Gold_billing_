# Vannamiyal Thangamaligai

An offline-capable gold jewelry billing system built with React frontend and Node.js backend using SQLite database.

## Project Structure

```
gold-billing-system/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── Billing.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Inventory.tsx
│   │   │   ├── LanguageSwitcher.tsx
│   │   │   ├── Layout.tsx
│   │   │   └── Settings.tsx
│   │   ├── contexts/        # React contexts
│   │   │   └── LanguageContext.tsx
│   │   ├── i18n/           # Internationalization
│   │   │   └── index.ts
│   │   ├── locales/        # Translation files
│   │   │   ├── en/
│   │   │   └── ta/
│   │   ├── services/       # API services
│   │   │   └── api.ts
│   │   ├── types/          # TypeScript type definitions
│   │   │   └── index.ts
│   │   ├── utils/          # Utility functions
│   │   │   └── database.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── env.example
├── backend/                 # Node.js backend API
│   ├── src/
│   │   ├── database/       # Database configuration
│   │   │   ├── connection.ts
│   │   │   ├── schema.sql
│   │   │   ├── migrate.ts
│   │   │   └── seed.ts
│   │   ├── middleware/     # Express middleware
│   │   │   ├── errorHandler.ts
│   │   │   └── notFound.ts
│   │   ├── routes/         # API routes
│   │   │   ├── products.ts
│   │   │   ├── customers.ts
│   │   │   ├── invoices.ts
│   │   │   ├── inventory.ts
│   │   │   └── dashboard.ts
│   │   └── server.ts       # Main server file
│   ├── database/           # SQLite database files
│   ├── package.json
│   ├── tsconfig.json
│   └── env.example
├── package.json            # Root package.json for workspace management
└── README.md
```

## Features

### Frontend (React + TypeScript)
- **Dashboard**: Overview of sales, inventory, and key metrics
- **Inventory Management**: Product management with stock tracking
- **Billing System**: Create and manage invoices
- **Customer Management**: Customer database and history
- **Settings**: Application configuration
- **Multi-language Support**: English and Tamil
- **Responsive Design**: Works on desktop and mobile devices

### Backend (Node.js + Express + SQLite)
- **RESTful API**: Complete CRUD operations for all entities
- **SQLite Database**: Lightweight, file-based database for offline usage
- **Data Validation**: Input validation and error handling
- **Database Migrations**: Schema management and versioning
- **Seed Data**: Initial data population
- **CORS Support**: Cross-origin resource sharing configuration

### Database Schema
- **Products**: Gold jewelry items with specifications
- **Customers**: Customer information and contact details
- **Invoices**: Sales transactions with line items
- **Invoice Items**: Detailed breakdown of sold items
- **Stock Transactions**: Inventory movement tracking
- **Gold Rates**: Historical gold price tracking
- **Settings**: Application configuration storage

## Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd gold-billing-system
   npm run install:all
   ```

2. **Set up environment variables:**
   ```bash
   # Backend
   cp backend/env.example backend/.env
   # Edit backend/.env with your configuration
   
   # Frontend
   cp frontend/env.example frontend/.env
   # Edit frontend/.env with your configuration
   ```

3. **Initialize database:**
   ```bash
   npm run migrate
   npm run seed
   ```

4. **Start development servers:**
   ```bash
   npm run dev
   ```

This will start:
- Backend API server on `http://localhost:3001`
- Frontend development server on `http://localhost:5173`

### Production Build

1. **Build both frontend and backend:**
   ```bash
   npm run build
   ```

2. **Start production servers:**
   ```bash
   npm run start
   ```

## API Endpoints

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create new product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Customers
- `GET /api/customers` - Get all customers
- `GET /api/customers/:id` - Get customer by ID
- `POST /api/customers` - Create new customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Invoices
- `GET /api/invoices` - Get all invoices
- `GET /api/invoices/:id` - Get invoice by ID with items
- `POST /api/invoices` - Create new invoice
- `PATCH /api/invoices/:id/payment` - Update payment status

### Inventory
- `GET /api/inventory/overview` - Get inventory overview
- `GET /api/inventory/low-stock` - Get low stock products
- `GET /api/inventory/transactions` - Get stock transactions
- `POST /api/inventory/adjust` - Adjust stock levels

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/sales-chart` - Get sales chart data
- `GET /api/dashboard/payment-methods` - Get payment method distribution

## Development

### Backend Development
```bash
cd backend
npm run dev          # Start development server
npm run build        # Build for production
npm run migrate      # Run database migrations
npm run seed         # Seed database with sample data
```

### Frontend Development
```bash
cd frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

## Database Management

### Migrations
Database schema changes are managed through migration files in `backend/src/database/schema.sql`. To apply changes:

```bash
cd backend
npm run migrate
```

### Seeding
Sample data can be loaded using:

```bash
cd backend
npm run seed
```

## Offline Capabilities

This application is designed to work offline by:
- Using SQLite as a local database
- Storing all data locally on the device
- Providing full functionality without internet connection
- Data synchronization when connection is restored

## Technology Stack

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router
- React Hook Form
- React Query
- i18next (Internationalization)
- Recharts (Charts)
- Lucide React (Icons)

### Backend
- Node.js
- Express.js
- TypeScript
- SQLite with better-sqlite3
- CORS
- Helmet (Security)
- Morgan (Logging)
- Compression

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
