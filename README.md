OSU course dependency visualizer

Visit https://mbund.github.io/cdr/ to view the dependency graph of every class offered at OSU. It might take ~30 seconds to build the full graph.

Filter the graph with comma separated query parameters specifying subject IDs:

- All classes except those in the Music department
  - https://mbund.github.io/cdr/?exclude=MUSIC
- All classes except those in the English, Biology, and Psychology departments
  - https://mbund.github.io/cdr/?exclude=ENGLISH,BIOLOGY,PSYCH
- Only classes in the Math department
  - https://mbund.github.io/cdr/?include=MATH
- Only classes in the CSE, Math, Physics and Statistics departments
  - https://mbund.github.io/cdr/?include=CSE,PHYSICS,MATH,STAT

### Running

```
pnpm astro dev
```

### Maintaining

#### Fetch the latest data from the OSU course catalog

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
