const path = require( 'path' );
const slash = require( 'slash' );
const { runQuery } = require( './plugins/gatsby-plugin-groq' );

/**
 * Create demo pages.
 */
exports.createPages = async ( { graphql, actions, cache, getNodes, reporter, traceId } ) => {

  const { createPage } = actions;
  const nodes = getNodes();
  const postQuery = await runQuery( `*[ _type == "post" ]{
    _id,
    slug {
      current
    }
  }`, nodes );

  if( !! postQuery && postQuery.length ) {
    for( let post of postQuery ) {

      const { id, _id } = post;
      const postPath = `/${post.slug.current}`;
      const template = path.resolve( `./src/templates/Page.js` );

      createPage( {
        path: postPath,
        component: slash( template ),
        context: {
          _id,
        }
      } );

    }

  }
}
