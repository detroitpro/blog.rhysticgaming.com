# Rhystic Gaming Blog

A Magic: The Gathering blog built with [Eleventy](https://www.11ty.dev/) and hosted on GitHub Pages.

## About

Rhystic Gaming is a blog dedicated to Magic: The Gathering strategy, deck building, and community. The theme is inspired by the iconic card **Rhystic Study**.

## Local Development

### Prerequisites

- Node.js 18 or higher
- npm (comes with Node.js)

### Setup

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd blog.rhysticgaming.com
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

   The site will be available at `http://localhost:8080`

4. For watch mode (auto-reload on changes):
   ```bash
   npm run dev
   ```

### Building

To build the site for production:

```bash
npm run build
```

The output will be in the `_site` directory.

## Writing Posts

Create new blog posts by adding Markdown files to the `src/posts/` directory. Each post should include front matter:

```markdown
---
title: "Your Post Title"
date: 2025-01-27
tags: ["Magic: The Gathering", "Strategy"]
---

Your post content here...
```

## Deployment

This site is automatically deployed to GitHub Pages via GitHub Actions when you push to the `main` branch.

### Setting up GitHub Pages

1. Go to your repository on GitHub
2. Navigate to **Settings** > **Pages**
3. Under **Source**, select **GitHub Actions** (not a branch)
4. The workflow will automatically deploy when you push to `main`

## Project Structure

```
blog.rhysticgaming.com/
├── .eleventy.js          # Eleventy configuration
├── .github/
│   └── workflows/
│       └── deploy.yml    # GitHub Actions workflow
├── src/
│   ├── _data/
│   │   └── metadata.json # Site metadata
│   ├── _includes/
│   │   └── layouts/
│   │       ├── base.njk  # Base layout
│   │       └── post.njk  # Post layout
│   ├── css/
│   │   └── style.css     # Styles (Rhystic Study theme)
│   ├── posts/            # Blog posts (Markdown)
│   └── index.njk         # Home page
├── _site/                # Generated site (gitignored)
└── package.json
```

## Customization

- **Site metadata**: Edit `src/_data/metadata.json`
- **Styling**: Edit `src/css/style.css`
- **Layouts**: Edit files in `src/_includes/layouts/`
- **Configuration**: Edit `.eleventy.js`

## License

ISC

