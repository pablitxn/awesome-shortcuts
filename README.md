This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

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

## Docker Deployment

This application is designed to run locally using Docker with access to your configuration files.

### Prerequisites

- Docker and Docker Compose installed
- Configuration files on your system (e.g., `~/.config/nvim`, `~/.tmux.conf`, `~/.zshrc`)

### Quick Start

1. Build and run the container:

```bash
docker-compose up --build
```

2. Access the application at [http://localhost:3000](http://localhost:3000)

3. Check the health endpoint at [http://localhost:3000/api/health](http://localhost:3000/api/health)

### Volume Mounts

The Docker container mounts your local configuration files:

- `~/.config/nvim` → `/mnt/nvim` (read/write)
- `~/.tmux.conf` → `/mnt/tmux.conf` (read/write)
- `~/.zshrc` → `/mnt/zshrc` (read/write)
- `./data` → `/app/data` (SQLite database persistence)

### Environment Variables

Configure these in `docker-compose.yml`:

- `NODE_ENV`: Set to `production`
- `DATABASE_PATH`: Path to SQLite database (default: `/app/data/local.db`)
- `CONFIG_NVIM_PATH`: Path to Neovim config in container
- `CONFIG_TMUX_PATH`: Path to Tmux config in container
- `CONFIG_ZSH_PATH`: Path to Zsh config in container

### Custom Config Paths

If your configuration files are in different locations, update the volume mounts in `docker-compose.yml`:

```yaml
volumes:
  - /your/custom/path:/mnt/nvim:rw
  - /your/custom/.tmux.conf:/mnt/tmux.conf:rw
```

### Health Check

The container includes a health check that verifies:
- Application is running
- Database connection is working

View health status:
```bash
docker-compose ps
```

### Troubleshooting

**Container won't start:**
- Ensure Docker is running
- Check that port 3000 is available
- Verify config file paths exist on your system

**Config files not accessible:**
- Ensure the paths in `docker-compose.yml` match your system
- Check file permissions
- On macOS, ensure Docker has access to the directories in Docker Desktop settings

**Database errors:**
- The `./data` directory is created automatically
- Database files persist between container restarts
- To reset the database, remove files in `./data/` (except `.gitkeep`)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
