This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Prerequisites

- Node.js 18+ installed
- npm, yarn, pnpm, or bun package manager

## Installation  

1. Clone the repository
2. Install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

## Environment Setup

This project uses [pushenv](https://github.com/pushenv/pushenv) for secure environment variable management.

### Step 1: Install pushenv globally

```bash
npm i -g pushenv
```

### Step 2: Initialize pushenv

Run the following command and enter the passphrase when prompted:

```bash
pushenv init
```

This will decrypt and set up your environment variables from the encrypted configuration.

### Step 3: Pull environment variables

To get the latest environment variables from the remote pushenv service, run:

```bash
pushenv pull
```
   
This command will fetch and decrypt the latest environment variables and update your local `.env` file. You may be prompted for the passphrase.

> **Note:** Use `pushenv pull` whenever you need to update your local environment variables with the latest changes from the remote repository.

### Environment Variables

The following environment variables are required:

- `NEXT_PUBLIC_API_BASE_URL` - The base URL for the backend API (defaults to `http://localhost:5000/api` if not set)

After running `pushenv init` or `pushenv pull`, your `.env` file will be created with the necessary environment variables.

## Getting Started

First, ensure you've completed the environment setup above, then run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn more

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
