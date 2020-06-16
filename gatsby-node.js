const fs = require( 'fs' );
const glob = require( 'glob' );
const murmurhash = require( './murmur' );
const normalizePath = require( 'normalize-path' );
const parser = require( '@babel/parser' );
const path = require( 'path' );
const traverse = require( '@babel/traverse' ).default;
const { watch } = require( 'chokidar' );
const { runQuery } = require( './index' );
const { reporter } = require( './utils' );
const { groqDirectories } = require( './index' );

const { GROQ_DIR, ROOT } = groqDirectories;


/**
 * Here's where we extract and run all initial queries.
 * Also sets up a watcher to re-run queries during dev when files change.fcache
 *
 * Runs in right after schema creation and before createPages.
 */
exports.resolvableExtensions = async ( { graphql, actions, cache, getNodes, traceId, store }, plugin ) => {

  if( !! fs.existsSync( GROQ_DIR ) ) {
    fs.rmdirSync( GROQ_DIR, { recursive: true } );
  }
  fs.mkdirSync( GROQ_DIR );

  // Cache options (because we need them on frontend)
  // Probably a more sophisticated Gatsby way of doing this.
  if( !! plugin ) {

    fs.writeFileSync( `${GROQ_DIR}/options.json`, JSON.stringify( plugin ), err => {
      if( err ) {
        throw new Error( err );
      }
    } );

  }



  // Cache fragments.
  const fragmentsDir = !! plugin.fragmentsDir ? path.join( ROOT, plugin.fragmentsDir ) : null;

  if( !! fragmentsDir ) {
    cacheFragments( fragmentsDir, cache );
  }

  // Extract initial queries.
  const intitialNodes = getNodes();

  extractQueries( { nodes: intitialNodes, traceId, cache } );


  // For now watching all files to re-extract queries.
  // Right now there doesn't seem to be a way to watch for build updates using Gatsby's public node apis.
  // Created a ticket in github to explore option here.
  const watcher = watch( `${ROOT}/src/**/*.js` );

  watcher.on( 'change', async ( filePath ) => {

    // Recache if this was a change within fragments directory.
    if( !! fragmentsDir && filePath.includes( fragmentsDir ) ) {

      await cacheFragments( fragmentsDir, cache );

      //TODO need to figure out a way to refresh page with new data.
      reporter.info( `DON'T FORGET TO RESAVE FILES WITH UPDATED FRAGMENT!` );

    }

    // Get info for file that was changed.
    const fileContents = fs.readFileSync( filePath, 'utf8' );

    // Check if file has either page or static queries.
    const pageQueryMatch = /export const groqQuery = /.exec( fileContents );
    const staticQueryMatch = /useGroqQuery/.exec( fileContents );
    if( ! pageQueryMatch && ! staticQueryMatch ) {
      return;
    }

    reporter.info( 'Re-processing groq queries...' );

    // Get updated nodes to query against.
    const nodes = getNodes();

    // Run page queries.
    if( pageQueryMatch ) {

      const { deletePage, createPage } = actions;
      const { pages } = store.getState();

      // First we need to reprocess the page query.
      const processedPageQuery = await processFilePageQuery( filePath, nodes, cache );

      if( !! processedPageQuery ) {

        const { fileHash: newHash, query: newQuery } = processedPageQuery;
        const queryFile = `${GROQ_DIR}/${newHash}.json`;

        await cacheQueryResults( newHash, newQuery );

        // Update all paths using this page component.
        // Is this performant or should we try to leverage custom cache?
        for( let [ path, page ] of pages ) {

          if( page.component !== filePath ) {
            continue;
          }

          reporter.info( `Updating path: ${page.path}` );

          // Run query and inject into page context.
          pageQueryToContext( {
            actions,
            cache,
            file: queryFile,
            nodes,
            page
          } );

        }

      }

    }

    // Static queries.
    if( ! staticQueryMatch ) {
      return reporter.success( 'Finished re-processing page queries' );
    }

    // Run query and save to cache.
    // Files using the static query will be automatically refreshed.
    const staticQueries = await processFileStaticQueries( filePath, nodes, cache );

    if( !! ( staticQueries || [] ).length ) {

      for( let { hash, json } of staticQueries ) {

        if( ! hash || ! json ) {
          return reporter.warn( 'There was a problem processing one of your static queries' );
        }

        cacheQueryResults( hash, json );

      }

    }

    return reporter.success( 'Finished re-processing queries' );


  } );

};

/**
 * Inject page query results its page.
 */
exports.onCreatePage = async ( { actions, cache, getNodes, page, traceId } ) => {

  // Check for hashed page queries for this component.
  const componentPath = page.component;
  const hash = murmurhash( componentPath );
  const queryFile = `${GROQ_DIR}/${hash}.json`;

  if( ! fs.existsSync( queryFile) ) {
    return;
  }

  // Run query and write to page context.
  pageQueryToContext( {
    actions,
    cache,
    file: queryFile,
    getNodes,
    page,
  } );


}

/**
 * Extract page and static queries from all files.
 * Process and cache results.
 *
 * @param {Object} $0       Gatsby Node Helpers.
 */
async function extractQueries( { nodes, traceId, cache } ) {

  reporter.info( 'Getting files for groq extraction...' );

  const filesRegex = `*.+(t|j)s?(x)`
  const pathRegex = `/{${filesRegex},!(node_modules)/**/${filesRegex}}`;
  let hasErrors = false;
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

    const pageQuery = await processFilePageQuery( file, nodes, cache );
    const staticQueries = await processFileStaticQueries( file, nodes, cache );

    // Cache page query.
    // This will only contain a json file of unprocessed query.
    if( !! pageQuery ) {
      const { fileHash, query } = pageQuery;
      cacheQueryResults( fileHash, query );
    }

    // Cache static queries.
    // These will contain actual results of the query.
    if( !! ( staticQueries || [] ).length ) {

      for( let { hash, json } of staticQueries ) {

        if( ! hash || ! json ) {
          return reporter.warn( 'There was an error processing static query' );
        }

        cacheQueryResults( hash, json, 'static', );

      }

    }
  }

  reporter.success( 'Finished getting files for query extraction' );

}

/**
 * Cache fragments.
 *
 * @param   {string}  fragmentsDir
 * @param   {Object}  cache
 * @return  {bool}    if succesfully cached.
 */
async function cacheFragments( fragmentsDir, cache ) {

  const index = path.join( fragmentsDir, 'index.js' );

  if( !! fs.readFileSync( index ) ) {

    delete require.cache[ require.resolve( index ) ];

    fragments = require( index );

    await cache.set( 'groq-fragments', fragments );

    reporter.info( 'Cached fragments' );

    return true;

  }

  return false;

}

/**
* Run page query and update the related page via createPage.
*
* @param {Object} $0  Gatsby Node Helpers.
*/
async function pageQueryToContext( { actions, cache, file, getNodes, nodes, page, } ) {

  const { createPage, deletePage, setPageData } = actions;

  // Get query content.
  const content = fs.readFileSync( file, 'utf8' );
  let { unprocessed: query } = JSON.parse( content );

  // Replace any variables within query with context values.
  if( page.context ){

    for( let [ key, value ] of Object.entries( page.context ) ) {

      const search = `\\$${key}`;
      const pattern = new RegExp( search, 'g' );
      query = query.replace( pattern, `"${value}"` );

    }
  }

  // Do the thing.
  try {

    const allNodes = nodes || getNodes();
    const fragments = await cache.get( 'groq-fragments' );
    const { result } = await runQuery( query, allNodes, { file, fragments } );

    page.context.data = result;

    deletePage( page );
    createPage( {
      ...page,
    } );
  }
  catch( err ) {
    console.error( page.component );
    reporter.error( `${err}` );
    reporter.error( query );
  }


}

/**
 * Custom webpack.
 */
exports.onCreateWebpackConfig = async ( { actions, cache, plugins, store } ) => {


  // Make sure we have have access to GROQ_DIR for useGroqQuery().
  actions.setWebpackConfig( {
    plugins: [
      plugins.define( {
        'process.env.GROQ_DIR': JSON.stringify( GROQ_DIR ),
      } )
    ]
  } );

}

/**
 * Extracts page query from file and returns its hash and unprocessed string.
 *
 * @param   {string}   file
 * @param   {map}      nodes
 * @param   {Object}   cache
 * @return  {Object}   fileHash and query
 */
async function processFilePageQuery( file, nodes, cache ) {

  const contents = fs.readFileSync( file, 'utf8' );
  const match = /export const groqQuery = /.exec( contents );
  if( ! match ) {
    return;
  }

  const ast = parse( file, contents );
  if( ! ast ) {
    return null;
  }

  let pageQuery = null;
  let queryStart = null;
  let queryEnd = null;

  traverse( ast, {
    ExportNamedDeclaration: function( path ) {

      const declarator = path.node.declaration.declarations[0];

      if( declarator.id.name === 'groqQuery' ) {

        queryStart = declarator.init.start;
        queryEnd = declarator.init.end;
        pageQuery = contents.substring( queryStart, queryEnd );

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

/**
 * Extracts static query from file and returns its hash and result.
 *
 * @param   {string}  file
 * @param   {map}     nodes
 * @param   {Object}  cache
 * @return  {array}
 */
async function processFileStaticQueries( file, nodes, cache  ) {

  const contents = fs.readFileSync( file, 'utf8' );
  const match = /useGroqQuery/.exec( contents );
  if( ! match ) {
    return;
  }

  const ast = parse( file, contents );
  if( ! ast ) {
    return null;
  }

  const staticQueries = [];
  let queryStart = null;
  let queryEnd = null;

  traverse( ast, {
    CallExpression: function( path ) {

      if( !! path.node.callee && path.node.callee.name === 'useGroqQuery' ) {

        queryStart = path.node.arguments[0].start + 1;
        queryEnd = path.node.arguments[0].end - 1;

        staticQueries.push( contents.substring( queryStart, queryEnd ) );

      }

    }
  } );

  if( ! staticQueries.length ) {
    return null;
  }

  const fragments = await cache.get( 'groq-fragments' );
  const results = [];

  for( let staticQuery of staticQueries ) {

    const { result, finalQuery, queryToHash } = await runQuery( staticQuery, nodes, { file, fragments } );
    if( result instanceof Error ) {
      results.push( result );
    }

    const hash = hashQuery( queryToHash );
    const json = JSON.stringify( result );

    results.push( { hash, json } );

  }


  return results;

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

  reporter.info( `Caching ${type} query: ${hash}` );

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
 * Parse.
 *
 * @param   {string}  filePath
 * @param   {string}  content
 * @param   {Object}  options
 * @return  {ast}
 */
function parse( filePath, content, options = {} ) {

  const { plugins: additionalPlugins, ...additionalOptions } = options;
  let plugins = [ 'jsx' ];

  if( !! additionalPlugins ) {
    plugins = [ ...plugins, ...additionalPlugins ];
  }

  try {

    const ast = parser.parse( content, {
      errorRecovery: true,
      plugins,
      sourceType: 'module',
      ...additionalOptions,
    } );

    return ast;

  }
  catch( err ) {
    console.warn( `Error parsing file: ${filePath}` );
    console.log( 'Check below for more info' );
    return null;
  }

}

/**
 * Generate a hash based on the query.
 *
 * @param  {string}  query
 * @return {number}
 */
function hashQuery( query ) {
  return murmurhash( query );
}
