# Gatsby Groq (WIP)

**This is a WIP which for now includes a starter theme with local plugin for development purposes. Once ironed out it will be its own standalone plugin and these docs will be less abysmal**

**View low quality demo here:**
https://drive.google.com/file/d/1FVch2HbAWk1TEXph1katiNb1uuaBLSHf/view?usp=sharing

To do: Purpose of plugin (groq > graphql). Shout outs to Sanity and Gatsby teams because they're so awesome.

Actual plugin can be found in `plugins/gatsby-plugin-groq`. `index.js` contains some functions used during build and runtime, whereas `gatsby-node.js` contains all the wizardry.

## 🎂 Features
- Replicates Gatsby's beloved patterns
- Works with any data pulled into Gatsby's data layer **(Needs Testing)**
- GROQ-based page queries with HMR
- GROQ-based static queries with live reloads
- Leverages GROQ's native functionality for advanced querying, node/document projections, joins (limited), etc.
- String interpolation within queries, much more flexible than GraphQL fragments **(TO DO)**
- GROQ explorer in browser during development at `locahost:8000/__groq` **(TO DO)**
- Optimized for incremental builds on Cloud and OSS **(TO DO)**


## 🧙 How it works
This plugin mimics Gatsby's own method of extracting queries from components by using a few Babel tools to parse files and traverse code to capture all queries found in files. By leveraging Gatsby's Node APIs and helpers we are able to extract queries from files on demand then run them against all GraphQL nodes found in Gatsby's redux store. After queries are run we can either feed results into a page's context (page queries), or cache for later use within individual components (static queries). Everything was done to leverage available APIs and to avoid interacting with Gatsby's data store directly as much as possible.

For now, all cache related to groq queries can be found in `.cache/groq` during development and `public/static/groq` in production. **Note: I have made some changes since last testing builds so they might be buggy**

###  Page Queries
All page-level components with `groqQuery` exports will have their queries (template literal) extracted and cached unprocessed as a hashed json file in the groq directory. The hash is based on the component file's full path so that the cached file can always be associated with the component. During bootstrap, whenever a page is created via `createPage` the plugin checks the cache to see if there is a page query related to it page's component. If there is, it then runs the query and replaces any variables with values supplied in the page's context. The result is stored in the `data` property within `pageContext`.

For example, if a page query contains `*[ _type == "page" && _id == $_id ]{ ... }` and a page is created with `context: { _id: "123" }`, the plugin will include the variable and run the query: `*[ _type == "page" && _id == "123" ]{ ... }`.

During development all files are watched for changes. Whenever there is a change to a file containing a page query the above process runs again and the updated data is injected into all paths that contain the changed component.

### Static Queries
All components using the hook `useGroqQuery` first have these queries extracted, processed, and cached during bootstrap. However unlike page queries, static query hashes are based off of the queries themselves and contain the actual results of their queries after they have been run. If a static query changes, it generates a new hashed result. During SSR and runtime, the `useGroqQuery` function then retrieves the cache associated to its query and returns the result.

Similar to page queries, all files are watched for changes and whenever there is a change to a file containing a static query the above process runs again, the query results are cached, and the page refreshes with the static query now returning the updated content.



**I think that covers most of it. Check the comments within code for more details...**



## ⌛ TO DO (random order)
- Get rid of relative directories
- Work on issues with joins
- Need to execute code before traversing for GROQ fragments / string interpolation
- GROQ explorer
- Experiment with other data sources (WordPress)
- Set up an option to auto-resolve references?
- Clean up spotty caching issues after running development
- Error messaging (especially when there are Babel parsing errors)
- Performance optimizations
- Improve docs
- Provide recipe docs with heavy use of fragments
- Incremental builds?
- Allow for variables within static queries?
- Helpers for real-time listening in client (Sanity only)
- Tests
- Proselytize everyone from GraphQL to Groq.