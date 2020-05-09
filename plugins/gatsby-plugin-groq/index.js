const groq = require( 'groq-js' );
const murmurhash = require( './murmur' );
const parser = require( '@babel/parser' );
const traverse = require( '@babel/traverse' ).default;

const ROOT = process.env.INIT_CWD;

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

  if( process.env.NODE_ENV === 'development' ) {

    try {
      const result = require( `${ROOT}/.cache/groq/${hash}.json` );
      return result;
    }
    catch( err ) {
      console.warn( err );
    }

  }
  else {

    try {
      const result = require( `${ROOT}/public/static/groq/${hash}.json` );
      return result;
    }
    catch( err ) {
      console.warn( err );
    }

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
 * @return  {array}
 */
exports.runQuery = async ( rawQuery, dataset, options = {} ) => {

  const { fragments, params } = options;
  let query = rawQuery;

  // Check if query has fragment.
  const hasFragment = query.includes( '${' );

  if( hasFragment ) {

    if( ! fragments || ! Object.keys( fragments ).length ) {
      console.warn( 'GROQ query contains fragments but no fragment index found.' );
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

  query = query.replace( /`/g, '', );

  try {

    const parsedQuery = groq.parse( query );
    const value = await groq.evaluate( parsedQuery, { dataset } );
    const result = await value.get();

    return result;

  }
  catch( err ) {
    console.error( err );
  }

}

