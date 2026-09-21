# Matt van Zyl — Portfolio

A single-page personal portfolio. Plain HTML/CSS/JS — no build step, no framework.

## Files

| File         | What it is                                                        |
| ------------ | ----------------------------------------------------------------- |
| `index.html` | All the content and structure (hero, work, about, experience...). |
| `styles.css` | All the styling. Colours/spacing live in the `:root` tokens up top. |
| `main.js`    | Tiny script — only sets the footer year automatically.            |

## Editing

Everything you'd want to change is plain text:

- **Your words** — edit `index.html` directly. Look for the `<!-- SECTION -->` comments.
- **Colours, fonts, spacing** — edit the variables at the top of `styles.css` (`:root { ... }`).
- **Project images** — replace the placeholder boxes (`.work-thumb`) with an `<img>` tag,
  e.g. `<img src="images/project-one.jpg" alt="Project one" />` (drop the file in an `images/` folder).
- **Company logos** — currently text. To use real logos, swap each `<span class="logo-item">`
  for an `<img>`.

## Preview locally

Just double-click `index.html` to open it in your browser. That's it.

## Publishing (recommended path)

You don't need a server or any developer tooling. Two free options, both support a custom domain:

### Cloudflare Pages (recommended)

1. Go to https://pages.cloudflare.com and sign up (free).
2. Choose **"Upload assets"** → drag this `portfolio` folder in.
3. It goes live at `your-project.pages.dev` in seconds.
4. Buy a domain (Cloudflare Registrar sells them at cost) and connect it under
   **Custom domains** — a couple of clicks.

### Netlify Drop (even simpler)

1. Go to https://app.netlify.com/drop
2. Drag this `portfolio` folder onto the page. Live immediately.
3. Add a custom domain in **Domain settings**.

To update the site later, just drag the folder in again (or connect a GitHub repo for
auto-deploys).
