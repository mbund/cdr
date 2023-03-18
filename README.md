OSU course dependency visualizer

## Maintaining

### Running

```
pnpm astro dev
```

### Fetch the latest data from the OSU course catalog

1. In a browser sign in to [buckeyelink](https://buckeyelink.osu.edu)
2. Navigate to Schedule Planner
3. Inspect network traffic in the browser and take the cookie from a request header
   - Cookie format: `Cookie: __RequestVerificationToken=AAAAAA; .AspNet.Cookies=BBBBBBBBBBBBBBBB`
4. Put the cookie in `.env` as `COOKIE`
   - Example: `COOKIE="__RequestVerificationToken=AAAAAA; .AspNet.Cookies=BBBBBBBBBBBBBBBB"`
5. Run the fetcher with `bun fetcher.ts`
6. Run the parser with `bun parser.ts`
7. Organize data by placing the created JSON into a reasonable folder
8. Commit the changes
