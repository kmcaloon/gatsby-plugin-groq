# gatbsy-plugin-groq

**Gatsby plugin for using GROQ in place of GraphQL**

The purpose of this plugin is to merge the power of GROQ and Gatsby by allowing developers to run GROQ queries against Gatsby's data layer in their page and static queries. For those of you who are familiar with GROQ, you are probably already in love and need no introduction. For everyone else, I highly suggest reading the below [What is This](#introduction) and [Resources](#resources) sections.

Included in this repository is a demo Gatsby starter with some data to play around with. You can find it under `packages/gatsby-groq-starter`. Just download the files and follow the plugin installation instructions below to start having fun.

**View low quality demo here:**
https://drive.google.com/file/d/1FVch2HbAWk1TEXph1katiNb1uuaBLSHf/view?usp=sharing

## 🎂 Features
- Works with any data pulled into Gatsby's data layer
- Replicates Gatsby's beloved patterns
- GROQ-based page queries with HMR
- GROQ-based static queries with live reloads
- Leverages GROQ's native functionality for advanced querying, node/document projections, joins (limited), etc,
- String interpolation ("fragments") within queries, much more flexible than GraphQL fragments
- GROQ explorer in browser during development at `locahost:8000/__groq` **(TO DO)**
- Optimized for incremental builds on Cloud and OSS **(TO DO)**

## 🚀 Get Started

1. At the root of your Gatsby project, install from the command line:
```
npm install --save gatsby-plugin-groq
// or
yarn add gatsby-plugin-groq
```
2. In `gatbsy-config.js`, add the plugin configuration to the `plugins` array:
```
module.exports = {
  //...
  plugins: [
    {
      resolve: 'gatsby-plugin-groq',
      options: {
        // Location of your project's fragments index file.
        // Only required if you are implementing fragments.
        fragmentsDir: './src/fragments'
      }
    }
  ]
}
```
3. To use a GROQ page query, simply add a named `groqQuery` export to the top of your component file as you would a Gatsby query:
```
export const groqQuery = `
  ...
`
```
4. To use a GROQ static query, use the `useGroqQuery` hook:
```
import { useGroqQuery } from 'plugins/gatsby-plugin-groq';

export function() {

  const data = useGroqQuery( `
    ...
  ` );

}
```
5. For more flexibility and advanced usage check out [Fragments](#fragments)

## 🤔 What is This? <a name="introduction"></a>
Gatsby is an amazing tool that has helped advance modern web development in significant ways. While many love it for its magical frontend concoction of static generation and rehydration via React, easy routing, smart prefetching, image rendering, etc., one of the key areas where it stands out from other similar tools is its GraphQL data layer. This feature is a large part of why some developers love Gatsby and why others choose to go in another direction. Being able to source data from multiple APIs, files, etc. and compile them altogether into a queryable GraphQL layer is ***amazing***, but many developers simply don't enjoy working with GraphQL. This is where GROQ comes in.

<<<<<<< HEAD
GROQ (**G**raph-**R**elational **O**bject **Q**ueries) is an incredibly robust and clear general query language designed by the folks at [Sanity](https://www.sanity.io/) for filtering and projecting JSON data. In many ways it is very similar to GraphQL in that you can run multiple robust queries and specify the data you need all within a single request, however with GROQ you can accomplish much more in a smoother and more flexible way. It supports complex parameters and operators, functions, piping, advanced joins, slicing, ordering, projections, conditionals, pagination etc., all with an intuitive syntax 😲.
=======
GROQ (**G**raph-**R**elational **O**bject **Q**ueries) is an incredibly robust and clear general query language design by the folks at Sanity Inc. for filtering and projecting JSON data. In many ways it is very similar to GraphQL in that you can run multiple robust queries and specify the data you need all within a single request, however with GROQ you can accomplish much more in a more clear and flexible way. It supports complex parameters and operators, functions, piping, advanced joins, slicing, ordering, projections, conditionals, pagination etc., all with an intuitive syntax 😲.
>>>>>>> origin/master

For example, take this somewhat simple GraphQL query:

```
{
  authors(where: {
      debutedBefore_lt: "1900-01-01T00:00:00Z",
      name_matches: "Edga*r"
  ) {
    name,
    debutYear,
  }
}
```

Here is what it would look like using GROQ:

```
*[_type == "author" && name match "Edgar" && debutYear < 1900]{
  name,
  debutYear
}
```

The more complex the queries, the more GROQ's advantages shine. This is why some developers already familiar with GROQ bypass Gatsby's data layer so that they could leverage its power.


## 🧙 How it Works
This plugin mimics Gatsby's own method of extracting queries from components by using a few Babel tools to parse files and traverse code to capture all queries found in files. By leveraging Gatsby's Node APIs and helpers we are able to extract queries from files on demand then run them against all GraphQL nodes found in Gatsby's redux store. After queries are run we can either feed results into a page's context (page queries), or cache for later use within individual components (static queries). Everything was done to leverage available APIs and to avoid interacting with Gatsby's data store directly as much as possible.

For now, all cache related to groq queries can be found in `.cache/groq` during development and `public/static/groq` in production.

###  Page Queries
All page-level components with `groqQuery` exports will have their queries (template literal) extracted and cached unprocessed as a hashed json file in the groq directory. The hash is based on the component file's full path so that the cached file can always be associated with the component. During bootstrap, whenever a page is created via `createPage` the plugin checks the cache to see if there is a page query related to it page's component. If there is, it then runs the query and replaces any variables with values supplied in the page's context. The result is stored in the `data` property within `pageContext`.

For example, if a page query contains `*[ _type == "page" && _id == $_id ]{ ... }` and a page is created with `context: { _id: "123" }`, the plugin will include the variable and run the query: `*[ _type == "page" && _id == "123" ]{ ... }`.

During development all files are watched for changes. Whenever there is a change to a file containing a page query the above process runs again and the updated data is injected into all paths that contain the changed component.

### Static Queries
All components using the hook `useGroqQuery` first have these queries extracted, processed, and cached during bootstrap. However unlike page queries, static query hashes are based off of the queries themselves and contain the actual results of their queries after they have been run. If a static query changes, it generates a new hashed result. During SSR and runtime, the `useGroqQuery` function then retrieves the cache associated to its query and returns the result.

Similar to page queries, all files are watched for changes and whenever there is a change to a file containing a static query the above process runs again, the query results are cached, and the page refreshes with the static query now returning the updated content.

### Fragments <a name="fragments"></a>
Playing off of GraphQL, "fragments" are strings of reusable portions of GROQ queries that can be interpolated within other queries. For example, say you have a blog where you are showing post snippets throughout multiple page templates and for every post need to retrieve its `id`, `title`, `summary`, and `category`, along with the category's `name` and `slug`. Instead of having to remember which fields you need and write this out every time, you could create a reusable fragment:

```
exports.postSnippetFields = `
  id,
  summary,
  title,
  "category": *[ type == "category" && id == ^.category ] {
    name,
    slug
  }
`
```

Then simply reuse the fragment wherever you need:

```
import { postSnippetFields } from 'src/fragments';

const groqQuery = `
  *[ type == "post" ] {
    ${postSnippetFields}
  }
```
To use GROQ fragments with this plugin, for now all fragments must be exported from a `index.js` using CommonJS syntax. You must also specify the directory where this file is found within the plugin options: `fragmentsDir: // Directory relative to project root`.

**That should cover most of it. Check the comments within code for more details.**


## ⌛ TO DO (random order)
- ~~Get rid of relative directories~~
- ~~Work on issues with joins~~ we might be limited here
- ~~Clean up spotty caching issues after running development~~
- ~~Experiment with other data sources (WordPress)~~
- GROQ explorer
- Allow for fragment functions
- Set up page refreshing when fragments are changed
- Look into using esm for ES6 imports/exports
- Set up an option to auto-resolve references?
- Error messaging (especially when there are Babel parsing errors)
- Performance optimizations
- Improve docs
- Provide recipe docs with heavy use of fragments
- Incremental builds?
- Allow for variables within static queries?
- Helpers for real-time listening in client (Sanity only)
- Tests
- Proselytize everyone from GraphQL to GROQ.

## 📖 GROQ Resources <a name="resources"></a>
- [GROQ Intro Video](https://www.youtube.com/watch?v=Jcfubj2zRI0)
- [GROQ Docs](https://www.sanity.io/docs/overview-groq)
- [CSS Ticks - The Best (GraphQL) API is One You Write](https://css-tricks.com/the-best-graphql-api-is-one-you-write/)
- [Review of GROQ, A New JSON Query Language](https://nordicapis.com/review-of-groq-a-new-json-query-language/)

## 🙇 Huge Thanks
Thanks to the awesome teams at [Gatsby](https://www.gatsbyjs.org/) and [Sanity](https://www.sanity.io/) for their absolutely amazing tools and developer support. If you haven't checked it out yet, I would **HIGHLY** recommend looking into Sanity's incredible CMS. It's hard to imagine how a headless CMS experience could be any better.
