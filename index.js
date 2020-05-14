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

    if( ! fragments || ! Object.keys( fragments ).length ) {
      reporter.warn( 'Query contains fragments but no index provided.' );
      return;
    }

    // For now we are just going through all fragments and running
    // simple string replacement.
    for( let [ name, value ] of Object.entries( fragments ) ) {

      if( ! query.includes( name ) ) {
        continue;
      }

      // Process string.
      if( typeof value === 'string' ) {
        const search = `\\$\\{(${name})\\}`;
        const pattern = new RegExp( search, 'g' );
        query = query.replace( pattern, value );
      }
      // Process function.
      else if( typeof value === 'function' ) {

        // const ast = parser.parse( query, {
        //   errorRecovery: true,
        //   plugins: [ 'jsx' ],
        //   sourceType: 'module',
        // } );
        //
        // traverse( ast, {
        //   Identifier: function( path ) {
        //
        //     if( path.node.name === name ) {
        //
        //     }
        //     console.log( '=======', path.node.name );
        //   }
        // } );

      }

    }
  }

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
    reporter.error( query );

    return err;

  }


}

