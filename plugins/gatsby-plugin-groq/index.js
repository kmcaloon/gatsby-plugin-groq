const groq = require( 'groq-js' );
const murmurhash = require( 'babel-plugin-remove-graphql-queries/murmur' );

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

  const hash = murmurhash( query, 'abc' );

  if( process.env.NODE_ENV === 'development' ) {

    try {
      const result = require( `../../.cache/groq/${hash}.json` );
      return result;
    }
    catch( err ) {
      console.warn( err );
    }

  }
  else {

    try {
      const result = require( `../../public/static/groq/${hash}.json` );
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
 * @param   {string}  query
 * @param   {map}     dataset
 * @param   {Object}  params // Need to do this...
 * @return  {array}
 */
exports.runQuery = async ( query, dataset, params ) => {

  const parsedQuery = groq.parse( query );
  const value = await groq.evaluate( parsedQuery, { dataset } );
  const result = await value.get();

  return result;

}

