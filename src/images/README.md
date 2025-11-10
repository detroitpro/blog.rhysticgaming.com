# Images Directory

Place images for your blog posts in the `posts/` subdirectory.

## Directory Structure

```
src/images/
  posts/          # Images for blog posts
    tournament-report-1/
      decklist.png
      match-result.jpg
    ...
```

## Using Images in Posts

In your markdown posts, reference images using the `/images/` path:

```markdown
![Alt text]({{ '/images/posts/tournament-report-1/decklist.png' | url }})

Or with a caption using HTML:

<figure>
  <img src="{{ '/images/posts/tournament-report-1/decklist.png' | url }}" alt="My decklist">
  <figcaption>My Kefka decklist for the tournament</figcaption>
</figure>
```

The `| url` filter ensures the path works correctly with your custom domain setup.

