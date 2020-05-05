const axios = require( 'axios' );
const parser = require( '@babel/parser' );
const traverse = require( '@babel/traverse' ).default;
const fs = require( 'fs' );
const glob = require( 'glob' );
const groq = require( 'groq-js' );
const path = require( 'path' );
const normalizePath = require( 'normalize-path' );
const murmurhash = require( "babel-plugin-remove-graphql-queries/murmur" );
//const { babelParseToAst } = require( 'gatsby/dist/utils/babel-parse-to-ast' );
const { watchDirectory } = require( 'gatsby-page-utils' );
const{ runQuery } = require( './index' );

// Will make all this prettier once built out as plugin.
// Right now everything depends on specific directory structure.
const ROOT = process.env.INIT_CWD;
const GATSBY_HASH_SEED = 'abc';
const GROQ_DIR = process.env.NODE_ENV === 'development' ? `${ROOT}/.cache/groq` : `${ROOT}/public/static/groq`;


/**
 * Here's where we extract and run all initial queries.
 * Also sets up a watcher to re-run queries during dev when files change.
 *
 * Runs in right after schema creation and before createPages.
 */
exports.resolvableExtensions = async ( { graphql, actions, cache, getNodes, reporter, traceId, store } ) => {

  // Ugly.
  if( ! fs.existsSync( GROQ_DIR ) ) {
    fs.mkdirSync( GROQ_DIR );
  }
  //await cache.set( 'page-query-paths', {} );

  // Extract initial queries.
  const intitialNodes = getNodes();
  extractQueries( { nodes: intitialNodes, reporter, traceId, cache } );


  // For now watching all files to re-extract queries.
  // Right now there doesn't seem to be a way to watch for build updates using Gatsby's public node apis.
  // Created a ticket in github to explore option here.
  fs.watch( `${ROOT}/src`, { recursive: true }, async ( event, trigger ) => {

    reporter.info( 'Re-processing groq queries...' );

    // Get info for file that was changed.
    const filePath = path.join( __dirname, '..', '..', 'src', trigger );
    const fileContents = fs.readFileSync( filePath, 'utf-8' );

    // Check if file has either page or static queries.
    const pageQueryMatch = /export const groqQuery = /.exec( fileContents );
    const staticQueryMatch = /useGroqQuery/.exec( fileContents );
    if( ! pageQueryMatch && ! staticQueryMatch ) {
      return;
    }

    // Get updated nodes to query against.
    const nodes = getNodes();

    // Run page queries.
    if( pageQueryMatch ) {

      const { deletePage, createPage } = actions;
      const { pages } = store.getState();
      //const pageQueryPaths = await cache.get( 'page-query-paths' );

      // First we need to reprocess the page query.
      const { fileHash: newHash, query: newQuery } = await processFilePageQuery( filePath, nodes );
      const queryFile = `${GROQ_DIR}/${newHash}.json`;

      await cacheQueryResults( newHash, newQuery );

      // Update all paths using this page component.
      // Is this performant or should we try to leverage custom cache?
      for( let [ path, page ] of pages ) {

        if( page.component !== filePath ) {
          continue;
        }

        reporter.info( 'Updating path...' );
        console.log( page.path );

        // Run query and inject into page context.
        pageQueryToContext( {
          actions,
          file: queryFile,
          nodes,
          page
        } )


      }
    }

    // Static queries.
    if( ! staticQueryMatch ) {
      return;
    }

    try {

      // Run query and save to cache.
      // Files using the static query will be automatically refreshed.
      const { hash, json } = await processFileStaticQuery( filePath, nodes );
      await cacheQueryResults( hash, json );

    }
    catch( err ) {
      console.warn( err );
    }

  } );


}

/**
 * Inject page query results its page.
 */
exports.onCreatePage = async ( { actions, cache, getNodes, page, reporter, traceId } ) => {

  // Check for hashed page queries for this component.
  const componentPath = page.component;
  const hash = murmurhash( componentPath, GATSBY_HASH_SEED );
  const queryFile = `${GROQ_DIR}/${hash}.json`;

  if( ! fs.existsSync( queryFile) ) {
    return;
  }

  // let pageQueryPaths = await cache.get( 'page-query-paths' );
  // if( ! pageQueryPaths ) {
  //   pageQueryPaths = {};
  // }
  // const componentsPaths = pageQueryPaths[hash] ? [ ...pageQueryPaths[hash] ]  : [];
  //
  // if( ! componentsPaths.includes( page.path ) ) {
  //
  //   componentsPaths.push( page.path );
  //   pageQueryPaths[hash] = [ ...componentsPaths ];
  //
  //   console.log( 'UPDATING PAGE QUERY CACHE', pageQueryPaths );
  //
  //   await cache.set( 'page-query-paths', pageQueryPaths );
  //
  // }

  // Run query and write to page context.
  pageQueryToContext( {
    actions,
    file: queryFile,
    getNodes,
    page,
  } )


}

/**
 * Extract page and static queries from all files.
 * Process and cache results.
 *
 * @param {Object} $0  Gatsby Node Helpers.
 */
async function extractQueries( { nodes, reporter, traceId, cache } ) {

  reporter.info( 'Getting files for groq extraction...' );

  // Pattern that will be appended to searched directories.
  // It will match any .js, .jsx, .ts, and .tsx files, that are not
  // inside <searched_directory>/node_modules.
  const filesRegex = `*.+(t|j)s?(x)`
  const pathRegex = `/{${filesRegex},!(node_modules)/**/${filesRegex}}`;

  let files = [
    path.join( ROOT, 'src' ),
  ].reduce( ( merged, folderPath ) => {

    merged.push(
      ...glob.sync( path.join( folderPath, pathRegex ), {
        nodir: true,
      } )
    );

    return merged;

  }, [] );

  files = files.filter( d => ! d.match( /\.d\.ts$/ ) );
  files = files.map( normalizePath );

  // Loop through files and look for queries to extract.
  for( let file of files ) {

    const pageQuery = await processFilePageQuery( file, nodes );
    const staticQuery = await processFileStaticQuery( file, nodes );

    // Cache page query.
    // This will only contain a json file of unprocessed query.
    if( !! pageQuery ) {
      const { fileHash, query } = pageQuery;
      cacheQueryResults( fileHash, query );
    }

    // Cache static query.
    // This will contain actual results of the query.
    if( !! staticQuery ) {
      const { hash, json } = staticQuery;
      cacheQueryResults( hash, json, 'static', );
    }

  }


}

/**
* Run page query and update the related page via createPage.
*
* @param {Object} $0  Gatsby Node Helpers.
*/
async function pageQueryToContext( { actions, file, getNodes, nodes, page, } ) {

  const { createPage, deletePage, setPageData } = actions;

  // Get query content.
  const content = fs.readFileSync( file, 'utf-8' );
  let { unprocessed: query } = JSON.parse( content );

  // Replace any variables within query with context values.
  if( page.context ){

    for( let [ key, value ] of Object.entries( page.context ) ) {

      const search = `\\$${key}`;
      const pattern = new RegExp( search, 'i' );
      query = query.replace( pattern, `"${value}"` );

    }
  }

  // Do the thing.
  const allNodes = nodes || getNodes();
  const results = await runQuery( query, allNodes );

  page.context.data = results;

  deletePage( page );
  createPage( {
    ...page,
  } );

}

/**
 * Extracts page query from file and returns its hash and unprocessed string.
 *
 * @param   {string}  file
 * @param   {map}     nodes`
 * @return  {Object}  fileHash and query
 */
async function processFilePageQuery( file, nodes  ) {

  const contents = fs.readFileSync( file, 'utf-8' );
  const match = /export const groqQuery = /.exec( contents );
  if( ! match ) {
    return;
  }

  try {

    const ast = parser.parse( contents, {
      errorRecovery: true,
      plugins: [ 'jsx' ],
      sourceFilename: file,
      sourceType: 'module',
    } );
    let pageQuery = null;

    traverse( ast, {
      ExportNamedDeclaration: function( path ) {

        const declarator = path.node.declaration.declarations[0];

        if( declarator.id.name === 'groqQuery' ) {
          pageQuery = declarator.init.quasis[0].value.raw;
        }

      }
    } );

    if( ! pageQuery ) {
      return;
    }

    const hash = hashQuery( file );

    return {
      fileHash: hash,
      query: JSON.stringify( { unprocessed: pageQuery } ),
    }
  }
  catch( err ) {
    console.warn(  err );
    return null;
  }

}

/**
 * Extracts static query from file and returns its hash and result.
 *
 * @param   {string}  file
 * @param   {map}     nodes
 * @return  {Object}  hash and query
 */
async function processFileStaticQuery( file, nodes  ) {

  const contents = fs.readFileSync( file, 'utf-8' );
  const match = /useGroqQuery/.exec( contents );

  if( ! match ) {
    return;
  }

  try {

    const ast = parser.parse( contents, {
      errorRecovery: true,
      plugins: [ 'jsx' ],
      sourceFilename: file,
      sourceType: 'module',
    } );
    let staticQuery = null;

    traverse( ast, {
      CallExpression: function( path ) {

        if( !! path.node.callee && path.node.callee.name === 'useGroqQuery' ) {

          staticQuery = path.node.arguments[0].quasis[0].value.raw;

        }
      }
    } );
    if( ! staticQuery ) {
      return null;
    }

    const hash = hashQuery( staticQuery );
    const result = await runQuery( staticQuery, nodes );
    const json = JSON.stringify( result );

    return { hash, json };

  }
  catch( err ) {
    console.warn( err );
    return null;
  }



}

/**
 * Cache result from query extraction.
 * For page queries this caches the query itself.
 * For static queries this caches the results of the query.
 *
 * @param {number}          hash  Hash to the json file.
 * @param {Object|string}   data  Data we are caching.
 * @param {string}          type  Page or static query. Optional. Default 'page'
 */
async function cacheQueryResults( hash, data, type = 'page' ) {

  console.log( `Caching ${type} query...`, hash );

  const json = typeof data !== 'string' ? JSON.stringify( data ) : data;

  if( process.env.NODE_ENV === 'development' ) {

    // Probably a more sophisticated Gatsby way of doing this.
    fs.writeFileSync( `${GROQ_DIR}/${hash}.json`, json, err => {
      if( err ) {
        throw new Error( err );
      }
    } );
  }
  else {

    fs.writeFileSync( `${GROQ_DIR}/${hash}.json`, json, err => {
      if( err ) {
        throw new Error( err );
      }
    } );

  }

}

/**
 * Generate a hash based on the query.
 *
 * @param  {string}  query
 * @return {number}
 */
function hashQuery( query ) {
  return murmurhash( query, GATSBY_HASH_SEED );
}

