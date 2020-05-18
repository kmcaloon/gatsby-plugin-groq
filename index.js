const groq = require( 'groq-js' );
const murmurhash = require( './murmur' );
const { reporter } = require( './utils' );


/**
 * Hook to mimic Gatsby's static query.
 * During extraction the plugin fines and extracts these queries
 * and stores them in a directory. During SSR and runtime this function
 * fetches the query reults from wherever they are being cached.
 *
 * @param   {string}  query
 * @return  {array}
 */
exports.useGroqQuery = query => {

  const hash = murmurhash( query );

  try {
    const result = require( `${process.env.GROQ_DIR}/${hash}.json` );
    return result;
  }
  catch( err ) {
    console.warn( err );
  }

}

/**
 * Groq query helper function.
 *
 * @param   {string}  rawQuery
 * @param   {map}     dataset
 * @param   {Object}  options
 * @param   {Object}  options.fragments
 * @param   {Object}  options.params
 * @param   {string}  options.file      For debugging.
 * @return  {Object}  Array of results along with final query
 */
exports.runQuery = async ( rawQuery, dataset, options = {} ) => {

  const { file, fragments, params } = options;
  let query = rawQuery;

  // Check if query has fragment.
  const hasFragment = query.includes( '${' );

  if( hasFragment ) {
    query = processFragments( query, fragments );
  }

  query = processJoins( query );

  try {

    const strippedQuery = query.replace( /`/g, '', );
    const parsedQuery = groq.parse( strippedQuery );
    const value = await groq.evaluate( parsedQuery, { dataset } );
    const result = await value.get();

    return { result, finalQuery: query }

  }
  catch( err ) {
    console.error( file );
    reporter.error( `${err}` );
    reporter.error( `Query: ${query}` );

    return err;

  }


}

/**
 * Process joins.
 *
 * @param   {string}  query
 * @return  {string}
 */
function processJoins( query ) {

  // We need to figure out a clean way to get plugin options...
  let processedQuery = query;

  console.log( '....' );

  if( processedQuery.includes( '->' ) ) {
    const search = `\\S+->\\w*`;
    const regex = /\S+->\w*/gm;

    for( let match of regex.exec( processedQuery ) ) {

      let field = match.replace( '->', '' );

      // Array.
      if( field.contains( '[]' ) ) {

      }

    }

    // const pattern = new RegExp( search, 'g' );
    // const value = 'HIIIIII';
    // processedQuery = processedQuery.replace( pattern, value );
    // console.log( processedQuery );
  }

  return processedQuery;

}

/**
 * Process fragments.
 *
 * @param   {string}  query
 * @param   {object}  fragments
 * @return  {string}
 */
function processFragments( query, fragments ) {

  let processedQuery = query;

  if( ! fragments || ! Object.keys( fragments ).length ) {
    reporter.warn( 'Query contains fragments but no index provided.' );
    return null;
  }

  // For now we are just going through all fragments and running
  // simple string replacement.
  for( let [ name, value ] of Object.entries( fragments ) ) {

    if( ! processedQuery.includes( name ) ) {
      continue;
    }

    // Process string.
    if( typeof value === 'string' ) {
      const search = `\\$\\{(${name})\\}`;
      const pattern = new RegExp( search, 'g' );
      processedQuery = processedQuery.replace( pattern, value );
    }
    // Process function.
    // else if( typeof value === 'function' ) {
    //
    // }

  }

  return processedQuery;


}

